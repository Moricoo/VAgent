import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  getVideosByUserId,
  getVideoById,
  addVideo,
  updateVideo,
  deleteVideo,
} from '../data/store';
import { Video, VideoAnalysis, VideoSegment } from '../types';
import { analyzeVideoWithGemini, getVideoDuration } from '../services/gemini';
import { logVideoAnalysis } from '../utils/aiLogger';

const router = Router();

// ── File upload setup ────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(__dirname, '../../uploads')),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/mp4|mov|avi|mkv|webm|m4v/i.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error('只支持视频文件格式'));
    }
  },
});

// ── Category / tag detection (fallback) ─────────────────────
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  '旅行': ['旅行', '旅游', '出行', '景点', '风景', '探索', '游记', '徒步', '登山', '海边', '山', '海', '湖'],
  'Vlog': ['vlog', '日常', '生活', '记录', '日记', '随拍', '碎片', '分享'],
  '科技': ['科技', '数码', '评测', '开箱', '产品', '手机', '电脑', '相机', '好物'],
  '美食': ['美食', '烹饪', '做饭', '食谱', '料理', '厨房', '探店', '餐厅'],
  '运动': ['运动', '健身', '跑步', '球赛', '体育', '训练', '锻炼'],
  '音乐': ['音乐', '歌曲', '演奏', '乐器', '吉他', '钢琴', '翻唱'],
  '教育': ['教学', '教程', '学习', '知识', '课程', '讲解', '科普'],
  '游戏': ['游戏', '电竞', '直播', '实况', '攻略'],
};

function detectCategory(name: string): string {
  const lower = name.toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    if (kws.some(kw => lower.includes(kw))) return cat;
  }
  return '其他';
}

function detectTags(name: string, category: string): string[] {
  const tags = [category];
  const lower = name.toLowerCase();
  for (const kws of Object.values(CATEGORY_KEYWORDS)) {
    for (const kw of kws) {
      if (lower.includes(kw) && !tags.includes(kw) && tags.length < 5) tags.push(kw);
    }
  }
  return tags.slice(0, 5);
}

// ── Mock analysis fallback ───────────────────────────────────
const SEGMENT_LABELS: Record<string, { label: string; color: string; isHighlight: boolean }[][]> = {
  '旅行': [[
    { label: '出发准备', color: '#3b82f6', isHighlight: false },
    { label: '景点游览', color: '#ef4444', isHighlight: true },
    { label: '美食体验', color: '#f59e0b', isHighlight: false },
    { label: '旅途感悟', color: '#8b5cf6', isHighlight: false },
  ]],
  'Vlog': [[
    { label: '日常开场', color: '#3b82f6', isHighlight: false },
    { label: '精彩活动', color: '#ef4444', isHighlight: true },
    { label: '互动时刻', color: '#10b981', isHighlight: false },
    { label: '日终回顾', color: '#8b5cf6', isHighlight: false },
  ]],
  '科技': [[
    { label: '产品介绍', color: '#3b82f6', isHighlight: false },
    { label: '功能测试', color: '#ef4444', isHighlight: true },
    { label: '性能对比', color: '#f59e0b', isHighlight: false },
    { label: '总结评分', color: '#8b5cf6', isHighlight: false },
  ]],
  '美食': [[
    { label: '食材准备', color: '#3b82f6', isHighlight: false },
    { label: '烹饪过程', color: '#ef4444', isHighlight: true },
    { label: '成品展示', color: '#f59e0b', isHighlight: false },
    { label: '品尝感受', color: '#10b981', isHighlight: false },
  ]],
};

const DEFAULT_LABELS = [
  { label: '片段一', color: '#3b82f6', isHighlight: false },
  { label: '精彩高潮', color: '#ef4444', isHighlight: true },
  { label: '片段三', color: '#f59e0b', isHighlight: false },
  { label: '片段四', color: '#8b5cf6', isHighlight: false },
];

const MOCK_VIDEO_LABELS: Record<string, string> = {
  '旅行': '旅行探索', 'Vlog': '日常Vlog', '科技': '科技评测',
  '美食': '美食烹饪', '运动': '运动健身', '音乐': '音乐演奏',
  '教育': '知识教学', '游戏': '游戏实战', '其他': '精彩视频',
};

