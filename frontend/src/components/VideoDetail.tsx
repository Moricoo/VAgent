import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play, Pause, Volume2, VolumeX, Maximize2, Film,
  Clock, Tag, Sparkles, ChevronRight, Info, BarChart2
} from 'lucide-react';
import { Video, VideoSegment } from '../types';

interface Props {
  video: Video | null;
}

export default function VideoDetail({ video }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSegment, setActiveSegment] = useState<VideoSegment | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const segments = video?.analysis?.segments || [];
  const effectiveDuration = duration > 0 ? duration : (video?.duration || 875);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setActiveSegment(null);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [video?.id]);

  useEffect(() => {
    if (segments.length > 0 && !isDragging) {
      const seg = segments.find(s => currentTime >= s.startTime && currentTime < s.endTime);
      if (seg) setActiveSegment(seg);
    }
  }, [currentTime, segments, isDragging]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) { setPlaying(prev => !prev); return; }
    if (v.paused) { v.play(); setPlaying(true); }
    else { v.pause(); setPlaying(false); }
  };

  useEffect(() => {
    if (!video?.fileUrl && playing) {
      const interval = setInterval(() => {
        setCurrentTime(t => {
          const next = t + 0.5;
          if (next >= effectiveDuration) { setPlaying(false); return 0; }
          return next;
        });
      }, 500);
      return () => clearInterval(interval);
    }
  }, [playing, video?.fileUrl, effectiveDuration]);

  const handleTimeUpdate = () => { if (videoRef.current) setCurrentTime(videoRef.current.currentTime); };
  const handleLoadedMetadata = () => { if (videoRef.current) setDuration(videoRef.current.duration); };

  const seekTo = useCallback((time: number) => {
    setCurrentTime(time);
    if (videoRef.current) videoRef.current.currentTime = time;
  }, []);

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(effectiveDuration, ratio * effectiveDuration)));
  };

  const handleTimelineDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / rect.width;
    seekTo(Math.max(0, Math.min(effectiveDuration, ratio * effectiveDuration)));
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const progressPercent = effectiveDuration > 0 ? (currentTime / effectiveDuration) * 100 : 0;

  if (!video) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-gray-50">
        <div className="w-16 h-16 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mb-5 shadow-sm">
          <Film className="w-7 h-7 text-gray-300" />
        </div>
        <h3 className="text-base font-bold text-gray-500 mb-2">选择视频开始分析</h3>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          从左侧视频库选择一个视频，查看时序分析、精彩片段标注和分段详情
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Video Title Bar */}
      <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-white min-w-0">
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: video.thumbnailColor }} />
        <span className="text-sm font-bold text-gray-800 truncate flex-1 min-w-0">{video.name}</span>
        <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-600">
          {video.category}
        </span>
        {video.videoLabel && (
          <span className="flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-violet-50 text-violet-600 border border-violet-100">
            {video.videoLabel}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        {/* Video Player */}
        <div className="relative bg-gray-900">
          {video.fileUrl ? (
            <video
              ref={videoRef}
              src={video.fileUrl}
              className="w-full aspect-video object-contain"
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              muted={muted}
            />
          ) : (
            <div
              className="w-full aspect-video flex flex-col items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${video.thumbnailColor}18 0%, #111 100%)` }}
            >
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-3 border-2 border-white/10"
                style={{ background: `${video.thumbnailColor}20` }}
              >
                <Film className="w-8 h-8 text-white/40" />
              </div>
              <p className="text-sm text-white/30 font-medium">演示预览（无视频文件）</p>
            </div>
          )}

          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={togglePlay}>
            {!playing && (
              <div className="w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-white/25 transition-all">
                <Play className="w-5 h-5 text-white ml-0.5" />
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent">
            <div
              className="relative h-1 bg-white/20 rounded-full cursor-pointer mb-2.5 group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                seekTo(((e.clientX - rect.left) / rect.width) * effectiveDuration);
              }}
            >
              <div className="h-full rounded-full bg-violet-400 relative" style={{ width: `${progressPercent}%` }}>
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-sm opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-violet-300 transition-colors">
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button onClick={() => setMuted(!muted)} className="text-white/60 hover:text-white transition-colors">
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <span className="text-xs text-white/60 font-mono">
                  {formatTime(currentTime)} / {formatTime(effectiveDuration)}
                </span>
              </div>
              <button className="text-white/60 hover:text-white transition-colors">
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Analysis content */}
        {video.status === 'analyzed' && video.analysis ? (
          <div className="p-4 space-y-5">
            {/* Timeline */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-violet-500" />
                  时序分析时间轴
                </h3>
                <span className="text-[10px] text-gray-400 font-medium">点击或拖拽跳转片段</span>
              </div>

              <div
                ref={timelineRef}
                className="relative h-9 rounded-xl overflow-hidden cursor-pointer select-none mb-3 shadow-inner"
                onClick={handleTimelineClick}
                onMouseDown={() => setIsDragging(true)}
                onMouseMove={handleTimelineDrag}
                onMouseUp={() => setIsDragging(false)}
                onMouseLeave={() => setIsDragging(false)}
                style={{ background: '#e2e8f0' }}
              >
                <div className="flex h-full">
                  {segments.map((seg) => {
                    const widthPct = ((seg.endTime - seg.startTime) / effectiveDuration) * 100;
                    return (
                      <div
                        key={seg.id}
                        className="segment-timeline-bar h-full relative flex items-center justify-center overflow-hidden border-r border-white/30"
                        style={{
                          width: `${widthPct}%`,
                          backgroundColor: seg.isHighlight ? seg.color : `${seg.color}cc`,
                          opacity: activeSegment?.id === seg.id ? 1 : 0.7,
                        }}
                        onClick={(e) => { e.stopPropagation(); seekTo(seg.startTime + 1); setActiveSegment(seg); }}
                      >
                        <span className="text-[9px] font-semibold text-white/95 truncate px-1 drop-shadow-sm">
                          {seg.label}
                        </span>
                        {seg.isHighlight && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Playhead */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-800 shadow pointer-events-none z-10"
                  style={{ left: `${progressPercent}%` }}
                >
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-900 border-2 border-white shadow-md" />
                </div>
              </div>

              <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-3">
                <span>00:00</span>
                <span>{formatTime(Math.floor(effectiveDuration / 2))}</span>
                <span>{formatTime(effectiveDuration)}</span>
              </div>

              {/* Segment legend */}
              <div className="flex flex-wrap gap-1.5">
                {segments.map(seg => (
                  <button
                    key={seg.id}
                    onClick={() => { seekTo(seg.startTime + 1); setActiveSegment(seg); }}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      activeSegment?.id === seg.id
                        ? 'border-gray-300 bg-white shadow-sm'
                        : 'border-transparent hover:border-gray-200 hover:bg-white'
                    }`}
                  >
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: seg.color }} />
                    <span className="text-gray-600">{seg.label}</span>
                    {seg.isHighlight && <Sparkles className="w-3 h-3 text-amber-500" />}
                    <span className="text-gray-400 font-mono">{formatTime(seg.startTime)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Segments list */}
            <div>
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-violet-500" />
                片段详情
              </h3>
              <div className="space-y-2">
                {segments.map((seg, i) => (
                  <button
                    key={seg.id}
                    onClick={() => { seekTo(seg.startTime + 1); setActiveSegment(seg); }}
                    className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:shadow-sm ${
                      activeSegment?.id === seg.id
                        ? 'border-gray-200 bg-gray-50 shadow-sm'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div
                      className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                      style={{ background: seg.color }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-gray-800">{seg.label}</span>
                        {seg.isHighlight && <Sparkles className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{seg.description}</p>
                      <span className="text-[10px] text-gray-400 font-mono mt-1.5 block">
                        {formatTime(seg.startTime)} → {formatTime(seg.endTime)} · {seg.endTime - seg.startTime}秒
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Summary card */}
            <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
              <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                视频概要
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed mb-4">{video.analysis.summary}</p>
              <div className="flex items-center gap-4 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-1.5 text-xs">
                  <Tag className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-400">基调：</span>
                  <span className="text-gray-700 font-semibold">{video.analysis.mood}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <BarChart2 className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-gray-400">节奏感：</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-sm"
                        style={{ background: i < video.analysis!.paceRating ? video.thumbnailColor : '#e2e8f0' }}
                      />
                    ))}
                  </div>
                  <span className="text-gray-600 font-semibold">{video.analysis.paceRating}/10</span>
                </div>
              </div>
            </div>
          </div>
        ) : video.status === 'analyzing' ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="relative w-14 h-14 mb-5">
              <div className="absolute inset-0 rounded-full border-2 border-violet-200" />
              <div className="absolute inset-0 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <div className="absolute inset-2 rounded-full bg-violet-50 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-violet-500" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-gray-700 mb-1.5">AI 正在分析视频...</h3>
            <p className="text-xs text-gray-400">正在识别场景、动作片段和精彩高潮，请稍候</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-gray-300" />
            </div>
            <h3 className="text-sm font-bold text-gray-400 mb-2">等待 AI 分析</h3>
            <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
              点击左侧"分析"按钮，AI 将自动识别场景、动作和精彩片段
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
