/**
 * Συμπλήρωση των **θέσεων τιμών** (`{agency}` · `{expiresOn}`) ενός παγωμένου νομικού κειμένου.
 *
 * 🔑 Το παγωμένο κείμενο **κρατά** τις θέσεις· οι τιμές **καταγράφονται** στη συναίνεση (ADR-864 Β.2).
 * Άρα «τι διάβασε ο άνθρωπος» = παγωμένη έκδοση + καταγεγραμμένες τιμές, και ανασυντίθεται
 * **ακριβώς** — χωρίς να αποθηκευτεί δεύτερο αντίγραφο του κειμένου ανά συναίνεση.
 *
 * ⚠️ Θέση χωρίς τιμή (π.χ. στη δημόσια σελίδα του κειμένου) ⇒ **ονομασμένη** ετικέτα
 * («[επωνυμία γραφείου]»), ποτέ κενό και ποτέ ωμό `{agency}`.
 *
 * @module lib/legal/legal-text-placeholders
 * @see ADR-861 §7 · ADR-864 Φ3
 */

import { LEGAL_TEXT_PLACEHOLDERS, type LegalTextPlaceholder } from '@/constants/legal-documents';

export type PlaceholderValues = { readonly [P in LegalTextPlaceholder]?: string };

export type PlaceholderLabels = { readonly [P in LegalTextPlaceholder]: string };

export function fillLegalText(text: string, values: PlaceholderValues, labels: PlaceholderLabels): string {
  let out = text;
  for (const name of LEGAL_TEXT_PLACEHOLDERS) {
    out = out.split(`{${name}}`).join(values[name] ?? labels[name]);
  }
  return out;
}
