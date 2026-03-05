import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Video, LogOut, RefreshCw, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { videosApi } from '../api/client';
import { Video as VideoType } from '../types';
import VideoLibrary from '../components/VideoLibrary';
import VideoDetail from '../components/VideoDetail';
import AIAssistant from '../components/AIAssistant';

const COL1_DEFAULT = 256;
const COL3_DEFAULT = 360;
const COL1_MIN = 180;
const COL1_MAX = 420;
const COL3_MIN = 260;
const COL3_MAX = 520;

export default function AppPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [videos, setVideos] = useState<VideoType[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoType | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Resizable columns
  const [col1Width, setCol1Width] = useState(COL1_DEFAULT);
  const [col3Width, setCol3Width] = useState(COL3_DEFAULT);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ handle: 'left' | 'right'; startX: number; startWidth: number } | null>(null);

  const onHandleMouseDown = (handle: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = {
      handle,
      startX: e.clientX,
      startWidth: handle === 'left' ? col1Width : col3Width,
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { handle, startX, startWidth } = dragging.current;
      const delta = e.clientX - startX;
      if (handle === 'left') {
        setCol1Width(Math.min(COL1_MAX, Math.max(COL1_MIN, startWidth + delta)));
      } else {
        setCol3Width(Math.min(COL3_MAX, Math.max(COL3_MIN, startWidth - delta)));
      }
    };
    const onMouseUp = () => {
      if (!dragging.current) return;
      dragging.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const fetchVideos = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await videosApi.list();
      setVideos(res.data);
      if (selectedVideo) {
        const updated = res.data.find((v: VideoType) => v.id === selectedVideo.id);
        if (updated) setSelectedVideo(updated);
      }
    } catch (err) {
      console.error('获取视频列表失败', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedVideo]);

  useEffect(() => {
    fetchVideos(true);
  }, []);

  // Poll while any video is analyzing
  useEffect(() => {
    const hasAnalyzing = videos.some(v => v.status === 'analyzing');
    if (!hasAnalyzing) return;
    const timer = setInterval(async () => {
      try {
        const res = await videosApi.list();
        const updated: VideoType[] = res.data;
        setVideos(updated);
        if (selectedVideo) {
          const updatedSelected = updated.find(v => v.id === selectedVideo.id);
          if (updatedSelected) setSelectedVideo(updatedSelected);
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(timer);
  }, [videos, selectedVideo]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSelectVideo = (video: VideoType) => setSelectedVideo(video);

  const handleVideosChange = (updated: VideoType[]) => {
    setVideos(updated);
    if (selectedVideo) {
      const found = updated.find(v => v.id === selectedVideo.id);
      if (found) setSelectedVideo(found);
      else setSelectedVideo(null);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top bar */}
      <header className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 border-b border-gray-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm">
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-[14px] text-gray-900">VAgent</span>
          <span className="text-[10px] text-violet-600 font-semibold ml-1 px-1.5 py-0.5 rounded-md bg-violet-50 border border-violet-100">
            Beta
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchVideos()}
            disabled={refreshing}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
            title="刷新"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-violet-500' : ''}`} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-default border border-transparent hover:border-gray-100 transition-all">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-[11px] font-bold text-white">
              {user?.displayName?.[0] || user?.username?.[0] || 'U'}
            </div>
            <span className="text-sm font-medium text-gray-700">{user?.displayName || user?.username}</span>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all font-medium"
          >
            <LogOut className="w-3.5 h-3.5" />
            退出
          </button>
        </div>
      </header>

      {/* Main three-column layout */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Column 1: Video Library */}
        <div
          className="flex-shrink-0 bg-white flex flex-col overflow-hidden"
          style={{ width: col1Width }}
        >
          <VideoLibrary
            videos={videos}
            selectedVideo={selectedVideo}
            loading={loading}
            onSelectVideo={handleSelectVideo}
            onVideosChange={handleVideosChange}
          />
        </div>

        {/* Resize handle 1 */}
        <div
          onMouseDown={(e) => onHandleMouseDown('left', e)}
          className="flex-shrink-0 w-1 bg-gray-200 hover:bg-violet-400 active:bg-violet-500 cursor-col-resize transition-colors relative group"
          title="拖动调整宽度"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {[0,1,2].map(i => <div key={i} className="w-0.5 h-3 rounded-full bg-violet-400" />)}
          </div>
        </div>

        {/* Column 2: Video Detail */}
        <div className="flex-1 min-w-[280px] bg-white flex flex-col overflow-hidden">
          <VideoDetail video={selectedVideo} />
        </div>

        {/* Resize handle 2 */}
        <div
          onMouseDown={(e) => onHandleMouseDown('right', e)}
          className="flex-shrink-0 w-1 bg-gray-200 hover:bg-violet-400 active:bg-violet-500 cursor-col-resize transition-colors relative group"
          title="拖动调整宽度"
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {[0,1,2].map(i => <div key={i} className="w-0.5 h-3 rounded-full bg-violet-400" />)}
          </div>
        </div>

        {/* Column 3: AI Assistant */}
        <div
          className="flex-shrink-0 bg-white flex flex-col overflow-hidden"
          style={{ width: col3Width }}
        >
          <AIAssistant
            selectedVideo={selectedVideo}
            videos={videos}
            onVideoImported={() => fetchVideos(true)}
          />
        </div>
      </div>
    </div>
  );
}
