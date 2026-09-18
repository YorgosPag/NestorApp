/**
 * =============================================================================
 * SSoT: το ΠΡΟΧΕΙΡΟ των εμπορικών στοιχείων — φόρμα → ό,τι γράφεται (ADR-777 §8.60.18)
 * =============================================================================
 *
 * **Μία** απάντηση στις τρεις ερωτήσεις που κάνει κάθε επεξεργαστής διάθεσης, για
 * **ακίνητα και χώρους** (θέσεις στάθμευσης · αποθήκες):
 *
 * | Ερώτηση | Συνάρτηση |
 * |---|---|
 * | ποια πεδία τιμής **ζητά** αυτή η κατάσταση; | {@link priceFieldsForStatus} |
 * | τι σημαίνει το κείμενο που πληκτρολόγησε ο άνθρωπος; | {@link parsePriceDraft} |
 * | τι **άλλαξε** σε σχέση με ό,τι είναι αποθηκευμένο; | {@link changedCommercialAmounts} |
 *
 * 🏆 **Revit «driven parameter»**: η κατάσταση **οδηγεί** τα πεδία — «Προς ενοικίαση» ⇒
 * ζητά **ενοίκιο**, όχι τιμή πώλησης. Η τιμή που **κρύβεται** δεν **σβήνεται** (Figma: η
 * κρυμμένη ιδιότητα κρατά την τιμή της) — επιστροφή στην προηγούμενη κατάσταση τη βρίσκει
 * εκεί. Ο επιλυτής (`resolveDisplayPrice`) διαβάζει **κατά κατάσταση**, άρα ένα κρυμμένο ποσό
 * δεν εμφανίζεται ποτέ ως τιμή άλλου ρόλου.
 *
 * ⚠️ Καθαρό, χωρίς React και χωρίς Firestore: το καλούν η φόρμα ακινήτου, η κάρτα
 * «Εμπορικά» των χώρων και η γρήγορη επεξεργασία της καρτέλας κτιρίου.
 *
 * @module lib/properties/commercial-draft
 * @see ADR-777 §8.60.18 · §8.60.14.2 (κάθε ποσό φέρει μονάδα)
 */

import {
  DEFAULT_COMMERCIAL_STATUS,
  normalizeCommercialStatus,
  requiresRentPrice,
  type CommercialStatus,
} from '@/constants/commercial-statuses';
import type { PriceRole } from '@/lib/properties/price-resolver';

// =============================================================================
// 1. ΤΑ ΠΕΔΙΑ ΤΙΜΗΣ ΚΑΙ Ο ΡΟΛΟΣ ΤΟΥΣ
// =============================================================================

/** Τα ποσά που δηλώνει ένας επεξεργαστής — όχι το `finalPrice`, που το γράφει η πώληση. */
export type CommercialPriceField = 'askingPrice' | 'rentPrice';

/**
 * Ο **ρόλος** (άρα η μονάδα) κάθε πεδίου. Από εδώ η ετικέτα παίρνει «(€)» ή «(€/μήνα)»
 * (`PRICE_RANGE_ROLE_KEY`) — ποτέ δεύτερη χειρόγραφη ετικέτα μονάδας.
 */
export const COMMERCIAL_PRICE_FIELD_ROLE: Readonly<Record<CommercialPriceField, PriceRole>> = {
  askingPrice: 'sale',
  rentPrice: 'rent',
};

/**
 * Τα πεδία τιμής που **ζητά** μια κατάσταση, στη σειρά εμφάνισης.
 *
 * - `for-rent` ⇒ **μόνο** ενοίκιο
 * - `for-sale-and-rent` ⇒ τιμή πώλησης **και** ενοίκιο
 * - κάθε άλλη ⇒ τιμή πώλησης (και στο «εκτός αγοράς»: ο άνθρωπος μπορεί να την ορίσει
 *   **πριν** βγάλει τη μονάδα στην αγορά — η σημερινή συμπεριφορά της φόρμας ακινήτου)
 */
export function priceFieldsForStatus(status: unknown): readonly CommercialPriceField[] {
  if (status === 'for-rent') return ['rentPrice'];
  if (requiresRentPrice(status)) return ['askingPrice', 'rentPrice'];
  return ['askingPrice'];
}

// =============================================================================
// 2. ΤΟ ΠΡΟΧΕΙΡΟ
// =============================================================================

/** Το πρόχειρο μιας φόρμας: η κατάσταση και τα ποσά ως **κείμενο** μηχανής («125500.5»). */
export interface CommercialDraft {
  readonly commercialStatus: CommercialStatus;
  readonly askingPrice: string;
  readonly rentPrice: string;
}

