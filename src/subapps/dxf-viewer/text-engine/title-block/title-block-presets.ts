/**
 * ADR-651 Φάση Γ — **βιβλιοθήκη προτύπων πινακίδας** (Απόφαση Giorgio #3).
 *
 * Ένα preset = **ένα built-in `TextTemplate` ανά γλώσσα** (ADR-344 two-tier: built-in
 * immutable + user editable) **συν** τις λίγες γεωμετρικές του επιλογές (κελί σφραγίδας).
 * Ο χρήστης διαλέγει preset από το ribbon πριν το κλικ· μετά μπορεί να κλωνοποιήσει και να
 * επεξεργαστεί το πρότυπο (υπάρχον `text_templates` CRUD) — ούτε κλειδωμένο layout ούτε
 * «άδεια φόρμα από το μηδέν».
 *
 * **Γιατί τέσσερα και όχι τα τρία της Απόφασης #3**: τα τρία που ζήτησε ο Giorgio («Άδεια
 * δόμησης» / «Απλή» / «Λεπτομέρεια») **προστίθενται**· το ήδη υπάρχον built-in
 * (`TITLE_BLOCK_EL/EN`, ADR-344 Phase 7.A) παραμένει ως `standard` — δεν σβήνεται πρότυπο
 * που μπορεί ήδη να χρησιμοποιείται, και μένει το default (back-compat της Φάσης Β).
 *
 * Οι ετικέτες του **ribbon** είναι i18n keys (N.11). Το `stampLabel` ΔΕΝ είναι ετικέτα UI —
 * είναι **περιεχόμενο σχεδίου** (τυπώνεται μέσα στην πινακίδα), γι' αυτό ζει δίπλα στο
 * περιεχόμενο του προτύπου και ακολουθεί τη γλώσσα ΤΟΥ ΠΡΟΤΥΠΟΥ, όχι τη γλώσσα του UI —
 * ακριβώς όπως τα ίδια τα κείμενα των built-in templates.
 */

import {
  TITLE_BLOCK_DETAIL_EL,
  TITLE_BLOCK_DETAIL_EN,
  TITLE_BLOCK_EL,
  TITLE_BLOCK_EN,
  TITLE_BLOCK_PERMIT_EL,
  TITLE_BLOCK_PERMIT_EN,
  TITLE_BLOCK_SIMPLE_EL,
  TITLE_BLOCK_SIMPLE_EN,
} from '../templates/defaults/title-blocks';
import type { BuiltInTextTemplate, TextTemplateLocale } from '../templates/template.types';

/** Τα διαθέσιμα presets (σταθερά ids — μπαίνουν σε store/ribbon/persist). */
export type TitleBlockPresetId = 'standard' | 'permit' | 'simple' | 'detail';

/**
 * Οι γλώσσες στις οποίες υπάρχει **περιεχόμενο** πινακίδας (Απόφαση #8: ελληνικά default,
 * κουμπί → αγγλικά). Στενότερο από το `TextTemplateLocale` του ADR-344, που έχει και `'multi'`
 * (δίγλωσσα πρότυπα δίπλα-δίπλα) — μια πινακίδα τυπώνεται σε ΜΙΑ γλώσσα, όχι σε δύο.
 */
export type TitleBlockLocale = Extract<TextTemplateLocale, 'el' | 'en'>;

/** Το locale του i18n → γλώσσα προτύπου (default: ελληνικά — SSoT για κάθε καλούντα). */
export function toTitleBlockLocale(language: string | undefined): TitleBlockLocale {
  return language?.toLowerCase().startsWith('en') ? 'en' : 'el';
}

