import type React from 'react';

/**
 * SSoT για το keyboard flow ενός inline-rename `<input>` — σε ΟΛΗ την εφαρμογή:
 *   - **Enter**  → επιβεβαίωση (`onConfirm`)
 *   - **Escape** → ακύρωση (`onCancel`)
 *
 * Γιατί ΕΔΩ κι όχι μέσω του Escape Command Bus (ADR-364): το bus είναι για **global**
 * window/document Escape dispatch και ρητά **σκιπάρει editable focus** — ένα εστιασμένο
 * rename `<input>` χειρίζεται το δικό του Enter/Escape **τοπικά**, όπως κάθε text field.
 * Αυτό το αρχείο είναι το ΜΟΝΟ σημείο που κρατά το `'Escape'` literal για local inputs
 * (allowlisted στο escape-command-bus module) ώστε να μην αντιγράφεται σε κάθε card.
 *
 * Καταναλωτές: FrameProfileCard · EntityCard (layers panel) · TableNameBox · useSliderValueEditing
 * (DXF viewer) · PropertyDossierTitle (ADR-866 Φ1.2) · DemandTitleEditor (ADR-886). Μετακινήθηκε από το
 * `dxf-viewer/ui/utils/` στο `lib/ui/` (2026-09-18) όταν απέκτησε τον πρώτο καταναλωτή
 * έξω από το subapp — αλλιώς ο φάκελος θα ξανάγραφε το `'Escape'` literal (CHECK 3.7).
 */
export interface InlineRenameKeyOptions {
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function handleInlineRenameKey(
  event: React.KeyboardEvent<HTMLInputElement>,
  { onConfirm, onCancel }: InlineRenameKeyOptions,
): void {
  if (event.key === 'Enter') {
    event.preventDefault();
    onConfirm();
  } else if (event.key === 'Escape') {
    event.preventDefault();
    onCancel();
  }
}
