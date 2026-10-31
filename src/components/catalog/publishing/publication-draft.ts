/**
 * @fileoverview **Το πρόχειρο μιας συνταγής έκδοσης** — κενή συνταγή, ορισμός από εγγραφή, μικρές καθαρές μετατροπές
 *   (ADR-923 §5.6.1). Καθαρές συναρτήσεις· καμία React.
 * @related subapps/catalog/types/publication.ts (ο ορισμός) · subapps/catalog/publishing/validate-publication-recipe.ts (η ίδια επικύρωση με τον γραφέα)
 * @module components/catalog/publishing/publication-draft
 *
 * 🔑 Ο ορισμός της εγγραφής ξαναχτίζεται **πεδίο προς πεδίο**: τα μεταδεδομένα (id · revision · χρονοσφραγίδες) ανήκουν στον
 *    γραφέα και δεν πρέπει να ταξιδέψουν πίσω μέσα στο σώμα της αποθήκευσης.
 */

import { DEFAULT_PUBLICATION_FONT } from '@/subapps/catalog/publishing/publication-fonts';
import type { LayoutColour } from '@/subapps/catalog/publishing/layout-model';
import { PUBLICATION_LIMITS } from '@/subapps/catalog/publishing/publication-vocabulary';
import type { CatalogIssue } from '@/subapps/catalog/schema/catalog-issues';
import type { HumanLanguage } from '@/i18n/languages';
import type { PublicationRecipeDefinition, PublicationRecipeWire, PublicationTheme } from '@/subapps/catalog/types/publication';
import { validatePublicationRecipe } from '@/subapps/catalog/publishing/validate-publication-recipe';

export const DEFAULT_PRIMARY_COLOUR: LayoutColour = { rgb: '#1f3a5f', cmyk: [100, 80, 30, 20] };
export const DEFAULT_ACCENT_COLOUR: LayoutColour = { rgb: '#d9822b', cmyk: [0, 55, 90, 0] };

const DEFAULT_GRID_COLUMNS = 6;

/** Η κενή συνταγή: τεχνικός κατάλογος οθόνης, όλο το εύρος, χωρίς τιμές — ό,τι δεν χρειάζεται άδεια για να δοκιμαστεί. */
export function emptyRecipe(language: HumanLanguage): PublicationRecipeDefinition {
  return {
    code: '',
    labels: {},
    title: {},
    scope: { kind: 'all' },
    pricing: { kind: 'none' },
    language,
    theme: { fontCode: DEFAULT_PUBLICATION_FONT, logoAssetId: null, primary: DEFAULT_PRIMARY_COLOUR, accent: DEFAULT_ACCENT_COLOUR },
    templates: { enabled: ['cover', 'toc'], groupStyle: 'band', gridColumns: DEFAULT_GRID_COLUMNS },
    profiles: ['screen'],
    paper: 'a4',
    footerNote: {},
  };
}

/** Ο ορισμός μιας αποθηκευμένης συνταγής, χωρίς το περίβλημα της εγγραφής. */
export function recipeDefinitionOf(record: PublicationRecipeWire): PublicationRecipeDefinition {
  return {
    code: record.code,
    labels: record.labels,
    title: record.title,
    scope: record.scope,
    pricing: record.pricing,
    language: record.language,
    theme: record.theme,
    templates: record.templates,
    profiles: record.profiles,
    paper: record.paper,
    footerNote: record.footerNote,
  };
}

/** Προσθέτει ή αφαιρεί ένα στοιχείο, κρατώντας τη σειρά της πηγής `order` (σταθερή σειρά αποθήκευσης). */
export function toggleInOrder<T>(current: readonly T[], item: T, on: boolean, order: readonly T[]): T[] {
  const next = on ? [...current, item] : current.filter((entry) => entry !== item);
  return order.filter((entry) => next.includes(entry));
}

export function withTheme(draft: PublicationRecipeDefinition, patch: Partial<PublicationTheme>): PublicationRecipeDefinition {
  return { ...draft, theme: { ...draft.theme, ...patch } };
}

export function withCmykPart(colour: LayoutColour, index: number, value: number): LayoutColour {
  const cmyk = colour.cmyk.map((part, position) => (position === index ? value : part));
  return { ...colour, cmyk: [cmyk[0] ?? 0, cmyk[1] ?? 0, cmyk[2] ?? 0, cmyk[3] ?? 0] };
}

/** Τα όρια του πλέγματος: ένας αριθμός για οθόνη και γραφέα. */
export const GRID_COLUMN_LIMITS = {
  min: PUBLICATION_LIMITS.minValueColumnsPerBlock,
  max: PUBLICATION_LIMITS.maxValueColumnsPerBlock,
} as const;

/** Η ΙΔΙΑ σημασιολογική επικύρωση με τον γραφέα — το κουμπί αποθήκευσης δεν στέλνει γνωστό 422. */
export function recipeIssues(draft: PublicationRecipeDefinition): readonly CatalogIssue[] {
  return validatePublicationRecipe(draft);
}

export interface PublicationFieldsProps {
  readonly draft: PublicationRecipeDefinition;
  readonly onChange: (next: PublicationRecipeDefinition) => void;
  readonly issues: readonly CatalogIssue[];
  readonly disabled: boolean;
}
