/**
 * 🏢 ENTERPRISE FIRESTORE COLLECTIONS CONFIGURATION
 *
 * Single source of truth για όλα τα Firestore collection names
 * Configurable μέσω environment variables για multi-tenant deployments
 *
 * @module config/firestore-collections
 */

// ============================================================================
// CORE COLLECTIONS
// ============================================================================

/**
 * Core business entity collections
 */
export const COLLECTIONS = {
  // 📞 CONTACTS & COMPANIES
  CONTACTS: process.env.NEXT_PUBLIC_CONTACTS_COLLECTION || 'contacts',
  COMPANIES: process.env.NEXT_PUBLIC_COMPANIES_COLLECTION || 'companies', // Legacy collection

  // 🏢 PROJECTS & PROPERTIES
  PROJECTS: process.env.NEXT_PUBLIC_PROJECTS_COLLECTION || 'projects',
  BUILDINGS: process.env.NEXT_PUBLIC_BUILDINGS_COLLECTION || 'buildings',
  PROPERTIES: process.env.NEXT_PUBLIC_PROPERTIES_COLLECTION || 'properties',

  /**
   * 🌍 ADR-777 Α1 — Η **ΓΗ**: το μόνο πράγμα που κρατά θέση. IDs `land_*`.
   *
   * 🔴 **ΚΟΙΝΟ ΕΠΙΠΕΔΟ Α — χωρίς `companyId`.** Δηλωμένο ρητά ως `public-world` στο
   * `services/firestore/tenant-config.ts` (SPEC-777A §13.1/§14.4· CHECK 3.35). Ο πελάτης
   * **διαβάζει**· γράφει **μόνο ο διακομιστής**, μετά από επαλήθευση πηγής.
   */
  PUBLIC_LANDS: process.env.NEXT_PUBLIC_PUBLIC_LANDS_COLLECTION || 'public_lands',

  /**
   * 🌍 ADR-777 Α11 — «Το κτίριο του κόσμου». IDs `pbld_*`.
   *
   * ⚠️ **ΔΕΝ είναι το `BUILDINGS`** παραπάνω: εκείνο είναι το εμπορικό κτίριο μέσα σε έργο
   * ενός πελάτη (`projectId` + `companyId`, επίπεδο Β). Αυτό είναι το **φυσικό γεγονός**,
   * κοινό σε όλους — και η ύπαρξη **μίας** ταυτότητας ανά φυσικό κτίριο είναι ακριβώς αυτό
   * που κάνει δυνατή τη συνάντηση προσφοράς και ζήτησης (SPEC-777A §14.5).
   */
  PUBLIC_BUILDINGS: process.env.NEXT_PUBLIC_PUBLIC_BUILDINGS_COLLECTION || 'public_buildings',

  /**
   * 🌍 ADR-777 Α3/Α5/Α20 — **Η ΠΡΟΒΟΛΗ ΑΝΑΓΝΩΣΗΣ της αγγελίας.** IDs = **το ίδιο το
   * `propertyId`** (σχέση 1:1, ταυτότητα καθρεφτισμένη — **καμία νέα γεννήτρια**, N.6).
   *
   * 🔴 **ΔΕΝ είναι το `PROPERTIES`, και η διαφορά είναι ασφάλεια, όχι ταξινόμηση.**
   * Το Firestore δεν έχει έλεγχο ανάγνωσης **σε επίπεδο πεδίου** — «*you either
   * retrieve the full document, or nothing*» (τεκμηρίωση Google). Άρα το δημόσιο σκέλος
   * πάνω στο `properties` έδινε στον ανώνυμο επισκέπτη **ολόκληρο** το έγγραφο:
   * `companyId` · `createdBy` · `_lastModifiedByName` (**ονοματεπώνυμο**) · `projectId`.
   * Το σχόλιο δίπλα του έγραφε «*no companyId leak*» — εγγύηση **χωρίς μηχανισμό**.
   *
   * Εδώ η διαρροή είναι **δομικά αδύνατη**: το σχήμα (`types/public-listing.ts`) είναι
   * κλειστό και δεν περιέχει καμία ταυτότητα πελάτη. Γράφει **μόνο ο διακομιστής**·
   * δηλωμένη `public-world` στο `services/firestore/tenant-config.ts` (CHECK 3.35).
   */
  PUBLIC_LISTINGS: process.env.NEXT_PUBLIC_PUBLIC_LISTINGS_COLLECTION || 'public_listings',

  /**
   * 🎯 ADR-777 Α9 — **Η ΖΗΤΗΣΗ** ως οντότητα πρώτης τάξεως. IDs `dmnd_*`.
   *
   * 🔴 **ΕΠΙΠΕΔΟ Β, ΟΧΙ ΔΗΜΟΣΙΑ** (SPEC-777A §14.2, που ονομάζει ρητά τις *«ζητήσεις»*
   * στο ιδιωτικό επίπεδο). Είναι η **μόνη** από τις τέσσερις συλλογές του ADR-777 που
   * **δεν** διαβάζεται από τον κόσμο: `mode: 'userId'` στο `tenant-config.ts`, γιατί
   * μια ζήτηση ανήκει σε **άνθρωπο** — όχι σε εταιρεία, όχι σε κανέναν.
   *
   * Ό,τι φτάνει σε τρίτους είναι το **επίπεδο Γ**: το ανώνυμο άθροισμα, που
   * **παράγεται** (`lib/demand/demand-aggregate.ts`) και **δεν αποθηκεύεται εδώ**.
   *
   * ⚠️ **ΔΕΝ είναι το `LEADS` ούτε το `OPPORTUNITIES`.** Εκείνα είναι CRM ενός
   * πωλητή — «πιθανός **πελάτης**», με στάδια χοάνης και εμβέλεια εταιρείας. Αυτό
   * είναι δήλωση προσώπου για **ακίνητο**, ζει ανεξάρτητα από το αν κάποιος την
   * κυνηγά, και ταιριάζεται από **μηχανή**, όχι από πωλητή.
   */
  PROPERTY_DEMANDS: process.env.NEXT_PUBLIC_PROPERTY_DEMANDS_COLLECTION || 'property_demands',

  /**
   * 🎯 ADR-777 Α14 — **Η ΠΡΟΣΦΟΡΑ ΤΟΥ ΙΔΙΩΤΗ**: το ακίνητο όπως το δηλώνει ο ίδιος ο
   * κάτοχός του. IDs `ownp_*`.
   *
   * 🔴 **ΕΠΙΠΕΔΟ Β, ΙΔΙΩΤΙΚΟ ΑΝΑ ΑΝΘΡΩΠΟ** — `mode: 'userId'` (`authorUserId`) στο
   * `tenant-config.ts`, το **ίδιο** σχήμα με το `PROPERTY_DEMANDS`. Το SPEC-777A
   * §14.2 ορίζει το επίπεδο Β ως *«αυστηρά ιδιωτικό ανά **εταιρεία/χρήστη**»*: οι
   * δύο λέξεις είναι οι δύο τιμές του `TenantIsolationMode`, και ο ιδιώτης είναι η
   * δεύτερη.
   *
   * ⚠️ **ΔΕΝ είναι το `PROPERTIES`, και δεν μπορεί να γίνει.** Μετρημένο πριν γραφτεί
   * γραμμή: το `assertPropertyCreatePolicy` απαιτεί `projectId` **πάντα** και το
   * `assertUpstreamChainExists` απαιτεί **Project → Company** να υπάρχουν (ADR-284
   * §3.1) ⇒ ένα διαμέρισμα ιδιώτη θα χρειαζόταν **τέσσερα** συνθετικά έγγραφα· και ο
   * κανόνας `read` του `properties` περνά από αναζήτηση έργου→εταιρείας, οπότε
   * έγγραφο χωρίς έργο θα ήταν αναγνώσιμο **από κανέναν**. Πλήρης ανάλυση των τριών
   * δρόμων: `types/owner-property.ts`.
   *
   * 🔑 **Και ΔΕΝ είναι διπλότυπο**: και οι δύο συλλογές τροφοδοτούν την **ίδια**
   * μηχανή προβολής (`buildPublicListing`), που δέχεται **δομικό** τύπο ακριβώς για
   * να έχει πολλές πηγές και **μία** έξοδο — το `public_listings`.
   */
  OWNER_PROPERTIES: process.env.NEXT_PUBLIC_OWNER_PROPERTIES_COLLECTION || 'owner_properties',

  /**
   * 🗂️ ADR-866 Ε-1 · Φ1.1 — **Ο ΦΑΚΕΛΟΣ ΤΟΥ ΑΚΙΝΗΤΟΥ** (`pdos_*`): ό,τι αφορά το σπίτι, πέρα από
   * κάθε αγγελία. Κάτοχος = `userId` (μέλος της `CustodyScope`, όπως το `FILES_PERSONAL`) —
   * **όχι** `authorUserId`, γιατί ο φάκελος **αλλάζει χέρια** (Φ4) ενώ ο συγγραφέας όχι.
   * Γράφει **μόνο** ο διακομιστής (`property-dossier-write.service.ts`).
   */
  PROPERTY_DOSSIERS: process.env.NEXT_PUBLIC_PROPERTY_DOSSIERS_COLLECTION || 'property_dossiers',

  /**
   * 🎯 ADR-835 §20 (Στάδιο Α) — **Η ΚΕΦΑΛΗ ΤΟΥ ΗΜΕΡΟΛΟΓΙΟΥ ΚΑΤΑΛΥΜΑΤΟΣ**. Κλειδί: το
   * `propertyId`. «Δηλώθηκε;» + το `version` που σειριοποιεί κάθε εγγραφή (phantom insert).
   * Γράφει μόνο ο διακομιστής· διαβάζει ο συντάκτης της αγγελίας.
   */
  STAY_CALENDARS: process.env.NEXT_PUBLIC_STAY_CALENDARS_COLLECTION || 'stay_calendars',
  /** 🎯 ADR-835 §20 — **ΚΛΕΙΣΜΕΝΕΣ ΝΥΧΤΕΣ** (`sblk_*`), χωρίς επισκέπτη. Ίδιο σύνορο με την κεφαλή. */
  STAY_BLOCKS: process.env.NEXT_PUBLIC_STAY_BLOCKS_COLLECTION || 'stay_blocks',
  /** 🎯 ADR-835 §6.1/§20 — **ΚΡΑΤΗΣΕΙΣ** (`stay_*`). Κουβαλούν άνθρωπο· ίδιο σύνορο με την κεφαλή. */
  STAY_BOOKINGS: process.env.NEXT_PUBLIC_STAY_BOOKINGS_COLLECTION || 'stay_bookings',
  /**
   * 🎯 ADR-835 §23 (Στάδιο Δ) — **Η ΚΕΦΑΛΗ ΤΟΥ ΕΠΙΣΚΕΠΤΗ**. Κλειδί: το `uid`. Τα **ζωντανά**
   * αιτήματά του, για το όριο ενεργών αιτημάτων — γράφεται **στην ίδια συναλλαγή** με την κράτηση,
   * ώστε δύο παράλληλα αιτήματα να μη περνούν και τα δύο το όριο (κάτοπτρο της κεφαλής ακινήτου).
   * 🔴 **Αδιάβαστη από τον πελάτη**: είναι μηχανισμός σειριοποίησης, όχι προβολή.
   */
  STAY_GUESTS: process.env.NEXT_PUBLIC_STAY_GUESTS_COLLECTION || 'stay_guests',
  /**
   * 🎯 ADR-835 §21 (Στάδιο Β) — **ΚΑΝΟΝΕΣ ΑΝΑ ΗΜΕΡΟΜΗΝΙΑ** (`scmo_*`), ένα έγγραφο ανά
   * (ακίνητο, μήνας): τιμή νύχτας, ελάχ./μέγ. νύχτες, CTA/CTD. Ίδιο σύνορο με την κεφαλή.
   */
  STAY_CALENDAR_MONTHS: process.env.NEXT_PUBLIC_STAY_CALENDAR_MONTHS_COLLECTION || 'stay_calendar_months',
  /**
   * 🎯 ADR-835 §22 (Στάδιο Γ) — **ΤΑ ΚΑΝΑΛΙΑ ΕΝΟΣ ΚΑΤΑΛΥΜΑΤΟΣ**. Κλειδί: το `propertyId`.
   * Οι πηγές iCal (URL + κατάσταση) και η **γενιά** του μυστικού συνδέσμου εξαγωγής.
   *
   * 🔴 **ΑΔΙΑΒΑΣΤΗ ΑΠΟ ΤΟΝ ΠΕΛΑΤΗ — μόνη στην οικογένεια του ημερολογίου.** Το URL ενός
   * feed **ΕΙΝΑΙ διαπιστευτήριο**: ο σύνδεσμος `.ics` της Airbnb δίνει σε όποιον τον έχει
   * ολόκληρο το ημερολόγιο του οικοδεσπότη εκεί. Η οθόνη βλέπει **προβολή** από τον
   * διακομιστή (host + κατάσταση), ποτέ το έγγραφο.
   */
  STAY_CHANNELS: process.env.NEXT_PUBLIC_STAY_CHANNELS_COLLECTION || 'stay_channels',

  /**
   * 🎯 ADR-827 §9 — **Η ΒΙΤΡΙΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ**. Κλειδί εγγράφου: το `companyId`.
   *
   * 🔴 **Η ΜΟΝΗ συλλογή που ο πελάτης επιτρέπεται να ΣΑΡΩΣΕΙ και περιέχει
   * ΟΡΓΑΝΙΣΜΟΥΣ** — και επιτρέπεται για έναν ακριβώς λόγο: **ο πληθυσμός της είναι
   * opt-in**. Κανένα γραφείο δεν είναι μέσα αν δεν έγραψε **το ίδιο** τον εαυτό του,
   * με πράξη **ανακλητή** *(απόσυρση = διαγραφή του εγγράφου)*.
   *
   * ⚠️ **Η αντίθεση με το `WORKSPACE_ALIASES` είναι ΟΛΟ το επιχείρημα**: εκεί κάθε
   * χώρος έχει εγγραφή **υποχρεωτικά** *(το ψευδώνυμο ΕΙΝΑΙ η διεύθυνσή του)*, άρα η
   * σάρωση είναι **απογραφή μισθωτών** — που απαγορεύει το **ADR-787 Ε-5 §4 #1**. Εδώ
   * η σάρωση είναι **ανάγνωση αφισών**.
   *
   * 🔑 Ο φρουρός: **η απουσία από την προβολή είναι αδιάκριτη από την ανυπαρξία**.
   * Γραφείο που δεν δημοσιεύτηκε απαντά ταυτόσημα με ψευδώνυμο που δεν υπήρξε ποτέ.
   *
   * ⛔ **ΚΑΜΙΑ αμοιβή, ΚΑΜΙΑ κατάταξη/βαθμολογία, ΚΑΝΕΝΑ όνομα φυσικού προσώπου** — δες
   * `types/agency-profile.ts`. Γράφει μόνο ο διακομιστής.
   *
   * 🔴 **ΚΑΝΕΝΑΣ αριθμός τηλεφώνου/email ΕΔΩ** (ADR-841 §7 Α21.16): τα κανάλια επιτρέπονται
   * πλέον, αλλά αυτή η συλλογή κατεβαίνει **ολόκληρη** σε κάθε ανώνυμο — ζουν στο
   * {@link COLLECTIONS.SHOWCASE_CARD_CHANNELS}.
   */
  AGENCY_PROFILES: process.env.NEXT_PUBLIC_AGENCY_PROFILES_COLLECTION || 'agency_profiles',

  /**
   * 🏆 ADR-841 §7 Α21.12 — **ΠΟΥ ΒΡΙΣΚΕΤΑΙ ΤΟ ΠΡΩΤΟΤΥΠΟ ΤΟΥ ΣΗΜΑΤΟΣ**. Κλειδί: `companyId`.
   *
   * ────────────────────────────────────────────────────────────────────────
   * 🔴 ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΗ ΣΥΛΛΟΓΗ ΚΑΙ ΟΧΙ ΥΠΟΣΥΛΛΟΓΗ ΤΟΥ `agency_profiles`
   * ────────────────────────────────────────────────────────────────────────
   *
   * Το `agency_profiles` έχει **`allow read: if true`** — το διαβάζει **ανώνυμος**. Μια
   * υποσυλλογή `agency_profiles/{id}/private/…` θα ήταν **σήμερα** ασφαλής, επειδή ο
   * κανόνας γράφει `match /agency_profiles/{companyId}` **χωρίς** `{document=**}`.
   *
   * ⚠️ **Και ακριβώς γι' αυτό απορρίφθηκε.** Η ασφάλεια θα στηριζόταν στην **απουσία**
   * ενός wildcard — και η πιο συνηθισμένη «διόρθωση» που κάνει ο επόμενος όταν κάτι δεν
   * διαβάζεται είναι να γράψει `match /agency_profiles/{companyId}/{document=**}`. Τότε
   * η ιδιωτική διαδρομή αποθήκευσης γίνεται **δημόσια, σιωπηλά**, με μία γραμμή που
   * μοιάζει αθώα.
   *
   * ✅ Σε **ξεχωριστή ρίζα** καμία αλλαγή στον κανόνα των προφίλ δεν μπορεί να την
   * εκθέσει. Η εγγύηση γίνεται **δομική** αντί για διαδικαστική — το ίδιο σκεπτικό με
   * τους δύο **αντίθετους** φρουρούς ταυτότητας του `public-shelf-kinds`.
   *
   * 🔴 **`deny_all` ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ**: το έγγραφο κρατά μονοπάτι **ιδιωτικού** κάδου,
   * δηλαδή ακριβώς ό,τι το `showcase-mark-custody` δηλώνει ότι *«δεν επιστρέφει ποτέ»*
   * στο σύρμα. Ανάγνωση από πελάτη θα ανέτρεπε την ίδια απόφαση από την πίσω πόρτα.
   */
  SHOWCASE_MARK_SOURCES:
    process.env.NEXT_PUBLIC_SHOWCASE_MARK_SOURCES_COLLECTION || 'showcase_mark_sources',

  /**
   * 🏆 ADR-841 §7 Α21.16 — **ΤΑ ΚΑΝΑΛΙΑ ΤΗΣ ΚΑΡΤΑΣ** (τηλέφωνα · email ανά κατάστημα). Κλειδί: `companyId`.
   *
   * 🔴 **ΓΙΑΤΙ ΟΧΙ ΜΕΣΑ ΣΤΟ `agency_profiles`**: εκείνο είναι `read: if true` **και** ο
   * κατάλογος το κατεβάζει **ολόκληρο** σε κάθε ανώνυμο (`usePublicAgencies`). Ένας αριθμός
   * εκεί = **όλα τα τηλέφωνα όλων με μία κλήση SDK** — η απόκρυψη στο HTML δεν θα έσωζε
   * τίποτα. Εδώ τα σερβίρει **μόνο** ο διακομιστής, ένα κατάστημα τη φορά, με όριο `HEAVY`.
   *
   * ⚠️ **Ξεχωριστή ρίζα, όχι υποσυλλογή** — ίδιο σκεπτικό με το `SHOWCASE_MARK_SOURCES`
   * ακριβώς από πάνω. `deny_all` και στις δύο πλευρές· ούτε ο ιδιοκτήτης διαβάζει απευθείας
   * (το `GET /api/agency-profile/card` του τα δίνει).
   */
  SHOWCASE_CARD_CHANNELS:
    process.env.NEXT_PUBLIC_SHOWCASE_CARD_CHANNELS_COLLECTION || 'showcase_card_channels',

  /**
   * 🏆 ADR-841 §7 Α21.18 — **ΤΑ ΑΙΤΗΜΑΤΑ ΕΠΙΒΕΒΑΙΩΣΗΣ EMAIL ΤΗΣ ΚΑΡΤΑΣ**. Κλειδί: `secf_*`.
   *
   * 🔑 **Εφήμερο αίτημα, ΟΧΙ η απόδειξη**: η απόδειξη είναι ημερομηνία πάνω στο ίδιο το κανάλι
   * ({@link COLLECTIONS.SHOWCASE_CARD_CHANNELS}) και στο δημόσιο κατάστημα. Εδώ ζει μόνο «σε ποια
   * διεύθυνση στείλαμε ποιον σύνδεσμο, και τι έγινε».
   *
   * 🔴 **`deny_all` και στις δύο πλευρές**: το έγγραφο κρατά **διεύθυνση email** και το `nonce` του
   * συνδέσμου. Ανάγνωση από πελάτη = τα email της κάρτας χωρίς όριο ρυθμού.
   */
  SHOWCASE_EMAIL_CONFIRMATIONS:
    process.env.NEXT_PUBLIC_SHOWCASE_EMAIL_CONFIRMATIONS_COLLECTION || 'showcase_email_confirmations',

  /**
   * 🏆 ADR-841 §7 Α21.21 Φάση Β — **ΟΙ ΕΡΩΤΗΣΕΙΣ «ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;»**. Μία ανά (γραφείο,
   * εορταστική περίοδος), κλειδί `hhq_*` ντετερμινιστικό. Η αλήθεια (οι ειδικές μέρες) ζει στην **κάρτα**·
   * εδώ μόνο «ρωτήσαμε, πότε, τι απάντησε».
   *
   * 🔴 **`deny_all` και στις δύο πλευρές**: κρατά το `nonce` των συνδέσμων. Γραφή από πελάτη = απάντηση
   * χωρίς σύνδεσμο· ανάγνωση = σύνδεσμοι χωρίς όριο ρυθμού.
   */
  HOLIDAY_HOURS_QUESTIONS:
    process.env.NEXT_PUBLIC_HOLIDAY_HOURS_QUESTIONS_COLLECTION || 'holiday_hours_questions',

  /**
   * 🏆 ADR-841 §7 Α21.20 — **ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΣΥΜΒΑΝΤΩΝ ΠΑΡΑΔΟΣΗΣ** (delivered · failed · deferred ·
   * complained). Κλειδί: `edev_<πάροχος>_<sha256 ταυτότητας συμβάντος>` — ο πάροχος ξαναστέλνει για
   * ώρες, και το ντετερμινιστικό κλειδί κάνει την επανάληψη **ακίνδυνη**.
   *
   * 🔴 **`deny_all`**: κρατά διευθύνσεις παραληπτών **όλης** της πλατφόρμας. Αναλλοίωτο — γράφεται μία φορά.
   */
  EMAIL_DELIVERY_EVENTS:
    process.env.NEXT_PUBLIC_EMAIL_DELIVERY_EVENTS_COLLECTION || 'email_delivery_events',

  /**
   * 🏆 ADR-841 §7 Α21.20 — **ΖΕΙ ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ;** Προβολή του ημερολογίου ανά διεύθυνση.
   * Κλειδί: `erst_<sha256 κανονικοποιημένης διεύθυνσης>`.
   *
   * 🔑 **Ανά διεύθυνση, όχι ανά μισθωτή**: η ύπαρξη ενός γραμματοκιβωτίου είναι γεγονός του κόσμου —
   * ίδια απάντηση για κάθε γραφείο που το δημοσιεύει. `deny_all`.
   */
  EMAIL_RECIPIENT_STANDING:
    process.env.NEXT_PUBLIC_EMAIL_RECIPIENT_STANDING_COLLECTION || 'email_recipient_standing',

  /**
   * 🏆 ADR-841 §7 Α23 — **ΤΙ ΑΠΑΝΤΗΣΕ ΤΟ ΓΕΜΗ**. Κλειδί: `companyId`.
   *
   * 🔴 **ΓΙΑΤΙ ΟΧΙ ΣΤΟ `accounting_settings/{companyId}`** (το προφίλ του οργανισμού, ADR-439):
   * εκείνο είναι η **δήλωση** και το γράφει ο **πελάτης** (company admin). Η απάντηση της **αρχής**
   * εκεί θα ήταν αυτο-επαλήθευση — ένα `setDoc` και η βιτρίνα θα έγραφε «επαληθευμένη από ΓΕΜΗ».
   *
   * 🔴 **`deny_all` και στις δύο πλευρές**: γράφει μόνο ο διακομιστής, και το έγγραφο κρατά την
   * **έδρα** από το μητρώο (σε ατομική, συχνά η κατοικία) — δημόσια φεύγει μόνο με επιλογή του
   * επαγγελματία. Ελαχιστοποίηση **με τύπο**: `types/company-registry.ts` (κανένα `persons`/`afm`).
   */
  COMPANY_REGISTRY_RECORDS:
    process.env.NEXT_PUBLIC_COMPANY_REGISTRY_RECORDS_COLLECTION || 'company_registry_records',

  /**
   * 🎯 ADR-827 §8.7 — **ΤΟ ΑΙΤΗΜΑ ΑΝΑΘΕΣΗΣ**. IDs `mreq_*`.
   *
   * 🔴 **`read: false` ΚΑΙ `write: false` — και οι ΔΥΟ πλευρές περνούν από τον
   * διακομιστή.** Δεν είναι αυστηρότητα για την αυστηρότητα: το έγγραφο περιέχει
   * `requestedByUserId`, και το **γραφείο δεν επιτρέπεται να το δει όσο κρίνει**
   * (§8.2). Το Firestore **δεν φιλτράρει πεδία στην ανάγνωση** ⇒ ένα `allow read` για
   * τον παραλήπτη θα του έδινε την ταυτότητα του ιδιώτη, όσο κλειστή κι αν είναι η
   * προβολή από πάνω. Το γραφείο διαβάζει `MandateRequestForAgency`, που **δεν έχει
   * πεδίο ταυτότητας καθόλου**.
   *
   * ⚠️ Δηλωμένη στο `tenant-config.ts` με άξονα το **`agencyCompanyId`** (CHECK 3.35):
   * ο μόνος **απαριθμήσιμος** άξονας είναι το γραφείο· ο ιδιώτης δεν είναι μισθωτής —
   * ίδιο σκεπτικό με το `OWNER_PROPERTIES`.
   */
  MANDATE_REQUESTS: process.env.NEXT_PUBLIC_MANDATE_REQUESTS_COLLECTION || 'mandate_requests',
  /**
   * ADR-864 §20 — **ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΠΑΓΩΜΕΝΩΝ ΑΠΟΔΕΙΚΤΙΚΩΝ** (`mevd_*`): ύπαρξη, διατήρηση, διάθεση.
   *
   * 🔴 Υπάρχει γιατί η αναφορά `proof.evidence` **χάνεται** όταν ο γραφέας αντικαθιστά την εντολή ενός
   * γραφείου, ενώ το αντικείμενο μένει κλειδωμένο στο bucket. Μετά τη διάθεση μένει ως **ταφόπλακα**.
   *
   * ⛔ **ΚΛΕΙΣΤΗ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** — μόνο ο διακομιστής. Άξονας μισθωτή **`agencyCompanyId`** (CHECK 3.35).
   */
  MANDATE_EVIDENCE: process.env.NEXT_PUBLIC_MANDATE_EVIDENCE_COLLECTION || 'mandate_evidence',
  /**
   * ADR-843 — **Η ΠΡΑΞΗ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ** (`fcon_*`): ο ζητών κάνει την κίνηση και
   * φέρνει **τα δικά του** στοιχεία στον προσφέροντα.
   *
   * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΘΟΛΟΥ**: το ADR-777 **Α12** υπόσχεται ότι προσφορά και ζήτηση
   * «*να συναντιούνται*», και μετρήθηκε 03/09/2026 ότι υπήρχε η **γνώση** (δύο
   * ειδοποιητές στο `services/demand/`) χωρίς την **πράξη** — κανένα πεδίο επαφής στο
   * `types/public-listing.ts`, κανένα κλειδί επαφής στο `property-market.json`.
   *
   * 🔑 **Η πρώτη κίνηση ανήκει στον ΖΗΤΟΥΝΤΑ, και δεν είναι επιλογή σχεδίασης**: η
   * αγγελία δημοσιεύτηκε με ρητή πράξη, η ζήτηση **ποτέ** ⇒ ο προσφέρων δεν έχει
   * **σε ποιον** να απευθυνθεί. Δεν είναι ότι δεν του επιτρέπουμε — **δεν υπάρχει
   * παραλήπτης**.
   *
   * ⛔ **ΚΛΕΙΣΤΗ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** (`firestore.rules`: `read: false` **και**
   * `write: false`) — το ζεύγος του `MANDATE_REQUESTS`, με **αντίστροφο** λόγο. Εκεί
   * κρύβαμε το πρόσωπο· εδώ η αποκάλυψη **είναι ο σκοπός**, αλλά το ωμό έγγραφο
   * κουβαλά `demandId` και ιστορικό που **δεν ανήκουν** στη μία πράξη. Δύο ακροατήρια
   * θέλουν **δύο** προβολές ⇒ και οι δύο περνούν από τον διακομιστή.
   *
   * ⚠️ Δηλωμένη στο `tenant-config.ts` με άξονα **`seekerUserId`** (CHECK 3.35) — τον
   * **μόνο** που υπάρχει σε **κάθε** έγγραφο, ανεξάρτητα από το είδος του στόχου.
   */
  FIRST_CONTACTS: process.env.NEXT_PUBLIC_FIRST_CONTACTS_COLLECTION || 'first_contacts',
  /**
   * ADR-777 §8.72 — **ΟΙ ΠΡΟΒΟΛΕΙΣ ΜΙΑΣ ΑΓΓΕΛΙΑΣ**, σε τέσσερις συλλογές με τέσσερις ρόλους.
   *
   * | Συλλογή | Ρόλος | Ζωή |
   * |---|---|---|
   * | `listing_view_salts` | ημερήσιο τυχαίο αλάτι | 2 ημέρες |
   * | `listing_view_marks` | «μετρήθηκε σήμερα» — αποδυπλασιασμός | 2 ημέρες |
   * | `listing_view_shards` | ζεστός μετρητής (ακίνητο, ημέρα, shard) | 2 ημέρες |
   * | `listing_stats` | ψυχρή σύνοψη ανά ακίνητο, γράφει **μόνο** το cron | για πάντα |
   *
   * 🔑 **Κλειδί = το ΑΚΙΝΗΤΟ, όχι η δημόσια αγγελία** (μάθημα `listedAt` §8.61): η απόσυρση
   * σβήνει το `public_listings/{id}`· αν ζούσαν εκεί, απόσυρση + επαναδημοσίευση θα μηδένιζε
   * την ιστορία.
   *
   * 🔒 **Καμία PII**: το σημάδι είναι hash με αλάτι ημέρας που σβήνεται μετά από 2 μέρες ⇒ κανείς,
   * ούτε εμείς, δεν μπορεί να ξαναβρεί ποια IP το γέννησε (μοτίβο Plausible).
   *
   * ⛔ **ΚΛΕΙΣΤΕΣ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** (`read/write: false`) — ο κάτοχος διαβάζει **προβολή**
   * από τον διακομιστή, με τον κριτή θεματοφυλακής (`mayAdminister`).
   */
  LISTING_VIEW_SALTS: process.env.NEXT_PUBLIC_LISTING_VIEW_SALTS_COLLECTION || 'listing_view_salts',
  LISTING_VIEW_MARKS: process.env.NEXT_PUBLIC_LISTING_VIEW_MARKS_COLLECTION || 'listing_view_marks',
  LISTING_VIEW_SHARDS: process.env.NEXT_PUBLIC_LISTING_VIEW_SHARDS_COLLECTION || 'listing_view_shards',
  LISTING_STATS: process.env.NEXT_PUBLIC_LISTING_STATS_COLLECTION || 'listing_stats',
  /**
   * ADR-777 §8.74 — **«ΤΗΝ ΚΡΑΤΗΣΑ»** (`svls_*`): μία ανά (άνθρωπο, αγγελία), ντετερμινιστική.
   *
   * ⛔ **ΚΛΕΙΣΤΗ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** (`read/write: false`): γράφει **ένας** γραφέας
   * (`saved-listing.service.ts`), που ρωτά «στην αγορά;» και «δική σου;» — ερωτήσεις που
   * κανόνας δεν μπορεί να κάνει. Ο κάτοχος της αγγελίας βλέπει μόνο **πλήθος**, ποτέ ποιοι.
   * Η αφαίρεση **σβήνει** το έγγραφο (ελαχιστοποίηση δεδομένων).
   */
  SAVED_LISTINGS: process.env.NEXT_PUBLIC_SAVED_LISTINGS_COLLECTION || 'saved_listings',
  /**
   * ADR-867 §4.3 — **Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ** (`nteam_*`): ποιος του γραφείου απαντά σε μια πράξη
   * που **δεν έχει έργο** (π.χ. εντολή ιδιοκτήτη ↔ μεσιτικού) — ADR-834 §5 Β (ε) ①.
   *
   * 🔴 **ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΚΑΘΟΛΟΥ**: η εντολή **δεν γράφει άνθρωπο** (ADR-867 §2.3) — κρατά
   * `agencyCompanyId`. Χωρίς αυτήν, το «ποιος διαβάζει;» θα απαντιόταν **ή** «ο υπεύθυνος»
   * (ορφανό νήμα σε απουσία/αποχώρηση — το τεκμηριωμένο κενό Salesforce/HubSpot/Zendesk/FUB)
   * **ή** «όλο το γραφείο» (αντίκειται στο (γ) ①).
   *
   * ⛔ **ΚΛΕΙΣΤΗ ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** — **ένας** γραφέας (`services/network-messaging/
   * act-team-writer.ts`), καμία γραφή πελάτη· η οθόνη τη διαβάζει από τον διακομιστή (Β5/Β7).
   * ⚠️ Άξονας μισθωτή **`hostCompanyId`** (CHECK 3.35) — το `network_threads` **δεν** θα έχει
   * κανέναν (νήμα σχέσης = του **προσώπου**, ADR-867 §4.1), γι' αυτό μπαίνει χωριστά στο Β4.
   */
  NETWORK_ACT_TEAMS: process.env.NEXT_PUBLIC_NETWORK_ACT_TEAMS_COLLECTION || 'network_act_teams',

  /**
   * ADR-867 §4.1 — **ΤΟ ΝΗΜΑ** (`nthr_*`): η συνομιλία ανάμεσα σε **δύο πλευρές διαφορετικών
   * χώρων**. **Ένα** έγγραφο, **δύο** θέματα από κλειστό σύνολο (πράξη · σχέση) — ποτέ δύο
   * μηχανές (ADR-834 §5 Β (δ)).
   *
   * 🔴 **ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΤΟ `CONVERSATIONS`/`MESSAGES` (ADR-029)**: εκείνο μοντελοποιεί
   * **γραφείο ↔ εξωτερικό κανάλι** (Telegram/email/bot) και η ανάγνωσή του είναι
   * `belongsToCompany(...)` — δηλαδή **όλο** το γραφείο. Εδώ το «ποιος διαβάζει;» απαντά η
   * **υποσυλλογή ακροατηρίου**, και ένα κοινό σχήμα θα έκανε τους δύο κανόνες ορατότητας
   * **αδιάκριτους** (ADR-867 §2.1).
   *
   * ⛔ **ΚΑΜΙΑ ΓΡΑΦΗ ΠΕΛΑΤΗ** (`create/update/delete: if false`) — ίδιο δόγμα με το
   * `owner_properties`: κάθε γραφή περνά από **έναν** γραφέα
   * (`services/network-messaging/thread-writer.ts`) μέσα σε συναλλαγή. Η **ανάγνωση**
   * επιτρέπεται σε ζωντανό μέλος του ακροατηρίου, ώστε η οθόνη να είναι **ζωντανή**.
   *
   * ⚠️ **ΚΑΝΕΝΑΣ ΑΞΟΝΑΣ ΜΙΣΘΩΤΗ** (`tenant-config.ts`, CHECK 3.35): το νήμα **σχέσης**
   * ανήκει στο **πρόσωπο** (ADR-834 (γ) ②) και δεν έχει χώρο καθόλου. Δηλώνεται ρητά ως
   * `mode: 'none'` με κατηγορία `cross-space-thread` — **ποτέ** πεδίο που λείπει από μισά
   * έγγραφα.
   */
  NETWORK_THREADS: process.env.NEXT_PUBLIC_NETWORK_THREADS_COLLECTION || 'network_threads',

  /**
   * ADR-867 §4.1 — **ΤΟ ΒΙΒΛΙΟ ΤΩΝ ΑΝΑΚΛΗΣΕΩΝ**: το κείμενο κάθε μηνύματος που
   * ανακλήθηκε, **και το γεγονός της ανάκλησης**. Κλειδί = **το id του μηνύματος**.
   *
   * 🔑 **ΤΟ ΔΕΥΤΕΡΟ ΑΝΤΙΓΡΑΦΟ — Η ΠΡΑΚΤΙΚΗ ΤΩΝ ΜΕΓΑΛΩΝ, ΓΡΑΜΜΕΝΗ ΠΡΙΝ**: ο Microsoft
   * Teams κρατά **δύο** αντίγραφα κάθε μηνύματος (*«one for compliance purposes, one for
   * end-user access»*) και η διαγραφή χρήστη **μετακινεί** το μήνυμα στο κρυφό
   * `SubstrateHolds`· ο Slack το ίδιο ως `save edits and deletions` + eDiscovery API. Το
   * XMPP **XEP-0424** το κάνει κανόνα: *«the archiving service MUST store the retraction
   * message»*. Εδώ ο «κρυφός τόπος» είναι **ρητή συλλογή με ρητό κανόνα** — όχι κρυφός
   * φάκελος που μαθαίνεις ότι υπάρχει όταν σου ζητήσουν eDiscovery.
   *
   * ⛔ **ΚΛΕΙΣΤΗ ΣΕ ΚΑΘΕ ΠΕΛΑΤΗ, ΚΑΙ ΣΤΙΣ ΔΥΟ ΠΛΕΥΡΕΣ** — ούτε ο αποστολέας, ούτε ο
   * παραλήπτης, ούτε ο διαχειριστής χώρου, ούτε ο `super_admin`. Αν ο πελάτης μπορούσε να
   * τη διαβάσει, η ανάκληση θα ήταν **διακοσμητική**: ο αποστολέας θα νόμιζε ότι πήρε
   * πίσω τα λόγια του ενώ θα ήταν ένα ερώτημα μακριά.
   *
   * ⚖️ **Ο λόγος διατήρησης είναι ΕΝΑΣ και γραμμένος**: ΓΚΠΔ άρθρο 17 §3(ε) —
   * θεμελίωση/άσκηση/υποστήριξη νομικών αξιώσεων (ADR-834 §5 Β (β) ③).
   */
  NETWORK_MESSAGE_RETRACTIONS:
    process.env.NEXT_PUBLIC_NETWORK_MESSAGE_RETRACTIONS_COLLECTION || 'network_message_retractions',

  /**
   * **ΤΟ ΚΕΙΜΕΝΟ ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΕΠΕΞΕΡΓΑΣΙΑ** (ADR-867 Β7) — `network_message_revisions/{nmrv_*}`.
   *
   * 🔑 Η επεξεργασία **δεν έχει όριο χρόνου** (Teams · Slack · Google Chat — απόφαση της έρευνας,
   * 2026-09-19)· γι' αυτό **κάθε** προηγούμενη μορφή μένει εδώ: ένα νήμα πράξης είναι **τεκμήριο**
   * (ADR-834 (β) ③), και μια επεξεργασία χωρίς ίχνος θα ήταν **ξαναγραμμένη ιστορία**.
   * ⛔ **ΚΛΕΙΣΤΗ ΣΕ ΚΑΘΕ ΠΕΛΑΤΗ** — ίδιο δόγμα, ίδιος λόγος διατήρησης με τις ανακλήσεις.
   */
  NETWORK_MESSAGE_REVISIONS:
    process.env.NEXT_PUBLIC_NETWORK_MESSAGE_REVISIONS_COLLECTION || 'network_message_revisions',

  /**
   * **Η ΑΠΟΥΣΙΑ ΤΟΥ ΑΝΘΡΩΠΟΥ** (ADR-867 §4.4 · Β5 · ADR-834 (ε) 🏆) — `network_away/{naway_*}`,
   * κλειδί **ντετερμινιστικό** ανά πρόσωπο: μία δήλωση ανά άνθρωπο, ποτέ δύο που διαφωνούν.
   *
   * ⛔ **ΚΛΕΙΣΤΗ ΣΕ ΚΑΘΕ ΠΕΛΑΤΗ**: ο αντισυμβαλλόμενος μαθαίνει **μόνο** «ως πότε» και «ποιος
   * διαβάζει στη θέση του», από τον **διακομιστή**, και **μόνο** για όσους διαβάζουν το **ίδιο**
   * νήμα. Ανάγνωση πελάτη θα έκανε το ημερολόγιο απουσιών ενός γραφείου απαριθμήσιμο.
   */
  NETWORK_AWAY: process.env.NEXT_PUBLIC_NETWORK_AWAY_COLLECTION || 'network_away',

  /**
   * **ΤΟ ΚΟΥΤΙ ΑΔΙΑΒΑΣΤΩΝ ΤΟΥ ΑΝΘΡΩΠΟΥ** (ADR-867 §4.5 · Β10) — `network_inbox/{uid}`. Το ίδιο το έγγραφο
   * **δεν έχει δεδομένα**· ζει μόνο ως γονέας της υποσυλλογής `network_inbox_unread` (μία γραμμή ανά νήμα με
   * αδιάβαστο). Ανήκει στο **πρόσωπο** — χωρίς `companyId`, όπως το νήμα σχέσης.
   */
  NETWORK_INBOX: process.env.NEXT_PUBLIC_NETWORK_INBOX_COLLECTION || 'network_inbox',

  /**
   * **Η ΠΡΟΣΚΛΗΣΗ — Ο,ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΚΟΜΗ ΠΡΑΞΗ** (ADR-844).
   *
   * 🔴 **ΞΕΧΩΡΙΣΤΗ ΣΥΛΛΟΓΗ ΚΑΙ ΟΧΙ ΤΡΙΤΗ ΚΑΤΑΣΤΑΣΗ ΣΤΟ `first_contacts`.** Η
   * πράξη έχει άξονα το `seekerUserId`, που τη στιγμή της υποβολής **δεν
   * υπάρχει** — ο άνθρωπος δεν έχει ακόμη λογαριασμό. Μια «εκκρεμής» πράξη θα
   * ήταν έγγραφο με **κενό** τον άξονα της χωρητικότητας (ΠΕ5/Κ5/Κ9), δηλαδή
   * ακριβώς η «άπειρη χωρητικότητα» που το ADR-843 §10.18 Η απέρριψε.
   *
   * ⇒ Εδώ παρκάρει η **δήλωση**· η πράξη γεννιέται στο `first_contacts` **μόνο**
   * μετά την επαλήθευση, από τον **ίδιο** γραφέα (`openFirstContact`).
   * 1.000 προσκλήσεις ⇒ **το πολύ 10** ανοιχτές πράξεις.
   */
  FIRST_CONTACT_INVITATIONS:
    process.env.NEXT_PUBLIC_FIRST_CONTACT_INVITATIONS_COLLECTION || 'first_contact_invitations',
  /** ADR-844 §13.8 — ημερολόγιο διεκδίκησης λογαριασμού (μόνο διακομιστής, deny-all). */
  AUTH_REPROVISION_JOURNAL:
    process.env.NEXT_PUBLIC_AUTH_REPROVISION_JOURNAL_COLLECTION || 'auth_reprovision_journal',
  /** ADR-660 §6 — αιτήματα ένταξης σε χώρο εργασίας (γραφή μόνο διακομιστής). */
  WORKSPACE_ACCESS_REQUESTS:
    process.env.NEXT_PUBLIC_WORKSPACE_ACCESS_REQUESTS_COLLECTION || 'workspace_access_requests',
  /**
   * ADR-853 §7.1 — **προσκλήσεις σε χώρο εργασίας** (deny-all: το έγγραφο κρατά ΜΥΣΤΙΚΟ).
   *
   * ⚠️ **Η ΑΝΤΙΘΕΤΗ ΚΑΤΕΥΘΥΝΣΗ ΑΠΟ ΤΗΝ ΑΠΟ ΠΑΝΩ.** Το `workspace_access_requests` πάει από
   * τον **άνθρωπο** στον χώρο («θέλω να μπω»)· αυτό από τον **χώρο** στον άνθρωπο («σε
   * θέλουμε μέσα»). Δύο συλλογές επειδή είναι δύο **ερωτήματα** — η έγκριση του ενός δεν
   * είναι αποδοχή του άλλου.
   */
  WORKSPACE_INVITATIONS:
    process.env.NEXT_PUBLIC_WORKSPACE_INVITATIONS_COLLECTION || 'workspace_invitations',

  FLOORS: process.env.NEXT_PUBLIC_FLOORS_COLLECTION || 'floors',
  /**
   * ADR-759 Φ2 — institutional/legal plot data as declared by a surveyor on a date
   * («Στοιχεία Τοπογραφικού»). IDs via `srv_*` prefix.
   *
   * ⚠️ NOT `SURVEYS` (line ~88): that one lives under «FORMS & SURVEYS» next to
   * `FORMS`/`SUBMISSIONS` and means *questionnaires*. It has zero consumers anywhere
   * in `src/` (verified 2026-08-05), so a name-match grep will happily "find" it and
   * put legal plot data in a forms collection with every gate green. ADR-759 §Ζ.1.
   */
  SURVEY_RECORDS: process.env.NEXT_PUBLIC_SURVEY_RECORDS_COLLECTION || 'survey_records',

  // 💬 COMMUNICATIONS
  COMMUNICATIONS: process.env.NEXT_PUBLIC_COMMUNICATIONS_COLLECTION || 'communications',
  MESSAGES: process.env.NEXT_PUBLIC_MESSAGES_COLLECTION || 'messages',
  NOTIFICATIONS: process.env.NEXT_PUBLIC_NOTIFICATIONS_COLLECTION || 'notifications',

  // 🌐 OMNICHANNEL CONVERSATIONS (Enterprise)
  CONVERSATIONS: process.env.NEXT_PUBLIC_CONVERSATIONS_COLLECTION || 'conversations',
  EXTERNAL_IDENTITIES: process.env.NEXT_PUBLIC_EXTERNAL_IDENTITIES_COLLECTION || 'external_identities',

  // 🎯 LEADS & CRM
  LEADS: process.env.NEXT_PUBLIC_LEADS_COLLECTION || 'leads',
  OPPORTUNITIES: process.env.NEXT_PUBLIC_OPPORTUNITIES_COLLECTION || 'opportunities',
  ACTIVITIES: process.env.NEXT_PUBLIC_ACTIVITIES_COLLECTION || 'activities',
  TASKS: process.env.NEXT_PUBLIC_TASKS_COLLECTION || 'tasks',
  OBLIGATIONS: process.env.NEXT_PUBLIC_OBLIGATIONS_COLLECTION || 'obligations',
  OBLIGATION_TEMPLATES: process.env.NEXT_PUBLIC_OBLIGATION_TEMPLATES_COLLECTION || 'obligation_templates',
  OBLIGATION_TRANSMITTALS: process.env.NEXT_PUBLIC_OBLIGATION_TRANSMITTALS_COLLECTION || 'obligation_transmittals',
  ASSIGNMENT_POLICIES: process.env.NEXT_PUBLIC_ASSIGNMENT_POLICIES_COLLECTION || 'assignment_policies',

  // 📊 ANALYTICS & METRICS
  ANALYTICS: process.env.NEXT_PUBLIC_ANALYTICS_COLLECTION || 'analytics',
  METRICS: process.env.NEXT_PUBLIC_METRICS_COLLECTION || 'metrics',
  EVENTS: process.env.NEXT_PUBLIC_EVENTS_COLLECTION || 'events',

  // ⚙️ SYSTEM & CONFIGURATION
  SYSTEM: process.env.NEXT_PUBLIC_SYSTEM_COLLECTION || 'system',
  CONFIG: process.env.NEXT_PUBLIC_CONFIG_COLLECTION || 'config',
  SETTINGS: process.env.NEXT_PUBLIC_SETTINGS_COLLECTION || 'settings',
  NAVIGATION: process.env.NEXT_PUBLIC_NAVIGATION_COLLECTION || 'navigation_companies',

  // 👤 USER MANAGEMENT
  USERS: process.env.NEXT_PUBLIC_USERS_COLLECTION || 'users',
  TEAMS: process.env.NEXT_PUBLIC_TEAMS_COLLECTION || 'teams',
  ROLES: process.env.NEXT_PUBLIC_ROLES_COLLECTION || 'roles',
  PERMISSIONS: process.env.NEXT_PUBLIC_PERMISSIONS_COLLECTION || 'permissions',

  // 🏢 WORKSPACES (ADR-787 — η πολυ-οργανισμική πλατφόρμα)
  //
  // ⛔ ΤΟ top-level `WORKSPACE_MEMBERS` ΔΙΑΓΡΑΦΗΚΕ (ADR-787 §5.1 γ, 2026-08-22).
  //    Μετρημένο: **0 έγγραφα · 0 καταναλωτές · 0 κανόνες ασφαλείας**· η μόνη
  //    αναφορά του σε όλο το `src/` ήταν **σχόλιο TODO**. Ήταν τρίτο σχήμα για
  //    ερώτηση που έχει ήδη απάντηση.
  //    ⚠️ Το **όνομα** δεν χάθηκε — **ΚΑΤΕΒΗΚΕ** στο επίπεδο όπου είναι σωστό:
  //    υποσυλλογή `SUBCOLLECTIONS.WORKSPACE_MEMBERS` κάτω από τον χώρο.
  //    ⛔ ΜΗΝ το ξαναφτιάξεις εδώ ως top-level.
  WORKSPACES: process.env.NEXT_PUBLIC_WORKSPACES_COLLECTION || 'workspaces',

  // 🔠 ΤΟ ΕΥΡΕΤΗΡΙΟ ΨΕΥΔΩΝΥΜΩΝ (ADR-787 §5.3 δ / Ε-5 §8)
  //
  // 🔴 ΤΟ ΚΛΕΙΔΙ ΕΓΓΡΑΦΟΥ ΕΙΝΑΙ Ο **ΣΚΕΛΕΤΟΣ** UTS #39 — ΟΧΙ enterprise ID, και
  //    αυτό είναι ΑΠΟΦΑΣΗ, όχι παράλειψη του κανόνα N.6:
  //
  //    Ο N.6 υπάρχει για να μην γεννιούνται **τυχαία ή ασυνεπή** αναγνωριστικά.
  //    Εδώ το κλειδί δεν είναι αναγνωριστικό — είναι **το ίδιο το ερώτημα**:
  //    «υπάρχει ήδη ψευδώνυμο που ΦΑΙΝΕΤΑΙ έτσι;». Βάζοντάς το στη διαδρομή, η
  //    μοναδικότητα γίνεται **ιδιότητα του δρόμου**: δύο αιτήματα για οπτικά
  //    ταυτόσημα ονόματα συγκρούονται στο ίδιο το Firestore, και **κανείς δεν
  //    χρειάζεται να θυμηθεί να ρωτήσει**. Με τυχαίο ID θα χρειαζόταν ερώτημα
  //    `where('skeleton','==',…)` — δηλαδή έλεγχος που μπορεί να ξεχαστεί.
  //    Ίδια πειθαρχία με το §5.1 γ: «όνομα που δεν μπορεί να συγκρουστεί».
  //
  // ⚠️ Κάθε χώρος έχει **ένα** τρέχον ψευδώνυμο και **οσαδήποτε παλιά**, που
  //    εξακολουθούν να λύνονται και **δεν ελευθερώνονται ΠΟΤΕ** (Ε-5 §8 γ) —
  //    εκεί ξεπερνάμε το GitHub, που αφήνει το παλιό όνομα να το πάρει άλλος
  //    και τότε ο νέος κάτοχος **κληρονομεί τους συνδέσμους**.
  WORKSPACE_ALIASES:
    process.env.NEXT_PUBLIC_WORKSPACE_ALIASES_COLLECTION || 'workspace_aliases',

  // 🔄 RELATIONSHIPS
  RELATIONSHIPS: process.env.NEXT_PUBLIC_RELATIONSHIPS_COLLECTION || 'relationships',
  CONTACT_RELATIONSHIPS: process.env.NEXT_PUBLIC_CONTACT_RELATIONSHIPS_COLLECTION || 'contact_relationships',
  // ADR-336 — self-extending taxonomy of custom relationship types
  // (label registry for user-created relationship types beyond the 31 static ones in code).
  CONTACT_RELATIONSHIP_TYPE_REGISTRY:
    process.env.NEXT_PUBLIC_CONTACT_RELATIONSHIP_TYPE_REGISTRY_COLLECTION ||
    'contact_relationship_type_registry',

  // 🔗 ASSOCIATIONS (ADR-032: Linking Model - ΤΕΛΕΙΩΤΙΚΗ ΕΝΤΟΛΗ)
  CONTACT_LINKS: process.env.NEXT_PUBLIC_CONTACT_LINKS_COLLECTION || 'contact_links',
  FILE_LINKS: process.env.NEXT_PUBLIC_FILE_LINKS_COLLECTION || 'file_links',
  // ADR-745 Φ3β — provenance ανά κελί πινακίδας: «αυτό το κελί αυτού του σχεδίου, εγκεκριμένο
  // από αυτόν τον άνθρωπο, δείχνει σε αυτή την οντότητα». Ποτέ γραμμένο χωρίς ρητό κλικ (§5.1).
  TITLE_BLOCK_BINDINGS:
    process.env.NEXT_PUBLIC_TITLE_BLOCK_BINDINGS_COLLECTION || 'title_block_bindings',

  // 📋 FORMS & SURVEYS
  FORMS: process.env.NEXT_PUBLIC_FORMS_COLLECTION || 'forms',
  SUBMISSIONS: process.env.NEXT_PUBLIC_SUBMISSIONS_COLLECTION || 'submissions',
  SURVEYS: process.env.NEXT_PUBLIC_SURVEYS_COLLECTION || 'surveys',

  // 📄 FILES (SSoT: all uploaded files — floorplans, DXF, photos, documents)
  FILES: process.env.NEXT_PUBLIC_FILES_COLLECTION || 'files',
  /**
   * 🗂️ ADR-866 §5.2 — **ΤΑ ΑΡΧΕΙΑ ΠΟΥ ΑΝΗΚΟΥΝ ΣΕ ΑΝΘΡΩΠΟ**, όχι σε εταιρεία (ίδιο `FileRecord`, πεδίο
   * `userId` αντί `companyId`). **Διαμέρισμα, όχι διακλάδωση** του `FILES`: οι κανόνες δεν φιλτράρουν,
   * και ένας κλάδος μέσα στο `match /files` θα έριχνε κάθε αφιλτράριστη λίστα. Το διαβάζει **μόνο** ο
   * κάτοχος — ούτε super admin (Google Drive «Ο Δίσκος μου» · Figma Drafts). Επιλογή μέσω
   * `FILE_COLLECTION[kind]` (`lib/files/file-custody.ts`)· **ποτέ** στο `IMMUTABLE_COLLECTIONS`.
   */
  FILES_PERSONAL: process.env.NEXT_PUBLIC_FILES_PERSONAL_COLLECTION || 'files_personal',
  ATTACHMENTS: process.env.NEXT_PUBLIC_ATTACHMENTS_COLLECTION || 'attachments',

  // 🎨 CAD & TECHNICAL DRAWINGS (Enterprise Unified)
  /** @deprecated ADR-292 Phase 3: Writes stopped, reads eliminated. All DXF metadata lives in FILES collection. */
  CAD_FILES: process.env.NEXT_PUBLIC_CAD_FILES_COLLECTION || 'cad_files',
  CAD_LAYERS: process.env.NEXT_PUBLIC_CAD_LAYERS_COLLECTION || 'cad_layers',
  CAD_SESSIONS: process.env.NEXT_PUBLIC_CAD_SESSIONS_COLLECTION || 'cad_sessions',
  DXF_OVERLAY_LEVELS: process.env.NEXT_PUBLIC_DXF_OVERLAY_LEVELS_COLLECTION || 'dxf_overlay_levels',
  DXF_VIEWER_LEVELS: process.env.NEXT_PUBLIC_DXF_VIEWER_LEVELS_COLLECTION || 'dxf_viewer_levels',
  /** ADR-375 Phase B.3 — BIM View Templates (reusable presets: drawingScale + viewRange + objectStyles). */
  DXF_VIEWER_VIEW_TEMPLATES: process.env.NEXT_PUBLIC_DXF_VIEWER_VIEW_TEMPLATES_COLLECTION || 'dxf_viewer_view_templates',
  /** ADR-375 Phase C.1 — BIM Pen Table overrides (per-company, docId = companyId). */
  DXF_VIEWER_PEN_TABLES: process.env.NEXT_PUBLIC_DXF_VIEWER_PEN_TABLES_COLLECTION || 'dxf_viewer_pen_tables',
  /**
   * ADR-362 Phase F4 — per-company custom DIMSTYLE persistence + the per-company
   * "default" dim style pointer. One doc per CUSTOM style (full `style` payload,
   * ~60 DimStyle fields under `style`), plus at most one thin `isBuiltInRef` doc
   * that pins a built-in template (ISO/ASME/Arch/Nestor) as the company default.
   * Exactly one doc carries `isDefault:true` at a time (the code default is the
   * Nestor green template, so ZERO docs = Nestor default). Enterprise IDs via
   * `generateDimStyleId()` → docId prefix `dimstyle_`. Tenant-scoped (companyId).
   */
  DXF_DIMENSION_STYLES: process.env.NEXT_PUBLIC_DXF_DIMENSION_STYLES_COLLECTION || 'dxf_dimension_styles',

  // 📐 FLOORPLANS (Enterprise Unified)
  FLOORPLANS: process.env.NEXT_PUBLIC_FLOORPLANS_COLLECTION || 'floorplans',
  PROJECT_FLOORPLANS: process.env.NEXT_PUBLIC_PROJECT_FLOORPLANS_COLLECTION || 'project_floorplans',
  /** ADR-292 Phase 4 legacy — reads/writes go through `files`; counts only for showcase MVP (ADR-312). */
  UNIT_FLOORPLANS: process.env.NEXT_PUBLIC_UNIT_FLOORPLANS_COLLECTION || 'unit_floorplans',
  /** ADR-340: Floorplan background domain entities (PDF/Image, 1 per floor, calibration, transform). */
  FLOORPLAN_BACKGROUNDS: process.env.NEXT_PUBLIC_FLOORPLAN_BACKGROUNDS_COLLECTION || 'floorplan_backgrounds',
  /** ADR-340: Floorplan polygon overlays (FK → floorplan_backgrounds, tenant-scoped). */
  FLOORPLAN_OVERLAYS: process.env.NEXT_PUBLIC_FLOORPLAN_OVERLAYS_COLLECTION || 'floorplan_overlays',

  // 🅿️ PARKING & SPACES
  // 📍 Collection name: parking_spots (με underscore - όπως στη Firestore)
  PARKING_SPACES: process.env.NEXT_PUBLIC_PARKING_SPACES_COLLECTION || 'parking_spots',

  // Legacy collections (maintained for backward compatibility)
  LAYERS: process.env.NEXT_PUBLIC_LAYERS_COLLECTION || 'layers',
  LAYER_GROUPS: process.env.NEXT_PUBLIC_LAYER_GROUPS_COLLECTION || 'layer_groups',
  PROPERTY_LAYERS: process.env.NEXT_PUBLIC_PROPERTY_LAYERS_COLLECTION || 'property-layers',
  LAYER_EVENTS: process.env.NEXT_PUBLIC_LAYER_EVENTS_COLLECTION || 'layer-events',

  // 🗓️ CALENDAR & SCHEDULING
  CALENDAR: process.env.NEXT_PUBLIC_CALENDAR_COLLECTION || 'calendar',
  APPOINTMENTS: process.env.NEXT_PUBLIC_APPOINTMENTS_COLLECTION || 'appointments',
  BOOKINGS: process.env.NEXT_PUBLIC_BOOKINGS_COLLECTION || 'bookings',
  BOOKING_SESSIONS: process.env.NEXT_PUBLIC_BOOKING_SESSIONS_COLLECTION || 'booking_sessions',

  // 🔧 MAINTENANCE & LOGS
  LOGS: process.env.NEXT_PUBLIC_LOGS_COLLECTION || 'logs',
  AUDIT: process.env.NEXT_PUBLIC_AUDIT_COLLECTION || 'audit',
  ERRORS: process.env.NEXT_PUBLIC_ERRORS_COLLECTION || 'errors',

  // 🏪 INVENTORY & ASSETS
  INVENTORY: process.env.NEXT_PUBLIC_INVENTORY_COLLECTION || 'inventory',
  ASSETS: process.env.NEXT_PUBLIC_ASSETS_COLLECTION || 'assets',
  STORAGE: process.env.NEXT_PUBLIC_STORAGE_COLLECTION || 'storage_units',

  // 💰 FINANCIAL
  INVOICES: process.env.NEXT_PUBLIC_INVOICES_COLLECTION || 'invoices',
  PAYMENTS: process.env.NEXT_PUBLIC_PAYMENTS_COLLECTION || 'payments',
  TRANSACTIONS: process.env.NEXT_PUBLIC_TRANSACTIONS_COLLECTION || 'transactions',

  // 🔐 SECURITY
  SESSIONS: process.env.NEXT_PUBLIC_SESSIONS_COLLECTION || 'sessions',
  TOKENS: process.env.NEXT_PUBLIC_TOKENS_COLLECTION || 'tokens',
  SECURITY_ROLES: process.env.NEXT_PUBLIC_SECURITY_ROLES_COLLECTION || 'security_roles',
  EMAIL_DOMAIN_POLICIES: process.env.NEXT_PUBLIC_EMAIL_DOMAIN_POLICIES_COLLECTION || 'email_domain_policies',
  COUNTRY_SECURITY_POLICIES: process.env.NEXT_PUBLIC_COUNTRY_SECURITY_POLICIES_COLLECTION || 'country_security_policies',

  // 🌐 LOCALIZATION
  TRANSLATIONS: process.env.NEXT_PUBLIC_TRANSLATIONS_COLLECTION || 'translations',
  LOCALES: process.env.NEXT_PUBLIC_LOCALES_COLLECTION || 'locales',

  // 🔢 COUNTERS (Enterprise Sequential ID Generation)
  COUNTERS: process.env.NEXT_PUBLIC_COUNTERS_COLLECTION || 'counters',

  // ⚙️ USER PREFERENCES
  USER_NOTIFICATION_SETTINGS: process.env.NEXT_PUBLIC_USER_NOTIFICATION_SETTINGS_COLLECTION || 'user_notification_settings',
  USER_2FA_SETTINGS: process.env.NEXT_PUBLIC_USER_2FA_SETTINGS_COLLECTION || 'user_2fa_settings',
  USER_PREFERENCES: process.env.NEXT_PUBLIC_USER_PREFERENCES_COLLECTION || 'user_preferences',

  // 🤖 BOT CONFIGURATIONS (PR1: Telegram Enterprise Refactor)
  BOT_CONFIGS: process.env.NEXT_PUBLIC_BOT_CONFIGS_COLLECTION || 'bot_configs',
  BOT_CATALOGS: process.env.NEXT_PUBLIC_BOT_CATALOGS_COLLECTION || 'bot_catalogs',
  BOT_INTENTS: process.env.NEXT_PUBLIC_BOT_INTENTS_COLLECTION || 'bot_intents',

  // 🔍 SEARCH (Global Search v1)
  SEARCH_DOCUMENTS: process.env.NEXT_PUBLIC_SEARCH_DOCUMENTS_COLLECTION || 'search_documents',

  // 📧 EMAIL INGESTION QUEUE (ADR-071: Enterprise Email Webhook Queue)
  EMAIL_INGESTION_QUEUE: process.env.NEXT_PUBLIC_EMAIL_INGESTION_QUEUE_COLLECTION || 'email_ingestion_queue',

  // 🎤 VOICE COMMANDS (ADR-164: In-App Voice AI Pipeline)
  VOICE_COMMANDS: process.env.NEXT_PUBLIC_VOICE_COMMANDS_COLLECTION || 'voice_commands',

  // 🤖 AI PIPELINE (ADR-080: Universal AI Pipeline)
  AI_PIPELINE_QUEUE: process.env.NEXT_PUBLIC_AI_PIPELINE_QUEUE_COLLECTION || 'ai_pipeline_queue',
  AI_PIPELINE_AUDIT: process.env.NEXT_PUBLIC_AI_PIPELINE_AUDIT_COLLECTION || 'ai_pipeline_audit',

  // 🧠 AI CHAT HISTORY (ADR-171: Autonomous AI Agent — conversation memory)
  AI_CHAT_HISTORY: process.env.NEXT_PUBLIC_AI_CHAT_HISTORY_COLLECTION || 'ai_chat_history',

  // ⏳ AI PENDING ACTIONS (ADR-171: Duplicate contact resolution via inline keyboards)
  AI_PENDING_ACTIONS: process.env.NEXT_PUBLIC_AI_PENDING_ACTIONS_COLLECTION || 'ai_pending_actions',

  // 🧠 AI SELF-IMPROVEMENT (ADR-173: Feedback + Learning)
  AI_AGENT_FEEDBACK: process.env.NEXT_PUBLIC_AI_AGENT_FEEDBACK_COLLECTION || 'ai_agent_feedback',
  AI_LEARNED_PATTERNS: process.env.NEXT_PUBLIC_AI_LEARNED_PATTERNS_COLLECTION || 'ai_learned_patterns',
  /** 🧠 AI Query Strategy Memory — remembers which query approaches work/fail per collection */
  AI_QUERY_STRATEGIES: 'ai_query_strategies',

  // 💰 AI USAGE TRACKING (ADR-259A: Cost Protection — per-user monthly token/cost tracking)
  AI_USAGE: process.env.NEXT_PUBLIC_AI_USAGE_COLLECTION || 'ai_usage',

  // 🔐 OAUTH 2.1 AUTHORIZATION SERVER (ADR-738 — MCP transport)
  // ⚠️ Οι τέσσερις είναι **deny-all** στο firestore.rules: γράφονται και διαβάζονται
  // ΑΠΟΚΛΕΙΣΤΙΚΑ από το Admin SDK. Ένα client SDK που τις άγγιζε θα εξέθετε hashes
  // token και code verifiers στον browser — δηλαδή θα ακύρωνε ολόκληρο το σχήμα.
  // Δεν δέχονται env override: το όνομα συλλογής διαπιστευτηρίων δεν είναι ρύθμιση.
  /** Στιγμιότυπα CIMD των MCP clients (client_id = HTTPS URL). */
  OAUTH_CLIENTS: 'oauth_clients',
  /** Εκκρεμή αιτήματα εξουσιοδότησης — ζουν όσο ο άνθρωπος σκέφτεται. */
  OAUTH_AUTH_REQUESTS: 'oauth_auth_requests',
  /** Authorization codes — 60s TTL, μιας χρήσης, με PKCE challenge. */
  OAUTH_CODES: 'oauth_codes',
  /** Access & refresh tokens — αποθηκεύεται ΜΟΝΟ SHA-256 του μυστικού. */
  OAUTH_TOKENS: 'oauth_tokens',
  /** Ενεργές συγκαταθέσεις χρήστη→client — η λίστα που ο χρήστης ανακαλεί. */
  OAUTH_CONSENTS: 'oauth_consents',

  // ⏱️ ΧΡΟΝΟΠΡΟΓΡΑΜΜΑΤΙΣΜΟΣ (ADR-740)
  /**
   * Κατάσταση εκτέλεσης ανά προγραμματισμένη εργασία — ένα έγγραφο ανά `slug`
   * (`lastSuccessAt`, `leaseExpiresAt`, `consecutiveFailures`).
   *
   * ⚠️ **deny-all** στο firestore.rules: γράφεται αποκλειστικά από το Admin SDK μέσα
   * από τον dispatcher. Ένας client που μπορούσε να γράψει εδώ θα μπορούσε να
   * παρατείνει ένα lease επ' αόριστον — δηλαδή να **σταματήσει τα αντίγραφα ασφαλείας**
   * χωρίς να αγγίξει τίποτε άλλο.
   *
   * Το ID του εγγράφου είναι το `slug` της εργασίας και **όχι** enterprise ID: το
   * κλείδωμα απαιτεί ντετερμινιστικό κλειδί — δύο εκτελέσεις πρέπει να συγκρούονται
   * στο **ίδιο** έγγραφο, αλλιώς δεν υπάρχει κλείδωμα. Ίδιο σκεπτικό με τα singleton
   * έγγραφα ρυθμίσεων κάτω από `system/`.
   */
  CRON_JOB_STATE: 'cron_job_state',

  /**
   * 🔒 ADR-853 Ε3 Φάση 2 — **Η ΜΝΗΜΗ ΤΟΥ ΣΥΝΟΡΟΥ ΙΔΕΜΠΟΤΙΑΣ**: ένα έγγραφο ανά (εντολέας, μέθοδος, διαδρομή,
   * `Idempotency-Key`) — κλείδωμα όσο τρέχει η πράξη, αποθηκευμένη απάντηση μετά (Stripe · IETF draft).
   * Ντετερμινιστικό ID ⇒ δύο αιτήματα με το ίδιο κλειδί συγκρούονται στο **ίδιο** έγγραφο. Λήγει σε 24 ώρες
   * (πολιτική TTL στο `expiresAt`). **Μόνο Admin SDK**: η απάντηση μπορεί να κουβαλά προσωπικά δεδομένα.
   */
  IDEMPOTENCY_RECORDS: 'idempotency_records',

  /**
   * 🔒 ADR-873 Φ1 §9.1 — **Ο ΔΕΙΚΤΗΣ «ΑΥΤΗ Η ΑΛΛΑΓΗ ΕΓΙΝΕ ΗΔΗ»** των Cloud Functions: ένα έγγραφο ανά
   * αλλαγή (ή ανά επιχειρηματική ταυτότητα), με ντετερμινιστικό ID από τον σπόρο ⇒ κάθε παρατηρητής
   * του **ίδιου** γεγονότος φτάνει στο **ίδιο** έγγραφο και το `create()` αποτυγχάνει στον δεύτερο.
   *
   * 🔴 **ΓΙΑΤΙ ΟΧΙ η `idempotency_records`**: εκείνη κρατά **HTTP απάντηση προς αναπαραγωγή** — ένα
   * γεγονός **δεν έχει απάντηση**. Δύο σχήματα σε μία συλλογή θα ήταν δύο αλήθειες που αποκλίνουν
   * σιωπηλά· ένας γραφέας, ένα σχήμα (απόφαση Giorgio 2026-09-22).
   *
   * ⛔ **ΔΕΝ γράφεται για κάθε trigger**: όπου ο στόχος κουβαλά μόνος του έκδοση ή ταυτότητα
   * (search index με `sourceUpdateTime`) ο φρουρός είναι **φυσικός** και έγγραφο εδώ θα ήταν
   * διπλάσιες εγγραφές για μηδέν κέρδος. Δες `lib/idempotency/event-claim.ts`.
   *
   * **Μόνο Admin SDK.** Λήγει (πολιτική TTL στο `expiresAt`).
   */
  FUNCTION_EVENT_RECORDS: 'function_event_records',

  // 📋 AUDIT LOGS
  SYSTEM_AUDIT_LOGS: process.env.NEXT_PUBLIC_SYSTEM_AUDIT_LOGS_COLLECTION || 'system_audit_logs',
  /** Cloud Function audit log (orphan cleanup, system events) */
  CLOUD_FUNCTION_AUDIT_LOG: process.env.NEXT_PUBLIC_CLOUD_FUNCTION_AUDIT_LOG_COLLECTION || 'audit_log',
  /**
   * Υποψήφιοι προς ανάκτηση χώρου (ADR-694 Α1) — η πλευρά «mark» ενός mark-and-sweep.
   * Γράφεται από το `onStorageFinalize`, καταναλώνεται από τον `orphanSweeper`.
   * ⚠️ Το `functions/src/config/firestore-collections.ts` κατοπτρίζει αυτή την τιμή.
   */
  STORAGE_ORPHAN_CANDIDATES: process.env.NEXT_PUBLIC_STORAGE_ORPHAN_CANDIDATES_COLLECTION || 'storage_orphan_candidates',
  /**
   * Ωριαίος κουβάς «ειδοποιήθηκε ήδη» του `orphanSpikeAlert` — ID εγγράφου = `yyyy-MM-ddTHH` (UTC),
   * **όχι** enterprise ID: η κράτηση απαιτεί ντετερμινιστικό κλειδί, ίδιο σκεπτικό με το
   * `CRON_JOB_STATE` από πάνω.
   *
   * 🔴 **Ε-873.8 (ADR-873 Φ1)**: μέχρι τις 2026-09-22 η τιμή ήταν **χειρόγραφη** μέσα στο
   * `functions/src/storage/orphan-spike-alert.ts` — το **6ο** αντίγραφο που ξέφυγε από την
   * απογραφή του ADR-874, και χωρίς μπλοκ κανόνων. Τώρα προβάλλεται από εδώ.
   */
  STORAGE_ORPHAN_SPIKE_ALERTS: 'system_orphan_spike_alerts',

  // 🏗️ CONSTRUCTION PHASES, TASKS & BASELINES (ADR-034, ADR-266)
  CONSTRUCTION_PHASES: process.env.NEXT_PUBLIC_CONSTRUCTION_PHASES_COLLECTION || 'construction_phases',
  CONSTRUCTION_TASKS: process.env.NEXT_PUBLIC_CONSTRUCTION_TASKS_COLLECTION || 'construction_tasks',
  CONSTRUCTION_BASELINES: process.env.NEXT_PUBLIC_CONSTRUCTION_BASELINES_COLLECTION || 'construction_baselines',
  CONSTRUCTION_RESOURCE_ASSIGNMENTS: process.env.NEXT_PUBLIC_CONSTRUCTION_RESOURCE_ASSIGNMENTS_COLLECTION || 'construction_resource_assignments',
  CONSTRUCTION_ALERTS: process.env.NEXT_PUBLIC_CONSTRUCTION_ALERTS_COLLECTION || 'construction_alerts',

  // 🏗️ BUILDING MILESTONES (Building Timeline CRUD)
  BUILDING_MILESTONES: process.env.NEXT_PUBLIC_BUILDING_MILESTONES_COLLECTION || 'building_milestones',

  // 👷 IKA/EFKA LABOR COMPLIANCE (ADR-090)
  ATTENDANCE_EVENTS: process.env.NEXT_PUBLIC_ATTENDANCE_EVENTS_COLLECTION || 'attendance_events',
  ATTENDANCE_QR_TOKENS: process.env.NEXT_PUBLIC_ATTENDANCE_QR_TOKENS_COLLECTION || 'attendance_qr_tokens',
  EMPLOYMENT_RECORDS: process.env.NEXT_PUBLIC_EMPLOYMENT_RECORDS_COLLECTION || 'employment_records',
  DIGITAL_WORK_CARDS: process.env.NEXT_PUBLIC_DIGITAL_WORK_CARDS_COLLECTION || 'digital_work_cards',

  // 🇪🇺 ESCO PROFESSIONAL CLASSIFICATION (ADR-132)
  // Cached subset of EU ESCO occupations taxonomy (~3.039 occupations, EL+EN)
  // Subcollection path: system/esco_cache/occupations
  ESCO_CACHE: process.env.NEXT_PUBLIC_ESCO_CACHE_COLLECTION || 'system/esco_cache/occupations',

  // 🇪🇺 ESCO SKILLS CLASSIFICATION (ADR-132)
  // Cached subset of EU ESCO skills taxonomy (~13.485 skills, EL+EN)
  // Subcollection path: system/esco_cache/skills
  ESCO_SKILLS_CACHE: process.env.NEXT_PUBLIC_ESCO_SKILLS_CACHE_COLLECTION || 'system/esco_cache/skills',

  // 📊 ACCOUNTING (Subapp — ADR-ACC-001 through ADR-ACC-010)
  ACCOUNTING_JOURNAL_ENTRIES: process.env.NEXT_PUBLIC_ACCOUNTING_JOURNAL_ENTRIES_COLLECTION || 'accounting_journal_entries',
  ACCOUNTING_INVOICES: process.env.NEXT_PUBLIC_ACCOUNTING_INVOICES_COLLECTION || 'accounting_invoices',
  ACCOUNTING_INVOICE_COUNTERS: process.env.NEXT_PUBLIC_ACCOUNTING_INVOICE_COUNTERS_COLLECTION || 'accounting_invoice_counters',
  ACCOUNTING_SETTINGS: process.env.NEXT_PUBLIC_ACCOUNTING_SETTINGS_COLLECTION || 'accounting_settings',
  ACCOUNTING_BANK_TRANSACTIONS: process.env.NEXT_PUBLIC_ACCOUNTING_BANK_TRANSACTIONS_COLLECTION || 'accounting_bank_transactions',
  ACCOUNTING_BANK_ACCOUNTS: process.env.NEXT_PUBLIC_ACCOUNTING_BANK_ACCOUNTS_COLLECTION || 'accounting_bank_accounts',
  ACCOUNTING_FIXED_ASSETS: process.env.NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS_COLLECTION || 'accounting_fixed_assets',
  ACCOUNTING_DEPRECIATION_RECORDS: process.env.NEXT_PUBLIC_ACCOUNTING_DEPRECIATION_RECORDS_COLLECTION || 'accounting_depreciation_records',
  ACCOUNTING_EFKA_PAYMENTS: process.env.NEXT_PUBLIC_ACCOUNTING_EFKA_PAYMENTS_COLLECTION || 'accounting_efka_payments',
  ACCOUNTING_EFKA_CONFIG: process.env.NEXT_PUBLIC_ACCOUNTING_EFKA_CONFIG_COLLECTION || 'accounting_efka_config',
  ACCOUNTING_EXPENSE_DOCUMENTS: process.env.NEXT_PUBLIC_ACCOUNTING_EXPENSE_DOCUMENTS_COLLECTION || 'accounting_expense_documents',
  ACCOUNTING_IMPORT_BATCHES: process.env.NEXT_PUBLIC_ACCOUNTING_IMPORT_BATCHES_COLLECTION || 'accounting_import_batches',
  ACCOUNTING_TAX_INSTALLMENTS: process.env.NEXT_PUBLIC_ACCOUNTING_TAX_INSTALLMENTS_COLLECTION || 'accounting_tax_installments',
  ACCOUNTING_APY_CERTIFICATES: process.env.NEXT_PUBLIC_ACCOUNTING_APY_CERTIFICATES_COLLECTION || 'accounting_apy_certificates',
  ACCOUNTING_CUSTOM_CATEGORIES: process.env.NEXT_PUBLIC_ACCOUNTING_CUSTOM_CATEGORIES_COLLECTION || 'accounting_custom_categories',
  ACCOUNTING_CUSTOMER_BALANCES: process.env.NEXT_PUBLIC_ACCOUNTING_CUSTOMER_BALANCES_COLLECTION || 'accounting_customer_balances',
  ACCOUNTING_FISCAL_PERIODS: process.env.NEXT_PUBLIC_ACCOUNTING_FISCAL_PERIODS_COLLECTION || 'accounting_fiscal_periods',
  ACCOUNTING_MATCHING_RULES: process.env.NEXT_PUBLIC_ACCOUNTING_MATCHING_RULES_COLLECTION || 'accounting_matching_rules',
  ACCOUNTING_AUDIT_LOG: process.env.NEXT_PUBLIC_ACCOUNTING_AUDIT_LOG_COLLECTION || 'accounting_audit_log',

  // 📄 FILE AUDIT LOG (ADR-191: Enterprise Document Management — Phase 3.1)
  FILE_AUDIT_LOG: process.env.NEXT_PUBLIC_FILE_AUDIT_LOG_COLLECTION || 'file_audit_log',
  // 📒 ADR-866 §2.6.11 — η ΔΡΑΣΤΗΡΙΟΤΗΤΑ των προσωπικών αρχείων: το ΙΔΙΟ σύστημα, ξεχωριστό διαμέρισμα
  //    (`FILE_AUDIT_COLLECTION` στο `lib/files/file-custody.ts`). Τη διαβάζει ΜΟΝΟ ο κάτοχος.
  FILE_AUDIT_LOG_PERSONAL: process.env.NEXT_PUBLIC_FILE_AUDIT_LOG_PERSONAL_COLLECTION || 'file_audit_log_personal',

  /**
   * 🔗 FILE SHARES (ADR-191: Enterprise Document Management — Phase 4.2)
   * @deprecated ADR-315 Phase M5: will be replaced by SHARES. Legacy reads during M1–M4 migration window.
   */
  FILE_SHARES: process.env.NEXT_PUBLIC_FILE_SHARES_COLLECTION || 'file_shares',

  // 📸 PHOTO SHARES — CRM Contact Channel Share History
  PHOTO_SHARES: process.env.NEXT_PUBLIC_PHOTO_SHARES_COLLECTION || 'photo_shares',

  // 🔗 UNIFIED SHARES (ADR-315: Polymorphic sharing SSoT — file + contact + property_showcase)
  SHARES: process.env.NEXT_PUBLIC_SHARES_COLLECTION || 'shares',
  // 📤 SHARE DISPATCHES (ADR-315: One record per channel send — email / telegram / whatsapp / messenger / instagram)
  SHARE_DISPATCHES: process.env.NEXT_PUBLIC_SHARE_DISPATCHES_COLLECTION || 'share_dispatches',

  // 💬 FILE COMMENTS (ADR-191: Enterprise Document Management — Phase 4.3)
  FILE_COMMENTS: process.env.NEXT_PUBLIC_FILE_COMMENTS_COLLECTION || 'file_comments',

  // 📁 FILE FOLDERS (ADR-191: Enterprise Document Management — Phase 4.4)
  FILE_FOLDERS: process.env.NEXT_PUBLIC_FILE_FOLDERS_COLLECTION || 'file_folders',

  // ✅ FILE APPROVALS (ADR-191: Enterprise Document Management — Phase 3.3)
  FILE_APPROVALS: process.env.NEXT_PUBLIC_FILE_APPROVALS_COLLECTION || 'file_approvals',

  // 📦 DOCUMENT TEMPLATES (ADR-191: Enterprise Document Management — Phase 4.1)
  DOCUMENT_TEMPLATES: process.env.NEXT_PUBLIC_DOCUMENT_TEMPLATES_COLLECTION || 'document_templates',

  // 📜 ENTITY AUDIT TRAIL (ADR-195: Entity Change History)
  ENTITY_AUDIT_TRAIL: process.env.NEXT_PUBLIC_ENTITY_AUDIT_TRAIL_COLLECTION || 'entity_audit_trail',
  // 📒 ADR-864 Φ1β — το ΠΡΟΣΩΠΙΚΟ βιβλίο του ίδιου συστήματος (`lib/audit/audit-ledger.ts`).
  //    Ξεχωριστό διαμέρισμα και όχι πεδίο στην παραπάνω, γιατί οι κανόνες Firestore ΔΕΝ
  //    φιλτράρουν: μια εξαίρεση «όχι τα προσωπικά» στην ίδια συλλογή θα απέρριπτε ΟΛΟΚΛΗΡΟ το
  //    αφιλτράριστο ερώτημα του super admin. Πρότυπο GitHub (security log ≠ org audit log) ·
  //    Google Cloud (log bucket ανά κάτοχο). Ίδιο σχήμα, ίδια υπηρεσία, ίδιος αναγνώστης.
  ENTITY_AUDIT_TRAIL_PERSONAL: process.env.NEXT_PUBLIC_ENTITY_AUDIT_TRAIL_PERSONAL_COLLECTION || 'entity_audit_trail_personal',

  // 📍 ADDRESS CORRECTIONS LOG (ADR-332 §3.7 Phase 9: Telemetry)
  ADDRESS_CORRECTIONS_LOG: process.env.NEXT_PUBLIC_ADDRESS_CORRECTIONS_LOG_COLLECTION || 'address_corrections_log',

  // 📐 BOQ / QUANTITY SURVEYING (ADR-175: Σύστημα Επιμετρήσεων)
  BOQ_ITEMS: process.env.NEXT_PUBLIC_BOQ_ITEMS_COLLECTION || 'boq_items',
  BOQ_CATEGORIES: process.env.NEXT_PUBLIC_BOQ_CATEGORIES_COLLECTION || 'boq_categories',
  BOQ_SYSTEM_SUBCATEGORIES: process.env.NEXT_PUBLIC_BOQ_SYSTEM_SUBCATEGORIES_COLLECTION || 'boq_system_subcategories',
  BOQ_PRICE_LISTS: process.env.NEXT_PUBLIC_BOQ_PRICE_LISTS_COLLECTION || 'boq_price_lists',
  BOQ_TEMPLATES: process.env.NEXT_PUBLIC_BOQ_TEMPLATES_COLLECTION || 'boq_templates',

  // 🧾 CHEQUE REGISTRY (ADR-234 Phase 3 — SPEC-234A)
  CHEQUES: process.env.NEXT_PUBLIC_CHEQUES_COLLECTION || 'cheques',

  // ⚖️ LEGAL CONTRACTS & BROKERAGE (ADR-230: Contract Workflow & Legal Process)
  LEGAL_CONTRACTS: process.env.NEXT_PUBLIC_LEGAL_CONTRACTS_COLLECTION || 'legal_contracts',
  BROKERAGE_AGREEMENTS: process.env.NEXT_PUBLIC_BROKERAGE_AGREEMENTS_COLLECTION || 'brokerage_agreements',
  COMMISSION_RECORDS: process.env.NEXT_PUBLIC_COMMISSION_RECORDS_COLLECTION || 'commission_records',

  // 📊 OWNERSHIP PERCENTAGE TABLE (ADR-235: Πίνακας Χιλιοστών Συνιδιοκτησίας)
  OWNERSHIP_TABLES: process.env.NEXT_PUBLIC_OWNERSHIP_TABLES_COLLECTION || 'ownership_tables',

  /** @deprecated ADR-292 Phase 4: Legacy reads eliminated. All floor floorplans in FILES collection. */
  FLOOR_FLOORPLANS: process.env.NEXT_PUBLIC_FLOOR_FLOORPLANS_COLLECTION || 'floor_floorplans',

  // 🔗 FILE WEBHOOKS (ADR-191: Enterprise Document Management — Phase 5.4)
  FILE_WEBHOOKS: process.env.NEXT_PUBLIC_FILE_WEBHOOKS_COLLECTION || 'file_webhooks',

  // 📦 PROCUREMENT (ADR-267: Lightweight Procurement Module)
  PURCHASE_ORDERS: process.env.NEXT_PUBLIC_PURCHASE_ORDERS_COLLECTION || 'purchase_orders',
  PURCHASE_ORDER_COUNTERS: process.env.NEXT_PUBLIC_PURCHASE_ORDER_COUNTERS_COLLECTION || 'purchase_order_counters',
  PO_SHARES: process.env.NEXT_PUBLIC_PO_SHARES_COLLECTION || 'po_shares',

  // 📊 SAVED REPORTS (ADR-268 Phase 7: Saved Reports)
  SAVED_REPORTS: process.env.NEXT_PUBLIC_SAVED_REPORTS_COLLECTION || 'saved_reports',

  // 📋 QUOTES & RFQ (ADR-327: Quote Management & Comparison System)
  RFQS: process.env.NEXT_PUBLIC_RFQS_COLLECTION || 'rfqs',
  QUOTES: process.env.NEXT_PUBLIC_QUOTES_COLLECTION || 'quotes',
  QUOTE_COUNTERS: process.env.NEXT_PUBLIC_QUOTE_COUNTERS_COLLECTION || 'quote_counters',
  VENDOR_INVITES: process.env.NEXT_PUBLIC_VENDOR_INVITES_COLLECTION || 'vendor_invites',
  VENDOR_INVITE_TOKENS: process.env.NEXT_PUBLIC_VENDOR_INVITE_TOKENS_COLLECTION || 'vendor_invite_tokens',
  TRADES: process.env.NEXT_PUBLIC_TRADES_COLLECTION || 'trades',
  // ADR-327 §17 Q28-Q31 Multi-Vendor extension (2026-04-29)
  SOURCING_EVENTS: process.env.NEXT_PUBLIC_SOURCING_EVENTS_COLLECTION || 'sourcing_events',
  RFQ_LINES_SUB: 'lines',

  // 📦 MATERIAL CATALOG (ADR-330 Phase 4)
  MATERIALS: process.env.NEXT_PUBLIC_MATERIALS_COLLECTION || 'materials',

  // 📜 FRAMEWORK AGREEMENTS (ADR-330 Phase 5)
  FRAMEWORK_AGREEMENTS:
    process.env.NEXT_PUBLIC_FRAMEWORK_AGREEMENTS_COLLECTION || 'framework_agreements',

  // 🪜 DXF STAIR TOOL — ADR-358 (companyId-scoped, Phase 1)
  /** Parametric stair entities, 11 kinds, IfcStair-aligned. FK → floorplans. IDs via stair_* prefix. */
  FLOORPLAN_STAIRS: process.env.NEXT_PUBLIC_FLOORPLAN_STAIRS_COLLECTION || 'floorplan_stairs',
  /** Stair library presets (3 scopes: user/company/project). Discriminator `scope` + tenant fields. IDs via sprst_* prefix. */
  STAIR_PRESETS: process.env.NEXT_PUBLIC_STAIR_PRESETS_COLLECTION || 'stair_presets',
  /** Shared parametric BIM family type definitions (system/company/project scope). IDs via bimftype_* prefix. */
  BIM_FAMILY_TYPES: process.env.NEXT_PUBLIC_BIM_FAMILY_TYPES_COLLECTION || 'bim_family_types',

  // 🗂️ DXF LAYER STATE TEMPLATES — ADR-358 §5.9 Q12 Phase 13B (cross-project shareable layer states, companyId-scoped)
  /** Cross-project layer state templates. Schema: { id, companyId, name, description?, tags[], category, snapshot[], createdBy, createdAt, updatedAt, deletedAt? }. IDs via lstpl_* prefix. */
  DXF_LAYER_STATE_TEMPLATES:
    process.env.NEXT_PUBLIC_DXF_LAYER_STATE_TEMPLATES_COLLECTION || 'dxf_layer_state_templates',
  /** Per-company free-string category catalog for layer state templates. Auto-created when a user saves a template with a novel category. Schema: { id, companyId, value, createdBy, createdAt }. IDs via lstcat_* prefix. */
  DXF_TEMPLATE_CATEGORIES:
    process.env.NEXT_PUBLIC_DXF_TEMPLATE_CATEGORIES_COLLECTION || 'dxf_template_categories',

  // 🏗️ DXF BIM DRAWING MODE — ADR-363 (companyId-scoped, Phase 0 Bootstrap)
  /** Parametric wall entities (3 kinds: straight/curved/polyline). IDs via wall_* prefix. */
  FLOORPLAN_WALLS: process.env.NEXT_PUBLIC_FLOORPLAN_WALLS_COLLECTION || 'floorplan_walls',
  /** Door/window/sliding-door/french-door/fixed openings hosted in walls. IDs via opening_* prefix. */
  FLOORPLAN_OPENINGS: process.env.NEXT_PUBLIC_FLOORPLAN_OPENINGS_COLLECTION || 'floorplan_openings',
  /** Floor/ceiling/roof/ground/foundation slabs with polygon outline. IDs via slab_* prefix. */
  FLOORPLAN_SLABS: process.env.NEXT_PUBLIC_FLOORPLAN_SLABS_COLLECTION || 'floorplan_slabs',
  /** Slab cutouts: elevator shaft, stair well, duct, chimney. IDs via slbopn_* prefix. */
  FLOORPLAN_SLAB_OPENINGS: process.env.NEXT_PUBLIC_FLOORPLAN_SLAB_OPENINGS_COLLECTION || 'floorplan_slab_openings',
  /** Rectangular/circular/L-shape/T-shape columns. IDs via col_* prefix. */
  FLOORPLAN_COLUMNS: process.env.NEXT_PUBLIC_FLOORPLAN_COLUMNS_COLLECTION || 'floorplan_columns',
  /** Straight/curved/cantilever beams. IDs via beam_* prefix. */
  FLOORPLAN_BEAMS: process.env.NEXT_PUBLIC_FLOORPLAN_BEAMS_COLLECTION || 'floorplan_beams',
  /** ADR-436 — substructure footings (pad/strip/tie-beam, IfcFooting). IDs via fnd_* prefix. */
  FLOORPLAN_FOUNDATIONS: process.env.NEXT_PUBLIC_FLOORPLAN_FOUNDATIONS_COLLECTION || 'floorplan_foundations',
  /** ADR-441/189 — per-floor construction grid (axes + groups, 1 doc/floor). IDs via grd_* prefix. */
  FLOORPLAN_GRID_GUIDES: process.env.NEXT_PUBLIC_FLOORPLAN_GRID_GUIDES_COLLECTION || 'floorplan_grid_guides',
  /** ADR-650 — per-floor topographic surface DEFINITION (survey points/breaklines/boundary + settings, 1 doc/floor). IDs via topo_* prefix. */
  FLOORPLAN_TOPO_SURFACES: process.env.NEXT_PUBLIC_FLOORPLAN_TOPO_SURFACES_COLLECTION || 'floorplan_topo_surfaces',
  /** ADR-406 — point-based MEP fixtures (light fixtures first). IDs via mepfix_* prefix. */
  FLOORPLAN_MEP_FIXTURES: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_FIXTURES_COLLECTION || 'floorplan_mep_fixtures',
  /** ADR-407 — standalone path-based railings. IDs via ral_* prefix. */
  FLOORPLAN_RAILINGS: process.env.NEXT_PUBLIC_FLOORPLAN_RAILINGS_COLLECTION || 'floorplan_railings',
  /** ADR-417 — parametric pitched roofs (footprint + per-edge slopes). IDs via roof_* prefix. */
  FLOORPLAN_ROOFS: process.env.NEXT_PUBLIC_FLOORPLAN_ROOFS_COLLECTION || 'floorplan_roofs',
  /** ADR-419 — thin floor coverings per room (IfcCovering FLOORING). IDs via ffl_* prefix. */
  FLOORPLAN_FLOOR_FINISHES: process.env.NEXT_PUBLIC_FLOORPLAN_FLOOR_FINISHES_COLLECTION || 'floorplan_floor_finishes',
  /** ADR-511 — wall finish per room/face (IfcCovering CLADDING/INTERIOR). IDs via wcv_* prefix. */
  FLOORPLAN_WALL_COVERINGS: process.env.NEXT_PUBLIC_FLOORPLAN_WALL_COVERINGS_COLLECTION || 'floorplan_wall_coverings',
  /** ADR-507 — flat DXF hatch fills (Revit Filled-Region). IDs via hatch_* prefix. */
  FLOORPLAN_HATCHES: process.env.NEXT_PUBLIC_FLOORPLAN_HATCHES_COLLECTION || 'floorplan_hatches',
  /** ADR-422 — analytical thermal spaces per room (IfcSpace). IDs via tsp_* prefix. */
  FLOORPLAN_THERMAL_SPACES: process.env.NEXT_PUBLIC_FLOORPLAN_THERMAL_SPACES_COLLECTION || 'floorplan_thermal_spaces',
  /** ADR-437 — space separators per floorplan (IfcVirtualElement). IDs via ssp_* prefix. */
  FLOORPLAN_SPACE_SEPARATORS: process.env.NEXT_PUBLIC_FLOORPLAN_SPACE_SEPARATORS_COLLECTION || 'floorplan_space_separators',
  /** ADR-408 — logical MEP systems (electrical circuits first; geometry-less). IDs via mepsys_* prefix. */
  FLOORPLAN_MEP_SYSTEMS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_SYSTEMS_COLLECTION || 'floorplan_mep_systems',
  /** ADR-408 Φ3 — point-based electrical panels (circuit sources). IDs via elecpnl_* prefix. */
  FLOORPLAN_ELECTRICAL_PANELS: process.env.NEXT_PUBLIC_FLOORPLAN_ELECTRICAL_PANELS_COLLECTION || 'floorplan_electrical_panels',
  /** ADR-408 Φ8 — linear duct/pipe MEP segments. IDs via mepseg_* prefix. */
  FLOORPLAN_MEP_SEGMENTS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_SEGMENTS_COLLECTION || 'floorplan_mep_segments',
  /** ADR-408 Φ11 — auto pipe fittings (junction elements). IDs via mepfit_* prefix. */
  FLOORPLAN_MEP_FITTINGS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_FITTINGS_COLLECTION || 'floorplan_mep_fittings',
  /** ADR-408 Φ12 — point-based plumbing manifolds (pipe-network sources). IDs via mfld_* prefix. */
  FLOORPLAN_MEP_MANIFOLDS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_MANIFOLDS_COLLECTION || 'floorplan_mep_manifolds',
  /** ADR-408 Εύρος Β — point-based heating radiators (hydronic terminals). IDs via rad_* prefix. */
  FLOORPLAN_MEP_RADIATORS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_RADIATORS_COLLECTION || 'floorplan_mep_radiators',
  /** ADR-408 Εύρος Β #2 — point-based heating boilers (hydronic sources). IDs via blr_* prefix. */
  FLOORPLAN_MEP_BOILERS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_BOILERS_COLLECTION || 'floorplan_mep_boilers',
  /** ADR-408 / water-heater — point-based domestic hot-water heaters (IfcWaterHeater). IDs via wh_* prefix. */
  FLOORPLAN_MEP_WATER_HEATERS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_WATER_HEATERS_COLLECTION || 'floorplan_mep_water_heaters',
  /** ADR-408 Εύρος Β #3 — area-based radiant floor heating loops (hydronic terminals). IDs via uhf_* prefix. */
  FLOORPLAN_MEP_UNDERFLOORS: process.env.NEXT_PUBLIC_FLOORPLAN_MEP_UNDERFLOORS_COLLECTION || 'floorplan_mep_underfloors',
  /** ADR-410 — mesh-based CC0 furniture (chair first). IDs via furn_* prefix. */
  FLOORPLAN_FURNITURE: process.env.NEXT_PUBLIC_FLOORPLAN_FURNITURE_COLLECTION || 'floorplan_furniture',
  /** ADR-415 — pure-vector 2D floorplan symbols (WC/sanitary first). IDs via fpsym_* prefix. */
  FLOORPLAN_SYMBOLS: process.env.NEXT_PUBLIC_FLOORPLAN_SYMBOLS_COLLECTION || 'floorplan_symbols',
  /** ADR-683 Φ3β — baked meshes imported from a collaborator's glTF. IDs via imesh_* prefix. */
  FLOORPLAN_IMPORTED_MESHES: process.env.NEXT_PUBLIC_FLOORPLAN_IMPORTED_MESHES_COLLECTION || 'floorplan_imported_meshes',
  /** ADR-684 — parametric geometric solids (box/sphere/…/torus/pyramid). IDs via gsol_* prefix. */
  FLOORPLAN_GENERIC_SOLIDS: process.env.NEXT_PUBLIC_FLOORPLAN_GENERIC_SOLIDS_COLLECTION || 'floorplan_generic_solids',
  /** BIM element presets (system/company/project/user scope). IDs via bpst_* prefix. */
  BIM_PRESETS: process.env.NEXT_PUBLIC_BIM_PRESETS_COLLECTION || 'bim_presets',
  /** Material library — 25 seeded generics (Phase 6+). IDs via bmat_* prefix. */
  BIM_MATERIALS: process.env.NEXT_PUBLIC_BIM_MATERIALS_COLLECTION || 'bim_materials',
  /** Block library — 2D DXF block content (user/company/project/system scope), ADR-652 M2. IDs via blklib_* prefix. */
  BLOCK_LIBRARY: process.env.NEXT_PUBLIC_BLOCK_LIBRARY_COLLECTION || 'block_library',
  /** Per-company BIM configuration (hotkeys, defaults, layer convention). IDs via bset_* prefix. */
  BIM_SETTINGS: process.env.NEXT_PUBLIC_BIM_SETTINGS_COLLECTION || 'bim_settings',
  /** Opening frame/casing presets — user library (ADR-676). IDs via frmpst_* prefix. Subcollection under companies/{cid}. */
  OPENING_FRAME_PRESETS: process.env.NEXT_PUBLIC_OPENING_FRAME_PRESETS_COLLECTION || 'opening_frame_presets',

  // ✏️ DXF TEXT ENGINE — ADR-344 (companyId-scoped, Phase 0)
  /** Hybrid text templates: TS built-in defaults + per-company overrides. Schema: { id, companyId, name, category, content (DxfTextNode), placeholders[], isDefault }. IDs via tpl_text_* prefix. */
  TEXT_TEMPLATES: process.env.NEXT_PUBLIC_TEXT_TEMPLATES_COLLECTION || 'text_templates',
  /** ADR-651 Φάση Η — project-level drawing revisions (Revit Sheet Issues/Revisions). Append-only history: { id, companyId, projectId, number, issuedAt, authorId, authorName, description, snapshot, digest }. IDs via drev_* prefix. */
  DRAWING_REVISIONS: process.env.NEXT_PUBLIC_DRAWING_REVISIONS_COLLECTION || 'drawing_revisions',
  /** Per-company CAD/architectural term additions for the nspell spell-checker (Q6). Schema: { id, companyId, term, addedBy, addedAt }. IDs via dict_* prefix. */
  TEXT_CUSTOM_DICTIONARY: process.env.NEXT_PUBLIC_TEXT_CUSTOM_DICTIONARY_COLLECTION || 'text_custom_dictionary',
  /** Company-uploaded TTF/OTF/SHX fonts served via Firebase Storage signed URL (Q18). Schema: { id, companyId, name, fileName, format, uploadedBy, uploadedAt, size }. IDs via fnt_* prefix. */
  COMPANY_FONTS: process.env.NEXT_PUBLIC_COMPANY_FONTS_COLLECTION || 'company_fonts',

  // 📊 PERFORMANCE DIAGNOSTICS — ADR-366 §B.5 (3D BIM Viewer Performance HUD)
  /** User-submitted performance snapshots: 10 render metrics + screenshot + scene info + comment. Super-admin curation. IDs via perfdiag_* prefix. */
  PERFORMANCE_DIAGNOSTICS:
    process.env.NEXT_PUBLIC_PERFORMANCE_DIAGNOSTICS_COLLECTION || 'performance_diagnostics',

  // 🎨 BIM RENDERS — ADR-366 §B.4 Phase 6 (Final Render Dialog)
  /** Photoreal render exports per project: metadata + Storage path. IDs via bimrnd_* prefix. type='bim-render'. */
  BIM_RENDERS: process.env.NEXT_PUBLIC_BIM_RENDERS_COLLECTION || 'bim_renders',

  // 🎛️ BIM 3D PREFERENCES — ADR-366 Phase 4.3 (per-user viewport UI preferences)
  /** Per-user 3D BIM viewport preferences (compass ring, etc.). IDs via b3dpref_* prefix. Owner-only. */
  BIM_3D_PREFERENCES: process.env.NEXT_PUBLIC_BIM_3D_PREFERENCES_COLLECTION || 'bim_3d_preferences',

  // 📏 BIM DIMENSIONS 3D — ADR-366 Phase 9 / C.3 (manual 3D dimensions)
  /** Manual 3D dimensions per project (aligned/linear/radial/angular). Company-scoped via companyId. IDs via dim3d_* prefix. */
  BIM_DIMENSIONS_3D:
    process.env.NEXT_PUBLIC_BIM_DIMENSIONS_3D_COLLECTION || 'bim_dimensions_3d',

  // 💬 BIM COMMENTS — ADR-366 Phase 9 / C.2 (typed BIM comment markers)
  /** Typed comment markers per project (Issue/Question/Suggestion/Approval/Info). Company-scoped via companyId. IDs via cmt_bim_* prefix. Replies live in subcollection SUBCOLLECTIONS.BIM_COMMENT_REPLIES. */
  BIM_COMMENTS:
    process.env.NEXT_PUBLIC_BIM_COMMENTS_COLLECTION || 'bim_comments',

  // 📡 BIM PERFORMANCE TELEMETRY — ADR-366 §C.7.Q3 (GDPR anonymous samples)
  /** Anonymous performance samples. TOP-LEVEL (no companyId field — anonymity preserved). Super-admin read-only, server-only writes via Admin SDK, 30-day TTL on createdAt. IDs via telm_bim_* prefix. */
  BIM_PERFORMANCE_TELEMETRY:
    process.env.NEXT_PUBLIC_BIM_PERFORMANCE_TELEMETRY_COLLECTION || 'bim_performance_telemetry',

  // 🎬 BIM ANIMATIONS — ADR-366 Phase 9 / C.1.a (camera turntable + waypoint animations)
  /** Camera animation configs per project (turntable / waypoint flythrough). Company-scoped via companyId. IDs via anm_bim_* prefix. Render jobs live in subcollection SUBCOLLECTIONS.BIM_RENDER_JOBS. */
  BIM_ANIMATIONS:
    process.env.NEXT_PUBLIC_BIM_ANIMATIONS_COLLECTION || 'bim_animations',

  // 🪣 ISO 19650 ENRICHMENT SLOTS — ADR-373 P2.4 (distributed token bucket, server-only)
  /** Per-company distributed token bucket for AI enrichment concurrency control. Doc ID = companyId. Admin SDK only — client access forbidden. */
  ISO19650_ENRICHMENT_SLOTS: 'iso19650_enrichment_slots',

  // 💰 ISO 19650 COST LOGS — ADR-373 P2.5 (per-file AI enrichment cost tracking, server-only)
  /** Per-file AI enrichment cost records. Queried by super_admin cost dashboard. Admin SDK only — client access forbidden. */
  ISO19650_COST_LOG: 'iso19650_cost_log',

  // 📦 ASSET PACKS — ADR-655 (gated content libraries)
  /** Ο διακόπτης διανομής ανά πακέτο: doc id = packId (φυσικό κλειδί config, όχι entity). Schema: { status: 'public'|'entitled'|'disabled' }. Admin SDK only — ο client δεν το διαβάζει ποτέ. */
  ASSET_PACK_CONFIG: 'asset_pack_config',
} as const;

