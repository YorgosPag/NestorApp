/**
 * @fileoverview **Η πολιτική του λογοτύπου εταιρείας** — τι γίνεται δεκτό και σε τι μετατρέπεται (ADR-ACC-018 §17).
 * @module lib/company/brand-logo-policy
 *
 * ⛔ **ΚΑΘΑΡΟ MODULE** — ίδια απάντηση στον browser (έγκαιρο, κατανοητό μήνυμα πριν το ανέβασμα) και στον server
 *    (ο φρουρός). Ο browser **δεν** είναι φρουρός: ό,τι κι αν περάσει, ο server ξανακρίνει τα bytes και τα
 *    **επανακωδικοποιεί** (`server/company/brand-logo-normalize.server.ts`).
 *
 * 🔑 Κρίνονται τα **bytes** (`sniffContent`), ποτέ το όνομα ή το `file.type` — τα ορίζει ο χρήστης.
 * 🔑 Όρια με αφετηρία το Stripe Branding (JPG/PNG, ≥128 px): δεχόμαστε και WebP, γιατί **ο server το μετατρέπει**
 *    σε PNG/JPEG — μορφές που ενσωματώνουν αυτούσιες jsPDF **και** Typst.
 */

import { sniffContent, type ContentSignatureId } from '@/lib/files/content-signature';

/** Οι μορφές **εισόδου** που δέχεται το ανέβασμα (κρίνονται από τα bytes). */
const BRAND_LOGO_INPUT_SIGNATURES: readonly ContentSignatureId[] = ['png', 'jpeg', 'webp'];

/** Ανώτατο μέγεθος αρχείου εισόδου. */
export const BRAND_LOGO_MAX_INPUT_BYTES = 5 * 1024 * 1024;

/**
 * Ελάχιστη **μεγάλη** πλευρά (pixel) — κάτω από αυτό το λογότυπο θολώνει σε τυπωμένη σελίδα. Η μεγάλη, όχι η μικρή:
 * τα λογότυπα είναι συχνά οριζόντια (π.χ. 600×120) και θα απορρίπτονταν άδικα.
 */
export const BRAND_LOGO_MIN_EDGE_PX = 128;

/** Προτεινόμενη μεγάλη πλευρά για ευκρίνεια εκτύπωσης (~300 dpi στο κουτί της κεφαλίδας) — μόνο οδηγία στο UI. */
export const BRAND_LOGO_RECOMMENDED_EDGE_PX = 600;

/** Μέγιστη πλευρά της **αποθηκευμένης** εικόνας: αρκεί για ~300 dpi στο κουτί της κεφαλίδας, χωρίς να φουσκώνει το PDF. */
export const BRAND_LOGO_MAX_EDGE_PX = 1200;

/** Ποιότητα JPEG για αδιαφανή λογότυπα (επίπεδα χρώματα, αιχμηρές ακμές ⇒ υψηλή, χωρίς υποδειγματοληψία χρώματος). */
export const BRAND_LOGO_JPEG_QUALITY = 92;

/** Το όνομα του πεδίου multipart που φέρει το αρχείο. */
export const BRAND_LOGO_FORM_FIELD = 'file';

/** Οι κατονομασμένες αρνήσεις — κλειστό σύνολο, το καθένα με δικό του μήνυμα i18n. */
export type BrandLogoRefusal = 'format' | 'size' | 'too-small' | 'undecodable';

const BRAND_LOGO_REFUSALS: readonly BrandLogoRefusal[] = ['format', 'size', 'too-small', 'undecodable'];

export function isBrandLogoRefusal(value: unknown): value is BrandLogoRefusal {
  return typeof value === 'string' && (BRAND_LOGO_REFUSALS as readonly string[]).includes(value);
}

/**
 * **Η πρώτη κρίση**: μέγεθος + τύπος από τα πρώτα bytes. `null` ⇒ προχωρά (η αποκωδικοποίηση κρίνει τα υπόλοιπα).
 */
export function judgeBrandLogoInput(head: Uint8Array, sizeBytes: number): BrandLogoRefusal | null {
  if (sizeBytes <= 0 || sizeBytes > BRAND_LOGO_MAX_INPUT_BYTES) return 'size';
  const sniff = sniffContent(head);
  if (sniff === null || sniff === 'html') return 'format';
  return BRAND_LOGO_INPUT_SIGNATURES.includes(sniff.id) ? null : 'format';
}

/** Είναι οι διαστάσεις (μετά τον προσανατολισμό) αρκετές; */
export function isBrandLogoLargeEnough(width: number, height: number): boolean {
  return Math.max(width, height) >= BRAND_LOGO_MIN_EDGE_PX;
}