export interface TitleBlockPreset {
  readonly id: TitleBlockPresetId;
  /** i18n key της ετικέτας στο ribbon (N.11 — καμία σταθερή συμβολοσειρά UI εδώ). */
  readonly labelKey: string;
  /** Το πρότυπο ανά γλώσσα (Απόφαση #8: ελληνικά default, κουμπί → αγγλικά). */
  readonly templates: Readonly<Record<TitleBlockLocale, BuiltInTextTemplate>>;
  /** Κελί σφραγίδας/υπογραφής (κενό κουτί — Απόφαση #6γ· η εικόνα σφραγίδας = Φάση Ε). */
  readonly withStampBox: boolean;
  /** Το κείμενο του κελιού σφραγίδας — ΠΕΡΙΕΧΟΜΕΝΟ σχεδίου, ανά γλώσσα προτύπου. */
  readonly stampLabel: Readonly<Record<TitleBlockLocale, string>>;
}

const CMD = 'ribbon.commands.titleBlockEditor.presetOptions';

/**
 * Το κείμενο του κελιού σφραγίδας ανά γλώσσα προτύπου — **περιεχόμενο σχεδίου**, όχι UI label
 * (τυπώνεται μέσα στην πινακίδα). Εκτίθεται ώστε και η AI πινακίδα (Φάση Δ) με κελί σφραγίδας
 * να χρησιμοποιεί το ΙΔΙΟ κείμενο (N.18: μία πηγή).
 */
export const TITLE_BLOCK_STAMP_LABEL: Readonly<Record<TitleBlockLocale, string>> = {
  el: 'ΣΦΡΑΓΙΔΑ / ΥΠΟΓΡΑΦΗ',
  en: 'STAMP / SIGNATURE',
};

const STAMP_LABEL = TITLE_BLOCK_STAMP_LABEL;

const NO_STAMP_LABEL: Readonly<Record<TitleBlockLocale, string>> = { el: '', en: '' };

export const TITLE_BLOCK_PRESETS: readonly TitleBlockPreset[] = [
  {
    id: 'standard',
    labelKey: `${CMD}.standard`,
    templates: { el: TITLE_BLOCK_EL, en: TITLE_BLOCK_EN },
    withStampBox: false,
    stampLabel: NO_STAMP_LABEL,
  },
  {
    id: 'permit',
    labelKey: `${CMD}.permit`,
    templates: { el: TITLE_BLOCK_PERMIT_EL, en: TITLE_BLOCK_PERMIT_EN },
    // Η πινακίδα άδειας ΠΡΕΠΕΙ να φέρει θέση για σφραγίδα/υπογραφή μηχανικού (ΤΕΕ πρακτική).
    withStampBox: true,
    stampLabel: STAMP_LABEL,
  },
  {
    id: 'simple',
    labelKey: `${CMD}.simple`,
    templates: { el: TITLE_BLOCK_SIMPLE_EL, en: TITLE_BLOCK_SIMPLE_EN },
    withStampBox: false,
    stampLabel: NO_STAMP_LABEL,
  },
  {
    id: 'detail',
    labelKey: `${CMD}.detail`,
    templates: { el: TITLE_BLOCK_DETAIL_EL, en: TITLE_BLOCK_DETAIL_EN },
    withStampBox: false,
    stampLabel: NO_STAMP_LABEL,
  },
];

/** Το preset της Φάσης Β — παραμένει default ώστε η υπάρχουσα συμπεριφορά να μην αλλάξει. */
export const DEFAULT_TITLE_BLOCK_PRESET_ID: TitleBlockPresetId = 'standard';

const PRESET_BY_ID: ReadonlyMap<string, TitleBlockPreset> = new Map(
  TITLE_BLOCK_PRESETS.map((preset) => [preset.id, preset]),
);

/** Το preset με αυτό το id· άγνωστο id ⇒ το default (ποτέ crash σε παλιό persisted id). */
export function titleBlockPreset(id: string): TitleBlockPreset {
  return PRESET_BY_ID.get(id) ?? PRESET_BY_ID.get(DEFAULT_TITLE_BLOCK_PRESET_ID)!;
}

/** Type guard για persisted/ribbon τιμές. */
export function isTitleBlockPresetId(value: string): value is TitleBlockPresetId {
  return PRESET_BY_ID.has(value);
}
