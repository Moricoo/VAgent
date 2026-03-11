export interface User {
  id: string;
  username: string;
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

export interface Video {
  id: string;
  userId: string;
  name: string;
  originalName?: string;
  category: string;
  tags: string[];
  videoLabel?: string;
  status: 'pending' | 'analyzing' | 'analyzed';
  uploadedAt: string;
  duration: number;
  fileUrl?: string;
  thumbnailColor: string;
  analysis?: VideoAnalysis;
  /** 精准定位（本地模型 /predict）返回结果 */
  localDetections?: {
    video: string;
    confidence_threshold: number;
    count: number;
    detections: Array<{ 动作: string; 时间段: [number, number]; 置信度: number }>;
  };
  // YouTube 专属
  sourceUrl?: string;
  sourceChannel?: string;
  youtubeHighlights?: string;
  youtubeInfo?: {
    channel: string;
    viewCount: number;
    likeCount: number;
    tags: string[];
    uploadDate: string;
    originalUrl: string;
  };
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  /** 进度类消息（如 YouTube 导入）使用独立 logo，与 AI 对话区分 */
  messageType?: 'chat' | 'progress';
}

export type SortType = 'date-desc' | 'category' | 'name';
