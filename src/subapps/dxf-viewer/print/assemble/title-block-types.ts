/**
 * ADR-453 — Print/Export engine · title-block types.
 *
 * i18n labels are resolved by the caller (PrintHost) and passed in as plain
 * strings, so the assembler/renderer stay free of i18n coupling (N.11-safe).
 *
 * @module subapps/dxf-viewer/print/assemble/title-block-types
 */

export interface TitleBlockField {
  label: string;
  value: string;
}

/** Fully-composed, render-ready title block (heading + label/value rows). */
export interface TitleBlockContent {
  heading: string;
  fields: TitleBlockField[];
}

/** Translated field labels supplied by the UI layer. */
export interface TitleBlockLabels {
  scale: string;
  date: string;
  sheet: string;
}

/** Raw inputs from the host (project name + translated labels). */
export interface TitleBlockInput {
  project: string;
  labels: TitleBlockLabels;
}
