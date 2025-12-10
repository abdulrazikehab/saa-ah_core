import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  tenantId: string;
  user: {
    sub(tenantId: string, sub: any): unknown;
    id: string;
    tenantId: string;
    role: string;
    email: string;
  };
  tenantDetectedFrom?: string;
}