/** Ό,τι χρειάζεται για να γεμίσει ένα πρόχειρο — δομικό, ταιριάζει σε ακίνητο και χώρο. */
export interface CommercialSource {
  readonly commercialStatus?: unknown;
  readonly commercial?: {
    readonly askingPrice?: number | null;
    readonly rentPrice?: number | null;
  } | null;
}

/** Αριθμός → κείμενο μηχανής· απουσία ⇒ κενό πεδίο (ποτέ «0»). */
function draftText(amount: number | null | undefined): string {
  return typeof amount === 'number' && amount > 0 ? String(amount) : '';
}

/** Το πρόχειρο ενός αποθηκευμένου εγγράφου. Άγνωστη κατάσταση ⇒ «εκτός αγοράς». */
export function commercialDraftOf(source: CommercialSource): CommercialDraft {
  return {
    commercialStatus: normalizeCommercialStatus(source.commercialStatus) ?? DEFAULT_COMMERCIAL_STATUS,
    askingPrice: draftText(source.commercial?.askingPrice),
    rentPrice: draftText(source.commercial?.rentPrice),
  };
}

/**
 * Κείμενο → ποσό. Κενό, μη αριθμός ή **μη θετικό** ⇒ `null` («δεν δηλώθηκε»).
 *
 * ⚠️ Το μηδέν **δεν** είναι τιμή εδώ: «0 €» σε αγγελία είναι κενή φόρμα, όχι δωρεάν θέση —
 * ίδιο με τη φόρμα ακινήτου (`parsed > 0 ? parsed : null`) και με τον έλεγχο εύλογου.
 */
export function parsePriceDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Τα ποσά που άλλαξαν — **μόνο** αυτά, ώστε μια αποθήκευση να μη γράφει ό,τι δεν άγγιξε. */
export type CommercialAmountChanges = Partial<Record<CommercialPriceField, number | null>>;

/**
 * Τα ποσά του προχείρου που **διαφέρουν** από τα αποθηκευμένα.
 *
 * 🔑 **Ιδεμπότητα**: ίδιο πρόχειρο πάνω σε ίδιο έγγραφο ⇒ `{}` — καμία εγγραφή, καμία γραμμή
 * ιστορικού. Και `undefined` αποθηκευμένο ισοδυναμεί με `null` (και τα δύο = «δεν δηλώθηκε»).
 */
export function changedCommercialAmounts(
  draft: Pick<CommercialDraft, CommercialPriceField>,
  current: CommercialSource['commercial'],
): CommercialAmountChanges {
  const changes: CommercialAmountChanges = {};
  for (const field of Object.keys(COMMERCIAL_PRICE_FIELD_ROLE) as CommercialPriceField[]) {
    const next = parsePriceDraft(draft[field]);
    if (next !== (current?.[field] ?? null)) changes[field] = next;
  }
  return changes;
}

/**
 * Το σώμα εμπορικών στοιχείων που στέλνει ένας επεξεργαστής χώρου — **μόνο** ό,τι άλλαξε.
 *
 * ⚠️ `type` και όχι `interface`: συγχωνεύεται σε `Record<string, unknown>` (το σώμα του PATCH),
 * και η TypeScript δίνει σιωπηρή index signature **μόνο** σε `type` (ίδιο με `AppurtenanceUpdate`).
 */
export type CommercialPatch = {
  commercialStatus?: CommercialStatus;
  commercial?: CommercialAmountChanges;
};

/**
 * Πρόχειρο + αποθηκευμένο → το σώμα του PATCH. Κενό αντικείμενο ⇒ τίποτα δεν άλλαξε.
 *
 * Τα ποσά ταξιδεύουν **εμφωλευμένα** (`commercial: { rentPrice }`)· ο server τα γράφει με
 * **διαδρομές** (`commercial.rentPrice`), ώστε ιδιοκτήτες, προκαταβολή και σύνδεση με
 * ακίνητο (ADR-199) να μένουν ανέγγιχτα.
 */
export function commercialPatchOf(draft: CommercialDraft, current: CommercialSource): CommercialPatch {
  const patch: CommercialPatch = {};
  const currentStatus = normalizeCommercialStatus(current.commercialStatus) ?? DEFAULT_COMMERCIAL_STATUS;
  if (draft.commercialStatus !== currentStatus) patch.commercialStatus = draft.commercialStatus;

  const amounts = changedCommercialAmounts(draft, current.commercial);
  if (Object.keys(amounts).length > 0) patch.commercial = amounts;
  return patch;
}
