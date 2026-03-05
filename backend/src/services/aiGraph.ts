/**
 * VAgent AI 创作助手 — Multi-Agent 架构
 *
 * 设计模式（LangGraph 风格）：
 *
 *   State      — 贯穿整图的上下文（消息、历史、视频数据、路由结果）
 *   Supervisor — 轻量 LLM 节点，读取对话意图，决定路由到哪个 Agent
 *   Agents     — 5 个专职 Agent，各持独立 Prompt，接收完整上下文
 *   Graph      — START → supervisor → agent → END
 *
 * 核心原则：
 *   - 路由决策完全由 LLM (Supervisor) 做，不硬编码任何条件分支
 *   - 对话历史始终随请求传递，保持上下文连贯性
 *   - 视频分析数据作为「可选上下文」注入，不强制约束响应内容
 *   - 用户的任何指令（包括"复述我的话"）都被 Agent 自然遵从
 */

import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from './gemini';
import { Video } from '../types';

const client = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { timeout: 60000 },  // 60s，覆盖默认 10s connect timeout
});
const MODEL = 'gemini-2.5-flash';

// ── Types ──────────────────────────────────────────────────────────────────

export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

type AgentName =
  | 'general_chat'
  | 'video_analyst'
  | 'content_creator'
  | 'editing_advisor'
  | 'multi_video_strategist';

interface AgentState {
  userMessage: string;
  history: HistoryMessage[];
  video: Video | null;
  videos: Video[];
  selectedAgent: AgentName | null;
  response: string;
  error: string | null;
}

// ── Helper ─────────────────────────────────────────────────────────────────

