/**
 * ⚓ ADR-777 §8.94 — το μπλοκ του ενεργειακού πιστοποιητικού: αναγνώστης · διόρθωση · κριτής · κουτί · αξίωση.
 *
 * Ό,τι κρίνεται εδώ κρίνεται **μία** φορά για ιδιώτη και εταιρεία, και από εκεί φεύγει στη δημόσια αγγελία.
 */

import { ENERGY_CLASSES } from '@/constants/energy-classes';
import type { LegalityClaim } from '@/lib/legality/legality-claim';
import { claimAuthorityIsWellFormed, claimSubjectIsWellFormed } from '@/lib/legality/legality-claim';
import { legalitySignalFor } from '@/lib/legality/legality-signal';

import {
  ENERGY_CERTIFICATE_ABSENCES,
  UNDECLARED_ENERGY_CERTIFICATE,
  applyEnergyCertificatePatch,
  certificateValidUntil,
  energyCertificatePatchSchema,
  energyCertificateSchema,
  listedEnergyCertificateOf,
  raisesEnergyCertificateQuestion,
  readEnergyCertificate,
  relistedEnergyCertificateOf,
  sameEnergyCertificate,
  storedEnergyCertificateSchema,
  type EnergyCertificate,
} from '../energy-certificate';
import { energyPerformanceClaimOf, withEnergyPerformanceClaim } from '../energy-certificate-claim';
import { energyFormSliceOf, energyOfForm, patchedEnergyFormSlice } from '../energy-certificate-form';
import { ENERGY_CERTIFICATE_ABSENCE_KEY, ENERGY_CLASS_LABEL_KEY } from '../energy-certificate-keys';

const FULL: EnergyCertificate = {
  class: 'B+',
  primaryEnergy: 132.4,
  co2Emissions: 38.1,
  issuedOn: '2024-03-12',
  absence: null,
};

describe('Α1 — ανάγνωση: άκυρη τιμή ⇒ `null`, ποτέ ρίψη, ποτέ «διόρθωση»', () => {
  it('τίποτα αποθηκευμένο ⇒ «τίποτα δηλωμένο»', () => {
    for (const raw of [undefined, null, 'B', 7, [], {}]) {
      expect(readEnergyCertificate(raw)).toEqual(UNDECLARED_ENERGY_CERTIFICATE);
    }
  });

  it('πλήρες μπλοκ διαβάζεται αυτούσιο', () => {
    expect(readEnergyCertificate(FULL)).toEqual(FULL);
  });

  it('🔴 η `B+` είναι κλάση — ήταν η τιμή που έλειπε από το λεξιλόγιο του ακινήτου', () => {
    expect(readEnergyCertificate({ class: 'B+' }).class).toBe('B+');
  });

  it('άγνωστη κλάση ⇒ καμία (ούτε «η πιο κοντινή»): το ελληνικό Η δεν είναι το λατινικό H', () => {
    for (const unknown of ['H', 'Η', 'a', 'A++', '', 3]) {
      expect(readEnergyCertificate({ class: unknown }).class).toBeNull();
    }
  });

  it('αριθμοί εκτός ορίων ή με δεύτερο δεκαδικό ⇒ `null`, η κλάση μένει', () => {
    const read = readEnergyCertificate({ class: 'C', primaryEnergy: 40_000, co2Emissions: 12.34 });
    expect(read).toEqual({ ...UNDECLARED_ENERGY_CERTIFICATE, class: 'C' });
    expect(readEnergyCertificate({ class: 'C', primaryEnergy: -1 }).primaryEnergy).toBeNull();
    expect(readEnergyCertificate({ class: 'C', primaryEnergy: Number.NaN }).primaryEnergy).toBeNull();
  });

  it('το μηδέν είναι αριθμός (κτίριο μηδενικής κατανάλωσης), όχι «δεν δηλώθηκε»', () => {
    expect(readEnergyCertificate({ class: 'A+', primaryEnergy: 0, co2Emissions: 0 })).toMatchObject({
      primaryEnergy: 0,
      co2Emissions: 0,
    });
  });

  it('ανύπαρκτη ημέρα ⇒ `null`', () => {
    expect(readEnergyCertificate({ class: 'C', issuedOn: '2024-02-31' }).issuedOn).toBeNull();
    expect(readEnergyCertificate({ class: 'C', issuedOn: '12/03/2024' }).issuedOn).toBe('2024-03-12');
  });
});

