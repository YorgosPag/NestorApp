/**
 * @fileoverview Κάλυψη κενού του PM (ADR-327 §8.5) — ο κανόνας μεταβολής.
 *
 * Κ1 μία ανά γραμμή RFQ: νέα τιμή αντικαθιστά, οι άλλες γραμμές μένουν ·
 * Κ2 ιδεμποτικό: ίδιο ποσό + ίδια σημείωση ⇒ `changed: false` · κενή σημείωση ≡ καμία ·
 * Κ3 `amount: null` = αφαίρεση· αφαίρεση ανύπαρκτης ⇒ `changed: false` ·
 * Κ4 στρογγύλευση σε λεπτά.
 */

import type { QuoteLevelingPlug } from '../../types/quote';
import { describePlugValue, levelingPlugAuditChange, upsertLevelingPlug } from '../leveling-plugs';

const STAMP = { setBy: 'u1', setAt: null as unknown as QuoteLevelingPlug['setAt'] };
const plug = (rfqLineId: string, amount: number, note: string | null = null): QuoteLevelingPlug => ({ rfqLineId, amount, note, ...STAMP });

describe('upsertLevelingPlug', () => {
  it('Κ1 — αντικαθιστά μόνο τη γραμμή της', () => {
    const r = upsertLevelingPlug([plug('L1', 10), plug('L2', 20)], { rfqLineId: 'L1', amount: 15, note: 'x' }, STAMP);
    expect(r.changed).toBe(true);
    expect(r.previous?.amount).toBe(10);
    expect(r.plugs.map((p) => [p.rfqLineId, p.amount, p.note])).toEqual([['L2', 20, null], ['L1', 15, 'x']]);
  });

  it('Κ2 — ίδια τιμή ⇒ καμία αλλαγή · κενή σημείωση ≡ null', () => {
    expect(upsertLevelingPlug([plug('L1', 10)], { rfqLineId: 'L1', amount: 10, note: '   ' }, STAMP).changed).toBe(false);
  });

  it('Κ3 — αφαίρεση', () => {
    const r = upsertLevelingPlug([plug('L1', 10)], { rfqLineId: 'L1', amount: null, note: null }, STAMP);
    expect(r).toMatchObject({ changed: true, plugs: [] });
    expect(upsertLevelingPlug([], { rfqLineId: 'L1', amount: null, note: null }, STAMP).changed).toBe(false);
  });

  it('Κ4 — λεπτά · ιστορικό', () => {
    expect(upsertLevelingPlug([], { rfqLineId: 'L1', amount: 10.005, note: null }, STAMP).plugs[0].amount).toBe(10.01);
    expect(describePlugValue(null)).toBe('—');
    expect(describePlugValue({ amount: 950 })).toBe('950');
  });
});

/**
 * ADR-327 (2026-10-28) — η γραμμή ιστορικού ως αλλαγή ΣΥΛΛΟΓΗΣ.
 * Ι1 ορισμός/αλλαγή/αφαίρεση ⇒ `added`/`modified`/`removed` · η γραμμή = `itemKey` + `itemLabel` ·
 * Ι2 η αιτιολογία μπαίνει ΜΟΝΟ όταν άλλαξε · Ι3 🔴 κάθε ετικέτα που παράγει λύνεται σε el ΚΑΙ en
 * (αυτό ήταν το ελάττωμα: `levelingPlugs.rfqln_…` — ωμή διαδρομή, άλυτη από κάθε μητρώο).
 */
describe('levelingPlugAuditChange', () => {
  const LINE = { id: 'rfqln_1', label: 'ΔΟΚΙΜΗ — γραμμή κάλυψης κενού' };
  const p = (amount: number, note: string | null = null) => ({ amount, note });

  it('Ι1 — op ανά μετάβαση, γραμμή ως στοιχείο συλλογής', () => {
    expect(levelingPlugAuditChange(null, p(150, 'x'), LINE)).toMatchObject({
      field: 'levelingPlugs', kind: 'collection', op: 'added', itemKey: 'rfqln_1', itemLabel: LINE.label, oldValue: null, newValue: 150,
    });
    expect(levelingPlugAuditChange(p(150), p(120), LINE).op).toBe('modified');
    expect(levelingPlugAuditChange(p(150, 'x'), null, LINE)).toMatchObject({ op: 'removed', oldValue: 150, newValue: null });
  });

  it('Ι2 — αιτιολογία μόνο όταν άλλαξε', () => {
    const same = levelingPlugAuditChange(p(150, 'x'), p(120, 'x'), LINE);
    expect(same.subChanges?.map((s) => s.subField)).toEqual(['levelingPlugAmount']);
    const changed = levelingPlugAuditChange(p(150, 'x'), p(150, 'y'), LINE);
    expect(changed.subChanges?.find((s) => s.subField === 'levelingPlugNote')).toMatchObject({ oldValue: 'x', newValue: 'y' });
  });

  it.each(['el', 'en'] as const)('Ι3 🔴 [%s] πεδίο + υπο-πεδία λύνονται από το common-audit', (lang) => {
    const fields = (require(`@/i18n/locales/${lang}/common-audit.json`) as { audit: { fields: Record<string, unknown> } }).audit.fields;
    const change = levelingPlugAuditChange(p(1, 'a'), p(2, 'b'), LINE);
    expect(typeof (fields.quote as Record<string, unknown> | undefined)?.[change.field]).toBe('string');
    for (const sub of change.subChanges ?? []) expect(typeof fields[sub.subField]).toBe('string');
  });
});
