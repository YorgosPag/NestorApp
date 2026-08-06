/**
 * 🔴 ADR-767 Δ4 / §8 #6 — **Ο ΦΡΑΓΜΟΣ ΠΟΥ ΔΕΝ ΠΑΡΑΚΑΜΠΤΕΤΑΙ ΜΕ `Enter`.**
 *
 * ## Ο κίνδυνος, γραμμένος στο ίδιο το ADR
 * > «Ο φραγμός εξαγωγής γίνεται **παρακάμψιμος με `Enter`** ⇒ κανείς δεν τον διαβάζει.
 * > Ρητή επιλογή, όχι προεπιλεγμένο κουμπί· η επιλογή “εξάγω έτσι” **καταγράφεται**.»
 *
 * Δεν είναι θεωρητικό: ο χρήστης που πατά «Εξαγωγή» έχει ήδη το δάχτυλο στο `Enter`. Ένας
 * διάλογος με εστιασμένο κουμπί «Εξαγωγή όπως είναι» θα καταναλωνόταν από την **ορμή** της
 * προηγούμενης χειρονομίας, και ο φραγμός θα υπήρχε μόνο στον κώδικα.
 *
 * ## Γιατί ΔΟΜΙΚΟ και όχι «πρόσεχε πού βάζεις autoFocus»
 * Το Radix εστιάζει **από μόνο του** το πρώτο εστιάσιμο στοιχείο του διαλόγου. Άρα «μην βάλεις
 * `autoFocus`» δεν αρκεί — η προεπιλογή είναι ήδη λάθος. Η εστίαση πάει ρητά στο **κείμενο**
 * (`onOpenAutoFocus`), δηλαδή ο χρήστης πρέπει να **διαλέξει** πριν οποιοδήποτε πλήκτρο κάνει
 * κάτι. Αυτό είναι το ίδιο συμπέρασμα με το AutoCAD «Outdated Table» task dialog, όπου καμία
 * επιλογή δεν είναι default.
 *
 * ## Και ο **άγνωστος** δεν είναι «εντάξει»
 * Πίνακας που δεν μπόρεσε να ελεγχθεί δηλώνεται **χωριστά** από τον μπαγιάτικο, γιατί απαιτεί
 * **άλλη** ενέργεια από τον χρήστη: ο ένας θέλει «Ανανέωση», ο άλλος θέλει διόρθωση της πηγής.
 * Η ισοπέδωσή τους θα ήταν το ψεύτικο πράσινο των N.11/N.12 μεταφερμένο σε διάλογο.
 *
 * @see ui/components/export/BoundTableExportBarrier.tsx
 * @see docs/centralized-systems/reference/adrs/ADR-767-table-bound-mode.md §4 Δ4, §8 #6
 */

import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BoundTableExportBarrier } from '../BoundTableExportBarrier';
import type { BoundTableExportVerdict } from '../../../../bim/table/binding/table-binding-export-guard';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  // Το κλειδί **είναι** η ετικέτα: αυτά τα tests φυλάνε συμπεριφορά, όχι λεκτικό — και ένα
  // πραγματικό locale θα τα έκανε να πέφτουν σε κάθε διόρθωση κειμένου.
  useTranslation: () => ({ t: (key: string) => key }),
}));

const STALE_ONLY: BoundTableExportVerdict = {
  blocked: true,
  stale: [{ entityId: 'tbl_1', freshRevision: 'abc' }],
  unchecked: [],
  examined: 3,
};

const UNCHECKED_ONLY: BoundTableExportVerdict = {
  blocked: true,
  stale: [],
  unchecked: [{ entityId: 'tbl_2', reason: 'source-not-wired' }],
  examined: 1,
};

function renderBarrier(verdict: BoundTableExportVerdict) {
  const onProceed = jest.fn();
  const onCancel = jest.fn();
  render(<BoundTableExportBarrier verdict={verdict} onProceed={onProceed} onCancel={onCancel} />);
  return { onProceed, onCancel };
}

// ─── 1. 🔴 Καμία προεπιλεγμένη επιλογή ────────────────────────────────────────