describe('Α2 — ποτέ ορφανός προσδιοριστής', () => {
  it('🔴 αριθμοί και ημερομηνία ΧΩΡΙΣ κλάση ⇒ `null` (δεν προσδιορίζουν τίποτα)', () => {
    const read = readEnergyCertificate({ ...FULL, class: null });
    expect(read).toEqual(UNDECLARED_ENERGY_CERTIFICATE);
  });

  it('🔴 «υπό έκδοση» δίπλα σε κλάση ⇒ `null`: η `absence` λέει γιατί ΔΕΝ υπάρχει κλάση', () => {
    expect(readEnergyCertificate({ ...FULL, absence: 'pending' }).absence).toBeNull();
  });

  it('χωρίς κλάση η `absence` στέκει, και είναι κλειστό λεξιλόγιο', () => {
    for (const absence of ENERGY_CERTIFICATE_ABSENCES) {
      expect(readEnergyCertificate({ absence })).toEqual({ ...UNDECLARED_ENERGY_CERTIFICATE, absence });
    }
    expect(readEnergyCertificate({ absence: 'lost' }).absence).toBeNull();
  });
});

describe('Α3 — το παλιό σχήμα του `Property.energy`', () => {
  const legacyDate = new Date('2021-06-15T10:00:00.000Z');

  it('`certificateDate` διαβάζεται ως εφεδρεία της ημέρας έκδοσης', () => {
    expect(readEnergyCertificate({ class: 'C', certificateDate: legacyDate }).issuedOn).toBe('2021-06-15');
  });

  it('🔴 ρητό `issuedOn: null` ΝΙΚΑ την εφεδρεία — αλλιώς η ημερομηνία δεν θα σβηνόταν ποτέ', () => {
    expect(readEnergyCertificate({ class: 'C', issuedOn: null, certificateDate: legacyDate }).issuedOn).toBeNull();
  });

  it('το `certificateId` δεν έχει θέση στο μπλοκ', () => {
    expect(readEnergyCertificate({ class: 'C', certificateId: '12345/2021' })).not.toHaveProperty('certificateId');
  });
});

