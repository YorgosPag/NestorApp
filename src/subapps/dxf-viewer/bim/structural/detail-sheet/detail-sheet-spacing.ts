/**
 * Stirrup spacing-zone grouping — pure SSoT (ADR-471, boy-scout N.0.2).
 *
 * Ομαδοποιεί διαδοχικές στάθμες συνδετήρων σε ζώνες ίσου βήματος (round mm) ώστε η
 * διαστασιολόγηση να γράφει `count×gap` αντί για N μεμονωμένα κενά (Revit/Tekla: πυκνή
 * lcr `5×100`, μέση `@200`, πυκνή lcr `5×100`). Καθαρή συνάρτηση επί των θέσεων —
 * units-agnostic (z κατά ύψος κολόνας ή u κατά μήκος δοκού) — ώστε να τη μοιράζονται
 * ΚΑΙ η ΟΨΗ κολόνας (`column-detail-elevation`) ΚΑΙ η ΟΨΗ δοκού (`beam-detail-elevation`).
 *
 * @module subapps/dxf-viewer/bim/structural/detail-sheet/detail-sheet-spacing
 * @see docs/centralized-systems/reference/adrs/ADR-471-unified-member-reinforcement.md §2
 */

/** Μία ζώνη σταθερού βήματος μεταξύ δύο θέσεων στάθμης. */
export interface SpacingZone {
  /** Θέση αρχής της ζώνης (ίδιες μονάδες με τις στάθμες). */
  readonly start: number;
  /** Θέση τέλους της ζώνης. */
  readonly end: number;
  /** Βήμα (round mm) που επαναλαμβάνεται μέσα στη ζώνη. */
  readonly gap: number;
  /** Πλήθος κενών (όχι σταθμών) στη ζώνη. */
  readonly count: number;
}

/**
 * Ομαδοποιεί ταξινομημένες στάθμες σε ζώνες ίσου (round mm) βήματος. Λιγότερες από
 * δύο στάθμες → καμία ζώνη. Διαδοχικά κενά με |Δβήμα| < 1mm συγχωνεύονται.
 */
export function groupSpacingZones(levels: readonly number[]): SpacingZone[] {
  if (levels.length < 2) return [];
  const zones: { start: number; end: number; gap: number; count: number }[] = [];
  for (let i = 1; i < levels.length; i++) {
    const gap = Math.round(levels[i] - levels[i - 1]);
    const prev = zones[zones.length - 1];
    if (prev && Math.abs(prev.gap - gap) < 1) {
      prev.end = levels[i];
      prev.count += 1;
    } else {
      zones.push({ start: levels[i - 1], end: levels[i], gap, count: 1 });
    }
  }
  return zones;
}

/** Ετικέτα ζώνης: `count×gap` για πολλαπλά ίσα κενά, αλλιώς σκέτο `gap`. */
export function formatSpacingZoneLabel(zone: SpacingZone): string {
  return zone.count > 1 ? `${zone.count}×${zone.gap}` : String(zone.gap);
}