// ============================================================================
// FLOOR-SCOPED BIM COLLECTIONS (ADR-420)
// ============================================================================

/**
 * The 20 floor-scoped BIM entity collections — every document carries a stable
 * `floorId` (IfcBuildingStorey, ADR-420) and is created per-floor from a
 * floorplan. Catalog / settings collections (`bim_presets`, `bim_materials`,
 * `bim_settings`, `bim_family_types`, `stair_presets`) are company/project-
 * scoped and intentionally EXCLUDED.
 *
 * Single source of truth for "iterate every per-floor BIM collection" —
 * consumed by the floor-replace wipe (`bim-floor-wipe.service`) and kept in
 * sync with `scripts/migrations/backfill-bim-floor-scope.mjs`.
 */
export const FLOOR_SCOPED_BIM_COLLECTIONS = [
  COLLECTIONS.FLOORPLAN_WALLS,
  COLLECTIONS.FLOORPLAN_OPENINGS,
  COLLECTIONS.FLOORPLAN_SLABS,
  COLLECTIONS.FLOORPLAN_SLAB_OPENINGS,
  COLLECTIONS.FLOORPLAN_COLUMNS,
  COLLECTIONS.FLOORPLAN_BEAMS,
  COLLECTIONS.FLOORPLAN_FOUNDATIONS,
  COLLECTIONS.FLOORPLAN_GRID_GUIDES,
  COLLECTIONS.FLOORPLAN_TOPO_SURFACES,
  COLLECTIONS.FLOORPLAN_STAIRS,
  COLLECTIONS.FLOORPLAN_RAILINGS,
  COLLECTIONS.FLOORPLAN_ROOFS,
  COLLECTIONS.FLOORPLAN_FLOOR_FINISHES,
  COLLECTIONS.FLOORPLAN_WALL_COVERINGS,
  COLLECTIONS.FLOORPLAN_HATCHES,
  COLLECTIONS.FLOORPLAN_ELECTRICAL_PANELS,
  COLLECTIONS.FLOORPLAN_FURNITURE,
  COLLECTIONS.FLOORPLAN_SYMBOLS,
  COLLECTIONS.FLOORPLAN_IMPORTED_MESHES,
  COLLECTIONS.FLOORPLAN_GENERIC_SOLIDS,
  COLLECTIONS.FLOORPLAN_MEP_FIXTURES,
  COLLECTIONS.FLOORPLAN_MEP_SYSTEMS,
  COLLECTIONS.FLOORPLAN_MEP_SEGMENTS,
  COLLECTIONS.FLOORPLAN_MEP_FITTINGS,
  COLLECTIONS.FLOORPLAN_MEP_MANIFOLDS,
  COLLECTIONS.FLOORPLAN_MEP_RADIATORS,
  COLLECTIONS.FLOORPLAN_MEP_BOILERS,
  COLLECTIONS.FLOORPLAN_MEP_WATER_HEATERS,
  COLLECTIONS.FLOORPLAN_MEP_UNDERFLOORS,
  COLLECTIONS.FLOORPLAN_THERMAL_SPACES,
  COLLECTIONS.FLOORPLAN_SPACE_SEPARATORS,
] as const;