describe('Α4 — διόρθωση: μόνο τα κλειδιά που στάλθηκαν', () => {
  it('αλλαγή κλάσης κρατά τους αριθμούς', () => {
    expect(applyEnergyCertificatePatch(FULL, { class: 'B' })).toEqual({ ...FULL, class: 'B' });
  });

  it('σβήσιμο κλάσης παίρνει μαζί του ό,τι την προσδιόριζε', () => {
    expect(applyEnergyCertificatePatch(FULL, { class: null })).toEqual(UNDECLARED_ENERGY_CERTIFICATE);
  });

  it('δήλωση κλάσης σβήνει το «υπό έκδοση»', () => {
    const pending = readEnergyCertificate({ absence: 'pending' });
    expect(applyEnergyCertificatePatch(pending, { class: 'D' })).toEqual({ ...UNDECLARED_ENERGY_CERTIFICATE, class: 'D' });
  });

  it('`sameEnergyCertificate` βλέπει κάθε πεδίο', () => {
    expect(sameEnergyCertificate(FULL, { ...FULL })).toBe(true);
    for (const patch of [{ class: 'B' as const }, { primaryEnergy: 1 }, { co2Emissions: 1 }, { issuedOn: null }]) {
      expect(sameEnergyCertificate(FULL, applyEnergyCertificatePatch(FULL, patch))).toBe(false);
    }
  });

  it('σχήμα: ολόκληρο μπλοκ αυστηρό · μερική διόρθωση όχι κενή · άγνωστο κλειδί απορρίπτεται', () => {
    expect(energyCertificateSchema.safeParse(FULL).success).toBe(true);
    expect(energyCertificateSchema.safeParse({ class: 'B' }).success).toBe(false);
    expect(energyCertificatePatchSchema.safeParse({ class: 'B' }).success).toBe(true);
    expect(energyCertificatePatchSchema.safeParse({}).success).toBe(false);
    for (const rejected of [{ class: 'H' }, { primaryEnergy: 12.34 }, { issuedOn: '2024-02-31' }, { certificateId: 'x' }]) {
      expect(energyCertificatePatchSchema.safeParse(rejected).success).toBe(false);
    }
  });

  it('🔴 το αποθηκευόμενο μπλοκ περνά από τον ΕΝΑΝ αναγνώστη — κανένας ορφανός αριθμός στο έγγραφο', () => {
    const parsed = storedEnergyCertificateSchema.parse({ ...FULL, class: null });
    expect(parsed).toEqual(UNDECLARED_ENERGY_CERTIFICATE);
  });
});

describe('Α5 — ο κριτής «τίθεται η ερώτηση;» ρωτά τον πίνακα της νομιμότητας, δεν έχει δικό του', () => {
  it('πώληση ή μίσθωση κτιρίου ⇒ ναι', () => {
    expect(raisesEnergyCertificateQuestion({ type: 'apartment', offerKinds: ['sell'] })).toBe(true);
    expect(raisesEnergyCertificateQuestion({ type: 'apartment', offerKinds: ['leaseOut'] })).toBe(true);
  });

  it('🔴 γη ⇒ όχι: το ΠΕΑ αφορά κτίριο, και «Δεν έχει δηλωθεί» σε οικόπεδο θα ήταν κατηγορία', () => {
    expect(raisesEnergyCertificateQuestion({ type: 'land', offerKinds: ['sell'] })).toBe(false);
  });

  it('καμία διάθεση, ή σκουπίδια στη θέση τους ⇒ όχι', () => {
    expect(raisesEnergyCertificateQuestion({ type: 'apartment', offerKinds: [] })).toBe(false);
    expect(raisesEnergyCertificateQuestion({ type: 'apartment', offerKinds: ['gift', 7, null] })).toBe(false);
  });

  it('βραχυχρόνια: κελί `unresolved` ⇒ η ερώτηση ΤΙΘΕΤΑΙ (η παράλειψη θα ήταν ισχυρισμός «δεν χρειάζεται»)', () => {
    expect(raisesEnergyCertificateQuestion({ type: 'apartment', offerKinds: ['leaseShort'] })).toBe(true);
  });
});

describe('Α6 — το κουτί της δημόσιας αγγελίας', () => {
  const sale = { type: 'apartment', offerKinds: ['sell'] };

  it('από την πηγή: αριθμοί και λόγος απουσίας· ΟΧΙ κλάση, ΟΧΙ ημερομηνία', () => {
    expect(listedEnergyCertificateOf(sale, FULL)).toEqual({ primaryEnergy: 132.4, co2Emissions: 38.1, absence: null });
    expect(listedEnergyCertificateOf(sale, undefined)).toEqual({ primaryEnergy: null, co2Emissions: null, absence: null });
  });

  it('η ερώτηση δεν τίθεται ⇒ `null`, ό,τι κι αν λέει το έγγραφο', () => {
    expect(listedEnergyCertificateOf({ type: 'land', offerKinds: ['sell'] }, FULL)).toBeNull();
  });

  it('🔴 ο κρίκος του σχήματος διαβάζει το ΚΟΥΤΙ πεδίο-πεδίο — αλλιώς ο κανόνας «αριθμός μόνο με κλάση» θα έσβηνε κάθε αριθμό', () => {
    const box = { primaryEnergy: 132.4, co2Emissions: 38.1, absence: null };
    expect(relistedEnergyCertificateOf(sale, box)).toEqual(box);
    expect(relistedEnergyCertificateOf(sale, undefined)).toEqual({ primaryEnergy: null, co2Emissions: null, absence: null });
    expect(relistedEnergyCertificateOf(sale, { primaryEnergy: 'πολλά' })?.primaryEnergy).toBeNull();
    expect(relistedEnergyCertificateOf({ type: 'land', offerKinds: ['sell'] }, box)).toBeNull();
  });
});

