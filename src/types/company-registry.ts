/**
 * @fileoverview **Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΜΗΤΡΩΟΥ** — ό,τι κρατάμε από το ΓΕΜΗ, και τίποτα άλλο (ADR-841 §7 Α23).
 * @module types/company-registry
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΕΛΑΧΙΣΤΟΠΟΙΗΣΗ ΜΕ ΤΥΠΟ, ΟΧΙ ΜΕ ΥΠΟΣΧΕΣΗ (GDPR άρθ. 5(1)(γ))
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `Company` του ΓΕΜΗ Open Data (OpenAPI 2.0, κατεβασμένο ζωντανά 2026-09-14) φέρει
 * `persons` (ονόματα εταίρων και διαχειριστών), `capital`, `stocks`, `afm`, `objective`.
 * **Κανένα δεν έχει πεδίο εδώ** — ό,τι δεν έχει πεδίο δεν αποθηκεύεται, ούτε κατά λάθος
 * από κάποιον που αύριο γράφει `{ ...payload }`.
 *
 * ⚠️ **Η έδρα ΜΕΝΕΙ, και είναι το πιο ευαίσθητο πεδίο του αρχείου**: σε ατομική επιχείρηση
 * είναι συχνά η **κατοικία**. Κρατιέται επειδή ο νόμος ζητά έδρα στη βιτρίνα (ν. 4919/2022
 * άρθ. 22 §4 · Π.Δ. 131/2003 άρθ. 4)· **φεύγει δημόσια μόνο με ρητή επιλογή** του
 * επαγγελματία (GDPR άρθ. 25(2)). Γι' αυτό η συλλογή είναι `deny_all`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΕΡΩΤΗΜΑΤΑ, ΟΧΙ ΕΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * *«Τι απάντησε το ΓΕΜΗ;»* ζει **εδώ**. *«Είναι η δήλωση του γραφείου επαληθευμένη;»* **δεν**
 * αποθηκεύεται πουθενά — κρίνεται στην ανάγνωση, συγκρίνοντας το **τρέχον** προφίλ με αυτή
 * την απάντηση. Έτσι μια αλλαγή αριθμού ή επωνυμίας στο προφίλ ρίχνει το σήμα **αμέσως**,
 * χωρίς κανέναν γραφέα που πρέπει να θυμηθεί να το σβήσει.
 */

/** Η πηγή. Μία σήμερα· η ένωση ανοίγει μόνο όταν έρθει **νέα αρχή**, ποτέ «χειροκίνητη». */
export const GEMI_REGISTRY_SOURCE = 'gemi-opendata' as const;
export type RegistrySource = typeof GEMI_REGISTRY_SOURCE;

/** Κωδικός + περιγραφή, όπως τα δίνει το μητρώο (νομική μορφή · κατάσταση · δήμος). */
export interface RegistryCode {
  readonly id: string;
  readonly label: string;
}

/**
 * **Ενεργή;** — τρεις τιμές, **ποτέ boolean**.
 *
 * Το `Company.status` του ΓΕΜΗ έχει **μόνο** `id`/`descr`· το `isActive` ζει στον κατάλογο
 * `/metadata/companyStatuses`. Αν ο κατάλογος δεν διαβαστεί, η απάντηση είναι `unknown` —
 * ένα `false` θα έλεγε «διαγραμμένη» για επιχείρηση που απλώς δεν ρωτήσαμε.
 */
export type RegistryActivity = 'active' | 'inactive' | 'unknown';

export interface RegistryStatus {
  readonly code: RegistryCode | null;
  readonly activity: RegistryActivity;
}

/** Η έδρα όπως είναι γραμμένη στο μητρώο. Κάθε πεδίο μπορεί να λείπει (`autoRegistered: false`). */
export interface RegistrySeat {
  readonly street: string | null;
  readonly streetNumber: string | null;
  readonly postalCode: string | null;
  readonly city: string | null;
  readonly municipality: RegistryCode | null;
}

/** Η επιχείρηση όπως την είδε το μητρώο — **ελαχιστοποιημένη**. */
export interface RegistryCompanyRecord {
  readonly source: RegistrySource;
  /** Κανονική μορφή (`canonicalGemiNumber`) — το μητρώο τον δίνει ως ακέραιο. */
  readonly registrationNumber: string;
  /** `coNameEl` — η επωνυμία. */
  readonly legalName: string;
  readonly legalNamesLatin: readonly string[];
  /** `coTitlesEl` — **πίνακας**: μια επιχείρηση μπορεί να έχει περισσότερους από έναν τίτλους. */
  readonly distinctiveTitles: readonly string[];
  readonly distinctiveTitlesLatin: readonly string[];
  readonly legalForm: RegistryCode | null;
  readonly status: RegistryStatus;
  readonly seat: RegistrySeat;
  readonly isBranch: boolean;
  /** `autoRegistered` — `false` ⇒ το ίδιο το μητρώο δηλώνει ότι τα στοιχεία είναι **ελλιπή**. */
  readonly selfRegistered: boolean;
}

/** Μία ερώτηση προς το μητρώο και **πότε** έγινε — η ημερομηνία φαίνεται πάντα δίπλα στο σήμα. */
export interface RegistryCheck {
  readonly record: RegistryCompanyRecord;
  readonly checkedAt: string;
}

/** Γιατί **δεν** μάθαμε — κάθε λόγος οδηγεί σε διαφορετική πράξη ανθρώπου. */
export type RegistryUnavailableReason =
  /** Λείπει το `GEMI_OPENDATA_API_KEY` — θέμα διαχειριστή πλατφόρμας. */
  | 'not-configured'
  /** Το κλειδί απορρίφθηκε (401/403). */
  | 'unauthorized'
  /** 429 — ξαναδοκίμασε αργότερα. */
  | 'rate-limited'
  /** 5xx ή άλλη μη αναμενόμενη κατάσταση. */
  | 'server'
  /** Δίκτυο ή λήξη χρόνου. */
  | 'network'
  /** Απάντησε 200 με σώμα που δεν περνά τον φρουρό. */
  | 'malformed-response';

/**
 * Τι έμαθε πραγματικά η ερώτηση — **«δεν υπάρχει» ΔΕΝ είναι «δεν μπόρεσα να ρωτήσω»**
 * (ίδιο δόγμα με το `GeocodeVerdict`).
 */
export type RegistryLookupVerdict =
  | { readonly kind: 'found'; readonly record: RegistryCompanyRecord }
  /** Ρωτήθηκε καθαρά και **δεν υπάρχει** τέτοιος αριθμός. */
  | { readonly kind: 'absent' }
  /** Δεν ρωτήθηκε καν: ο αριθμός δεν είναι αριθμός ΓΕΜΗ. */
  | { readonly kind: 'invalid-number' }
  | { readonly kind: 'unavailable'; readonly reason: RegistryUnavailableReason };
