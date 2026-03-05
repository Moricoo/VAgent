import path from 'path';
import { User, Video } from '../types';
import { loadVideos, saveVideos } from './persistence';

export const users: User[] = [
  { id: 'u1', username: 'admin', password: 'admin123', displayName: '管理员' },
  { id: 'u2', username: 'demo', password: 'demo123', displayName: '演示用户' },
];

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Default videos seeded when no persisted data exists
const DEFAULT_VIDEOS: Video[] = [
  {
    id: 'v-99c564b4',
    userId: 'u1',
    name: '视频-99c564b4',
    originalName: '99c564b4-29ca-4be2-aa20-4cbdb42927df.mp4',
    category: '其他',
    tags: [],
    status: 'pending',
    uploadedAt: '2026-03-02T09:13:34.779Z',
    duration: 5,
    fileUrl: '/uploads/99c564b4-29ca-4be2-aa20-4cbdb42927df.mp4',
    filePath: path.join(UPLOADS_DIR, '99c564b4-29ca-4be2-aa20-4cbdb42927df.mp4'),
    thumbnailColor: '#0284c7',
  },
  {
    id: 'v-689f685a',
    userId: 'u1',
    name: '视频-689f685a',
    originalName: '689f685a-378a-4cf6-be8e-890c3f8df975.mp4',
    category: '其他',
    tags: [],
    status: 'pending',
    uploadedAt: '2026-03-02T12:20:24.554Z',
    duration: 5,
    fileUrl: '/uploads/689f685a-378a-4cf6-be8e-890c3f8df975.mp4',
    filePath: path.join(UPLOADS_DIR, '689f685a-378a-4cf6-be8e-890c3f8df975.mp4'),
    thumbnailColor: '#7c3aed',
  },
  {
    id: 'v-1bbd1e9b',
    userId: 'u1',
    name: '视频-1bbd1e9b',
    originalName: '1bbd1e9b-039d-490c-b990-ea456e3fa307.mp4',
    category: '其他',
    tags: [],
    status: 'pending',
    uploadedAt: '2026-03-02T13:02:08.134Z',
    duration: 5,
    fileUrl: '/uploads/1bbd1e9b-039d-490c-b990-ea456e3fa307.mp4',
    filePath: path.join(UPLOADS_DIR, '1bbd1e9b-039d-490c-b990-ea456e3fa307.mp4'),
    thumbnailColor: '#ea580c',
  },
  {
    id: 'v-f6ee694e',
    userId: 'u1',
    name: '视频-f6ee694e',
    originalName: 'f6ee694e-ec40-40d6-8371-5d966e541764.mp4',
    category: '其他',
    tags: [],
    status: 'pending',
    uploadedAt: '2026-03-02T13:16:19.473Z',
    duration: 3,
    fileUrl: '/uploads/f6ee694e-ec40-40d6-8371-5d966e541764.mp4',
    filePath: path.join(UPLOADS_DIR, 'f6ee694e-ec40-40d6-8371-5d966e541764.mp4'),
    thumbnailColor: '#16a34a',
  },
  {
    id: 'v-b77c3711',
    userId: 'u1',
    name: '视频-b77c3711',
    originalName: 'b77c3711-689d-4cbf-b8a2-d073d9cc7348.mp4',
    category: '其他',
    tags: [],
    status: 'pending',
    uploadedAt: '2026-03-02T13:21:13.373Z',
    duration: 5,
    fileUrl: '/uploads/b77c3711-689d-4cbf-b8a2-d073d9cc7348.mp4',
    filePath: path.join(UPLOADS_DIR, 'b77c3711-689d-4cbf-b8a2-d073d9cc7348.mp4'),
    thumbnailColor: '#d97706',
  },
];

// Load persisted data on startup; fall back to defaults and save immediately
const _persisted = loadVideos();
export const videos: Video[] = _persisted ?? DEFAULT_VIDEOS;
if (!_persisted) {
  saveVideos(videos);
  console.log('[持久化] 首次启动，已写入默认数据');
}

// ── User helpers ─────────────────────────────────────────────
export function findUserByCredentials(username: string, password: string): User | undefined {
  return users.find(u => u.username === username && u.password === password);
}

export function findUserById(id: string): User | undefined {
  return users.find(u => u.id === id);
}

// ── Video helpers (persist after every mutation) ─────────────
export function getVideosByUserId(userId: string): Video[] {
  return videos.filter(v => v.userId === userId);
}

export function getVideoById(id: string): Video | undefined {
  return videos.find(v => v.id === id);
}

export function addVideo(video: Video): void {
  videos.push(video);
  saveVideos(videos);
}

export function updateVideo(id: string, updates: Partial<Video>): Video | null {
  const index = videos.findIndex(v => v.id === id);
  if (index === -1) return null;
  videos[index] = { ...videos[index], ...updates };
  saveVideos(videos);
  return videos[index];
}

export function deleteVideo(id: string): boolean {
  const index = videos.findIndex(v => v.id === id);
  if (index === -1) return false;
  videos.splice(index, 1);
  saveVideos(videos);
  return true;
}
