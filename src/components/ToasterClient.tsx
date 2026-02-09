'use client';

import { Toaster } from 'react-hot-toast';

/**
 * Client-only wrapper for react-hot-toast Toaster
 * Prevents SSR issues in Vercel deployments
 */
export function ToasterClient() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        className: 'toast-popover',
      }}
    />
  );
}
