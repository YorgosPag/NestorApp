/**
 * @fileoverview **Η ΑΓΚΥΡΑ ΤΗΣ ΧΕΙΡΟΝΟΜΙΑΣ** — «πάτησε στην πλευρά που σε ενδιαφέρει».
 * @related ADR-777 §8.46 · SPEC-777B §12.2 · components/demand/form/DemandFrontageField.tsx
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΥΠΑΡΧΕΙ — ΤΟ ΣΦΑΛΜΑ ΠΟΥ ΕΦΤΑΣΕ ΩΣ ΤΗΝ ΟΘΟΝΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γραμμή που κρίνει πλευρά καλούσε `sideOfPolyline(polyline, point)` ενώ η υπογραφή
 * είναι `sideOfPolyline(point, axis)` — **αντεστραμμένα ορίσματα**. Συνέπεια: το κύριο
 * ζητούμενο ολόκληρου του χαρακτηριστικού **δεν δούλευε ποτέ**.
 *
 * 🔑 **Γιατί δεν το έπιασε τίποτα**: είναι σφάλμα **τύπων**, και το `tsc` το βλέπει
 * αμέσως — αλλά ο **N.17** απαγορεύει ρητά σε κάθε πράκτορα να το τρέξει. Άρα η μόνη
 * άμυνα μέσα στη ροή είναι δοκιμή που **ΕΚΤΕΛΕΙ** τον κώδικα. Βρέθηκε μόνο με ζωντανή
 * επαλήθευση στον περιηγητή — που δεν κλιμακώνεται και δεν μπλοκάρει τίποτα.
 *
 * ⚠️ **Η ΓΕΩΜΕΤΡΙΑ ΔΕΝ ΞΑΝΑΔΟΚΙΜΑΖΕΤΑΙ ΕΔΩ.** Το `geo-line.ts` έχει τις δικές του 14
 * δοκιμές. Εδώ κρίνεται **η σύνδεση**: ότι η οθόνη ρωτά τον σωστό κριτή, με τη σωστή
 * σειρά, στη σωστή φάση — και ότι η απάντηση φτάνει στο **πεδίο της φόρμας**. Οι δύο
 * άγκυρες `Θ3`/`Ζ1` το κάνουν **διαφορικά**: συγκρίνουν με το ίδιο το SSoT, ώστε καμία
 * γεωμετρική σταθερά να μη γραφτεί δεύτερη φορά εδώ.
 *
 * ⚠️ **Ο χάρτης μοκάρεται με τον ΥΠΑΡΧΟΝΤΑ τρόπο** — αντικατάσταση του module
 * `PlaceMap`, ποτέ του MapLibre/WebGL. Είναι η ίδια οδός με το
 * `components/geo/__tests__/PlaceIdentityField.render.test.tsx`· δεύτερη οδός θα ήταν
 * το σχήμα ADR-749 (δύο αρχές για ένα ερώτημα). Η μόνη διαφορά είναι ότι εδώ το
 * ομοίωμα **καταγράφει** τι του δόθηκε: η επιφάνεια δεν δοκιμάζεται ως ζωγραφιά αλλά
 * ως **συνομιλία** (τι παραδίδει στον χάρτη, τι δέχεται πίσω).
 */

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import { FormProvider, useForm, type UseFormReturn } from 'react-hook-form';

import { DemandFrontageField } from '../DemandFrontageField';
import type { PlaceMapProps } from '@/components/geo/PlaceMap';
import {
  DEFAULT_FRONTAGE_DEPTH_METRES,
  EMPTY_DEMAND_FORM,
  type DemandFormValues,
} from '@/lib/demand/demand-form-values';
import { frontagePolylineOutline, sideOfPolyline } from '@/lib/geo/geo-line';
import type { GeoPoint, GeoPolyline } from '@/types/geo/coordinates';

/** Το `t()` επιστρέφει το κλειδί: κάθε ισχυρισμός δείχνει **ποιο** κείμενο ζητήθηκε. */
jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

/** Ο χάρτης είναι στιγμιότυπο MapLibre· το jsdom δεν έχει WebGL. Το ομοίωμα καταγράφει. */
const mockPlaceMap = jest.fn((_props: PlaceMapProps) => <div data-testid="map" />);
jest.mock('@/components/geo/PlaceMap', () => ({
  PlaceMap: (props: PlaceMapProps) => mockPlaceMap(props),
}));

