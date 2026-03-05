import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { getVideoById } from '../data/store';
import { Video } from '../types';
import { chatWithVideo, analyzeMultipleVideos, HistoryMessage } from '../services/aiGraph';

const router = Router();
router.use(authMiddleware);

// 延长 socket 超时，防止长时间 AI 请求被 Node 默认 socket 超时中断
function extendTimeout(req: Request, res: Response): void {
  req.socket.setTimeout(120000);  // 120s socket timeout
  res.setTimeout(120000);
}

// ── POST /ai/chat ──────────────────────────────────────────────────────────
router.post('/chat', async (req: AuthRequest, res: Response) => {
  extendTimeout(req, res);
  const { message, videoId, history } = req.body as {
    message: string;
    videoId?: string;
    history?: HistoryMessage[];
  };

  if (!message?.trim()) {
    res.status(400).json({ message: '消息不能为空' });
    return;
  }

  let video: Video | null = null;
  if (videoId) {
    const found = getVideoById(videoId);
    if (!found || found.userId !== req.userId) {
      res.status(404).json({ message: '视频不存在' });
      return;
    }
    video = found;
  }

  const safeHistory: HistoryMessage[] = Array.isArray(history)
    ? history.slice(-20)  // 最多保留最近 20 条历史
    : [];

  try {
    const response = await chatWithVideo(message.trim(), video, safeHistory);
    res.json({ response });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI Chat] 错误:', msg);
    res.status(500).json({ message: `AI 服务暂时不可用：${msg}` });
  }
});

// ── POST /ai/multi-analysis ────────────────────────────────────────────────
router.post('/multi-analysis', async (req: AuthRequest, res: Response) => {
  extendTimeout(req, res);
  const { videoIds, request, history } = req.body as {
    videoIds: string[];
    request: string;
    history?: HistoryMessage[];
  };

  if (!videoIds?.length) {
    res.status(400).json({ message: '请选择至少一个视频' });
    return;
  }

  const videos = videoIds
    .map(id => getVideoById(id))
    .filter((v): v is Video => v !== undefined && v.userId === req.userId);

  if (videos.length === 0) {
    res.status(404).json({ message: '未找到有效视频' });
    return;
  }

  const safeHistory: HistoryMessage[] = Array.isArray(history)
    ? history.slice(-20)
    : [];

  try {
    const response = await analyzeMultipleVideos(
      videos,
      request || '请对这些视频进行综合分析并给出创作建议',
      safeHistory,
    );
    res.json({ response });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[AI Multi] 错误:', msg);
    res.status(500).json({ message: `AI 服务暂时不可用：${msg}` });
  }
});

export default router;
