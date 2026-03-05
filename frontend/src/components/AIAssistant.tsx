import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Bot, User, Loader2, LayoutGrid, Copy, Check, Youtube, Download, AlertCircle } from 'lucide-react';
import { Video, ChatMessage } from '../types';
import { aiApi, ChatHistoryMessage, youtubeApi } from '../api/client';
import MultiVideoModal from './MultiVideoModal';
import { v4 as uuidv4 } from '../utils/uuid';

const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;

function extractYouTubeUrl(text: string): string | null {
  const m = text.match(YT_REGEX);
  return m ? m[0] : null;
}

// YouTube 进度阶段显示文案
const YT_STAGE_LABELS: Record<string, string> = {
  fetching: '📡 获取视频信息...',
  downloading: '⬇️ 下载中...',
  analyzing: '🧠 AI 分析视频内容...',
  highlights: '✨ 提取创作亮点...',
  done: '✅ 分析完成',
  error: '❌ 导入失败',
};

interface Props {
  selectedVideo: Video | null;
  videos: Video[];
}

const QUICK_PROMPTS = [
  { label: '✏️ 写标题', prompt: '帮我为这个视频写一个吸引眼球的标题' },
  { label: '📄 写文案', prompt: '帮我生成这个视频的发布文案' },
  { label: '✂️ 剪辑思路', prompt: '请给我提供这个视频的剪辑思路和建议' },
  { label: '🏷️ 推荐标签', prompt: '帮我推荐这个视频的话题标签' },
  { label: '⚡ 精彩片段', prompt: '这个视频哪个片段最精彩？' },
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: `👋 你好！我是 **VAgent AI 创作助手**，由多个专职 Agent 协同工作。

你可以直接和我对话，或选择左侧视频让我基于分析结果提供帮助：
• 📌 写标题 · 写文案 · 推荐话题标签
• 🎬 专业剪辑建议与节奏分析
• 📊 多视频系列规划与运营策略
• 💬 随时聊天，什么都可以问我！`,
  timestamp: new Date(),
};

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let key = 0;

    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
        parts.push(<strong key={key++} className="font-bold text-gray-900">{boldMatch[1]}</strong>);
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      } else {
        parts.push(<span key={key++}>{remaining}</span>);
        break;
      }
    }

    if (line.startsWith('> ')) {
      return (
        <div key={i} className="border-l-2 border-violet-400 pl-3 text-violet-700 bg-violet-50 rounded-r-lg py-1 my-1">
          {parts.slice(1)}
        </div>
      );
    }
    if (line.startsWith('---')) return <hr key={i} className="border-gray-200 my-2" />;
    return <div key={i} className={line === '' ? 'h-2' : ''}>{parts}</div>;
  });
}

interface YouTubeImportState {
  videoId: string;
  url: string;
  title: string;
  stage: string;
  detail: string;
  done: boolean;
  error: boolean;
}