export type FloorScopedBimCollection = (typeof FLOOR_SCOPED_BIM_COLLECTIONS)[number];

// ============================================================================
// SUBCOLLECTIONS
// ============================================================================

/**
 * Subcollection names for nested documents
 */
export const SUBCOLLECTIONS = {
  // Contact subcollections
  CONTACT_ACTIVITIES: process.env.NEXT_PUBLIC_CONTACT_ACTIVITIES_SUBCOL || 'activities',
  CONTACT_COMMUNICATIONS: process.env.NEXT_PUBLIC_CONTACT_COMMUNICATIONS_SUBCOL || 'communications',
  CONTACT_NOTES: process.env.NEXT_PUBLIC_CONTACT_NOTES_SUBCOL || 'notes',

  // Project subcollections
  PROJECT_TASKS: process.env.NEXT_PUBLIC_PROJECT_TASKS_SUBCOL || 'tasks',
  PROJECT_DOCUMENTS: process.env.NEXT_PUBLIC_PROJECT_DOCUMENTS_SUBCOL || 'documents',
  PROJECT_TIMELINE: process.env.NEXT_PUBLIC_PROJECT_TIMELINE_SUBCOL || 'timeline',

  // Building subcollections
  BUILDING_FLOORS: process.env.NEXT_PUBLIC_BUILDING_FLOORS_SUBCOL || 'floors',
  BUILDING_PROPERTIES: process.env.NEXT_PUBLIC_BUILDING_PROPERTIES_SUBCOL || 'properties',
  BUILDING_MAINTENANCE: process.env.NEXT_PUBLIC_BUILDING_MAINTENANCE_SUBCOL || 'maintenance',

  // Property subcollections
  PROPERTY_PHOTOS: process.env.NEXT_PUBLIC_PROPERTY_PHOTOS_SUBCOL || 'photos',
  PROPERTY_DOCUMENTS: process.env.NEXT_PUBLIC_PROPERTY_DOCUMENTS_SUBCOL || 'documents',
  PROPERTY_HISTORY: process.env.NEXT_PUBLIC_PROPERTY_HISTORY_SUBCOL || 'history',

  // Property payment subcollections (ADR-234: Payment Plan & Installment Tracking)
  PROPERTY_PAYMENT_PLANS: process.env.NEXT_PUBLIC_PROPERTY_PAYMENT_PLANS_SUBCOL || 'payment_plans',
  PROPERTY_PAYMENTS: process.env.NEXT_PUBLIC_PROPERTY_PAYMENTS_SUBCOL || 'payments',

  // User subcollections
  USER_PREFERENCES: process.env.NEXT_PUBLIC_USER_PREFERENCES_SUBCOL || 'preferences',
  USER_SESSIONS: process.env.NEXT_PUBLIC_USER_SESSIONS_SUBCOL || 'sessions',
  USER_NOTIFICATIONS: process.env.NEXT_PUBLIC_USER_NOTIFICATIONS_SUBCOL || 'notifications',

  // Company subcollections (RBAC paths: /companies/{id}/projects, /companies/{id}/properties)
  COMPANY_PROJECTS: process.env.NEXT_PUBLIC_COMPANY_PROJECTS_SUBCOL || 'projects',
  COMPANY_PROPERTIES: process.env.NEXT_PUBLIC_COMPANY_PROPERTIES_SUBCOL || 'properties',

  // Project subcollections (RBAC: /companies/{id}/projects/{id}/members)
  PROJECT_MEMBERS: process.env.NEXT_PUBLIC_PROJECT_MEMBERS_SUBCOL || 'members',

  // 🔴 ΜΕΛΟΣ ΧΩΡΟΥ — /companies/{id}/workspace_members/{uid}
  //    (ADR-244 Role Management · ADR-787 Κ-2 §5.1 γ)
  //
  //    ⚠️ ΤΟ ΟΝΟΜΑ ΕΙΝΑΙ ΜΗΧΑΝΙΣΜΟΣ, ΟΧΙ ΓΟΥΣΤΟ. Μέχρι 2026-08-22 λεγόταν
  //    `COMPANY_MEMBERS: 'members'` — **ταυτόσημο με το `PROJECT_MEMBERS`
  //    ακριβώς από πάνω**. Το Firestore απαντά το «σε ποιους χώρους ανήκω;» με
  //    collection group query, που σαρώνει **κατά όνομα συλλογής** ⇒ με το ίδιο
  //    όνομα και στα δύο επίπεδα, ένας συνεργάτης καλεσμένος σε **ΕΝΑ ΕΡΓΟ** θα
  //    επιστρεφόταν ως **μέλος ΟΛΟΚΛΗΡΟΥ ΤΟΥ ΓΡΑΦΕΙΟΥ** — σιωπηλά, με κάθε
  //    πύλη πράσινη (το Κ-3 φτάνοντας ως **σφάλμα** αντί ως λειτουργία).
  //
  //    ⛔ ΜΗΝ το επαναφέρεις σε `'members'`, και ⛔ ΜΗΝ «λύσεις» τη σύγκρουση με
  //    φίλτρο τύπου «αγνόησε όσα έχουν projectId»: φίλτρο που πρέπει να
  //    **θυμάσαι** είναι το σχήμα που το repo έχει ήδη πληρώσει στα CHECK 3.34
  //    (δύο λίστες namespace, απόκλιση 63) και 3.37 (λίστα 18 έναντι δέντρου 26).
  //
  //    ✅ Μετρημένο πριν την αλλαγή: **0 έγγραφα** στη ζωντανή συλλογή
  //       ⇒ μηδενική μετανάστευση (ADR-787 §5.1 α).
  WORKSPACE_MEMBERS: process.env.NEXT_PUBLIC_WORKSPACE_MEMBERS_SUBCOL || 'workspace_members',

  // 💬 ΝΗΜΑ ΔΙΚΤΥΟΥ — `network_threads/{nthr_*}/…` (ADR-867 §4.1 · §4.2)
  //
  // 🔴 ΤΑ ΟΝΟΜΑΤΑ ΕΙΝΑΙ ΜΗΧΑΝΙΣΜΟΣ, ΟΧΙ ΓΟΥΣΤΟ — ΤΟ ΙΔΙΟ ΜΑΘΗΜΑ ΜΕ ΤΟ `WORKSPACE_MEMBERS`
  // ΑΚΡΙΒΩΣ ΑΠΟ ΠΑΝΩ. Το προφανές όνομα για το πρώτο θα ήταν `'messages'` — και υπάρχει ΗΔΗ
  // **top-level** συλλογή `messages` (ADR-029 omnichannel, `COLLECTIONS.MESSAGES`, με δικό της
  // `match` στους κανόνες). Το Firestore απαντά το «δώσε μου όλα τα μηνύματα» με collection
  // group query, που σαρώνει **ΚΑΤΑ ΟΝΟΜΑ ΣΥΛΛΟΓΗΣ** ⇒ με το ίδιο όνομα, μια σάρωση των
  // μηνυμάτων του inbox θα επέστρεφε **και** ιδιωτικά μηνύματα δικτύου — σιωπηλά.
  //
  // ⛔ ΜΗΝ τα μετονομάσεις σε `'messages'` / `'audience'`, και ⛔ ΜΗΝ «λύσεις» τη σύγκρουση με
  // φίλτρο τύπου «αγνόησε όσα έχουν threadId»: φίλτρο που πρέπει να **θυμάσαι** είναι το
  // σχήμα που το repo έχει ήδη πληρώσει τέσσερις φορές (CHECK 3.34 · 3.37 · 3.49 · 3.57).
  NETWORK_THREAD_MESSAGES: process.env.NEXT_PUBLIC_NETWORK_THREAD_MESSAGES_SUBCOL || 'network_messages',
  NETWORK_THREAD_AUDIENCE: process.env.NEXT_PUBLIC_NETWORK_THREAD_AUDIENCE_SUBCOL || 'network_audience',
  // 🔒 ADR-867 Β9(β) Ε9 — Η ΙΔΙΩΤΙΚΗ ΠΛΕΥΡΑ ΤΗΣ ΘΕΣΗΣ (`lastReadAt` · `muted` · `following`). Χωριστό
  // έγγραφο επειδή η Firestore δεν κρύβει πεδία: στο `network_audience` τα διάβαζε η ΑΛΛΗ πλευρά.
  NETWORK_THREAD_AUDIENCE_PRIVATE:
    process.env.NEXT_PUBLIC_NETWORK_THREAD_AUDIENCE_PRIVATE_SUBCOL || 'network_audience_private',
  // 🔢 ADR-867 §4.5 Β10 — ΓΡΑΜΜΗ ΑΝΑ ΑΔΙΑΒΑΣΤΟ ΝΗΜΑ, κάτω από το κουτί του ανθρώπου. Υπάρχει ⇔ η θέση του
  // μετρά ως αδιάβαστη· το badge «Μηνύματα» = πλήθος γραμμών. ⛔ Όχι σκέτο 'unread': ίδιος λόγος με τα από πάνω.
  NETWORK_INBOX_UNREAD: process.env.NEXT_PUBLIC_NETWORK_INBOX_UNREAD_SUBCOL || 'network_inbox_unread',

  // Property subcollections (RBAC: /companies/{id}/properties/{id}/grants)
  PROPERTY_GRANTS: process.env.NEXT_PUBLIC_PROPERTY_GRANTS_SUBCOL || 'grants',

  // ⛔ `FILE_VERSIONS` ΑΦΑΙΡΕΘΗΚΕ (ADR-862 Φ0, 2026-09-17): η υποσυλλογή `files/{id}/versions`
  //    ήταν νεκρή στην παραγωγή (κανένας κανόνας ⇒ deny-all, 0 έγγραφα). Οι εκδόσεις ζουν
  //    πλέον ΜΟΝΟ ως αλυσίδα διαδοχής (`services/iso19650/version-stack.ts`).

  // Ownership table revisions (ADR-235)
  OWNERSHIP_REVISIONS: process.env.NEXT_PUBLIC_OWNERSHIP_REVISIONS_SUBCOL || 'revisions',

  // Company audit logs (ADR-210: subcollection under companies/{id})
  COMPANY_AUDIT_LOGS: process.env.NEXT_PUBLIC_COMPANY_AUDIT_LOGS_SUBCOL || 'audit_logs',

  // Contact bank accounts (subcollection under contacts/{id})
  BANK_ACCOUNTS: process.env.NEXT_PUBLIC_BANK_ACCOUNTS_SUBCOL || 'bank_accounts',

  // Quote subcollections (ADR-329: Quote Comments)
  QUOTE_COMMENTS: process.env.NEXT_PUBLIC_QUOTE_COMMENTS_SUBCOL || 'quote_comments',

  // DXF overlay level items (subcollection under dxf_overlay_levels/{id})
  DXF_OVERLAY_LEVEL_ITEMS: process.env.NEXT_PUBLIC_DXF_OVERLAY_LEVEL_ITEMS_SUBCOL || 'items',

  // BIM Comment replies (ADR-366 Phase 9 / C.2 — subcollection under bim_comments/{id})
  BIM_COMMENT_REPLIES: process.env.NEXT_PUBLIC_BIM_COMMENT_REPLIES_SUBCOL || 'replies',

  // BIM Animation render jobs (ADR-366 Phase 9 / C.1.a — subcollection under bim_animations/{id}, 30-day TTL post-completion)
  BIM_RENDER_JOBS: process.env.NEXT_PUBLIC_BIM_RENDER_JOBS_SUBCOL || 'render_jobs',
} as const;