// =============================================================================
// ΤΟ ΣΕΝΑΡΙΟ — άξονας ΒΟΡΡΑΣ→ΝΟΤΟΣ, ένα σημείο ανατολικά, ένα δυτικά
// =============================================================================

const K = 'property-market:demand.form.frontage';
const UNDO_LABEL = 'search-results:place.draw.undo';

const AXIS_NORTH: GeoPoint = { lat: 40.641, lng: 22.944 };
const AXIS_SOUTH: GeoPoint = { lat: 40.639, lng: 22.944 };
const AXIS: GeoPolyline = [AXIS_NORTH, AXIS_SOUTH];

/** ~169 m ανατολικά — πολύ έξω από την ανοχή «πάνω στον άξονα» (5 cm). */
const EAST: GeoPoint = { lat: 40.64, lng: 22.946 };
/** ~169 m δυτικά, κατοπτρικά. */
const WEST: GeoPoint = { lat: 40.64, lng: 22.942 };

// =============================================================================
// ΤΟ ΙΚΡΙΩΜΑ — πραγματική `react-hook-form`, καμία απομίμηση του μοντέλου
// =============================================================================

let formUnderTest: UseFormReturn<DemandFormValues> | null = null;

function FrontageHarness({ initial }: { initial?: Partial<DemandFormValues> }): React.ReactElement {
  const form = useForm<DemandFormValues>({ defaultValues: { ...EMPTY_DEMAND_FORM, ...initial } });
  formUnderTest = form;
  return (
    <FormProvider {...form}>
      <DemandFrontageField />
    </FormProvider>
  );
}

function renderField(initial?: Partial<DemandFormValues>): void {
  render(<FrontageHarness initial={initial} />);
}

/** Ό,τι κρατά **η φόρμα** — η μόνη αυθεντία για το «τι ζήτησε ο άνθρωπος». */
function values(): DemandFormValues {
  if (formUnderTest === null) throw new Error('Το ικρίωμα δεν αποδόθηκε.');
  return formUnderTest.getValues();
}

/** Ό,τι παραδόθηκε **στον χάρτη** στην τελευταία απόδοση. */
function lastMapProps(): PlaceMapProps {
  const call = mockPlaceMap.mock.calls.at(-1);
  if (call === undefined) throw new Error('Ο χάρτης δεν αποδόθηκε ποτέ.');
  return call[0];
}

/** Ο άνθρωπος πάτησε στον χάρτη — η **μία** χειρονομία του §21.4. */
function pick(point: GeoPoint): void {
  const { onPick } = lastMapProps();
  if (onPick === undefined) throw new Error('Ο χάρτης δεν δέχεται κλικ: η χειρονομία δεν υπάρχει.');
  act(() => onPick(point));
}

function button(name: string): HTMLElement {
  return screen.getByRole('button', { name });
}

beforeEach(() => {
  mockPlaceMap.mockClear();
  formUnderTest = null;
});

// =============================================================================
// Α — ΦΑΣΗ ΑΞΟΝΑ: η χειρονομία ΧΤΙΖΕΙ
// =============================================================================

describe('Α — ο άξονας σχεδιάζεται με κλικ', () => {
  it('Α1 — ανοίγει στη φάση άξονα: η οδηγία ζητά ΓΡΑΜΜΗ, όχι πλευρά', () => {
    renderField();

    expect(screen.getByText(`${K}.gestureAxis`)).toBeInTheDocument();
    expect(screen.queryByText(`${K}.gestureSide`)).not.toBeInTheDocument();
  });

  it('Α2 — κάθε κλικ ΠΡΟΣΘΕΤΕΙ κορυφή, με τη σειρά που πατήθηκε', () => {
    renderField();

    pick(AXIS_NORTH);
    expect(values().frontageAxis).toEqual([AXIS_NORTH]);

    pick(AXIS_SOUTH);
    expect(values().frontageAxis).toEqual([AXIS_NORTH, AXIS_SOUTH]);
  });

  it('Α3 — ο άξονας φτάνει στον χάρτη ως ΑΝΟΙΧΤΗ γραμμή (`trace`)', () => {
    renderField();

    pick(AXIS_NORTH);
    pick(AXIS_SOUTH);

    expect(lastMapProps().trace).toEqual([AXIS_NORTH, AXIS_SOUTH]);
  });

  it('Α4 — η αναίρεση αφαιρεί την τελευταία κορυφή· χωρίς κορυφές είναι απενεργοποιημένη', async () => {
    const user = userEvent.setup();
    renderField();

    expect(button(UNDO_LABEL)).toBeDisabled();

    pick(AXIS_NORTH);
    pick(AXIS_SOUTH);
    await user.click(button(UNDO_LABEL));

    expect(values().frontageAxis).toEqual([AXIS_NORTH]);
  });

  it('🔑 Α5 — η ολοκλήρωση είναι ΑΠΕΝΕΡΓΟΠΟΙΗΜΕΝΗ με λιγότερες από 2 κορυφές', () => {
    renderField();

    expect(button(`${K}.gestureDone`)).toBeDisabled();

    pick(AXIS_NORTH);
    expect(button(`${K}.gestureDone`)).toBeDisabled();

    pick(AXIS_SOUTH);
    expect(button(`${K}.gestureDone`)).toBeEnabled();
  });
});

