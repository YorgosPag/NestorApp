'use client';

/**
 * ADR-716 §8.1 — ΟΡΑΤΗ απόφαση μονάδων με το αποδεικτικό της.
 *
 * Το δίδαγμα των μεγάλων (AutoCAD/Revit/ArchiCAD) δεν είναι *ποιον αλγόριθμο* τρέχουν — είναι ότι
 * η μονάδα είναι **ορατή απόφαση με απόδειξη**, όχι σιωπηλή παραδοχή. Το Revit μάλιστα έχει
 * διαβόητα αναξιόπιστο «Auto-Detect» και η κοινότητα συνιστά ρητή επιλογή· εμείς δείχνουμε ΚΑΙ
 * την επιλογή ΚΑΙ γιατί την πήραμε:
 *
 *   Αυτόματα → Μέτρα (m)
 *   Γεωαναφερμένο σχέδιο (ελληνικό προβολικό πλέγμα)
 *   Το σχέδιο βγαίνει 587 m × 488 m
 *
 * Η τρίτη γραμμή είναι η κρίσιμη: **επαληθεύεται με το μάτι σε ένα δευτερόλεπτο**. Ένας μηχανικός
 * που ξέρει ότι το οικόπεδό του είναι ~100 m βλέπει αμέσως το «5,9 m» ενός ×100 σφάλματος. Ίδιο
 * πρότυπο με το readout νεφών σημείων του ADR-650 M8β/Ε.
 *
 * Καθαρά παρουσιαστικό, μηδέν state — ΕΝΑ σπίτι για αυτό το μπλοκ, ώστε το wizard και η οθόνη
 * επιτυχίας να μη γεννήσουν δίδυμα (N.18).
 *
 * @module features/floorplan-import/components/UnitEvidenceReadout
 */

import { ScanSearch } from 'lucide-react';
import type { UnitDecision } from '@/subapps/dxf-viewer/utils/import-unit-decision';
import type { SceneUnits } from '@/subapps/dxf-viewer/utils/scene-units';
import type { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

interface TFn { (key: string, options?: Record<string, unknown>): string; }

/** Το ίδιο κλειδί ετικέτας που χρησιμοποιούν τα pills — μία ονοματολογία μονάδων στο UI. */
export const UNIT_LABEL_KEY: Readonly<Record<SceneUnits, string>> = {
  m: 'floorplanImport.drawingUnits.m',
  cm: 'floorplanImport.drawingUnits.cm',
  mm: 'floorplanImport.drawingUnits.mm',
  ft: 'floorplanImport.drawingUnits.ft',
  in: 'floorplanImport.drawingUnits.in',
};

/**
 * Διαστάσεις για ανθρώπινο μάτι: ακέραια μέτρα σε οικόπεδα/τοπογραφικά, ένα δεκαδικό σε
 * μικρά σχέδια — ώστε ένα «5,9 m» να μη στρογγυλοποιηθεί σε «6 m» και να χάσει το σήμα.
 */
export function formatMetres(value: number): string {
  const abs = Math.abs(value);
  return abs >= 100 ? String(Math.round(value)) : value.toFixed(1);
}

export interface UnitEvidenceReadoutProps {
  decision: UnitDecision | null | undefined;
  colors: ReturnType<typeof useSemanticColors>;
  t: TFn;
}

/**
 * ADR-716 Φ6 — Η επικεφαλίδα λέει ΠΟΙΟΣ αποφάσισε, όχι μόνο ΤΙ.
 *
 * Το «Αυτόματα → Μέτρα» πάνω από ένα «Ρητή επιλογή σας» ήταν αντιφατικό: ο μηχανικός
 * διάβαζε ότι μάντεψε η μηχανή ενώ είχε αποφασίσει ο ίδιος. Το κλειδί είναι **στατικό**
 * και στις δύο περιπτώσεις (N.11) — η επιλογή γίνεται εδώ, όχι με σύνθεση ονόματος.
 */
const RESOLVED_KEY = {
  explicit: 'floorplanImport.drawingUnits.resolvedExplicit',
  auto: 'floorplanImport.drawingUnits.resolved',
} as const;

export function UnitEvidenceReadout({ decision, colors, t }: UnitEvidenceReadoutProps) {
  if (!decision) return null;
  const { units, confidence, evidenceKey, resultingExtentM } = decision;
  const resolvedKey = confidence === 'explicit' ? RESOLVED_KEY.explicit : RESOLVED_KEY.auto;

  return (
    <section
      aria-live="polite"
      className={`flex items-start gap-2 rounded-md border border-border ${colors.bg.secondary} px-2.5 py-2`}
    >
      <ScanSearch className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${colors.text.info}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className={`text-xs font-medium ${colors.text.primary}`}>
          {t(resolvedKey, { unit: t(UNIT_LABEL_KEY[units]) })}
        </p>
        <p className={`text-xs ${colors.text.muted}`}>{t(evidenceKey)}</p>
        {resultingExtentM && (
          <p className={`text-xs ${colors.text.muted}`}>
            {t('floorplanImport.drawingUnits.extent', {
              width: formatMetres(resultingExtentM.width),
              height: formatMetres(resultingExtentM.height),
            })}
          </p>
        )}
      </div>
    </section>
  );
}
