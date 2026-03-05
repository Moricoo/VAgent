import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { addVideo, getVideoById, updateVideo } from '../data/store';
import { getVideoDuration } from '../services/gemini';
import {
  isYouTubeUrl,
  extractYouTubeId,
  getYouTubeInfo,
  downloadYouTubeVideo,
  analyzeYouTubeHighlights,
  checkYtDlp,
  YouTubeVideoInfo,
} from '../services/youtube';
import { analyzeVideoWithGemini } from '../services/gemini';

const router = Router();
router.use(authMiddleware);

// 共享进度 Map（与 videos.ts 共同维护格式，供同一 SSE 端点使用）
const ytProgressMap = new Map<string, { stage: string; detail: string }>();

// ── GET /youtube/check — 检查 yt-dlp 是否可用 ─────────────────────────
router.get('/check', async (_req, res: Response) => {
  const status = await checkYtDlp();
  res.json(status);
});

// ── GET /youtube/progress/:id — SSE 进度流 ─────────────────────────────
router.get('/progress/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const existing = ytProgressMap.get(id);
  if (existing) send(existing);

  const interval = setInterval(() => {
    const p = ytProgressMap.get(id);
    if (p) {
      send(p);
      if (p.stage === 'done' || p.stage === 'error') {
        clearInterval(interval);
        res.end();
      }
    }
  }, 1000);

  req.on('close', () => clearInterval(interval));
});

// ── GET /youtube/info — 预获取 YouTube 视频信息 ─────────────────────────
router.get('/info', async (req: AuthRequest, res: Response) => {
  const { url } = req.query as { url: string };

  if (!url || !isYouTubeUrl(url)) {
    res.status(400).json({ message: '无效的 YouTube URL' });
    return;
  }

  const ytCheck = await checkYtDlp();
  if (!ytCheck.ok) {
    res.status(503).json({
      message: '需要安装 yt-dlp 才能分析 YouTube 视频，请运行：brew install yt-dlp',
    });
    return;
  }

  try {
    const info = await getYouTubeInfo(url);
    res.json({ info });
  } catch (err) {
    res.status(400).json({ message: `获取视频信息失败：${err instanceof Error ? err.message : String(err)}` });
  }
});

// ── POST /youtube/import — 导入并分析 YouTube 视频 ─────────────────────
router.post('/import', async (req: AuthRequest, res: Response) => {
  const { url } = req.body as { url: string };

  if (!url || !isYouTubeUrl(url)) {
    res.status(400).json({ message: '无效的 YouTube URL' });
    return;
  }

  const ytCheck = await checkYtDlp();
  if (!ytCheck.ok) {
    res.status(503).json({
      message: 'yt-dlp 未安装，请运行：brew install yt-dlp',
      installCmd: 'brew install yt-dlp',
    });
    return;
  }

  // 生成视频 ID，立即响应（异步在后台运行）
  const videoId = `yt-${uuidv4()}`;
  const setProgress = (stage: string, detail: string) => {
    ytProgressMap.set(videoId, { stage, detail });
  };

  // 立即返回 videoId，前端订阅 SSE 进度
  res.status(202).json({ videoId, message: '开始导入' });

  // ── 异步执行导入流程 ──────────────────────────────────────────────
  runYouTubeImport(videoId, url, req.userId!, setProgress).catch(err => {
    console.error('[YouTube] 导入失败:', err);
    setProgress('error', `导入失败：${err.message}`);
  });
});

