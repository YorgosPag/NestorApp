/**
 * press-ownership.ts — «κρατάει ήδη κάποιος άλλος αυτό το πάτημα;» για τον 3D καμβά (ADR-692 Φ2).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (μετρημένο 2026-07-25, «κάθε δεύτερο marquee drag ακυρώνεται»):
 * ο marquee ρωτούσε `useBim3DEditStore.getState().editToolActive` για να παραχωρήσει το drag στο
 * gizmo. Όμως το gizmo είναι **auto-on-selection** (ADR-402, `syncFromSelection`): ΚΑΘΕ επιτυχημένο
 * marquee πάνω σε BIM οντότητα ανάβει το `editToolActive`. Άρα το ΕΠΟΜΕΝΟ πάτημα έβρισκε τη
 * σημαία αναμμένη, ο marquee δεν οπλιζόταν καθόλου, το trailing `click` έπεφτε σε κενό χώρο και
 * καθάριζε την επιλογή → 0. Με άδεια επιλογή το gizmo έσβηνε → το μεθεπόμενο drag δούλευε ξανά.
 * Μοτίβο ✅❌✅❌ — η σημαία εναλλασσόταν μαζί με την επιλογή, όχι με τη χειρονομία.
 *
 * Η ΠΡΟΘΕΣΗ της ADR-408 ήταν «το gizmo κατέχει το drag ΠΟΥ ΞΕΚΙΝΑΕΙ ΠΑΝΩ ΤΟΥ» — όχι «όσο υπάρχει
 * επιλογή». Αυτό το module είναι το SSoT αυτής της ερώτησης: όποιος χειριστής μπορεί να αρπάξει
 * ένα πάτημα (BIM gizmo, reshape grips, raw-DXF grips, σύρσιμο ανοίγματος) δηλώνει ΕΝΑΝ probe
 * «δικό μου είναι τώρα;»· ο marquee ρωτάει τους πάντες με μία κλήση.
 *
 * ΓΙΑΤΙ ΔΟΥΛΕΥΕΙ ΧΩΡΙΣ ΣΥΝΘΗΚΗ ΑΓΩΝΑ: οι ιδιοκτήτες ακούνε `pointerdown` (native, στον καμβά),
 * ο marquee ακούει `mousedown` (React, στη ρίζα). Το DOM στέλνει ΠΑΝΤΑ `pointerdown` ΠΡΙΝ το
 * `mousedown`, άρα όταν ρωτάει ο marquee η απάντηση είναι ήδη οριστική.
 *
 * Zero-dependency leaf (όπως το `pointer-activity.ts`): το διαβάζει το viewport layer και το
 * γράφουν τα interaction hooks, χωρίς κυκλική εξάρτηση και χωρίς React.
 *
 * @module bim-3d/systems/press-ownership
 */

/** «Κρατάω εγώ το τρέχον πάτημα;» — διαβάζεται τη στιγμή του γεγονότος, ποτέ σε render. */
export type Bim3DPressProbe = () => boolean;

const probes = new Set<Bim3DPressProbe>();

/**
 * Δήλωσε έναν ιδιοκτήτη πατήματος. Επιστρέφει τον unregister — κάλεσέ τον στο cleanup του effect
 * (αλλιώς ένας probe από ξεφορτωμένο viewport θα απαντούσε για πάντα).
 */
export function registerBim3DPressOwner(probe: Bim3DPressProbe): () => void {
  probes.add(probe);
  return () => { probes.delete(probe); };
}

/** TRUE αν οποιοσδήποτε καταχωρημένος ιδιοκτήτης κρατάει ΤΩΡΑ το πάτημα (gizmo/grip/άνοιγμα). */
export function isBim3DPressOwned(): boolean {
  for (const probe of probes) {
    if (probe()) return true;
  }
  return false;
}

/** Test-only — καθάρισε το μητρώο μεταξύ specs. */
export function _resetBim3DPressOwnersForTests(): void {
  probes.clear();
}
