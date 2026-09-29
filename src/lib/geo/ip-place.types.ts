/**
 * @fileoverview **«Από πού, περίπου, ήρθε ένα αίτημα;»** — το σχήμα της απάντησης, κοινό για server και client.
 * @related `ip-geolocation.ts` (ο ΜΟΝΟΣ που την παράγει, μόνο server) · `services/session/session.types.ts`
 *   (την αποθηκεύει) · ADR-894
 * @module lib/geo/ip-place.types
 *
 * 🔑 **Κωδικοί, όχι ονόματα.** Αποθηκεύεται ο κωδικός ISO-3166-1 της χώρας· το **όνομα** αποδίδεται στην
 * οθόνη με `Intl.DisplayNames` στη γλώσσα του αναγνώστη. Ένα αποθηκευμένο «Ελλάδα» διαβάζεται λάθος από
 * κάθε αγγλόφωνο — ακριβώς ό,τι έκανε το `ipapi.co` που αντικαταστάθηκε.
 *
 * 🔑 **Η ακρίβεια λέγεται, δεν εννοείται.** Το `precision` δηλώνει τι **ξέρουμε** (πόλη · μόνο χώρα · τίποτα)
 * και το `basis` **γιατί**. Μια ιδιωτική διεύθυνση (localhost, CGNAT) δεν έχει τοποθεσία — δεν παίρνει
 * «Ελλάδα» ως εφεδρεία.
 *
 * ⚠️ Χωρίς `server-only`, επίτηδες: ο client διαβάζει το σχήμα για να το αποδώσει.
 */

/** Τι ξέρουμε: πόλη, μόνο χώρα, ή τίποτα. */
export type IpPlacePrecision = 'city' | 'country' | 'none';

/**
 * Γιατί η απάντηση είναι αυτή που είναι.
 * - `geoip`: βρέθηκε στη βάση.
 * - `no-match`: η βάση απάντησε, αλλά δεν γνωρίζει τη διεύθυνση.
 * - `non-public-address`: ιδιωτική / δεσμευμένη διεύθυνση (localhost, 10/8, CGNAT, ULA…) — δεν έχει τοποθεσία.
 * - `no-address`: το αίτημα δεν έφερε διεύθυνση πελάτη.
 * - `database-unavailable`: η βάση λείπει ή δεν ανοίγει — υποβάθμιση, **ποτέ** σφάλμα.
 * - `legacy`: εγγραφή **πριν** από το ADR-894, με τοποθεσία που έγραψε ο browser (`ipapi.co`, πλαστογραφήσιμη,
 *   με σκληρή εφεδρεία «GR») — **δεν** εμφανίζεται ως γνώση. Μόνο ανάγνωση· ο server δεν την παράγει ποτέ.
 */
export type IpPlaceBasis =
  | 'geoip'
  | 'no-match'
  | 'non-public-address'
  | 'no-address'
  | 'database-unavailable'
  | 'legacy';

/** **Ποια** βάση απάντησε — από τα μεταδεδομένα του ίδιου του αρχείου, άρα αποδείξιμη. */
export interface GeoIpSource {
  /** `databaseType` του MMDB (π.χ. `DBIP-City-Lite`). */
  readonly database: string;
  /** Μήνας έκδοσης, `YYYY-MM`, από το `buildEpoch` του MMDB. */
  readonly edition: string;
}

export interface IpPlace {
  /** ISO-3166-1 alpha-2, κεφαλαία· `null` όταν δεν ξέρουμε. */
  readonly countryCode: string | null;
  /** Όνομα πόλης όπως το δίνει η πηγή (αγγλικά)· `null` όταν δεν ξέρουμε. */
  readonly city: string | null;
  /** Περιφέρεια / πολιτεία όπως τη δίνει η πηγή· `null` όταν δεν ξέρουμε. */
  readonly region: string | null;
  readonly precision: IpPlacePrecision;
  readonly basis: IpPlaceBasis;
  /** `null` όταν δεν ρωτήθηκε καμία βάση. */
  readonly source: GeoIpSource | null;
}
