'use client';

import React from 'react';
import {
  useAutoBreaklineState,
} from '../../systems/topography/auto-breaklines/auto-breakline-store';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { UI_COLORS } from '../../config/color-config';
// Πάχη γραμμής (px οθόνης) ανά κατάσταση: η εστιασμένη είναι ΚΑΙ πιο χοντρή ΚΑΙ φοράει άλως στο
// χρώμα επιλογής — «χρώμα ΚΑΙ μέγεθος», γιατί μόνο το χρώμα χάνεται σε ένα σχέδιο γεμάτο πράσινες
// υποψήφιες, και μόνο το πάχος χάνεται σε μια πυκνή δέσμη. ADR-650 M8β/Γ v2: κοινό SSoT με το 3Δ —
// από τότε που το 3Δ μπορεί να εκφράσει πάχος, δύο αντίγραφα των ίδιων αριθμών θα απόκλιναν.
import {
  AUTO_BREAKLINE_HALO_OPACITY as HALO_OPACITY,
  AUTO_BREAKLINE_STROKE_PX as STROKE_WIDTH,
} from '../../systems/topography/auto-breaklines/auto-breakline-review-style';
import type { ViewTransform, Viewport } from '../../rendering/types/Types';
import type { AutoBreaklineCandidate } from '../../systems/topography/auto-breaklines/auto-breakline-types';

interface Props {
  readonly transform: ViewTransform;
  readonly viewport: Viewport;
}

/**
 * ADR-650 M8β/Γ — προεπισκόπηση των ΠΡΟΤΕΙΝΟΜΕΝΩΝ γραμμών ασυνέχειας (auto-breaklines).
 *
 * Ο μηχανικός πρέπει να ΔΕΙ τι θα προστεθεί πριν το εγκρίνει — μια λίστα «βρέθηκαν 12
 * υποψήφιες» χωρίς σχήμα στον καμβά δεν είναι κρίσιμη πληροφορία, είναι αριθμός (§9,
 * human-certifier: preview ≡ ό,τι θα γραφτεί). Πράσινο συμπαγές = τσεκαρισμένη (θα μπει)·
 * γκρι διακεκομμένο = ξετσεκαρισμένη (θα αγνοηθεί). Οι κορυφές είναι ήδη WORLD canonical mm
 * (ADR-462) = canvas units, όπως και οι ισοϋψείς — καμία μετατροπή.
 *
 * Η ΕΣΤΙΑΣΜΕΝΗ (αυτή που μόλις πάτησε στη λίστα) σχεδιάζεται ΤΕΛΕΥΤΑΙΑ, με άλως: σε ένα σχέδιο με
 * 30 πράσινες υποψήφιες, το «σε ποια με πήγε το κλικ;» είναι ακριβώς η ερώτηση που δεν πρέπει να
 * μένει αναπάντητη — και μια άλως που σχεδιάζεται πρώτη θα κρυβόταν κάτω από τη διπλανή γραμμή.
 * Η κατάσταση έγκρισης (πράσινο/γκρι) ΔΕΝ αντικαθίσταται: εστίαση και έγκριση είναι δύο
 * ανεξάρτητες ερωτήσεις και το σχέδιο απαντά και στις δύο (ίδιο συμβόλαιο με το ⊙ του QA, όπου το
 * severity μένει ορατό κάτω από την επιλογή).
 *
 * ADR-040 compliant: standalone subscriber leaf (`useSyncExternalStore` εδώ, ΟΧΙ στο shell),
 * LOW-frequency store (γράφεται μόνο σε κλικ). Mirror του `RegionPerimeterPreviewOverlay`.
 */
export function TopoAutoBreaklinePreviewOverlay({ transform, viewport }: Props) {
  const { report, selected, focusedId } = useAutoBreaklineState();

  if (report === null || report.candidates.length === 0) return null;

  const toPath = (candidate: AutoBreaklineCandidate): string => {
    const d = candidate.vertices
      .map((v) => CoordinateTransforms.worldToScreen({ x: v.x, y: v.y }, transform, viewport))
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
    return candidate.closed ? `${d} Z` : d;
  };

  // Η εστιασμένη τελευταία στη σειρά ζωγραφικής (SVG = painter's order) → πάντα από πάνω.
  const ordered = [
    ...report.candidates.filter((c) => c.id !== focusedId),
    ...report.candidates.filter((c) => c.id === focusedId),
  ];

  return (
    <svg
      className="absolute inset-0 size-full pointer-events-none z-10"
      xmlns="http://www.w3.org/2000/svg"
    >
      {ordered.map((candidate) => {
        const approved = selected.has(candidate.id);
        const focused = candidate.id === focusedId;
        const d = toPath(candidate);
        return (
          <g key={candidate.id}>
            {focused && (
              <path
                d={d}
                fill="none"
                stroke={UI_COLORS.SELECTION_HIGHLIGHT}
                strokeWidth={STROKE_WIDTH.halo}
                strokeOpacity={HALO_OPACITY}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={approved ? UI_COLORS.TOPO_BREAKLINE_APPROVED : UI_COLORS.TOPO_BREAKLINE_REJECTED}
              strokeWidth={focused ? STROKE_WIDTH.focused : (approved ? STROKE_WIDTH.approved : STROKE_WIDTH.rejected)}
              // Η εστιασμένη μένει συμπαγής ακόμη κι αν είναι απορριφθείσα: η διακεκομμένη «σβήνει»
              // οπτικά και θα ακύρωνε την ίδια την έμφαση που μόλις ζήτησε ο μηχανικός.
              strokeDasharray={approved || focused ? undefined : '6 4'}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </g>
        );
      })}
    </svg>
  );
}
