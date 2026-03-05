import fs from 'fs';
import path from 'path';
import { Video } from '../types';

const DATA_DIR = path.join(__dirname, '../../data');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadVideos(): Video[] | null {
  ensureDataDir();
  if (!fs.existsSync(VIDEOS_FILE)) return null;
  try {
    const raw = fs.readFileSync(VIDEOS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Video[];
    console.log(`[持久化] 已加载 ${parsed.length} 个视频`);
    return parsed;
  } catch (err) {
    console.error('[持久化] 读取失败，将使用默认数据:', err);
    return null;
  }
}

export function saveVideos(videos: Video[]): void {
  ensureDataDir();
  try {
    fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videos, null, 2), 'utf-8');
  } catch (err) {
    console.error('[持久化] 写入失败:', err);
  }
}
