/**
 * ⚓ ADR-777 §8.102 — ακίνητο **υπό κατασκευή**: η τρίτη απάντηση «γιατί δεν υπάρχει κλάση», η εκτίμηση της ΜΕΑ, και
 * οι υπενθυμίσεις του κύκλου ζωής.
 *
 * Ο νόμος (ν. 4122/2013 άρθ. 12 §3): πριν την ολοκλήρωση ΠΕΑ **δεν** εκδίδεται· ο πωλητής γνωστοποιεί την εκτίμηση της
 * ΜΕΑ. Άρα η εκτίμηση **ποτέ** δεν γίνεται κλάση ΠΕΑ, ποτέ αξίωση νομιμότητας, και η παραπομπή της ποτέ δημόσια.
 */

import {
  UNDECLARED_ENERGY_CERTIFICATE,
  applyEnergyCertificatePatch,
  energyCertificatePatchSchema,
  energyCertificateSchema,
  listedEnergyCertificateOf,
  readEnergyCertificate,
  relistedProjectionOf,
  sameEnergyCertificate,
} from '../energy-certificate';
import { energyPerformanceClaimOf, withEnergyPerformanceClaim } from '../energy-certificate-claim';
import { energyConstructionNoticeOf } from '../energy-construction-notice';
import { energyFormSliceOf, energyOfForm } from '../energy-certificate-form';

const SALE = { type: 'apartment', offerKinds: ['sell'] } as const;
const PROJECTION = { class: 'A', scope: 'building', sourceFileId: 'file_mea_1' } as const;
const UNDER_CONSTRUCTION = { absence: 'under-construction', projection: PROJECTION };
const AT = '2026-11-17T10:00:00.000Z';

describe('Π1 — ανάγνωση: η εκτίμηση ζει ΜΟΝΟ δίπλα στο «υπό κατασκευή»', () => {
  it('«υπό κατασκευή» + εκτίμηση ⇒ διαβάζονται αυτούσια', () => {
    const block = readEnergyCertificate(UNDER_CONSTRUCTION);
    expect(block.class).toBeNull();
    expect(block.absence).toBe('under-construction');
    expect(block.projection).toEqual(PROJECTION);
  });

  it('🔴 ορφανή εκτίμηση ⇒ `null`: δίπλα σε «υπό έκδοση», σε «εξαιρείται», χωρίς απάντηση, ή δίπλα σε κλάση ΠΕΑ', () => {
    for (const absence of ['pending', 'exempt', null]) {
      expect(readEnergyCertificate({ absence, projection: PROJECTION }).projection).toBeNull();
    }
    const certified = readEnergyCertificate({ class: 'B', ...UNDER_CONSTRUCTION });
    expect(certified.projection).toBeNull();
    expect(certified.absence).toBeNull();
  });

  it('χωρίς αναμενόμενη κλάση δεν υπάρχει εκτίμηση· άκυρη εμβέλεια ή παραπομπή ⇒ `null` ανά πεδίο', () => {
    expect(readEnergyCertificate({ absence: 'under-construction', projection: { scope: 'unit' } }).projection).toBeNull();
    expect(readEnergyCertificate({ absence: 'under-construction', projection: { class: 'Z' } }).projection).toBeNull();
    expect(
      readEnergyCertificate({ absence: 'under-construction', projection: { class: 'C', scope: 'tower', sourceFileId: '../x' } })
        .projection,
    ).toEqual({ class: 'C', scope: null, sourceFileId: null });
  });

  it('«υπό κατασκευή» χωρίς εκτίμηση στέκει μόνο του', () => {
    expect(readEnergyCertificate({ absence: 'under-construction' })).toEqual({
      ...UNDECLARED_ENERGY_CERTIFICATE,
      absence: 'under-construction',
    });
  });
});

