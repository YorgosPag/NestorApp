/**
 * ADR-720 — τι ΒΛΕΠΕΙ ο μηχανικός στον οδηγό εισαγωγής.
 *
 * Η μετάφραση είναι mock-αρισμένη (όπως σε κάθε component test του subapp: το ICU δεν αποδίδεται
 * μέσα στο jest), οπότε αυτό το αρχείο **δεν** ελέγχει τη διατύπωση — την ελέγχει το locale JSON και
 * ο CHECK 3.8. Ελέγχει το άλλο μισό, που είναι και το επίφοβο: **ποια κλειδιά καλούνται, με ποιες
 * παραμέτρους, και ΠΟΤΕ εμφανίζεται το καθένα**.
 *
 * Εκεί γεννιούνται τα «33 / 60» του acceptance test, και εκεί ζει ο κανόνας που κρατά τον δείκτη
 * χρήσιμο: η υψομετρική γραμμή εμφανίζεται **μόνο** όταν υπάρχει πράγματι δισδιάστατο σημείο. Ένας
 * δείκτης που ανάβει και στα κανονικά αρχεία παύει να διαβάζεται.
 *
 * @see ../TopoImportPointSummary
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { TopoImportPointSummary } from '../TopoImportPointSummary';
import type { ElevationCoverage } from '../../../../systems/topography/topo-point-elevation';

/** Το mock εκπέμπει `key(param=value,…)` ώστε να είναι ορατές ΚΑΙ οι παράμετροι, όχι μόνο το κλειδί. */
jest.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const args = params
        ? Object.entries(params).map(([k, v]) => `${k}=${String(v)}`).join(',')
        : '';
      return args ? `${key}(${args})` : key;
    },
  }),
}));

const coverage = (total: number, withElevation: number): ElevationCoverage => ({
  total,
  withElevation,
  planimetricOnly: total - withElevation,
});

/** Το πραγματικό αρχείο του εργοταξίου: 93 σημεία, 33 με υψόμετρο. */
const EYOSMOS = coverage(93, 33);

describe('TopoImportPointSummary — ο δείκτης του οδηγού (ADR-720)', () => {
  it('🎯 λέει «93 σημεία» ΚΑΙ τη διάσπαση 33/60 — αυτό είναι το acceptance criterion', () => {
    render(<TopoImportPointSummary coverage={EYOSMOS} skippedCount={0} tone="preview" />);

    expect(screen.getByText(/topography\.import\.previewCount\(count=93\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/previewElevationSplit\(withElevation=33,planimetric=60\)/),
    ).toBeInTheDocument();
  });

  it('🎯 και ΔΕΝ αναφέρει καμία παραλειπόμενη γραμμή', () => {
    render(<TopoImportPointSummary coverage={EYOSMOS} skippedCount={0} tone="preview" />);
    expect(screen.queryByText(/previewSkipped/)).not.toBeInTheDocument();
  });

  it('δίνει τον ΡΗΤΟ σημειωτή — όχι γκρίζα ψιλά γράμματα', () => {
    render(<TopoImportPointSummary coverage={EYOSMOS} skippedCount={0} tone="preview" />);
    const note = screen.getByText(/planimetricNote\(withElevation=33,planimetric=60\)/);
    expect(note).toBeInTheDocument();
    // Ο σημειωτής λέει ότι μέρος του αρχείου ΔΕΝ ορίζει την επιφάνεια — αυτό αλλάζει τι παίρνει ο
    // μηχανικός, άρα δεν επιτρέπεται να φοράει το `.hint` (opacity 0.75) όπου τέτοια πάνε να χαθούν.
    expect(note.className).toContain('note');
  });

  it('σε πλήρες αρχείο ΣΙΩΠΑ — κανένας δείκτης που ανάβει πάντα', () => {
    render(<TopoImportPointSummary coverage={coverage(93, 93)} skippedCount={0} tone="preview" />);

    expect(screen.getByText(/previewCount\(count=93\)/)).toBeInTheDocument();
    expect(screen.queryByText(/previewElevationSplit/)).not.toBeInTheDocument();
    expect(screen.queryByText(/planimetricNote/)).not.toBeInTheDocument();
  });

  it('γραμμή που ΔΕΝ διαβάστηκε εξακολουθεί να αναφέρεται (το «skipped» δεν καταργήθηκε)', () => {
    // ADR-720 άλλαξε τη ΣΗΜΑΣΙΑ του skipped («δεν διαβάστηκε»), δεν το έσβησε: ένα αρχείο με γραμμή
    // υπομνήματος πρέπει ακόμη να το λέει, αλλιώς η σιωπή θα κάλυπτε αληθινή απώλεια.
    render(<TopoImportPointSummary coverage={coverage(92, 32)} skippedCount={1} tone="preview" />);
    expect(screen.getByText(/previewSkipped\(count=1\)/)).toBeInTheDocument();
  });

  it('το βήμα επιβεβαίωσης χρησιμοποιεί τον δικό του, έντονο τίτλο', () => {
    render(<TopoImportPointSummary coverage={EYOSMOS} skippedCount={0} tone="confirm" />);

    const line = screen.getByText(/confirmCount\(count=93\)/);
    expect(line.className).toContain('summary');
    expect(screen.queryByText(/previewCount/)).not.toBeInTheDocument();
    // Η διάσπαση ακολουθεί και στα δύο βήματα — ίδιο component, καμία απόκλιση μεταξύ οθονών.
    expect(screen.getByText(/previewElevationSplit\(withElevation=33,planimetric=60\)/)).toBeInTheDocument();
  });
});
