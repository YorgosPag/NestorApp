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
 * @see centralized_systems.md Rule #15
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
  html: string,
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
export function formatMessageHTML(content: MessageContent): string {
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
export function stripHTMLTags(html: string): string {
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
// EXPORTS
// ============================================================================

/**
 * 🏢 ENTERPRISE: Default export for convenience
 */
export default {
  sanitizeHTML,
  formatMessageHTML,
  hasHTMLFormatting,
  stripHTMLTags,
  getMessagePreview,
  hasAttachments,
  TELEGRAM_ALLOWED_TAGS,
  TELEGRAM_ALLOWED_ATTRIBUTES,
  DEFAULT_MESSAGE_CONFIG,
};
