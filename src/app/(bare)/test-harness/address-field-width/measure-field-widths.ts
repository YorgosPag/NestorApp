/**
 * @fileoverview **Η ΜΕΤΡΗΣΗ** — «πόσοι χαρακτήρες χωράνε πράγματι σε αυτό το πεδίο;»
 * @related address-field-width-cases · AddressFieldWidthHarness · ADR-332 D27 Ζ7
 *
 * ⚠️ **Καμία κρίση εδώ.** Αυτό το αρχείο παράγει αριθμούς· η ετυμηγορία ζει στην πύλη
 * (`address-field-width.e2e.spec.ts`) και το κατώφλι στο `address-field-widths.ts`.
 * Όργανο που κρίνει τον εαυτό του δεν είναι όργανο.
 */

import type { FieldWidthResult, WidthCase } from './address-field-width-cases';

/**
 * Πλάτος ενός «0» στη γραμματοσειρά **αυτού** του στοιχείου — ο ορισμός του `ch` στο CSS.
 *
 * 🔑 Γιατί μετριέται και δεν υποτίθεται: το `ch` εξαρτάται από γραμματοσειρά **και**
 * μέγεθος **και** zoom. Ένας καρφωμένος συντελεστής «≈7 px» θα έκανε την πύλη να κρίνει
 * άλλη γραμματοσειρά από αυτήν που βλέπει ο άνθρωπος.
 */
function charWidthOf(el: Element): number {
  const cs = getComputedStyle(el);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return 0;
  ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  return ctx.measureText('0').width;
}

