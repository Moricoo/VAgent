import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Upload, Search, SlidersHorizontal, CheckSquare, Square,
  Loader2, Zap, Trash2, Clock, ChevronDown, Film, Sparkles, Check, X
} from 'lucide-react';
import { Video, SortType } from '../types';
import { videosApi } from '../api/client';

// Stage label mapping for progress display
const STAGE_LABELS: Record<string, string> = {
  uploading:   '上传中',
  processing:  '处理中',
  analyzing:   'AI分析中',
  done:        '完成',
  error:       '失败',
};

interface Props {
  videos: Video[];
  selectedVideo: Video | null;
  loading: boolean;
  onSelectVideo: (v: Video) => void;
  onVideosChange: (v: Video[]) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  '旅行':  { bg: 'bg-emerald-50',  text: 'text-emerald-700',  dot: 'bg-emerald-400' },
  'Vlog':  { bg: 'bg-violet-50',   text: 'text-violet-700',   dot: 'bg-violet-400' },
  '科技':  { bg: 'bg-blue-50',     text: 'text-blue-700',     dot: 'bg-blue-400' },
  '美食':  { bg: 'bg-orange-50',   text: 'text-orange-700',   dot: 'bg-orange-400' },
  '运动':  { bg: 'bg-red-50',      text: 'text-red-700',      dot: 'bg-red-400' },
  '音乐':  { bg: 'bg-pink-50',     text: 'text-pink-700',     dot: 'bg-pink-400' },
  '教育':  { bg: 'bg-cyan-50',     text: 'text-cyan-700',     dot: 'bg-cyan-400' },
  '游戏':  { bg: 'bg-lime-50',     text: 'text-lime-700',     dot: 'bg-lime-400' },
  '其他':  { bg: 'bg-gray-100',    text: 'text-gray-600',     dot: 'bg-gray-400' },
};

