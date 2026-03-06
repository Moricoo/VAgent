import axios from 'axios';

// 开发时直连后端，避免 Vite 代理对 PATCH 请求体转发异常
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
const api = axios.create({
  baseURL: isDev ? 'http://localhost:3001/api' : '/api',
  timeout: 90000,  // AI 请求包含两次 LLM 调用，需要更长超时
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  me: () => api.get('/auth/me'),
};

export const videosApi = {
  list: () => api.get('/videos'),
  get: (id: string) => api.get(`/videos/${id}`),
  upload: (formData: FormData) =>
    api.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  analyze: (videoIds: string[]) =>
    api.post('/videos/analyze', { videoIds }),
  rename: (id: string, name: string) => api.patch(`/videos/${id}`, { name }),
  update: (id: string, payload: { name?: string; category?: string }) =>
    api.request({
      method: 'PATCH',
      url: `/videos/${id}`,
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    }),
  delete: (id: string) => api.delete(`/videos/${id}`),
  /** Subscribe to SSE progress for a single video analysis */
  subscribeProgress: (
    videoId: string,
    onProgress: (stage: string, detail: string) => void,
  ): (() => void) => {
    const token = localStorage.getItem('token') ?? '';
    const url = `/api/videos/progress/${videoId}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const { stage, detail } = JSON.parse(e.data);
        onProgress(stage as string, detail as string);
        if (stage === 'done' || stage === 'error') es.close();
      } catch { /* ignore */ }
    };
    es.onerror = () => es.close();
    return () => es.close();
  },
};

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const youtubeApi = {
  check: () => api.get('/youtube/check'),
  getInfo: (url: string) => api.get('/youtube/info', { params: { url } }),
  importVideo: (url: string) => api.post('/youtube/import', { url }),
  subscribeProgress: (
    videoId: string,
    onProgress: (stage: string, detail: string) => void,
  ): (() => void) => {
    const token = localStorage.getItem('token') ?? '';
    const url = `/api/youtube/progress/${videoId}?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const { stage, detail } = JSON.parse(e.data);
        onProgress(stage as string, detail as string);
        if (stage === 'done' || stage === 'error') es.close();
      } catch { /* ignore */ }
    };
    es.onerror = () => es.close();
    return () => es.close();
  },
};

export const aiApi = {
  chat: (message: string, videoId?: string, history: ChatHistoryMessage[] = []) =>
    api.post('/ai/chat', { message, videoId, history }),
  multiAnalysis: (videoIds: string[], request: string, history: ChatHistoryMessage[] = []) =>
    api.post('/ai/multi-analysis', { videoIds, request, history }),
};
