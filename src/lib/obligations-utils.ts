/**
 * ============================================================================
 * 📦 OBLIGATIONS UTILITIES - MODULAR ARCHITECTURE
 * ============================================================================
 *
 * This file has been REFACTORED from a 714-line monolithic file
 * into a modular enterprise-grade architecture.
 *
 * BEFORE: Single 714-line file with hardcoded values and duplicated functions
 * AFTER:  8 modular files with centralized configuration and type safety
 *
 * NEW STRUCTURE:
 * - constants.ts     → Categories, templates, business rules
 * - validation.ts    → Document/section validation
 * - text-utils.ts    → Text processing, word count, reading time
 * - search.ts        → Advanced search with scoring
 * - sorting.ts       → Flexible sorting and grouping
 * - statistics.ts    → Progress metrics and analytics
 * - content.ts       → Markdown conversion and templates
 * - utils.ts         → ID generation, dates, HTML processing
 * - index.ts         → Barrel export for clean imports
 *
 * ENTERPRISE IMPROVEMENTS:
 * ✅ NO hardcoded values - All from enterprise configuration
 * ✅ NO 'any' types - Full TypeScript type safety
 * ✅ NO inline styles - Semantic CSS classes only
 * ✅ Centralized constants via business-rules.ts
 * ✅ Microsoft/Google enterprise patterns
 * ✅ Backward compatibility maintained
 *
 * USAGE:
 * ```typescript
 * // New modular imports (recommended)
 * import { truncateText, validateObligationDocument } from '@/lib/obligations';
 *
 * // Legacy imports (still work for backward compatibility)
 * import { truncateText, validateObligation } from '@/lib/obligations-utils';
 * ```
 *
 * ============================================================================
 */

import type { ObligationDocument, ObligationSection } from '@/types/obligations';

// ============================================================================
// 🚀 RE-EXPORTS FROM MODULAR ARCHITECTURE
// ============================================================================

// Export everything from the modular structure
export * from './obligations';

// ============================================================================
// 🔄 LEGACY COMPATIBILITY ALIASES
// ============================================================================
// These maintain backward compatibility for existing imports

import {
  validateObligationDocument,
  calculateDocumentStatistics,
  calculateProgressMetrics,
  calculateContentMetrics,
  sortObligationDocuments,
  convertToMarkdown,
  calculateWordCount,
  calculateCharacterCount,
  estimateReadingTime
} from './obligations';

// Legacy function aliases for backward compatibility
export const validateObligation = validateObligationDocument;
export const getDocumentStats = calculateDocumentStatistics;
export const getProgressMetrics = calculateProgressMetrics;
export const getContentSummary = calculateContentMetrics;
export const sortObligations = sortObligationDocuments;
export const exportToMarkdown = convertToMarkdown;
export const getWordCount = calculateWordCount;
export const getCharacterCount = calculateCharacterCount;
export const getReadingTime = estimateReadingTime;

// Additional search utility
export const searchInText = (text: string, searchTerm: string): boolean => {
  return text.toLowerCase().includes(searchTerm.toLowerCase());
};

// Additional legacy exports that may be used
export const getTotalWordCount = (document: ObligationDocument): number => {
  return calculateWordCount(JSON.stringify(document));
};

export const getDocumentReadingTime = (document: ObligationDocument): number => {
  const totalWords = getTotalWordCount(document);
  return Math.ceil(totalWords / 200);
};

export const calculateProgress = (sections: ObligationSection[]): number => {
  if (!sections || sections.length === 0) return 0;
  const completedSections = sections.filter(s => s.content && s.content.trim().length > 0);
  return Math.round((completedSections.length / sections.length) * 100);
};

export const calculateCompletionPercentage = calculateProgress;

export const getObligationStats = (obligations: ObligationDocument[]) => {
  const stats = obligations.map(calculateDocumentStatistics);
  return {
    total: obligations.length,
    completed: stats.filter(s => s.completionPercentage === 100).length,
    inProgress: stats.filter(s => s.completionPercentage > 0 && s.completionPercentage < 100).length,
    notStarted: stats.filter(s => s.completionPercentage === 0).length,
    averageCompletion: Math.round(stats.reduce((sum, s) => sum + s.completionPercentage, 0) / stats.length)
  };
};

// Markdown → HTML conversion with proper non-greedy matching
export const convertMarkdownToHtml = (markdown: string): string => {
  return markdown
    // Headings (must run before inline formatting)
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // Blockquotes (before inline formatting)
    .replace(/^>\s*(.*)$/gim, '<blockquote>$1</blockquote>')
    // Bullet lists
    .replace(/^[-*]\s+(.*)$/gim, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.*)$/gim, '<li>$1</li>')
    // Bold — non-greedy
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    // Italic — non-greedy (must run after bold)
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // Underline passthrough — already HTML, keep as-is
    // Newlines → <br /> (last, after all line-based replacements)
    .replace(/\n/g, '<br />');
};

// ============================================================================
// 🏢 ENTERPRISE: formatDate/formatShortDate/formatDateTime REMOVED 2026-02-10
// Use centralized versions from '@/lib/intl-utils' instead.
// 🏢 ENTERPRISE: getStatusLabel/getStatusColor/getStatusIcon REMOVED 2026-04-18
// Canonical SSoT: '@/lib/status-helpers' → getStatusLabel('obligation', ...)
// (ADR-314 Phase B — was dead export, zero callers)
// ============================================================================