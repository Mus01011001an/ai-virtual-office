// src/auth/rbac.type.ts
import type { Request } from 'express';
import type { UserSession } from '@thallesp/nestjs-better-auth';

/**
 * Bentuk user yang Better Auth expose di session.user
 * Sesuaikan fields jika provider-mu punya field lain.
 */
export type SessionUserShape = UserSession & {
  roleId?: string | null;
  role?: {
    id?: string;
    name?: string;
    [key: string]: any;
  } | null;
};

/**
 * Request yang kita pakai di guard/controller
 * Perhatikan: session di sini adalah objek session, yang punya property `user`.
 */
export interface AuthRequest extends Request {
  session?: {
    user?: SessionUserShape | null;
    // kalau ada field session lainnya (token, expiresAt), tambahkan di sini
    [key: string]: any;
  } | null;
  user?: UserSession['user'];
}