export default function VideoLibrary({ videos, selectedVideo, loading, onSelectVideo, onVideosChange }: Props) {
  const [search, setSearch] = useState('');
  const [deepSearch, setDeepSearch] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('全部');
  const [sortType, setSortType] = useState<SortType>('date-desc');
  const [batchSelectMode, setBatchSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Progress per video id: { stage, detail }
  const [progressMap, setProgressMap] = useState<Record<string, { stage: string; detail: string }>>({});
  const sseCleanups = useRef<Record<string, () => void>>({});

  const updateProgress = useCallback((id: string, stage: string, detail: string) => {
    setProgressMap(prev => ({ ...prev, [id]: { stage, detail } }));
    // When analysis completes, refresh video list to get updated tags/category/analysis
    if (stage === 'done') {
      videosApi.list().then(res => onVideosChange(res.data)).catch(() => {});
    }
  }, [onVideosChange]);

  const subscribeAnalysis = useCallback((videoId: string) => {
    // Clean up existing subscription if any
    sseCleanups.current[videoId]?.();
    const cleanup = videosApi.subscribeProgress(videoId, (stage, detail) => {
      updateProgress(videoId, stage, detail);
    });
    sseCleanups.current[videoId] = cleanup;
  }, [updateProgress]);

  // Cleanup all SSE on unmount
  useEffect(() => {
    return () => { Object.values(sseCleanups.current).forEach(fn => fn()); };
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(videos.map(v => v.category))].filter(Boolean);
    return ['全部', ...cats];
  }, [videos]);

  const filteredVideos = useMemo(() => {
    let result = [...videos];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(v => {
        const matchBasic =
          v.name.toLowerCase().includes(q) ||
          v.tags.some(t => t.toLowerCase().includes(q)) ||
          v.category.toLowerCase().includes(q);
        if (matchBasic) return true;
        if (!deepSearch) return false;
        // 深度搜索：摘要、精彩片段、videoLabel、分段、剪辑建议、推荐标题/标签
        const analysisText: string[] = [];
        if (v.videoLabel) analysisText.push(v.videoLabel);
        if (v.analysis) {
          analysisText.push(v.analysis.summary, v.analysis.highlights);
          analysisText.push(v.analysis.suggestedTitle, ...v.analysis.suggestedTags);
          analysisText.push(...v.analysis.editingTips);
          for (const seg of v.analysis.segments || []) {
            analysisText.push(seg.label, seg.description);
          }
        }
        const combined = analysisText.filter(Boolean).join(' ').toLowerCase();
        return combined.includes(q);
      });
    }
    if (categoryFilter !== '全部') {
      result = result.filter(v => v.category === categoryFilter);
    }
    switch (sortType) {
      case 'date-desc': result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()); break;
      case 'category':  result.sort((a, b) => a.category.localeCompare(b.category)); break;
      case 'name':      result.sort((a, b) => a.name.localeCompare(b.name)); break;
    }
    return result;
  }, [videos, search, deepSearch, categoryFilter, sortType]);

  const pendingVideos = videos.filter(v => v.status === 'pending');
  const analyzingVideos = videos.filter(v => v.status === 'analyzing');
  const hasAnalyzing = analyzingVideos.length > 0;
  const analyzableVideos = videos.filter(v => v.status === 'pending' || (v.status === 'analyzed' && !v.analysis));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newVideos: Video[] = [...videos];
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('video', file);
        formData.append('name', file.name.replace(/\.[^.]+$/, ''));
        const res = await videosApi.upload(formData);
        newVideos.push(res.data);
      }
      onVideosChange(newVideos);
    } catch (err) {
      console.error('上传失败', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async (ids: string[]) => {
    if (ids.length === 0 || hasAnalyzing || analyzing) return;
    setAnalyzing(true);
    setBatchSelectMode(false);
    setSelectedIds(new Set());
    try {
      await videosApi.analyze(ids);
      const res = await videosApi.list();
      onVideosChange(res.data);
      for (const id of ids) {
        subscribeAnalysis(id);
      }
    } catch (err) {
      console.error('分析失败', err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmBatchAnalyze = () => {
    if (selectedIds.size === 0) return;
    handleAnalyze(Array.from(selectedIds));
  };

  const exitBatchMode = () => {
    setBatchSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确认删除该视频？删除后文件将无法恢复。')) return;
    try {
      await videosApi.delete(id);
      onVideosChange(videos.filter(v => v.id !== id));
      const newSet = new Set(selectedIds);
      newSet.delete(id);
      setSelectedIds(newSet);
    } catch (err) {
      console.error('删除失败', err);
    }
  };

  const handleRename = useCallback(async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      await videosApi.rename(id, newName.trim());
      onVideosChange(videos.map(v => v.id === id ? { ...v, name: newName.trim() } : v));
    } catch (err) {
      console.error('重命名失败', err);
    }
  }, [videos, onVideosChange]);

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVideos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredVideos.map(v => v.id)));
  };

  const formatDuration = (s: number) => {
    if (!s) return '--:--';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const sortLabels: Record<SortType, string> = {
    'date-desc': '最新优先',
    'category': '按分类',
    'name': '按名称',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 p-3 space-y-2.5 border-b border-gray-100">
        {/* Upload + 批量分析（仅非多选模式显示） */}
        <div className="flex gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 rounded-lg text-xs font-semibold text-white transition-colors shadow-sm"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? '上传中...' : '上传视频'}
          </button>
          {!batchSelectMode && (
            <button
              onClick={() => { setBatchSelectMode(true); setSelectedIds(new Set()); }}
              disabled={hasAnalyzing || analyzing || analyzableVideos.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-semibold text-gray-600 transition-all"
              title={hasAnalyzing ? '分析进行中，请稍候' : '选择要分析的视频后点击确认'}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              批量分析
            </button>
          )}
        </div>

        {/* Search + 深度搜索 */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索视频..."
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-100 transition-all"
            />
          </div>
          <label className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none text-[11px] text-gray-600 hover:text-gray-800">
            <input
              type="checkbox"
              checked={deepSearch}
              onChange={e => setDeepSearch(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
            />
            深度搜索
          </label>
        </div>

        {/* Category + Sort */}
        <div className="flex items-center gap-1.5">
          <div className="flex-1 flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                  categoryFilter === cat
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowSort(!showSort)}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-700 text-[11px] transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <ChevronDown className="w-3 h-3" />
            </button>
            {showSort && (
              <div className="absolute right-0 top-full mt-1 w-28 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {(Object.keys(sortLabels) as SortType[]).map(key => (
                  <button
                    key={key}
                    onClick={() => { setSortType(key); setShowSort(false); }}
                    className={`w-full px-3 py-2 text-left text-[11px] hover:bg-gray-50 transition-colors font-medium ${
                      sortType === key ? 'text-violet-600 bg-violet-50' : 'text-gray-600'
                    }`}
                  >
                    {sortLabels[key]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 批量分析：多选模式下的操作栏 */}
      {batchSelectMode && (
        <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-violet-50 border-b border-violet-100">
          <span className="text-xs text-violet-700 font-semibold">
            {selectedIds.size > 0 ? `已选 ${selectedIds.size} 个` : '请勾选要分析的视频'}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={handleConfirmBatchAnalyze}
              disabled={selectedIds.size === 0 || hasAnalyzing || analyzing}
              className="px-2.5 py-1 rounded-md bg-violet-600 text-white text-[11px] font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              确认
            </button>
            <button
              onClick={exitBatchMode}
              className="px-2.5 py-1 rounded-md bg-white border border-gray-200 text-gray-500 text-[11px] hover:text-gray-700 transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* Video List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-violet-400" />
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
              <Film className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-400">暂无视频</p>
            <p className="text-xs text-gray-300 mt-1">点击上方按钮上传视频</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {batchSelectMode && filteredVideos.length > 1 && (
              <button
                onClick={toggleSelectAll}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {selectedIds.size === filteredVideos.length
                  ? <CheckSquare className="w-3.5 h-3.5 text-violet-500" />
                  : <Square className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-medium">全选</span>
              </button>
            )}

            {filteredVideos.map(video => (
              <VideoItem
                key={video.id}
                video={video}
                isSelected={selectedVideo?.id === video.id}
                showCheckbox={batchSelectMode}
                isChecked={selectedIds.has(video.id)}
                onSelect={() => onSelectVideo(video)}
                onCheck={(e) => toggleSelect(video.id, e)}
                onDelete={(e) => handleDelete(video.id, e)}
                onAnalyze={(e) => { e.stopPropagation(); handleAnalyze([video.id]); }}
                onRename={(name) => handleRename(video.id, name)}
                formatDuration={formatDuration}
                formatDate={formatDate}
                canAnalyze={!hasAnalyzing && !analyzing && (video.status === 'pending' || (video.status === 'analyzed' && !video.analysis))}
                categoryColor={CATEGORY_COLORS[video.category] || CATEGORY_COLORS['其他']}
                progress={progressMap[video.id]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats footer */}
      <div className="flex-shrink-0 px-3 py-2 border-t border-gray-100 flex items-center justify-between bg-gray-50">
        <span className="text-[10px] text-gray-400 font-medium">{videos.length} 个视频</span>
        <span className="text-[10px] text-gray-400">
          <span className="text-emerald-600 font-semibold">{videos.filter(v => v.status === 'analyzed').length}</span> 已分析
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

function VideoItem({
  video, isSelected, showCheckbox, isChecked, onSelect, onCheck, onDelete, onAnalyze, onRename,
  formatDuration, formatDate, canAnalyze, categoryColor, progress,
}: {
  video: Video;
  isSelected: boolean;
  showCheckbox: boolean;
  isChecked: boolean;
  onSelect: () => void;
  onCheck: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  onAnalyze: (e: React.MouseEvent) => void;
  onRename: (name: string) => void;
  formatDuration: (s: number) => string;
  formatDate: (s: string) => string;
  canAnalyze: boolean;
  categoryColor: { bg: string; text: string; dot: string };
  progress?: { stage: string; detail: string };
}) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(video.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync edit name if video.name changes externally
  useEffect(() => { if (!editing) setEditName(video.name); }, [video.name, editing]);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditName(video.name);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
  };

  const commitEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const trimmed = editName.trim();
    if (trimmed && trimmed !== video.name) onRename(trimmed);
    setEditing(false);
  };

  const cancelEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditName(video.name);
    setEditing(false);
  };

  return (
    <div
      onClick={editing ? undefined : onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); }}
      className={`relative flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all group ${
        editing ? 'bg-violet-50 border border-violet-300' :
        isSelected ? 'bg-violet-50 border border-violet-200 cursor-pointer' :
        'hover:bg-gray-50 border border-transparent cursor-pointer'
      }`}
    >
      {/* 仅批量分析模式下显示多选框 */}
      {showCheckbox && (
        <button
          onClick={onCheck}
          className="flex-shrink-0 transition-opacity"
        >
          {isChecked
            ? <CheckSquare className="w-3.5 h-3.5 text-violet-500" />
            : <Square className="w-3.5 h-3.5 text-gray-400" />}
        </button>
      )}

      {/* Thumbnail */}
      <div
        className="flex-shrink-0 w-14 h-10 rounded-lg overflow-hidden relative"
        style={{ background: `linear-gradient(135deg, ${video.thumbnailColor}25 0%, ${video.thumbnailColor}08 100%)` }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{ background: `radial-gradient(circle at 30% 50%, ${video.thumbnailColor}60, transparent 70%)` }}
        />
        <div className="absolute bottom-0.5 right-0.5 text-[9px] text-gray-600 font-mono bg-white/70 px-1 rounded">
          {formatDuration(video.duration)}
        </div>
        {video.status === 'analyzing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/50">
            <Loader2 className="w-3.5 h-3.5 text-violet-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Name row — inline edit or display */}
        {editing ? (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') cancelEdit();
                e.stopPropagation();
              }}
              className="flex-1 min-w-0 text-xs font-semibold text-gray-800 bg-white border border-violet-400 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-300"
            />
            <button onClick={commitEdit} className="flex-shrink-0 p-0.5 rounded text-emerald-500 hover:bg-emerald-50 transition-colors">
              <Check className="w-3 h-3" />
            </button>
            <button onClick={cancelEdit} className="flex-shrink-0 p-0.5 rounded text-gray-400 hover:bg-gray-100 transition-colors">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <span
              className="text-xs font-semibold text-gray-800 truncate leading-tight"
              onDoubleClick={startEdit}
              title="双击重命名"
            >
              {video.name}
            </span>
          </div>
        )}

        <div className="flex items-center gap-1.5 mt-0.5">
          <StatusBadge status={video.status} hasAnalysis={!!video.analysis} progress={progress} />
          <span className="text-[10px] text-gray-400 flex items-center gap-0.5 font-medium">
            <Clock className="w-2.5 h-2.5" />
            {formatDate(video.uploadedAt)}
          </span>
        </div>
        {/* Gemini progress detail */}
        {video.status === 'analyzing' && progress && progress.stage !== 'done' && (
          <div className="mt-1 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-violet-400 flex-shrink-0" />
            <span className="text-[10px] text-violet-500 truncate font-medium">
              {STAGE_LABELS[progress.stage] || progress.stage}
            </span>
          </div>
        )}
        {video.status !== 'analyzing' && (
          <div className="flex items-center gap-1 mt-1">
            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-gray-100 text-gray-500">
              {video.category}
            </span>
            {video.videoLabel && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-violet-50 text-violet-500 border border-violet-100">
                {video.videoLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hover actions */}
      {hovered && !editing && (
        <div className="flex-shrink-0 flex flex-col gap-1" onClick={e => e.stopPropagation()}>
          {canAnalyze && (
            <button
              onClick={onAnalyze}
              className="p-1.5 rounded-lg bg-violet-50 text-violet-500 hover:bg-violet-100 transition-colors"
              title="分析此视频"
            >
              <Zap className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 transition-colors"
            title="删除"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status, hasAnalysis, progress }: { status: Video['status']; hasAnalysis?: boolean; progress?: { stage: string; detail: string } }) {
  if (status === 'analyzed' && !hasAnalysis) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 text-[10px] font-semibold border border-amber-200">
        <span className="w-1 h-1 rounded-full bg-amber-500" />
        待重新分析
      </span>
    );
  }
  if (status === 'analyzed') {
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[10px] font-semibold border border-emerald-100">
        <span className="w-1 h-1 rounded-full bg-emerald-500" />
        已分析
      </span>
    );
  }
  if (status === 'analyzing') {
    const stageLabel = progress ? (STAGE_LABELS[progress.stage] || '分析中') : '分析中';
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-600 text-[10px] font-semibold border border-violet-100 analyzing-pulse">
        <Loader2 className="w-2.5 h-2.5 animate-spin" />
        {stageLabel}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 text-[10px] font-semibold">
      <span className="w-1 h-1 rounded-full bg-gray-400" />
      待分析
    </span>
  );
}
