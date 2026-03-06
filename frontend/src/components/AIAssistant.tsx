import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Sparkles, Bot, User, Loader2, LayoutGrid, Copy, Check, Youtube, Download, MoreHorizontal, Trash2, MessageSquare, Cpu, X, ChevronRight } from 'lucide-react';
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
  { label: '📜 提取脚本', prompt: '请根据这个视频的内容帮我提取或整理成文字脚本（旁白/解说稿）' },
  { label: '✏️ 写标题', prompt: '帮我为这个视频写一个吸引眼球的标题' },
  { label: '📄 写文案', prompt: '帮我生成这个视频的发布文案' },
  { label: '✂️ 剪辑思路', prompt: '请给我提供这个视频的剪辑思路和建议' },
  { label: '🏷️ 推荐标签', prompt: '帮我推荐这个视频的话题标签' },
  { label: '⚡ 精彩片段', prompt: '这个视频哪个片段最精彩？' },
];

const CHAT_STORAGE_KEY = 'vagent_chat_messages';
const SETTINGS_STORAGE_KEY = 'vagent_chat_settings';

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

interface ChatSettings {
  replyStyle: 'professional' | 'casual';
  autoContext: boolean;
}

const DEFAULT_SETTINGS: ChatSettings = {
  replyStyle: 'professional',
  autoContext: true,
};

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as Array<Omit<ChatMessage, 'timestamp'> & { timestamp: string }>;
    return parsed.map(m => ({ ...m, timestamp: new Date(m.timestamp), isStreaming: false }));
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function saveMessages(messages: ChatMessage[]) {
  try {
    // 不保存进行中的进度消息
    const toSave = messages.map(m => ({ ...m, isStreaming: false }));
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore quota errors */ }
}

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: ChatSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

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

