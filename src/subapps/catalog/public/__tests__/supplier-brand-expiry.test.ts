/**
 * ADR-923 §16 — ειδοποίηση πριν από τη λήξη μάρκας: ποιο σκαλί λέγεται σήμερα, μία φορά το καθένα, και η ανανέωση ξαναρχίζει.
 */
import { BRAND_EXPIRED_NOTICE_DAYS, brandExpiryNoticeDue, withBrandExpiryNotice } from '../supplier-brand-expiry';
import { validUntilOfDate } from '../supplier-brand-claim-rules';
import type { BrandExpiryNoticeStage, SupplierBrandGrant } from '../../types/supplier-brand-claim';

const grantUntil = (date: string, expiryNotice?: BrandExpiryNoticeStage): SupplierBrandGrant => ({
  relation: 'manufacturer',
  validUntil: validUntilOfDate(date) ?? '',
  grantedAt: '2026-01-01T00:00:00.000Z',
  grantedBy: 'admin',
  ...(expiryNotice ? { expiryNotice } : {}),
});

describe('brandExpiryNoticeDue — τα σκαλιά του μητρώου λήξεων', () => {
  it.each([
    ['μακριά (31 ημέρες)', '2026-12-08', null],
    ['30 ημέρες', '2026-12-07', 'd30'],
    ['8 ημέρες', '2026-11-15', 'd30'],
    ['7 ημέρες', '2026-11-14', 'd7'],
    ['σήμερα', '2026-11-07', 'd0'],
    ['χθες', '2026-11-06', 'expired'],
  ] as const)('%s ⇒ %s', (_name, date, stage) => {
    expect(brandExpiryNoticeDue(grantUntil(date), '2026-11-07')).toBe(stage);
  });

  it('χωρίς δικαίωμα ⇒ τίποτα', () => {
    expect(brandExpiryNoticeDue(null, '2026-11-07')).toBeNull();
  });

  it(`«έληξε» λέγεται για ${BRAND_EXPIRED_NOTICE_DAYS} ημέρες, μετά σιωπή`, () => {
    expect(brandExpiryNoticeDue(grantUntil('2026-10-31'), '2026-11-07')).toBe('expired');
    expect(brandExpiryNoticeDue(grantUntil('2026-10-30'), '2026-11-07')).toBeNull();
  });
});

describe('ένα μήνυμα ανά σκαλί, ποτέ το ίδιο δύο φορές', () => {
  it('🔴 το ειπωμένο σκαλί δεν ξαναλέγεται', () => {
    expect(brandExpiryNoticeDue(grantUntil('2026-11-14', 'd7'), '2026-11-07')).toBeNull();
  });

  it('🔴 ειπωμένο πιο επείγον ⇒ το λιγότερο επείγον δεν λέγεται ποτέ', () => {
    expect(brandExpiryNoticeDue(grantUntil('2026-11-20', 'd7'), '2026-11-07')).toBeNull();
  });

  it('νέο, πιο επείγον σκαλί λέγεται', () => {
    expect(brandExpiryNoticeDue(grantUntil('2026-11-14', 'd30'), '2026-11-07')).toBe('d7');
  });

  it('🔴 η σημείωση πάει μόνο προς το πιο επείγον: δύο σαρώσεις δεν τη γυρίζουν πίσω', () => {
    const said = withBrandExpiryNotice(grantUntil('2026-11-14'), 'd7');
    expect(withBrandExpiryNotice(said, 'd30').expiryNotice).toBe('d7');
    expect(withBrandExpiryNotice(said, 'd0').expiryNotice).toBe('d0');
  });

  it('η ανανέωση (νέο grant, χωρίς σημείωση) ξαναρχίζει από την αρχή', () => {
    expect(brandExpiryNoticeDue(grantUntil('2026-12-01'), '2026-11-07')).toBe('d30');
  });
});
