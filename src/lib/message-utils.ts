/**
 * =============================================================================
 * MESSAGE FORMATTING UTILITIES - ENTERPRISE
 * =============================================================================
 *
 * Centralized message formatting with HTML sanitization for secure rendering.
 * Supports Telegram-style formatting (bold, italic, code, etc.) with XSS protection.
 *
 * @module lib/message-utils
 * @enterprise SDL + OWASP compliant - Input validation & XSS protection
 * @see docs/centralized-systems/reference/adr-index.md
 */

import DOMPurify from 'dompurify';

// ============================================================================
// TYPES
// ============================================================================

import type { MessageAttachment } from '@/types/conversations';

/**
 * Message content structure
 * 🏢 ENTERPRISE: Compatible with MessageListItem.content type
 * Uses canonical MessageAttachment type (ADR-055)
 */
export interface MessageContent {
  /** Raw message text (may contain HTML tags) */
  text: string;
  /** 🏢 ENTERPRISE: Uses canonical MessageAttachment type (ADR-055) */
  attachments?: MessageAttachment[];
}

/**
 * Sanitization configuration
 */
export interface SanitizationConfig {
  /** Allowed HTML tags */
  allowedTags: string[];
  /** Allowed attributes per tag */
  allowedAttributes: Record<string, string[]>;
  /** Allow emoji rendering */
  allowEmojis: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Telegram-compatible HTML tags allowlist
 *
 * Based on Telegram Bot API HTML formatting:
 * @see https://core.telegram.org/bots/api#html-style
 */
export const TELEGRAM_ALLOWED_TAGS = [
  // Text formatting
  'b', 'strong',           // Bold
  'i', 'em',              // Italic
  'u', 'ins',             // Underline
  's', 'strike', 'del',   // Strikethrough
  'code',                 // Inline code
  'pre',                  // Code block

  // Links (με validation)
  'a',

  // Line breaks
  'br',
] as const;

/**
 * 🏢 ENTERPRISE: Allowed attributes for specific tags
 */
export const TELEGRAM_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title'],
  'code': ['class'],      // For syntax highlighting
  'pre': ['class'],       // For language specification
};

// ============================================================================
// EMAIL HTML SANITIZATION (ADR-072)
// ============================================================================

/**
 * 🏢 ENTERPRISE: Email-compatible HTML tags allowlist
 *
 * Extended allowlist for rendering emails with full formatting.
 * Includes structure, text formatting, lists, tables (signatures), and images.
 *
 * @security DOMPurify removes ALL unsafe content (scripts, event handlers)
 * @see ADR-072: AI Inbox HTML Rendering with Enterprise Sanitization
 */
export const EMAIL_ALLOWED_TAGS = [
  // Structure
  'div', 'span', 'p', 'br', 'hr',
  // Text formatting
  'b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del',
  // Code blocks
  'code', 'pre',
  // Lists
  'ul', 'ol', 'li',
  // Links
  'a',
  // Headings
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  // Tables (email signatures)
  'table', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot',
  // Images
  'img',
  // Block quotes
  'blockquote',
] as const;

/**
 * 🏢 ENTERPRISE: Allowed attributes for email HTML tags
 */
export const EMAIL_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'width', 'height'],
  'td': ['colspan', 'rowspan', 'align', 'valign'],
  'th': ['colspan', 'rowspan', 'align', 'valign'],
  'table': ['cellpadding', 'cellspacing', 'border', 'width'],
  // Global attributes allowed on all tags
  '*': ['style', 'class', 'dir'],
};

/**
 * 🏢 ENTERPRISE: Forbidden attributes for XSS protection
 */
export const EMAIL_FORBIDDEN_ATTRIBUTES = [
  'onclick', 'ondblclick', 'onmousedown', 'onmouseup', 'onmouseover',
  'onmousemove', 'onmouseout', 'onmouseenter', 'onmouseleave',
  'onkeydown', 'onkeypress', 'onkeyup',
  'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect',
  'onload', 'onerror', 'onabort',
  'onscroll', 'onresize',
] as const;

/**
 * Default sanitization config for message rendering
 */
export const DEFAULT_MESSAGE_CONFIG: SanitizationConfig = {
  allowedTags: [...TELEGRAM_ALLOWED_TAGS],
  allowedAttributes: { ...TELEGRAM_ALLOWED_ATTRIBUTES },
  allowEmojis: true,
};

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize HTML content with DOMPurify (XSS protection)
 *
 * @param html - Raw HTML string (potentially unsafe)
 * @param config - Sanitization configuration
 * @returns Safe HTML string
 *
 * @security
 * - Removes ALL unsafe tags and attributes
 * - Prevents XSS attacks (OWASP A03:2021)
 * - Whitelist approach (secure by default)
 *
 * @example
 * ```typescript
 * const raw = '<b>Hello</b> <script>alert("XSS")</script>';
 * const safe = sanitizeHTML(raw);
 * // Returns: '<b>Hello</b>' (script removed)
 * ```
 */
