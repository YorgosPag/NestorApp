import { ObligationDocument, ObligationSection, SectionCategory } from '@/types/obligations';
import { getDefaultTemplate } from './constants';
import { formatDate } from '@/lib/intl-utils';

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
// 🎯 ID GENERATION
// ============================================================================

/**
 * ✅ ENTERPRISE: Centralized ID generation utility
 * Replaces scattered Math.random().toString(36).slice() patterns
 */
export const generateRandomId = (prefix: string = 'id', length: number = 9): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 2 + length)}`;

export const generateSectionId = (): string => generateRandomId('section', 9);
export const generateArticleId = (): string => generateRandomId('article', 9);
export const generateParagraphId = (): string => generateRandomId('paragraph', 9);
export const generateObligationId = (): string => generateRandomId('obligation', 9);

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
    ? `_${new Date().toISOString().slice(0, 19).replace(/[:\-]/g, '')}`
    : '';

  return `${baseFileName}${timeString}.${extension}`;
};

// ============================================================================
// 📅 DATE UTILITIES
// ============================================================================

export const getRelativeTime = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Τώρα';
  if (diffMinutes < 60) return `${diffMinutes} λεπτά πριν`;
  if (diffHours < 24) return `${diffHours} ώρα${diffHours > 1 ? 'ες' : ''} πριν`;
  if (diffDays < 7) return `${diffDays} μέρα${diffDays > 1 ? 'ες' : ''} πριν`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `${weeks} εβδομάδα${weeks > 1 ? 'ες' : ''} πριν`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `${months} μήνα${months > 1 ? 'ες' : ''} πριν`;
  }

  const years = Math.floor(diffDays / 365);
  return `${years} χρόνο${years > 1 ? 'ια' : ''} πριν`;
};

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
  // ✅ ENTERPRISE MIGRATION: Delegating to production-ready HTML sanitizer
  // Using enterprise implementation for proper security validation
  try {
    const { sanitizeHtml: enterpriseSanitizer } = require('@/app/obligations/[id]/view/utils/html-sanitize');
    return enterpriseSanitizer(html);
  } catch (error) {
    console.warn('Enterprise sanitizer not available, using fallback');
    return html.replace(/<script[^>]*>.*?<\/script>/gi, '').trim();
  }
};

export const convertMarkdownToHtml = (markdown: string): string => {
  let html = markdown;

  // Handle headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Handle bold text
  html = html.replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>');

  // Handle italic text
  html = html.replace(/\*(.*)\*/gim, '<em>$1</em>');

  // Handle unordered lists
  html = html.replace(/^\* (.+)/gim, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

  // Handle numbered lists
  let inNumberedList = false;
  const processedNumberedLines: string[] = [];

  html.split('\n').forEach(line => {
    const isNumberedLine = /^\d+\. /.test(line);

    if (isNumberedLine && !inNumberedList) {
      processedNumberedLines.push('<ol>');
      processedNumberedLines.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
      inNumberedList = true;
    } else if (isNumberedLine && inNumberedList) {
      processedNumberedLines.push(`<li>${line.replace(/^\d+\. /, '')}</li>`);
    } else if (!isNumberedLine && inNumberedList) {
      processedNumberedLines.push('</ol>');
      processedNumberedLines.push(line);
      inNumberedList = false;
    } else {
      processedNumberedLines.push(line);
    }
  });

  if (inNumberedList) {
    processedNumberedLines.push('</ol>');
  }

  html = processedNumberedLines.join('\n');

  // Handle paragraphs
  html = html.replace(/\n\n/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap in paragraph tags if needed
  if (!html.startsWith('<p>') && !html.startsWith('<ul>') && !html.startsWith('<ol>') && !html.startsWith('<h')) {
    html = `<p>${html}</p>`;
  }

  // Fix paragraph tags
  html = html.replace(/<\/p><p>/g, '</p>\n<p>');

  return html;
};

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