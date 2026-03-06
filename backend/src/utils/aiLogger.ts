/**
 * AI 对话/分析请求统一日志，便于跟踪效果并做 evaluation。
 * 格式：JSONL（每行一个 JSON），空字段不输出，便于导入评估平台。
 * 日志文件：backend/logs/ai-requests.log
 */

import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'ai-requests.log');
const TRUNCATE = 500; // 用于 evaluation 的 message/response 最大长度

function ensureDir() {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

function cleanPayload(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string' && v.length > 0) out[k] = v.replace(/\n/g, ' ').slice(0, 1000);
    else out[k] = v;
  }
  return out;
}

function write(type: string, payload: Record<string, unknown>) {
  try {
    ensureDir();
    const line = JSON.stringify({ ts: new Date().toISOString(), type, ...cleanPayload(payload) }) + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf-8');
  } catch (err) {
    console.warn('[AI Logger] 写入失败:', err);
  }
}

/** 创作助手单轮对话（含 message/response 便于 evaluation） */
export function logChat(params: {
  userId: string;
  videoId?: string | null;
  message: string;
  messageLen: number;
  historyLen: number;
  success: boolean;
  response?: string;
  responseLen?: number;
  error?: string;
}) {
  const payload: Record<string, unknown> = {
    userId: params.userId,
    messageLen: params.messageLen,
    historyLen: params.historyLen,
    success: params.success,
  };
  if (params.videoId) payload.videoId = params.videoId;
  if (params.message) payload.message = params.message.slice(0, TRUNCATE);
  if (params.success && params.response !== undefined) payload.response = (params.response ?? '').slice(0, TRUNCATE);
  if (params.responseLen !== undefined && params.responseLen > 0) payload.responseLen = params.responseLen;
  if (params.error) payload.error = params.error.slice(0, 300);
  write('CHAT', payload);
}

/** 多视频分析 */
export function logMultiAnalysis(params: {
  userId: string;
  videoCount: number;
  videoIds: string;
  request: string;
  requestLen: number;
  success: boolean;
  response?: string;
  responseLen?: number;
  error?: string;
}) {
  const payload: Record<string, unknown> = {
    userId: params.userId,
    videoCount: params.videoCount,
    videoIds: params.videoIds.slice(0, 200),
    requestLen: params.requestLen,
    success: params.success,
  };
  if (params.request) payload.request = params.request.slice(0, TRUNCATE);
  if (params.success && params.response !== undefined) payload.response = (params.response ?? '').slice(0, TRUNCATE);
  if (params.responseLen !== undefined && params.responseLen > 0) payload.responseLen = params.responseLen;
  if (params.error) payload.error = params.error.slice(0, 300);
  write('MULTI_ANALYSIS', payload);
}

/** 单视频 Gemini 分析（上传后触发的分析） */
export function logVideoAnalysis(params: {
  videoId: string;
  name: string;
  hasRealFile: boolean;
  success: boolean;
  duration?: number;
  segmentsCount?: number;
  error?: string;
}) {
  const payload: Record<string, unknown> = {
    videoId: params.videoId,
    name: (params.name || '').slice(0, 80),
    hasRealFile: params.hasRealFile,
    success: params.success,
  };
  if (params.duration !== undefined && params.duration > 0) payload.duration = params.duration;
  if (params.segmentsCount !== undefined) payload.segmentsCount = params.segmentsCount;
  if (params.error) payload.error = params.error.slice(0, 300);
  write('VIDEO_ANALYSIS', payload);
}

/** YouTube 导入时的 Gemini 内容分析 */
export function logYoutubeAnalysis(params: {
  videoId: string;
  title: string;
  success: boolean;
  duration?: number;
  segmentsCount?: number;
  error?: string;
}) {
  const payload: Record<string, unknown> = {
    videoId: params.videoId,
    title: (params.title || '').slice(0, 80),
    success: params.success,
  };
  if (params.duration !== undefined && params.duration > 0) payload.duration = params.duration;
  if (params.segmentsCount !== undefined) payload.segmentsCount = params.segmentsCount;
  if (params.error) payload.error = params.error.slice(0, 300);
  write('YOUTUBE_ANALYSIS', payload);
}