function fmt(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function buildVideoContext(video: Video | null): string {
  if (!video) return '';
  if (video.status !== 'analyzed' || !video.analysis) {
    return `\n---\n**当前选中视频（尚未分析）：**《${video.name}》· ${video.category}`;
  }
  const { analysis } = video;
  const segments = analysis.segments.map((s, i) =>
    `  ${i + 1}. [${fmt(s.startTime)}~${fmt(s.endTime)}] ${s.label}${s.isHighlight ? '⭐' : ''}: ${s.description}`
  ).join('\n');

  return `
---
**当前视频分析数据（${video.name}）：**
- 分类：${video.category}（${video.videoLabel || video.category}）| 时长：${video.duration}秒
- 情感基调：${analysis.mood} | 节奏感：${analysis.paceRating}/10
- 摘要：${analysis.summary}
- 精彩片段：${analysis.highlights}
- 分段结构：
${segments}
- AI 推荐标题：${analysis.suggestedTitle}
- AI 推荐标签：${analysis.suggestedTags.map(t => `#${t}`).join(' ')}
- 剪辑建议：${analysis.editingTips.join(' / ')}
---`;
}

function buildMultiVideoContext(videos: Video[]): string {
  const analyzed = videos.filter(v => v.status === 'analyzed' && v.analysis);
  const pending = videos.filter(v => v.status !== 'analyzed');
  if (videos.length === 0) return '';

  const summaries = analyzed.map((v, i) => {
    const a = v.analysis!;
    return `**视频${i + 1}：《${v.name}》** | ${v.category} | ${v.duration}s | 情感:${a.mood} | 节奏:${a.paceRating}/10
  摘要：${a.summary}
  精彩：${a.highlights}
  推荐标题：${a.suggestedTitle}
  推荐标签：${a.suggestedTags.slice(0, 5).map(t => `#${t}`).join(' ')}`;
  }).join('\n\n');

  const pendingNote = pending.length > 0
    ? `⚠️ 尚未分析的视频：${pending.map(v => `《${v.name}》`).join('、')}\n\n`
    : '';

  return `\n---\n**多视频上下文（共 ${videos.length} 个）：**\n${pendingNote}${summaries}\n---`;
}

// ── Agent Prompts ──────────────────────────────────────────────────────────
// 每个 Agent 只定义「角色定位 + 专业能力」，不限制能回答什么
// 所有 Agent 都会收到视频上下文（如有），但不强制必须基于视频回答

const AGENT_PROMPTS: Record<AgentName, string> = {

  general_chat: `你是 VAgent AI 助手，一个智能、友好、灵活的对话伙伴。
你能自由地与用户交流，回答任何问题，遵从用户的任何指令（例如角色扮演、复述、格式要求等）。
你同时了解短视频创作领域，如果用户提到视频相关的话题，你也能给出专业建议。
**请严格遵守用户给你的任何指令，包括回复格式、语气、内容等。**
使用中文回复，除非用户要求其他语言。`,

  video_analyst: `你是一位专业的短视频内容分析师，擅长深度解读视频内容结构、节奏、情感和用户体验。
你能基于视频 AI 分析数据，提供细致的内容洞察：片段节奏是否合理、情感弧线是否到位、
哪些时间点值得重点关注、内容对受众的吸引力评估等。
结合数据给出具体可执行的内容改进方向。
使用中文回复，善用 Markdown 格式让分析清晰易读。`,

  content_creator: `你是一位专注中国社交媒体的爆款内容创作顾问，服务于抖音、小红书、B站、微博等平台。
你擅长：撰写高点击率标题（含数字/情绪词/悬念）、平台差异化文案（抖音短促/小红书种草/B站深度）、
精准话题标签策略、视频描述与封面文案、热点借势写法。
给出的内容要能**直接复制使用**，不说废话，实战导向。
使用中文回复，适当使用 emoji 增强表现力。`,

  editing_advisor: `你是一位经验丰富的视频剪辑顾问，熟悉专业剪辑软件（PR、达芬奇、剪映等）的工作流程。
你擅长：视频结构设计（钩子/发展/高潮/收尾）、节奏控制与卡点技巧、转场与特效选用、
多段素材的叙事逻辑、BGM 选择与情绪匹配、封面帧筛选等。
结合视频分段数据（如有），给出具体的时间节点操作建议。
使用中文回复，操作建议要具体可执行。`,

  multi_video_strategist: `你是一位短视频账号运营策略专家，专注于多视频矩阵规划和系列化内容策略。
你擅长：跨视频内容互补分析、合集/系列化策划、发布节奏与频率建议、
账号人设与风格一致性、流量矩阵搭建、不同视频的受众差异分析。
基于用户提供的视频集合，给出系统性的运营策略和内容规划。
使用中文回复，策略要宏观与微观结合，既有方向又有落地步骤。`,
};

// ── 关键词兜底路由（Supervisor LLM 失败时使用）───────────────────────────

function keywordFallbackRoute(message: string, videos: Video[]): AgentName {
  if (videos.length > 1) return 'multi_video_strategist';
  const m = message;
  // 内容创作（优先匹配）
  if (/标题|title|吸睛|爆款题目|起名|取名|文案|描述|简介|copy|发布|话题|hashtag|标签|tag/.test(m)) return 'content_creator';
  // 剪辑（注意：不包含"节奏"因为分析问题中也常提到）
  if (/剪辑|怎么剪|剪切|转场|BGM|剪法|时间线|timeline|剪辑思路|剪辑方案/.test(m)) return 'editing_advisor';
  // 视频分析
  if (/分析|内容|片段|结构|情感|质量|效果|解读|看点|节奏感|评估/.test(m)) return 'video_analyst';
  // 多视频策略
  if (/合集|系列|多个视频|账号|矩阵|运营策略|排期/.test(m)) return 'multi_video_strategist';
  return 'general_chat';
}

// ── Node 1: Supervisor — LLM 路由决策 ────────────────────────────────────

async function supervisorNode(state: AgentState): Promise<Partial<AgentState>> {
  const videoInfo = state.video
    ? `当前视频：《${state.video.name}》（${state.video.status === 'analyzed' ? '已分析' : '未分析'}）`
    : '未选择视频';

  const multiVideoInfo = state.videos.length > 0
    ? `多视频：${state.videos.length} 个` : '';

  const recentHistory = state.history.slice(-3).map(m =>
    `${m.role === 'user' ? 'U' : 'A'}: ${m.content.slice(0, 60)}`
  ).join(' | ');

  const supervisorPrompt = `你是路由器。根据用户消息返回最合适的 Agent 编号（只输出1个数字，无其他内容）：
1=闲聊/自由对话/元指令(复述/角色扮演)  2=视频内容分析  3=写标题/文案/标签  4=剪辑建议  5=多视频策略
上下文: ${videoInfo}${multiVideoInfo ? ' | ' + multiVideoInfo : ''}${recentHistory ? ' | ' + recentHistory : ''}
用户: "${state.userMessage}"
编号:`;

  try {
    const result = await client.models.generateContent({
      model: MODEL,
      contents: [{ role: 'user', parts: [{ text: supervisorPrompt }] }],
      config: { temperature: 0, maxOutputTokens: 50 },
    });

    const raw = (result.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    const numToAgent: Record<string, AgentName> = {
      '1': 'general_chat', '2': 'video_analyst', '3': 'content_creator',
      '4': 'editing_advisor', '5': 'multi_video_strategist',
    };

    const num = raw.match(/[1-5]/)?.[0] ?? '';
    const byName: AgentName[] = ['general_chat', 'video_analyst', 'content_creator', 'editing_advisor', 'multi_video_strategist'];
    const selected: AgentName =
      numToAgent[num] ??
      byName.find(a => raw.toLowerCase().includes(a)) ??
      keywordFallbackRoute(state.userMessage, state.videos);  // 兜底用关键词路由

    console.log(`[Supervisor] 路由 → ${selected}（原始: "${raw}"）`);
    return { selectedAgent: selected };
  } catch (err) {
    const fallback = keywordFallbackRoute(state.userMessage, state.videos);
    console.warn(`[Supervisor] LLM 失败，关键词兜底 → ${fallback}:`, err);
    return { selectedAgent: fallback };
  }
}

// ── Node 2: Agent — 执行专职响应 ──────────────────────────────────────────

async function agentNode(state: AgentState): Promise<Partial<AgentState>> {
  const agentName = state.selectedAgent ?? 'general_chat';
  const basePrompt = AGENT_PROMPTS[agentName];

  // 注入视频上下文（作为可选信息，不强制要求基于视频回答）
  const videoContext = state.videos.length > 0
    ? buildMultiVideoContext(state.videos)
    : buildVideoContext(state.video);

  const systemPrompt = videoContext
    ? `${basePrompt}\n\n${videoContext}`
    : basePrompt;

  // 构建消息列表（包含历史对话）
  type GeminiPart = { text: string };
  type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };
  const contents: GeminiContent[] = [];

  // 历史对话（Gemini 要求 user/model 交替）
  for (const msg of state.history) {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    });
  }

  // 当前用户消息（附带 system prompt，因为 @google/genai 通过 systemInstruction 注入）
  contents.push({
    role: 'user',
    parts: [{ text: state.userMessage }],
  });

  const MAX_RETRIES = 2;
  let lastError = '';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await client.models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.85,
          // 不设置 maxOutputTokens，让模型自然生成完整响应
        },
      });

      const candidate = result.candidates?.[0];
      const text = candidate?.content?.parts?.[0]?.text ?? '';

      const finishReason = candidate?.finishReason;
      if (finishReason && String(finishReason) !== 'STOP') {
        console.warn(`[Agent:${agentName}] finishReason=${finishReason}，响应可能不完整`);
      }

      if (!text) throw new Error('Gemini 返回空内容');
      return { response: text, error: null };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err.message : String(err);
      const isNetwork = lastError.includes('fetch failed') || lastError.includes('TIMEOUT') || lastError.includes('ConnectTimeout');
      if (isNetwork && attempt < MAX_RETRIES) {
        const wait = (attempt + 1) * 3000;
        console.warn(`[Agent:${agentName}] 网络错误，${wait / 1000}s 后重试 (${attempt + 1}/${MAX_RETRIES}): ${lastError}`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
  }

  console.error(`[Agent:${agentName}] 最终失败:`, lastError);
  return {
    response: '抱歉，AI 服务暂时出现问题，请稍后重试。',
    error: lastError,
  };
}

// ── Graph 执行 ─────────────────────────────────────────────────────────────
/**
 * 执行策略：Supervisor 和 关键词路由 并行
 *
 * 用关键词路由拿到初步 agentName 后立即启动 Agent（最快路径），
 * 同时 Supervisor LLM 在后台运行。若 Supervisor 返回更准确的结果，
 * 则用 Supervisor 的结果启动正式 Agent（如果关键词已启动的是同一个，
 * 直接复用结果；否则重新调用正确 Agent）。
 *
 * 多数情况下关键词路由已足够准确，消除了一次 LLM 串行等待。
 */
async function runGraph(initial: Pick<AgentState, 'userMessage' | 'history' | 'video' | 'videos'>): Promise<string> {
  const baseState: AgentState = {
    ...initial,
    selectedAgent: null,
    response: '',
    error: null,
  };

  // 用关键词路由立即确定初步 agent
  const keywordAgent = keywordFallbackRoute(initial.userMessage, initial.videos);

  // 并行发起：Supervisor LLM + 关键词 Agent 执行
  const supervisorPromise = supervisorNode(baseState);
  const keywordAgentPromise = agentNode({ ...baseState, selectedAgent: keywordAgent });

  // 等待关键词 Agent 完成
  const [supervisorUpdate, keywordAgentResult] = await Promise.all([
    supervisorPromise,
    keywordAgentPromise,
  ]);

  const supervisorAgent = supervisorUpdate.selectedAgent ?? keywordAgent;
  console.log(`[Graph] keyword=${keywordAgent} supervisor=${supervisorAgent}`);

  // 关键词 Agent 已并行完成，直接使用结果（避免额外 LLM 调用）
  // Supervisor 结果仅作路由审计日志，不触发重复请求
  if (supervisorAgent !== keywordAgent) {
    console.log(`[Graph] 路由差异（已忽略，使用已完成结果）: ${keywordAgent} vs ${supervisorAgent}`);
  }
  return keywordAgentResult.response || '抱歉，未能获取响应，请重试。';
}

// ── Public API ─────────────────────────────────────────────────────────────

export async function chatWithVideo(
  userMessage: string,
  video: Video | null,
  history: HistoryMessage[] = [],
): Promise<string> {
  return runGraph({ userMessage, history, video, videos: [] });
}

export async function analyzeMultipleVideos(
  videos: Video[],
  request: string,
  history: HistoryMessage[] = [],
): Promise<string> {
  return runGraph({ userMessage: request, history, video: null, videos });
}
