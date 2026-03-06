import { GoogleGenAI, FileState } from '@google/genai';
import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffprobeStatic from 'ffprobe-static';
import { VideoAnalysis, VideoSegment } from '../types';

export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

if (!GEMINI_API_KEY) {
  console.error('❌ 错误：未设置 GEMINI_API_KEY 环境变量，请在 backend/.env 文件中配置');
}

ffmpeg.setFfprobePath(ffprobeStatic.path);

const client = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { timeout: 120000 },  // 120s，视频分析耗时较长
});

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.m4v': 'video/x-m4v',
  };
  return map[ext] || 'video/mp4';
}

/** Get video duration in seconds using ffprobe */
export function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err || !metadata?.format?.duration) {
        console.warn(`[ffprobe] 无法获取时长: ${err?.message}`);
        resolve(0);
      } else {
        resolve(Math.round(metadata.format.duration));
      }
    });
  });
}

const ANALYSIS_PROMPT = `请用中文仔细分析这段视频的完整内容，然后以严格的 JSON 格式返回分析结果。

重要要求：
- 只输出 JSON，不要有任何其他文字、注释或 markdown 代码块（不要用 \`\`\`json）
- 所有文字使用中文
- 时间精度到秒，必须准确对应视频实际内容
- segments 必须##连续覆盖##视频完整时长（片段数量在1-10个之间，结束时间不超过实际时长）

JSON 格式如下：
{
  "duration": <视频总时长（秒，整数）>,
  "category": "<从以下选择：旅行/Vlog/科技/美食/运动/音乐/教育/游戏/其他>",
  "videoLabel": "<视频核心主题标签，2-4个汉字，高度概括视频最主要的内容，例如：咖啡创意/徒步探险/美食烹饪/科技评测/城市夜游/日常Vlog/音乐演奏/游戏实战，必须简洁贴切>",
  "tags": ["<内容关键词1，2-4字>", "<内容关键词2，2-4字>", "<内容关键词3，2-4字>", "<内容关键词4，2-4字>", "<内容关键词5，2-4字>"],
  "segments": [
    {
      "label": "<片段名称，4字以内>",
      "startTime": <开始时间（秒，整数）>,
      "endTime": <结束时间（秒，整数）>,
      "description": "<此片段的详细描述，说明画面内容和叙事作用，40字以内>",
      "isHighlight": <最精彩的1-2个片段为 true，其余为 false>,
      "color": "<精彩片段用 #ef4444，开场/介绍用 #3b82f6，中间过渡用 #f59e0b，结尾用 #8b5cf6>"
    }
  ],
  "summary": "<视频整体内容摘要，10-50字>",
  "highlights": "<精彩片段的具体描述，格式：MM:SS ~ MM:SS 为精彩高潮，xxx内容>",
  "suggestedTitle": "<推荐发布标题，含相关emoji，15字以内，吸引眼球>",
  "suggestedTags": ["<发布话题标签1>", "<发布话题标签2>", "<发布话题标签3>", "<发布话题标签4>", "<发布话题标签5>"],
  "editingTips": [
    "<具体剪辑建议1，包含使用的技术手法>",
    "<具体剪辑建议2，包含使用的技术手法>",
    "<具体剪辑建议3，包含使用的技术手法>"
  ],
  "mood": "<从以下选择：激昂热血/文艺浪漫/轻松愉快/专业严谨/温馨治愈/悬疑紧张>",
  "paceRating": <节奏感评分，整数1-10，1最慢10最快>
}`;

interface RawAnalysis {
  duration?: number;
  category?: string;
  videoLabel?: string;
  tags?: string[];
  segments?: Array<{
    label?: string;
    startTime?: number;
    endTime?: number;
    description?: string;
    isHighlight?: boolean;
    color?: string;
  }>;
  summary?: string;
  highlights?: string;
  suggestedTitle?: string;
  suggestedTags?: string[];
  editingTips?: string[];
  mood?: string;
  paceRating?: number;
}

export interface GeminiVideoResult {
  analysis: VideoAnalysis;
  category: string;
  tags: string[];
  videoLabel: string;
  duration: number;
}

export type ProgressCallback = (stage: string, detail?: string) => void;

