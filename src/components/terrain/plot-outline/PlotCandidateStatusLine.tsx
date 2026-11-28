'use client';

/**
 * @fileoverview **Η γραμμή κατάστασης κάτω από το σχέδιο** — ποιο υποψήφιο είναι τονισμένο τώρα (ADR-920 §14.11 «Ζ4 — αμφίδρομη
 * επισήμανση»).
 * @related ./PlotDrawingImport (ζει μέσα στην κολλημένη όψη) · ./plot-candidate-text (η ΙΔΙΑ φράση με τον τίτλο της κάρτας)
 * @module components/terrain/plot-outline/PlotCandidateStatusLine
 *
 * 🔑 **Γιατί υπάρχει**: το πέρασμα πάνω από μια γραμμή ανάβει την κάρτα της — αλλά με 65 υποψήφια η κάρτα μπορεί να είναι έξω
 *    από την οθόνη, και το hover δεν κυλά ποτέ (ADR-777 §7 Α3). Το Revit λύνει ακριβώς αυτό με τη γραμμή κατάστασης που ΟΝΟΜΑΖΕΙ
 *    το προ-τονισμένο στοιχείο: «μην κουνηθείς, πες του τι είναι».
 * 🔑 **Πάντα στη θέση της** (κενή όταν δεν τονίζεται τίποτα) ⇒ η κολλημένη όψη δεν αλλάζει ύψος και η λίστα από κάτω δεν πηδά.
 * 🔑 **Όχι `aria-live`**: αλλάζει σε κάθε κίνηση του δείκτη — θα ήταν θόρυβος. Ο αναγνώστης οθόνης έχει ήδη το όνομα από την
 *    εστίαση (σχήμα-κουμπί · radio της κάρτας).
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PlotOutlineRanking } from '@/lib/terrain/plot-outline/plot-outline-types';

import { usePlotCandidatePeekedId, type PlotCandidatePeek } from './plot-candidate-peek';
import { plotCandidateHeadline } from './plot-candidate-text';

const NS = 'terrain-survey:plotOutline';

/** Φύλλο (ADR-040): ρωτά ΜΟΝΟ αυτό το εφήμερο — ένα hover ξαναγράφει αυτή τη γραμμή, όχι την όψη που την περιέχει. */
export function PlotCandidateStatusLine({ ranking, peek }: {
  readonly ranking: PlotOutlineRanking;
  readonly peek: PlotCandidatePeek;
}) {
  const { t } = useTranslation(['terrain-survey']);
  const peekedId = usePlotCandidatePeekedId(peek);
  const peeked = peekedId === null ? null : ranking.ranked.find((entry) => entry.candidate.id === peekedId)?.candidate ?? null;
  return (
    <p className="m-0 min-h-5 truncate border-x border-b border-border bg-card px-2 py-0.5 text-xs text-foreground">
      {peeked === null ? '' : t(`${NS}.view.peeked`, { candidate: plotCandidateHeadline(peeked, t) })}
    </p>
  );
}