export default function AIAssistant({ selectedVideo, videos, onVideoImported }: Props & { onVideoImported?: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingYtUrl, setPendingYtUrl] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [clearConfirm, setClearConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 持久化聊天记录
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  // 点击外部关闭设置面板
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e: MouseEvent) => {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(e.target as Node)) {
        setShowSettings(false);
        setClearConfirm(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  const updateSettings = (patch: Partial<ChatSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const handleClearChat = () => {
    if (!clearConfirm) { setClearConfirm(true); return; }
    setMessages([WELCOME_MESSAGE]);
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setShowSettings(false);
    setClearConfirm(false);
  };

  // ── YouTube 导入（进度作为 bot 消息内联在对话流中）────────────────────
  const startYouTubeImport = useCallback(async (url: string, title = '') => {
    const progressMsgId = uuidv4();
    let videoTitle = title || url;

    const makeContent = (stage: string, detail: string, isDone: boolean, isError: boolean) => {
      if (isError) return `❌ **YouTube 视频导入失败**\n\n${detail}`;
      if (isDone) return `✅ **「${videoTitle}」导入完成！**\n\n视频已添加到左侧视频库，点击后可查看 AI 分析结果和创作建议。`;
      const label = YT_STAGE_LABELS[stage] ?? stage;
      return `${label}${detail ? ` — ${detail}` : ''}`;
    };

    // 立即在对话流中插入进度消息（messageType: 'progress' 使用独立 logo）
    setMessages(prev => [...prev, {
      id: progressMsgId, role: 'assistant',
      content: makeContent('fetching', '准备中...', false, false),
      timestamp: new Date(),
      isStreaming: true,
      messageType: 'progress',
    }]);

    try {
      // 预获取标题
      try {
        const infoRes = await youtubeApi.getInfo(url);
        videoTitle = infoRes.data.info?.title || videoTitle;
        setMessages(prev => prev.map(m =>
          m.id === progressMsgId
            ? { ...m, content: makeContent('fetching', '正在获取视频信息...', false, false), messageType: 'progress' as const }
            : m
        ));
      } catch { /* ignore */ }

      // 触发导入
      const res = await youtubeApi.importVideo(url);
      const { videoId } = res.data;

      // 订阅 SSE 进度，实时更新对话消息
      const unsub = youtubeApi.subscribeProgress(videoId, (stage, detail) => {
        const isDone = stage === 'done';
        const isError = stage === 'error';
        setMessages(prev => prev.map(m =>
          m.id === progressMsgId
            ? { ...m, content: makeContent(stage, detail, isDone, isError), isStreaming: !isDone && !isError, messageType: 'progress' as const }
            : m
        ));
        if (isDone) {
          unsub();
          onVideoImported?.();
        }
        if (isError) unsub();
      });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => prev.map(m =>
        m.id === progressMsgId
          ? { ...m, content: makeContent('error', msg, false, true), isStreaming: false, messageType: 'progress' as const }
          : m
      ));
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

      const stylePrefix = settings.replyStyle === 'casual' ? '[请用轻松友好的口吻回复] ' : '';
      const finalContent = stylePrefix ? stylePrefix + content : content;
      const videoId = settings.autoContext ? selectedVideo?.id : undefined;
      const res = await aiApi.chat(finalContent, videoId, history);
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
          {messages.filter(m => m.id !== 'welcome').length > 0 && (
            <span className="text-[10px] text-gray-400 font-medium">
              {messages.filter(m => m.id !== 'welcome').length} 条记录
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-500 hover:text-gray-800 hover:border-gray-300 hover:bg-white transition-all font-medium"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            多视频分析
          </button>
          {/* 设置入口 */}
          <div className="relative" ref={settingsPanelRef}>
            <button
              onClick={() => { setShowSettings(v => !v); setClearConfirm(false); }}
              className={`p-1.5 rounded-lg border transition-all ${
                showSettings
                  ? 'bg-violet-50 border-violet-200 text-violet-600'
                  : 'bg-gray-50 border-gray-200 text-gray-400 hover:text-gray-700 hover:bg-white hover:border-gray-300'
              }`}
              title="AI 助手设置"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {/* 设置面板 */}
            {showSettings && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {/* 面板标题 */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                  <span className="text-xs font-bold text-gray-700">AI 助手设置</span>
                  <button
                    onClick={() => { setShowSettings(false); setClearConfirm(false); }}
                    className="p-0.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  {/* 当前模型 */}
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-violet-50 border border-violet-100">
                    <Cpu className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[10px] text-violet-400 font-medium">当前模型</div>
                      <div className="text-xs font-semibold text-violet-700 truncate">Gemini 2.5 Flash</div>
                    </div>
                  </div>

                  {/* 回复风格 */}
                  <div>
                    <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5 px-0.5">
                      回复风格
                    </div>
                    <div className="flex rounded-lg overflow-hidden border border-gray-200">
                      {(['professional', 'casual'] as const).map((style, idx) => (
                        <button
                          key={style}
                          onClick={() => updateSettings({ replyStyle: style })}
                          className={`flex-1 py-1.5 text-xs font-medium transition-all ${
                            idx === 0 ? '' : 'border-l border-gray-200'
                          } ${
                            settings.replyStyle === style
                              ? 'bg-violet-600 text-white'
                              : 'bg-white text-gray-500 hover:bg-gray-50'
                          }`}
                        >
                          {style === 'professional' ? '📋 专业严谨' : '😊 轻松友好'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 自动附带视频上下文 */}
                  <div className="flex items-center justify-between px-1">
                    <div>
                      <div className="text-xs font-medium text-gray-700">自动附带视频上下文</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">对话时自动关联当前选中的视频</div>
                    </div>
                    <button
                      onClick={() => updateSettings({ autoContext: !settings.autoContext })}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                        settings.autoContext ? 'bg-violet-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                        settings.autoContext ? 'translate-x-4' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>

                  {/* 对话统计 */}
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
                    <MessageSquare className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="text-xs text-gray-500">
                      已有 <span className="font-semibold text-gray-700">{messages.filter(m => m.id !== 'welcome').length}</span> 条对话记录（全局保存）
                    </div>
                  </div>

                  {/* 清除对话记录 */}
                  <div className="border-t border-gray-100 pt-2">
                    <button
                      onClick={handleClearChat}
                      className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        clearConfirm
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'text-red-500 border border-red-200 hover:bg-red-50'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {clearConfirm ? '确认清除全部对话？' : '清除所有对话记录'}
                    </button>
                    {clearConfirm && (
                      <button
                        onClick={() => setClearConfirm(false)}
                        className="w-full mt-1.5 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-all flex items-center justify-center gap-1"
                      >
                        <ChevronRight className="w-3 h-3 rotate-180" />
                        取消
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
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
            {/* Avatar：用户 / AI 助手 / 进度任务 区分 */}
            <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              msg.role === 'user'
                ? 'bg-gray-200'
                : msg.messageType === 'progress'
                ? 'bg-red-500 shadow-sm'
                : 'bg-gradient-to-br from-violet-600 to-purple-700 shadow-sm'
            }`}>
              {msg.role === 'user'
                ? <User className="w-3.5 h-3.5 text-gray-500" />
                : msg.messageType === 'progress'
                ? <Youtube className="w-3.5 h-3.5 text-white" />
                : <Sparkles className="w-3.5 h-3.5 text-white" />}
            </div>

            {/* Bubble */}
            <div className={`group relative max-w-[85%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gray-900 text-white rounded-tr-sm'
                  : msg.messageType === 'progress'
                  ? msg.isStreaming
                    ? 'bg-red-50 border border-red-100 text-red-800 rounded-tl-sm'
                    : 'bg-red-50/70 border border-red-100 text-gray-700 rounded-tl-sm'
                  : msg.isStreaming
                  ? 'bg-violet-50 border border-violet-100 text-violet-700 rounded-tl-sm'
                  : 'bg-gray-50 border border-gray-100 text-gray-700 rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="ai-message-content">
                    {msg.isStreaming && (
                      <div className="flex items-center gap-2 mb-1">
                        <Loader2 className={`w-3 h-3 animate-spin flex-shrink-0 ${msg.messageType === 'progress' ? 'text-red-400' : 'text-violet-400'}`} />
                        <span className={`text-[11px] font-medium ${msg.messageType === 'progress' ? 'text-red-500' : 'text-violet-400'}`}>进行中...</span>
                      </div>
                    )}
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <span>{msg.content}</span>
                )}
              </div>
              <div className={`flex items-center gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-[10px] text-gray-400">{formatTime(msg.timestamp)}</span>
                {msg.role === 'assistant' && !msg.isStreaming && (
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

        {/* YouTube 导入确认卡 */}
        {pendingYtUrl && (
          <div className="flex gap-2.5">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 flex items-center justify-center">
              <Youtube className="w-3.5 h-3.5 text-red-500" />
            </div>
            <div className="flex-1 max-w-[85%]">
              <div className="px-3.5 py-3 rounded-2xl rounded-tl-sm bg-gray-50 border border-gray-100 text-[13px]">
                <p className="font-semibold text-gray-800 mb-1">检测到 YouTube 链接</p>
                <p className="text-[11px] text-gray-400 mb-2.5 break-all">{pendingYtUrl}</p>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  是否下载该视频并进行 AI 分析？完成后将自动添加到视频库并生成创作报告。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { startYouTubeImport(pendingYtUrl); setPendingYtUrl(null); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
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
