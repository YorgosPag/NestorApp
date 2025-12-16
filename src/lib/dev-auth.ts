// Development authentication utilities
// This file provides development-only authentication helpers

export const DEV_MODE = process.env.NODE_ENV === 'development';

export function getDevUser() {
  if (!DEV_MODE) return null;

  return {
    uid: process.env.NEXT_PUBLIC_DEV_USER_ID || 'dev-user',
    email: process.env.NEXT_PUBLIC_DEV_USER_EMAIL ||
           process.env.NEXT_PUBLIC_FALLBACK_DEV_EMAIL ||
           `dev@${process.env.NEXT_PUBLIC_TENANT_DOMAIN || 'company.local'}`,
    displayName: process.env.NEXT_PUBLIC_DEV_USER_NAME ||
                 process.env.NEXT_PUBLIC_TENANT_NAME ||
                 'Development User'
  };
}

export function isDevelopment() {
  return DEV_MODE;
}