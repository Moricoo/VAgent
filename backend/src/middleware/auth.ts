import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = 'vagent_secret_key_2024';

export interface AuthRequest extends Request {
  userId?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  // Support token via Authorization header OR query param (needed for EventSource/SSE)
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token as string | undefined;

  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.substring(7)
    : queryToken;

  if (!token) {
    res.status(401).json({ message: '未授权，请先登录' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ message: 'Token 无效或已过期，请重新登录' });
  }
}
