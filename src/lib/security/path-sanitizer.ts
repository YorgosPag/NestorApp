/**
 * =============================================================================
 * Path & URL Sanitization — Server-side security utilities
 * =============================================================================
 *
 * Prevents path traversal attacks on storage uploads and SSRF on URL fetches.
 *
 * @module lib/security/path-sanitizer
 * @enterprise ADR-252 Security Fixes (SV-C1 + AR-M3)
 */

import 'server-only';

// ============================================================================
// STORAGE PATH SANITIZER (SV-C1: Path Traversal Prevention)
// ============================================================================

/**
 * Allowed top-level storage path prefixes.
 * Any folderPath that doesn't start with one of these is rejected.
 */
const ALLOWED_STORAGE_PREFIXES = [
  'contacts/',
  'projects/',
  'files/',
  'photos/',
  'avatars/',
  'logos/',
  'documents/',
  'cadFiles/',
  'floorplans/',
  'attendance/',
  'accounting/',
  'dxf/',
] as const;

/**
 * Forbidden path segments that indicate traversal attempts.
 */
const FORBIDDEN_PATH_SEGMENTS = ['..', './', '~', '\\'];

/**
 * Forbidden characters in path components (beyond traversal).
 * Null bytes, control chars, and backslashes.
 */
const FORBIDDEN_PATH_CHARS = /[\x00-\x1f\x7f\\]/;

export interface SanitizePathResult {
  valid: true;
  sanitizedPath: string;
}

export interface SanitizePathError {
  valid: false;
  reason: string;
}

type SanitizePathOutcome = SanitizePathResult | SanitizePathError;

/**
 * Sanitize a storage path to prevent path traversal.
 *
 * - Strips `..` segments
 * - Normalizes consecutive slashes
 * - Validates against allowlist of prefixes
 * - Rejects null bytes and control characters
 */
export function sanitizeStoragePath(folderPath: string): SanitizePathOutcome {
  if (!folderPath || typeof folderPath !== 'string') {
    return { valid: false, reason: 'empty_path' };
  }

  // Check for null bytes and control characters
  if (FORBIDDEN_PATH_CHARS.test(folderPath)) {
    return { valid: false, reason: 'forbidden_characters' };
  }

  // Check for traversal segments BEFORE normalization
  for (const segment of FORBIDDEN_PATH_SEGMENTS) {
    if (folderPath.includes(segment)) {
      return { valid: false, reason: 'path_traversal_detected' };
    }
  }

  // Normalize: remove leading/trailing slashes, collapse double slashes
  let normalized = folderPath
    .replace(/\/+/g, '/')   // collapse double slashes
    .replace(/^\//, '')      // remove leading slash
    .replace(/\/$/, '');     // remove trailing slash

  // Re-check after normalization (defense in depth)
  if (normalized.includes('..')) {
    return { valid: false, reason: 'path_traversal_after_normalize' };
  }

  // Validate against allowlist
  const hasAllowedPrefix = ALLOWED_STORAGE_PREFIXES.some(
    prefix => normalized.startsWith(prefix) || normalized === prefix.replace(/\/$/, '')
  );

  if (!hasAllowedPrefix) {
    return { valid: false, reason: 'path_not_in_allowlist' };
  }

  return { valid: true, sanitizedPath: normalized };
}

// ============================================================================
// URL VALIDATOR (AR-M3: SSRF Prevention)
// ============================================================================

/**
 * Allowed domains for server-side URL fetching.
 * Only these domains can be fetched by the watermark API and similar endpoints.
 */
const ALLOWED_FETCH_DOMAINS = [
  'firebasestorage.googleapis.com',
  'storage.googleapis.com',
  'storage.cloud.google.com',
] as const;

export interface ValidateUrlResult {
  valid: true;
  url: string;
}

export interface ValidateUrlError {
  valid: false;
  reason: string;
}

type ValidateUrlOutcome = ValidateUrlResult | ValidateUrlError;

/**
 * Validate a URL for server-side fetching (SSRF prevention).
 *
 * - Must be HTTPS
 * - Must be on the domain allowlist
 * - No user:password@ in URL
 * - No IP addresses (prevent internal network scanning)
 */
export function validateFetchUrl(rawUrl: string): ValidateUrlOutcome {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, reason: 'empty_url' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: 'invalid_url_format' };
  }

  // Must be HTTPS
  if (parsed.protocol !== 'https:') {
    return { valid: false, reason: 'https_required' };
  }

  // No credentials in URL
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'credentials_in_url' };
  }

  // Check against domain allowlist
  const hostname = parsed.hostname.toLowerCase();
  const isAllowed = ALLOWED_FETCH_DOMAINS.some(
    domain => hostname === domain || hostname.endsWith('.' + domain)
  );

  if (!isAllowed) {
    return { valid: false, reason: 'domain_not_in_allowlist' };
  }

  // Reject IP addresses (IPv4 and IPv6)
  const isIPv4 = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
  const isIPv6 = hostname.startsWith('[') || hostname.includes(':');
  if (isIPv4 || isIPv6) {
    return { valid: false, reason: 'ip_address_not_allowed' };
  }

  return { valid: true, url: parsed.toString() };
}

// ============================================================================
// SERVER-SIDE HTML SANITIZER (SV-H1: Email Defense-in-Depth)
// ============================================================================

/**
 * Dangerous HTML tags that should be stripped on the server side
 * before storing email content to Firestore.
 *
 * Defense-in-depth: client also sanitizes via DOMPurify (ADR-072).
 */
const DANGEROUS_TAG_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
  /<embed\b[^>]*\/?>/gi,
  /<applet\b[^<]*(?:(?!<\/applet>)<[^<]*)*<\/applet>/gi,
  /<base\b[^>]*\/?>/gi,
  /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
  /<meta\b[^>]*\/?>/gi,
  /<link\b[^>]*\/?>/gi,
  /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,
  /<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi,
];

/**
 * Event handler attributes that could execute JavaScript.
 * Matches on*, formaction, xlink:href, data-, srcdoc etc.
 */
const EVENT_HANDLER_PATTERN = /\s(on\w+|formaction|xlink:href|srcdoc)\s*=\s*(['"])[^'"]*\2/gi;

/**
 * JavaScript: and data: protocols in href/src/action attributes.
 */
const DANGEROUS_PROTOCOL_PATTERN = /(href|src|action|background|poster)\s*=\s*(['"])?\s*(javascript|data|vbscript):/gi;

/**
 * Sanitize HTML content for server-side storage (defense-in-depth).
 *
 * Strips dangerous tags, event handlers, and dangerous protocols.
 * Preserves formatting tags (p, div, span, br, b, i, u, etc.) and inline styles
 * so email rendering keeps its visual appearance.
 *
 * This is NOT a replacement for client-side DOMPurify — it's an additional layer.
 */
export function sanitizeHtmlForStorage(html: string | undefined): string | undefined {
  if (!html) return html;

  let sanitized = html;

  // Strip dangerous tags
  for (const pattern of DANGEROUS_TAG_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Strip event handlers
  sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, '');

  // Strip dangerous protocols
  sanitized = sanitized.replace(DANGEROUS_PROTOCOL_PATTERN, '$1=$2#blocked:');

  return sanitized;
}
