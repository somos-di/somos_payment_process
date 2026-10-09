import type { User } from '@supabase/supabase-js';
import { z } from 'zod';
import type { AccountFlags, AuthenticatedUser } from '../types/auth.js';

export const ANALYTICS_METADATA_KEY = 'somos_analytics';

const analyticsMetadataSchema = z.object({
  somente_relatorios: z.boolean().optional(),
  trocar_senha: z.boolean().optional(),
}).passthrough();

function analyticsMetadata(appMetadata: unknown): Record<string, unknown> {
  if (!appMetadata || typeof appMetadata !== 'object') return {};
  const value = (appMetadata as Record<string, unknown>)[ANALYTICS_METADATA_KEY];
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export function accountFlags(appMetadata: unknown): AccountFlags {
  const parsed = analyticsMetadataSchema.safeParse(analyticsMetadata(appMetadata));
  const reportViewer = parsed.success && parsed.data.somente_relatorios === true;
  return { reportViewer, mustChangePassword: reportViewer && parsed.success && parsed.data.trocar_senha === true };
}

export function withPasswordChanged(appMetadata: unknown): Record<string, unknown> {
  const current = appMetadata && typeof appMetadata === 'object' ? appMetadata as Record<string, unknown> : {};
  return { ...current, [ANALYTICS_METADATA_KEY]: { ...analyticsMetadata(appMetadata), trocar_senha: false } };
}

export function toAuthenticatedUser(user: Pick<User, 'id' | 'email' | 'app_metadata'>): AuthenticatedUser {
  return { id: user.id, email: user.email || '', ...accountFlags(user.app_metadata) };
}