export default function AIAssistant({ selectedVideo, videos, onVideoImported }: Props & { onVideoImported?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [ytImports, setYtImports] = useState<Map<string, YouTubeImportState>>(new Map());
  const [pendingYtUrl, setPendingYtUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── YouTube 导入 ──────────────────────────────────────────────────────
  const startYouTubeImport = useCallback(async (url: string, title = '') => {
    const importId = uuidv4();
    const newState: YouTubeImportState = {
      videoId: importId, url, title: title || url,
      stage: 'fetching', detail: '准备中...', done: false, error: false,
    };

    setYtImports(prev => new Map(prev).set(importId, newState));

    try {
      // 先预获取标题
      try {
        const infoRes = await youtubeApi.getInfo(url);
        const infoTitle = infoRes.data.info?.title || url;
        setYtImports(prev => {
          const next = new Map(prev);
          const s = next.get(importId);
          if (s) next.set(importId, { ...s, title: infoTitle });
          return next;
        });
      } catch { /* ignore, title will be URL */ }

      // 触发导入
      const res = await youtubeApi.importVideo(url);
      const { videoId } = res.data;

      // 更新 state 中的 videoId
      setYtImports(prev => {
        const next = new Map(prev);
        const s = next.get(importId);
        if (s) {
          next.delete(importId);
          next.set(videoId, { ...s, videoId });
        }
        return next;
      });

      // 订阅 SSE 进度
      const unsub = youtubeApi.subscribeProgress(videoId, (stage, detail) => {
        setYtImports(prev => {
          const next = new Map(prev);
          const s = next.get(videoId);
          if (s) {
            next.set(videoId, {
              ...s, stage, detail,
              done: stage === 'done',
              error: stage === 'error',
            });
          }
          return next;
        });

        if (stage === 'done') {
          unsub();
          onVideoImported?.();  // 通知父组件刷新视频列表
          // 在聊天中添加完成消息
          setMessages(prev => [...prev, {
            id: uuidv4(), role: 'assistant',
            content: `✅ YouTube 视频已成功导入并分析完成！\n\n视频已添加到左侧视频库中，选中后可查看 Gemini 分析结果和创作亮点建议。`,
            timestamp: new Date(),
          }]);
        }
        if (stage === 'error') unsub();
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setYtImports(prev => {
        const next = new Map(prev);
        const s = next.get(importId);
        if (s) next.set(importId, { ...s, stage: 'error', detail: msg, error: true });
        return next;
      });
    }
  }, [onVideoImported]);

  const sendMessage = async (text: string) => {
    const content = text.trim();
    if (!content || loading) return;

    // 检测 YouTube URL
    const ytUrl = extractYouTubeUrl(content);
    if (ytUrl) {
      setPendingYtUrl(ytUrl);
      // 同时将用户消息加入聊天
      setMessages(prev => [...prev, { id: uuidv4(), role: 'user', content, timestamp: new Date() }]);
      setInput('');
      return;
    }

    const userMsg: ChatMessage = { id: uuidv4(), role: 'user', content, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history: ChatHistoryMessage[] = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }));

      const res = await aiApi.chat(content, selectedVideo?.id, history);
      const assistantMsg: ChatMessage = {
        id: uuidv4(), role: 'assistant',
        content: res.data.response,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: uuidv4(), role: 'assistant',
        content: '抱歉，服务暂时不可用，请稍后再试。',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // 获取当前对话历史（供 MultiVideoModal 使用）
  const getCurrentHistory = (): ChatHistoryMessage[] =>
    messages
      .filter(m => m.id !== 'welcome')
      .map(m => ({ role: m.role, content: m.content }));

  const handleMultiResult = (response: string) => {
    setMessages(prev => [...prev, { id: uuidv4(), role: 'assistant', content: response, timestamp: new Date() }]);
  };

  const formatTime = (d: Date) => d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm">
            <Bot className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-gray-800">AI 创作助手</span>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-white transition-all font-medium"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          多视频分析
        </button>
      </div>

      {/* Current video indicator */}
      {selectedVideo && (
        <div className={`flex-shrink-0 mx-3 mt-2.5 px-3 py-2 rounded-xl border flex items-center gap-2 ${
          selectedVideo.status === 'analyzed'
            ? 'bg-emerald-50 border-emerald-100'
            : selectedVideo.status === 'analyzing'
            ? 'bg-violet-50 border-violet-100'
            : 'bg-gray-50 border-gray-100'
        }`}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: selectedVideo.thumbnailColor }} />
          <span className={`text-xs font-medium truncate ${
            selectedVideo.status === 'analyzed' ? 'text-emerald-700' :
            selectedVideo.status === 'analyzing' ? 'text-violet-700' : 'text-gray-500'
          }`}>
            {selectedVideo.status === 'analyzed' && '当前视频：'}
            {selectedVideo.status === 'analyzing' && '分析中：'}
            {selectedVideo.status === 'pending' && '待分析：'}
            {selectedVideo.name}
          </span>
          {selectedVideo.status === 'analyzing' && (
            <Loader2 className="w-3 h-3 text-violet-400 animate-spin flex-shrink-0" />
          )}
          {selectedVideo.status === 'pending' && (
            <span className="text-[10px] text-gray-400 flex-shrink-0">未分析</span>
          )}
          {selectedVideo.status === 'analyzed' && (
            <span className="text-[10px] text-emerald-500 flex-shrink-0">✓ 已分析</span>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            {/* Avatar */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              msg.role === 'assistant'
                ? 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-sm'
                : 'bg-gray-200'
            }`}>
              {msg.role === 'assistant'
                ? <Sparkles className="w-3.5 h-3.5 text-white" />
                : <User className="w-3.5 h-3.5 text-gray-500" />}
            </div>

            {/* Bubble */}
            <div className={`group relative max-w-[85%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white rounded-tr-sm'
                  : 'bg-gray-50 border border-gray-100 text-gray-700 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant'
                  ? <div className="ai-message-content">{renderMarkdown(msg.content)}</div>
                  : <span>{msg.content}</span>}
              </div>
              <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && (
                  <button
                    onClick={() => handleCopy(msg.id, msg.content)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
                  >
                    {copiedId === msg.id
                      ? <Check className="w-3 h-3 text-emerald-500" />
                      : <Copy className="w-3 h-3" />}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100">
              <div className="flex items-center gap-1.5">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* YouTube 进度卡片 */}
        {Array.from(ytImports.values()).map(yt => (
          <div key={yt.videoId} className={`mx-1 p-3 rounded-xl border text-xs ${
            yt.error ? 'bg-red-50 border-red-100' :
            yt.done  ? 'bg-emerald-50 border-emerald-100' :
                       'bg-rose-50 border-rose-100'
          }`}>
            <div className="flex items-center gap-2 mb-1.5">
              <Youtube className={`w-3.5 h-3.5 flex-shrink-0 ${yt.error ? 'text-red-500' : yt.done ? 'text-emerald-500' : 'text-red-500'}`} />
              <span className="font-medium text-gray-700 truncate flex-1">{yt.title}</span>
              {!yt.done && !yt.error && <Loader2 className="w-3 h-3 text-rose-400 animate-spin flex-shrink-0" />}
              {yt.error && <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
            </div>
            <div className={`text-[11px] ${yt.error ? 'text-red-600' : yt.done ? 'text-emerald-600' : 'text-rose-600'}`}>
              {YT_STAGE_LABELS[yt.stage] ?? yt.stage}{yt.detail && !yt.done ? ` — ${yt.detail}` : ''}
            </div>
          </div>
        ))}

        {/* YouTube 导入确认弹窗 */}
        {pendingYtUrl && (
          <div className="mx-1 p-3 rounded-xl border bg-rose-50 border-rose-100">
            <div className="flex items-center gap-2 mb-2">
              <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-800">检测到 YouTube 链接</span>
            </div>
            <p className="text-[11px] text-gray-500 mb-3 break-all">{pendingYtUrl}</p>
            <p className="text-[11px] text-gray-600 mb-3">
              是否下载该视频并进行 AI 分析？分析完成后视频将自动添加到左侧视频库，并生成创作亮点报告。
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  startYouTubeImport(pendingYtUrl);
                  setPendingYtUrl(null);
                  setMessages(prev => [...prev, {
                    id: uuidv4(), role: 'assistant',
                    content: `好的，我来帮你分析这个 YouTube 视频！\n\n正在下载并分析视频内容，完成后会为你提取：\n• 🎣 钩子设计与开场策略\n• 📐 内容结构与节奏分析\n• 🔥 爆款核心要素\n• 🇨🇳 中文平台适配建议\n• ✂️ 可复制的创作技巧`,
                    timestamp: new Date(),
                  }]);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
              >
                <Download className="w-3 h-3" />
                导入并分析
              </button>
              <button
                onClick={() => setPendingYtUrl(null)}
                className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick prompts */}
      <div className="flex-shrink-0 px-3 py-2 flex gap-1.5 overflow-x-auto border-t border-gray-100 bg-gray-50" style={{ scrollbarWidth: 'none' }}>
        {QUICK_PROMPTS.map(({ label, prompt }) => (
          <button
            key={label}
            onClick={() => sendMessage(prompt)}
            disabled={loading}
            className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 text-xs text-gray-500 hover:text-violet-600 hover:border-violet-200 hover:bg-violet-50 disabled:opacity-40 transition-all font-medium"
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 pt-2 bg-white border-t border-gray-100">
        <div className="flex items-end gap-2 p-2.5 rounded-xl bg-gray-50 border border-gray-200 focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-50 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedVideo ? `询问关于「${selectedVideo.name}」的问题，或随意聊聊...` : '随时向 AI 助手提问...'}
            rows={1}
            className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none resize-none max-h-24 leading-relaxed py-0.5"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-gray-900 hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-all"
          >
            {loading
              ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
              : <Send className="w-3.5 h-3.5 text-white" />}
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1.5 text-center font-medium">Enter 发送 · Shift+Enter 换行</p>
      </div>

      {showModal && (
        <MultiVideoModal
          videos={videos}
          onClose={() => setShowModal(false)}
          onResult={handleMultiResult}
          history={getCurrentHistory()}
        />
      )}
    </div>
  );
}