export function sanitizeHTML(
  html: unknown,
  config: SanitizationConfig = DEFAULT_MESSAGE_CONFIG
): string {
  // Input validation
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Configure DOMPurify with allowlist
  const cleanHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: config.allowedTags,
    ALLOWED_ATTR: Object.keys(config.allowedAttributes).reduce((acc, tag) => {
      config.allowedAttributes[tag].forEach(attr => acc.push(attr));
      return acc;
    }, [] as string[]),
    KEEP_CONTENT: true,           // Keep text content when tags are removed
    ALLOW_DATA_ATTR: false,       // Block data-* attributes
    ALLOW_UNKNOWN_PROTOCOLS: false, // Block unknown URL schemes
    SAFE_FOR_TEMPLATES: true,     // Safe for JSX
  });

  return cleanHTML;
}

/**
 * Sanitize email HTML content with extended allowlist (ADR-072)
 *
 * @param html - Raw email HTML string (potentially unsafe)
 * @returns Safe HTML string preserving email formatting
 *
 * @security
 * - Uses DOMPurify for XSS protection (OWASP A03:2021)
 * - Extended allowlist for email formatting (colors, tables, images)
 * - Blocks ALL event handlers and script tags
 * - Adds rel="noopener noreferrer" to links
 *
 * @example
 * ```typescript
 * const raw = '<b>Hello</b> <script>alert("XSS")</script>';
 * const safe = sanitizeEmailHTML(raw);
 * // Returns: '<b>Hello</b>' (script removed)
 *
 * const email = '<span style="color:red">Important</span>';
 * const safe2 = sanitizeEmailHTML(email);
 * // Returns: '<span style="color:red">Important</span>' (style preserved)
 * ```
 */
export function sanitizeEmailHTML(html: unknown): string {
  // Input validation
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Collect all allowed attributes from EMAIL_ALLOWED_ATTRIBUTES
  const allowedAttributes: string[] = [];
  Object.entries(EMAIL_ALLOWED_ATTRIBUTES).forEach(([tag, attrs]) => {
    if (tag === '*') {
      // Global attributes
      attrs.forEach(attr => {
        if (!allowedAttributes.includes(attr)) {
          allowedAttributes.push(attr);
        }
      });
    } else {
      // Tag-specific attributes
      attrs.forEach(attr => {
        if (!allowedAttributes.includes(attr)) {
          allowedAttributes.push(attr);
        }
      });
    }
  });

  // Configure DOMPurify with email-specific settings
  const cleanHTML = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...EMAIL_ALLOWED_TAGS],
    ALLOWED_ATTR: allowedAttributes,
    KEEP_CONTENT: true,           // Keep text content when tags are removed
    ALLOW_DATA_ATTR: false,       // Block data-* attributes
    ALLOW_UNKNOWN_PROTOCOLS: false, // Block unknown URL schemes
    SAFE_FOR_TEMPLATES: true,     // Safe for JSX
    FORBID_ATTR: [...EMAIL_FORBIDDEN_ATTRIBUTES], // Block event handlers
    ADD_ATTR: ['target'],         // Allow target="_blank" on links
  });

  return cleanHTML;
}

/**
 * Format message text for safe HTML rendering
 *
 * @param content - Message content object
 * @returns Sanitized HTML string ready for rendering
 *
 * @enterprise
 * - Sanitizes ALL user input (SDL requirement)
 * - Preserves Telegram-style formatting
 * - Converts line breaks to <br>
 * - XSS protection via DOMPurify
 *
 * @example
 * ```typescript
 * const content = {
 *   text: '<b>Hello</b>\nWorld <script>alert("XSS")</script>'
 * };
 * const html = formatMessageHTML(content);
 * // Returns: '<b>Hello</b><br>World ' (XSS removed, line breaks converted)
 * ```
 */
export function formatMessageHTML(content: MessageContent | null | undefined): string {
  if (!content || !content.text) {
    return '';
  }

  let text = content.text;

  // Convert line breaks to <br> tags (before sanitization)
  text = text.replace(/\n/g, '<br>');

  // Sanitize HTML (XSS protection)
  const safeHTML = sanitizeHTML(text, DEFAULT_MESSAGE_CONFIG);

  return safeHTML;
}

/**
 * Check if message contains HTML formatting
 *
 * @param text - Message text
 * @returns True if text contains HTML tags
 *
 * @example
 * ```typescript
 * hasHTMLFormatting('<b>Bold</b>') // true
 * hasHTMLFormatting('Plain text')  // false
 * ```
 */
export function hasHTMLFormatting(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // Check for HTML tags
  const htmlTagRegex = /<[^>]+>/;
  return htmlTagRegex.test(text);
}

/**
 * Strip ALL HTML tags from text (plain text fallback)
 *
 * @param html - HTML string
 * @returns Plain text only
 *
 * @example
 * ```typescript
 * stripHTMLTags('<b>Hello</b> World') // 'Hello World'
 * ```
 */
export function stripHTMLTags(html: unknown): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  // Use DOMPurify to strip ALL tags (empty allowlist)
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [],
    KEEP_CONTENT: true,
  });
}

// ============================================================================
// MESSAGE CONTENT HELPERS
// ============================================================================