// ============================================================================
// SYSTEM DOCUMENT PATHS
// ============================================================================

/**
 * Common system document paths
 */
export const SYSTEM_DOCS = {
  COMPANY_CONFIG: process.env.NEXT_PUBLIC_COMPANY_CONFIG_DOC || 'company',
  APP_SETTINGS: process.env.NEXT_PUBLIC_APP_SETTINGS_DOC || 'app_settings',
  FEATURE_FLAGS: process.env.NEXT_PUBLIC_FEATURE_FLAGS_DOC || 'feature_flags',
  MAINTENANCE_MODE: process.env.NEXT_PUBLIC_MAINTENANCE_MODE_DOC || 'maintenance',
  API_LIMITS: process.env.NEXT_PUBLIC_API_LIMITS_DOC || 'api_limits',
  TENANT_CONFIG: process.env.NEXT_PUBLIC_TENANT_CONFIG_DOC || 'tenant',

  // 🛡️ SUPER ADMIN REGISTRY (ADR-145: Super Admin AI Assistant)
  // Path: settings/super_admin_registry
  SUPER_ADMIN_REGISTRY: process.env.NEXT_PUBLIC_SUPER_ADMIN_REGISTRY_DOC || 'super_admin_registry',

  // 👷 LABOR COMPLIANCE SETTINGS (ADR-090: IKA/EFKA — Insurance Classes & Contribution Rates)
  // Path: settings/labor_compliance
  LABOR_COMPLIANCE_SETTINGS: process.env.NEXT_PUBLIC_LABOR_COMPLIANCE_SETTINGS_DOC || 'labor_compliance',

  // 📊 INTEREST COST CALCULATOR (ADR-234 Phase 4 — SPEC-234E)
  // Path: settings/euribor_rates — Cached ECB Euribor rates (24h TTL)
  EURIBOR_RATES: process.env.NEXT_PUBLIC_EURIBOR_RATES_DOC || 'euribor_rates',
  // Path: settings/bank_spreads — Bank spread configuration
  BANK_SPREADS: process.env.NEXT_PUBLIC_BANK_SPREADS_DOC || 'bank_spreads',

  // ⚙️ SYSTEM SETTINGS (ADR-245B: Hardcoded Strings Audit)
  // Path: system/settings — Global system configuration (admin config, email routing, etc.)
  SYSTEM_SETTINGS: process.env.NEXT_PUBLIC_SYSTEM_SETTINGS_DOC || 'settings',

  // 🤖 AI TOOL ANALYTICS (ADR-245B: Hardcoded Strings Audit)
  // Path: settings/ai_tool_analytics — Aggregated AI tool usage analytics
  AI_TOOL_ANALYTICS: process.env.NEXT_PUBLIC_AI_TOOL_ANALYTICS_DOC || 'ai_tool_analytics',

  // 📊 ACCOUNTING SETTINGS DOCUMENTS (ADR-245B: Hardcoded Strings Audit)
  // Path: accounting_settings/{docId} — Accounting subsystem singleton documents
  // ⚠️ ACCT_COMPANY_PROFILE: LEGACY global doc id. As of ADR-439 Phase 2 the company
  // profile is per-tenant (accounting_settings/{companyId}); this constant survives only
  // for the one-time migration + transitional fallback. Do NOT use for new reads/writes.
  ACCT_COMPANY_PROFILE: process.env.NEXT_PUBLIC_ACCT_COMPANY_PROFILE_DOC || 'company_profile',
  // ⚠️ ADR-439 Phase 2c: the singletons below are now per-tenant
  // (`accounting_settings/{companyId}__<type>` via `accountingDocId()`). These legacy
  // GLOBAL doc ids survive ONLY as the one-time migration source
  // (/api/admin/migrate-accounting-singletons). Do NOT use for new reads/writes.
  ACCT_PARTNERS: process.env.NEXT_PUBLIC_ACCT_PARTNERS_DOC || 'partners',
  ACCT_MEMBERS: process.env.NEXT_PUBLIC_ACCT_MEMBERS_DOC || 'members',
  ACCT_SHAREHOLDERS: process.env.NEXT_PUBLIC_ACCT_SHAREHOLDERS_DOC || 'shareholders',
  ACCT_SERVICE_PRESETS: process.env.NEXT_PUBLIC_ACCT_SERVICE_PRESETS_DOC || 'service_presets',

  // 📊 ACCOUNTING EFKA CONFIG DOCUMENT (ADR-245B: Hardcoded Strings Audit)
  // Path: accounting_efka_config/user_config — EFKA user configuration
  // ⚠️ ADR-439 Phase 2c: now per-tenant (`accounting_efka_config/{companyId}`, bare doc id like
  // company_profile). This legacy GLOBAL doc id survives ONLY as the migration source
  // (/api/admin/migrate-accounting-singletons). Do NOT use for new reads/writes.
  ACCT_EFKA_USER_CONFIG: process.env.NEXT_PUBLIC_ACCT_EFKA_USER_CONFIG_DOC || 'user_config',

  // 🔄 ACCOUNTING MATCHING ENGINE CONFIG (Phase 2a — SAP/Midday pattern)
  // Path: accounting_settings/matching_config — Weighted scoring weights + thresholds
  // ⚠️ ADR-439 Phase 2c: now per-tenant (`accounting_settings/{companyId}__matching_config`
  // via `accountingDocId()`). This legacy GLOBAL doc id survives ONLY as the migration
  // source (/api/admin/migrate-accounting-singletons). Do NOT use for new reads/writes.
  ACCT_MATCHING_CONFIG: process.env.NEXT_PUBLIC_ACCT_MATCHING_CONFIG_DOC || 'matching_config',

  // 🔔 UI SYNC SIGNAL (Server→Client bridge for AI agent mutations)
  // Path: config/ui_sync_signal — Written by Admin SDK, read by client onSnapshot
  // Allows server-side AI operations to notify the client UI of Firestore changes
  UI_SYNC_SIGNAL: 'ui_sync_signal',
} as const;

