/**
 * 🏢 ENTERPRISE: DXF Encoding Service
 *
 * Centralized service for file encoding detection and conversion.
 * Supports Greek character encodings (Windows-1253, ISO-8859-7).
 *
 * Extracted from dxf-import.ts for Single Responsibility Principle.
 *
 * @see dxf-import.ts - Main DXF import orchestrator
 * @see config/modal-select/core/options/encoding.ts - UI encoding options
 */

// ============================================================================
// 🏢 ENTERPRISE: ENCODING MAPPING TABLES
// ============================================================================

/**
 * Complete Windows-1253 to Unicode mapping table
 * Used for Greek character support in DXF files from AutoCAD
 */
const WINDOWS_1253_TO_UNICODE: Readonly<Record<number, number>> = {
  0x80: 0x20AC, // Euro sign
  0x82: 0x201A, // Single low-9 quotation mark
  0x83: 0x0192, // Latin small letter f with hook
  0x84: 0x201E, // Double low-9 quotation mark
  0x85: 0x2026, // Horizontal ellipsis
  0x86: 0x2020, // Dagger
  0x87: 0x2021, // Double dagger
  0x89: 0x2030, // Per mille sign
  0x8B: 0x2039, // Single left-pointing angle quotation mark
  0x8C: 0x0152, // Latin capital ligature OE
  0x8E: 0x017D, // Latin capital letter Z with caron
  0x91: 0x2018, // Left single quotation mark
  0x92: 0x2019, // Right single quotation mark
  0x93: 0x201C, // Left double quotation mark
  0x94: 0x201D, // Right double quotation mark
  0x95: 0x2022, // Bullet
  0x96: 0x2013, // En dash
  0x97: 0x2014, // Em dash
  0x99: 0x2122, // Trade mark sign
  0x9B: 0x203A, // Single right-pointing angle quotation mark
  0x9C: 0x0153, // Latin small ligature oe
  0x9E: 0x017E, // Latin small letter z with caron
  0x9F: 0x0178, // Latin capital letter Y with diaeresis
  0xA0: 0x00A0, // No-break space
  0xA1: 0x0385, // Greek dialytika tonos
  0xA2: 0x0386, // Greek capital letter alpha with tonos
  0xA3: 0x00A3, // Pound sign
  0xA4: 0x00A4, // Currency sign
  0xA5: 0x00A5, // Yen sign
  0xA6: 0x00A6, // Broken bar
  0xA7: 0x00A7, // Section sign
  0xA8: 0x00A8, // Diaeresis
  0xA9: 0x00A9, // Copyright sign
  0xAB: 0x00AB, // Left-pointing double angle quotation mark
  0xAC: 0x00AC, // Not sign
  0xAD: 0x00AD, // Soft hyphen
  0xAE: 0x00AE, // Registered sign
  0xAF: 0x2015, // Horizontal bar
  0xB0: 0x00B0, // Degree sign
  0xB1: 0x00B1, // Plus-minus sign
  0xB2: 0x00B2, // Superscript two
  0xB3: 0x00B3, // Superscript three
  0xB4: 0x0384, // Greek tonos
  0xB5: 0x00B5, // Micro sign
  0xB6: 0x00B6, // Pilcrow sign
  0xB7: 0x00B7, // Middle dot
  0xB8: 0x0388, // Greek capital letter epsilon with tonos
  0xB9: 0x0389, // Greek capital letter eta with tonos
  0xBA: 0x038A, // Greek capital letter iota with tonos
  0xBB: 0x00BB, // Right-pointing double angle quotation mark
  0xBC: 0x038C, // Greek capital letter omicron with tonos
  0xBD: 0x00BD, // Vulgar fraction one half
  0xBE: 0x038E, // Greek capital letter upsilon with tonos
  0xBF: 0x038F, // Greek capital letter omega with tonos
  // Greek alphabet
  0xC0: 0x0390, // Greek small letter iota with dialytika and tonos
  0xC1: 0x0391, // Greek capital letter alpha
  0xC2: 0x0392, // Greek capital letter beta
  0xC3: 0x0393, // Greek capital letter gamma
  0xC4: 0x0394, // Greek capital letter delta
  0xC5: 0x0395, // Greek capital letter epsilon
  0xC6: 0x0396, // Greek capital letter zeta
  0xC7: 0x0397, // Greek capital letter eta
  0xC8: 0x0398, // Greek capital letter theta
  0xC9: 0x0399, // Greek capital letter iota
  0xCA: 0x039A, // Greek capital letter kappa
  0xCB: 0x039B, // Greek capital letter lambda
  0xCC: 0x039C, // Greek capital letter mu
  0xCD: 0x039D, // Greek capital letter nu
  0xCE: 0x039E, // Greek capital letter xi
  0xCF: 0x039F, // Greek capital letter omicron
  0xD0: 0x03A0, // Greek capital letter pi
  0xD1: 0x03A1, // Greek capital letter rho
  0xD3: 0x03A3, // Greek capital letter sigma
  0xD4: 0x03A4, // Greek capital letter tau
  0xD5: 0x03A5, // Greek capital letter upsilon
  0xD6: 0x03A6, // Greek capital letter phi
  0xD7: 0x03A7, // Greek capital letter chi
  0xD8: 0x03A8, // Greek capital letter psi
  0xD9: 0x03A9, // Greek capital letter omega
  0xDA: 0x03AA, // Greek capital letter iota with dialytika
  0xDB: 0x03AB, // Greek capital letter upsilon with dialytika
  0xDC: 0x03AC, // Greek small letter alpha with tonos
  0xDD: 0x03AD, // Greek small letter epsilon with tonos
  0xDE: 0x03AE, // Greek small letter eta with tonos
  0xDF: 0x03AF, // Greek small letter iota with tonos
  0xE0: 0x03B0, // Greek small letter upsilon with dialytika and tonos
  0xE1: 0x03B1, // Greek small letter alpha
  0xE2: 0x03B2, // Greek small letter beta
  0xE3: 0x03B3, // Greek small letter gamma
  0xE4: 0x03B4, // Greek small letter delta
  0xE5: 0x03B5, // Greek small letter epsilon
  0xE6: 0x03B6, // Greek small letter zeta
  0xE7: 0x03B7, // Greek small letter eta
  0xE8: 0x03B8, // Greek small letter theta
  0xE9: 0x03B9, // Greek small letter iota
  0xEA: 0x03BA, // Greek small letter kappa
  0xEB: 0x03BB, // Greek small letter lambda
  0xEC: 0x03BC, // Greek small letter mu
  0xED: 0x03BD, // Greek small letter nu
  0xEE: 0x03BE, // Greek small letter xi
  0xEF: 0x03BF, // Greek small letter omicron
  0xF0: 0x03C0, // Greek small letter pi
  0xF1: 0x03C1, // Greek small letter rho
  0xF2: 0x03C2, // Greek small letter final sigma
  0xF3: 0x03C3, // Greek small letter sigma
  0xF4: 0x03C4, // Greek small letter tau
  0xF5: 0x03C5, // Greek small letter upsilon
  0xF6: 0x03C6, // Greek small letter phi
  0xF7: 0x03C7, // Greek small letter chi
  0xF8: 0x03C8, // Greek small letter psi
  0xF9: 0x03C9, // Greek small letter omega
  0xFA: 0x03CA, // Greek small letter iota with dialytika
  0xFB: 0x03CB, // Greek small letter upsilon with dialytika
  0xFC: 0x03CC, // Greek small letter omicron with tonos
  0xFD: 0x03CD, // Greek small letter upsilon with tonos
  0xFE: 0x03CE  // Greek small letter omega with tonos
} as const;

