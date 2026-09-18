/**
 * @fileoverview **Ο ΑΞΟΝΑΣ ΤΙΜΗΣ — ανά εναλλακτική, στη μονάδα της, και «ως τι» ταιριάζει.**
 * @related ADR-777 §8.60.15 · §8.60.16 · lib/demand/demand-match-axes.ts · demand-match-vocabulary.ts
 * @module lib/demand/demand-match-price
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ — **σπάσιμο κατά ευθύνη, όχι κούρεμα γραμμών**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο άξονας τιμής είναι ο **μόνος** που απαντά σε **δύο** ερωτήματα: «εμποδίζει η τιμή;» **και**
 * «ως τι ταιριάζει η αγγελία;» (§8.60.16). Τα άλλα τρία αριθμητικά κριτήρια (εμβαδόν · υπνοδωμάτια ·
 * όροφος) ζουν στο `demand-match-axes.ts`, που καλεί **αυτό** το αρχείο — ένας κριτής, όχι δύο.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ADR-777 §8.60.16 — Η ΕΝΑΛΛΑΚΤΙΚΗ ΠΟΥ Η ΑΓΓΕΛΙΑ ΔΕΝ ΠΡΟΣΦΕΡΕΙ ΕΣΩΖΕ ΤΗΝ ΤΙΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ως τις 2026-09-18 κρινόταν **κάθε** εναλλακτική που η αγγελία «συναντά» — **είτε** την προσφέρει
 * **είτε** έχει ποσό στη μονάδα της. Το δεύτερο σκέλος υπάρχει για τη στάση `partial`
 * (`demand-interest.ts`: ακίνητο **χωρίς** δηλωμένη διάθεση αλλά **με** τιμή). Εφαρμοζόταν όμως **και**
 * σε αγγελία που προσφέρει **άλλη** ζητούμενη συναλλαγή: πώληση 300.000 € (ακριβή) με ενοίκιο
 * **δηλωμένο** από το legacy `for-sale-and-rent` αλλά **όχι** στο `offerKinds` ⇒ η «ενοικίαση ≤ 900»
 * έσωζε την τιμή ⇒ **ψευδές ταίριασμα** για συναλλαγή που **κανείς δεν προσφέρει**.
 *
 * Τώρα: κρίνονται οι **προσφερόμενες**· **μόνο αν δεν υπάρχει καμία** (όπου το `offer-kind` έχει ήδη
 * πει «όχι») κρίνονται όσες έχουν δηλωμένο ποσό — η στάση `partial`, ανέπαφη.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ADR-777 §8.60.17 — ΚΑΙ Η ΑΝΤΙΠΑΡΟΧΗ ΕΧΕΙ «ΠΟΣΟ»: ΤΟ ΠΟΣΟΣΤΟ ΟΙΚΟΠΕΔΟΥΧΟΥ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `offer-amount.ts` το λέει ήδη: το ποσό της αντιπαροχής **είναι** το ποσοστό. Άρα κρίνεται **εδώ**,
 * στον ίδιο κριτή με τις τιμές — με **δικό του** κενό (`shareOverBy`) και δικό του κλάδο στο `metOn`,
 * ώστε ποσοστό και ευρώ να μη συναντηθούν ποτέ στο ίδιο πεδίο.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις, καμία εξάρτηση από React/Firestore.
 */

import {
  priceAxisOfSeek,
  priceRoleOfSeek,
  readNumericAnswer,
} from '@/lib/criteria/listing-criterion-reading';
import type { PriceRole } from '@/lib/properties/price-resolver';
import type { PublicListing } from '@/types/public-listing';
import {
  isAmountRangeSet,
  isPricedSeek,
  isShortStaySeek,
  isStayTermsSet,
  type DemandSeek,
  type ExchangeDemandSeek,
  type PricedDemandSeek,
} from '@/types/property-demand';
import { judgeStayTerms } from './demand-match-stay';
import type { DemandBlocker, DemandSeekMet } from './demand-match-vocabulary';

/**
 * Η κρίση **μιας** εναλλακτικής — εμπόδια, κενά **και** το ποσό, στη **δική της** μονάδα.
 *
 * ⚠️ Το `amount` είναι **στη μονάδα του κλάδου**: ευρώ για τις τιμές, **ποσοστό** για την αντιπαροχή.
 * Ζει μόνο μέσα σε αυτό το αρχείο· έξω φεύγει **διακριτή** ένωση (`DemandSeekMet`), ποτέ αυτό.
 */
interface SeekPriceVerdict {
  readonly seek: DemandSeek;
  readonly blockers: readonly DemandBlocker[];
  readonly overBy: number | null;
  readonly underBy: number | null;
  readonly shareOverBy: number | null;
  readonly nightsShortBy: number | null;
  readonly role: PriceRole | null;
  readonly amount: number | null;
}

/** Καμία απόσταση σε κανέναν κλάδο — η ουδέτερη τιμή, γραμμένη **μία** φορά. */
const NO_SEEK_GAPS = { overBy: null, underBy: null, shareOverBy: null, nightsShortBy: null } as const;

