import React from 'react';
import { Link } from 'react-router-dom';
import { Video, Sparkles, Search, Brain, Play, ArrowRight, Zap, Shield, Clock, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 flex items-center justify-center shadow-sm">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-[16px] tracking-tight text-gray-900">VAgent</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">功能特性</a>
          <a href="#how" className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">使用方式</a>
        </div>
        <Link
          to="/login"
          className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-xl hover:bg-gray-700 transition-colors shadow-sm"
        >
          登录
        </Link>
      </nav>

      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center py-24 px-6 text-center overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-gradient-to-b from-violet-50 to-transparent opacity-70" />
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-600 text-xs font-semibold mb-8">
            <Sparkles className="w-3.5 h-3.5" />
            集成 Gemini 3.0 · 全新升级
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]">
            <span className="text-gray-900">智能剪辑，</span>
            <br />
            <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
              事半功倍。
            </span>
          </h1>

          <p className="max-w-xl text-lg text-gray-500 mb-10 leading-relaxed">
            全能 AI 视频管理平台。自动分类、时序动作分析、精彩片段检测，
            配合 AI 创作助手，让每一次剪辑都充满灵感。
          </p>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link
              to="/login"
              className="group flex items-center gap-2 px-7 py-3.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl font-semibold text-sm transition-all shadow-md hover:shadow-lg"
            >
              免费开始使用
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#features"
              className="flex items-center gap-2 px-7 py-3.5 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-semibold text-sm text-gray-600 hover:text-gray-900 transition-all"
            >
              <Play className="w-4 h-4" />
              了解更多
            </a>
          </div>

          {/* Demo credentials hint */}
          <div className="mt-6 flex items-center gap-2 text-xs text-gray-400">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
            演示账号：admin / admin123
          </div>
        </div>

        {/* Stats */}
        <div className="relative z-10 flex items-center gap-12 mt-20 pt-12 border-t border-gray-100 w-full max-w-xl justify-center">
          {[
            { value: '10x', label: '剪辑效率提升' },
            { value: '98%', label: '分析准确率' },
            { value: '秒级', label: '智能响应速度' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-extrabold text-gray-900">{value}</div>
              <div className="text-xs text-gray-400 mt-1 font-medium">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">三大核心能力</h2>
            <p className="text-gray-500">AI 驱动的全链路视频创作管理</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Brain className="w-5 h-5 text-violet-600" />}
              iconBg="bg-violet-50"
              title="智能视频分类"
              description="AI 自动识别视频内容，精准生成分类标签。支持旅行、Vlog、科技、美食等多种品类，轻松管理海量视频资产。"
              tags={['自动标签', '语义检索', '多维分类']}
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
              icon={<Sparkles className="w-5 h-5 text-fuchsia-600" />}
              iconBg="bg-fuchsia-50"
              title="AI 创作助手"
              description="基于视频分析结果，自动生成标题、文案、剪辑方案。支持多视频联合分析，为系列创作提供整体策略。"
              tags={['标题生成', '文案撰写', '剪辑方案']}
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">三步开始创作</h2>
            <p className="text-gray-500">从上传到发布，全程 AI 加速</p>
          </div>

          <div className="space-y-4">
            {[
              { step: '01', icon: <Video className="w-5 h-5 text-violet-600" />, title: '上传视频', desc: '支持 MP4、MOV、AVI 等主流格式，本地批量上传，AI 智能自动命名分类' },
              { step: '02', icon: <Zap className="w-5 h-5 text-amber-500" />, title: 'AI 智能分析', desc: '一键触发 AI 分析，自动完成场景识别、动作检测、精彩片段标注，全程无需干预' },
              { step: '03', icon: <Sparkles className="w-5 h-5 text-violet-600" />, title: '创作与发布', desc: '基于分析结果，AI 助手提供个性化标题、文案、剪辑方案，创作效率提升 10 倍' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} className="flex gap-5 p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                  {icon}
                </div>
                <div>
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="text-[11px] font-bold text-violet-500 tracking-widest uppercase">{step}</span>
                    <h3 className="font-bold text-gray-900">{title}</h3>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 bg-gray-50 text-center">
        <div className="max-w-xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-semibold mb-8">
            <Shield className="w-3.5 h-3.5" />
            数据安全 · 隐私保护
          </div>
          <h2 className="text-4xl font-extrabold text-gray-900 mb-5">
            开启您的
            <span className="bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent"> 智能创作 </span>
            之旅
          </h2>
          <p className="text-gray-500 mb-10 leading-relaxed">
            立即登录，免费体验完整功能。无需信用卡，无需复杂配置。
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-gray-900 hover:bg-gray-700 text-white rounded-xl font-semibold transition-all shadow-md hover:shadow-lg"
          >
            立即免费开始
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-5 text-xs text-gray-400">
            演示账号：admin / admin123 &nbsp;·&nbsp; demo / demo123
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
            <span className="text-sm font-bold text-gray-900">VAgent</span>
          </div>
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            © 2024 VAgent · AI 智能视频剪辑平台
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