function generateMockAnalysis(video: Video): VideoAnalysis {
  const labels = (SEGMENT_LABELS[video.category]?.[0]) || DEFAULT_LABELS;
  const duration = video.duration || 600;
  const segDur = Math.floor(duration / labels.length);

  const segments: VideoSegment[] = labels.map((l, i) => ({
    id: `seg_${i + 1}`,
    label: l.label,
    startTime: i * segDur,
    endTime: i === labels.length - 1 ? duration : (i + 1) * segDur,
    description: `${l.label}阶段：${video.name}中第${i + 1}个关键片段的精彩内容`,
    isHighlight: l.isHighlight,
    color: l.color,
  }));

  const highlight = segments.find(s => s.isHighlight) || segments[1];

  return {
    segments,
    summary: `《${video.name}》是一段精彩的${video.category}视频，内容丰富，层次分明，共分${segments.length}个核心片段。`,
    highlights: `${formatTime(highlight.startTime)} ~ ${formatTime(highlight.endTime)} 为精彩高潮，${highlight.description}`,
    suggestedTitle: `【${video.category}】${video.name} | 精彩合集`,
    suggestedTags: [`${video.category}vlog`, video.name, '原创内容', '高质量视频', '推荐观看'],
    editingTips: [
      '建议在片段衔接处使用渐变过渡，保持视觉流畅感',
      '精彩片段可配合节奏感强的背景音乐，增强感染力',
      '结尾加入行动号召（点赞/关注/分享），提升互动率',
    ],
    mood: '轻松愉快',
    paceRating: 7,
  };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Thumbnail color pool
const THUMB_COLORS = ['#16a34a', '#7c3aed', '#0284c7', '#ea580c', '#db2777', '#d97706', '#0891b2'];

// ── In-memory progress store ─────────────────────────────────
const progressMap = new Map<string, { stage: string; detail: string }>();

router.use(authMiddleware);

// ── GET /videos ──────────────────────────────────────────────
router.get('/', (req: AuthRequest, res: Response) => {
  res.json(getVideosByUserId(req.userId!));
});

// ── POST /videos/upload ──────────────────────────────────────
router.post('/upload', upload.single('video'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({ message: '请选择视频文件' });
    return;
  }

  const { originalname, filename, path: filePath } = req.file;
  const name = req.body.name || originalname.replace(/\.[^.]+$/, '');
  const category = detectCategory(name);
  const tags = detectTags(name, category);

  const video: Video = {
    id: uuidv4(),
    userId: req.userId!,
    name,
    originalName: originalname,
    category,
    tags,
    status: 'pending',
    uploadedAt: new Date().toISOString(),
    duration: 0,
    fileUrl: `/uploads/${filename}`,
    filePath,
    thumbnailColor: THUMB_COLORS[Math.floor(Math.random() * THUMB_COLORS.length)],
  };

  addVideo(video);
  res.status(201).json(video);
});

