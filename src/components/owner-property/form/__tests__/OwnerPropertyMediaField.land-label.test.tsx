/**
 * @fileoverview **ΕΝΑ ΟΙΚΟΠΕΔΟ ΔΕΝ ΕΧΕΙ ΚΑΤΟΨΗ** — η άγκυρα του περιστατικού της 2026-09-03.
 * @related components/owner-property/form/OwnerPropertyMediaField · ADR-842 §7.6.8
 * @see constants/__tests__/property-type-coverage.test.ts — η ίδια ερώτηση, στον δείκτη
 *   πληρότητας. Εκείνη ήταν **πράσινη** όσο αυτή έλειπε.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ, ΜΕΤΡΗΜΕΝΟ ΣΤΗΝ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * `/offers/ownp_330a5a4b-…`, είδος **Οικόπεδο**. Η **ίδια σελίδα** έλεγε δύο πράγματα:
 *
 * | Επιφάνεια | Τι έλεγε |
 * |---|---|
 * | Πεδίο ανεβάσματος | *«Ανέβασε ό,τι έχεις — φωτογραφίες, **κάτοψη**, PDF»* |
 * | Δείκτης πληρότητας, **δύο κάρτες κάτω** | *«Τι λείπει: **Τοπογραφικό διάγραμμα**»* |
 *
 * Η απόφαση **υπήρχε** — `LAND_LABELLED_FIELDS` + `completionFieldLabelKey`, με δική
 * της άγκυρα (ομάδα Λ του `property-type-coverage`, *«η γη ΔΕΝ λέει Κάτοψη»*). Το
 * ανέβασμα ήταν το **μόνο** σημείο που δεν ρώτησε, και **καμία** άγκυρα δεν το έβλεπε:
 * η ομάδα Λ κρίνει **κλειδιά** του `properties` namespace, δηλαδή είναι δομικά τυφλή σε
 * ένα `FormFieldset` που ζωγραφίζει σταθερό `property-market:offer.media.label`.
 *
 * 🔑 **ΓΙΑΤΙ ΑΠΟΔΟΣΗ ΚΑΙ ΟΧΙ ΕΛΕΓΧΟΣ ΚΛΕΙΔΙΩΝ.** Ένα test που ρωτά *«λύνεται το
 * `landLabel`;»* θα ήταν πράσινο **και με το ελάττωμα ζωντανό** — τα κλειδιά υπήρχαν
 * ήδη στον δείκτη πληρότητας. Η ερώτηση του ανθρώπου δεν ήταν «υπάρχει μετάφραση;»,
 * ήταν **«τι λέει η οθόνη μου;»** — και μόνο η απόδοση την απαντά.
 *
 * ⚠️ **Το `t()` επιστρέφει το κλειδί επίτηδες** — ίδιο ιδίωμα με το
 * `OwnerPropertyPlaceField.render.test.tsx`: κάνει την **επιλογή** κλειδιού ορατή στο
 * DOM, που είναι ακριβώς το υπό κρίση. Γι' αυτό η ομάδα **Λ** παρακάτω κρίνει χωριστά
 * ότι τα κλειδιά **λύνονται σε κείμενο** — ένα κλειδί χωρίς μετάφραση δεν κοκκινίζει
 * πουθενά, **τυπώνεται αυτούσιο στην οθόνη**.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import '@testing-library/jest-dom';

import { OwnerPropertyMediaField } from '../OwnerPropertyMediaField';
import { LAND_PROPERTY_TYPES } from '@/constants/property-types';
import elMarket from '@/i18n/locales/el/property-market.json';
import enMarket from '@/i18n/locales/en/property-market.json';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}::${JSON.stringify(params)}` : key,
  }),
}));

/**
 * Το ίδιο το ανέβασμα κρίνεται από τη δική του άγκυρα — εδώ ρωτάμε **πώς ονομάζεται**
 * αυτό που ζητάμε, όχι αν φτάνει στο Storage.
 */
jest.mock('@/hooks/owner-property/useOwnerPropertyMedia', () => ({
  useOwnerPropertyMedia: () => ({
    state: { state: 'idle' },
    upload: jest.fn(),
    clear: jest.fn(),
  }),
}));

