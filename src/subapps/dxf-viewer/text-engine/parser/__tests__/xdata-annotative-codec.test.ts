/**
 * ADR-344 Phase 11.E — Tests for XDATA annotative codec.
 *
 * Verifies decode/encode round-trip and adjacent application-block isolation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  parseAnnotativeXData,
  serializeAnnotativeXData,
  formatXDataLines,
  XDATA_APP_NAME,
  XDATA_GROUP_APPNAME,
  XDATA_GROUP_INT16,
  XDATA_GROUP_HANDLE,
  type RawXDataPair,
} from '../xdata-annotative-codec';
import type { EntityAnnotationScale } from '../../../types/entities';

const SCALE_1_100: EntityAnnotationScale = { name: '1:100', paperHeight: 2.5, modelHeight: 250 };
const SCALE_1_50: EntityAnnotationScale = { name: '1:50', paperHeight: 2.5, modelHeight: 125 };

const HANDLE_1_100 = 'A1';
const HANDLE_1_50 = 'A2';

function resolver(handle: string): EntityAnnotationScale | null {
  if (handle === HANDLE_1_100) return SCALE_1_100;
  if (handle === HANDLE_1_50) return SCALE_1_50;
  return null;
}

function handleFor(scale: EntityAnnotationScale): string {
  if (scale.name === '1:100') return HANDLE_1_100;
  if (scale.name === '1:50') return HANDLE_1_50;
  throw new Error(`No handle for ${scale.name}`);
}

describe('xdata-annotative-codec', () => {
  describe('parseAnnotativeXData', () => {
    it('returns null when there is no AcDbAnnotativeData block', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: 'OtherAppName' },
        { code: XDATA_GROUP_HANDLE, value: 'ZZ' },
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toBeNull();
    });

    it('extracts a single scale from the canonical pair sequence', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_INT16, value: '1' },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toEqual([SCALE_1_100]);
    });

    it('extracts multiple scales in declaration order', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_INT16, value: '2' },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_50 },
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toEqual([SCALE_1_100, SCALE_1_50]);
    });

    it('skips handles that fail resolver lookup', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
        { code: XDATA_GROUP_HANDLE, value: 'UNKNOWN' },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_50 },
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toEqual([SCALE_1_100, SCALE_1_50]);
    });

    it('isolates pairs from another adjacent application block', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: 'OtherApp' },
        { code: XDATA_GROUP_HANDLE, value: 'XX' }, // belongs to OtherApp, ignore
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toEqual([SCALE_1_100]);
    });

    it('stops at the next 1001 marker (does not bleed into next block)', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
        { code: XDATA_GROUP_APPNAME, value: 'Trailing' },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_50 }, // belongs to "Trailing"
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toEqual([SCALE_1_100]);
    });

    it('returns null when block has zero handles', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_INT16, value: '0' },
      ];
      expect(parseAnnotativeXData(pairs, resolver)).toBeNull();
    });
  });

  describe('serializeAnnotativeXData', () => {
    it('returns empty list when no scales', () => {
      expect(serializeAnnotativeXData([], handleFor)).toEqual([]);
    });

    it('emits 1001/1070/1071 sequence in AutoCAD order', () => {
      const out = serializeAnnotativeXData([SCALE_1_100, SCALE_1_50], handleFor);
      expect(out).toEqual([
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_INT16, value: '2' },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_50 },
      ]);
    });
  });

  describe('round-trip identity', () => {
    it('encode → decode preserves the scale list', () => {
      const input = [SCALE_1_100, SCALE_1_50];
      const encoded = serializeAnnotativeXData(input, handleFor);
      const decoded = parseAnnotativeXData(encoded, resolver);
      expect(decoded).toEqual(input);
    });
  });

  describe('formatXDataLines', () => {
    it('produces two-line-per-pair canonical DXF output', () => {
      const pairs: RawXDataPair[] = [
        { code: XDATA_GROUP_APPNAME, value: XDATA_APP_NAME },
        { code: XDATA_GROUP_HANDLE, value: HANDLE_1_100 },
      ];
      expect(formatXDataLines(pairs)).toEqual([
        '1001',
        XDATA_APP_NAME,
        '1071',
        HANDLE_1_100,
      ]);
    });
  });
});