/** Ό,τι απαντά ο άξονας τιμής — χωρίς μεταβλητό κοινό κατάστημα: ο καλών το συνθέτει. */
export interface PriceAxisOutcome {
  readonly blockers: readonly DemandBlocker[];
  readonly overBy: number | null;
  readonly underBy: number | null;
  /** Μονάδες ποσοστού πάνω από την οροφή οικοπεδούχου — δες `DemandGaps.shareOverBy`. */
  readonly shareOverBy: number | null;
  /** Νύχτες ως το ελάχιστο του κατόχου — δες `DemandGaps.nightsShortBy`. */
  readonly nightsShortBy: number | null;
  /** Η μονάδα των κενών — δες `DemandMatch.pricedAs`. */
  readonly pricedAs: PriceRole | null;
  /** Ως τι ταιριάζει — δες `DemandMatch.metOn`. */
  readonly metOn: readonly DemandSeekMet[];
}

/** Το ποσό της αγγελίας **στον ρόλο της εναλλακτικής** — ο **ΕΝΑΣ** αναγνώστης· `null` = δεν δηλώθηκε. */
function declaredAmountOf(listing: PublicListing, seek: PricedDemandSeek): number | null {
  const answer = readNumericAnswer(listing, priceAxisOfSeek(seek));
  return answer.state === 'declared' ? answer.value : null;
}

/**
 * Η εναλλακτική **χωρίς** κανένα όριο (ποσού, ποσοστού ή όρου διαμονής) — δεν εμποδίζει **ποτέ**.
 *
 * ⚠️ ADR-777 §8.60.19: διαμονή **χωρίς** ποσό αλλά **με** παρέα δεν είναι «ανοιχτή» — αλλιώς θα έσωζε
 * δυάρι για πενταμελή οικογένεια επειδή ο άνθρωπος δεν έβαλε τιμή.
 */
function isUnbounded(seek: DemandSeek): boolean {
  if (isShortStaySeek(seek) && isStayTermsSet(seek)) return false;
  return isPricedSeek(seek) ? !isAmountRangeSet(seek.price) : seek.landownerShareMax === null;
}

/**
 * Κρίνει την **αντιπαροχή**: το ποσοστό οικοπεδούχου της αγγελίας απέναντι στην οροφή του εργολάβου.
 *
 * ⚖️ Αδήλωτο ποσοστό ⇒ `share-undeclared` (**αβεβαιότητα**, όχι απουσία — δες το λεξιλόγιο): είναι όρος
 * διαπραγμάτευσης, και η αγγελία **μπορεί** να ταιριάζει.
 */
function judgeExchange(listing: PublicListing, seek: ExchangeDemandSeek): SeekPriceVerdict {
  const share = listing.exchange?.landownerShare ?? null;
  const clean = { seek, blockers: [], ...NO_SEEK_GAPS, role: null, amount: share };
  const max = seek.landownerShareMax;
  if (max === null) return clean;
  if (share === null) return { ...clean, blockers: ['share-undeclared'] };
  return share > max ? { ...clean, blockers: ['share-above'], shareOverBy: share - max } : clean;
}

/**
 * Κρίνει **μία** εναλλακτική απέναντι στο ποσό της αγγελίας **στον ίδιο ρόλο**.
 *
 * ⚠️ **Η ΑΓΓΕΛΙΑ ΧΩΡΙΣ ΠΟΣΟ ΣΕ ΑΥΤΟΝ ΤΟΝ ΡΟΛΟ ΠΑΡΑΜΕΝΕΙ «ΔΕΝ ΤΟ ΔΗΛΩΣΕ»** (ADR-777 §8.52): εμπόδιο
 * **απουσίας**, ποτέ `price-above` για ποσό που κανείς δεν ξέρει. Εναλλακτική **χωρίς** όριο δεν
 * εμποδίζει ποτέ — το ποσό της διαβάζεται μόνο για να **ειπωθεί** («ως ενοικίαση · 850 €/μήνα»).
 */
function judgeSeek(listing: PublicListing, seek: DemandSeek): SeekPriceVerdict {
  if (!isPricedSeek(seek)) return judgeExchange(listing, seek);
  const price = judgePrice(listing, seek);
  if (!isShortStaySeek(seek)) return price;
  // ADR-777 §8.60.19 — η διαμονή κρίνεται **και** στους όρους της: ένα καθαρό ποσό δεν αρκεί.
  const terms = judgeStayTerms(listing, seek);
  return { ...price, blockers: [...price.blockers, ...terms.blockers], nightsShortBy: terms.nightsShortBy };
}

/** Το ποσό **μιας** εναλλακτικής με τιμή, στον ρόλο της — βλ. {@link judgeSeek}. */
function judgePrice(listing: PublicListing, seek: PricedDemandSeek): SeekPriceVerdict {
  const clean = { seek, blockers: [], ...NO_SEEK_GAPS };

  const role = priceRoleOfSeek(seek);
  const amount = declaredAmountOf(listing, seek);
  if (!isAmountRangeSet(seek.price)) return { ...clean, role, amount };
  if (amount === null) return { ...clean, blockers: ['price-undeclared'], role, amount };

  const { min, max } = seek.price;
  const overBy = max !== null && amount > max ? amount - max : null;
  const underBy = min !== null && amount < min ? min - amount : null;
  const blockers: DemandBlocker[] = [];
  if (overBy !== null) blockers.push('price-above');
  if (underBy !== null) blockers.push('price-below');
  return { seek, blockers, ...NO_SEEK_GAPS, overBy, underBy, role, amount };
}

