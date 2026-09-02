/**
 * @jest-environment jsdom
 *
 * @fileoverview **Η ΦΟΡΜΑ ΡΩΤΑ ΤΟ ΕΠΑΓΓΕΛΜΑ** — η άγκυρα της Φ6-Β4.
 * @related components/mandate/ShowcaseCredentialField.tsx · ADR-841 Α9.1 · Α9.3
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΑ ΚΕΙΜΕΝΑ ΔΙΑΒΑΖΟΝΤΑΙ ΑΠΟ ΤΟ `locales/el`, ΔΕΝ ΓΡΑΦΟΝΤΑΙ ΕΔΩ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ένα mock `t: (key) => key` θα έκανε αυτό το αρχείο να ελέγχει **κλειδιά**, και
 * τότε η μετάλλαξη *«δύο κλειδιά, ίδιο κείμενο»* περνά αθόρυβα: ο
 * `Record<>` του πίνακα φυλά την **πληρότητα**, ποτέ τη **διάκριση**. Εδώ ο
 * `t` κάνει **αληθινή** αναζήτηση στο JSON, άρα *«δεν τηρείται μητρώο»* και
 * *«δεν έχουμε εξετάσει»* πρέπει να είναι **δύο διαφορετικές προτάσεις** —
 * αλλιώς λέμε στον συμβολαιογράφο ότι **δεν υπάρχει** μητρώο γι' αυτόν, ενώ
 * απλώς **δεν κοιτάξαμε** *(ΓΝΩΣΗ ≠ ΑΓΝΟΙΑ, N.12)*.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';

import el from '@/i18n/locales/el/property-market.json';

/**
 * 🔑 **Αληθινή επίλυση κλειδιού πάνω στο ΙΔΙΟ JSON που φορτώνει η εφαρμογή.**
 * Το `{{authority}}` παρεμβάλλεται εδώ γιατί το κείμενο του μητρώου **οφείλει**
 * να ονομάζει την αρχή — σκέτος αριθμός θα ήταν *«αριθμός που φοράει τη στολή
 * απόδειξης»* (Α9.1).
 */
function resolve(key: string, vars?: Record<string, string>): string {
  const path = key.replace(/^property-market:/, '').split('.');
  let node: unknown = el;
  for (const step of path) {
    node = (node as Record<string, unknown> | undefined)?.[step];
  }
  const text = typeof node === 'string' ? node : `⛔ ΑΛΥΤΟ: ${key}`;
  return Object.entries(vars ?? {}).reduce(
    (acc, [name, value]) => acc.replace(new RegExp(`{{\\s*${name}\\s*}}`, 'g'), value),
    text,
  );
}

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) => resolveRef.current(key, vars),
    i18n: { language: 'el' },
  }),
}));

/** Το `jest.mock` υψώνεται πάνω από τη συνάρτηση — η αναφορά γεμίζει μετά. */
const resolveRef = { current: resolve };

/**
 * ⚠️ Ο επιλογέας ESCO είναι **ψεύτικος**: μιλά στο Firestore και δεν είναι το
 * ερώτημα εδώ. Το ερώτημα είναι *«ποια πεδία εμφανίζονται για ποιο επάγγελμα»*.
 */
jest.mock('@/components/shared/EscoOccupationPicker', () => ({
  EscoOccupationPicker: () => <input data-testid="esco-picker" readOnly value="" />,
}));

import {
  EMPTY_CREDENTIAL_DRAFT,
  ShowcaseCredentialField,
  type ShowcaseCredentialDraft,
} from '../ShowcaseCredentialField';

function draft(overrides: Partial<ShowcaseCredentialDraft>): ShowcaseCredentialDraft {
  return { ...EMPTY_CREDENTIAL_DRAFT, profession: 'δοκιμή', escoUri: 'esco:x', ...overrides };
}

function show(overrides: Partial<ShowcaseCredentialDraft>): void {
  render(
    <ShowcaseCredentialField
      index={0}
      draft={draft(overrides)}
      onChange={() => undefined}
      onRemove={null}
    />,
  );
}

