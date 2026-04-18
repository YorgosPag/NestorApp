/**
 * =============================================================================
 * 🏢 ENTERPRISE FILE DISPLAY NAME — I18N INFRASTRUCTURE
 * =============================================================================
 *
 * Server-safe i18n integration for file display name labels.
 *
 * CRITICAL: i18n uses react-i18next which calls React.createContext().
 * This breaks API routes (Telegram webhook, etc.) during Vercel build.
 * Solution: Lazy/conditional imports with server-safe fallbacks.
 *
 * @module upload/utils/file-display-name-i18n
 * @enterprise ADR-031 - Canonical File Storage System
 * @enterprise ADR-314 Phase C.5.7 — SRP split from file-display-name.ts
 *
 * SSoT NOTE: `getFileCategoryLabel` is semantically distinct from the SSoT
 * `getCategoryLabel` in `@/lib/intl-domain` (building categories). This
 * module handles FILE categories via the `files:` i18n namespace.
 */

import type { Language, Namespace } from '@/i18n/lazy-config';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('FileDisplayNameI18n');

// Lazy-loaded i18n instance (client-side only)
let i18nInstance: typeof import('i18next').default | null = null;
let loadNamespaceFunc: LoadNamespace | null = null;

/**
 * 🏢 ENTERPRISE: Check if we're in server/build context (no React available)
 */
function isServerContext(): boolean {
  // During Vercel build, React is not available in API routes
  return typeof window === 'undefined';
}

/**
 * 🏢 ENTERPRISE: Lazy load i18n only when needed (client-side)
 */
async function getI18nInstance(): Promise<typeof import('i18next').default | null> {
  // Server context: skip i18n (use fallbacks)
  if (isServerContext()) {
    return null;
  }

  // Already loaded
  if (i18nInstance) {
    return i18nInstance;
  }

  // Dynamic import (client-side only)
  try {
    const i18nModule = await import('@/i18n/config');
    i18nInstance = i18nModule.default;
    return i18nInstance;
  } catch {
    logger.warn('i18n not available, using fallbacks');
    return null;
  }
}

/**
 * 🏢 ENTERPRISE: Lazy load loadNamespace function
 */
type LoadNamespace = (namespace: Namespace, language?: Language) => Promise<void>;

async function getLoadNamespaceFunc(): Promise<LoadNamespace | null> {
  if (isServerContext()) {
    return null;
  }

  if (loadNamespaceFunc) {
    return loadNamespaceFunc;
  }

  try {
    const lazyConfig = await import('@/i18n/lazy-config');
    loadNamespaceFunc = lazyConfig.loadNamespace;
    return loadNamespaceFunc;
  } catch {
    return null;
  }
}

/**
 * 🏢 ENTERPRISE: Ensure 'files' namespace is loaded
 * This should be called at app startup or before first use
 * NOTE: No-op in server context (safe for API routes)
 */
export async function ensureFilesNamespaceLoaded(): Promise<void> {
  const loadNs = await getLoadNamespaceFunc();
  if (!loadNs) {
    return; // Server context or i18n not available
  }

  // Pre-warm the lazy i18n instance so subsequent synchronous t() calls work
  await getI18nInstance();

  // 🏢 ENTERPRISE: Load BOTH languages to ensure translations are available
  // regardless of current UI language during upload
  await Promise.all([
    loadNs('files', 'el'),
    loadNs('files', 'en'),
  ]);
}

/**
 * Get translation from files namespace with fallback
 * 🏢 ENTERPRISE: Server-safe - returns fallback in server context
 *
 * @param key - Translation key (e.g., "categories.photos")
 * @param fallback - Fallback value if translation not found
 * @param language - Language code ('el' or 'en'). Defaults to 'el' for storage consistency
 */
function getFileTranslation(key: string, fallback: string, language: 'el' | 'en' = 'el'): string {
  // Server context: use fallback (no i18n available)
  if (isServerContext() || !i18nInstance) {
    return fallback;
  }

  // 🏢 ENTERPRISE: Always use Greek ('el') for stored displayNames to ensure consistency
  // Runtime translation happens in UI via useFileDisplayName hook
  const result = i18nInstance.t(`files:${key}`, { defaultValue: fallback, lng: language });
  return typeof result === 'string' ? result : fallback;
}

// ============================================================================
// I18N LABEL GETTERS (using canonical i18n system)
// ============================================================================

/**
 * Get label for domain from i18n (files:domains.{domain})
 */
export function getDomainLabel(domain: string, language: 'el' | 'en' = 'el'): string {
  return getFileTranslation(`domains.${domain}`, domain, language);
}

/**
 * Get label for file category from i18n (files:categories.{category})
 *
 * SSoT NOTE: Distinct from `getCategoryLabel` in `@/lib/intl-domain` which
 * handles BUILDING categories (residential/commercial/mixed/industrial).
 * This handles FILE categories (photos/floorplans/contracts/invoices) via
 * the `files:` i18n namespace.
 */
export function getFileCategoryLabel(category: string, language: 'el' | 'en' = 'el'): string {
  return getFileTranslation(`categories.${category}`, category, language);
}

/**
 * Get label for entity type from i18n (files:entityTypes.{entityType})
 */
export function getEntityTypeLabel(entityType: string, language: 'el' | 'en' = 'el'): string {
  return getFileTranslation(`entityTypes.${entityType}`, entityType, language);
}

/**
 * Get label for purpose from i18n (files:purposes.{purpose})
 */
export function getPurposeLabel(purpose: string, language: 'el' | 'en' = 'el'): string {
  return getFileTranslation(`purposes.${purpose}`, purpose, language);
}
