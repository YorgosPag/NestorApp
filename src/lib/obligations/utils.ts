import { ObligationSection, SectionCategory } from '@/types/obligations';
import { getDefaultTemplate } from './constants';
import { formatDate, formatRelativeTime } from '@/lib/intl-utils';
import { generateSectionId } from '@/services/enterprise-id-convenience';
import { nowISO } from '@/lib/date-local';

/**
 * ============================================================================
 * 🛠️ OBLIGATIONS UTILITY FUNCTIONS
 * ============================================================================
 *
 * General utility functions for obligations management:
 * - ID generation
 * - File naming
 * - Title generation
 * - Date formatting
 * - HTML processing
 * - Template application
 *
 * ============================================================================
 */

// ============================================================================
// 📝 TITLE & FILE GENERATION
// ============================================================================

export const generateObligationTitle = (
  projectName: string,
  contractorCompany: string,
  creationDate: Date = new Date()
): string => {
  const formattedDate = formatDate(creationDate);
  return `Συμβατικές Υποχρεώσεις - ${projectName} - ${contractorCompany} (${formattedDate})`;
};

export const generateFileName = (
  title: string,
  extension: string = 'pdf',
  timestamp: boolean = true
): string => {
  const baseFileName = title
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const timeString = timestamp
    ? `_${nowISO().slice(0, 19).replace(/[:\-]/g, '')}`
    : '';

  return `${baseFileName}${timeString}.${extension}`;
};

// ============================================================================
// 📅 DATE UTILITIES
// ============================================================================

// ADR-213 Phase 10: Delegates to centralized formatRelativeTime (Intl-based, locale-aware)
export const getRelativeTime = (date: Date): string => formatRelativeTime(date);

export const formatGreekDate = (date: Date): string => {
  return formatDate(date, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// ============================================================================
// 🧹 HTML PROCESSING
// ============================================================================

export const stripHtmlTags = (html: string): string =>
  html.replace(/<[^>]*>/g, '').trim();

export const sanitizeHtml = (html: string): string => {
  // ✅ BASIC HTML SANITIZATION: Removing dangerous scripts and tags
  // For enterprise-grade sanitization, consider using DOMPurify or similar library
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

// convertMarkdownToHtml removed — use @/lib/obligations-utils (SSoT, non-greedy impl, ADR-314)

// ============================================================================
// 📋 TEMPLATE APPLICATION
// ============================================================================

export const applyTemplate = (
  section: Partial<ObligationSection>,
  category: SectionCategory
): ObligationSection => {
  const template = getDefaultTemplate(category);

  return {
    id: section.id || generateSectionId(),
    number: section.number || '1',
    title: section.title || template.title,
    content: section.content || template.content,
    articles: section.articles || [],
    isRequired: section.isRequired ?? true,
    category: category,
    order: section.order ?? 1,
    isExpanded: section.isExpanded ?? false
  };
};

export const generateSectionFromTemplate = (
  category: SectionCategory,
  number: string,
  order: number
): ObligationSection => {
  const template = getDefaultTemplate(category);

  return applyTemplate({
    number,
    order,
    isRequired: true
  }, category);
};

// ============================================================================
// 🔧 VALIDATION HELPERS
// ============================================================================

export const isValidId = (id: string): boolean => {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9\-_]+$/.test(id);
};

export const normalizeId = (id: string): string => {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
};