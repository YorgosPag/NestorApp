/**
 * @fileoverview Tenant Configuration — Per-collection tenant isolation mapping
 * @description Static map defining which field each collection uses for tenant isolation (ADR-214 Phase 1)
 * @version 1.0.0
 * @created 2026-03-12
 */

import type { CollectionKey } from '@/config/firestore-collections';
import type { TenantFieldConfig, TenantIsolationMode } from './firestore-query.types';

// ============================================================================
// TENANT FIELD CONFIGURATION MAP
// ============================================================================

/**
 * Explicit overrides for collections that do NOT use the default `companyId` field.
 *
 * - `tenantId` collections: multi-tenant enterprise config services
 * - `userId` collections: per-user data (notifications, preferences)
 * - `none`: system-level singletons / shared data (no tenant filter)
 *
 * Every CollectionKey NOT listed here defaults to `{ mode: 'companyId', fieldName: 'companyId' }`.
 */
const TENANT_OVERRIDES: Partial<Record<CollectionKey, TenantFieldConfig>> = {
  // --- tenantId collections ---
  TEAMS:            { mode: 'tenantId', fieldName: 'tenantId' },
  ROLES:            { mode: 'tenantId', fieldName: 'tenantId' },
  USER_PREFERENCES: { mode: 'tenantId', fieldName: 'tenantId' },
  WORKSPACES:       { mode: 'companyId', fieldName: 'companyId' },
  // ⛔ Η γραμμή `WORKSPACE_MEMBERS` ΑΦΑΙΡΕΘΗΚΕ (ADR-787 §5.1 γ, 2026-08-22).
  //    Δεν έγινε «unscoped» — **έπαψε να είναι top-level συλλογή**. Το μέλος
  //    χώρου ζει πλέον ως υποσυλλογή `companies/{W}/workspace_members/{uid}`,
  //    άρα η απομόνωσή του είναι **η ίδια η διαδρομή** και όχι πεδίο: ο χώρος
  //    δεν είναι ετικέτα πάνω στο έγγραφο, είναι ο **γονέας** του.
  //    ⛔ ΜΗΝ ξαναγράψεις εγγραφή εδώ γι' αυτό — θα δήλωνε φίλτρο για συλλογή
  //    που δεν υπάρχει, δηλαδή φρουρό που δεν μπορεί να πυροδοτήσει.
  PERMISSIONS:      { mode: 'tenantId', fieldName: 'tenantId' },

  // --- userId collections ---
  NOTIFICATIONS:              { mode: 'userId', fieldName: 'userId' },
  USER_NOTIFICATION_SETTINGS: { mode: 'userId', fieldName: 'userId' },
  // 🎯 ADR-777 Α9 — Η ΖΗΤΗΣΗ. Επίπεδο Β (SPEC-777A §14.2, που ονομάζει ρητά τις
  // «ζητήσεις» στο ιδιωτικό επίπεδο) — αλλά ανήκει σε ΑΝΘΡΩΠΟ, όχι σε εταιρεία, γιατί
  // ο ιδιώτης που ψάχνει σπίτι δεν έχει καμία. Το `authorCompanyId` του εγγράφου είναι
  // ΑΠΟΔΟΣΗ (ποιο γραφείο το κατέγραψε), ΟΧΙ δεύτερο πεδίο απομόνωσης: δύο άξονες
  // απομόνωσης για ένα έγγραφο σημαίνει δύο απαντήσεις στο «ποιος το βλέπει;».
  PROPERTY_DEMANDS:           { mode: 'userId', fieldName: 'authorUserId' },
  // 🎯 ADR-777 Α14 — Η ΠΡΟΣΦΟΡΑ. Το ΚΑΤΟΠΤΡΟ της παραπάνω γραμμής, και ο λόγος είναι ο
  // ΙΔΙΟΣ: η αγγελία ζει στον χώρο ΑΝΘΡΩΠΟΥ, όχι εταιρείας — γιατί ο ιδιώτης της Α14
  // δεν έχει καμία.
  //
  // 🔴 §8.33: το πεδίο λεγόταν `ownerUserId` και ΜΕΤΟΝΟΜΑΣΤΗΚΕ όταν άνοιξε η ροή του
  // μεσίτη. Δεν ήταν καλλωπισμός: από τη στιγμή που γράφει ΚΑΙ ο μεσίτης, «κάτοχος»
  // θα σήμαινε τον υπάλληλο του γραφείου — πεδίο που λέει `owner` και δείχνει σε
  // κάποιον που δεν κατέχει τίποτα. Ποιανού είναι το ακίνητο το λέει πλέον το
  // `mandate`. Κόστος μετρημένο πριν την αλλαγή: 0 έγγραφα στη ζωντανή συλλογή.
  //
  // ⚠️ ΤΟ `authorCompanyId` ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΟ ΠΕΔΙΟ ΑΠΟΜΟΝΩΣΗΣ, και ΔΕΝ πρέπει ποτέ
  // να γίνει: δύο άξονες απομόνωσης για ένα έγγραφο σημαίνει δύο απαντήσεις στο
  // «ποιος το βλέπει;» — ο ίδιος κανόνας που γράφτηκε τρεις γραμμές πιο πάνω, και ο
  // λόγος που η προηγούμενη εκδοχή αυτού του σχολίου απαγόρευε ονομαστικά ένα
  // `listedByCompanyId`. Η απόδοση σε γραφείο απαντά ΑΛΛΗ ερώτηση («ποιος το
  // κατέγραψε»), και ο κατάλογος του γραφείου σερβίρεται από τον ΔΙΑΚΟΜΙΣΤΗ, που δεν
  // περνά από αυτούς τους κανόνες.
  OWNER_PROPERTIES:           { mode: 'userId', fieldName: 'authorUserId' },
  // 📒 ADR-864 Φ1β — το ΠΡΟΣΩΠΙΚΟ βιβλίο ιστορικού: ανήκει σε ΑΝΘΡΩΠΟ, όχι σε εταιρεία. Το
  // `userId` είναι ο ΚΑΤΟΧΟΣ του βιβλίου (όχι ο δράστης — αυτός είναι το `performedBy`).
  // Κανένα `companyId` εκ κατασκευής (ADR-787 Ε-3 §8· `lib/audit/audit-ledger.ts`).
  ENTITY_AUDIT_TRAIL_PERSONAL: { mode: 'userId', fieldName: 'userId' },
  // 🗂️ ADR-866 §5.2 — τα ΠΡΟΣΩΠΙΚΑ αρχεία: ίδιο σχήμα κατόχου με το βιβλίο παραπάνω. 🔑 ΚΑΜΙΑ
  // εγγραφή στο `READ_PATHS`: αυτή η γραμμή παράγει ήδη `where('userId','==',uid)` — τον ΕΝΑ δρόμο
  // που δέχεται ο κανόνας (ADR-866 §2.6.7). Ο φράχτης `cdeReadReach` είναι έννοια ΓΡΑΦΕΙΟΥ.
  FILES_PERSONAL:             { mode: 'userId', fieldName: 'userId' },
  // 📒 ADR-866 §2.6.11 — η δραστηριότητα των προσωπικών αρχείων: το `userId` είναι ο ΚΑΤΟΧΟΣ του
  // βιβλίου (ο δράστης είναι το `performedBy`) — ίδιο σχήμα με το `ENTITY_AUDIT_TRAIL_PERSONAL`.
  FILE_AUDIT_LOG_PERSONAL:    { mode: 'userId', fieldName: 'userId' },
  // 🗂️ ADR-866 Φ1.1 — ο ΦΑΚΕΛΟΣ ΤΟΥ ΑΚΙΝΗΤΟΥ: ίδιος άξονας με τα ΠΡΟΣΩΠΙΚΑ αρχεία του (`userId`, το
  // μέλος της `CustodyScope`) — όχι `authorUserId`: ο φάκελος αλλάζει κάτοχο (Φ4), ο συγγραφέας όχι.
  PROPERTY_DOSSIERS:          { mode: 'userId', fieldName: 'userId' },

  // --- system (no tenant filter) ---
  // ⚠️ Το `unscopedReason` ΔΕΝ είναι σχόλιο: ο τύπος `TenantFieldConfig` το απαιτεί
  // (SPEC-777A §14.4 κανόνας 3). Νέα εγγραφή `mode: 'none'` χωρίς αυτό ΔΕΝ χτίζει.
  SYSTEM:           { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Καθολικές ρυθμίσεις πλατφόρμας — ίδιες για κάθε μισθωτή.' },
  CONFIG:           { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Καθολική διαμόρφωση εφαρμογής — δεν ανήκει σε μισθωτή.' },
  NAVIGATION:       { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Δομή πλοήγησης της εφαρμογής — κοινή σε όλους.' },
  SETTINGS:         { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Ρυθμίσεις επιπέδου πλατφόρμας.' },
  COUNTERS:         { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Μετρητές ακολουθιών· το κλειδί εγγράφου φέρει ήδη την εμβέλεια.' },
  ESCO_CACHE:       { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Κρυφή μνήμη δημόσιας ταξινομίας ESCO — δημόσιο δεδομένο τρίτου.' },
  ESCO_SKILLS_CACHE:{ mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Κρυφή μνήμη δημόσιας ταξινομίας ESCO — δημόσιο δεδομένο τρίτου.' },
  AI_CHAT_HISTORY:  { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Το ιστορικό φέρει δική του εμβέλεια στο κλειδί εγγράφου.' },
  AUDIT:            { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Ίχνος ελέγχου· φιλτράρεται στους κανόνες Firestore, όχι στο ερώτημα.' },
  TRANSLATIONS:     { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Μεταφράσεις διεπαφής — κοινές σε όλους τους μισθωτές.' },
  LOCALES:          { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Κατάλογος γλωσσών — κοινός σε όλους.' },
  SECURITY_ROLES:            { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Ορισμοί ρόλων πλατφόρμας (ADR-702) — κοινό λεξιλόγιο.' },
  EMAIL_DOMAIN_POLICIES:     { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Πολιτικές τομέα email σε επίπεδο πλατφόρμας.' },
  COUNTRY_SECURITY_POLICIES: { mode: 'none', fieldName: '', unscopedCategory: 'system', unscopedReason: 'Πολιτικές ασφαλείας ανά χώρα — κοινές σε όλους.' },

  // --- DXF / CAD Viewer (no tenant filter — files are project-scoped) ---
  CAD_FILES:              { mode: 'none', fieldName: '', unscopedCategory: 'project-scoped', unscopedReason: 'Τα αρχεία CAD ανήκουν σε έργο· η απομόνωση γίνεται μέσω του έργου.' },
  DXF_OVERLAY_LEVELS:     { mode: 'none', fieldName: '', unscopedCategory: 'project-scoped', unscopedReason: 'Επίπεδα επικάλυψης δεμένα σε αρχείο CAD, όχι σε μισθωτή.' },
  PROJECT_FLOORPLANS:     { mode: 'none', fieldName: '', unscopedCategory: 'project-scoped', unscopedReason: 'Κατόψεις δεμένες σε έργο· η απομόνωση γίνεται μέσω του έργου.' },

  // --- ADR-777 Α11/Α12 επίπεδο Α: ΚΟΙΝΟ ΦΥΣΙΚΟ ΓΕΓΟΝΟΣ -----------------------
  // 🔴 ΔΕΝ είναι «ξεχασμένο companyId» — είναι ρητή κατηγορία (SPEC-777A §13.1).
  // Ο πελάτης ΔΙΑΒΑΖΕΙ· γράφει ΜΟΝΟ ο διακομιστής (§14.4 κανόνες 1-2, firestore.rules).
  PUBLIC_LANDS:     { mode: 'none', fieldName: '', unscopedCategory: 'public-world', unscopedReason: 'ADR-777 Α1/Α11 — η ΓΗ είναι φυσικό γεγονός, κοινό σε όλους· υπάρχει πριν τη διεκδικήσει οποιοσδήποτε και δεν ανήκει σε κανέναν. Read-only από τον πελάτη.' },
  PUBLIC_BUILDINGS: { mode: 'none', fieldName: '', unscopedCategory: 'public-world', unscopedReason: 'ADR-777 Α11 — «το κτίριο του κόσμου». Κοινή ταυτότητα ώστε προσφορά και ζήτηση να δείχνουν στο ΙΔΙΟ πράγμα (§14.5). Read-only από τον πελάτη.' },

  // --- ADR-835 §20: ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΟΥ ΚΑΤΑΛΥΜΑΤΟΣ -----------------------------
  // 🔴 ΙΔΙΟΣ ΑΞΟΝΑΣ ΜΕ ΤΟ `OWNER_PROPERTIES`, επίτηδες: το ημερολόγιο είναι κομμάτι της
  // αγγελίας, και δεύτερος άξονας θα έδινε δεύτερη απάντηση στο «ποιος το βλέπει;». Οι
  // αναγνώσεις του διακομιστή είναι «οι εγγραφές ΑΥΤΟΥ του ακινήτου», ΑΦΟΥ ο
  // `mayAdminister` (CHECK 3.56) αποδείξει την κατοχή — δηλώνονται στο σημείο κλήσης με
  // `tenant-scope-exempt` + λόγο, ίδιο σχήμα με το MANDATE_REQUESTS.
  STAY_CALENDARS:             { mode: 'userId', fieldName: 'authorUserId' },
  STAY_BLOCKS:                { mode: 'userId', fieldName: 'authorUserId' },
  STAY_BOOKINGS:              { mode: 'userId', fieldName: 'authorUserId' },
  STAY_CALENDAR_MONTHS:       { mode: 'userId', fieldName: 'authorUserId' },
  // ADR-835 §22 (Στάδιο Γ): τα κανάλια. Ίδιος άξονας — και **καμία** ανάγνωση πελάτη
  // (τα URL των feeds είναι διαπιστευτήρια): ο άξονας φυλάει τον διακομιστή, οι κανόνες
  // κλείνουν τον πελάτη εντελώς.
  STAY_CHANNELS:              { mode: 'userId', fieldName: 'authorUserId' },
  // ADR-835 §23 (Στάδιο Δ): η κεφαλή του επισκέπτη — ο άξονας είναι ο ΙΔΙΟΣ ο άνθρωπος (`userId`),
  // όχι ο συντάκτης της αγγελίας: ένας επισκέπτης κρατά σε ακίνητα ΠΟΛΛΩΝ οικοδεσποτών.
  STAY_GUESTS:                { mode: 'userId', fieldName: 'userId' },
  // --- ADR-777 Α3/Α5: ΔΗΜΟΣΙΕΥΜΕΝΗ ΠΡΟΒΟΛΗ ----------------------------------
  // 🔴 Άλλη κατηγορία από τις δύο παραπάνω, ΚΑΙ Ο ΛΟΓΟΣ ΕΙΝΑΙ Ο ΚΥΚΛΟΣ ΖΩΗΣ: η γη
  // υπάρχει ακόμη κι αν σβήσουν όλοι οι λογαριασμοί· η αγγελία σβήνει μαζί με την
  // απόσυρσή της. Βλ. `UnscopedCategory.published-projection`.
  PUBLIC_LISTINGS:  { mode: 'none', fieldName: '', unscopedCategory: 'published-projection', unscopedReason: 'ADR-777 Α3/Α5/Α20 — προβολή ανάγνωσης της δημοσιευμένης αγγελίας, με κλειστό σχήμα ΧΩΡΙΣ καμία ταυτότητα πελάτη. Το Firestore δεν φιλτράρει πεδία στην ανάγνωση, οπότε η απομόνωση επιτυγχάνεται με ΤΟ ΤΙ ΓΡΑΦΕΤΑΙ, όχι με where(). Read-only από τον πελάτη· γράφει μόνο ο διακομιστής.' },

  // --- ADR-827 §9: Η ΒΙΤΡΙΝΑ ΤΟΥ ΓΡΑΦΕΙΟΥ -----------------------------------
  // 🔴 ΙΔΙΑ ΚΑΤΗΓΟΡΙΑ ΜΕ ΤΟ `PUBLIC_LISTINGS`, ΚΑΙ ΟΧΙ `global-index` — παρότι κι εδώ
  // η ερώτηση μοιάζει αντίστροφη. Η διαφορά είναι ο ΚΥΚΛΟΣ ΖΩΗΣ, το ίδιο κριτήριο που
  // ξεχωρίζει το `published-projection` από το `public-world`: το `workspace_aliases`
  // υπάρχει ΟΣΟ ΥΠΑΡΧΕΙ Ο ΧΩΡΟΣ (κανείς δεν το ζήτησε)· αυτό εδώ ΟΦΕΙΛΕΙ ΝΑ ΠΑΨΕΙ ΝΑ
  // ΥΠΑΡΧΕΙ τη στιγμή που το γραφείο αποσύρει τη δημοσίευση — ή που χάνει την ικανότητα
  // `brokerage_listings` (ADR-824). Παρουσία = συγκατάθεση· απόσυρση = διαγραφή.
  AGENCY_PROFILES:  { mode: 'none', fieldName: '', unscopedCategory: 'published-projection', unscopedReason: 'ADR-827 §9 — ΔΗΜΟΣΙΕΥΜΕΝΗ ΒΙΤΡΙΝΑ ΟΡΓΑΝΙΣΜΟΥ, με κλειστό σχήμα ΧΩΡΙΣ αριθμούς τηλεφώνου/email (ADR-841 Α21.16: τα κανάλια επιτρέπονται, αλλά ζουν στο deny_all showcase_card_channels — εδώ μόνο η ΥΠΑΡΞΗ τους), ΧΩΡΙΣ αμοιβή/κατάταξη (NAR $418M — κατάλογος ΓΡΑΦΕΙΩΝ είναι μεγαλύτερη επιφάνεια steering από κατάλογο ΑΚΙΝΗΤΩΝ) και ΧΩΡΙΣ όνομα φυσικού προσώπου (GDPR αιτ. σκ. 14 — αλλά ο μεσίτης με ατομική επιχείρηση ΕΙΝΑΙ φυσικό πρόσωπο). 🔴 Η ΣΑΡΩΣΗ ΕΠΙΤΡΕΠΕΤΑΙ ΕΠΕΙΔΗ Ο ΠΛΗΘΥΣΜΟΣ ΕΙΝΑΙ OPT-IN: κάθε εγγραφή γράφτηκε με ρητή, ανακλητή πράξη ΤΟΥ ΙΔΙΟΥ ΤΟΥ ΓΡΑΦΕΙΟΥ — σε αντίθεση με το WORKSPACE_ALIASES παρακάτω, όπου κάθε χώρος έχει εγγραφή υποχρεωτικά, άρα η σάρωση είναι απογραφή μισθωτών (Ε-5 §4 #1). Φρουρός: η απουσία από την προβολή είναι ΑΔΙΑΚΡΙΤΗ από την ανυπαρξία. Read-only από τον πελάτη· γράφει μόνο ο διακομιστής.' },

  // --- ADR-827 §8.7: ΤΟ ΑΙΤΗΜΑ ΑΝΑΘΕΣΗΣ ------------------------------------
  // 🔴 ΔΕΝ είναι unscoped, ΚΑΙ ΔΕΝ διαβάζεται από πελάτη ΚΑΘΟΛΟΥ (`firestore.rules`:
  // read:false + write:false). Η δήλωση εδώ αφορά τα ΕΡΩΤΗΜΑΤΑ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, που
  // το CHECK 3.35 κρίνει με R2 (Admin SDK αλυσίδα).
  //
  // ⚠️ ΓΙΑΤΙ `agencyCompanyId` ΚΑΙ ΟΧΙ ΔΕΥΤΕΡΟΣ ΑΞΟΝΑΣ: το έγγραφο έχει ΔΥΟ μέρη, αλλά
  // ΕΝΑ μόνο είναι μισθωτής. Ο ιδιώτης είναι ΑΝΘΡΩΠΟΣ — ίδιο ακριβώς σκεπτικό με το
  // OWNER_PROPERTIES/PROPERTY_DEMANDS παραπάνω («ο ιδιώτης δεν έχει καμία εταιρεία»).
  // Ο μόνος ΑΠΑΡΙΘΜΗΣΙΜΟΣ άξονας είναι το γραφείο: διαρροή εκεί σημαίνει ότι γραφείο Α
  // βλέπει τα εισερχόμενα του Β. Η πλευρά του ιδιοκτήτη ΔΕΝ είναι ερώτηση απομόνωσης
  // αλλά ΓΟΝΕΑ: «τα αιτήματα ΑΥΤΗΣ της αγγελίας», αφού πρώτα αποδειχθεί ότι η αγγελία
  // είναι δική του — δηλώνεται στο σημείο κλήσης με `tenant-scope-exempt` + λόγο.
  MANDATE_REQUESTS: { mode: 'companyId', fieldName: 'agencyCompanyId' },

  // --- ADR-864 §20: ΤΟ ΜΗΤΡΩΟ ΤΩΝ ΠΑΓΩΜΕΝΩΝ ΑΠΟΔΕΙΚΤΙΚΩΝ ---------------------
  // 🔴 ΔΕΝ διαβάζεται από πελάτη (`firestore.rules`: read/write false). Άξονας το ΓΡΑΦΕΙΟ της σχέσης,
  // όπως στο MANDATE_REQUESTS. Οι δύο αναγνώσεις του διακομιστή (σάρωση cron · «τα αποδεικτικά ΑΥΤΟΥ του
  // ακινήτου») δηλώνονται στο σημείο κλήσης με `tenant-scope-exempt` + λόγο.
  MANDATE_EVIDENCE: { mode: 'companyId', fieldName: 'agencyCompanyId' },

  // --- ADR-843: Η ΠΡΑΞΗ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ -----------------------------------
  // 🔴 ΔΕΝ διαβάζεται από πελάτη ΚΑΘΟΛΟΥ (`firestore.rules`: read:false + write:false).
  // Η δήλωση αφορά τα ΕΡΩΤΗΜΑΤΑ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ, που το CHECK 3.35 κρίνει με R2.
  //
  // ⚠️ ΓΙΑΤΙ `seekerUserId` — ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ Ο ΜΟΝΟΣ ΥΠΟΨΗΦΙΟΣ, ΟΧΙ ΠΡΟΤΙΜΗΣΗ:
  // ο στόχος της πράξης είναι ΔΙΑΚΡΙΤΗ ΕΝΩΣΗ (αγγελία ή επαγγελματίας), άρα το
  // `agencyCompanyId` υπάρχει σε ΜΕΡΙΚΑ μόνο έγγραφα. Άξονας απομόνωσης που λείπει από
  // κάποια έγγραφα δεν είναι άξονας — είναι σιωπηλή εξαίρεση. Ο ζητών, αντίθετα,
  // υπάρχει ΠΑΝΤΑ: είναι αυτός που κάνει την πράξη, εξ ορισμού του ADR-843.
  //
  // ⚠️ ΤΟ `agencyCompanyId` ΔΕΝ ΕΙΝΑΙ ΔΕΥΤΕΡΟ ΠΕΔΙΟ ΑΠΟΜΟΝΩΣΗΣ, και ΔΕΝ πρέπει ποτέ να
  // γίνει — δύο άξονες για ένα έγγραφο σημαίνει δύο απαντήσεις στο «ποιος το βλέπει;».
  // Είναι πεδίο ΑΠΟΔΟΣΗΣ. Η πλευρά του ΠΑΡΑΛΗΠΤΗ ΔΕΝ είναι ερώτηση απομόνωσης αλλά
  // ΓΟΝΕΑ — «οι πράξεις ΑΥΤΗΣ της αγγελίας», αφού πρώτα ο `mayAdminister` (CHECK 3.56)
  // αποδείξει ότι η αγγελία είναι δική του· δηλώνεται στο σημείο κλήσης με
  // `tenant-scope-exempt` + λόγο, ίδιο σχήμα με το MANDATE_REQUESTS παραπάνω.
  FIRST_CONTACTS: { mode: 'userId', fieldName: 'seekerUserId' },

  // --- ADR-867 §4.3: Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ --------------------------------------
  // 🔴 ΔΕΝ διαβάζεται από πελάτη (ένας γραφέας, καμία γραφή/ανάγνωση πελάτη). Η δήλωση
  // αφορά τα ΕΡΩΤΗΜΑΤΑ ΤΟΥ ΔΙΑΚΟΜΙΣΤΗ (CHECK 3.35 R2) — και ο άξονας είναι το ΓΡΑΦΕΙΟ
  // που φιλοξενεί την πράξη, ίδιο σκεπτικό με MANDATE_REQUESTS/MANDATE_EVIDENCE.
  //
  // ⚠️ ΓΙΑΤΙ `hostCompanyId` ΚΑΙ ΟΧΙ `companyId`: το ίδιο έγγραφο κουβαλά ΔΥΟ πλευρές
  // (χώρος · πρόσωπο του άλλου άκρου). Ένα σκέτο `companyId` θα άφηνε ανοιχτό «ποιανού
  // είναι το πεδίο» ακριβώς εκεί όπου η απάντηση ΠΡΕΠΕΙ να είναι μία: του ΦΙΛΟΞΕΝΟΥΝΤΑ.
  //
  // ⚠️ ΤΟ `network_threads` ΔΕΝ ΘΑ ΜΠΕΙ ΕΔΩ ΜΕ ΑΞΟΝΑ ΧΩΡΟΥ (Β4): το νήμα ΣΧΕΣΗΣ ανήκει
  // στο ΠΡΟΣΩΠΟ (ADR-834 (γ) ②) και δεν έχει χώρο καθόλου — θα δηλωθεί ρητά ως
  // `tenant-scope-exempt` με γραμμένο λόγο, ποτέ με πεδίο που λείπει από μισά έγγραφα.
  NETWORK_ACT_TEAMS: { mode: 'companyId', fieldName: 'hostCompanyId' },

  // 💬 ADR-867 §4.1 (Β4) — ΤΟ ΝΗΜΑ. Η γραμμή που η προηγούμενη υποσχέθηκε ονομαστικά.
  //
  // 🔴 ΚΑΝΕΝΑΣ ΑΞΟΝΑΣ, ΚΑΙ ΕΙΝΑΙ ΑΠΟΦΑΣΗ — ΟΧΙ ΠΑΡΑΛΕΙΨΗ. Το νήμα ΠΡΑΞΗΣ έχει
  // `topic.hostCompanyId`· το νήμα ΣΧΕΣΗΣ ανήκει στο ΠΡΟΣΩΠΟ (ADR-834 (γ) ②) και δεν
  // έχει χώρο ΚΑΘΟΛΟΥ. Ένα `mode: 'companyId'` με `fieldName: 'topic.hostCompanyId'`
  // θα δήλωνε άξονα που υπάρχει στα ΜΙΣΑ έγγραφα — και κάθε ερώτημα πάνω του θα
  // επέστρεφε σιωπηλά ΚΕΝΟ για τη μισή συλλογή, που είναι το μετρημένο σχήμα
  // «0 = κανείς δεν κοίταξε».
  //
  // 🔑 Η εμβέλεια ΖΕΙ — ως ΑΚΡΟΑΤΗΡΙΟ (υποσυλλογή), όχι ως πεδίο. Δες την κατηγορία
  // `cross-space-thread` στο `firestore-query.types.ts` για το πλήρες συμβόλαιο.
  NETWORK_THREADS: {
    mode: 'none',
    fieldName: '',
    unscopedCategory: 'cross-space-thread',
    unscopedReason:
      'ADR-867 §4.1 — το νήμα ανήκει σε ΔΥΟ πλευρές διαφορετικών χώρων, και το νήμα σχέσης σε πρόσωπο ΧΩΡΙΣ χώρο (ADR-834 (γ) ②). Η εμβέλεια είναι η υποσυλλογή ακροατηρίου (`network_audience/{uid}`), που την επιβάλλουν τα firestore.rules· σημειακή ανάγνωση κατά κλειδί, ΠΟΤΕ σάρωση — ο κατάλογος νημάτων σερβίρεται από τον διακομιστή. Γράφει ΜΟΝΟ ο `services/network-messaging/thread-writer.ts` (CHECK 3.89).',
  },

  // 🔒 ADR-867 §4.1 — ΤΟ ΒΙΒΛΙΟ ΤΩΝ ΑΝΑΚΛΗΣΕΩΝ. Ίδιος λόγος με το νήμα από πάνω, και
  // ένας παραπάνω: το έγγραφο ΔΕΝ διαβάζεται από κανέναν πελάτη, ποτέ — άρα δεν υπάρχει
  // καν ερώτημα να φιλτραριστεί. Μια δήλωση `companyId` εδώ θα υποσχόταν διαδρομή
  // ανάγνωσης που ο κανόνας κλείνει, δηλαδή θα έλεγε ψέματα στον επόμενο αναγνώστη.
  NETWORK_MESSAGE_RETRACTIONS: {
    mode: 'none',
    fieldName: '',
    unscopedCategory: 'cross-space-thread',
    unscopedReason:
      'ADR-867 §4.1 — το αντίγραφο συμμόρφωσης ενός ανακληθέντος μηνύματος. Ακολουθεί το νήμα του, που ανήκει σε ΔΥΟ πλευρές διαφορετικών χώρων (και, στο νήμα σχέσης, σε πρόσωπο ΧΩΡΙΣ χώρο). ΚΑΜΙΑ ανάγνωση πελάτη — ούτε του αποστολέα: αν διαβαζόταν, η ανάκληση θα ήταν διακοσμητική. Σημειακή ανάγνωση διακομιστή κατά κλειδί (= το id του μηνύματος) για ΓΚΠΔ άρθρο 17 §3(ε)· γράφει ΜΟΝΟ ο `services/network-messaging/thread-messages.ts` (CHECK 3.89).',
  },

  // 🌴 ADR-867 §4.4 (Β5) — Η ΑΠΟΥΣΙΑ ΑΝΗΚΕΙ ΣΤΟ ΠΡΟΣΩΠΟ, όχι σε χώρο: ένας άνθρωπος που
  // απουσιάζει απουσιάζει από ΟΛΑ του τα νήματα. ⇒ άξονας `uid`, όπως οι ειδοποιήσεις.
  NETWORK_AWAY: { mode: 'userId', fieldName: 'uid' },

  // --- ADR-787 §5.3 δ: ΚΑΘΟΛΙΚΟ ΕΥΡΕΤΗΡΙΟ ΑΝΤΙΣΤΡΟΦΗΣ ΑΝΑΖΗΤΗΣΗΣ -------------
  // 🔴 ΔΕΝ είναι `system`: κάθε εγγραφή ΑΝΗΚΕΙ σε χώρο (φέρει `companyId`). Αυτό που
  // λείπει είναι η δυνατότητα να φιλτράρεις με αυτόν — η ερώτηση είναι ΑΝΤΙΣΤΡΟΦΗ.
  WORKSPACE_ALIASES: { mode: 'none', fieldName: '', unscopedCategory: 'global-index', unscopedReason: 'ADR-787 §5.3 δ / Ε-5 §8 — το κλειδί εγγράφου ΕΙΝΑΙ ο σκελετός UTS #39, και η ερώτηση είναι «ποιος χώρος έχει αυτό το ψευδώνυμο;»: ένα where(companyId) θα απαιτούσε να ξέρεις ήδη την απάντηση. Σημειακή ανάγνωση κατά κλειδί, ΠΟΤΕ σάρωση — ένας κατάλογος ψευδωνύμων είναι απαρίθμηση γραφείων, που απαγορεύει το Ε-5 §4 #1. Γράφει μόνο ο διακομιστής.' },
} as const;

/** Default tenant configuration for collections not in the override map */
const DEFAULT_TENANT_CONFIG: TenantFieldConfig = {
  mode: 'companyId',
  fieldName: 'companyId',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Returns the tenant field configuration for a given collection.
 *
 * @param key - The CollectionKey to look up
 * @returns TenantFieldConfig with `mode` and `fieldName`
 */
export function getTenantConfig(key: CollectionKey): TenantFieldConfig {
  return TENANT_OVERRIDES[key] ?? DEFAULT_TENANT_CONFIG;
}

/**
 * Resolves the tenant filter value from the auth context based on the isolation mode.
 *
 * @param mode - The tenant isolation mode
 * @param ctx - Object containing uid and companyId
 * @returns The value to filter by, or `null` if no filter should be applied
 */
export function resolveTenantValue(
  mode: TenantIsolationMode,
  ctx: { uid: string; companyId: string | null }
): string | null {
  switch (mode) {
    case 'companyId':
    case 'tenantId':
      return ctx.companyId;
    case 'userId':
      return ctx.uid;
    case 'none':
      return null;
  }
}
