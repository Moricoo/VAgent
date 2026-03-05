import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByCredentials } from '../data/store';
import { JWT_SECRET, authMiddleware, AuthRequest } from '../middleware/auth';
import { findUserById } from '../data/store';

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: '用户名和密码不能为空' });
    return;
  }

  const user = findUserByCredentials(username, password);
  if (!user) {
    res.status(401).json({ message: '用户名或密码错误' });
    return;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
    },
  });
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  const user = findUserById(req.userId!);
  if (!user) {
    res.status(404).json({ message: '用户不存在' });
    return;
  }
  res.json({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
  });
});

export default router;
