/**
 * =============================================================================
 * Domain-Category File Grouping — Central utility (ADR-031)
 * =============================================================================
 *
 * Groups files by `domain + category` composite key for organized list views.
 * Used by contacts and any entity tab that enables `fetchAllDomains` with
 * `listGroupingMode="domainCategory"`.
 *
 * Pure logic — zero UI dependencies, zero i18n dependencies.
 *
 * @module components/shared/files/utils/domain-category-grouping
 * @enterprise ADR-031
 */

import { FILE_DOMAINS, FILE_CATEGORIES } from '@/config/domain-constants';
import type { FileDomain, FileCategory } from '@/config/domain-constants';

// ============================================================================
// TYPES
// ============================================================================

export interface DomainCategoryGroup<T> {
  /** Composite key, e.g. "legal:contracts" */
  readonly key: string;
  readonly domain: string;
  readonly category: string;
  readonly files: T[];
}

// ============================================================================
// SORT ORDER (domain-first, then category)
// ============================================================================

const DOMAIN_ORDER: Readonly<Record<string, number>> = {
  [FILE_DOMAINS.ADMIN]: 1,
  [FILE_DOMAINS.CONSTRUCTION]: 2,
  [FILE_DOMAINS.SALES]: 3,
  [FILE_DOMAINS.ACCOUNTING]: 4,
  [FILE_DOMAINS.LEGAL]: 5,
  [FILE_DOMAINS.BROKERAGE]: 6,
  [FILE_DOMAINS.FINANCIAL]: 7,
  [FILE_DOMAINS.INGESTION]: 8,
};

const CATEGORY_ORDER: Readonly<Record<string, number>> = {
  [FILE_CATEGORIES.DOCUMENTS]: 1,
  [FILE_CATEGORIES.CONTRACTS]: 2,
  [FILE_CATEGORIES.INVOICES]: 3,
  [FILE_CATEGORIES.PERMITS]: 4,
  [FILE_CATEGORIES.DRAWINGS]: 5,
  [FILE_CATEGORIES.PHOTOS]: 6,
  [FILE_CATEGORIES.FLOORPLANS]: 7,
  [FILE_CATEGORIES.AUDIO]: 8,
  [FILE_CATEGORIES.VIDEOS]: 9,
};

// ============================================================================
// HELPERS
// ============================================================================

function getDomainOrder(domain: string): number {
  return DOMAIN_ORDER[domain] ?? 99;
}

function getCategoryOrder(category: string): number {
  return CATEGORY_ORDER[category] ?? 99;
}

export function buildDomainCategoryKey(domain: string, category: string): string {
  return `${domain}:${category}`;
}

// ============================================================================
// MAIN GROUPING FUNCTION
// ============================================================================

/**
 * Groups files by `domain + category` and returns sorted sections.
 * Empty groups are omitted. Files without domain/category go to a fallback group.
 */
export function groupFilesByDomainCategory<
  T extends { domain?: FileDomain | string; category?: FileCategory | string },
>(files: readonly T[]): DomainCategoryGroup<T>[] {
  const buckets = new Map<string, { domain: string; category: string; files: T[] }>();

  for (const file of files) {
    const domain = file.domain || 'other';
    const category = file.category || 'other';
    const key = buildDomainCategoryKey(domain, category);

    const bucket = buckets.get(key);
    if (bucket) {
      bucket.files.push(file);
    } else {
      buckets.set(key, { domain, category, files: [file] });
    }
  }

  const groups: DomainCategoryGroup<T>[] = Array.from(buckets.entries()).map(
    ([key, { domain, category, files: groupFiles }]) => ({
      key,
      domain,
      category,
      files: groupFiles,
    }),
  );

  groups.sort((a, b) => {
    const domainDiff = getDomainOrder(a.domain) - getDomainOrder(b.domain);
    if (domainDiff !== 0) return domainDiff;
    return getCategoryOrder(a.category) - getCategoryOrder(b.category);
  });

  return groups;
}