/**
 * Inverse of `WINDOWS_1253_TO_UNICODE` (unicode code-point → Windows-1253 byte), built ONCE
 * from the SAME table (no second table — SSoT). Used by `encodeWindows1253` for DXF export
 * (ADR-636 Στάδιο 2 Φ2.2). ASCII (0x00–0x7F) is identity and not stored here.
 */
let UNICODE_TO_WINDOWS_1253: Map<number, number> | null = null;
function unicodeToWindows1253(): Map<number, number> {
  if (!UNICODE_TO_WINDOWS_1253) {
    const map = new Map<number, number>();
    for (const [byteStr, unicode] of Object.entries(WINDOWS_1253_TO_UNICODE)) {
      map.set(unicode, Number(byteStr));
    }
    UNICODE_TO_WINDOWS_1253 = map;
  }
  return UNICODE_TO_WINDOWS_1253;
}

// ============================================================================
// 🏢 ENTERPRISE: ENCODING SERVICE CLASS
// ============================================================================

/**
 * Supported encodings for DXF file reading
 */
export type SupportedEncoding = 'UTF-8' | 'Windows-1253' | 'ISO-8859-7';

/**
 * 🏢 ENTERPRISE: Encoding Service
 *
 * Handles file encoding detection and conversion for DXF files.
 * Supports Greek character encodings commonly used in Greek AutoCAD files.
 */
