import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import authRoutes from './routes/auth';
import videoRoutes from './routes/videos';
import aiRoutes from './routes/ai';
import youtubeRoutes from './routes/youtube';

const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/youtube', youtubeRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'VAgent后端服务正常运行' });
});

app.listen(PORT, () => {
  console.log(`✅ VAgent 后端服务启动成功: http://localhost:${PORT}`);
  console.log(`📁 文件服务地址: http://localhost:${PORT}/uploads`);
  console.log(`\n演示账号:`);
  console.log(`  用户名: admin  密码: admin123`);
  console.log(`  用户名: demo   密码: demo123`);
});

export default app;