export async function analyzeVideoWithGemini(
  filePath: string,
  videoName: string,
  existingDuration: number,
  onProgress?: ProgressCallback,
): Promise<GeminiVideoResult> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`视频文件不存在: ${filePath}`);
  }

  // Step 1: Get real duration via ffprobe
  const localDuration = existingDuration > 0
    ? existingDuration
    : await getVideoDuration(filePath);
  console.log(`[Gemini] 视频时长: ${localDuration}秒`);

  // Step 2: Upload to Gemini Files API
  onProgress?.('uploading', '正在上传视频到 Gemini Files API...');
  console.log(`[Gemini] 上传文件: ${filePath}`);

  const uploadedFile = await client.files.upload({
    file: filePath,
    config: {
      mimeType: getMimeType(filePath),
      displayName: videoName,
    },
  });

  const fileName = uploadedFile.name;
  if (!fileName) throw new Error('上传后未获得文件名');
  console.log(`[Gemini] 文件已上传: ${fileName}, 状态: ${uploadedFile.state}`);

  // Step 3: Poll until ACTIVE  — use { name } object format (required by SDK)
  onProgress?.('processing', 'Gemini 正在处理视频...');
  let fileInfo = uploadedFile;
  let attempts = 0;

  while (fileInfo.state !== FileState.ACTIVE) {
    if (fileInfo.state === FileState.FAILED) {
      throw new Error('Gemini 视频处理失败（FAILED 状态）');
    }
    if (attempts >= 40) {
      throw new Error('等待 Gemini 处理超时（>200秒）');
    }
    await sleep(5000);
    attempts++;
    // ✅ Correct: pass object { name } not bare string
    fileInfo = await client.files.get({ name: fileName } as Parameters<typeof client.files.get>[0]);
    console.log(`[Gemini] 状态: ${fileInfo.state} (${attempts * 5}s)`);
    onProgress?.('processing', `处理中... ${attempts * 5}s`);
  }

  const fileUri = fileInfo.uri;
  const fileMime = fileInfo.mimeType || getMimeType(filePath);
  console.log(`[Gemini] 文件就绪: ${fileUri}`);

  if (!fileUri) throw new Error('文件 URI 为空，无法分析');

  // Step 4: Generate structured analysis (with retry for 429 quota errors)
  onProgress?.('analyzing', 'Gemini AI 深度分析视频内容...');

  const MAX_RETRIES = 3;
  let retries = 0;
  let rawText = '';

  while (true) {
    try {
      const response = await client.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { fileData: { fileUri, mimeType: fileMime } },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
      });
      rawText = response.text ?? '';
      break;
    } catch (err: unknown) {
      const errStr = String(err);
      const is429 = errStr.includes('"code":429') || errStr.includes('RESOURCE_EXHAUSTED');
      if (is429 && retries < MAX_RETRIES) {
        retries++;
        // Parse retry-after from Gemini error message ("retry in XX.Xs")
        const retryMatch = errStr.match(/retry in ([\d.]+)s/i);
        const waitSecs = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 5 : 70;
        console.log(`[Gemini] 429 配额限制，${waitSecs}s 后重试 (${retries}/${MAX_RETRIES})`);
        onProgress?.('analyzing', `配额限制，${waitSecs}秒后自动重试(${retries}/${MAX_RETRIES})...`);
        await sleep(waitSecs * 1000);
        onProgress?.('analyzing', `重试第 ${retries} 次，正在分析...`);
      } else {
        throw err;
      }
    }
  }
  console.log(`[Gemini] 响应长度: ${rawText.length} 字`);
  if (rawText.length < 50) {
    console.warn('[Gemini] 响应过短:', rawText);
  }

  // Step 5: Parse JSON
  let parsed: RawAnalysis = {};
  try {
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Gemini] 原始响应:', rawText.slice(0, 1000));
      throw new Error('响应中未找到 JSON 对象');
    }
    parsed = JSON.parse(jsonMatch[0]);
    console.log(`[Gemini] 解析成功: ${parsed.segments?.length ?? 0} 个片段, 时长 ${parsed.duration}s`);
  } catch (err) {
    console.error('[Gemini] JSON 解析失败:', err);
    throw new Error(`Gemini 响应解析失败: ${err}`);
  }

  // Step 6: Build result — use ffprobe duration as ground truth
  const duration = localDuration > 0
    ? localDuration
    : (typeof parsed.duration === 'number' && parsed.duration > 0 ? parsed.duration : 60);

  const segments: VideoSegment[] = (parsed.segments || [])
    .filter(s => typeof s.startTime === 'number' && typeof s.endTime === 'number')
    .map((seg, i) => ({
      id: `seg_${i + 1}`,
      label: seg.label || `片段${i + 1}`,
      startTime: Math.max(0, Math.round(seg.startTime!)),
      endTime: Math.min(duration, Math.round(seg.endTime!)),
      description: seg.description || '',
      isHighlight: seg.isHighlight === true,
      color: seg.color || (seg.isHighlight ? '#ef4444' : '#3b82f6'),
    }))
    .filter(s => s.startTime < s.endTime);

  if (segments.length === 0) {
    segments.push({
      id: 'seg_1',
      label: '完整视频',
      startTime: 0,
      endTime: duration,
      description: parsed.summary?.slice(0, 40) || '视频内容',
      isHighlight: true,
      color: '#7c3aed',
    });
  }

  const analysis: VideoAnalysis = {
    segments,
    summary: parsed.summary || '视频分析完成',
    highlights: parsed.highlights || `00:00 ~ ${formatTime(duration)} 视频完整内容`,
    suggestedTitle: parsed.suggestedTitle || videoName,
    suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags.slice(0, 6) : [],
    editingTips: Array.isArray(parsed.editingTips) ? parsed.editingTips.slice(0, 4) : [],
    mood: parsed.mood || '轻松愉快',
    paceRating: (typeof parsed.paceRating === 'number' && parsed.paceRating >= 1 && parsed.paceRating <= 10)
      ? parsed.paceRating : 7,
  };

  // Step 7: Cleanup
  try {
    await client.files.delete({ name: fileName } as Parameters<typeof client.files.delete>[0]);
    console.log(`[Gemini] 已清理: ${fileName}`);
  } catch (e) {
    console.warn('[Gemini] 清理文件失败（非致命）:', e);
  }

  const rawLabel = parsed.videoLabel?.trim() || '';
  // Ensure label is 2-4 chars; fall back to category if invalid
  const videoLabel = (rawLabel.length >= 2 && rawLabel.length <= 6) ? rawLabel : (parsed.category || '其他');

  console.log(`[Gemini] videoLabel: "${videoLabel}"`);

  return {
    analysis,
    category: parsed.category || '其他',
    tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [],
    videoLabel,
    duration,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