// =============================================================================
// Β — Η ΜΕΤΑΒΑΣΗ: από «τράβα γραμμή» σε «δείξε πλευρά»
// =============================================================================

describe('Β — ο άξονας κλειδώνει', () => {
  it('Β1 — η ολοκλήρωση αλλάζει την ΟΔΗΓΙΑ και φέρνει τα ρητά κουμπιά πλευράς', async () => {
    const user = userEvent.setup();
    renderField();

    pick(AXIS_NORTH);
    pick(AXIS_SOUTH);
    await user.click(button(`${K}.gestureDone`));

    expect(screen.getByText(`${K}.gestureSide`)).toBeInTheDocument();
    expect(screen.queryByText(`${K}.gestureAxis`)).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: `${K}.sideBoth` })).toBeInTheDocument();
  });

  it('Β2 — ζήτηση με ΗΔΗ σχεδιασμένο άξονα ανοίγει κατευθείαν στην προεπισκόπηση', () => {
    renderField({ frontageAxis: [...AXIS] });

    expect(screen.getByText(`${K}.gestureSide`)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `${K}.gestureDone` })).not.toBeInTheDocument();
  });
});

// =============================================================================
// Θ — Η ΚΡΙΣΗ ΠΛΕΥΡΑΣ: ΕΔΩ ΖΟΥΣΕ ΤΟ ΣΦΑΛΜΑ
// =============================================================================

describe('🔴 Θ — το κλικ ΚΡΙΝΕΙ πλευρά', () => {
  /**
   * ⚠️ **Φρουρός του ίδιου του σεναρίου.** Αν κάποιος πειράξει τις συντεταγμένες, αυτή
   * η άγκυρα κοκκινίζει **πρώτη** και λέει «το σενάριο χάλασε», ώστε οι Θ1/Θ2 να μη
   * μετατραπούν σιωπηλά σε δοκιμές που δεν διακρίνουν τίποτα.
   */
  it('Θ0 — τα δύο σημεία βρίσκονται ΟΝΤΩΣ σε αντίθετες πλευρές, κατά το SSoT', () => {
    expect(sideOfPolyline(EAST, AXIS)).toBe('left');
    expect(sideOfPolyline(WEST, AXIS)).toBe('right');
  });

  it('🔑 Θ1 — κλικ ανατολικά ⇒ `left`, και ο άξονας ΔΕΝ μεγαλώνει', () => {
    renderField({ frontageAxis: [...AXIS] });

    pick(EAST);

    expect(values().frontageSide).toBe('left');
    expect(values().frontageAxis).toEqual([...AXIS]);
  });

  it('🔑 Θ2 — κλικ δυτικά ⇒ `right`', () => {
    renderField({ frontageAxis: [...AXIS], frontageSide: 'left' });

    pick(WEST);

    expect(values().frontageSide).toBe('right');
  });

  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΗΣ ΣΕΙΡΑΣ ΟΡΙΣΜΑΤΩΝ.** Δεν γράφει καμία γεωμετρική σταθερά: ρωτά το
   * ίδιο το SSoT με τη **σωστή** σειρά και απαιτεί η οθόνη να συμφωνήσει. Αντεστραμμένα
   * ορίσματα στο component δίνουν άλλη απάντηση — ή καμία.
   */
  it('🔑 Θ3 — η οθόνη συμφωνεί με το SSoT για ΚΑΘΕ σημείο του σεναρίου', () => {
    for (const point of [EAST, WEST]) {
      mockPlaceMap.mockClear();
      renderField({ frontageAxis: [...AXIS] });

      pick(point);

      expect(values().frontageSide).toBe(sideOfPolyline(point, AXIS));
    }
  });

  it('Θ4 — κλικ ΠΑΝΩ στον άξονα (`on`) δεν αλλάζει τίποτα', () => {
    renderField({ frontageAxis: [...AXIS], frontageSide: 'both' });

    pick(AXIS_NORTH);

    expect(values().frontageSide).toBe('both');
  });

  /**
   * ⚠️ Το `sideOfPolyline` **δεν επιστρέφει ποτέ** `'both'` — το κλικ είναι συντόμευση,
   * όχι η μόνη οδός. Χωρίς τα ρητά κουμπιά, το «και τα δύο» θα ήταν αδιατύπωτο.
   */
  it('Θ5 — το «και τα δύο» δηλώνεται με κουμπί, γιατί κλικ δεν το παράγει ποτέ', async () => {
    const user = userEvent.setup();
    renderField({ frontageAxis: [...AXIS], frontageSide: 'left' });

    await user.click(screen.getByRole('radio', { name: `${K}.sideBoth` }));

    expect(values().frontageSide).toBe('both');
  });
});

