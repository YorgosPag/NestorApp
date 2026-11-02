/**
 * **Το σύνορο ανάγνωσης του δημόσιου εγγράφου μοντέλου** (ADR-923 §5.13 Σ2).
 *
 * ⏳ Η γραμμή στο `BOUNDARIES` της CHECK 3.74 μπαίνει μαζί με τον πρώτο αναγνώστη: ο Κ2 μπλοκάρει σύνορο χωρίς καταναλωτή.
 *
 * Το έγγραφο το διαβάζει ανώνυμος, άρα ωμό `as PublicCatalogModel` θα μετέτρεπε κάθε παλιό ή χαλασμένο έγγραφο σε
 * λευκή σελίδα, ή σε διαρροή πεδίου που κανείς δεν δήλωσε. Ό,τι δεν περνά το κλειστό σχήμα απαντά `null`: για τον
 * επισκέπτη είναι ίδιο με το ανύπαρκτο (κρυφό ≡ ανύπαρκτο).
 *
 * @module subapps/catalog/public/public-catalog-from-document
 */

import { publicCatalogModelSchema, type PublicCatalogModel } from './public-catalog-schema';

export function publicCatalogModelFromDocument(raw: unknown, id: string): PublicCatalogModel | null {
  const parsed = publicCatalogModelSchema.safeParse(raw);
  if (!parsed.success || parsed.data.modelId !== id) return null;
  return parsed.data;
}
