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
   * 🏢 ENTERPRISE: Decode ISO-8859-7 bytes to Unicode string
   *
   * @param bytes - The raw bytes to decode
   * @returns Decoded Unicode string
   */
  decodeISO88597(bytes: Uint8Array): string {
    let result = '';
    for (let i = 0; i < bytes.length; i++) {
      const byte = bytes[i];
      if (byte < 128) {
        result += String.fromCharCode(byte);
      } else if (byte >= 0xB0 && byte <= 0xFE) {
        const greekOffset = byte - 0xB0;
        const unicodeStart = 0x0390;
        result += String.fromCharCode(unicodeStart + greekOffset);
      } else {
        result += String.fromCharCode(byte);
      }
    }
    return result;
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
}

// ============================================================================
// 🏢 ENTERPRISE: SINGLETON EXPORT
// ============================================================================

/**
 * Singleton instance of the encoding service
 */
export const encodingService = new EncodingService();
