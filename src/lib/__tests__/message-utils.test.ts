/**
 * =============================================================================
 * MESSAGE UTILITIES TESTS - ENTERPRISE
 * =============================================================================
 *
 * Unit tests for message formatting and HTML sanitization:
 * - formatMessageHTML with <pre> and <code> tags
 * - XSS protection validation
 * - Telegram-compatible HTML rendering
 * - Line break conversion
 *
 * @module lib/__tests__/message-utils
 * @enterprise SDL + OWASP compliant testing
 * @see src/lib/message-utils.ts
 * @see local_5_TELEGRAM.txt - Test requirements
 */

import {
  sanitizeHTML,
  formatMessageHTML,
  hasHTMLFormatting,
  stripHTMLTags,
  getMessagePreview,
  hasAttachments,
  TELEGRAM_ALLOWED_TAGS,
  DEFAULT_MESSAGE_CONFIG,
} from '@/lib/message-utils';

import type { MessageContent } from '@/lib/message-utils';

describe('message-utils', () => {
  // ===========================================================================
  // SANITIZATION TESTS
  // ===========================================================================

  describe('sanitizeHTML', () => {
    it('should allow Telegram-compatible tags', () => {
      const input = '<b>Bold</b> <i>Italic</i> <code>Code</code>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<b>Bold</b>');
      expect(output).toContain('<i>Italic</i>');
      expect(output).toContain('<code>Code</code>');
    });

    it('should remove dangerous script tags (XSS protection)', () => {
      const input = '<b>Safe</b><script>alert("XSS")</script>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<b>Safe</b>');
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
    });

    it('should remove onclick handlers (XSS protection)', () => {
      const input = '<a href="#" onclick="alert(\'XSS\')">Link</a>';
      const output = sanitizeHTML(input);

      expect(output).not.toContain('onclick');
      expect(output).toContain('<a');
      expect(output).toContain('Link');
    });

    it('should allow <pre> tags for code blocks', () => {
      const input = '<pre>Code block here</pre>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<pre>');
      expect(output).toContain('Code block here');
      expect(output).toContain('</pre>');
    });

    it('should handle empty input', () => {
      expect(sanitizeHTML('')).toBe('');
      expect(sanitizeHTML(null as any)).toBe('');
      expect(sanitizeHTML(undefined as any)).toBe('');
    });
  });

  // ===========================================================================
  // FORMAT MESSAGE HTML TESTS (CORE REQUIREMENT)
  // ===========================================================================

  describe('formatMessageHTML', () => {
    /**
     * 🧪 TEST REQUIREMENT FROM local_5_TELEGRAM.txt:
     * "Πρόσθεσε ένα unit test για message formatting:
     *  input με <pre>…</pre> => output περιλαμβάνει <pre>"
     */
    it('should preserve <pre> tags in output (Telegram stats container)', () => {
      const content: MessageContent = {
        text: '<pre>\n📊 Στατιστικά Ακινήτων\n\n🏠 Σύνολο ακινήτων: 6\n</pre>',
      };

      const output = formatMessageHTML(content);

      // ✅ CORE ASSERTION: Output MUST contain <pre> tag
      expect(output).toContain('<pre>');
      expect(output).toContain('📊 Στατιστικά Ακινήτων');
      expect(output).toContain('🏠 Σύνολο ακινήτων: 6');
      expect(output).toContain('</pre>');
    });

    it('should convert line breaks to <br> tags', () => {
      const content: MessageContent = {
        text: 'Line 1\nLine 2\nLine 3',
      };

      const output = formatMessageHTML(content);

      expect(output).toContain('Line 1<br>Line 2<br>Line 3');
      expect(output).not.toContain('\n');
    });

    it('should preserve <code> tags for inline code', () => {
      const content: MessageContent = {
        text: 'Use <code>npm install</code> to install',
      };

      const output = formatMessageHTML(content);

      expect(output).toContain('<code>npm install</code>');
    });

    it('should handle bold text with emojis', () => {
      const content: MessageContent = {
        text: '<b>🎯 Important:</b> Check this',
      };

      const output = formatMessageHTML(content);

      expect(output).toContain('<b>🎯 Important:</b>');
      expect(output).toContain('Check this');
    });

    it('should sanitize XSS while preserving formatting', () => {
      const content: MessageContent = {
        text: '<b>Safe</b> <script>alert("XSS")</script> <i>Text</i>',
      };

      const output = formatMessageHTML(content);

      expect(output).toContain('<b>Safe</b>');
      expect(output).toContain('<i>Text</i>');
      expect(output).not.toContain('<script>');
      expect(output).not.toContain('alert');
    });

    it('should handle complex Telegram message with multiple tags', () => {
      const content: MessageContent = {
        text: '<b>Title</b>\n\n<pre>Code block\nMultiple lines</pre>\n\n<i>Footer text</i>',
      };

      const output = formatMessageHTML(content);

      expect(output).toContain('<b>Title</b>');
      expect(output).toContain('<pre>');
      expect(output).toContain('Code block');
      expect(output).toContain('<i>Footer text</i>');
    });

    it('should handle empty content', () => {
      const emptyContent: MessageContent = { text: '' };
      expect(formatMessageHTML(emptyContent)).toBe('');

      const nullContent = null as any;
      expect(formatMessageHTML(nullContent)).toBe('');
    });
  });

  // ===========================================================================
  // HELPER FUNCTIONS TESTS
  // ===========================================================================

  describe('hasHTMLFormatting', () => {
    it('should detect HTML tags', () => {
      expect(hasHTMLFormatting('<b>Bold</b>')).toBe(true);
      expect(hasHTMLFormatting('<pre>Code</pre>')).toBe(true);
      expect(hasHTMLFormatting('Plain text')).toBe(false);
      expect(hasHTMLFormatting('')).toBe(false);
    });
  });

  describe('stripHTMLTags', () => {
    it('should remove all HTML tags', () => {
      const input = '<b>Bold</b> <i>Italic</i> plain';
      const output = stripHTMLTags(input);

      expect(output).toBe('Bold Italic plain');
      expect(output).not.toContain('<');
      expect(output).not.toContain('>');
    });

    it('should handle empty input', () => {
      expect(stripHTMLTags('')).toBe('');
      expect(stripHTMLTags(null as any)).toBe('');
    });
  });

  describe('getMessagePreview', () => {
    it('should strip HTML and truncate long text', () => {
      const content: MessageContent = {
        text: '<b>This is a very long message that should be truncated</b> with more text here',
      };

      const preview = getMessagePreview(content, 30);

      expect(preview).not.toContain('<b>');
      expect(preview).not.toContain('</b>');
      expect(preview.length).toBeLessThanOrEqual(33); // 30 + '...'
      expect(preview).toContain('...');
    });

    it('should not truncate short messages', () => {
      const content: MessageContent = {
        text: '<b>Short</b>',
      };

      const preview = getMessagePreview(content, 100);

      expect(preview).toBe('Short');
      expect(preview).not.toContain('...');
    });
  });

  describe('hasAttachments', () => {
    it('should detect attachments', () => {
      const withAttachments: MessageContent = {
        text: 'Message',
        attachments: [{ url: 'file.pdf', type: 'pdf', name: 'file.pdf' }],
      };

      const withoutAttachments: MessageContent = {
        text: 'Message',
      };

      expect(hasAttachments(withAttachments)).toBe(true);
      expect(hasAttachments(withoutAttachments)).toBe(false);
    });
  });

  // ===========================================================================
  // CONSTANTS TESTS
  // ===========================================================================

  describe('TELEGRAM_ALLOWED_TAGS', () => {
    it('should contain all Telegram-compatible tags', () => {
      const tags = TELEGRAM_ALLOWED_TAGS;

      expect(tags).toContain('b');
      expect(tags).toContain('strong');
      expect(tags).toContain('i');
      expect(tags).toContain('em');
      expect(tags).toContain('code');
      expect(tags).toContain('pre');
      expect(tags).toContain('a');
      expect(tags).toContain('br');
    });
  });

  describe('DEFAULT_MESSAGE_CONFIG', () => {
    it('should have proper default configuration', () => {
      const config = DEFAULT_MESSAGE_CONFIG;

      expect(config.allowedTags).toBeDefined();
      expect(config.allowedAttributes).toBeDefined();
      expect(config.allowEmojis).toBe(true);
      expect(config.allowedTags.length).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // EDGE CASES & SECURITY TESTS
  // ===========================================================================

  describe('edge cases and security', () => {
    it('should handle nested tags correctly', () => {
      const input = '<b><i>Bold Italic</i></b>';
      const output = sanitizeHTML(input);

      expect(output).toContain('<b>');
      expect(output).toContain('<i>');
      expect(output).toContain('Bold Italic');
    });

    it('should prevent data attribute injection', () => {
      const input = '<div data-evil="payload">Text</div>';
      const output = sanitizeHTML(input);

      // div is not allowed, should be stripped
      expect(output).not.toContain('<div');
      expect(output).not.toContain('data-evil');
    });

    it('should handle malformed HTML gracefully', () => {
      const input = '<b>Unclosed tag';
      const output = sanitizeHTML(input);

      // DOMPurify should auto-close tags
      expect(output).toBe('<b>Unclosed tag</b>');
    });

    it('should preserve emoji characters', () => {
      const content: MessageContent = {
        text: '🎯 📊 🏠 ✅ 📋',
      };

      const output = formatMessageHTML(content);

      expect(output).toContain('🎯');
      expect(output).toContain('📊');
      expect(output).toContain('🏠');
    });
  });
});
