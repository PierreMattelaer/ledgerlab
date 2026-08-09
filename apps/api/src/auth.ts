import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { AuthUser, Role } from './types';

const secret = process.env.JWT_SECRET || 'ledgerlab-demo-secret';

export function signToken(user: AuthUser) {
  return jwt.sign(user, secret, { expiresIn: '8h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('authorization');
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.user = jwt.verify(header.slice(7), secret) as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}
