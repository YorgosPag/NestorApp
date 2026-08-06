/**
 * @jest-environment ./tests/service-integration/_harness/jsdom-with-node-globals.js
 *
 * @fileoverview 🔴 **Η υπόσχεση «τίποτα δεν χάνεται σιωπηλά» γίνεται ΜΗΧΑΝΗ** (ADR-762 §5).
 *
 * Ο κανόνας 3 του ADR-745 υπήρχε από την πρώτη μέρα, και **τρία** σχόλια στον κώδικα τον
 * επαναλάμβαναν. Ένα `rg -n "unparsed|orphanValues" src` στις 06/08 έδωσε **κανέναν
 * καταναλωτή**: το πεδίο γραφόταν και δεν το διάβαζε κανείς. *Ένας κανόνας χωρίς πύλη είναι
 * σχόλιο* — ίδιο σχήμα με το ADR-587 §6.1.
 *
 * Αυτή η σουίτα είναι η πύλη. Αποδεικνύει **και τα δύο μισά της συμμετρίας** (τιμή χωρίς
 * ετικέτα · ετικέτα χωρίς τιμή) και, κυρίως, ότι η ενότητα **δεν προσφέρει καμία ενέργεια** —
 * γιατί ένα κουμπί «σύνδεσέ το» εδώ θα έγραφε στη βάση κάτι που δεν διαβάστηκε, αλλά μαντεύτηκε.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { TitleBlockReading } from '@/types/title-block-reading';

/**
 * Ηχώ κλειδιού **μαζί με τις παραμέτρους** — ίδιο πρότυπο με το `title-block-contact-creation`,
 * με μία προσθήκη που εδώ είναι απαραίτητη.
 *
 * 🔑 Σκέτη ηχώ (`t: (k) => k`) θα έκρυβε ακριβώς το ζητούμενο: αν η **τιμή** φτάνει στην οθόνη.
 * Με τις παραμέτρους ορατές, ο ισχυρισμός ελέγχει **και** ότι χρησιμοποιείται το κλειδί του SSoT
 * (`FIELD_LABEL`) **και** ότι το κείμενο περνά αυτούσιο — δύο πράγματα που πληρώθηκαν.
 */