describe('Α7 — η ισχύς: δέκα έτη από την έκδοση', () => {
  it('+10 έτη, ίδια ημέρα', () => {
    expect(certificateValidUntil('2024-03-12')).toBe('2034-03-12');
  });

  it('29 Φεβρουαρίου ⇒ 28 Φεβρουαρίου (το 2034 δεν είναι δίσεκτο)', () => {
    expect(certificateValidUntil('2024-02-29')).toBe('2034-02-28');
  });

  it('άγνωστη έκδοση ⇒ `null` («δεν ξέρουμε», ποτέ «ισχύει»)', () => {
    expect(certificateValidUntil(null)).toBeNull();
  });
});

describe('Α8 — η αξίωση νομιμότητας που γεννά η δήλωση', () => {
  const AT = '2026-10-13T18:00:00.000Z';
  const LATER = '2026-11-01T09:00:00.000Z';
  const whole = [{ propertyId: 'prop_1', spaceId: null }];
  const other: LegalityClaim = {
    kind: 'building-identity',
    subject: whole,
    tier: 'document-provided',
    value: null,
    authority: 'μηχανικός',
    assertedAt: AT,
    validUntil: null,
  };

  it('κλάση ⇒ καλοσχηματισμένη αυτοδηλωμένη αξίωση, με τιμή την κλάση και ισχύ από την έκδοση', () => {
    const claim = energyPerformanceClaimOf(FULL, 'prop_1', AT);
    expect(claim).toEqual({
      kind: 'energy-performance',
      subject: whole,
      tier: 'self-declared',
      value: 'B+',
      authority: null,
      assertedAt: AT,
      validUntil: '2034-03-12',
    });
    expect(claim && claimSubjectIsWellFormed(claim) && claimAuthorityIsWellFormed(claim)).toBe(true);
  });

  it('«υπό έκδοση» / «εξαιρείται» / τίποτα ⇒ ΚΑΜΙΑ αξίωση (λένε γιατί λείπει, δεν βεβαιώνουν)', () => {
    expect(energyPerformanceClaimOf(readEnergyCertificate({ absence: 'exempt' }), 'prop_1', AT)).toBeNull();
    expect(energyPerformanceClaimOf(UNDECLARED_ENERGY_CERTIFICATE, 'prop_1', AT)).toBeNull();
  });

  it('το κανάλι την διαβάζει: σε ισχύ · ληγμένη · άγνωστη ισχύς', () => {
    const stateAt = (certificate: EnergyCertificate, asOf: string) => {
      const claim = energyPerformanceClaimOf(certificate, 'prop_1', AT);
      return legalitySignalFor(claim ? [claim] : [], 'energy-performance', whole, asOf).state;
    };
    expect(stateAt(FULL, '2026-10-13')).toBe('declared');
    expect(stateAt(FULL, '2034-03-12')).toBe('declared');
    expect(stateAt(FULL, '2034-03-13')).toBe('expired');
    expect(stateAt({ ...FULL, issuedOn: null }, '2026-10-13')).toBe('expiry-unknown');
    expect(stateAt(UNDECLARED_ENERGY_CERTIFICATE, '2026-10-13')).toBe('undeclared');
  });

  it('αντικαθιστά ΜΟΝΟ τη δική της αξίωση· τα άλλα είδη μένουν', () => {
    const first = withEnergyPerformanceClaim([other], FULL, 'prop_1', AT);
    const second = withEnergyPerformanceClaim(first, { ...FULL, class: 'C' }, 'prop_1', LATER);
    expect(second).toHaveLength(2);
    expect(second[0]).toBe(other);
    expect(second[1]).toMatchObject({ kind: 'energy-performance', value: 'C', assertedAt: LATER });
  });

  it('🔴 ίδια δήλωση ⇒ κρατιέται η παλιά ΜΕ το παλιό της `assertedAt` (άσχετη αποθήκευση δεν «ξαναδηλώνει» σήμερα)', () => {
    const first = withEnergyPerformanceClaim([], FULL, 'prop_1', AT);
    const again = withEnergyPerformanceClaim(first, { ...FULL, primaryEnergy: 99 }, 'prop_1', LATER);
    expect(again).toEqual(first);
  });

  it('σβήσιμο κλάσης ⇒ η αυτοδηλωμένη αξίωση φεύγει', () => {
    const first = withEnergyPerformanceClaim([other], FULL, 'prop_1', AT);
    expect(withEnergyPerformanceClaim(first, UNDECLARED_ENERGY_CERTIFICATE, 'prop_1', LATER)).toEqual([other]);
  });

  it('🔴 αξίωση ΑΝΩΤΕΡΗΣ βαθμίδας δεν σβήνεται από δήλωση του αγγελιοδότη', () => {
    const verified: LegalityClaim = { ...other, kind: 'energy-performance', tier: 'registry-verified', value: 'A' };
    const next = withEnergyPerformanceClaim([verified], UNDECLARED_ENERGY_CERTIFICATE, 'prop_1', LATER);
    expect(next).toEqual([verified]);
  });
});