export class EncodingService {
  /**
   * Default encoding order for auto-detection
   */
  private static readonly DEFAULT_ENCODINGS: readonly SupportedEncoding[] = [
    'UTF-8',
    'Windows-1253',
    'ISO-8859-7'
  ] as const;

  /**
   * 🏢 ENTERPRISE: Read file with specific encoding
   *
   * Attempts to read a file with the specified encoding.
   * Returns null if reading fails.
   *
   * @param file - The file to read
   * @param encoding - The encoding to use
   * @returns The file content as string, or null if failed
   */
  async readFileWithEncoding(file: File, encoding: SupportedEncoding): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      if (encoding === 'UTF-8' || encoding === 'Windows-1253' || encoding === 'ISO-8859-7') {
        reader.onload = (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            if (!arrayBuffer) {
              resolve(null);
              return;
            }

            const bytes = new Uint8Array(arrayBuffer);
            let content = '';

            if (encoding === 'UTF-8') {
              const decoder = new TextDecoder('utf-8');
              content = decoder.decode(bytes);
            } else if (encoding === 'Windows-1253') {
              content = this.decodeWindows1253(bytes);
            } else if (encoding === 'ISO-8859-7') {
              content = this.decodeISO88597(bytes);
            }

            resolve(content || null);
          } catch (error) {
            console.warn(`[EncodingService] Decode error with ${encoding}:`, error);
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      } else {
        reader.onload = (e) => {
          const content = e.target?.result as string;
          resolve(content || null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(file, encoding);
      }
    });
  }

  /**
   * 🏢 ENTERPRISE: Auto-detect and read file with best encoding
   *
   * Tries multiple encodings and returns the first successful result
   * with valid Greek text (if present).
   *
   * @param file - The file to read
   * @param preferredEncoding - Optional preferred encoding to try first
   * @returns Object with content and detected encoding, or null if all failed
   */
  async readFileWithAutoDetect(
    file: File,
    preferredEncoding?: SupportedEncoding
  ): Promise<{ content: string; encoding: SupportedEncoding } | null> {
    const encodings = preferredEncoding
      ? [preferredEncoding, ...EncodingService.DEFAULT_ENCODINGS.filter(e => e !== preferredEncoding)]
      : [...EncodingService.DEFAULT_ENCODINGS];

    for (const encoding of encodings) {
      const content = await this.readFileWithEncoding(file, encoding);

      if (!content) continue;

      // Check for garbled characters (encoding mismatch indicator)
      const hasGarbledChars = /[�\uFFFD]/.test(content);
      const garbledCount = (content.match(/[�\uFFFD]/g) || []).length;

      // If UTF-8 produces too many garbled chars, try next encoding
      if (encoding === 'UTF-8' && hasGarbledChars && garbledCount > 10) {
        continue;
      }

      // Check for valid Greek text
      const hasGreekText = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(content);

      // If we have Greek text without garbled chars, this encoding works
      if (hasGreekText && !hasGarbledChars) {
        return { content, encoding };
      }

      // If no Greek text needed and no garbled chars, accept it
      if (!hasGarbledChars) {
        return { content, encoding };
      }
    }

    return null;
  }

