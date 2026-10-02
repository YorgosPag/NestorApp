/**
 * @fileoverview **Η ΜΙΑ ΚΛΙΜΑΚΑ ΠΛΗΘΟΥΣ ΖΗΤΗΣΗΣ** — ζώνες 1·3·8·20·50.
 * @related ADR-777 §7 (Α9) · ADR-900 §3.8 · lib/demand/demand-announcement · lib/demand/demand-aggregate
 * @module lib/demand/demand-count-bands
 *
 * 🔑 **ΓΙΑΤΙ ΞΕΧΩΡΙΣΕ (ADR-900 §3.8, 2026-10-02)**: η κλίμακα γεννήθηκε για να κρίνει **πότε
 * αξίζει ειδοποίηση** (`demand-announcement.ts`). Τώρα κρίνει **και τι βλέπει** ο **δηλωμένος**
 * ιδιοκτήτης (`DEMAND_DISCLOSURE['place-owner'].rounding = bands`). Δεύτερη κλίμακα για την
 * οθόνη θα σήμαινε email «τουλάχιστον 3» και πάνελ «τουλάχιστον 5» για το ίδιο πλήθος.
 * Ζει σε **leaf** ώστε το πάνελ του πελάτη να μη σέρνει το `price-history`/`zod` του
 * `demand-announcement`.
 *
 * **Layering**: leaf — καμία εισαγωγή.
 */

/**
 * 🔴 **ΟΙ ΖΩΝΕΣ — κάθε μία είναι ΑΛΛΗ ΕΙΔΗΣΗ, όχι μεγαλύτερος αριθμός.**
 *
 * Γεωμετρική κλιμάκωση (×~2–2,5): η ανθρώπινη αντίληψη πλήθους είναι **λογαριθμική**,
 * και το πρότυπο το εφαρμόζει ήδη ο ίδιος ο κλάδος (η αύξηση **ποσοστού** του
 * Rightmove, όχι απόλυτου ποσού· η **σχετική** υποχώρηση 15% του `demand-concessions.ts`).
 *
 * - **1** — *«υπάρχει κιόλας κάποιος»*: η **ισχυρότερη** είδηση όλων, γιατί μετατρέπει
 *   το «ίσως κάποτε» σε «τώρα». Είναι το κατώφλι που ο Giorgio διάλεξε ρητά
 *   (`DEMAND_DISCLOSURE['place-owner']`, *«από τον 1ο»*).
 * - **3** — *«δεν ήταν σύμπτωση»*.
 * - **8 · 20 · 50** — *«υπάρχει αγορά»* σε κλίμακες που αλλάζουν **τι θα κάνει**:
 *   κανείς δεν αποφασίζει διαφορετικά στο 21 απ' ό,τι στο 20.
 *
 * ⚠️ **Η σειρά ΕΙΝΑΙ ο μηχανισμός** — γνησίως αύξουσα, όπως η κλίμακα z-index του
 * CHECK 3.50. Δύο ίσες ζώνες θα ήταν δύο ονόματα για ένα σκαλί· φθίνουσα θα έσπαγε
 * το {@link announcementBand}. Ο αυτοέλεγχος παρακάτω το κάνει **αδύνατο σιωπηλά**.
 */
export const ANNOUNCEMENT_BANDS = [1, 3, 8, 20, 50] as const;

/**
 * 🔴 **Αυτοέλεγχος στη φόρτωση του module** — η κλίμακα ελέγχει τον εαυτό της.
 *
 * Μια μη αύξουσα λίστα θα έκανε το {@link announcementBand} να επιστρέφει **λάθος
 * ζώνη σιωπηλά**, δηλαδή θα έστελνε email σε λάθος στιγμές χωρίς κανένα σφάλμα. Ο
 * μεταγλωττιστής **δεν έχει γνώμη** για τη σειρά αριθμών σε πίνακα — ίδιο μάθημα με
 * τον αυτοέλεγχο διάταξης του CHECK 3.50.
 */
for (let index = 1; index < ANNOUNCEMENT_BANDS.length; index += 1) {
  if (ANNOUNCEMENT_BANDS[index] <= ANNOUNCEMENT_BANDS[index - 1]) {
    throw new Error(
      `demand-count-bands: οι ζώνες ΠΡΕΠΕΙ να είναι γνησίως αύξουσες — ` +
        `${ANNOUNCEMENT_BANDS[index - 1]} → ${ANNOUNCEMENT_BANDS[index]}`,
    );
  }
}

export type AnnouncementBand = (typeof ANNOUNCEMENT_BANDS)[number];

/**
 * **Σε ποια ζώνη πέφτει αυτό το πλήθος** — ή `null` όταν δεν αξίζει να ειπωθεί.
 *
 * ⚠️ `null` σημαίνει *«καμία είδηση»*, **όχι** *«σφάλμα»*: πλήθος κάτω από την πρώτη
 * ζώνη είναι ακριβώς η σιωπή που το κατώφλι αποκάλυψης επιβάλλει ούτως ή άλλως.
 *
 * ⚠️ **Δέχεται `number | null`** — το `null` είναι η **λογοκριμένη** τιμή του
 * `DemandDisclosure.count`, και το να την αναγκάζαμε τον καλούντα να ξετυλίξει θα ήταν
 * η στιγμή που κάποιος θα έγραφε `count ?? 0` και θα ανακοίνωνε το μηδέν.
 */
export function announcementBand(count: number | null): AnnouncementBand | null {
  if (count === null) return null;

  let band: AnnouncementBand | null = null;
  for (const candidate of ANNOUNCEMENT_BANDS) {
    if (count >= candidate) band = candidate;
  }
  return band;
}
