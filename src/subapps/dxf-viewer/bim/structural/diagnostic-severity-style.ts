/**
 * diagnostic-severity-style — SSoT για τα χρώματα/πάχη της οπτικής επισήμανσης
 * διαγνωστικών στην κάτοψη (ADR-490). ΕΝΑ σημείο ορισμού ώστε halo + badge + (μελλοντικό
 * legend) να μένουν συνεπή. Δεν υπάρχει υπάρχον severity-color SSoT (grep κενό).
 *
 * Σύμβαση Robot/SAP: error = κόκκινο (σοβαρό, π.χ. μηχανισμός/δοκάρι στον αέρα),
 * warning = amber (προσοχή). Το `info` δεν επισημαίνεται στην κάτοψη.
 *
 * Pure constants — zero React/DOM.
 */

import type { HighlightSeverity } from './organism/diagnostic-highlight';

/** Στυλ επισήμανσης ανά severity. */
export interface SeverityStyle {
  /** Χρώμα περιγράμματος (halo) γύρω από το footprint. */
  readonly halo: string;
  /** true ⇒ σχεδιάζεται και badge ⚠ (μόνο για σοβαρά error). */
  readonly badge: boolean;
}

const STYLES: Record<HighlightSeverity, SeverityStyle> = {
  // Κόκκινο, έντονο halo + badge — π.χ. δοκάρι στον αέρα (μηχανισμός).
  error: { halo: 'rgba(220,38,38,0.95)', badge: true },
  // Amber, διακριτικό halo χωρίς badge.
  warning: { halo: 'rgba(217,119,6,0.90)', badge: false },
};

export function severityStyle(severity: HighlightSeverity): SeverityStyle {
  return STYLES[severity];
}

/** Γέμισμα του badge ⚠ (κίτρινο τρίγωνο, μαύρο θαυμαστικό) — σταθερό για σοβαρότητα error. */
export const BADGE_FILL = 'rgba(220,38,38,0.96)';
export const BADGE_GLYPH = 'rgba(255,255,255,0.98)';
