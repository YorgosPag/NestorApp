/**
 * ADR-782 §15 — τι ΒΛΕΠΕΙ ο μηχανικός πριν αλλάξει το `Project.basePoint`.
 *
 * Η μετάφραση είναι mock-αρισμένη (όπως σε κάθε component test του subapp), οπότε αυτό το αρχείο
 * **δεν** ελέγχει τη διατύπωση — την ελέγχει το locale JSON και ο CHECK 3.8. Ελέγχει το άλλο μισό:
 * **ποια στοιχεία εμφανίζονται μαζί**.
 *
 * 🔴 Γιατί υπάρχει: μέχρι τις 2026-08-10 το «Αυτόματο κούμπωμα» έγραφε τη γεωαναφορά και έλεγε
 * «ολοκληρώθηκε» χωρίς να μετρηθεί ποτέ. Σε πραγματικό έργο μετακίνησε το σχέδιο **23,185 m**.
 * Η θεραπεία δεν είναι να απαγορευτεί η εκτίμηση — είναι να **συνυπάρχει με την ετυμηγορία της**.
 * Χωρίς άγκυρα, η επόμενη «τακτοποίηση» της κάρτας που κρύβει την άρνηση όταν υπάρχει `geo`
 * επαναφέρει τη σιωπή, και όλα τα υπόλοιπα tests μένουν πράσινα.
 *
 * @see ../TopoGeoMatchResultCard
 * @see ../../../../systems/geo-referencing/geo-auto-match — proposeRobustCenterAlignment
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { TopoGeoMatchResultCard } from '../TopoGeoMatchResultCard';
import type { GeoMatchResult } from '../../../../systems/geo-referencing/geo-auto-match';

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

const APPLY_KEY = 'topography.geoRef.match.apply';
const TOO_FEW = 'topography.geoRef.match.failure.tooFewInliers';

function result(over: Partial<GeoMatchResult>): GeoMatchResult {
  return {
    method: 'robust-center',
    geo: { originWorld: { x: 407_395_376, y: 4_503_586_887 }, rotationDeg: 0 },
    inliers: 0,
    matchable: 84,
    required: 26,
    rmsMm: 0,
    rotationDeg: 0,
    scaleEstimate: 1,
    suggestedUnitScale: null,
    layerName: null,
    hypotheses: 0,
    failure: null,
    ...over,
  };
}

const noop = (): void => {};

describe('TopoGeoMatchResultCard — η απόδειξη πριν την εφαρμογή (ADR-782 §15)', () => {
  it('🎯 Κ1: εκτίμηση που ΚΟΠΗΚΕ στις πύλες δείχνει ΚΑΙ την άρνηση ΚΑΙ το «Εφαρμογή»', () => {
    render(
      <TopoGeoMatchResultCard
        result={result({ method: 'robust-center', failure: 'too-few-inliers' })}
        onApply={noop}
        onDismiss={noop}
      />,
    );

    // Η άρνηση, με τους ΑΡΙΘΜΟΥΣ — «0 ενώ χρειάζονται 26» και όχι σκέτο «δεν ταίριαξε».
    expect(screen.getByText(`${TOO_FEW}(inliers=0,required=26,cm=0.0)`)).toBeInTheDocument();

    // ΚΑΙ το κουμπί: ο μηχανικός επιτρέπεται να πάρει πρόχειρη αφετηρία — ΕΝ ΓΝΩΣΕΙ ΤΟΥ.
    expect(screen.getByRole('button', { name: APPLY_KEY })).toBeInTheDocument();

    // Και η ίδια η μέτρηση, όχι μόνο το πρόσημό της.
    expect(screen.getByText('topography.geoRef.match.proof.inliersValue(inliers=0,matchable=84,required=26)'))
      .toBeInTheDocument();
  });

  it('Κ2: πρόταση που ΠΕΡΑΣΕ τις πύλες δεν εμφανίζει κείμενο άρνησης', () => {
    render(
      <TopoGeoMatchResultCard
        result={result({ method: 'identity-restore', inliers: 84, failure: null })}
        onApply={noop}
        onDismiss={noop}
      />,
    );

    expect(screen.queryByText(new RegExp(`^${TOO_FEW}`))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: APPLY_KEY })).toBeInTheDocument();
    expect(screen.getByText('topography.geoRef.match.methodHint.identityRestore')).toBeInTheDocument();
  });

  it('Κ3: αποτυχία χωρίς γεωαναφορά ΔΕΝ προσφέρει «Εφαρμογή» — δεν υπάρχει τι να εφαρμοστεί', () => {
    render(
      <TopoGeoMatchResultCard
        result={result({ method: 'needs-manual', geo: null, failure: 'too-few-inliers' })}
        onApply={noop}
        onDismiss={noop}
      />,
    );

    expect(screen.queryByRole('button', { name: APPLY_KEY })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'topography.geoRef.match.dismiss' })).toBeInTheDocument();
  });

  it('Κ4: το «Αυτόματο κούμπωμα» ονομάζεται ως ΕΚΤΙΜΗΣΗ, όχι ως ταύτιση', () => {
    render(
      <TopoGeoMatchResultCard
        result={result({ method: 'robust-center', failure: 'too-few-inliers' })}
        onApply={noop}
        onDismiss={noop}
      />,
    );

    expect(screen.getByText(/topography\.geoRef\.match\.method\.robustCenter/)).toBeInTheDocument();
    expect(screen.getByText('topography.geoRef.match.methodHint.robustCenter')).toBeInTheDocument();
  });
});