const K = 'property-market:offer.media';

/** Ταυτότητα **υπαρκτή**: αλλιώς η οθόνη δείχνει το εμπόδιο λογαριασμού, όχι το πεδίο. */
const AUTHOR = 'usr_test_author';

function Harness({ type }: { readonly type: string }): React.ReactElement {
  const form = useForm({ defaultValues: { type, media: [] } });
  return (
    <FormProvider {...form}>
      <OwnerPropertyMediaField authorUserId={AUTHOR} ownerPropertyId="ownp_test" />
    </FormProvider>
  );
}

// =============================================================================
// Ε — ΑΠΟΔΕΙΞΗ ΖΩΗΣ: το σύνολο που διατρέχουμε ΔΕΝ είναι κενό
// =============================================================================

describe('Ε — απόδειξη ζωής', () => {
  /**
   * ⛔ **ΜΗΝ τη σβήσεις.** Χωρίς αυτή, ένα λάθος import θα έκανε το `it.each` της
   * ομάδας Κ2 να διατρέξει το **κενό** σύνολο και να περάσει: «για κάθε στοιχείο του
   * τίποτα» είναι αληθές (ADR-749 §5).
   */
  it('Ε1 — η γη έχει είδη, και είναι τα δύο που περιμένουμε', () => {
    expect(LAND_PROPERTY_TYPES).toEqual(expect.arrayContaining(['plot', 'parcel']));
    expect(LAND_PROPERTY_TYPES.length).toBeGreaterThanOrEqual(2);
  });
});

// =============================================================================
// Κ — Η ΟΘΟΝΗ ΟΝΟΜΑΖΕΙ ΤΟ ΣΧΕΔΙΟ ΑΝΑ ΕΙΔΟΣ
// =============================================================================

describe('Κ — τι ζητά η οθόνη ανά είδος ακινήτου', () => {
  /**
   * ⛔ **ΜΕΤΑΛΛΑΞΗ**: γύρνα το `legend`/`help` του `FormFieldset` πίσω στα σταθερά
   * `${K}.label` / `${K}.help` ⇒ **κόκκινο εδώ**. Πριν από αυτό το αρχείο, η ίδια
   * μετάλλαξη άφηνε **και τις 660 άγκυρες πράσινες** και το έβλεπε μόνο ο περιηγητής.
   */
  it('Κ1 — «Οικόπεδο» ζητά ΤΟΠΟΓΡΑΦΙΚΟ, και δεν αναφέρει κάτοψη πουθενά', () => {
    render(<Harness type="plot" />);

    expect(screen.getByText(`${K}.landLabel`)).toBeInTheDocument();
    expect(screen.getByText(`${K}.landHelp`)).toBeInTheDocument();

    // Το ελάττωμα, κατά γράμμα: τα κλειδιά της κάτοψης ΔΕΝ ζωγραφίζονται.
    expect(screen.queryByText(`${K}.label`)).toBeNull();
    expect(screen.queryByText(`${K}.help`)).toBeNull();
  });

  it.each(LAND_PROPERTY_TYPES)('Κ2 — «%s» παίρνει ΤΗΝ ΙΔΙΑ απάντηση (ταξικό, όχι λίστα)', (type) => {
    render(<Harness type={type} />);

    expect(screen.getByText(`${K}.landLabel`)).toBeInTheDocument();
    expect(screen.queryByText(`${K}.label`)).toBeNull();
  });

  /**
   * 🔑 **Η ΑΝΤΙΣΤΡΟΦΗ, ΚΑΙ ΕΙΝΑΙ ΤΟ ΜΙΣΟ ΤΗΣ ΑΓΚΥΡΑΣ.** Χωρίς αυτήν, ένα «διόρθωσα το
   * κείμενο» που έβαζε *«τοπογραφικό»* στο **κοινό** κλειδί θα ήταν πράσινο εδώ — και
   * θα ζητούσε τοπογραφικό διάγραμμα για **διαμέρισμα**.
   */
  it('Κ3 — «Διαμέρισμα» εξακολουθεί να ζητά ΚΑΤΟΨΗ', () => {
    render(<Harness type="apartment" />);

    expect(screen.getByText(`${K}.label`)).toBeInTheDocument();
    expect(screen.getByText(`${K}.help`)).toBeInTheDocument();
    expect(screen.queryByText(`${K}.landLabel`)).toBeNull();
    expect(screen.queryByText(`${K}.landHelp`)).toBeNull();
  });

  /**
   * ⚠️ **Κενό είδος = η φόρμα ΜΟΛΙΣ άνοιξε** (`type: ''`, δες `owner-property-form-values`).
   * Πέφτει στο γενικό, ποτέ σε σφάλμα: ο άνθρωπος δεν έχει απαντήσει ακόμη.
   */
  it('Κ4 — πριν διαλέξει είδος, η οθόνη δεν μαντεύει', () => {
    render(<Harness type="" />);

    expect(screen.getByText(`${K}.label`)).toBeInTheDocument();
    expect(screen.queryByText(`${K}.landLabel`)).toBeNull();
  });
});

