'use client';

/**
 * =============================================================================
 * ENTERPRISE: CENTRALIZED EMAIL CONTENT RENDERER
 * =============================================================================
 *
 * Shared component for rendering email content across the application.
 * Extracted from AIInboxClient to be reused by Operator Inbox and future UIs.
 *
 * Features:
 * - XSS protection via DOMPurify (sanitizeEmailHTML)
 * - URL linkification (3 patterns: email-style, markdown, plain URLs)
 * - Line break preservation (\r\n and \n)
 * - Email signature detection and separated display (ADR-073)
 *
 * @module components/shared/email/EmailContentRenderer
 * @enterprise SDL + OWASP compliant
 * @see ADR-072 (AI Inbox HTML Rendering)
 * @see ADR-073 (Email Signature Detection)
 */

import { sanitizeEmailHTML, detectEmailSignature } from '@/lib/message-utils';

// ============================================================================
// TYPES
// ============================================================================

interface TextPart {
  type: 'text' | 'link';
  content: string;
  href?: string;
  displayText?: string;
}

// ============================================================================
// REGEX PATTERNS
// ============================================================================

// Pattern 1: Text <URL> format (email style) - e.g., "Google Maps <https://...>"
// Allows newlines between text and URL (common in email signatures)
const EMAIL_LINK_REGEX = /([^<>\n\r]+?)[\s\r\n]*<(https?:\/\/[^>]+)>/gi;

// Pattern 2: [Text](URL) format (markdown style)
const MARKDOWN_LINK_REGEX = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi;

// Pattern 3: Plain URLs
const PLAIN_URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"\]\)]+/gi;

// ============================================================================
// PARSERS
// ============================================================================

/**
 * Parse text content to detect links in 3 formats:
 * 1. Email-style: `Text <URL>`
 * 2. Markdown: `[Text](URL)`
 * 3. Plain URLs: `https://...` or `www....`
 */
const parseTextWithLinks = (text: string): TextPart[] => {
  const parts: TextPart[] = [];
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  interface LinkMatch {
    start: number;
    end: number;
    displayText: string;
    href: string;
  }

  const links: LinkMatch[] = [];

  // Find email-style links: Text <URL>
  EMAIL_LINK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = EMAIL_LINK_REGEX.exec(normalizedText)) !== null) {
    const displayText = match[1].trim();
    if (displayText && !displayText.startsWith('http') && !displayText.startsWith('www.')) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        displayText,
        href: match[2],
      });
    }
  }

  // Find markdown-style links: [Text](URL)
  MARKDOWN_LINK_REGEX.lastIndex = 0;
  while ((match = MARKDOWN_LINK_REGEX.exec(normalizedText)) !== null) {
    const overlaps = links.some(l =>
      (match!.index >= l.start && match!.index < l.end) ||
      (match!.index + match![0].length > l.start && match!.index + match![0].length <= l.end)
    );
    if (!overlaps) {
      links.push({
        start: match.index,
        end: match.index + match[0].length,
        displayText: match[1],
        href: match[2],
      });
    }
  }

  // Find plain URLs (not already captured)
  PLAIN_URL_REGEX.lastIndex = 0;
  while ((match = PLAIN_URL_REGEX.exec(normalizedText)) !== null) {
    const overlaps = links.some(l =>
      (match!.index >= l.start && match!.index < l.end) ||
      (match!.index + match![0].length > l.start && match!.index + match![0].length <= l.end)
    );
    if (!overlaps) {
      let url = match[0];
      const trailingPunctuation = url.match(/[.,;:!?)>\]\\]+$/);
      if (trailingPunctuation) {
        url = url.slice(0, -trailingPunctuation[0].length);
      }

      let displayText: string;
      try {
        const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
        displayText = urlObj.hostname.replace('www.', '');
      } catch {
        displayText = url.length > 40 ? url.slice(0, 40) + '...' : url;
      }

      links.push({
        start: match.index,
        end: match.index + url.length,
        displayText,
        href: url,
      });
    }
  }

  // Sort links by position
  links.sort((a, b) => a.start - b.start);

  // Build parts array
  let lastIndex = 0;
  for (const link of links) {
    if (link.start > lastIndex) {
      const textContent = normalizedText.slice(lastIndex, link.start);
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }
    parts.push({
      type: 'link',
      content: link.displayText,
      href: link.href,
      displayText: link.displayText,
    });
    lastIndex = link.end;
  }

  if (lastIndex < normalizedText.length) {
    parts.push({ type: 'text', content: normalizedText.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content: normalizedText }];
};

/**
 * Render text with line breaks preserved (handles \r\n and \n)
 */
const renderTextWithLineBreaks = (text: string, baseKey: string) => {
  const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedText.split('\n');
  return lines.map((line, lineIndex) => (
    <span key={`${baseKey}-line-${lineIndex}`}>
      {line}
      {lineIndex < lines.length - 1 && <br />}
    </span>
  ));
};

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Render text with clickable links and line break preservation
 */