/** Ο χώρος όπου φαίνεται πράγματι κείμενο — το padding ΔΕΝ είναι ωφέλιμο πλάτος. */
function usableWidthOf(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/**
 * Το σήμα κατάστασης της ίδιας γραμμής — **ο ανταγωνιστής του πεδίου**.
 *
 * Καταγράφεται επίτηδες: χωρίς αυτό, ένα κόκκινο θα έλεγε «το πεδίο είναι στενό» χωρίς να
 * λέει **ποιος** πήρε τον χώρο, και ο επόμενος θα κυνηγούσε το λάθος πράγμα (όπως κυνηγήθηκε
 * ο χειριστής εισόδου, που ήταν σύμπτωμα).
 */
function badgeBeside(input: HTMLElement): { text: string; width: number } {
  const row = input.closest('[data-address-field-row]') ?? input.parentElement;
  const badge = row?.querySelector<HTMLElement>('[data-address-field-badge]')
    ?? row?.querySelector<HTMLElement>(':scope > :not(input):not(label)');
  if (!badge) return { text: '', width: 0 };
  return { text: (badge.innerText ?? '').trim(), width: badge.getBoundingClientRect().width };
}

/** Ξεχείλισε οριζόντια; Λύση που **κρύβει** αντί να τυλίγει δεν είναι λύση. */
function overflowsHorizontally(input: HTMLElement): boolean {
  const row = input.closest('[data-address-field-row]') ?? input.parentElement;
  if (!row) return false;
  return row.scrollWidth > row.clientWidth + 1;
}

/** Όλα τα πεδία μιας περίπτωσης πλάτους, μετρημένα. */
export function measureCase(root: HTMLElement, widthCase: WidthCase): FieldWidthResult[] {
  const inputs = [...root.querySelectorAll<HTMLElement>('[data-address-field]')];
  return inputs.map(input => {
    const charPx = charWidthOf(input);
    const usablePx = usableWidthOf(input);
    const badge = badgeBeside(input);
    return {
      caseId: widthCase.id,
      caseWidthPx: widthCase.widthPx,
      field: input.getAttribute('data-address-field') ?? '(αδήλωτο)',
      usablePx: Math.round(usablePx),
      charPx: Number(charPx.toFixed(2)),
      usableChars: charPx > 0 ? Number((usablePx / charPx).toFixed(2)) : 0,
      badgeText: badge.text,
      badgePx: Math.round(badge.width),
      overflows: overflowsHorizontally(input),
    };
  });
}

/**
 * Κάθε περίπτωση πλάτους αποδίδει **την ίδια** φόρμα ⇒ οφείλει να δώσει **τον ίδιο** αριθμό
 * πεδίων. Άνιση κατανομή σημαίνει ότι κάποια δεν έχει αποδοθεί ακόμη — **όχι** ότι έχει
 * λιγότερα πεδία.
 */
function isComplete(rows: FieldWidthResult[], caseCount: number): boolean {
  if (rows.length === 0) return false;
  const perCase = new Map<string, number>();
  for (const row of rows) perCase.set(row.caseId, (perCase.get(row.caseId) ?? 0) + 1);
  if (perCase.size < caseCount) return false;
  const counts = [...perCase.values()];
  return counts.every(n => n === counts[0]);
}

/**
 * Μετρά **αφού ησυχάσει η διάταξη**, και το αποδεικνύει με **δύο** ανεξάρτητες συνθήκες:
 * (α) η μέτρηση είναι **πλήρης**, (β) δύο διαδοχικές μετρήσεις **ταυτίζονται**.
 *
 * 🔴 **ΜΕΤΡΗΜΕΝΟ ΓΙΑΤΙ ΣΥΝΕΒΗ (2026-09-13) — Η ΑΓΚΥΡΑ ΒΓΗΚΕ ΜΗ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΗ.**
 * Η πρώτη γραφή έδινε **12 × 250 ms = 3 δευτερόλεπτα** και σταθεροποιούνταν μόλις δύο
 * μετρήσεις συνέπιπταν. Σε **ζεστή** σελίδα έβγαινε **5/5**· σε **κρύα** (άλλη συνεδρία,
 * χωρίς προθέρμανση της διαδρομής) **4/5** — το Κ3 έπιανε περίπτωση με λιγότερα από τρία
 * πεδία. Ίδιος κώδικας, δύο αποτελέσματα.
 *
 * ⚠️ **Μια άγκυρα που κοκκινίζει άλλοτε ναι κι άλλοτε όχι είναι ΧΕΙΡΟΤΕΡΗ από κόκκινη**:
 * διδάσκει τον αναγνώστη να την ξανατρέχει μέχρι να πρασινίσει. Η θεραπεία ΔΕΝ είναι να
 * χαλαρώσει το Κ3 — ο φρουρός δούλεψε **ακριβώς** όπως σχεδιάστηκε, έπιασε **κενή μέτρηση**
 * αντί να την περάσει για επιτυχία. Η θεραπεία είναι να μη δημοσιεύει το όργανο **πρόωρα**.
 *
 * 🔑 Το σχήμα είναι το ίδιο που φυλάει το Κ3 και το Κ5 του CHECK 3.77: *«λίγα δείγματα
 * σημαίνει «κανείς δεν κοίταξε», όχι «καθαρό»»* — εδώ εφαρμόζεται στο **ίδιο το όργανο**.
 *
 * Η σελίδα φορτώνει **3,2 MB** διοικητικής ιεραρχίας **lazy** και αποδίδει **τέσσερα**
 * αντίγραφα του editor· 3 δευτερόλεπτα δεν έφταναν ποτέ σε κρύο. Τώρα: έως **45 s**, με
 * έξοδο μόλις η μέτρηση είναι πλήρης **και** σταθερή.
 */
export async function measureWhenSettled(
  read: () => FieldWidthResult[],
  caseCount: number,
  { attempts = 90, pauseMs = 500 } = {},
): Promise<FieldWidthResult[]> {
  let previous = '';
  for (let i = 0; i < attempts; i += 1) {
    await new Promise(resolve => setTimeout(resolve, pauseMs));
    const current = read();
    const signature = JSON.stringify(current);
    if (isComplete(current, caseCount) && signature === previous) return current;
    previous = signature;
  }
  /*
    ⚠️ Εξάντληση του χρόνου ⇒ επιστρέφουμε ό,τι έχουμε **ωμό**. Το Κ3 θα κοκκινίσει, και
    αυτό είναι το **σωστό**: «δεν πρόλαβα να μετρήσω» δεν είναι «όλα καλά». Καμία σιωπηλή
    συμπλήρωση, κανένα μισό αποτέλεσμα βαφτισμένο πλήρες.
  */
  return read();
}