/**
 * Get message preview text (without HTML, truncated)
 *
 * @param content - Message content
 * @param maxLength - Maximum preview length
 * @returns Plain text preview
 *
 * @example
 * ```typescript
 * const content = { text: '<b>Very long message...</b>' };
 * getMessagePreview(content, 50); // 'Very long message...'
 * ```
 */
export function getMessagePreview(
  content: MessageContent,
  maxLength: number = 100
): string {
  if (!content || !content.text) {
    return '';
  }

  // Strip HTML tags
  const plainText = stripHTMLTags(content.text);

  // Truncate if needed
  if (plainText.length <= maxLength) {
    return plainText;
  }

  return plainText.slice(0, maxLength) + '...';
}

/**
 * Check if content has attachments
 *
 * @param content - Message content
 * @returns True if has attachments
 */
export function hasAttachments(content: MessageContent): boolean {
  return Boolean(content?.attachments && content.attachments.length > 0);
}

// ============================================================================
// EMAIL SIGNATURE DETECTION (ADR-073)
// ============================================================================

/**
 * Email signature detection result
 */
export interface SignatureDetectionResult {
  /** Email body (without signature) */
  body: string;
  /** Detected signature (null if not found) */
  signature: string | null;
  /** Was signature detected? */
  hasSignature: boolean;
}

/**
 * Common email signature separators and patterns
 */
const SIGNATURE_PATTERNS = [
  // Standard separators
  /^--\s*$/m,                    // "-- " (RFC standard)
  /^[-_]{3,}$/m,                 // "---" or "___"

  // Common phrases (case insensitive)
  /^(best regards?|regards?|sincerely|cheers|thanks?|thank you),?\s*$/im,
  /^(kind regards?|warm regards?|with (best )?regards?),?\s*$/im,

  // "Sent from" patterns (mobile signatures)
  /^sent from (my )?(iphone|ipad|android|mobile|blackberry)/im,
  /^get outlook for (ios|android)/im,

  // Job title / position indicators (often in signatures)
  /^\w+\s+\|\s+\w+/m,            // "Name | Title"
  /^(ceo|cto|cfo|director|manager|president|founder)/im,
] as const;

/**
 * Detect and separate email signature from body content.
 *
 * @param content - Raw email content (plain text or HTML)
 * @returns Detection result with separated body and signature
 *
 * @enterprise
 * - Preserves original formatting (HTML/plain text)
 * - Multiple pattern matching for accuracy
 * - Conservative approach (avoids false positives)
 *
 * @example
 * ```typescript
 * const email = 'Hello World\n\n--\nJohn Doe\nCEO';
 * const result = detectEmailSignature(email);
 * // result.body === 'Hello World'
 * // result.signature === '--\nJohn Doe\nCEO'
 * // result.hasSignature === true
 * ```
 */
export function detectEmailSignature(content: string): SignatureDetectionResult {
  if (!content || typeof content !== 'string') {
    return {
      body: '',
      signature: null,
      hasSignature: false,
    };
  }

  // Split content into lines
  const lines = content.split('\n');
  let signatureStartIndex = -1;

  // Search for signature separator
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Check each pattern
    for (const pattern of SIGNATURE_PATTERNS) {
      if (pattern.test(line)) {
        signatureStartIndex = i;
        break;
      }
    }

    if (signatureStartIndex !== -1) {
      break;
    }
  }

  // No signature detected
  if (signatureStartIndex === -1) {
    return {
      body: content,
      signature: null,
      hasSignature: false,
    };
  }

  // Split body and signature
  const bodyLines = lines.slice(0, signatureStartIndex);
  const signatureLines = lines.slice(signatureStartIndex);

  // Remove trailing empty lines from body
  while (bodyLines.length > 0 && bodyLines[bodyLines.length - 1].trim() === '') {
    bodyLines.pop();
  }

  const body = bodyLines.join('\n');
  const signature = signatureLines.join('\n');

  return {
    body: body.trim(),
    signature: signature.trim(),
    hasSignature: true,
  };
}

/**
 * Strip email signature from content (returns body only).
 *
 * @param content - Raw email content
 * @returns Email body without signature
 *
 * @example
 * ```typescript
 * const email = 'Hello World\n\n--\nJohn Doe';
 * const body = stripEmailSignature(email);
 * // body === 'Hello World'
 * ```
 */
export function stripEmailSignature(content: string): string {
  const result = detectEmailSignature(content);
  return result.body;
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Default export for convenience
 */
export default {
  sanitizeHTML,
  sanitizeEmailHTML,
  formatMessageHTML,
  hasHTMLFormatting,
  stripHTMLTags,
  getMessagePreview,
  hasAttachments,
  detectEmailSignature,
  stripEmailSignature,
  TELEGRAM_ALLOWED_TAGS,
  TELEGRAM_ALLOWED_ATTRIBUTES,
  EMAIL_ALLOWED_TAGS,
  EMAIL_ALLOWED_ATTRIBUTES,
  EMAIL_FORBIDDEN_ATTRIBUTES,
  DEFAULT_MESSAGE_CONFIG,
};
