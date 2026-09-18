/**
 * @fileoverview **ΑΘΡΟΙΣΜΑΤΑ ΤΙΜΗΣ ΑΝΑ ΡΟΛΟ** — ποτέ ένας αριθμός πάνω από ανόμοιες μονάδες.
 * @related ADR-777 §8.60.14.13 · ADR-835 §4.4 · lib/properties/price-resolver.ts
 * @module lib/properties/price-totals
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (2026-09-18)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Επτά εσωτερικές οθόνες έγραφαν «Συνολική Αξία: Χ €» αθροίζοντας τιμές **πώλησης** με
 * **μηνιαία ενοίκια** και **τιμές ανά νύχτα**. Ο `totalPrice` ζητούσε από τον επιλυτή
 * `{ amount, mode }` και **πετούσε το `mode`** — η ίδια μία γραμμή που η Φάση 1 βρήκε στο
 * `priceSortKey`. Δεν έλειπε πληροφορία· **δεν ρωτιόταν**.
 *
 * 🔑 **Ο κανόνας** (απόφαση Giorgio, §8.60.14.2): *κάθε ερώτηση για ποσό φέρει ΜΟΝΑΔΑ·
 * ποσά άλλης μονάδας δεν αθροίζονται — απαντώνται ΧΩΡΙΣΤΑ.* Το **Revit** αρνείται
 * («Inconsistent units») να συνθέσει μεγέθη διαφορετικού τύπου μονάδας, και δίνει
 * **υποσύνολα ανά ομάδα** (`Footer → «Title, count, and totals»`)· το **ArchiCAD** βάζει
 * σημαία υποσυνόλου ανά πεδίο ομαδοποίησης· το **Stripe** κρατά **ένα υπόλοιπο ανά
 * νόμισμα** και δεν τα προσθέτει χωρίς ισοτιμία. Εδώ ισοτιμία **δεν υπάρχει** (§8.60.14.2).
 *
 * ⛔ **Ο ΤΥΠΟΣ ΕΙΝΑΙ Ο ΦΡΟΥΡΟΣ.** Το {@link PriceTotalsByRole} **δεν έχει** πεδίο `total`.
 * Όποιος θέλει «έναν αριθμό» πρέπει να γράψει `byRole.sale` — δηλαδή **να ονομάσει τη
 * μονάδα**. Ο παλιός `totalPrice` **διαγράφηκε** αντί να μείνει δίπλα: δύο συναρτήσεις θα
 * ήταν δύο αλήθειες, και η εύκολη θα κέρδιζε.
 *
 * ⚠️ **Γιατί χωριστό αρχείο από τον `price-resolver.ts`** (N.7.1): εκείνος ήταν ήδη **538**
 * γραμμές. Εκείνος απαντά *«ποια είναι η τιμή ΕΝΟΣ ακινήτου και τι ΕΙΔΟΥΣ»*· αυτό
 * *«πώς αθροίζεται ΜΙΑ ΣΥΛΛΟΓΗ»*. Ίδιο λεξιλόγιο (`PriceRole`, `PRICE_ROLES`), **ένας**
 * κριτής (`resolveDisplayPrice`), καμία δεύτερη μηχανή.
 */

import {
  PRICE_ROLES,
  resolveDisplayPrice,
  type PriceRole,
  type PricedPropertyLike,
} from '@/lib/properties/price-resolver';

// ============================================================================
// ΤΟ ΣΧΗΜΑ
// ============================================================================

/**
 * Τιμή ανά τετραγωνικό, **μέσα σε έναν ρόλο**, με την κάλυψή της δηλωμένη.
 *
 * 🔑 **Αριθμητής και παρονομαστής από το ΙΔΙΟ σύνολο μονάδων** — όσες έχουν **και** τιμή
 * **και** εμβαδόν. Ως τις 2026-09-18 οι σελίδες πωλήσεων διαιρούσαν το άθροισμα των
 * **τιμολογημένων** με το εμβαδόν **όλων**: κάθε μονάδα χωρίς τιμή έριχνε το €/m² σαν να
 * ήταν δωρεάν — η αμαρτία του μέσου όρου που το ADR-777 Α5 είχε ήδη κλείσει, στο εμβαδόν.
 */
export interface PricePerArea {
  /** `Σ τιμή / Σ εμβαδόν`, πάνω από τις μονάδες που έχουν και τα δύο. */
  readonly amount: number;
  /** Πόσες μονάδες καλύπτει — **όχι** το `pricedCount`: μια τιμή χωρίς εμβαδόν δεν μετρά εδώ. */
  readonly measuredCount: number;
}

/**
 * Το **υποσύνολο ενός ρόλου** — ποσά **μίας** μονάδας, με τη λογιστική τους.
 *
 * ⚠️ Δεν έχει `unpricedCount`: μια μονάδα χωρίς τιμή **δεν έχει ρόλο**, άρα δεν ανήκει σε
 * κανένα υποσύνολο. Ζει **μία** φορά, στο {@link PriceTotalsByRole}.
 */