// =============================================================================
// Λ — ΤΑ ΚΛΕΙΔΙΑ ΛΥΝΟΝΤΑΙ ΣΕ ΚΕΙΜΕΝΟ, ΣΕ ΔΥΟ ΓΛΩΣΣΕΣ
// =============================================================================

/**
 * 🔴 Το επικίνδυνο σκέλος: η ομάδα Κ αποδεικνύει ότι διαλέγουμε **σωστό κλειδί** —
 * όχι ότι το κλειδί **έχει κείμενο**. Ένα `landLabel` μόνο στα ελληνικά θα τύπωνε
 * `property-market:offer.media.landLabel` σε κάθε αγγλόφωνη οθόνη (N.11).
 */
describe('Λ — οι δύο νέες ετικέτες υπάρχουν και στα δύο locales', () => {
  it.each([
    ['el', elMarket],
    ['en', enMarket],
  ] as const)('Λ1 — «%s» έχει ΚΕΙΜΕΝΟ για landLabel και landHelp', (lang, bundle) => {
    const media = (bundle as { offer: { media: Record<string, unknown> } }).offer.media;
    for (const key of ['landLabel', 'landHelp'] as const) {
      expect({ lang, key, text: media[key] }).toEqual({
        lang,
        key,
        text: expect.stringMatching(/\S/),
      });
    }
  });

  /** Το περιστατικό ως ισχυρισμός κειμένου: η γη **δεν λέει τη λέξη**. */
  it('Λ2 — καμία «κάτοψη» / «floor plan» στο κείμενο της γης', () => {
    const el = (elMarket as { offer: { media: Record<string, string> } }).offer.media;
    const en = (enMarket as { offer: { media: Record<string, string> } }).offer.media;

    expect(`${el.landLabel} ${el.landHelp}`.toLowerCase()).not.toMatch(/κάτοψ|κατόψ/);
    expect(`${en.landLabel} ${en.landHelp}`.toLowerCase()).not.toMatch(/floor\s*plan/);
  });

  /**
   * 🔑 **ΚΑΙ ΤΟ ΓΕΝΙΚΟ ΜΕΝΕΙ ΓΕΝΙΚΟ.** Δύο κλειδιά με **ίδιο** κείμενο είναι δεύτερο
   * μητρώο που δεν διαφέρει — ακριβώς το σχήμα του `completion.fields.land.photos`, που
   * λέει «Φωτογραφίες» σε **τρία** κλειδιά και δύο γλώσσες.
   */
  it('Λ3 — η ετικέτα της γης ΔΙΑΦΕΡΕΙ από τη γενική (αλλιώς είναι νεκρό κλειδί)', () => {
    for (const bundle of [elMarket, enMarket]) {
      const media = (bundle as { offer: { media: Record<string, string> } }).offer.media;
      expect(media.landLabel).not.toBe(media.label);
      expect(media.landHelp).not.toBe(media.help);
    }
  });
});
