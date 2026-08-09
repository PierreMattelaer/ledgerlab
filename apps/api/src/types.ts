export type Role = 'employee' | 'manager' | 'admin';

export interface AuthUser {
  id: number;
  organizationId: number;
  role: Role;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