/**
 * **Ποιες εναλλακτικές κρίνονται** — οι **προσφερόμενες**· μόνο αν δεν υπάρχει καμία, όσες έχουν
 * δηλωμένο ποσό στη μονάδα τους (στάση `partial`). Δες την κεφαλίδα για το σφάλμα που κλείνει.
 */
function relevantSeeks(listing: PublicListing, seeks: readonly DemandSeek[]): readonly DemandSeek[] {
  const offered = seeks.filter((seek) => listing.offerKinds.includes(seek.kind));
  if (offered.length > 0) return offered;
  return seeks.filter((seek) => isPricedSeek(seek) && declaredAmountOf(listing, seek) !== null);
}

/** Το περιθώριο κάτω από το ανώτατο όριο (ποσού ή ποσοστού) — ο καθρέφτης του `overBy`. */
function headroomOf(verdict: SeekPriceVerdict): number | null {
  const { seek, amount } = verdict;
  const max = isPricedSeek(seek) ? seek.price.max : seek.landownerShareMax;
  return amount === null || max === null ? null : max - amount;
}

/** Μία καθαρή κρίση → ο **κλάδος** της στο «ως τι» (ποσό **ή** ποσοστό, ποτέ κοινό πεδίο). */
function metOf(verdict: SeekPriceVerdict): DemandSeekMet {
  const { seek, amount } = verdict;
  const headroomBy = headroomOf(verdict);
  return isPricedSeek(seek)
    ? { kind: seek.kind, role: priceRoleOfSeek(seek), amount, headroomBy }
    : { kind: 'exchange', landownerShare: amount, headroomBy };
}

/** Οι **καθαρές** κρίσεις εναλλακτικών που η αγγελία **προσφέρει** — το «ως τι». */
function metOnOf(listing: PublicListing, verdicts: readonly SeekPriceVerdict[]): DemandSeekMet[] {
  return verdicts
    .filter((verdict) => verdict.blockers.length === 0 && listing.offerKinds.includes(verdict.seek.kind))
    .map(metOf);
}

/** Η **πιο κοντινή** κρίση — λιγότερα εμπόδια· ισοπαλία ⇒ η **σειρά του ανθρώπου**. */
function closestOf(verdicts: readonly SeekPriceVerdict[]): SeekPriceVerdict | null {
  return verdicts.reduce<SeekPriceVerdict | null>(
    (kept, next) => (kept === null || next.blockers.length < kept.blockers.length ? next : kept),
    null,
  );
}

/**
 * **Η τιμή — ανά εναλλακτική, στη μονάδα της** (ADR-777 §8.60.15) **και ως τι ταιριάζει** (§8.60.16).
 *
 * | Εναλλακτικές που κρίνονται ({@link relevantSeeks}) | Εμπόδια τιμής |
 * |---|---|
 * | καμία | κανένα — το `offer-kind` (κατηγορικό) έχει ήδη πει «όχι» |
 * | έστω μία **χωρίς** όριο ή μία που **χωρά** | κανένα |
 * | όλες εκτός | της **πιο κοντινής** ({@link closestOf}) |
 *
 * 🔑 Δεν αθροίζονται εμπόδια δύο εναλλακτικών: «ακριβό ως αγορά **και** ακριβό ως ενοίκιο» δεν είναι
 * δύο λόγοι απόρριψης της **ίδιας** πρότασης — είναι δύο προτάσεις, και ο άνθρωπος ζήτησε **οποιαδήποτε**.
 *
 * ⚠️ Το `pricedAs` κρατά **ακριβώς** τη σημασιολογία του §8.60.15 (η πρώτη ανοιχτή προηγείται), ώστε
 * η μονάδα των υποχωρήσεων να μην αλλάξει.
 */
export function priceAxisOutcome(
  listing: PublicListing,
  seeks: readonly DemandSeek[],
): PriceAxisOutcome {
  const verdicts = relevantSeeks(listing, seeks).map((seek) => judgeSeek(listing, seek));
  const metOn = metOnOf(listing, verdicts);

  const open = verdicts.find((verdict) => isUnbounded(verdict.seek));
  const none = { blockers: [], ...NO_SEEK_GAPS, metOn };
  if (open !== undefined) return { ...none, pricedAs: open.role };

  const closest = closestOf(verdicts);
  if (closest === null) return { ...none, pricedAs: null };
  return {
    blockers: closest.blockers,
    overBy: closest.overBy,
    underBy: closest.underBy,
    shareOverBy: closest.shareOverBy,
    nightsShortBy: closest.nightsShortBy,
    pricedAs: closest.role,
    metOn,
  };
}
