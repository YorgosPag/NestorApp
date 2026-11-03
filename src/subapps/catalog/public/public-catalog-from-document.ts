/**
 * **Το σύνορο ανάγνωσης του δημόσιου εγγράφου μοντέλου** (ADR-923 §5.13 Σ2, CHECK 3.74).
 *
 * Το έγγραφο το διαβάζει ανώνυμος, άρα ωμό `as PublicCatalogModel` θα μετέτρεπε κάθε παλιό ή χαλασμένο έγγραφο σε
 * λευκή σελίδα, ή σε διαρροή πεδίου που κανείς δεν δήλωσε. Ό,τι δεν περνά το κλειστό σχήμα απαντά `null`: για τον
 * επισκέπτη είναι ίδιο με το ανύπαρκτο (κρυφό ≡ ανύπαρκτο).
 *
 * @module subapps/catalog/public/public-catalog-from-document
 */

import type { LocalizedText } from '@/i18n/localized-text';
import { publicCatalogModelSchema, publicCategoryLabelsSchema, publicModelAddressSchema, type PublicCatalogModel, type PublicModelAddress } from './public-catalog-schema';

export function publicCatalogModelFromDocument(raw: unknown, id: string): PublicCatalogModel | null {
  const parsed = publicCatalogModelSchema.safeParse(raw);
  if (!parsed.success || parsed.data.modelId !== id) return null;
  return parsed.data;
}

/** Τα πεδία της διεύθυνσης, για ανάγνωση με `select`. Χαλασμένο έγγραφο δεν μπαίνει στο sitemap. */
export function publicModelAddressFromDocument(raw: unknown): PublicModelAddress | null {
  const parsed = publicModelAddressSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Το ένα πεδίο, για ανάγνωση με `select`. Χαλασμένη τιμή ⇒ καμία κατηγορία, όχι ωμό αντικείμενο στην οθόνη. */
export function publicCategoryLabelsFromField(raw: unknown): Readonly<Record<string, LocalizedText>> {
  const parsed = publicCategoryLabelsSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