describe('🔴 §8 #6 — ρητή επιλογή, ΠΟΤΕ προεπιλεγμένο κουμπί', () => {
  it('🔴 ΚΑΝΕΝΑ ΚΟΥΜΠΙ ΔΕΝ ΕΧΕΙ ΤΗΝ ΕΣΤΙΑΣΗ ΜΕ ΤΟ ΠΟΥ ΑΝΟΙΓΕΙ', async () => {
    renderBarrier(STALE_ONLY);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    expect(document.activeElement?.tagName).not.toBe('BUTTON');
  });

  it('🔴 `Enter` ΜΕ ΤΟ ΠΟΥ ΑΝΟΙΓΕΙ ΔΕΝ ΕΞΑΓΕΙ ΤΙΠΟΤΑ — η ορμή δεν αποφασίζει', async () => {
    const { onProceed, onCancel } = renderBarrier(STALE_ONLY);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await userEvent.keyboard('{Enter}');

    expect(onProceed).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('κανένα κουμπί δεν είναι `type="submit"` — δεν υπάρχει implicit submission', async () => {
    renderBarrier(STALE_ONLY);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('type')).not.toBe('submit');
    }
  });
});

// ─── 2. Οι δύο ρητές επιλογές ─────────────────────────────────────────────────

describe('οι δύο δρόμοι — και οι δύο απαιτούν κλικ', () => {
  it('«Εξαγωγή όπως είναι» καλεί `onProceed` και ΜΟΝΟ αυτό', async () => {
    const { onProceed, onCancel } = renderBarrier(STALE_ONLY);

    await userEvent.click(await screen.findByText('export.boundTables.proceed'));

    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('«Ακύρωση» καλεί `onCancel` και ΔΕΝ εξάγει', async () => {
    const { onProceed, onCancel } = renderBarrier(STALE_ONLY);

    await userEvent.click(await screen.findByText('export.boundTables.cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onProceed).not.toHaveBeenCalled();
  });

  it('🔴 ΤΟ `Escape` ΕΙΝΑΙ ΑΚΥΡΩΣΗ, ΠΟΤΕ ΕΞΑΓΩΓΗ — η έξοδος δεν είναι συγκατάθεση', async () => {
    const { onProceed, onCancel } = renderBarrier(STALE_ONLY);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');

    expect(onProceed).not.toHaveBeenCalled();
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

// ─── 3. Τι λέει ο φραγμός ─────────────────────────────────────────────────────

describe('η αναφορά — «δεν ξέρω» ≠ «διαφέρει»', () => {
  it('μπαγιάτικοι πίνακες: δηλώνεται το πλήθος τους', async () => {
    renderBarrier(STALE_ONLY);

    expect(await screen.findByText(/export\.boundTables\.stale/)).toBeInTheDocument();
  });

  it('🔴 ΑΝΕΛΕΓΚΤΟΙ ΠΙΝΑΚΕΣ ΔΗΛΩΝΟΝΤΑΙ ΧΩΡΙΣΤΑ — άλλη κατάσταση, άλλη ενέργεια', async () => {
    renderBarrier(UNCHECKED_ONLY);

    expect(await screen.findByText(/export\.boundTables\.unchecked/)).toBeInTheDocument();
    expect(screen.queryByText(/export\.boundTables\.stale/)).not.toBeInTheDocument();
  });

  it('🔴 ΤΟ ΠΛΗΘΟΣ ΤΩΝ ΕΞΕΤΑΣΘΕΝΤΩΝ ΛΕΓΕΤΑΙ — «0 μπαγιάτικοι» χωρίς αυτό δεν σημαίνει τίποτα', async () => {
    renderBarrier(STALE_ONLY);

    expect(await screen.findByText(/export\.boundTables\.examined/)).toBeInTheDocument();
  });

  it('ο λόγος του ανέλεγκτου ονομάζεται — ο χρήστης πρέπει να ξέρει τι να διορθώσει', async () => {
    renderBarrier(UNCHECKED_ONLY);

    expect(await screen.findByText('export.boundTables.reasonNotWired')).toBeInTheDocument();
  });
});
