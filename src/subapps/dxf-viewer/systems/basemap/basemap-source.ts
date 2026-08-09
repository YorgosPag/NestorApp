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
 * ## ⚠️ Η απόδοση είναι ΥΠΟΧΡΕΩΣΗ, όχι διακόσμηση
 * Η οδηγία απόδοσης του OSMF απαιτεί η μνεία να είναι *«legible and understandable, taking into
 * consideration the font, size, colour, **contrast**, positioning and amount of time that it is
 * visible»*. Δηλαδή η ίδια η άδεια ζητά ακριβώς αυτό που φρουρούν οι πύλες 3.38-3.43 αυτού του
 * αποθετηρίου: αναγνωσιμότητα, όχι ύπαρξη. Ένα σβηστό γκρι πάνω σε φωτεινό πλακίδιο **δεν**
 * συμμορφώνεται, όσο κι αν το κείμενο υπάρχει στο DOM.
 *
 * @see https://operations.osmfoundation.org/policies/tiles/ — η πολιτική πλακιδίων
 * @see https://osmfoundation.org/wiki/Licence/Attribution_Guidelines — η οδηγία απόδοσης
 */

/** Τα αναγνωριστικά των παρόχων. Κλειστό σύνολο — νέος πάροχος = νέα γραμμή στον πίνακα. */
export type BasemapSourceId = 'osm-standard';

/** Τι είδους περιεχόμενο δείχνει ένας πάροχος — ο χρήστης επιλέγει με βάση αυτό. */
export type BasemapImageryKind = 'street' | 'aerial' | 'topographic';

/**
 * Ένα κομμάτι της απόδοσης: κείμενο, και **προαιρετικά** ο σύνδεσμος που του αναλογεί.
 *
 * ## Γιατί κομμάτια και όχι μία συμβολοσειρά
 * Η οδηγία απόδοσης του OSMF δεν ζητά «ένα κείμενο κάπου»· ζητά η **λέξη** `OpenStreetMap` να
 * είναι σύνδεσμος προς `openstreetmap.org/copyright`, γιατί εκεί ζει η άδεια (ODbL) και οι πηγές
 * των δεδομένων. Με μία συμβολοσειρά, ο ζωγράφος θα έπρεπε να **μαντέψει** ποιο υποσύνολο του
 * κειμένου γίνεται σύνδεσμος — δηλαδή να ξαναγράψει την πολιτική του παρόχου σε regex.
 *
 * Και δεν είναι υποθετικό: μέσα σε αυτό το αποθετήριο υπάρχει ήδη πάροχος με **τρεις** δικαιούχους
 * σε μία γραμμή (`© Stadia Maps, Stamen Design, OpenMapTiles © OpenStreetMap contributors`, δες
 * `subapps/geo-canvas/services/map/MapStyleManager.ts`). Καθένας τους δικαιούται **δικό του**
 * σύνδεσμο. Ως πίνακας κομματιών, ο δεύτερος πάροχος είναι γραμμή· ως συμβολοσειρά, είναι parser.
 */
export interface BasemapAttributionSegment {
  readonly text: string;
  /** Όταν υπάρχει, το `text` αποδίδεται ως σύνδεσμος προς αυτή τη διεύθυνση. */
  readonly href?: string;
}

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
   * Η απόδοση, **υποχρεωτική** και μη μεταφράσιμη: είναι νομικός όρος χρήσης και εμπορικό σήμα
   * του παρόχου, όχι μήνυμα διεπαφής. Γι' αυτό δεν περνά από `t()`.
   *
   * ⚠️ Κενός πίνακας **δεν** σημαίνει «δεν χρειάζεται απόδοση» — σημαίνει «κανείς δεν την έγραψε».
   * Ο τύπος δεν μπορεί να το απαγορεύσει· η άγκυρα `Α1` το κάνει, για **κάθε** γραμμή του πίνακα.
   */
  readonly attribution: readonly BasemapAttributionSegment[];
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
    // Η οδηγία του OSMF δέχεται ρητά την ιστορική μορφή «© OpenStreetMap contributors» και ζητά
    // η λέξη «OpenStreetMap» να είναι σύνδεσμος προς τη σελίδα πνευματικών δικαιωμάτων.
    attribution: [
      { text: '© ' },
      { text: 'OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' },
      { text: ' contributors' },
    ],
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
