/**
 * Tests — IFC4 GlobalId Generator (ADR-369 §9 Q8) — Phase A1
 */

import {
  generateIfcGuid,
  encodeIfcGuidFromBytes,
  IFC_GUID_ALPHABET,
} from '../ifc-guid.service';
import { IFC_GUID_REGEX } from '@/subapps/dxf-viewer/bim/types/ifc-entity-mixin';

describe('ifc-guid.service', () => {
  // ─── Format guarantees ────────────────────────────────────────────────────

  describe('generateIfcGuid format', () => {
    it('returns 22-char string', () => {
      const guid = generateIfcGuid();
      expect(guid).toHaveLength(22);
    });

    it('uses only chars from IFC4 alphabet [0-9 A-Z a-z _ $]', () => {
      const guid = generateIfcGuid();
      for (const ch of guid) {
        expect(IFC_GUID_ALPHABET).toContain(ch);
      }
    });

    it('matches IFC_GUID_REGEX', () => {
      for (let i = 0; i < 100; i++) {
        expect(generateIfcGuid()).toMatch(IFC_GUID_REGEX);
      }
    });
  });

  // ─── Encoder determinism ──────────────────────────────────────────────────

  describe('encodeIfcGuidFromBytes', () => {
    it('all-zero bytes produce all-"0" GlobalId', () => {
      const bytes = new Uint8Array(16); // all zeros
      const guid = encodeIfcGuidFromBytes(bytes);
      expect(guid).toBe('0'.repeat(22));
    });

    it('deterministic: same bytes → same GlobalId', () => {
      const bytes = new Uint8Array([
        0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
        0xfe, 0xdc, 0xba, 0x98, 0x76, 0x54, 0x32, 0x10,
      ]);
      const a = encodeIfcGuidFromBytes(bytes);
      const b = encodeIfcGuidFromBytes(bytes);
      expect(a).toBe(b);
      expect(a).toHaveLength(22);
      expect(a).toMatch(IFC_GUID_REGEX);
    });

    it('different bytes → different GlobalId', () => {
      const bytesA = new Uint8Array(16);
      bytesA[15] = 0x01;
      const bytesB = new Uint8Array(16);
      bytesB[15] = 0x02;
      expect(encodeIfcGuidFromBytes(bytesA)).not.toBe(encodeIfcGuidFromBytes(bytesB));
    });

    it('throws on wrong byte count', () => {
      expect(() => encodeIfcGuidFromBytes(new Uint8Array(15))).toThrow();
      expect(() => encodeIfcGuidFromBytes(new Uint8Array(17))).toThrow();
    });

    it('all-0xff bytes — first char is 0x3 ("3"), last 21 chars are "$"', () => {
      const bytes = new Uint8Array(16).fill(0xff);
      const guid = encodeIfcGuidFromBytes(bytes);
      // top 2 bits of 128-bit all-ones = 0b11 = 3 → alphabet[3] = '3'
      // remaining 126 bits = 21 × 6 bits all-ones = 63 → alphabet[63] = '$'
      expect(guid[0]).toBe('3');
      expect(guid.slice(1)).toBe('$'.repeat(21));
    });
  });

  // ─── Uniqueness (1M generation) ───────────────────────────────────────────

  describe('uniqueness', () => {
    it(
      'generates 1,000,000 unique GUIDs (no collisions)',
      () => {
        const COUNT = 1_000_000;
        const seen = new Set<string>();
        for (let i = 0; i < COUNT; i++) {
          seen.add(generateIfcGuid());
        }
        expect(seen.size).toBe(COUNT);
      },
      60_000, // 60s timeout
    );
  });

  // ─── Alphabet integrity ───────────────────────────────────────────────────

  describe('IFC_GUID_ALPHABET', () => {
    it('contains exactly 64 unique chars', () => {
      expect(IFC_GUID_ALPHABET).toHaveLength(64);
      expect(new Set(IFC_GUID_ALPHABET).size).toBe(64);
    });

    it('matches IFC4 canonical alphabet order', () => {
      expect(IFC_GUID_ALPHABET).toBe(
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$',
      );
    });
  });
});
