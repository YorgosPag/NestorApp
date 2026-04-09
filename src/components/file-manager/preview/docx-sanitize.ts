/**
 * =============================================================================
 * DOCX HTML Sanitization — Centralized DOMPurify policy for document preview
 * =============================================================================
 *
 * Sanitizes HTML output from mammoth (DOCX → HTML) before rendering.
 * Reuses the project's existing DOMPurify dependency with a document-specific
 * allowlist. Based on the pattern from `src/lib/message-utils.ts`.
 *
 * @module components/file-manager/preview/docx-sanitize
 * @enterprise ADR-031
 */

import DOMPurify from 'dompurify';

const DOCX_ALLOWED_TAGS = [
  // Structure
  'div', 'span', 'p', 'br', 'hr', 'section', 'article',
  // Text formatting
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'sup', 'sub',
  // Code
  'code', 'pre',
  // Lists
  'ul', 'ol', 'li',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Tables
  'table', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot', 'caption', 'colgroup', 'col',
  // Images (mammoth can embed images)
  'img',
  // Block quotes / figures
  'blockquote', 'figure', 'figcaption',
] as const;

const DOCX_ALLOWED_ATTR = [
  // Links
  'href', 'title', 'target',
  // Images
  'src', 'alt', 'width', 'height',
  // Tables
  'colspan', 'rowspan', 'align', 'valign',
  // Global
  'class',
] as const;

/**
 * Sanitizes HTML produced by mammoth DOCX converter.
 * Strips scripts, event handlers, data attributes, and unknown protocols.
 */
export function sanitizeDocxHTML(html: string): string {
  if (!html) return '';

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...DOCX_ALLOWED_TAGS],
    ALLOWED_ATTR: [...DOCX_ALLOWED_ATTR],
    KEEP_CONTENT: true,
    ALLOW_DATA_ATTR: false,
    ALLOW_UNKNOWN_PROTOCOLS: false,
    SAFE_FOR_TEMPLATES: true,
  });
}
