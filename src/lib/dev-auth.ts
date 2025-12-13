// Development authentication utilities
// This file provides development-only authentication helpers

export const DEV_MODE = process.env.NODE_ENV === 'development';

export function getDevUser() {
  if (!DEV_MODE) return null;

  return {
    uid: 'dev-user',
    email: 'dev@example.com',
    displayName: 'Development User'
  };
}

export function isDevelopment() {
  return DEV_MODE;
}