/**
 * ADR-901 §7 — άγκυρες του καταλόγου δικαιολογητικών. Ο κατάλογος είναι δεδομένα που
 * θα διορθώνονται χωρίς κώδικα (Φ0)· αυτές οι άγκυρες κρατούν κάθε διόρθωση έγκυρη.
 */

import elConveyance from '@/i18n/locales/el/conveyance.json';
import enConveyance from '@/i18n/locales/en/conveyance.json';
import { CONVEYANCE_CHECKLIST, CONVEYANCE_PROCEDURES, itemsForProfile } from '@/config/conveyance-checklist/catalog';
import { CONVEYANCE_FACT_IDS, CONVEYANCE_PROFILES } from '@/config/conveyance-checklist/types';
import { LEVEL_ENTITY_TYPES } from '@/lib/conveyance/evidence-match';
import { findEntryPoint } from '@/config/upload-entry-points/queries';
import { lookupLocaleString } from '@/i18n/locale-key-lookup';

describe('ADR-901 κατάλογος — άγκυρες', () => {
  it('ids μοναδικά (αποθηκεύονται στις αποκλίσεις — ποτέ διπλά)', () => {
    const ids = CONVEYANCE_CHECKLIST.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('Α7: κάθε entryPointId υπάρχει για τουλάχιστον έναν τύπο του επιπέδου του', () => {
    const orphans: string[] = [];
    for (const item of CONVEYANCE_CHECKLIST) {
      if (item.satisfaction.kind !== 'files') continue;
      for (const matcher of item.satisfaction.matchers) {
        for (const entryPointId of matcher.entryPointIds) {
          const exists = LEVEL_ENTITY_TYPES[matcher.level].some((type) => findEntryPoint(type, entryPointId));
          if (!exists) orphans.push(`${item.id} → ${matcher.level}:${entryPointId}`);
        }
      }
    }
    expect(orphans).toEqual([]);
  });

  it('Α7: γραμμή «files» έχει ΤΟΥΛΑΧΙΣΤΟΝ έναν matcher με entry point (κανένα σιωπηλό κενό)', () => {
    const empty = CONVEYANCE_CHECKLIST.filter(
      (item) => item.satisfaction.kind === 'files' && !item.satisfaction.matchers.some((m) => m.entryPointIds.length > 0),
    );
    expect(empty.map((item) => item.id)).toEqual([]);
  });

  it('κάθε labelKey υπάρχει σε el ΚΑΙ en', () => {
    const missing = CONVEYANCE_CHECKLIST.flatMap((item) => [
      ...(lookupLocaleString(elConveyance, item.labelKey) !== undefined ? [] : [`el:${item.labelKey}`]),
      ...(lookupLocaleString(enConveyance, item.labelKey) !== undefined ? [] : [`en:${item.labelKey}`]),
    ]);
    expect(missing).toEqual([]);
  });

  it('κάθε γεγονός και κάθε διαδικασία έχει κείμενο σε el ΚΑΙ en', () => {
    const keys = [
      ...CONVEYANCE_FACT_IDS.map((fact) => `facts.${fact}.question`),
      ...CONVEYANCE_PROCEDURES.flatMap((p) => [`procedures.${p.id}.title`, `procedures.${p.id}.description`]),
    ];
    const missing = keys.filter(
      (key) => lookupLocaleString(elConveyance, key) === undefined || lookupLocaleString(enConveyance, key) === undefined,
    );
    expect(missing).toEqual([]);
  });

  it('κάθε item διαδικασίας υπάρχει στον κατάλογο', () => {
    const known = new Set(CONVEYANCE_CHECKLIST.map((item) => item.id));
    const dangling = CONVEYANCE_PROCEDURES.flatMap((p) => p.itemIds.filter((id) => !known.has(id)).map((id) => `${p.id}:${id}`));
    expect(dangling).toEqual([]);
  });

  it('Α4 (δεδομένα): έγγραφα πωλητή ΠΟΤΕ σε αγοραστή / δικηγόρο αγοραστή — και αντίστροφα', () => {
    const leaks = CONVEYANCE_CHECKLIST.filter(
      (item) =>
        (item.section === 'seller' && (item.visibleTo.includes('buyer') || item.visibleTo.includes('buyer_lawyer'))) ||
        (item.section === 'buyer' && (item.visibleTo.includes('seller') || item.visibleTo.includes('seller_lawyer'))),
    );
    expect(leaks.map((item) => item.id)).toEqual([]);
  });

  it('κάθε γραμμή έχει έναν τουλάχιστον θεατή και verifiedAt null ή ISO', () => {
    const bad = CONVEYANCE_CHECKLIST.filter(
      (item) => item.visibleTo.length === 0 || (item.verifiedAt !== null && Number.isNaN(Date.parse(item.verifiedAt))),
    );
    expect(bad.map((item) => item.id)).toEqual([]);
  });

  it('κάθε προφίλ έχει μη κενό κατάλογο', () => {
    for (const profile of CONVEYANCE_PROFILES) expect(itemsForProfile(profile).length).toBeGreaterThan(0);
  });
});