describe('Π2 — σχήμα και διόρθωση', () => {
  it('το ακέραιο μπλοκ δέχεται την εκτίμηση· η χθεσινή καρτέλα χωρίς `projection` δεν παίρνει 400', () => {
    expect(energyCertificateSchema.safeParse({ ...UNDECLARED_ENERGY_CERTIFICATE, ...UNDER_CONSTRUCTION }).success).toBe(true);
    const { projection: _omitted, ...yesterday } = UNDECLARED_ENERGY_CERTIFICATE;
    expect(energyCertificateSchema.safeParse(yesterday).success).toBe(true);
  });

  it('εκτίμηση χωρίς κλάση ή με άγνωστο κλειδί ⇒ απόρριψη', () => {
    expect(energyCertificatePatchSchema.safeParse({ projection: { scope: 'unit', sourceFileId: null } }).success).toBe(false);
    expect(energyCertificatePatchSchema.safeParse({ projection: { ...PROJECTION, inspector: 'x' } }).success).toBe(false);
  });

  it('αλλαγή απάντησης από «υπό κατασκευή» σε «υπό έκδοση» σβήνει την εκτίμηση· δήλωση κλάσης ΠΕΑ επίσης', () => {
    const current = readEnergyCertificate(UNDER_CONSTRUCTION);
    expect(applyEnergyCertificatePatch(current, { absence: 'pending' }).projection).toBeNull();
    expect(applyEnergyCertificatePatch(current, { class: 'A' }).projection).toBeNull();
  });

  it('🔑 η αλλαγή αναμενόμενης κλάσης ΔΕΝ σβήνει την παραπομπή: είναι παραπομπή, όχι ανάγνωση του αρχείου', () => {
    const current = readEnergyCertificate(UNDER_CONSTRUCTION);
    const next = applyEnergyCertificatePatch(current, { projection: { ...PROJECTION, class: 'B+' } });
    expect(next.projection).toEqual({ ...PROJECTION, class: 'B+' });
  });

  it('η σύγκριση βλέπει την εκτίμηση', () => {
    const a = readEnergyCertificate(UNDER_CONSTRUCTION);
    expect(sameEnergyCertificate(a, readEnergyCertificate(UNDER_CONSTRUCTION))).toBe(true);
    expect(sameEnergyCertificate(a, readEnergyCertificate({ ...UNDER_CONSTRUCTION, projection: { ...PROJECTION, scope: 'unit' } }))).toBe(false);
  });

  it('η φόρμα του γραφείου κρατά την εκτίμηση μετ\' επιστροφής', () => {
    const block = readEnergyCertificate(UNDER_CONSTRUCTION);
    expect(energyOfForm(energyFormSliceOf(block))).toEqual(block);
  });
});

describe('Π3 — 🔴 η εκτίμηση ΔΕΝ είναι ΠΕΑ', () => {
  it('καμία αξίωση νομιμότητας· και υπάρχουσα αυτοδηλωμένη αξίωση φεύγει', () => {
    const block = readEnergyCertificate(UNDER_CONSTRUCTION);
    expect(energyPerformanceClaimOf(block, 'prop_1', AT)).toBeNull();
    const before = withEnergyPerformanceClaim([], readEnergyCertificate({ class: 'B' }), 'prop_1', AT);
    expect(before).toHaveLength(1);
    expect(withEnergyPerformanceClaim(before, block, 'prop_1', AT)).toEqual([]);
  });

  it('το δημόσιο κουτί δείχνει την εκτίμηση ΧΩΡΙΣ την παραπομπή στο αρχείο', () => {
    const box = listedEnergyCertificateOf(SALE, UNDER_CONSTRUCTION);
    expect(box?.absence).toBe('under-construction');
    expect(box?.projection).toEqual({ class: 'A', scope: 'building' });
    expect(Object.keys(box?.projection ?? {})).not.toContain('sourceFileId');
  });

  it('ο κρίκος 30 και η προβολή απαντούν το ίδιο', () => {
    const projected = listedEnergyCertificateOf(SALE, UNDER_CONSTRUCTION);
    const relisted = relistedProjectionOf(SALE, projected);
    expect(relisted).toEqual(projected);
  });
});

describe('Π4 — οι υπενθυμίσεις του κύκλου ζωής', () => {
  const nothing = { class: null, absence: null } as const;

  it('μονάδα που χτίζεται (ή πρόχειρη) χωρίς απάντηση ⇒ πρόταση «υπό κατασκευή»', () => {
    expect(energyConstructionNoticeOf('under-construction', nothing)).toBe('suggest-under-construction');
    expect(energyConstructionNoticeOf('draft', nothing)).toBe('suggest-under-construction');
    expect(energyConstructionNoticeOf('underConstruction', nothing)).toBe('suggest-under-construction');
  });

  it('έτοιμη μονάδα που λέει ακόμη «υπό κατασκευή» ⇒ προειδοποίηση «οφείλεται ΠΕΑ»', () => {
    expect(energyConstructionNoticeOf('ready', { class: null, absence: 'under-construction' })).toBe('completed-without-certificate');
  });

  it('συμφωνία ή άγνωστη κατάσταση ⇒ σιωπή', () => {
    expect(energyConstructionNoticeOf('under-construction', { class: null, absence: 'under-construction' })).toBeNull();
    expect(energyConstructionNoticeOf('ready', { class: 'B', absence: null })).toBeNull();
    expect(energyConstructionNoticeOf('ready', nothing)).toBeNull();
    expect(energyConstructionNoticeOf(undefined, nothing)).toBeNull();
    expect(energyConstructionNoticeOf('tower', nothing)).toBeNull();
  });
});
