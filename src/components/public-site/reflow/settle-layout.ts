/**
 * **Πότε είναι η διάταξη ΑΥΤΗ που βλέπει ο άνθρωπος;** — η αναμονή του CHECK 3.94 (ADR-797 §Φ.Ρ.2).
 *
 * ⚠️ **ΤΡΕΧΕΙ ΜΕΣΑ ΣΤΟΝ BROWSER** (`page.evaluate`): καμία εισαγωγή, κανένα κλείσιμο.
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ `networkidle`** (μετρημένο 2026-09-25): με τα ψεύτικα κλειδιά Firebase του CI το δίκτυο
 * **δεν ησυχάζει ποτέ** ⇒ κάθε test πλήρωνε ολόκληρο το όριο (~42 s, και τα πράσινα) ⇒ 58 tests × 3
 * προσπάθειες ξεπέρασαν τα 45′ και το run **ακυρώθηκε χωρίς ετυμηγορία**. Και όταν ησύχαζε, δεν έλεγε
 * τίποτα για τη **διάταξη** (το Playwright το χαρακτηρίζει επίσημα «DISCOURAGED»).
 *
 * 🔴 **ΓΙΑΤΙ ΟΧΙ ΜΕΤΡΗΣΗ ΑΜΕΣΩΣ**: το συρτάρι του «☰ Μενού» μετρήθηκε στο −236…36 px — **ενώ γλιστρούσε
 * μέσα**. Ψεύτικο κόκκινο, όχι βλάβη.
 *
 * ✅ Γραμματοσειρές φορτωμένες (τα ελληνικά αλλάζουν πλάτος με τη γραμματοσειρά) + **πεπερασμένες**
 * κινήσεις ολοκληρωμένες (οι άπειρες — spinners, pulse — δεν τελειώνουν ποτέ και δεν μετακινούν
 * διάταξη) + δύο καρέ ζωγραφικής. Την «ησυχία» στον χρόνο την κρίνει ο καλών (δείγματα που συμφωνούν).
 */
export async function settleLayout(): Promise<void> {
  await document.fonts.ready;
  const finite = document.getAnimations().filter((animation) => {
    const timing = animation.effect?.getComputedTiming();
    return animation.playState === 'running' && timing !== undefined && timing.endTime !== Infinity;
  });
  await Promise.all(finite.map((animation) => animation.finished.catch(() => undefined)));
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}
