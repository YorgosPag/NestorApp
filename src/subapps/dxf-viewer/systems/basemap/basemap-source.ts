/**
 * SSoT των **παρόχων υποβάθρου**: ποιος μας δίνει πλακίδια, με ποιους όρους, και τι οφείλουμε
 * να δείχνουμε ως απόδοση.
 *
 * ## Γιατί ο πάροχος είναι ΔΗΛΩΣΗ και όχι κώδικας
 * Η αλλαγή παρόχου είναι **βέβαιη**, όχι πιθανή: το `tile.openstreetmap.org` είναι εθελοντική
 * υποδομή χωρίς SLA, και η πολιτική του OSMF δηλώνει ότι για εμπορικές υπηρεσίες η πρόσβαση
 * *«may be withdrawn at any point»*. Οι μεγάλοι το ξέρουν και πληρώνουν: το `GEOMAP` της
 * AutoCAD τραβά Bing, ο ArchiCAD δείχνει Google. Αν ο πάροχος ήταν σκορπισμένος σε URL μέσα
 * στον ζωγράφο, η μέρα της αλλαγής θα ήταν μέρα ξαναγραψίματος — γι' αυτό ζει εδώ, ως πίνακας.
 *
 * ## ⚠️ Η πολιτική είναι ΠΕΔΙΟ, όχι σχόλιο
 * Το `maxPrefetchRing: 0` του OSM **δεν** είναι τεκμηρίωση: το διαβάζει ο προγραμματιστής
 * αιτημάτων. Η πολιτική του OSMF απαγορεύει ρητά *«any pre-emptive fetching of tiles other than
 * those a user is actively viewing»*, και μια απαγόρευση γραμμένη σε σχόλιο είναι απαγόρευση που
 * ο επόμενος θα παραβιάσει καλόπιστα προσθέτοντας «λίγο prefetch για ομαλότητα». Ως πεδίο, η
 * παραβίαση απαιτεί να **αλλάξει ο πίνακας** — δηλαδή να το δει άνθρωπος.
 *
 * @see https://operations.osmfoundation.org/policies/tiles/ — η πολιτική που κωδικοποιείται εδώ
 */

/** Τα αναγνωριστικά των παρόχων. Κλειστό σύνολο — νέος πάροχος = νέα γραμμή στον πίνακα. */
export type BasemapSourceId = 'osm-standard';

/** Τι είδους περιεχόμενο δείχνει ένας πάροχος — ο χρήστης επιλέγει με βάση αυτό. */
export type BasemapImageryKind = 'street' | 'aerial' | 'topographic';

export interface BasemapSource {
  readonly id: BasemapSourceId;
  /** Κλειδί i18n του ονόματος που βλέπει ο χρήστης (ποτέ κυριολεκτικό κείμενο — N.11). */
  readonly labelKey: string;
  readonly kind: BasemapImageryKind;
  /** Πρότυπο URL με `{z}` `{x}` `{y}`. */
  readonly urlTemplate: string;
  /** Πλευρά πλακιδίου σε εικονοστοιχεία (256 στους σχεδόν όλους raster παρόχους). */
  readonly tileSizePx: number;
  /** Το βαθύτερο επίπεδο που σερβίρει ο πάροχος. Αίτημα πέραν αυτού είναι βέβαιο 404. */
  readonly maxZoom: number;
  /**
   * Κείμενο απόδοσης, **υποχρεωτικό** και μη μεταφράσιμο: είναι νομικός όρος χρήσης και εμπορικό
   * σήμα του παρόχου, όχι μήνυμα διεπαφής. Γι' αυτό δεν περνά από `t()`.
   */
  readonly attribution: string;
  /**
   * Πόσους δακτυλίους πλακιδίων **γύρω** από το ορατό επιτρέπεται να ζητήσουμε προληπτικά.
   * `0` = μόνο ό,τι βλέπει ο χρήστης αυτή τη στιγμή.
   */
  readonly maxPrefetchRing: number;
  /** `true` όταν ο πάροχος δίνει επίσημη εγγύηση διαθεσιμότητας. */
  readonly hasServiceLevelAgreement: boolean;
}

/**
 * Ο πίνακας των παρόχων.
 *
 * 🔶 **Σήμερα υπάρχει ένας — και αυτό είναι δηλωμένο όριο, όχι παράλειψη.** Ο δωρεάν δημόσιος
 * χάρτης δεν έχει καθόλου αεροφωτογραφία, οπότε ο έλεγχος «κάθεται το τοπογραφικό πάνω στο
 * πραγματικό οικόπεδο;» γίνεται σήμερα πάνω σε **σχέδιο δρόμων**, όχι σε φωτογραφία. Ο τύπος
 * {@link BasemapImageryKind} υπάρχει ήδη ώστε ένας πάροχος με `kind: 'aerial'` να μπαίνει ως
 * **γραμμή**, χωρίς να αγγιχτεί ζωγράφος, προβολή ή διεπαφή.
 */
export const BASEMAP_SOURCES: Readonly<Record<BasemapSourceId, BasemapSource>> = {
  'osm-standard': {
    id: 'osm-standard',
    labelKey: 'basemap.sources.osmStandard',
    kind: 'street',
    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSizePx: 256,
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors',
    // Η πολιτική του OSMF απαγορεύει ΚΑΘΕ προληπτικό αίτημα. Δες την επικεφαλίδα.
    maxPrefetchRing: 0,
    hasServiceLevelAgreement: false,
  },
};

/** Ο προεπιλεγμένος πάροχος όταν ο χρήστης δεν έχει επιλέξει. */
export const DEFAULT_BASEMAP_SOURCE_ID: BasemapSourceId = 'osm-standard';

/** Ο πάροχος με αυτό το αναγνωριστικό. Άγνωστο αναγνωριστικό ⇒ ο προεπιλεγμένος. */
export function resolveBasemapSource(id: BasemapSourceId | null | undefined): BasemapSource {
  return BASEMAP_SOURCES[id ?? DEFAULT_BASEMAP_SOURCE_ID] ?? BASEMAP_SOURCES[DEFAULT_BASEMAP_SOURCE_ID];
}

/** Το URL ενός συγκεκριμένου πλακιδίου από αυτόν τον πάροχο. */
export function tileUrl(source: BasemapSource, z: number, x: number, y: number): string {
  return source.urlTemplate
    .replace('{z}', String(z))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
}
