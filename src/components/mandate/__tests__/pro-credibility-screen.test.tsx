/**
 * @jest-environment jsdom
 *
 * @fileoverview **Ε2 — Η ΑΠΟΔΕΙΞΗ ΣΤΗΝ ΟΘΟΝΗ** (ADR-841 Φ6-Β7).
 * @related components/mandate/CredibilityStatement.tsx · lib/professional/professional-credibility.ts
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 ΓΙΑΤΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΕΙΝΑΙ Η **ΚΡΙΣΙΜΗ** ΑΓΚΥΡΑ ΤΗΣ Φ6-Β
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Οι άγκυρες της **καθαρής σύνθεσης** *(`professional-credibility.test.ts`)*
 * αποδεικνύουν ότι τα 15 κελιά του πίνακα 5×3 δίνουν **διαφορετικά `kind`**.
 * Δεν αποδεικνύουν ότι ο **άνθρωπος** διαβάζει διαφορετικά πράγματα:
 *
 * | Μετάλλαξη | Την πιάνει η καθαρή σύνθεση; | Την πιάνει αυτό; |
 * |---|---|---|
 * | δύο `kind` → **ίδιο κλειδί** στον πίνακα | ❌ *(ο `Record<>` μετρά πληρότητα)* | ✅ |
 * | δύο κλειδιά → **ίδιο κείμενο** στο JSON | ❌ | ✅ |
 * | παράλειψη του σημειώματος **από την κάρτα** | ❌ | ✅ |
 *
 * 🔴 **ΤΑ ΚΕΙΜΕΝΑ ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΤΟ `locales/el`, ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ.** Ένα
 * mock `t: (key) => key` θα μετέτρεπε αυτό το αρχείο σε **δεύτερο έλεγχο
 * πληρότητας πίνακα** — δηλαδή σε αντίγραφο εκείνου που ήδη κάνει ο
 * μεταγλωττιστής, ενώ η βλάβη που κυνηγάμε ζει **κάτω** από τα κλειδιά.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import el from '@/i18n/locales/el/property-market.json';
import type { ShowcaseCredential } from '@/types/agency-profile';
import type { ProfessionalAttestation } from '@/types/professional-identity';

/**
 * ICU-lite: αρκεί για `{authority}` — τα σημειώματα δεν έχουν πληθυντικούς.
 *
 * ⚠️ **ΜΟΝΟ άγκιστρο, ΟΧΙ διπλό.** Το repo είναι ICU *(CHECK 3.9,
 * `.icu-violations-baseline.json`)*: ένα `{{authority}}` εδώ θα άφηνε την
 * παρεμβολή **αγέννητη** και το test θα σύγκρινε ωμό `{authority}` — δηλαδή θα
 * ήταν πράσινο για οθόνη που δεν ονομάζει καμία αρχή. Το έπιασε η ίδια η
 * πρώτη εκτέλεση.
 */
function resolve(key: string, vars: Record<string, string> = {}): string {
  const path = key.replace(/^property-market:/, '').split('.');
  let node: unknown = el;
  for (const step of path) {
    node = (node as Record<string, unknown> | undefined)?.[step];
  }
  const text = typeof node === 'string' ? node : `⛔ ΑΛΥΤΟ: ${key}`;
  return Object.entries(vars).reduce(
    (acc, [name, value]) => acc.split(`{${name}}`).join(value),
    text,
  );
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => resolve(key, vars ?? {}),
    i18n: { language: 'el' },
  }),
}));

import { CredibilityStatement } from '../CredibilityStatement';

function credentialOf(iscoCode: string, attestation: ProfessionalAttestation): ShowcaseCredential {
  const occupation = {
    escoUri: `http://data.europa.eu/esco/occupation/${iscoCode}`,
    label: { el: `ειδικότητα ${iscoCode}`, en: `occupation ${iscoCode}` },
    iscoCode,
  };
  // ⚠️ Το `standing` είναι **παράγωγο**· εδώ δηλώνεται μόνο επειδή ο τύπος του
  //    καταναλωτή το φέρει. Καμία άγκυρα δεν κρίνει πάνω του.
  return attestation.state === 'unknown'
    ? { standing: 'self-declared', occupation, attestation }
    : { standing: 'self-declared', occupation, attestation };
}