jest.mock('@/i18n/hooks/useTranslation', () => ({
  __esModule: true,
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key} ${Object.values(vars).join(' ')}` : key,
  }),
}));

import { TitleBlockUnreadSection } from '../TitleBlockUnreadSection';

const reading = (over: Partial<TitleBlockReading>): TitleBlockReading => ({
  layerName: 'PINAKAKI 500',
  bbox: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
  fields: [],
  people: [],
  unmatchedLabels: [],
  unparsed: [],
  ...over,
});

describe('«Διαβάστηκε, δεν δέθηκε» — η υλοποίηση του §8 κανόνα 3', () => {
  it('🔴 η ετικέτα ΧΩΡΙΣ ΤΙΜΗ λέγεται — μέσω του SSoT ετικετών, όχι με ωμό κλειδί πεδίου', () => {
    render(
      <TitleBlockUnreadSection
        readings={[
          reading({
            unmatchedLabels: [
              { key: 'designers', labelHandle: '1057', at: { x: 0, y: 0 } },
            ],
          }),
        ]}
      />,
    );
    // Το ορατό κείμενο περνά από το **κλειδί** του πεδίου, όχι από ωμό `designers`: ένα τεχνικό
    // αναγνωριστικό στην οθόνη είναι μήνυμα μηχανής σε μηχανικό που δεν έφταιξε σε τίποτα.
    // Και το κλειδί έρχεται από το `FIELD_LABEL` (SSoT) — **ποτέ** δυναμικά συντεθειμένο, γιατί
    // ο generator του shell slice δεν επιλύει δυναμικά `t()` (ADR-744).
    expect(screen.getByText(/titleBlockBinding\.fields\.designers/)).toBeTruthy();
    expect(screen.getByText(/titleBlockBinding\.missingValue/)).toBeTruthy();
  });

  it('🔴 η τιμή ΧΩΡΙΣ ΕΤΙΚΕΤΑ λέγεται — αυτούσια, χωρίς «διόρθωση»', () => {
    render(
      <TitleBlockUnreadSection
        readings={[reading({ unparsed: ['ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ'] })]}
      />,
    );
    expect(screen.getByText(/ΤΟΠΟΓΡΑΦΙΚΕΣ ΜΕΛΕΤΕΣ - ΕΦΑΡΜΟΓΕΣ/)).toBeTruthy();
  });

  it('δύο πινακίδες στο ίδιο layer δίνουν ΔΥΟ γραμμές, όχι μία που καταπίνει την άλλη', () => {
    const { container } = render(
      <TitleBlockUnreadSection
        readings={[
          reading({ unparsed: ['ΙΔΙΟ ΚΕΙΜΕΝΟ'] }),
          reading({ unparsed: ['ΙΔΙΟ ΚΕΙΜΕΝΟ'] }),
        ]}
      />,
    );
    // Ταυτόσημο κείμενο σε δύο πινακίδες: αν το κλειδί της γραμμής ήταν το κείμενο, η React θα
    // κρατούσε **μία**. Ο δείκτης πινακίδας είναι μέσα στο κλειδί ακριβώς γι' αυτό.
    expect(container.querySelectorAll('li')).toHaveLength(2);
  });

  it('🔴 ΕΝΑ κελί με ΔΥΟ αζευγάρωτες ετικέτες — δύο γραμμές, καμία προειδοποίηση κλειδιού', () => {
    // Το πραγματικό σχήμα της **κενής φόρμας υπογραφής** του G753: το MTEXT `1126` φέρει
    // «ΕΡΓΟΔΟΤΗΣ … ΥΠΟΓΡΑΦΗ» και καμία τιμή ⇒ δύο γραμμές με **ίδιο handle**.
    //
    // 🔴 Ο πρώτος κώδικας κλείδωνε τη γραμμή στη λαβή και η React φώναξε
    // `two children with the same key` — **στην οθόνη του Giorgio, όχι εδώ**, γιατί ο
    // προηγούμενος ισχυρισμός κοιτούσε μόνο την αριστερή πινακίδα όπου οι λαβές διαφέρουν.
    // Ο ισχυρισμός πιάνει το **ίδιο το μήνυμα**: μέτρημα `<li>` μόνο του δεν αρκεί, γιατί η
    // React αποδίδει και τα δύο παιδιά **και** προειδοποιεί.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { container } = render(
        <TitleBlockUnreadSection
          readings={[
            reading({
              unmatchedLabels: [
                { key: 'employer', labelHandle: '1126', at: { x: 0, y: 0 } },
                { key: 'signature', labelHandle: '1126', at: { x: 0, y: 0 } },
              ],
            }),
          ]}
        />,
      );
      expect(container.querySelectorAll('li')).toHaveLength(2);
      const warnings = spy.mock.calls.map((args) => String(args[0]));
      expect(warnings.filter((w) => w.includes('same key'))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });

  it('🔴 ΚΑΜΙΑ ενέργεια — καμία εγγραφή δεν μπορεί να ξεκινήσει από εδώ', () => {
    const { container } = render(
      <TitleBlockUnreadSection
        readings={[
          reading({
            unparsed: ['ΚΑΤΙ'],
            unmatchedLabels: [{ key: 'employer', labelHandle: 'A', at: { x: 0, y: 0 } }],
          }),
        ]}
      />,
    );
    expect(container.querySelectorAll('button, a, input, select')).toHaveLength(0);
  });

  it('τίποτα αδιάθετο ⇒ ΤΙΠΟΤΑ στο DOM — κενή ενότητα εκπαιδεύει το μάτι να την προσπερνά', () => {
    const { container } = render(<TitleBlockUnreadSection readings={[reading({})]} />);
    expect(container.innerHTML).toBe('');
  });
});