// ============================================================================
// Φ — ΤΡΕΙΣ ΕΤΥΜΗΓΟΡΙΕΣ, ΤΡΕΙΣ ΟΘΟΝΕΣ
// ============================================================================

describe('Φ — τα πεδία του μητρώου εξαρτώνται από ΤΟ ΕΠΑΓΓΕΛΜΑ', () => {
  it('🔑 Φ0 — ΜΕΣΙΤΗΣ (3334 → ΓΕΜΗ): ένα πεδίο αριθμού, με την ΑΡΧΗ ΟΝΟΜΑΣΜΕΝΗ', () => {
    show({ iscoCode: '3334' });

    // 🔴 Ο αριθμός **δεν εμφανίζεται ποτέ χωρίς τον εκδότη του** (Α9.1).
    expect(
      screen.getByText(
        resolve('property-market:mandate.showcase.registryLabel', {
          authority: resolve('property-market:registries.gemi.name'),
        }),
      ),
    ).toBeInTheDocument();
    // ⚠️ Η αρχή **ΔΕΝ επιλέγεται**: κανένα `<select>` αρχής — αλλιώς ένας
    //    διακοσμητής θα δήλωνε ΓΕΜΗ.
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('🔴 Φ1 — ΕΛΑΙΟΧΡΩΜΑΤΙΣΤΗΣ (7131 → καμία αρχή): ΚΑΝΕΝΑ ΠΕΔΙΟ, και η απουσία ΕΞΗΓΕΙΤΑΙ', () => {
    show({ iscoCode: '7131' });

    // 🔑 **Α9.3**: η απουσία μητρώου δεν είναι έλλειψη. Ένα κενό πεδίο εδώ θα
    //    έκανε τον ελαιοχρωματιστή να νομίζει ότι του λείπει κάτι.
    expect(
      screen.getByText(resolve('property-market:mandate.showcase.registryNone')),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/μητρώου/i)).not.toBeInTheDocument();
  });

  it('🔴 Φ2 — ΑΝΕΞΕΤΑΣΤΟ επάγγελμα λέει ΑΛΛΟ ΚΕΙΜΕΝΟ από το «δεν τηρείται»', () => {
    // ISCO `2619` — δηλωμένο **ανοιχτό** της Α9.4, χωρίς γραμμή στον πίνακα.
    show({ iscoCode: '2619' });

    const unexamined = resolve('property-market:mandate.showcase.registryUnexamined');
    const none = resolve('property-market:mandate.showcase.registryNone');

    expect(screen.getByText(unexamined)).toBeInTheDocument();
    // 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ ΔΙΑΚΡΙΣΗΣ, και ΜΟΝΟ αυτή τη βλέπει.** Δύο κλειδιά με
    //    **ίδιο κείμενο** περνούν κάθε έλεγχο τύπων: ο `Record<>` μετρά
    //    κλειδιά, όχι νόημα. *«Δεν υπάρχει μητρώο»* είναι **ΓΝΩΣΗ** μας·
    //    *«δεν εξετάσαμε»* είναι **ΑΓΝΟΙΑ** μας — και η δεύτερη δεν επιτρέπεται
    //    να ντυθεί την πρώτη.
    expect(unexamined).not.toBe(none);
    expect(screen.queryByText(none)).not.toBeInTheDocument();
  });

  it('🔴 Φ3 — ΔΙΚΗΓΟΡΟΣ (2611 → σύλλογος με παραρτήματα): ΚΑΙ ο εκδότης, υποχρεωτικά', () => {
    show({ iscoCode: '2611' });

    // 🔒 «1234» χωρίς «ΔΣΘ» δεν επαληθεύεται από κανέναν — και οι Δικηγορικοί
    //    Σύλλογοι είναι **63**.
    expect(
      screen.getByText(resolve('property-market:mandate.showcase.chapterLabel')),
    ).toBeInTheDocument();
  });

  it('🔑 Φ3α — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Φ3: εθνική αρχή ΔΕΝ ζητά εκδότη', () => {
    // Χωρίς αυτό, το Φ3 θα ήταν πράσινο και σε οθόνη που ζητά «εκδότη» **από
    // όλους** — δηλαδή θα ζητούσε από τον μεσίτη ποιο παράρτημα ΓΕΜΗ, που δεν
    // υπάρχει.
    show({ iscoCode: '3334' });

    expect(
      screen.queryByText(resolve('property-market:mandate.showcase.chapterLabel')),
    ).not.toBeInTheDocument();
  });

  it('🔴 Φ4 — ΠΡΙΝ ΔΙΑΛΕΞΕΙ ΕΙΔΙΚΟΤΗΤΑ Η ΟΘΟΝΗ ΣΩΠΑΙΝΕΙ — καμία πρόωρη εξήγηση', () => {
    render(
      <ShowcaseCredentialField
        index={0}
        draft={EMPTY_CREDENTIAL_DRAFT}
        onChange={() => undefined}
        onRemove={null}
      />,
    );

    // ⚠️ Ένα «δεν τηρείται μητρώο» εδώ θα ήταν **ψευδές**: δεν ξέρουμε ακόμη
    //    για ποιο επάγγελμα μιλάμε.
    expect(
      screen.queryByText(resolve('property-market:mandate.showcase.registryNone')),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(resolve('property-market:mandate.showcase.registryUnexamined')),
    ).not.toBeInTheDocument();
  });

  it('🔴 Φ5 — ΕΛΕΥΘΕΡΟ ΚΕΙΜΕΝΟ ΤΟ ΛΕΕΙ ΠΡΙΝ ΠΑΤΗΘΕΙ ΤΟ ΚΟΥΜΠΙ', () => {
    // Ο επιλογέας δέχεται ελεύθερο κείμενο *(χρήσιμο στο CRM)*· η **βιτρίνα**
    // όχι — χωρίς `escoUri` η ειδικότητα δεν μπαίνει σε κανένα φίλτρο. Σιωπηλή
    // απόρριψη θα άφηνε τον άνθρωπο να βλέπει το κείμενό του και να νομίζει ότι
    // καταχωρήθηκε.
    show({ profession: 'μαστροχαλαστής', escoUri: null, iscoCode: null });

    expect(
      screen.getByText(resolve('property-market:mandate.showcase.occupationUnclassified')),
    ).toBeInTheDocument();
  });

  it('🔑 Φ5α — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ ΤΟΥ Φ5: ταξινομημένη ειδικότητα ΔΕΝ προειδοποιεί', () => {
    show({ iscoCode: '7131' });

    expect(
      screen.queryByText(resolve('property-market:mandate.showcase.occupationUnclassified')),
    ).not.toBeInTheDocument();
  });

  it('🔴 Φ6 — ΚΑΝΕΝΑ ΚΛΕΙΔΙ ΔΕΝ ΜΕΝΕΙ ΑΛΥΤΟ: το locale έχει ΚΑΘΕ κείμενο που ζητά η οθόνη', () => {
    // 🔑 Χωρίς αυτό, ένα λείπον κλειδί θα ζωγράφιζε το placeholder `⛔ ΑΛΥΤΟ:`
    //    και τα παραπάνω tests θα το συνέκριναν **με τον εαυτό του** — πράσινα
    //    για κείμενο που δεν υπάρχει (το σχήμα «0 = κανείς δεν κοίταξε»).
    for (const iscoCode of ['3334', '7131', '2611', '2619']) {
      const { unmount } = render(
        <ShowcaseCredentialField
          index={0}
          draft={draft({ iscoCode })}
          onChange={() => undefined}
          onRemove={null}
        />,
      );
      expect(screen.queryByText(/⛔ ΑΛΥΤΟ:/)).not.toBeInTheDocument();
      unmount();
    }
  });
});
