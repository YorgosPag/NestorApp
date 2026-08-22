/**
 * =============================================================================
 * 🏢 ENTERPRISE: File Manager Page
 * =============================================================================
 *
 * Route entry point για το Central File Manager (/files).
 * Χρησιμοποιεί lazy loading για performance optimization.
 *
 * @route /files
 * @enterprise ADR-031 - Canonical File Storage System
 */

'use client';

import { LazyRoutes } from '@/utils/lazyRoutes';

/**
 * File Manager page component
 *
 * Uses lazy loading to reduce initial bundle size.
 * Protected by authentication via middleware.
 */
export default function FileManagerPage() {
  const FileManager = LazyRoutes.FileManager;
  return <FileManager />;
}