// ============================================================================
// SUBCOLLECTION → PARENT MAPPING (ADR-313: Enterprise Backup & Restore)
// ============================================================================

/**
 * Maps each SUBCOLLECTIONS key to its parent COLLECTIONS key.
 * Used by BackupService to traverse subcollections during export.
 *
 * @see adrs/ADR-313-enterprise-backup-restore.md
 */
export const SUBCOLLECTION_PARENTS: Record<string, string> = {
  // Contact subcollections → CONTACTS
  CONTACT_ACTIVITIES: 'CONTACTS',
  CONTACT_COMMUNICATIONS: 'CONTACTS',
  CONTACT_NOTES: 'CONTACTS',
  BANK_ACCOUNTS: 'CONTACTS',

  // Project subcollections → PROJECTS
  PROJECT_TASKS: 'PROJECTS',
  PROJECT_DOCUMENTS: 'PROJECTS',
  PROJECT_TIMELINE: 'PROJECTS',
  PROJECT_MEMBERS: 'PROJECTS',

  // Building subcollections → BUILDINGS
  BUILDING_FLOORS: 'BUILDINGS',
  BUILDING_PROPERTIES: 'BUILDINGS',
  BUILDING_MAINTENANCE: 'BUILDINGS',

  // Property subcollections → PROPERTIES
  PROPERTY_PHOTOS: 'PROPERTIES',
  PROPERTY_DOCUMENTS: 'PROPERTIES',
  PROPERTY_HISTORY: 'PROPERTIES',
  PROPERTY_PAYMENT_PLANS: 'PROPERTIES',
  PROPERTY_PAYMENTS: 'PROPERTIES',
  PROPERTY_GRANTS: 'PROPERTIES',

  // User subcollections → USERS
  USER_PREFERENCES: 'USERS',
  USER_SESSIONS: 'USERS',
  USER_NOTIFICATIONS: 'USERS',

  // Company subcollections → COMPANIES
  COMPANY_PROJECTS: 'COMPANIES',
  COMPANY_PROPERTIES: 'COMPANIES',
  WORKSPACE_MEMBERS: 'COMPANIES',
  COMPANY_AUDIT_LOGS: 'COMPANIES',

  // Ownership table subcollections → OWNERSHIP_TABLES
  OWNERSHIP_REVISIONS: 'OWNERSHIP_TABLES',

  // Network thread subcollections → NETWORK_THREADS (ADR-867 §4.1/§4.2)
  NETWORK_THREAD_MESSAGES: 'NETWORK_THREADS',
  NETWORK_THREAD_AUDIENCE: 'NETWORK_THREADS',
  NETWORK_THREAD_AUDIENCE_PRIVATE: 'NETWORK_THREADS',

  // Network inbox subcollection → NETWORK_INBOX (ADR-867 §4.5 Β10)
  NETWORK_INBOX_UNREAD: 'NETWORK_INBOX',
} as const;

