'use client';

import React from 'react';
import {
  useAutoBreaklineState,
} from '../../systems/topography/auto-breaklines/auto-breakline-store';
import { UI_COLORS } from '../../config/color-config';
// Πάχη γραμμής (px οθόνης) ανά κατάσταση: η εστιασμένη είναι ΚΑΙ πιο χοντρή ΚΑΙ φοράει άλως στο
// χρώμα επιλογής — «χρώμα ΚΑΙ μέγεθος», γιατί μόνο το χρώμα χάνεται σε ένα σχέδιο γεμάτο πράσινες
// υποψήφιες, και μόνο το πάχος χάνεται σε μια πυκνή δέσμη. ADR-650 M8β/Γ v2: κοινό SSoT με το 3Δ —
// από τότε που το 3Δ μπορεί να εκφράσει πάχος, δύο αντίγραφα των ίδιων αριθμών θα απόκλιναν.
import {
  AUTO_BREAKLINE_HALO_OPACITY as HALO_OPACITY,
  AUTO_BREAKLINE_STROKE_PX as STROKE_WIDTH,
} from '../../systems/topography/auto-breaklines/auto-breakline-review-style';
import type { Viewport } from '../../rendering/types/Types';
// ADR-040 Phase XXII.B — δικό του transform subscription (leaf), όχι prop από τον shell.
import { useTransformValue } from '../../systems/cursor/ImmediateTransformStore';
// ADR-920 Β4.8 Β1 — ένας δρόμος WORLD→οθόνη (με την προβολή ΕΓΣΑ→DISPLAY) και ένας painter για κάθε ασυνέχεια.
import { useTopoDisplayProjector } from '../../systems/topography/useTopoDisplayProjector';
import { breaklineScreenPath } from './topo-breakline-paint/topo-breakline-screen-path';
import { TopoBreaklineStroke, type BreaklineStrokeSpec } from './topo-breakline-paint/TopoBreaklineStroke';

interface Props {
  readonly viewport: Viewport;
}

const FOCUS_HALO: BreaklineStrokeSpec = {
  color: UI_COLORS.SELECTION_HIGHLIGHT, widthPx: STROKE_WIDTH.halo, opacity: HALO_OPACITY,
};

function candidateStroke(approved: boolean, focused: boolean): BreaklineStrokeSpec {
  return {
    color: approved ? UI_COLORS.TOPO_BREAKLINE_APPROVED : UI_COLORS.TOPO_BREAKLINE_REJECTED,
    widthPx: focused ? STROKE_WIDTH.focused : (approved ? STROKE_WIDTH.approved : STROKE_WIDTH.rejected),
    // Η εστιασμένη μένει συμπαγής ακόμη κι αν είναι απορριφθείσα: η διακεκομμένη «σβήνει»
    // οπτικά και θα ακύρωνε την ίδια την έμφαση που μόλις ζήτησε ο μηχανικός.
    dash: approved || focused ? null : '6 4',
  };
}

/**
 * ADR-650 M8β/Γ — προεπισκόπηση των ΠΡΟΤΕΙΝΟΜΕΝΩΝ γραμμών ασυνέχειας (auto-breaklines).
 *
 * Ο μηχανικός πρέπει να ΔΕΙ τι θα προστεθεί πριν το εγκρίνει — μια λίστα «βρέθηκαν 12
 * υποψήφιες» χωρίς σχήμα στον καμβά δεν είναι κρίσιμη πληροφορία, είναι αριθμός (§9,
 * human-certifier: preview ≡ ό,τι θα γραφτεί). Πράσινο συμπαγές = τσεκαρισμένη (θα μπει)·
 * γκρι διακεκομμένο = ξετσεκαρισμένη (θα αγνοηθεί).
 *
 * ⚠️ ADR-920 Β1 — οι κορυφές είναι WORLD (ΕΓΣΑ) και ο καμβάς DISPLAY: περνούν από τον projector
 * (ADR-650 §M10f). Πριν το Β1 ζωγραφίζονταν απρόβλητες — αόρατες σε κάθε γεωαναφερμένο έργο.
 *
 * Η ΕΣΤΙΑΣΜΕΝΗ (αυτή που μόλις πάτησε στη λίστα) σχεδιάζεται ΤΕΛΕΥΤΑΙΑ, με άλως: σε ένα σχέδιο με
 * 30 πράσινες υποψήφιες, το «σε ποια με πήγε το κλικ;» είναι ακριβώς η ερώτηση που δεν πρέπει να
 * μένει αναπάντητη — και μια άλως που σχεδιάζεται πρώτη θα κρυβόταν κάτω από τη διπλανή γραμμή.
 * Η κατάσταση έγκρισης (πράσινο/γκρι) ΔΕΝ αντικαθίσταται: εστίαση και έγκριση είναι δύο
 * ανεξάρτητες ερωτήσεις και το σχέδιο απαντά και στις δύο.
 *
 * ADR-040 compliant: standalone subscriber leaf (`useSyncExternalStore` εδώ, ΟΧΙ στο shell),
 * LOW-frequency store (γράφεται μόνο σε κλικ). Ο μόνος high-freq hook είναι το transform.
 */
export function TopoAutoBreaklinePreviewOverlay({ viewport }: Props) {
  const { report, selected, focusedId } = useAutoBreaklineState();
  // ADR-040 Phase XXII.B — leaf-level transform (κοστίζει μόνο όσο υπάρχει report).
  const transform = useTransformValue();
  const projector = useTopoDisplayProjector();

  if (report === null || report.candidates.length === 0) return null;

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
        const { d } = breaklineScreenPath(candidate.vertices, candidate.closed, projector, transform, viewport);
        return (
          <TopoBreaklineStroke
            key={candidate.id}
            d={d}
            stroke={candidateStroke(approved, focused)}
            under={focused ? FOCUS_HALO : undefined}
          />
        );
      })}
    </svg>
  );
}
