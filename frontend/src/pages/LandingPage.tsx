import React from 'react';
import { Link } from 'react-router-dom';
import { Video, Sparkles, Search, Brain, Clock, SearchCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[16px] tracking-tight text-gray-900">点子</span>
        </div>
        <Link
          to="/login"
          className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
        >
          开始使用
        </Link>
      </nav>

      {/* Hero + 四大核心能力（同背景） */}
      <section className="relative py-16 md:py-20 px-6 overflow-hidden">
        {/* 与标题页同一背景 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[120%] rounded-full bg-gradient-to-b from-violet-50 to-transparent opacity-70" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto">
          {/* 标题区 */}
          <div className="flex flex-col items-center text-center mb-12 md:mb-16">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              <span className="text-gray-900">AI 帮你理解视频，</span>
              <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent animate-glow inline-block">
                事半功倍。
              </span>
            </h1>
            <p className="max-w-2xl text-lg text-gray-500 leading-relaxed">
              AI 自动解析视频内容与结构，生成分类、分段与精彩片段；支持关键词与深度检索快速定位素材，
              再结合创作助手生成标题、文案与剪辑方案，让理解与创作都事半功倍。
            </p>
          </div>

          {/* 四大核心能力 */}
          <div id="features" className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">四大核心能力</h2>
            <p className="text-gray-500">AI 驱动的全链路视频创作管理</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <FeatureCard
              icon={<Brain className="w-5 h-5 text-violet-600" />}
              iconBg="bg-violet-50"
              title="智能视频分类"
              description="AI 自动识别视频内容，精准生成分类标签。支持旅行、Vlog、科技、美食等多种品类，轻松管理海量视频资产。"
              tags={['自动标签', '多维分类']}
            />
            <FeatureCard
              icon={<Search className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-50"
              title="时序动作分析"
              description="基于帧级分析技术，精准识别场景转换、动作片段和精彩高潮，时间轴可视化展示，一目了然。"
              tags={['精彩片段', '场景分割', '高潮检测']}
              highlight
            />
            <FeatureCard
              icon={<SearchCheck className="w-5 h-5 text-amber-600" />}
              iconBg="bg-amber-50"
              title="深度检索"
              description="关键词模糊检索基础上，支持在摘要、精彩片段描述、分段说明、剪辑建议与推荐标题中一并搜索，按内容语义快速定位视频。"
              tags={['关键词检索', '语义搜索', '分析结果检索']}
            />
            <FeatureCard
              icon={<Sparkles className="w-5 h-5 text-fuchsia-600" />}
              iconBg="bg-fuchsia-50"
              title="AI 创作助手"
              description="基于视频分析结果，自动生成标题、文案、剪辑方案。支持多视频联合分析，为系列创作提供整体策略。"
              tags={['标题生成', '文案撰写', '剪辑方案']}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center">
              <Video className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-bold text-gray-900">点子</span>
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            © 2026 点子 · AI 智能视频剪辑平台
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon, iconBg, title, description, tags, highlight = false
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  tags: string[];
  highlight?: boolean;
}) {
  return (
    <div className={`relative p-7 rounded-2xl border transition-all hover:-translate-y-1 hover:shadow-lg cursor-default ${
      highlight
        ? 'bg-white border-violet-200 shadow-md ring-1 ring-violet-100'
        : 'bg-white border-gray-100 shadow-sm'
    }`}>
      {highlight && (
        <div className="absolute top-5 right-5 px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold">
          核心功能
        </div>
      )}
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center mb-5`}>
        {icon}
      </div>
      <h3 className="font-bold text-base text-gray-900 mb-2.5">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed mb-5">{description}</p>
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-500 font-medium">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
