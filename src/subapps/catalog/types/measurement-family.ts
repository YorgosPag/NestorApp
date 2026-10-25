/**
 * =============================================================================
 * ΟΙΚΟΓΕΝΕΙΑ ΜΕΤΡΗΣΗΣ (ADR-923 §5.2) — τύποι
 * =============================================================================
 *
 * Πρότυπο Akeneo «measurement family»: **μία μονάδα-πρότυπο** ανά οικογένεια, και κάθε
 * άλλη μονάδα με τον τρόπο που φτάνει σε αυτήν. Η τιμή μιας ιδιότητας αποθηκεύεται
 * **και** στη μονάδα που την έγραψε ο άνθρωπος **και** στη μονάδα-πρότυπο (Φάση 2),
 * ώστε σύγκριση/φίλτρο/ταξινόμηση να είναι μια απλή αριθμητική πράξη.
 *
 * 🔑 **Μετατροπή = αφινική** (`πρότυπο = τιμή × factor + offset`). Το Akeneo κρατά
 * λίστα πράξεων (`mul/div/add/sub`, έως 5)· κάθε τέτοια λίστα για **γραμμικό** μέγεθος
 * ανάγεται σε ένα `factor` και ένα `offset`, και η αφινική μορφή αντιστρέφεται
 * **κλειστά** — χωρίς τον κίνδυνο λάθους σειράς πράξεων που το ίδιο το Akeneo
 * προειδοποιεί. Έτσι καλύπτονται και τα °C/°F/K χωρίς ειδική περίπτωση.
 *
 * ⚠️ **Λογαριθμικά μεγέθη** (dB) δεν μετατρέπονται αφινικά — γι' αυτό η οικογένειά τους
 * έχει **μία** μονάδα. Η επικύρωση το επιβάλλει μέσω της σημαίας `singleUnit`.
 *
 * @module subapps/catalog/types/measurement-family
 */

import type { LocalizedText } from '@/i18n/localized-text';
import type { QuantitySpec } from '@/constants/quantity-specs';

/** Μία μονάδα μιας οικογένειας μέτρησης. */
export interface MeasurementUnitDefinition {
  /** Σταθερός κωδικός μονάδας μέσα στην οικογένεια (π.χ. `kW`). Αμετάβλητος. */
  readonly code: string;
  /** Σύμβολο προβολής (π.χ. `kW`, `m³/h`, `°C`) — χωρίς μετάφραση, όπως το SI. */
  readonly symbol: string;
  /** `πρότυπο = τιμή × factor + offset`. Πάντα πεπερασμένο και > 0. */
  readonly factor: number;
  /** Μετατόπιση (μόνο για μεγέθη με διαφορετικό μηδέν, π.χ. θερμοκρασία). Προεπιλογή 0. */
  readonly offset?: number;
  /** Κωδικός UNECE Recommendation 20 — **μόνο** όπου είναι επαληθευμένος (ETIM/GS1/IFC). */
  readonly unece?: string;
}

/** Ετικέτα: κλειδί i18n (πλατφόρμα) ή κείμενο που έγραψε ο χρήστης (χώρος). */
export type MeasurementLabel =
  | { readonly kind: 'i18n'; readonly key: string }
  | { readonly kind: 'text'; readonly text: LocalizedText };

/** Πηγή οικογένειας: της πλατφόρμας (κώδικας) ή του χώρου (Firestore). */
export type MeasurementFamilySource = 'platform' | 'workspace';

/** Ο ενιαίος ορισμός που διαβάζει κάθε καταναλωτής, ανεξαρτήτως πηγής. */
export interface MeasurementFamilyDefinition {
  /** Σταθερός κωδικός (π.χ. `power`). Μοναδικός ανάμεσα σε πλατφόρμα **και** χώρο. */
  readonly code: string;
  readonly source: MeasurementFamilySource;
  readonly label: MeasurementLabel;
  /** Κωδικός της μονάδας-προτύπου· η μονάδα αυτή έχει `factor = 1`, `offset = 0`. */
  readonly standardUnitCode: string;
  readonly units: readonly MeasurementUnitDefinition[];
  /**
   * **Συγκρίσιμη σε επίπεδο πλατφόρμας;** Οι οικογένειες της πλατφόρμας είναι πάντα.
   * Του χώρου γίνονται μόνο μετά από έγκριση πλατφόρμας (ADR-923 §17) — ως τότε η
   * ιδιότητα φαίνεται στη βιτρίνα του προμηθευτή αλλά **δεν** μπαίνει στα φίλτρα της πύλης.
   */
  readonly comparable: boolean;
  /** Λογαριθμικό μέγεθος ⇒ ακριβώς μία μονάδα. */
  readonly singleUnit?: boolean;
  /** Σύνδεση με το λεξιλόγιο «τι είδους αριθμός» (ADR-852), όπου ταιριάζει. */
  readonly quantitySpec?: QuantitySpec;
}

/**
 * Ό,τι **αποθηκεύεται** για οικογένεια χώρου (Firestore). Η `source` (`workspace`), η ετικέτα
 * ως κείμενο και το `comparable` **παράγονται** κατά την ανάγνωση — δεν γράφονται, ώστε να μην
 * μπορεί ένα έγγραφο να δηλώσει τον εαυτό του «συγκρίσιμο» χωρίς την έγκριση του §17.
 */
export interface WorkspaceMeasurementFamilyDefinition {
  readonly code: string;
  readonly labels: LocalizedText;
  readonly standardUnitCode: string;
  readonly units: readonly MeasurementUnitDefinition[];
  readonly singleUnit: boolean;
}

/** Οικογένεια της πλατφόρμας — ορίζεται σε κώδικα, ετικέτα πάντα κλειδί i18n. */
export interface PlatformMeasurementFamily extends MeasurementFamilyDefinition {
  readonly source: 'platform';
  readonly label: { readonly kind: 'i18n'; readonly key: string };
  readonly comparable: true;
}