// ── GET /videos/progress/:id – SSE progress stream ───────────
router.get('/progress/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  const existing = progressMap.get(id);
  if (existing) send(existing);

  const interval = setInterval(() => {
    const p = progressMap.get(id);
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

// ── POST /videos/analyze ─────────────────────────────────────
router.post('/analyze', async (req: AuthRequest, res: Response) => {
  const { videoIds } = req.body as { videoIds: string[] };

  if (!videoIds?.length) {
    res.status(400).json({ message: '请指定要分析的视频' });
    return;
  }

  const targets: Video[] = [];
  for (const id of videoIds) {
    const v = getVideoById(id);
    if (v && v.userId === req.userId && (v.status !== 'analyzed' || !v.analysis)) {
      updateVideo(id, { status: 'analyzing' });
      targets.push({ ...v, status: 'analyzing' });
    }
  }

  res.json({ message: '开始分析', videos: targets });

  // Async analysis for each video
  for (const video of targets) {
    runAnalysis(video);
  }
});

async function runAnalysis(video: Video): Promise<void> {
  const { id, filePath, name, duration } = video;

  const setProgress = (stage: string, detail: string) => {
    progressMap.set(id, { stage, detail });
    console.log(`[分析][${name}] ${stage}: ${detail}`);
  };

  try {
    const hasRealFile = !!(filePath && fs.existsSync(filePath));
    console.log(`[分析][${name}] hasRealFile=${hasRealFile}, filePath=${filePath}`);

    if (hasRealFile) {
      // ── Real Gemini analysis ──────────────────────────────
      setProgress('uploading', '正在上传视频到 Gemini Files API...');

      const result = await analyzeVideoWithGemini(
        filePath!,
        name,
        duration,
        (stage, detail) => setProgress(stage, detail ?? stage),
      );

      updateVideo(id, {
        status: 'analyzed',
        duration: result.duration,
        category: result.category,
        tags: result.tags,
        videoLabel: result.videoLabel,
        analysis: result.analysis,
      });

      setProgress('done', `✅ Gemini 分析完成（${result.duration}秒，${result.analysis.segments.length}个片段）`);
      logVideoAnalysis({
        videoId: id,
        name,
        hasRealFile: true,
        success: true,
        duration: result.duration,
        segmentsCount: result.analysis.segments.length,
      });
      console.log(`[分析][${name}] ✅ Gemini 分析完成`);
    } else {
      // ── Mock analysis for demo videos without files ───────
      setProgress('analyzing', '正在生成智能分析（演示模式）...');

      // Try to get real duration if file exists but wasn't caught above
      let realDuration = duration;
      if (filePath && fs.existsSync(filePath) && realDuration === 0) {
        realDuration = await getVideoDuration(filePath);
      }

      const delay = 2000 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, delay));

      const cat = detectCategory(name);
      const mockTags = detectTags(name, cat);
      const mockLabel = MOCK_VIDEO_LABELS[cat] || cat;
      const videoWithDuration = { ...video, duration: realDuration || duration, category: cat };
      const mockAnalysis = generateMockAnalysis(videoWithDuration);

      updateVideo(id, {
        status: 'analyzed',
        duration: realDuration || duration,
        analysis: mockAnalysis,
        category: cat,
        tags: mockTags,
        videoLabel: mockLabel,
      });

      setProgress('done', '✅ 演示分析完成');
      logVideoAnalysis({
        videoId: id,
        name,
        hasRealFile: false,
        success: true,
        duration: realDuration || duration,
        segmentsCount: mockAnalysis.segments.length,
      });
      console.log(`[分析][${name}] ✅ 演示模式完成（无文件）`);
    }
  } catch (err: unknown) {
    const stack = err instanceof Error ? err.stack : String(err);
    const message = err instanceof Error ? err.message : String(err);
    const hasRealFile = !!(filePath && fs.existsSync(filePath));
    logVideoAnalysis({
      videoId: id,
      name,
      hasRealFile,
      success: false,
      error: message,
    });
    console.error(`[分析][${name}] ❌ 完整错误:\n${stack}`);
    console.error(`[分析][${name}] ❌ 分析失败:`, message);
    setProgress('error', `分析失败：${message}`);

    // Fallback to mock on API error
    console.log(`[分析][${name}] 切换到演示模式作为备用...`);
    try {
      await new Promise(r => setTimeout(r, 1500));
      let fallbackDuration = video.duration;
      if (!fallbackDuration && filePath && fs.existsSync(filePath)) {
        fallbackDuration = await getVideoDuration(filePath);
      }
      const fallbackCat = detectCategory(name);
      const fallbackVideo = { ...video, duration: fallbackDuration || video.duration, category: fallbackCat };
      const mockAnalysis = generateMockAnalysis(fallbackVideo);
      updateVideo(id, {
        status: 'analyzed',
        duration: fallbackDuration || video.duration,
        analysis: mockAnalysis,
        category: fallbackCat,
        tags: detectTags(name, fallbackCat),
        videoLabel: MOCK_VIDEO_LABELS[fallbackCat] || fallbackCat,
      });
      setProgress('done', '✅ 备用分析完成（演示数据）');
    } catch {
      updateVideo(id, { status: 'pending' });
      progressMap.delete(id);
    }
  }
}

// ── GET /videos/:id ───────────────────────────────────────────
router.get('/:id', (req: AuthRequest, res: Response) => {
  const video = getVideoById(req.params.id);
  if (!video || video.userId !== req.userId) {
    res.status(404).json({ message: '视频不存在' });
    return;
  }
  res.json(video);
});

// ── PATCH /videos/:id – 更新名称或分类 ────────────────────────────────
router.patch('/:id', (req: AuthRequest, res: Response) => {
  const video = getVideoById(req.params.id);
  if (!video || video.userId !== req.userId) {
    res.status(404).json({ message: '视频不存在' });
    return;
  }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const { name, category } = body as { name?: string; category?: string };
  const updates: { name?: string; category?: string } = {};
  const nameTrimmed = name !== undefined && name !== null ? String(name).trim() : '';
  const categoryTrimmed = category !== undefined && category !== null ? String(category).trim() : '';
  if (nameTrimmed) updates.name = nameTrimmed;
  if (categoryTrimmed) updates.category = categoryTrimmed;
  if (Object.keys(updates).length === 0) {
    res.status(400).json({ message: '请提供 name 或 category' });
    return;
  }
  const updated = updateVideo(req.params.id, updates);
  res.json(updated);
});

// ── DELETE /videos/:id ────────────────────────────────────────
router.delete('/:id', (req: AuthRequest, res: Response) => {
  const video = getVideoById(req.params.id);
  if (!video || video.userId !== req.userId) {
    res.status(404).json({ message: '视频不存在' });
    return;
  }
  // Remove physical file from disk if it exists
  if (video.filePath) {
    try {
      if (fs.existsSync(video.filePath)) {
        fs.unlinkSync(video.filePath);
        console.log(`[删除] 文件已移除: ${video.filePath}`);
      }
    } catch (err) {
      console.warn(`[删除] 文件移除失败（非致命）: ${err}`);
    }
  }
  deleteVideo(req.params.id);
  progressMap.delete(req.params.id);
  res.json({ message: '删除成功' });
});

export default router;
