export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
}

export interface VideoSegment {
  id: string;
  label: string;
  startTime: number;
  endTime: number;
  description: string;
  isHighlight: boolean;
  color: string;
}

export interface VideoAnalysis {
  segments: VideoSegment[];
  summary: string;
  highlights: string;
  suggestedTitle: string;
  suggestedTags: string[];
  editingTips: string[];
  mood: string;
  paceRating: number;
}

export interface YouTubeVideoMeta {
  channel: string;
  viewCount: number;
  likeCount: number;
  tags: string[];
  uploadDate: string;
  originalUrl: string;
}

export interface Video {
  id: string;
  userId: string;
  name: string;
  originalName?: string;
  category: string;
  tags: string[];
  videoLabel?: string;
  status: 'pending' | 'analyzing' | 'analyzed';
  uploadedAt: string | Date;
  duration: number;
  fileUrl?: string;
  filePath: string;
  thumbnailColor: string;
  hasRealFile?: boolean;
  analysis?: VideoAnalysis;
  /** 精准定位（本地模型 /predict）返回结果 */
  localDetections?: {
    video: string;
    confidence_threshold: number;
    count: number;
    detections: Array<{ 动作: string; 时间段: [number, number]; 置信度: number }>;
  };
  // YouTube 专属字段
  sourceUrl?: string;
  sourceChannel?: string;
  youtubeHighlights?: string;
  youtubeInfo?: YouTubeVideoMeta;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