  /**
   * 🏢 ENTERPRISE: Decode Windows-1253 bytes to Unicode string
   *
   * @param bytes - The raw bytes to decode
   * @returns Decoded Unicode string
   */
  decodeWindows1253(bytes: Uint8Array): string {
    return this.processBytes(bytes, (byte) => {
      const unicode = WINDOWS_1253_TO_UNICODE[byte];
      return unicode ? String.fromCharCode(unicode) : String.fromCharCode(byte);
    });
  }

  /**
   * 🏢 ENTERPRISE: Encode a string to Windows-1253 bytes for DXF export (ADR-636 Στάδιο 2 Φ2.2).
   *
   * The inverse of `decodeWindows1253` for every code point Windows-1253 actually **assigns**
   * (reusing the SAME table via `unicodeToWindows1253`, no second table): all Greek + covered
   * Latin/punctuation round-trip byte-exact, and ASCII (≤ 0x7F) is written 1:1 — so the whole
   * DXF string (pure-ASCII structure + Greek text) encodes in one pass.
   *
   * It is NOT a total inverse of decode: `decodeWindows1253` leniently Latin-1-passes the ~12
   * bytes cp1253 leaves unassigned (0x81, 0x88, …, 0xAA, 0xD2, 0xFF → U+0081…U+00FF), but those
   * code points are genuinely NOT representable in cp1253, so encode treats them as out-of-codepage.
   *
   * Characters OUTSIDE Windows-1253 (exotic symbols/CJK/emoji, or Latin-1 letters like Ò/ÿ the
   * Greek codepage can't hold — never Greek) are emitted as a `\U+XXXX` DXF unicode escape
   * (uppercase 4-hex, ASCII bytes) instead of a lossy `?`, so **no character is ever silently
   * dropped** and Nestor's own MTEXT importer (`text-engine/parser/mtext-tokenizer`) round-trips
   * them back. Code points > 0xFFFF fall back to `?` (0x3F) since `\U+XXXX` is 4-hex only.
   */
  encodeWindows1253(text: string): Uint8Array {
    const map = unicodeToWindows1253();
    const bytes: number[] = [];
    for (const ch of text) {
      const code = ch.codePointAt(0) ?? 0x3f;
      if (code <= 0x7f) {
        bytes.push(code); // ASCII identity (DXF structure + Latin text)
        continue;
      }
      const byte = map.get(code);
      if (byte !== undefined) {
        bytes.push(byte); // representable in Windows-1253 (all Greek)
      } else if (code <= 0xffff) {
        for (const c of `\\U+${code.toString(16).toUpperCase().padStart(4, '0')}`) {
          bytes.push(c.charCodeAt(0)); // lossless escape for out-of-codepage chars
        }
      } else {
        bytes.push(0x3f); // astral plane → '?' (no 4-hex escape)
      }
    }
    return new Uint8Array(bytes);
  }

  /**
   * 🏢 ENTERPRISE: Decode ISO-8859-7 bytes to Unicode string
   *
   * @param bytes - The raw bytes to decode
   * @returns Decoded Unicode string
   */
  decodeISO88597(bytes: Uint8Array): string {
    // Reuse the shared byte-loop SSoT (`processBytes`) — only the high-byte mapping
    // differs (ISO-8859-7 Greek block 0xB0–0xFE → U+0390+offset).
    return this.processBytes(bytes, (byte) => {
      if (byte >= 0xB0 && byte <= 0xFE) {
        return String.fromCharCode(0x0390 + (byte - 0xB0));
      }
      return String.fromCharCode(byte);
    });
  }

