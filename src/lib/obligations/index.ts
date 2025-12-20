/**
 * ============================================================================
 * 📦 OBLIGATIONS UTILITY LIBRARY - BARREL EXPORT
 * ============================================================================
 *
 * Enterprise-grade modular structure replacing monolithic obligations-utils.ts
 * Single import point για όλες τις obligations utilities
 *
 * Usage:
 * ```typescript
 * import { truncateText, validateObligationDocument, searchInDocument } from '@/lib/obligations';
 * ```
 *
 * Architecture:
 * - Modular structure: Each concern in separate file
 * - Type-safe exports: Full TypeScript support
 * - Centralized constants: No hardcoded values
 * - Enterprise patterns: Microsoft/Google standards
 *
 * ============================================================================
 */

// ===== CONSTANTS & CONFIGURATION =====
export {
  SECTION_CATEGORIES,
  QUALITY_THRESHOLD,
  PROGRESS_THRESHOLDS,
  DEFAULT_SECTION_TEMPLATES,
  getCategoryLabel,
  getCategoryColor,
  getCategoryIcon,
  getCategoryDescription,
  getDefaultTemplate
} from './constants';

// ===== VALIDATION FUNCTIONS =====
export {
  validateObligationDocument,
  validateSection,
  validateArticle,
  validateParagraph,
  isValidSectionOrder,
  hasValidRequiredSections,
  type ValidationResult
} from './validation';

// ===== TEXT UTILITIES =====
export {
  truncateText,
  highlightSearchTerm,
  extractPlainTextFromHtml,
  formatWordCount,
  calculateWordCount,
  calculateCharacterCount,
  estimateReadingTime,
  formatReadingTime,
  generateExcerpt,
  cleanWhitespace
} from './text-utils';

// ===== SEARCH FUNCTIONALITY =====
export {
  searchObligationDocuments,
  searchInDocument,
  searchInSection,
  searchInArticle,
  type SearchOptions,
  type SearchResult,
  type SearchMatch
} from './search';

// ===== SORTING UTILITIES =====
export {
  sortObligationDocuments,
  sortSections,
  sortArticles,
  groupDocumentsByStatus,
  groupDocumentsByProject,
  type SortField,
  type SortOrder,
  type SortOptions
} from './sorting';

// ===== STATISTICS & METRICS =====
export {
  calculateDocumentStatistics,
  calculateProgressMetrics,
  calculateContentMetrics,
  type DocumentStatistics,
  type ProgressMetrics,
  type ContentMetrics
} from './statistics';

// ===== CONTENT MANAGEMENT =====
export {
  convertToMarkdown,
  generateTemplateContent,
  generateSectionNumber,
  generateArticleNumber,
  validateMarkdownContent
} from './content';

// ===== UTILITY FUNCTIONS =====
export {
  generateRandomId,  // ✅ NEW: Centralized ID generation
  generateSectionId,
  generateArticleId,
  generateParagraphId,
  generateObligationId,
  generateObligationTitle,
  generateFileName,
  getRelativeTime,
  formatGreekDate,
  stripHtmlTags,
  sanitizeHtml,
  convertMarkdownToHtml,
  applyTemplate,
  generateSectionFromTemplate,
  isValidId,
  normalizeId
} from './utils';

// ===== LEGACY COMPATIBILITY EXPORTS =====
// Αυτά τα exports διατηρούν backward compatibility με τα existing imports

// Re-export συχνά χρησιμοποιούμενων functions με τα παλιά ονόματα
export { truncateText as truncateObligationText } from './text-utils';
export { validateObligationDocument as validateDocument } from './validation';
export { calculateDocumentStatistics as getDocumentStats } from './statistics';
export { convertToMarkdown as exportToMarkdown } from './content';