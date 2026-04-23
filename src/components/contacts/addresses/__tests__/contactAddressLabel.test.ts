/**
 * Unit tests for the shared ADR-319 contact address label resolver.
 *
 * Locks the "custom label wins only for `other`" contract so future
 * callers don't accidentally display raw customLabel values for
 * semantically-typed addresses (headquarters, warehouse, etc.).
 *
 * @module components/contacts/addresses/__tests__/contactAddressLabel
 * @see ADR-319 Contact Address Type Registry
 */

import { resolveContactAddressLabel } from '../contactAddressLabel';
import type { ContactAddressType } from '@/types/contacts/address-types';

const tAddr = (key: string) => `__${key}__`;

describe('resolveContactAddressLabel', () => {
  describe('type = other — custom label branch', () => {
    it('returns trimmed customLabel when non-empty', () => {
      expect(resolveContactAddressLabel('other', 'Αποθήκη Β', tAddr)).toBe('Αποθήκη Β');
    });

    it('trims leading/trailing whitespace from customLabel', () => {
      expect(resolveContactAddressLabel('other', '  Depot  ', tAddr)).toBe('Depot');
    });

    it('falls back to t("types.other") when customLabel is empty string', () => {
      expect(resolveContactAddressLabel('other', '', tAddr)).toBe('__types.other__');
    });

    it('falls back to t("types.other") when customLabel is whitespace-only', () => {
      expect(resolveContactAddressLabel('other', '   ', tAddr)).toBe('__types.other__');
    });

    it('falls back to t("types.other") when customLabel is undefined', () => {
      expect(resolveContactAddressLabel('other', undefined, tAddr)).toBe('__types.other__');
    });
  });

  describe('non-other types — custom label is ignored', () => {
    it('returns t("types.headquarters") regardless of customLabel', () => {
      expect(resolveContactAddressLabel('headquarters', 'Custom HQ', tAddr)).toBe(
        '__types.headquarters__',
      );
    });

    it('returns t("types.home") when customLabel is provided', () => {
      expect(resolveContactAddressLabel('home', 'My Home', tAddr)).toBe('__types.home__');
    });

    it('returns t("types.central_service") when customLabel is provided', () => {
      expect(resolveContactAddressLabel('central_service', 'Κεντρική', tAddr)).toBe(
        '__types.central_service__',
      );
    });

    it('returns t("types.warehouse") when customLabel is undefined', () => {
      expect(resolveContactAddressLabel('warehouse', undefined, tAddr)).toBe(
        '__types.warehouse__',
      );
    });
  });

  describe('i18n key passthrough', () => {
    it('calls tAddr with exact key "types.<type>"', () => {
      const calls: string[] = [];
      const spy = (key: string) => { calls.push(key); return key; };

      resolveContactAddressLabel('branch', undefined, spy);
      expect(calls).toEqual(['types.branch']);
    });

    it('does NOT call tAddr when customLabel wins for "other"', () => {
      const calls: string[] = [];
      const spy = (key: string) => { calls.push(key); return key; };

      resolveContactAddressLabel('other', 'Custom', spy);
      expect(calls).toHaveLength(0);
    });
  });

  describe('regression guards', () => {
    it('never returns undefined — always a string', () => {
      const types: ContactAddressType[] = ['headquarters', 'home', 'other', 'central_service'];
      types.forEach(t => {
        expect(typeof resolveContactAddressLabel(t, undefined, tAddr)).toBe('string');
        expect(typeof resolveContactAddressLabel(t, 'someLabel', tAddr)).toBe('string');
      });
    });

    it('type=other with trimmed-to-empty label → t key, not empty string', () => {
      const result = resolveContactAddressLabel('other', '  ', tAddr);
      expect(result).toBe('__types.other__');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
