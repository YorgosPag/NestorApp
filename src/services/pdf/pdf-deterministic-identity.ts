/**
 * @fileoverview **Η ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ ΤΑΥΤΟΤΗΤΑ ΕΝΟΣ PDF** — `CreationDate` και `/ID` από τα δεδομένα του εγγράφου, ποτέ
 *               από το «τώρα» (ADR-916 Φ-Γ2 Σ4 · ADR-947 Φ2β).
 * @module services/pdf/pdf-deterministic-identity
 * @related services/pdf/pdf-associated-file.ts (το μηχαναγνώσιμο συνημμένο) · renderers/handover-protocol ·
 *   renderers/objective-value
 *
 * 🔑 **Γιατί κοινό**: κάθε έγγραφο που **αποδεικνύει** κάτι (Πρωτόκολλο παράδοσης · στιγμιότυπο αντικειμενικής αξίας)
 *    πρέπει να δίνει **ίδια bytes** για την ίδια όψη — αλλιώς δύο αποδόσεις του ίδιου εγγράφου δεν συγκρίνονται, και η
 *    άγκυρα δεν μπορεί να ελέγξει αυτολεξεί. Ζούσε μέσα στον renderer του Πρωτοκόλλου· ο δεύτερος καταναλωτής το έκανε
 *    υποδομή (N.0.2).
 */

const pad = (n: number): string => String(n).padStart(2, '0');

/** ISO → ημερομηνία PDF (ISO 32000-1 §7.9.4) σε **UTC** — ποτέ η τοπική ζώνη του διακομιστή. */
export function pdfDateOf(iso: string): string {
  const t = new Date(iso);
  return `D:${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}+00'00'`;
}

/** Το `/ID` του αρχείου (32 hex) — το uuid μιας enterprise ταυτότητας (`prefix_uuid`), χωρίς πρόθεμα και παύλες. */
export function pdfFileIdOf(enterpriseId: string): string {
  const hex = enterpriseId.replace(/^[a-z]+_/, '').replace(/-/g, '').toUpperCase();
  if (!/^[0-9A-F]{32}$/.test(hex)) throw new Error(`PDF file id needs a uuid-based id: ${enterpriseId}`);
  return hex;
}
