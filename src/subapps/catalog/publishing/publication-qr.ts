/**
 * =============================================================================
 * ΤΟ ΤΥΠΩΜΕΝΟ QR ΤΟΥ ΕΚΔΟΤΗ (ADR-923 §5.13 Σ7 · Δ5) — μέγεθος, μελάνι, και ποια βάση διεύθυνσης επιτρέπεται
 * =============================================================================
 *
 * | Μέγεθος | Τιμή | Πηγή |
 * |---|---|---|
 * | Ζώνη ησυχίας | 4 μονάδες σε κάθε πλευρά | ISO/IEC 18004 · το preset `print` του `lib/qr/qr-code.ts` |
 * | Διόρθωση | Q (25%) | preset `print`: γδαρσίματα, αντανακλάσεις, κακός εκτυπωτής |
 * | Μονάδα (X) | 0,5 mm | GS1 General Specifications §5.12.3.1: QR σε καταναλωτικό είδος, X 0,396–0,990 mm, στόχος 0,495 mm |
 *
 * 🔑 **Το ISO/IEC 18004 δεν ορίζει ελάχιστη μονάδα**: την αφήνει στην εφαρμογή. Παίρνουμε τον στόχο του GS1, που είναι η
 *    δημοσιευμένη προδιαγραφή για κωδικό που σαρώνει κινητό από χαρτί. Διεύθυνση `/q/<id>` 60–75 χαρακτήρων δίνει έκδοση 5–6
 *    (37–41 μονάδες), δηλαδή 22,5–24,5 mm με τη ζώνη.
 * 🔑 **Καθαρό μαύρο, ένα μελάνι** (K 100): το σύμβολο δεν κινδυνεύει από απόκλιση εγγραφής ανάμεσα σε τέσσερα χρώματα.
 * 🔒 **Απόφαση Giorgio 4 (2026-11-03)**: η τελική έκδοση **αρνείται** QR πάνω σε βάση που δεν είναι δημόσια `https`
 *    (`localhost`, `http`, κυριολεκτική IP, ιδιωτική κατάληξη). Το χαρτί δεν ανακαλείται: ένας κωδικός προς το μηχάνημα
 *    του δημιουργού θα έμενε νεκρός σε κάθε αντίτυπο. Η προεπισκόπηση δεν αρνείται, γιατί δεν φεύγει από την οθόνη.
 *
 * @module subapps/catalog/publishing/publication-qr
 */

import { isPubliclyReachableHttps, joinOrigin } from '@/lib/http/public-origin';
import { qrModuleRuns } from '@/lib/qr/qr-code';
import { publicShortRoute } from '../public/public-catalog-routes';
import type { LayoutColour, LayoutQrCode } from './layout-model';

/** Μονάδα του τυπωμένου συμβόλου, σε mm. */
export const PUBLICATION_QR_MODULE_MM = 0.5;

/** K 100 στην εκτύπωση, καθαρό μαύρο στην οθόνη. */
export const PUBLICATION_QR_INK: LayoutColour = { rgb: '#000000', cmyk: [0, 0, 0, 100] };

/** `final` = η έκδοση που τυπώνεται · `preview` = η εικόνα «έτσι θα τυπωθεί» στην οθόνη του προμηθευτή. */
export type PublicationLinkPolicy = 'final' | 'preview';

export type PrintedLinkBase =
  | { readonly kind: 'origin'; readonly origin: string }
  /** Η τελική έκδοση δεν τυπώνει QR σε αυτή τη βάση: ο καλών αρνείται με τον σταθερό κωδικό. */
  | { readonly kind: 'refused' }
  /** Δεν υπάρχει βάση: η προεπισκόπηση βγαίνει χωρίς QR. */
  | { readonly kind: 'none' };

/** Η κρίση της βάσης για τυπωμένο σύνδεσμο. Η βάση είναι πάντα το `publicOrigin()`, ποτέ κεφαλίδα αιτήματος. */
export function printedLinkBase(policy: PublicationLinkPolicy, origin: string | null): PrintedLinkBase {
  if (policy === 'final') return origin !== null && isPubliclyReachableHttps(origin) ? { kind: 'origin', origin } : { kind: 'refused' };
  return origin === null ? { kind: 'none' } : { kind: 'origin', origin };
}

/** Η απόλυτη διεύθυνση του τυπωμένου QR: μόνο το id, μέσα από τον **έναν** builder της σύντομης διεύθυνσης. */
export function printedModelUrl(origin: string, modelId: string): string {
  return joinOrigin(origin, publicShortRoute(modelId));
}

/** Το σύμβολο έτοιμο για το μοντέλο διάταξης. */
export function publicationQrCode(url: string, caption: string): LayoutQrCode {
  const symbol = qrModuleRuns(url, 'print');
  return { url, modules: symbol.size, quietModules: symbol.quietModules, moduleMm: PUBLICATION_QR_MODULE_MM, runs: symbol.runs, ink: PUBLICATION_QR_INK, caption };
}

/** Τα μοντέλα του εγγράφου που μπορούν να έχουν QR: μόνο σελίδες οικογένειας, γιατί μόνο αυτές έχουν δημόσιο `/q/<id>`. */
export function linkableModelIds(chapters: readonly { readonly entries: readonly { readonly kind: string; readonly id: string }[] }[]): string[] {
  return [...new Set(chapters.flatMap((chapter) => chapter.entries.filter((entry) => entry.kind === 'variantModel').map((entry) => entry.id)))].sort();
}