export interface PriceTotals {
  /** Άθροισμα μόνο όσων **έχουν** τιμή αυτού του ρόλου. */
  readonly total: number;
  /** `total / pricedCount` — ο παρονομαστής αποκλείει τις ατιμολόγητες (SQL: `AVG` αγνοεί το NULL). */
  readonly average: number;
  /** Πόσες μονάδες έδωσαν αριθμό σε αυτόν τον ρόλο. */
  readonly pricedCount: number;
  /** `null` όταν δεν ζητήθηκε εμβαδόν ή καμία μονάδα του ρόλου δεν το έχει. */
  readonly perArea: PricePerArea | null;
}

/**
 * **Το άθροισμα μιας συλλογής — ανά ρόλο, με την απουσία ονομασμένη.**
 *
 * Αναλλοίωτο: `Σ byRole[r].pricedCount + unpricedCount === items.length`.
 *
 * 🔑 `Record<PriceRole, …>` και όχι `Map` ή πίνακας: τέταρτος ρόλος **δεν μεταγλωττίζεται**
 * μέχρι να δηλωθεί το υποσύνολό του, και ρόλος χωρίς μονάδες έχει **ρητό** μηδέν
 * (`pricedCount: 0`) — η **οθόνη** αποφασίζει να μην τον τυπώσει, όχι η αριθμητική.
 */
export interface PriceTotalsByRole {
  readonly byRole: Readonly<Record<PriceRole, PriceTotals>>;
  /** Όσες δεν έδωσαν ποσό — η κλάση `'unpriced'` του `PriceClass`. */
  readonly unpricedCount: number;
}

/** Ό,τι ξέρει να δώσει εμβαδόν. `null`/`0` ⇒ «άγνωστο», ποτέ «μηδέν τ.μ.». */
export type AreaOf<T> = (item: T) => number | null | undefined;

// ============================================================================
// Η ΑΡΙΘΜΗΤΙΚΗ — ένα πέρασμα, ο επιλυτής μία φορά ανά μονάδα
// ============================================================================

interface RoleAccumulator {
  total: number;
  pricedCount: number;
  measuredAmount: number;
  measuredArea: number;
  measuredCount: number;
}

function emptyAccumulator(): RoleAccumulator {
  return { total: 0, pricedCount: 0, measuredAmount: 0, measuredArea: 0, measuredCount: 0 };
}

function finish(acc: RoleAccumulator): PriceTotals {
  return {
    total: acc.total,
    average: acc.pricedCount > 0 ? acc.total / acc.pricedCount : 0,
    pricedCount: acc.pricedCount,
    perArea: acc.measuredCount > 0
      ? { amount: acc.measuredAmount / acc.measuredArea, measuredCount: acc.measuredCount }
      : null,
  };
}

/** Θετικό, πεπερασμένο εμβαδόν — ή τίποτα. */
function usableArea(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * **Άθροισμα, μέσος όρος και €/m² ΑΝΑ ΡΟΛΟ.**
 *
 * ⚡ **Ένα πέρασμα**: ο επιλυτής ({@link resolveDisplayPrice}) ρωτιέται **μία φορά ανά
 * μονάδα** και η απάντηση δίνει **και** τον ρόλο **και** το ποσό — το μάθημα του
 * Schwartzian transform της Φάσης 1.
 *
 * @param areaOf προαιρετικό· όταν λείπει, κάθε `perArea` είναι `null`.
 */
export function totalPriceByRole<T extends PricedPropertyLike>(
  items: readonly T[],
  areaOf?: AreaOf<T>,
): PriceTotalsByRole {
  const acc = Object.fromEntries(
    PRICE_ROLES.map((role) => [role, emptyAccumulator()]),
  ) as Record<PriceRole, RoleAccumulator>;
  let unpricedCount = 0;

  for (const item of items) {
    const price = resolveDisplayPrice(item);
    if (price.kind !== 'priced') {
      unpricedCount += 1;
      continue;
    }
    const role = acc[price.headline.role];
    role.total += price.headline.amount;
    role.pricedCount += 1;

    const area = areaOf ? usableArea(areaOf(item)) : null;
    if (area !== null) {
      role.measuredAmount += price.headline.amount;
      role.measuredArea += area;
      role.measuredCount += 1;
    }
  }

  return {
    byRole: Object.fromEntries(
      PRICE_ROLES.map((role) => [role, finish(acc[role])]),
    ) as Record<PriceRole, PriceTotals>,
    unpricedCount,
  };
}

// ============================================================================
// ΑΝΑΓΝΩΣΕΙΣ
// ============================================================================

/**
 * Οι ρόλοι **που έχουν μονάδες**, στη δηλωμένη σειρά.
 *
 * ⚠️ Ρόλος με μηδέν μονάδες **δεν** επιστρέφεται: «Βραχυχρόνια: 0 €» σε χαρτοφυλάκιο χωρίς
 * καταλύματα είναι θόρυβος — κανείς δεν ρώτησε.
 */
export function pricedRolesOf(totals: PriceTotalsByRole): readonly PriceRole[] {
  return PRICE_ROLES.filter((role) => totals.byRole[role].pricedCount > 0);
}

/** Μια συλλογή χωρίς μονάδες — η zero value του τύπου, ένα κοινό αντικείμενο (όχι νέο ανά απόδοση). */
export const EMPTY_PRICE_TOTALS: PriceTotalsByRole = Object.freeze(totalPriceByRole([]));