/** Ό,τι **διαβάζει ο άνθρωπος** στην κάρτα — κείμενο, όχι κλειδιά. */
function screenTextFor(iscoCode: string, attestation: ProfessionalAttestation): string {
  const { container, unmount } = render(
    <CredibilityStatement credential={credentialOf(iscoCode, attestation)} />,
  );
  const text = (container.textContent ?? '').replace(/\s+/g, ' ').trim();
  unmount();
  return text;
}

const SILENT: ProfessionalAttestation = { state: 'unknown' };

// ============================================================================
// Ε2 — ΤΡΙΑ ΕΠΑΓΓΕΛΜΑΤΑ, ΤΡΙΑ ΔΙΑΦΟΡΕΤΙΚΑ ΕΛΛΗΝΙΚΑ ΚΕΙΜΕΝΑ
// ============================================================================

describe('Ε2 — η οθόνη λέει ΑΛΛΟ πράγμα σε καθένα, και το λέει στα ελληνικά', () => {
  /**
   * | ISCO | Επάγγελμα | Ετυμηγορία | Τι οφείλει να πει |
   * |---|---|---|---|
   * | `7131` | ελαιοχρωματιστής | `no-registry` | **ΓΝΩΣΗ**: «δεν τηρείται μητρώο» |
   * | `7126` | υδραυλικός | `authority` *(regional-authority)* | «τηρείται μητρώο, δεν δηλώθηκε αριθμός» |
   * | `2611` | δικηγόρος | `authority` *(bar-association)* | το ίδιο σχήμα, **άλλη αρχή** |
   */
  it('🔴 Ε2 — ΤΑ ΤΡΙΑ ΚΕΙΜΕΝΑ ΕΙΝΑΙ ΤΡΙΑ (7131 · 7126 · 2611)', () => {
    const painter = screenTextFor('7131', SILENT);
    const plumber = screenTextFor('7126', SILENT);
    const lawyer = screenTextFor('2611', SILENT);

    // 🔴 **Η ΑΓΚΥΡΑ.** Μια «απλοποίηση» που δίνει το ίδιο κείμενο σε δύο
    //    ετυμηγορίες περνά ΚΑΘΕ έλεγχο τύπων — και ισοπεδώνει τη διαφορά
    //    ανάμεσα σε «δεν έχεις πού να γραφτείς» και «έχεις και σιωπάς».
    expect(new Set([painter, plumber, lawyer]).size).toBe(3);

    // ⚠️ Και **κανένα** δεν είναι κενό: η οθόνη δεν σωπαίνει ποτέ (Ε1α).
    for (const text of [painter, plumber, lawyer]) {
      expect(text.length).toBeGreaterThan(0);
      expect(text).not.toMatch(/⛔ ΑΛΥΤΟ:/);
      // 🔴 **Ωμό κλειδί δεν φτάνει ποτέ στην οθόνη** (CHECK 3.51 σε μικρογραφία):
      //    ένα `mandate.credibility.…` εδώ σημαίνει ότι ο άνθρωπος το διαβάζει.
      expect(text).not.toMatch(/mandate\.credibility/);
    }
  });

  it('🔴 Ε2α — Ο ΥΔΡΑΥΛΙΚΟΣ ΚΑΙ Ο ΔΙΚΗΓΟΡΟΣ ΟΝΟΜΑΖΟΥΝ **ΔΙΑΦΟΡΕΤΙΚΗ ΑΡΧΗ**', () => {
    // Ίδιο σημείωμα (`registry-exists-undeclared`), **άλλη** παρεμβολή. Χωρίς
    // αυτό, μια μετάλλαξη που περνά σταθερή αρχή θα ήταν αόρατη: το Ε2 θα
    // μετρούσε ακόμη τρία διαφορετικά κείμενα, χάρη στον ελαιοχρωματιστή.
    const plumber = screenTextFor('7126', SILENT);
    const lawyer = screenTextFor('2611', SILENT);

    expect(plumber).toContain(resolve('property-market:registries.regionalAuthority.name'));
    expect(lawyer).toContain(resolve('property-market:registries.barAssociation.name'));
    expect(plumber).not.toBe(lawyer);
  });

  it('🔑 Ε2β — Ο ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗΣ ΜΠΑΙΝΕΙ ΧΩΡΙΣ ΠΡΟΕΙΔΟΠΟΙΗΤΙΚΟ ΤΟΝΟ (Α9.3)', () => {
    const painter = screenTextFor('7131', SILENT);

    // 🔑 **Ο ΚΑΝΟΝΑΣ ΤΟΥ ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗ**: ο ΙΣΧΥΡΙΣΜΟΣ ΣΩΠΑΙΝΕΙ όταν το
    //    επάγγελμα δεν έχει μητρώο. Η οθόνη **δεν** λέει «δεν δήλωσε αριθμό» σε
    //    κάποιον που δεν έχει πού να γραφτεί.
    expect(painter).toBe(resolve('property-market:mandate.credibility.note.registryAbsentByNature'));
    // ⚠️ Και το κείμενο δεν διατυπώνει **έλλειψη**: δεν λέει «δεν έχουμε»,
    //    λέει «δεν λείπει τίποτα».
    expect(painter).not.toContain(resolve('property-market:mandate.credibility.claim.declared'));
  });

  it('🔴 Ε2γ — `declared` ΔΕΝ ΦΟΡΑΕΙ ΤΗ ΣΤΟΛΗ ΤΟΥ `verified`', () => {
    const registration = {
      authorityKind: 'chapter',
      authority: 'bar-association',
      chapter: 'ΔΣΘ',
      number: '1234',
    } as const;

    const declared = screenTextFor('2611', { state: 'declared', registration });
    const verified = screenTextFor('2611', { state: 'verified', registration });

    // 🔴 **Η ΔΙΑΦΟΡΑ ΕΙΝΑΙ ΤΟ ΝΟΗΜΑ ΤΟΥ ΣΧΗΜΑΤΟΣ.** Χωρίς αυτό, «ΔΣΘ 1234»
    //    διαβάζεται ως **επιβεβαίωση**, και ο επισκέπτης υποθέτει το χειρότερο
    //    για εμάς: ότι το ελέγξαμε.
    expect(declared).not.toBe(verified);
    expect(declared).toContain(resolve('property-market:mandate.credibility.claim.declared'));
    expect(verified).not.toContain(resolve('property-market:mandate.credibility.claim.declared'));

    // ⚠️ Ο **αριθμός ΠΟΤΕ χωρίς τον εκδότη του** (Α9.1): σκέτο «1234» είναι
    //    «αριθμός που φοράει τη στολή απόδειξης».
    for (const text of [declared, verified]) {
      expect(text).toContain('1234');
      expect(text).toContain('ΔΣΘ');
    }
  });

  it('🔴 Ε2δ — ΟΛΑ ΤΑ ΣΗΜΕΙΩΜΑΤΑ ΤΟΥ ΠΙΝΑΚΑ ΕΙΝΑΙ ΔΙΑΚΡΙΤΑ ΚΕΙΜΕΝΑ ΣΤΟ JSON', () => {
    // 🔴 **ΑΥΤΟ ΕΙΝΑΙ ΠΟΥ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΚΑΝΕΙ Ο `Record<>`.** Έξι κλειδιά με
    //    πέντε διακριτά κείμενα μεταγλωττίζονται μια χαρά — και δύο καταστάσεις
    //    θα διάβαζαν το ίδιο πράγμα, σιωπηλά.
    const notes = [
      'registryExistsUndeclared',
      'registryAbsentByNature',
      'registryUnexamined',
      'authorityMismatch',
      'registryAbsentYetDeclared',
      'classificationUnreadable',
    ].map((name) => resolve(`property-market:mandate.credibility.note.${name}`));

    expect(notes).not.toContain(expect.stringMatching(/⛔ ΑΛΥΤΟ:/));
    expect(new Set(notes).size).toBe(notes.length);
  });
});
