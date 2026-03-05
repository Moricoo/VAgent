/**
 * YouTube 视频导入服务
 *
 * 流程：
 *   1. 解析 YouTube URL → 获取视频元数据（标题、时长、频道等）
 *   2. yt-dlp 下载视频到 uploads 目录
 *   3. 复用 Gemini 视频分析管道
 *   4. 生成「创作亮点」分析（专门针对 YouTube 内容的 prompt）
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_API_KEY } from './gemini';
import { analyzeVideoWithGemini } from './gemini';

const execFileAsync = promisify(execFile);

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
const YT_DLP_BIN = process.env.YT_DLP_PATH || 'yt-dlp';  // 优先环境变量，否则 PATH 中查找

const geminiClient = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: { timeout: 60000 },
});

// ── 进度回调类型 ──────────────────────────────────────────────────────────
export type ProgressCallback = (stage: string, detail: string) => void;

// ── YouTube URL 检测 ──────────────────────────────────────────────────────
const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractYouTubeId(url: string): string | null {
  const m = url.match(YT_REGEX);
  return m ? m[1] : null;
}

export function isYouTubeUrl(text: string): string | null {
  const match = text.match(new RegExp(YT_REGEX.source, 'i'));
  return match ? match[0] : null;
}

// ── 视频元数据 ─────────────────────────────────────────────────────────────
export interface YouTubeVideoInfo {
  id: string;
  title: string;
  channel: string;
  duration: number;        // 秒
  viewCount: number;
  likeCount: number;
  description: string;
  tags: string[];
  thumbnailUrl: string;
  uploadDate: string;      // YYYYMMDD
  language: string;
}

export async function getYouTubeInfo(url: string): Promise<YouTubeVideoInfo> {
  const args = [
    '--dump-json',
    '--no-playlist',
    '--no-warnings',
    url,
  ];

  const { stdout } = await execFileAsync(YT_DLP_BIN, args, { timeout: 30000 });
  const info = JSON.parse(stdout.trim());

  return {
    id: info.id,
    title: info.title || '未知标题',
    channel: info.uploader || info.channel || '未知频道',
    duration: Math.round(info.duration || 0),
    viewCount: info.view_count || 0,
    likeCount: info.like_count || 0,
    description: (info.description || '').slice(0, 500),
    tags: (info.tags || []).slice(0, 20),
    thumbnailUrl: info.thumbnail || '',
    uploadDate: info.upload_date || '',
    language: info.language || 'und',
  };
}

// ── 视频下载 ───────────────────────────────────────────────────────────────
export async function downloadYouTubeVideo(
  url: string,
  videoId: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const outputPath = path.join(UPLOADS_DIR, `${videoId}.mp4`);

  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  onProgress?.('downloading', '正在连接 YouTube...');

  const args = [
    '--format', 'bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4]/best',
    '--merge-output-format', 'mp4',
    '--output', outputPath,
    '--no-playlist',
    '--no-warnings',
    '--progress',
    '--newline',
    url,
  ];

  return new Promise((resolve, reject) => {
    const proc = (execFile as typeof execFile)(YT_DLP_BIN, args, { timeout: 300000 });

    let lastProgress = '';
    proc.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.includes('[download]') && line.includes('%')) {
        const match = line.match(/(\d+\.?\d*)%/);
        if (match && match[1] !== lastProgress) {
          lastProgress = match[1];
          const pct = Math.round(parseFloat(match[1]));
          onProgress?.('downloading', `下载中... ${pct}%`);
        }
      }
    });

    proc.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve(outputPath);
      } else {
        reject(new Error(`yt-dlp 退出码 ${code}`));
      }
    });

    proc.on('error', reject);
  });
}

// ── YouTube 专用创作亮点分析 Prompt ───────────────────────────────────────
function buildYouTubeAnalysisPrompt(info: YouTubeVideoInfo): string {
  const viewK = info.viewCount > 1000
    ? `${(info.viewCount / 1000).toFixed(1)}K`
    : String(info.viewCount);

  return `你是一位资深的社交媒体内容策略专家，专注于分析 YouTube 爆款视频并为中文创作者提供可落地的借鉴建议。

## 待分析的 YouTube 视频信息
- 标题：${info.title}
- 频道：${info.channel}
- 播放量：${viewK} 次 | 时长：${Math.floor(info.duration / 60)}分${info.duration % 60}秒
- 原始标签：${info.tags.slice(0, 10).join(', ') || '无'}
- 简介摘要：${info.description.slice(0, 200)}

## 分析任务

请基于视频实际内容，从以下维度输出创作亮点分析报告：

### 1. 钩子设计
开场如何抓住注意力？（前5秒做了什么）

### 2. 内容结构
视频的叙事逻辑和节奏设计（起承转合、段落划分）

### 3. 爆款要素
触发高播放/高互动的核心因素（情绪点、信息密度、视觉冲击等）

### 4. 中文平台适配建议
同类内容在抖音/小红书/B站的本土化改编策略

### 5. 可复制的创作技巧
提炼3-5个具体的、可直接应用的拍摄/剪辑/文案技巧

### 6. 内容复刻方向
建议的选题方向和差异化切入角度

请用中文输出，语言简洁有力，重点加粗，格式清晰。`;
}

// ── 创作亮点分析（基于元数据 + 视频内容）────────────────────────────────
export async function analyzeYouTubeHighlights(
  info: YouTubeVideoInfo,
  filePath: string,
  onProgress?: ProgressCallback,
): Promise<string> {
  const prompt = buildYouTubeAnalysisPrompt(info);

  onProgress?.('analyzing', '正在深度分析视频创作亮点...');

  // 上传视频到 Gemini Files API
  const mimeType = 'video/mp4';
  onProgress?.('analyzing', '上传视频到 AI 分析引擎...');

  const uploadedFile = await geminiClient.files.upload({
    file: filePath,
    config: { mimeType, displayName: `yt-${info.id}` },
  });

  const fileUri = uploadedFile.uri ?? '';
  const fileName = uploadedFile.name ?? '';

  // 等待文件就绪
  let fileInfo = uploadedFile;
  let attempts = 0;
  while (fileInfo.state === 'PROCESSING' && attempts < 30) {
    await new Promise(r => setTimeout(r, 5000));
    attempts++;
    try {
      fileInfo = await geminiClient.files.get({ name: fileName } as Parameters<typeof geminiClient.files.get>[0]);
    } catch {
      break;
    }
  }

  // 调用 Gemini 分析
  const result = await geminiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{
      role: 'user',
      parts: [
        { fileData: { fileUri, mimeType } },
        { text: prompt },
      ],
    }],
    config: { temperature: 0.7 },
  });

  // 清理上传的文件
  try {
    await geminiClient.files.delete({ name: fileName } as Parameters<typeof geminiClient.files.delete>[0]);
  } catch { /* ignore cleanup errors */ }

  return result.candidates?.[0]?.content?.parts?.[0]?.text ?? '分析失败，请重试。';
}

// ── 检查 yt-dlp 是否可用 ───────────────────────────────────────────────────
export async function checkYtDlp(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const { stdout } = await execFileAsync(YT_DLP_BIN, ['--version'], { timeout: 5000 });
    return { ok: true, version: stdout.trim() };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