// ── 异步导入主流程 ─────────────────────────────────────────────────────────
async function runYouTubeImport(
  videoId: string,
  url: string,
  userId: string,
  setProgress: (stage: string, detail: string) => void,
): Promise<void> {
  const THUMB_COLORS = ['#16a34a', '#7c3aed', '#0284c7', '#ea580c', '#db2777', '#d97706', '#0891b2'];

  try {
    // Step 1: 获取视频元数据
    setProgress('fetching', '正在获取 YouTube 视频信息...');
    let info: YouTubeVideoInfo;
    try {
      info = await getYouTubeInfo(url);
    } catch (err) {
      throw new Error(`获取视频信息失败：${err instanceof Error ? err.message : String(err)}`);
    }

    console.log(`[YouTube] 视频信息: ${info.title} (${info.duration}s)`);

    // Step 2: 创建占位 Video 记录（状态 analyzing）
    const filename = `${videoId}.mp4`;
    const filePath = path.join(__dirname, '../../uploads', filename);
    const video = {
      id: videoId,
      userId,
      name: info.title.slice(0, 60),
      category: detectCategory(info.title + ' ' + info.description + ' ' + info.tags.join(' ')),
      tags: info.tags.slice(0, 8),
      duration: info.duration,
      status: 'analyzing' as const,
      uploadedAt: new Date(),
      filePath,
      fileUrl: `/uploads/${filename}`,   // 前端播放地址
      hasRealFile: false,
      thumbnailColor: THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)],
      sourceUrl: url,
      sourceChannel: info.channel,
    };
    addVideo(video);

    // Step 3: 下载视频
    setProgress('downloading', '正在下载 YouTube 视频...');
    try {
      await downloadYouTubeVideo(url, videoId, setProgress);
    } catch (err) {
      throw new Error(`视频下载失败：${err instanceof Error ? err.message : String(err)}`);
    }

    // 更新文件状态
    updateVideo(videoId, { hasRealFile: true });
    console.log(`[YouTube] 下载完成: ${filePath}`);

    // Step 4: 获取实际时长（可能与元数据略有差异）
    try {
      const realDuration = await getVideoDuration(filePath);
      if (realDuration > 0) updateVideo(videoId, { duration: realDuration });
    } catch { /* ignore */ }

    // Step 5: 标准 Gemini 视频内容分析（复用现有管道）
    setProgress('analyzing', 'Gemini AI 深度分析视频内容...');
    let geminiAnalysis = null;
    let youtubeHighlights = '';

    try {
      const geminiResult = await analyzeVideoWithGemini(filePath, 'video/mp4', (stage, detail) => {
        setProgress(stage, detail ?? stage);
      });
      geminiAnalysis = geminiResult.analysis;
      updateVideo(videoId, {
        status: 'analyzed',
        analysis: geminiAnalysis,
        videoLabel: geminiResult.videoLabel,
      });
    } catch (err) {
      console.warn('[YouTube] Gemini 内容分析失败，继续创作亮点分析:', err);
    }

    // Step 6: YouTube 专属创作亮点分析
    setProgress('highlights', '正在提取创作亮点...');
    try {
      youtubeHighlights = await analyzeYouTubeHighlights(info, filePath, setProgress);
    } catch (err) {
      youtubeHighlights = `创作亮点分析暂时不可用：${err instanceof Error ? err.message : String(err)}`;
      console.warn('[YouTube] 创作亮点分析失败:', err);
    }

    // Step 7: 将亮点分析存入视频记录
    updateVideo(videoId, {
      status: 'analyzed',
      youtubeHighlights,
      youtubeInfo: {
        channel: info.channel,
        viewCount: info.viewCount,
        likeCount: info.likeCount,
        tags: info.tags,
        uploadDate: info.uploadDate,
        originalUrl: url,
      },
    });

    setProgress('done', `✅ YouTube 视频导入完成「${info.title.slice(0, 30)}」`);
    console.log(`[YouTube] ✅ 导入完成: ${info.title}`);

    // 清理进度（延迟 30s）
    setTimeout(() => ytProgressMap.delete(videoId), 30000);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[YouTube] 导入流程失败:', message);
    setProgress('error', `导入失败：${message}`);
    updateVideo(videoId, { status: 'pending' });
    setTimeout(() => ytProgressMap.delete(videoId), 10000);
  }
}

// ── 简单分类检测 ─────────────────────────────────────────────────────────
function detectCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/travel|旅行|旅游|vlog/.test(lower)) return '旅行';
  if (/food|料理|美食|cooking|recipe|cook/.test(lower)) return '美食';
  if (/tech|技术|programming|code|software|hardware/.test(lower)) return '科技';
  if (/game|gaming|gameplay|玩游戏/.test(lower)) return '游戏';
  if (/music|音乐|song|歌曲|mv/.test(lower)) return '音乐';
  if (/fitness|workout|gym|运动|健身/.test(lower)) return '运动';
  if (/tutorial|教程|how to|howto|learn/.test(lower)) return '教程';
  if (/fashion|style|outfit|穿搭|时尚/.test(lower)) return '时尚';
  if (/beauty|makeup|skincare|美妆|护肤/.test(lower)) return '美妆';
  return 'YouTube';
}

export { ytProgressMap };
export default router;