// =============================================================================
// Ζ — Η ΖΩΝΗ ΠΟΥ ΠΑΡΑΔΙΔΕΤΑΙ ΣΤΟΝ ΧΑΡΤΗ (η σύνδεση, όχι τα μαθηματικά)
// =============================================================================

describe('Ζ — η ζώνη προεπισκόπησης', () => {
  it('🔑 Ζ1 — είναι ΑΚΡΙΒΩΣ ό,τι λέει το SSoT για (άξονας, πλευρά, βάθος)', () => {
    renderField({ frontageAxis: [...AXIS] });

    expect(lastMapProps().outline).toEqual(
      frontagePolylineOutline(AXIS, EMPTY_DEMAND_FORM.frontageSide, DEFAULT_FRONTAGE_DEPTH_METRES),
    );
  });

  it('Ζ2 — αλλάζοντας πλευρά, αλλάζει και το σχήμα που παραδίδεται', async () => {
    const user = userEvent.setup();
    renderField({ frontageAxis: [...AXIS] });

    await user.click(screen.getByRole('radio', { name: `${K}.sideLeft` }));

    expect(lastMapProps().outline).toEqual(
      frontagePolylineOutline(AXIS, 'left', DEFAULT_FRONTAGE_DEPTH_METRES),
    );
  });

  it('Ζ3 — με μία κορυφή δεν υπάρχει ζώνη: ο χάρτης παίρνει `null`, όχι μισό σχήμα', () => {
    renderField();

    pick(AXIS_NORTH);

    expect(lastMapProps().outline).toBeNull();
  });
});

// =============================================================================
// Ε — Η ΕΠΑΝΑΦΟΡΑ: η «καθαρή» κατάσταση δεν επιβάλλει όρο
// =============================================================================

describe('🔴 Ε — η επαναφορά', () => {
  /**
   * 🔴 **Το δεύτερο σφάλμα της ίδιας εργασίας.** Η επαναφορά έγραφε `FRONTAGE_SIDES[0]`
   * (= `'left'`), δηλαδή η «καθαρή» κατάσταση **επέβαλλε σιωπηλά πλευρά** που ο
   * άνθρωπος δεν ζήτησε. Η ουδέτερη τιμή είναι αυτή του `EMPTY_DEMAND_FORM`.
   */
  it('🔑 Ε1 — το `side` γυρίζει σε «δεν το θέτω ως όρο», ΟΧΙ στην πρώτη τιμή του πίνακα', async () => {
    const user = userEvent.setup();
    renderField({ frontageAxis: [...AXIS], frontageSide: 'right' });

    await user.click(button(`${K}.reset`));

    expect(values().frontageSide).toBe('both');
  });

  it('Ε2 — αδειάζει τον άξονα, επαναφέρει βάθος και φάση· το όνομα οδού ΕΠΙΖΕΙ', async () => {
    const user = userEvent.setup();
    renderField({
      frontageAxis: [...AXIS],
      frontageDepthMetres: 12,
      frontageStreetName: 'Μεγάλου Αλεξάνδρου',
    });

    await user.click(button(`${K}.reset`));

    expect(values().frontageAxis).toEqual([]);
    expect(values().frontageDepthMetres).toBe(DEFAULT_FRONTAGE_DEPTH_METRES);
    expect(values().frontageStreetName).toBe('Μεγάλου Αλεξάνδρου');
    expect(screen.getByText(`${K}.gestureAxis`)).toBeInTheDocument();
  });
});
