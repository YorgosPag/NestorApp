/**
 * @fileoverview **ΟΙ ΔΙΑΔΡΟΜΕΣ ΠΟΥ ΜΕΤΡΙΟΥΝΤΑΙ** — μία λίστα, δύο αναγνώστες.
 * @related app/(bare)/test-harness/camera-motion · lib/geo/camera-motion
 * @module app/(bare)/test-harness/camera-motion/camera-motion-hops
 *
 * 🔑 Ζουν χωριστά από το συστατικό επειδή τις διαβάζουν **δύο**: το harness *(για να
 * πετάξει)* και το `.spec.ts` *(για να κρίνει)*. Γραμμένες δύο φορές, θα απέκλιναν — και
 * η πύλη θα έκρινε **άλλες** πτήσεις από αυτές που έγιναν.
 */

/** Πού ξεκινά κάθε μέτρηση. Σταθερό, ώστε η σύγκριση να έχει νόημα. */
export const HOME = { center: [23.7616, 38.0160] as [number, number], zoom: 12 };

export interface CameraHop {
  /** Σταθερό αναγνωριστικό — το κλειδί με το οποίο το spec ζητά το αποτέλεσμα. */
  readonly id: string;
  /** Τι είναι, στα ελληνικά, για τον άνθρωπο που κοιτά τη σελίδα. */
  readonly label: string;
  readonly center: readonly [number, number];
  readonly zoom: number;
  /**
   * **Οφείλει καμπύλη;** — δηλαδή είναι αρκετά μεγάλο άλμα ώστε ο άνθρωπος να χρειάζεται
   * να δει «από ψηλά» πού πάει.
   *
   * ⚠️ Δηλώνεται **εδώ**, δίπλα στη διαδρομή, και δεν συμπεραίνεται από το spec: η
   * απάντηση είναι γνώση του **προϊόντος** *(«τι θεωρούμε μεγάλο ταξίδι»)*, όχι του
   * οργάνου.
   */
  readonly expectsArc: boolean;
}

/**
 * ⚠️ **Οι τιμές είναι ΠΡΑΓΜΑΤΙΚΕΣ ελληνικές διαδρομές, όχι συνθετικές**: το εύρος που
 * πρέπει να αντέξει η εφαρμογή είναι *«Ομόνοια → Κολωνάκι»* ως *«Θεσσαλονίκη → Χανιά»*.
 * Μια συνθετική «απόσταση Χ» δεν θα αποδείκνυε τίποτα για την οθόνη του μεσίτη.
 */
export const CAMERA_HOPS: readonly CameraHop[] = [
  { id: 'near',     label: '~2 χλμ · ζουμ 12→14 (Ομόνοια → Κολωνάκι)', center: [23.7420, 37.9838], zoom: 14, expectsArc: false },
  { id: 'city',     label: '~15 χλμ (Αθήνα → Γλυφάδα)',                center: [23.7530, 37.8760], zoom: 12, expectsArc: false },
  { id: 'country',  label: '~300 χλμ (Αθήνα → Θεσσαλονίκη)',           center: [22.9444, 40.6403], zoom: 12, expectsArc: true  },
  { id: 'far',      label: '~700 χλμ (Θεσσαλονίκη → Χανιά)',           center: [24.0180, 35.5138], zoom: 12, expectsArc: true  },
  { id: 'zoomOnly', label: 'ίδιο σημείο · ζουμ 12→17 (μόνο ζουμ)',     center: [23.7616, 38.0160], zoom: 17, expectsArc: false },
] as const;

/** Το `id` του `<script type="application/json">` από όπου διαβάζει το spec. */
export const RESULTS_ELEMENT_ID = 'camera-motion-results';
