
# VAgent · AI 智能视频剪辑平台

全能 AI 视频管理平台，集智能分类、时序分析、精彩片段检测、AI 创作助手于一体。

## 项目结构

```
VAgent/
├── backend/          # Node.js + Express + TypeScript 后端
│   ├── src/
│   │   ├── routes/   # API 路由 (auth, videos, ai)
│   │   ├── data/     # 内存数据存储
│   │   ├── middleware/  # JWT 认证中间件
│   │   └── types/    # TypeScript 类型定义
│   └── uploads/      # 上传的视频文件
└── frontend/         # React + TypeScript + Vite + Tailwind 前端
    └── src/
        ├── pages/    # 页面 (Landing, Login, App)
        ├── components/  # 组件 (VideoLibrary, VideoDetail, AIAssistant)
        ├── contexts/  # React Context (Auth)
        └── api/      # API 客户端
```

## 快速启动

### 1. 启动后端

```bash
cd backend
npm install
npm run dev
# 后端运行在 http://localhost:3001
```

### 2. 启动前端

```bash
cd frontend
npm install
npm run dev
# 前端运行在 http://localhost:5173
```

## 演示账号

| 用户名 | 密码     |
|--------|----------|
| admin  | admin123 |
| demo   | demo123  |

## 功能特性

### 第一列 - 视频库管理
- 上传本地视频（支持 MP4、MOV、AVI 等格式）
- AI 自动识别视频分类和标签
- 按日期/分类/名称排序
- 按分类筛选视频
- 搜索视频（名称/标签/分类）
- 单选/多选视频进行分析
- 一键分析全部待分析视频
- 分析中显示 Loading 状态
- 删除视频

### 第二列 - 视频分析详情
- 视频播放器（支持上传的真实视频）
- 彩色时序分析时间轴
- 精彩片段红色标注
- 可拖拽时间轴跳转
- 点击片段查看详细描述
- 视频概要、情感基调、节奏感评分

### 第三列 - AI 创作助手
- 智能问答（标题、文案、剪辑思路、标签）
- 快捷提问按钮
- 消息复制功能
- 多视频联合分析（弹窗选择多个视频）
- AI 基于视频分析数据生成内容

## API 接口

- `POST /api/auth/login` - 用户登录
- `GET /api/auth/me` - 获取当前用户信息
- `GET /api/videos` - 获取视频列表
- `POST /api/videos/upload` - 上传视频
- `POST /api/videos/analyze` - 分析视频（单个/批量）
- `DELETE /api/videos/:id` - 删除视频
- `POST /api/ai/chat` - AI 聊天
- `POST /api/ai/multi-analysis` - 多视频分析
