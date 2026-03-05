import React, { useState } from 'react';
import { X, CheckSquare, Square, Sparkles, Loader2, Film } from 'lucide-react';
import { Video } from '../types';
import { aiApi, ChatHistoryMessage } from '../api/client';

interface Props {
  videos: Video[];
  onClose: () => void;
  onResult: (response: string) => void;
  history?: ChatHistoryMessage[];
}

export default function MultiVideoModal({ videos, onClose, onResult, history = [] }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [request, setRequest] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleVideo = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === videos.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(videos.map(v => v.id)));
  };

  const handleAnalyze = async () => {
    if (selectedIds.size === 0) return;
    setLoading(true);
    try {
      const res = await aiApi.multiAnalysis(
        Array.from(selectedIds),
        request || '综合分析所选视频，提供剪辑思路和发布建议',
        history,
      );
      onResult(res.data.response);
      onClose();
    } catch (err) {
      console.error('多视频分析失败', err);
    } finally {
      setLoading(false);
    }
  };

  const quickRequests = ['合集剪辑方案', '哪个视频最值得发布', '系列内容规划', '综合发布策略'];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-violet-100 flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-violet-600" />
              </div>
              多视频智能分析
            </h2>
            <p className="text-xs text-gray-400 mt-0.5 ml-8">选择多个视频，AI 提供综合创作建议</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Video List */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-500 font-semibold">选择视频 ({selectedIds.size}/{videos.length})</span>
            <button
              onClick={toggleAll}
              className="text-xs text-violet-600 hover:text-violet-800 transition-colors font-semibold"
            >
              {selectedIds.size === videos.length ? '取消全选' : '全选'}
            </button>
          </div>

          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {videos.map(video => (
              <button
                key={video.id}
                onClick={() => toggleVideo(video.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  selectedIds.has(video.id)
                    ? 'border-violet-200 bg-violet-50'
                    : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                }`}
              >
                {selectedIds.has(video.id)
                  ? <CheckSquare className="w-4 h-4 text-violet-500 flex-shrink-0" />
                  : <Square className="w-4 h-4 text-gray-300 flex-shrink-0" />}

                <div
                  className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
                  style={{ background: `${video.thumbnailColor}15` }}
                >
                  <Film className="w-4 h-4" style={{ color: video.thumbnailColor }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800 truncate">{video.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-gray-400">{video.category}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                      video.status === 'analyzed'  ? 'text-emerald-600 bg-emerald-50 border border-emerald-100' :
                      video.status === 'analyzing' ? 'text-violet-600 bg-violet-50 border border-violet-100' :
                      'text-gray-500 bg-gray-100'
                    }`}>
                      {video.status === 'analyzed' ? '已分析' : video.status === 'analyzing' ? '分析中' : '待分析'}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Quick requests */}
        <div className="px-4 pb-4">
          <p className="text-xs text-gray-400 font-semibold mb-2">分析方向（选填）</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickRequests.map(q => (
              <button
                key={q}
                onClick={() => setRequest(r => r === q ? '' : q)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  request === q
                    ? 'border-violet-300 bg-violet-50 text-violet-700'
                    : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {q}
              </button>
            ))}
          </div>
          <textarea
            value={request}
            onChange={e => setRequest(e.target.value)}
            placeholder="或输入自定义分析需求，例如：如何将这些视频做成系列合集..."
            rows={2}
            className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-100 resize-none transition-all"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <span className="text-xs text-gray-400 font-medium">
            {selectedIds.size === 0 ? '请至少选择一个视频' : `已选择 ${selectedIds.size} 个视频`}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-900 rounded-lg hover:bg-white transition-all font-medium border border-transparent hover:border-gray-200"
            >
              取消
            </button>
            <button
              onClick={handleAnalyze}
              disabled={selectedIds.size === 0 || loading}
              className="flex items-center gap-2 px-5 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-all shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? '分析中...' : '开始分析'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