describe('Α9 — το ΠΕΑ μέσα στη φόρμα του γραφείου', () => {
  it('μπλοκ → φόρμα → μπλοκ είναι ταυτότητα', () => {
    expect(energyOfForm(energyFormSliceOf(FULL))).toEqual(FULL);
    expect(energyFormSliceOf(UNDECLARED_ENERGY_CERTIFICATE).energyClass).toBe('');
  });

  it('η διόρθωση περνά από την ίδια συνάρτηση με τον server', () => {
    const slice = patchedEnergyFormSlice(energyFormSliceOf(FULL), { class: null });
    expect(slice).toEqual(energyFormSliceOf(UNDECLARED_ENERGY_CERTIFICATE));
  });
});

describe('Α10 — κάθε τιμή των λεξιλογίων έχει λέξη, και στις δύο γλώσσες', () => {
  const keyOf = (fullKey: string): string[] => fullKey.replace('properties-enums:', '').split('.');
  const resolve = (bundle: unknown, path: readonly string[]): unknown =>
    path.reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle);

  it.each(['el', 'en'])('%s', (language) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bundle: unknown = require(`@/i18n/locales/${language}/properties-enums.json`);
    for (const energyClass of ENERGY_CLASSES) {
      expect(typeof resolve(bundle, keyOf(ENERGY_CLASS_LABEL_KEY[energyClass]))).toBe('string');
    }
    for (const absence of ENERGY_CERTIFICATE_ABSENCES) {
      expect(typeof resolve(bundle, keyOf(ENERGY_CERTIFICATE_ABSENCE_KEY[absence]))).toBe('string');
    }
  });

  it('🔴 στα ελληνικά η κλάση γράφεται με το γράμμα του πιστοποιητικού: C → Γ · F → Ζ · G → Η', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { energyClass } = require('@/i18n/locales/el/properties-enums.json') as { energyClass: Record<string, string> };
    expect([energyClass.c, energyClass.f, energyClass.g]).toEqual(['Γ', 'Ζ', 'Η']);
  });
});