  /**
   * Helper: Process bytes with a mapper function
   */
  private processBytes(bytes: Uint8Array, mapper: (byte: number) => string): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte < 128) {
        result += String.fromCharCode(byte);
      } else {
        result += mapper(byte);
      }
    }
    return result;
  }

  /**
   * 🏢 ENTERPRISE: Check if content has valid Greek text
   *
   * @param content - The text content to check
   * @returns true if content contains Greek characters
   */
  hasGreekText(content: string): boolean {
    return /[\u0370-\u03FF\u1F00-\u1FFF]/.test(content);
  }

  /**
   * 🏢 ENTERPRISE: Check if content has encoding errors
   *
   * @param content - The text content to check
   * @returns true if content contains replacement characters
   */
  hasEncodingErrors(content: string): boolean {
    return /[�\uFFFD]/.test(content);
  }

  // ==========================================================================
  // 🏢 ENTERPRISE: SERVER-SIDE METHODS (for API routes)
  // ==========================================================================

  /**
   * 🏢 ENTERPRISE: Decode buffer with auto-detection (Server-side)
   *
   * Attempts to decode a buffer trying multiple encodings.
   * Optimized for Greek DXF files from AutoCAD.
   *
   * @param buffer - The buffer to decode (Node.js Buffer or Uint8Array)
   * @returns Object with content and detected encoding
   */
  decodeBufferWithAutoDetect(buffer: Uint8Array | Buffer): { content: string; encoding: SupportedEncoding } {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // 1. Try UTF-8 first
    const utf8Content = this.tryDecodeUTF8(bytes);
    if (utf8Content && !this.hasEncodingErrors(utf8Content)) {
      // Check if it looks like garbled Greek (UTF-8 misinterpreting Windows-1253)
      const hasGarbledGreek = this.looksLikeGarbledGreek(utf8Content);
      if (!hasGarbledGreek) {
        return { content: utf8Content, encoding: 'UTF-8' };
      }
    }

    // 2. Try Windows-1253 (most common for Greek AutoCAD)
    const win1253Content = this.decodeWindows1253(bytes);
    if (this.hasGreekText(win1253Content) && !this.hasEncodingErrors(win1253Content)) {
      return { content: win1253Content, encoding: 'Windows-1253' };
    }

    // 3. Try ISO-8859-7
    const isoContent = this.decodeISO88597(bytes);
    if (this.hasGreekText(isoContent) && !this.hasEncodingErrors(isoContent)) {
      return { content: isoContent, encoding: 'ISO-8859-7' };
    }

    // 4. Fallback: prefer Windows-1253 for Greek files
    if (win1253Content) {
      return { content: win1253Content, encoding: 'Windows-1253' };
    }

    // 5. Last resort: UTF-8
    return { content: utf8Content || '', encoding: 'UTF-8' };
  }

  /**
   * Try to decode bytes as UTF-8
   */
  private tryDecodeUTF8(bytes: Uint8Array): string | null {
    try {
      const decoder = new TextDecoder('utf-8', { fatal: false });
      return decoder.decode(bytes);
    } catch {
      return null;
    }
  }

  /**
   * Check if content looks like garbled Greek (UTF-8 misinterpretation)
   * Common patterns when Windows-1253 is read as UTF-8
   */
  private looksLikeGarbledGreek(content: string): boolean {
    // These patterns appear when Windows-1253 Greek is read as UTF-8
    const garbledPatterns = [
      /[\xC0-\xDF][\x80-\xBF]/,  // Invalid UTF-8 sequences
      /Î[±²³´µ¶·¸¹ºº»¼½¾¿]/,    // Common garbled Greek pattern
      /Ï[€‚ƒ„…†‡ˆ‰Š‹]/,        // Another common pattern
      /[ÎÏ][^\x00-\x7F]{2,}/,   // Multiple high bytes after Î/Ï
    ];

    for (const pattern of garbledPatterns) {
      if (pattern.test(content)) {
        return true;
      }
    }

    return false;
  }
}

// ============================================================================
// 🏢 ENTERPRISE: SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of the encoding service
 */
export const encodingService = new EncodingService();