// ============================================================================
// IMMUTABLE COLLECTIONS (ADR-313: Enterprise Backup & Restore)
// ============================================================================

/**
 * Collections that are append-only / immutable by design.
 * During restore: existing documents are SKIPPED (no overwrite).
 * Only missing documents are inserted.
 *
 * @see adrs/ADR-313-enterprise-backup-restore.md §5.4
 */
export const IMMUTABLE_COLLECTIONS: readonly string[] = [
  'ENTITY_AUDIT_TRAIL',
  'ENTITY_AUDIT_TRAIL_PERSONAL',
  'AUDIT',
  'SYSTEM_AUDIT_LOGS',
  'CLOUD_FUNCTION_AUDIT_LOG',
  'ACCOUNTING_AUDIT_LOG',
  'FILE_AUDIT_LOG',
  'FILE_AUDIT_LOG_PERSONAL',
  'COMMUNICATIONS',
  'MESSAGES',
  'ATTENDANCE_EVENTS',
  'ATTENDANCE_QR_TOKENS',
  'EMAIL_INGESTION_QUEUE',
] as const;

// ============================================================================
// FIRESTORE QUERY LIMITS
// ============================================================================

/**
 * Firestore query operation limits
 *
 * @see https://firebase.google.com/docs/firestore/query-data/queries#in_not-in_and_array-contains-any
 */
export const FIRESTORE_LIMITS = {
  /**
   * Maximum items in 'in', 'not-in', and 'array-contains-any' queries
   * Firestore hard limit: 10 items
   *
   * Usage:
   * ```typescript
   * import { FIRESTORE_LIMITS } from '@/config/firestore-collections';
   *
   * const chunks = chunkArray(ids, FIRESTORE_LIMITS.IN_QUERY_MAX_ITEMS);
   * ```
   */
  IN_QUERY_MAX_ITEMS: 10,

  /**
   * Maximum composite filters in a query
   * Firestore hard limit: 30 filters
   */
  MAX_COMPOSITE_FILTERS: 30,

  /**
   * Recommended batch size for write operations
   * Firestore hard limit: 500 operations per batch
   */
  BATCH_WRITE_LIMIT: 500
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CollectionKey = keyof typeof COLLECTIONS;
