/**
 * BIM Schedule — selected-state highlight tokens (SSoT, ADR-363 §6 Phase 8).
 *
 * Όλα παράγονται από τη μία CSS μεταβλητή `--status-info` (vivid info-blue,
 * ίδια πηγή με `COLOR_BRIDGE.bg.infoSolid` στο globals.css) — theme-aware,
 * ορατά και στο φωτεινό και στο σκούρο θέμα (το `--primary` είναι σκούρο και
 * στα δύο → δεν κάνει για highlight). Κεντρικά εδώ ώστε τα 3 schedule
 * sub-components (EntityToggle / FilterBar / FormatPicker) να μη διπλασιάζουν
 * class strings (N.0.2 — boy-scout centralization).
 */

/** Επιλεγμένη κάρτα radio (entity-type / format) ή ενεργό «μόνο επιλογή». */
export const SCHEDULE_SELECTED_CARD =
  'border-[hsl(var(--status-info))] bg-[hsl(var(--status-info)/0.15)] ring-2 ring-[hsl(var(--status-info))]';

/** Τσεκαρισμένη γραμμή checklist (όροφος / κατηγορία) — πιο λεπτό ring. */
export const SCHEDULE_ROW_CHECKED =
  'bg-[hsl(var(--status-info)/0.15)] ring-1 ring-[hsl(var(--status-info))]';

/** Override του checked-state ενός `Checkbox` → vivid μπλε κουτί + λευκό ✓. */
export const SCHEDULE_CHECKBOX_CHECKED =
  'data-[state=checked]:bg-[hsl(var(--status-info))] data-[state=checked]:border-[hsl(var(--status-info))] data-[state=checked]:text-white';

/** Override του `RadioGroupItem` dot → vivid μπλε (default text-primary = σκούρο). */
export const SCHEDULE_RADIO_DOT = 'text-[hsl(var(--status-info))]';
