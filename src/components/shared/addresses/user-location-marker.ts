/**
 * @fileoverview **Ο ΔΕΙΚΤΗΣ «ΕΙΣΑΙ ΕΔΩ»** — χτίσιμο DOM, έξω από το συστατικό.
 * @related components/shared/addresses/AddressMap.tsx
 * @module components/shared/addresses/user-location-marker
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΓΙΑΤΙ ΕΞΗΧΘΗ — ΚΑΙ ΓΙΑΤΙ **ΕΞΑΓΩΓΗ**, ΟΧΙ ΨΑΛΙΔΙΣΜΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `AddressMap.tsx` ήταν στις **499** γραμμές — **μία** κάτω από το όριο των 500 που
 * είναι **δεσμευτικό στο pre-commit** (N.7.1). Η τεκμηρίωση της αλλαγής στην κίνηση της
 * κάμερας το πέρασε στις **511**.
 *
 * ⚠️ **Η εύκολη διέξοδος ήταν να κοπεί το σχόλιο.** Είναι λάθος διέξοδος: το όριο δεν
 * υπάρχει για να μετράει χαρακτήρες, υπάρχει επειδή **ένα αρχείο = μία ευθύνη**. Ένα
 * αρχείο που κάθεται μόνιμα στο 499 δεν είναι «οριακά εντάξει» — είναι **ήδη** πάνω από
 * το όριο και το κρύβει.
 *
 * 🔑 **Και ο κώδικας που φεύγει είναι ο σωστός**: το `MapLibreMarker` δέχεται ωμό
 * `HTMLElement`, άρα εδώ γράφεται **ιμπεραστική κατασκευή DOM** — γνώση που δεν έχει
 * καμία σχέση ούτε με τον χάρτη, ούτε με τις διευθύνσεις, ούτε με το React.
 *
 * ⚠️ **Τα χρώματα μένουν σκόπιμα ωμά, με τη σιωπή του κανόνα ΜΕΤΑΚΙΝΗΜΕΝΗ μαζί τους**
 * *(ήταν ήδη έτσι)*: είναι **χρέος**, όχι απόφαση — το πράσινο του «είσαι εδώ» οφείλει
 * να γίνει token. Καταγράφεται εδώ ώστε να είναι **ορατό** αντί για θαμμένο σε
 * συστατικό 500 γραμμών.
 */

/** Το `id` του `<style>` που κρατά το `@keyframes ping` — **ένα** για όλη τη σελίδα. */
const KEYFRAMES_ID = 'user-loc-keyframes';

/**
 * Ο παλμός του δείκτη, γραμμένος **μία φορά** στην κεφαλίδα.
 *
 * ⚠️ **Ταυτοδύναμο επίτηδες**: ο δείκτης ξαναχτίζεται σε κάθε νέα θέση, και χωρίς τον
 * έλεγχο ταυτότητας η σελίδα θα μάζευε ένα `<style>` ανά εντοπισμό.
 */
function ensurePulseKeyframes(): void {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = '@keyframes ping{75%,100%{transform:scale(2);opacity:0}}';
  document.head.appendChild(style);
}

/**
 * **Το στοιχείο που θα δώσουμε στο `MapLibreMarker`** — τρεις ομόκεντροι κύκλοι με παλμό.
 */
export function createUserLocationMarkerElement(): HTMLElement {
  ensurePulseKeyframes();

  const el = document.createElement('div');
  el.className = 'user-location-marker';
  // eslint-disable-next-line design-system/no-hardcoded-colors -- δες την κεφαλίδα: μεταφερμένο χρέος
  el.innerHTML = `
    <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center">
      <span style="position:absolute;inset:0;border-radius:50%;background:rgba(34,197,94,0.25);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite"></span>
      <span style="position:absolute;inset:4px;border-radius:50%;background:rgba(34,197,94,0.15)"></span>
      <span style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);position:relative"></span>
    </div>
  `;
  return el;
}