function RenderContentWithLinks({ content }: { content: string }) {
  const parts = parseTextWithLinks(content);

  return (
    <>
      {parts.map((part, index) => {
        if (part.type === 'link' && part.href) {
          const href = part.href.startsWith('http')
            ? part.href
            : `https://${part.href}`;

          return (
            <a
              key={index}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(var(--link-color))] underline hover:text-[hsl(var(--link-color-hover))] transition-colors"
              onClick={(e) => e.stopPropagation()}
              title={part.href}
            >
              {part.displayText || part.content}
            </a>
          );
        }
        return (
          <span key={index}>
            {renderTextWithLineBreaks(part.content, `part-${index}`)}
          </span>
        );
      })}
    </>
  );
}

/**
 * Safe HTML Content Renderer (ADR-072)
 *
 * Renders email content with:
 * - Line breaks preserved
 * - Clickable links (email-style, markdown, plain URLs)
 * - XSS protection via DOMPurify for HTML content
 *
 * @security Uses sanitizeEmailHTML() for HTML content
 */
export function SafeHTMLContent({ html }: { html: string }) {
  const normalizedContent = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Check if content appears to be HTML
  const hasHTMLContent = /<(?!https?:)[a-z][^>]*>/i.test(normalizedContent);

  if (!hasHTMLContent) {
    // Plain text: Convert to HTML with links and line breaks
    let processedContent = normalizedContent;

    // 1. Escape HTML entities first
    processedContent = processedContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Convert email-style links: Text <URL>
    processedContent = processedContent.replace(
      /([^\n&]*?)\s*&lt;(https?:\/\/[^&]+)&gt;/gi,
      (_match, text: string, url: string) => {
        const displayText = text.trim() || new URL(url).hostname.replace('www.', '');
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[hsl(var(--link-color))] underline hover:text-[hsl(var(--link-color-hover))] transition-colors">${displayText}</a>`;
      }
    );

    // 3. Convert plain URLs (not already in links)
    processedContent = processedContent.replace(
      /(?<!href=")(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/gi,
      (url) => {
        const href = url.startsWith('http') ? url : `https://${url}`;
        const displayText = (() => {
          try {
            return new URL(href).hostname.replace('www.', '');
          } catch {
            return url.length > 40 ? url.substring(0, 40) + '...' : url;
          }
        })();
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-[hsl(var(--link-color))] underline hover:text-[hsl(var(--link-color-hover))] transition-colors">${displayText}</a>`;
      }
    );

    // 4. Convert newlines to <br>
    processedContent = processedContent.replace(/\n/g, '<br />');

    return (
      <div
        className="email-content text-foreground"
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={(e) => {
          if ((e.target as HTMLElement).tagName === 'A') {
            e.stopPropagation();
          }
        }}
      />
    );
  }

  // HTML content: sanitize and render
  const sanitizedHTML = sanitizeEmailHTML(normalizedContent);

  return (
    <div
      className="email-content prose prose-sm max-w-none dark:prose-invert
        [&_a]:text-[hsl(var(--link-color))] [&_a]:underline [&_a]:hover:text-[hsl(var(--link-color-hover))] [&_a]:transition-colors
        [&_table]:border-collapse [&_td]:p-1 [&_th]:p-1
        [&_img]:max-w-full [&_img]:h-auto
        [&_blockquote]:border-l-4 [&_blockquote]:border-muted [&_blockquote]:pl-4"
      dangerouslySetInnerHTML={{ __html: sanitizedHTML }}
      onClick={(e) => {
        if ((e.target as HTMLElement).tagName === 'A') {
          e.stopPropagation();
        }
      }}
    />
  );
}

/**
 * Email Content with Signature Detection (ADR-073)
 *
 * Renders email content with separated signature display.
 * - Detects and extracts email signature automatically
 * - Displays body content with full formatting
 * - Shows signature in muted, bordered section
 */
export function EmailContentWithSignature({ content }: { content: string }) {
  const signatureDetection = detectEmailSignature(content);

  return (
    <div className="space-y-3">
      {/* Email Body */}
      <div>
        <SafeHTMLContent html={signatureDetection.body} />
      </div>

      {/* Email Signature (if detected) */}
      {signatureDetection.hasSignature && signatureDetection.signature && (
        <div className="border-t border-muted pt-3 mt-3">
          <div className="text-xs text-muted-foreground italic mb-1">
            Email Signature:
          </div>
          <div className="text-sm text-muted-foreground opacity-75">
            <SafeHTMLContent html={signatureDetection.signature} />
          </div>
        </div>
      )}
    </div>
  );
}

// Re-export RenderContentWithLinks for consumers that need React-based rendering
export { RenderContentWithLinks };
