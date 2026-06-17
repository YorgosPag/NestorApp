/**
 * ADR-469 — Structural Component Visibility SSoT (Revit-grade per-component display).
 *
 * Κάθε δομικό στοιχείο (κολώνα/δοκός/τοίχος/θεμελίωση/πλάκα/σκάλα) αποτελείται από
 * τρία ΑΝΕΞΑΡΤΗΤΑ visual components που μπορούν να εμφανίζονται/κρύβονται σε κάθε
 * συνδυασμό (όπως Revit «Parts» / subcategory visibility):
 *
 *   - `core`          → σώμα σκυροδέματος (στατικός πυρήνας)
 *   - `plaster`       → σοβάς (structural finish skin, ADR-449)
 *   - `reinforcement` → οπλισμός (rebar cage, ADR-456)
 *
 * Pure config module — ZERO React/store/runtime deps. Καταναλώνεται από:
 *   - `config/bim-object-styles.ts` (per-element `componentVisibility` override type)
 *   - `bim/visibility/structural-component-visibility.ts` (ο resolver SSoT)
 *   - `ui/ribbon/components/StructuralComponentVisibilitySelect.tsx` (το UI)
 *
 * @see docs/centralized-systems/reference/adrs/ADR-469-structural-component-visibility.md
 */

/** Τα τρία visual components ενός δομικού στοιχείου. */
export type StructuralComponent = 'core' | 'plaster' | 'reinforcement';

/** Σταθερή σειρά εμφάνισης (UI + iteration). */
export const STRUCTURAL_COMPONENTS: readonly StructuralComponent[] = [
  'core',
  'plaster',
  'reinforcement',
] as const;

/**
 * Per-component default view-level ορατότητα (Revit semantics):
 *   core+σοβάς ON (το μοντέλο φαίνεται κανονικά), οπλισμός opt-in λεπτομέρεια.
 * Mirror των ήδη υπαρχόντων defaults: `showFinishSkin ?? true` (ADR-449),
 * `showReinforcement ?? false` (ADR-456).
 */
export const STRUCTURAL_COMPONENT_DEFAULT_VISIBLE: Readonly<Record<StructuralComponent, boolean>> = {
  core: true,
  plaster: true,
  reinforcement: false,
};

/** i18n label key (namespace `dxf-viewer-shell`) ανά component — UI SSoT. */
export const STRUCTURAL_COMPONENT_LABEL_KEY: Readonly<Record<StructuralComponent, string>> = {
  core: 'ribbon.commands.componentVisibility.core',
  plaster: 'ribbon.commands.componentVisibility.plaster',
  reinforcement: 'ribbon.commands.componentVisibility.reinforcement',
};
