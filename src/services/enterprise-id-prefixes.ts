/**
 * ENTERPRISE ID PREFIXES — CONFIG DATA
 * Cryptographically secure, collision-resistant ID generation prefixes.
 * Extracted from enterprise-id.service.ts (ADR-065 SRP split).
 * DXF/CAD/BIM prefixes live in `./enterprise-id-prefixes-dxf-bim` (N.7.1 split) and are spread in below.
 */

import { DXF_BIM_ID_PREFIXES } from './enterprise-id-prefixes-dxf-bim';

// Enterprise prefix mappings for namespace isolation
export const ENTERPRISE_ID_PREFIXES = {
  // Core Business Entities
  COMPANY: 'comp',
  PROJECT: 'proj',
  BUILDING: 'bldg',
  PROPERTY: 'prop',
  STORAGE: 'stor',
  PARKING: 'park',
  CONTACT: 'cont',
  WORKSPACE: 'ws',
  ADDRESS: 'addr',
  OPPORTUNITY: 'opp',
  FLOOR: 'flr',
  DOCUMENT: 'doc',
  USER: 'usr',
  USER_PREFERENCES: 'usrprf',  // ADR-XXX: per-user UI settings (deterministic {userId}_{companyId})
  ASSET: 'ast',
  RELATIONSHIP: 'rel',
  MEMBER: 'mbr',
  LANDOWNER: 'lown',         // ADR-244: Property ownership
  PUBLIC_LAND: 'land',       // ADR-777 Α1: η ΓΗ — το ΜΟΝΟ πράγμα που κρατά θέση. Δημόσια, χωρίς
                             // companyId. 🔴 ΠΟΤΕ OSM id (SPEC-777A §13.2): τα OSM id αλλάζουν όταν
                             // εθελοντές ξανασχεδιάζουν, και μια ζήτηση κρεμασμένη εκεί εξαφανίζεται
                             // ΣΙΩΠΗΛΑ. Δική μας ταυτότητα που ΔΕΙΧΝΕΙ στο OSM, ποτέ που ΕΙΝΑΙ.
  PUBLIC_BUILDING: 'pbld',   // ADR-777 Α11: «το κτίριο του κόσμου» — δημόσια οντότητα, κανενός.
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `bldg` (BUILDING): εκείνο είναι το εμπορικό
                             // κτίριο ΜΕΣΑ σε έργο ενός πελάτη (επίπεδο Β). Κοινό πρόθεμα θα
                             // σήμαινε ότι δύο πράγματα με διαφορετική ορατότητα και διαφορετικό
                             // γραφέα μοιράζονται χώρο ταυτοτήτων — η σύγχυση θα ήταν ΜΗ ΑΝΙΧΝΕΥΣΙΜΗ.
  PROPERTY_DEMAND: 'dmnd',   // ADR-777 Α9: Η ΖΗΤΗΣΗ — «ανοιχτή εντολή» σε αγορά, ισότιμη με την
                             // προσφορά. ΕΓΓΡΑΦΟ (επίπεδο Β, ιδιωτικό ανά ΧΡΗΣΤΗ), σε αντίθεση με
                             // το `offr` που είναι στοιχείο πίνακα μέσα στο Property.
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `opp` (OPPORTUNITY) και το `leads`: εκείνα είναι
                             // CRM — «πιθανός ΠΕΛΑΤΗΣ ενός πωλητή», tenant-scoped σε εταιρεία, με
                             // στάδια χοάνης. Αυτό είναι δήλωση ΑΝΘΡΩΠΟΥ για ΑΚΙΝΗΤΟ, ανήκει στον
                             // ίδιο, και ζει ακόμη κι όταν καμία εταιρεία δεν την κυνηγά.
  OWNER_PROPERTY: 'ownp',    // ADR-777 Α14: Η ΠΡΟΣΦΟΡΑ ΤΟΥ ΙΔΙΩΤΗ — το ακίνητο όπως το δηλώνει ο
                             // ίδιος ο κάτοχός του. ΕΓΓΡΑΦΟ (επίπεδο Β, ιδιωτικό ανά ΧΡΗΣΤΗ), το
                             // κάτοπτρο του `dmnd`: εκείνο είναι «ζητώ», αυτό «προσφέρω».
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `prop` (PROPERTY): εκείνο είναι μονάδα ΜΕΣΑ σε
                             // κτίριο μέσα σε έργο ΕΤΑΙΡΕΙΑΣ, με υποχρεωτική αλυσίδα ADR-284 §3.1.
                             // Ίδιο πρόθεμα θα σήμαινε ότι δύο πράγματα με διαφορετικό γραφέα,
                             // διαφορετικό πεδίο απομόνωσης και διαφορετικούς κανόνες μοιράζονται
                             // χώρο ταυτοτήτων — η σύγχυση θα ήταν ΜΗ ΑΝΙΧΝΕΥΣΙΜΗ.
                             // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `offr` (PROPERTY_OFFER): εκείνο είναι η
                             // ΔΙΑΘΕΣΗ (στοιχείο πίνακα ΜΕΣΑ σε αυτό εδώ), όχι το ακίνητο.
  PROPERTY_DOSSIER: 'pdos',  // ADR-866 Ε-1 · Φ1.1: Ο ΦΑΚΕΛΟΣ ΤΟΥ ΑΚΙΝΗΤΟΥ — ό,τι αφορά το ΣΠΙΤΙ
                             // (σχέδια, μελέτες, τίτλοι, ιστορικό). ΕΓΓΡΑΦΟ (επίπεδο Β, ιδιωτικό
                             // ανά ΚΑΤΟΧΟ). ⚠️ ΞΕΧΩΡΙΣΤΟ από το `ownp`: η αγγελία ζει όσο η ΠΩΛΗΣΗ,
                             // ο φάκελος όσο το ΣΠΙΤΙ — πολλές αγγελίες στον χρόνο δείχνουν στον
                             // ΙΔΙΟ φάκελο, και ο φάκελος ΑΛΛΑΖΕΙ ΧΕΡΙΑ (Φ4) ενώ η αγγελία όχι.
  PRIVATE_MARKETING_EVENT: 'pmev', // ADR-864 Φ3: γεγονός συναίνεσης κλειστής διάθεσης — στοιχείο πίνακα ΜΕΣΑ στην εντολή, όχι έγγραφο.
  MANDATE_EVIDENCE: 'mevd',  // ADR-864 §19: παγωμένο αποδεικτικό βεβαίωσης — όνομα αντικειμένου στη ρίζα `mandate-evidence/`, όχι έγγραφο.
  MANDATE_REQUEST: 'mreq',   // ADR-827 §8.7: ΤΟ ΑΙΤΗΜΑ ΑΝΑΘΕΣΗΣ — «ανάλαβε την αγγελία μου».
                             // ⚠️ ΞΕΧΩΡΙΣΤΟ από την ΕΝΤΟΛΗ (`BrokeredListingMandate`), που ΔΕΝ έχει
                             // δικό της πρόθεμα επίτηδες: η εντολή είναι ΠΕΔΙΟ μέσα στο `ownp_*`,
                             // όχι έγγραφο — «αλλάζει χέρια, όχι ταυτότητα» (ADR-827 Α3). Το αίτημα
                             // αντίθετα είναι έγγραφο, γιατί επιβιώνει της απόρριψης: ένα `declined`
                             // κρατά αγγελία+όρους+χρόνο+γραφείο ώστε το γραφείο να μη δει δεύτερη
                             // φορά ό,τι έκρινε (§8.5) — και ΜΗΔΕΝ προσωπικά, γιατί δεν έλαβε ποτέ.
                             // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `brk` (BROKERAGE): εκείνο είναι η σύμβαση του
                             // ADR-230 σε έργο ΕΤΑΙΡΕΙΑΣ, με μεσίτη ως `cont_*`. Αυτό γεννιέται από
                             // ΙΔΙΩΤΗ που δεν είναι επαφή κανενός — και γίνεται επαφή ΜΟΝΟ αν το
                             // γραφείο δεχτεί (§8.4).
  FIRST_CONTACT: 'fcon',      // ADR-843: Η ΠΡΑΞΗ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ — «ενδιαφέρομαι», και μαζί
                              // ταξιδεύουν ΤΑ ΔΙΚΑ ΤΟΥ ΖΗΤΟΥΝΤΟΣ στοιχεία προς τον προσφέροντα.
                              // ΕΓΓΡΑΦΟ, με τον λόγο του `mreq`: έχει ΔΥΟ μέρη και επιβιώνει της
                              // απόσυρσης. Το ΠΕ6 λέει «ανακαλείται η ΣΧΕΣΗ, ποτέ η ΙΣΤΟΡΙΑ» —
                              // δηλαδή ένα `withdrawn` ΟΦΕΙΛΕΙ να κρατά ποιος πλησίασε ποιον και
                              // πότε. Σβησμένη πράξη αφήνει ΚΑΙ ΤΟΥΣ ΔΥΟ χωρίς τίποτα να δείξουν,
                              // και «δεν προστατεύει τον αδύναμο· προστατεύει όποιον έχει κάτι να
                              // κρύψει, και δεν ξέρουμε ποιος είναι αυτός».
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `cont` (CONTACT), και η διάκριση ΕΙΝΑΙ η
                              // απόφαση: αυτό είναι η ΠΡΑΞΗ της γνωριμίας — κίνηση με ημερομηνία,
                              // ανακλητή, ανάμεσα σε δύο ανθρώπους που δεν έχουν σχέση ακόμη. Το
                              // `cont_*` είναι η ΣΧΕΣΗ που (ADR-834) γεννιέται ΜΕΤΑ ΤΗ ΣΥΜΦΩΝΙΑ,
                              // ζει tenant-scoped σε πελάτη και έχει ίχνος ελέγχου (CHECK 3.17).
                              // Κοινό πρόθεμα θα σήμαινε ότι «σε πλησίασα» και «σε έχω στις επαφές
                              // μου» μοιράζονται χώρο ταυτοτήτων — και η σύγχυση θα φαινόταν ως
                              // ΔΙΑΡΡΟΗ: ανακαλείς την πράξη και μένει η επαφή, ή αντίστροφα.
                              // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `mreq`: εκείνο πάει από τον ΙΔΙΟΚΤΗΤΗ στο
                              // γραφείο («ανάλαβε την αγγελία μου») και ΚΡΥΒΕΙ το πρόσωπο όσο
                              // κρίνεται (§8.2). Αυτό ξεκινά από τον ΖΗΤΟΥΝΤΑ και η αποκάλυψη ΕΙΝΑΙ
                              // ο σκοπός του — αντίθετη κατεύθυνση, αντίθετο συμβόλαιο ιδιωτικότητας.
  AUTH_REPROVISION_JOURNAL: 'arj',
                              // ADR-844 §13.8: ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΤΗΣ ΔΙΕΚΔΙΚΗΣΗΣ. Η διεκδίκηση ξαναχτίζει
                              // τον λογαριασμό Auth (διαγραφή → δημιουργία, ΙΔΙΟ uid — η μόνη πράξη
                              // που σκοτώνει εκκρεμή κωδικό αλλαγής email στην παραγωγή). Ανάμεσα
                              // στα δύο ο λογαριασμός ΔΕΝ υπάρχει: αν πέσει η διεργασία, το ημερολόγιο
                              // λέει στην επόμενη απόδειξη «συνέχισε με ΑΥΤΟ το uid», αντί να γεννηθεί
                              // νέο και να μείνουν ορφανά τα δεδομένα του παλιού.
  WORKSPACE_ACCESS_REQUEST: 'wacr',
                              // ADR-660 §6: ΤΟ ΑΙΤΗΜΑ ΕΝΤΑΞΗΣ ΣΕ ΧΩΡΟ ΕΡΓΑΣΙΑΣ — οντότητα, όχι τιμή του
                              // `users/{uid}.status` (AIP-216 · GitHub/Slack/Entra). Ένα πεδίο απαντούσε
                              // δύο ερωτήματα («τι ταυτότητα έχει;» + «περιμένει έγκριση;»), και η
                              // απόδειξη email του πολίτη έσβηνε σιωπηλά το δεύτερο.
  IDEMPOTENCY_KEY: 'idk',
                              // ADR-853 Ε3 Φάση 2: ΤΟ ΚΛΕΙΔΙ ΙΔΕΜΠΟΤΙΑΣ ΜΙΑΣ ΛΟΓΙΚΗΣ ΠΡΑΞΗΣ (Stripe
                              // `Idempotency-Key`). Το γεννά ο πελάτης ΜΙΑ φορά ανά κλήση και το στέλνει
                              // ΙΔΙΟ σε κάθε επανάληψη — αλλιώς η επανάληψη θα ήταν νέα πράξη.
  IDEMPOTENCY_RECORD: 'idr',
                              // ADR-853 Ε3 Φάση 2: Η ΕΓΓΡΑΦΗ ΤΟΥ ΣΥΝΟΡΟΥ ΓΙΑ ΕΝΑ ΚΛΕΙΔΙ (κλείδωμα + αποθηκευμένη
                              // απάντηση). Ντετερμινιστική από (ποιος, μέθοδος, διαδρομή, κλειδί): δύο αιτήματα
                              // με το ίδιο κλειδί συγκρούονται στο ΙΔΙΟ έγγραφο — αυτό ΕΙΝΑΙ το κλείδωμα.
  SHOWCASE_LOCATION: 'sloc',
                              // ADR-841 §7 Α21.16: ΕΝΑ ΚΑΤΑΣΤΗΜΑ ΤΗΣ ΚΑΡΤΑΣ (έδρα ή υποκατάστημα).
                              // Στοιχείο πίνακα μέσα στο `agency_profiles/{companyId}`, όχι έγγραφο —
                              // αλλά ΧΡΕΙΑΖΕΤΑΙ σταθερή ταυτότητα: το ανώνυμο reveal ζητά «τα κανάλια
                              // ΑΥΤΟΥ του καταστήματος», και θέση στον πίνακα θα έδειχνε σε άλλο
                              // κατάστημα μόλις ο επαγγελματίας αφαιρέσει ένα από πάνω.
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από τις ταυτότητες διευθύνσεων των Επαφών (`CompanyAddress.id`):
                              // εκείνες είναι εσωτερικές εγγραφές εταιρείας· αυτό είναι δημοσιευμένη δήλωση.
  SHOWCASE_EMAIL_CONFIRMATION: 'secf',
                              // ADR-841 §7 Α21.18: ΤΟ ΑΙΤΗΜΑ ΕΠΙΒΕΒΑΙΩΣΗΣ ΕΝΟΣ EMAIL ΤΗΣ ΚΑΡΤΑΣ — «αυτό το
                              // γραμματοκιβώτιο λαμβάνει;». ΕΦΗΜΕΡΟ (72ω, μία χρήση), όχι η απόδειξη: η
                              // απόδειξη ζει ως ημερομηνία πάνω στο ίδιο το κανάλι.
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `fcin`: εκείνο αποδεικνύει το κανάλι ΑΝΩΝΥΜΟΥ που
                              // πλησιάζει· αυτό το κανάλι ΕΠΑΓΓΕΛΜΑΤΙΑ που δημοσιεύεται. Κοινό πρόθεμα θα
                              // ένωνε δύο κύκλους ζωής με αντίθετο κάτοχο σε έναν χώρο ταυτοτήτων.
  LANDING_HERO_REVISION: 'lhrev',
                              // ADR-881 §4.2: ΜΙΑ ΑΜΕΤΑΒΛΗΤΗ ΕΚΔΟΣΗ ΤΗΣ ΕΙΚΟΝΑΣ ΗΡΩΑ ΜΙΑΣ ΣΕΛΙΔΑΣ (μέρα + σούρουπο).
                              // Επίπεδο ΠΛΑΤΦΟΡΜΑΣ, όχι μισθωτή· είναι ΚΑΙ το υποκείμενο του δημόσιου ραφιού
                              // (`landing-heroes/lhrev_*/…`) ⇒ ο φρουρός του ραφιού απαιτεί ΑΚΡΙΒΩΣ αυτό το πρόθεμα.
  HOLIDAY_HOURS_QUESTION: 'hhq',
                              // ADR-841 §7 Α21.21 Φάση Β: Η ΕΡΩΤΗΣΗ «ΘΑ ΕΙΣΤΕ ΑΝΟΙΧΤΑ ΣΤΙΣ ΑΡΓΙΕΣ;» — ΜΙΑ ανά
                              // (γραφείο, εορταστική περίοδος). ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ: το ημερήσιο cron την ξαναρωτά
                              // κάθε μέρα, και η επανάληψη πρέπει να πέφτει στο ΙΔΙΟ έγγραφο χωρίς ερώτημα.
  EMAIL_DELIVERY_EVENT: 'edev',     // ADR-841 §7 Α21.20: ΣΥΜΒΑΝ ΠΑΡΑΔΟΣΗΣ EMAIL (delivered · failed · complained) — ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ
                              // κλειδί (`emailDeliveryEventKey`), ποτέ τυχαίο: ο πάροχος ξαναστέλνει και η επανάληψη πέφτει στο ΙΔΙΟ έγγραφο.
  EMAIL_RECIPIENT_STANDING: 'erst', // ADR-841 §7 Α21.20: «ΖΕΙ ΑΥΤΟ ΤΟ ΓΡΑΜΜΑΤΟΚΙΒΩΤΙΟ;» — ΜΙΑ κατάσταση ανά διεύθυνση (`recipientStandingKey`, sha256). Γεγονός του κόσμου, όχι μισθωτή.
  FIRST_CONTACT_INVITATION: 'fcin',
                              // ADR-844: Η ΠΡΟΣΚΛΗΣΗ — Ο,ΤΙ ΔΕΝ ΕΙΝΑΙ ΑΚΟΜΗ ΠΡΑΞΗ. Ο ανώνυμος
                              // επισκέπτης έγραψε όνομα + email και πάτησε· η πράξη ΔΕΝ φεύγει
                              // μέχρι να αποδειχθεί το κανάλι (σύνδεσμος ή εξαψήφιος κωδικός).
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `fcon`, και η διάκριση ΕΙΝΑΙ η απόφαση: το
                              // `fcon_*` έχει ΑΞΟΝΑ το `seekerUserId` — τον ίδιο άξονα που μετρά η
                              // χωρητικότητα των 10 ανοιχτών (ΠΕ5/Κ5/Κ9). Τη στιγμή της υποβολής
                              // εκείνος ο άνθρωπος ΔΕΝ ΕΧΕΙ ΑΚΟΜΗ ΛΟΓΑΡΙΑΣΜΟ, άρα δεν υπάρχει
                              // άξονας. Κοινό πρόθεμα θα σήμαινε «πράξη με κενό τον άξονα που τη
                              // μετρά» — δηλαδή ΑΠΕΙΡΗ χωρητικότητα, ακριβώς η παράκαμψη του ΠΕ5
                              // που το ADR-843 §10.18 Η απέρριψε ονομαστικά.
                              // ⚠️ ΚΑΙ ΕΦΗΜΕΡΟ, αντίθετα από το `fcon`: λήγει σε 7 μέρες και
                              // σβήνεται. Δεν κρατά ιστορία — απατημένη πρόσκληση δεν είναι
                              // «μισή πράξη», είναι ΚΑΜΙΑ πράξη, και ο ιδιοκτήτης δεν έμαθε ποτέ
                              // ότι υπήρξε. Το «ανακαλείται η ΣΧΕΣΗ, ποτέ η ΙΣΤΟΡΙΑ» του ΠΕ6 δεν
                              // ισχύει εδώ, γιατί ΔΕΝ ΓΕΝΝΗΘΗΚΕ σχέση.
  WORKSPACE_INVITATION: 'winv',
                              // ADR-853 §7.1: Η ΠΡΟΣΚΛΗΣΗ ΣΕ ΧΩΡΟ ΕΡΓΑΣΙΑΣ. Ο χώρος ξεκινά τη
                              // σχέση, γιατί ΜΟΝΟ αυτός ξέρει ποιος του ανήκει (Α1).
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `wacr`, και η ΚΑΤΕΥΘΥΝΣΗ είναι η διαφορά: το
                              // `wacr_*` πάει από τον ΑΝΘΡΩΠΟ στον χώρο («θέλω να μπω»), αυτό από
                              // τον ΧΩΡΟ στον άνθρωπο («σε θέλουμε μέσα»). Κοινό πρόθεμα θα
                              // σήμαινε ότι «ποιος ρώτησε» και «ποιος απάντησε» μοιράζονται χώρο
                              // ταυτοτήτων — και η ΕΓΚΡΙΣΗ του ενός θα έμοιαζε με ΑΠΟΔΟΧΗ του
                              // άλλου, δηλαδή ένταξη που δεν ζήτησε κανείς (το περιστατικό που
                              // γέννησε ολόκληρο το ADR-853).
                              // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `fcin`: εκείνο προσκαλεί ΑΝΩΝΥΜΟ σε επαφή
                              // για ΜΙΑ αγγελία· αυτό προσκαλεί σε ΙΔΙΟΤΗΤΑ ΜΕΛΟΥΣ, που επιβιώνει
                              // κάθε αγγελίας.
                              // ⚠️ Το σκέτο `inv` ΔΕΝ είναι ελεύθερο — το κρατά το INVOICE_ACC.
  NETWORK_THREAD: 'nthr',     // ADR-867 §4.1: ΝΗΜΑ ΑΝΑΜΕΣΑ ΣΕ ΣΥΝΕΡΓΑΤΕΣ ΔΙΑΦΟΡΕΤΙΚΩΝ ΧΩΡΩΝ.
                              // ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ ανά (πράξη) ή ανά (ζεύγος προσώπων) ⇒ ιδεμποτής γέννηση.
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `conv` (CONVERSATION, ADR-029): εκείνο είναι
                              // γραφείο ↔ εξωτερικό κανάλι, ορατό σε ΟΛΟ τον χώρο· αυτό είναι χώρος ↔
                              // χώρος ή πρόσωπο ↔ πρόσωπο, ορατό ΜΟΝΟ στο ακροατήριό του (ADR-834 (γ)).
  NETWORK_MESSAGE: 'nmsg',    // ADR-867 §4.1: μήνυμα μέσα σε `nthr`. ⚠️ Το `msg` το κρατούν ήδη ΔΥΟ
                              // (MESSAGE · MESSAGE_DOC) του omnichannel — τρίτο κοινό θα ήταν αδιάκριτο.
  NETWORK_MESSAGE_REVISION: 'nmrv', // ADR-867 Β7: ΤΟ ΚΕΙΜΕΝΟ ΠΡΙΝ ΑΠΟ ΜΙΑ ΕΠΕΞΕΡΓΑΣΙΑ — αντίγραφο
                              // συμμόρφωσης, κλειστό σε κάθε πελάτη (Teams: «one copy for compliance»).
                              // ΤΥΧΑΙΟ: ένα μήνυμα μπορεί να επεξεργαστεί πολλές φορές, κάθε φορά νέα γραμμή.
  NETWORK_ACT_TEAM: 'nteam',  // ADR-867 §4.3: Η ΟΜΑΔΑ ΤΗΣ ΠΡΑΞΗΣ (υπεύθυνος + μέλη). ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ ανά πράξη.
  NETWORK_BLOCK: 'nblk',      // ADR-867 §4.4: μονομερής φραγή, ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ ανά (φράσσων, φραγμένος).
  NETWORK_AWAY: 'naway',      // ADR-867 §4.4: δήλωση απουσίας προσώπου, ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ ανά πρόσωπο.
  STAY_BOOKING: 'stay',       // ADR-835 §6.1: Η ΚΡΑΤΗΣΗ ΒΡΑΧΥΧΡΟΝΙΑΣ ΔΙΑΜΟΝΗΣ — «αυτές οι
                              // νύχτες, σε αυτούς τους χώρους, για αυτόν τον άνθρωπο».
                              // ΕΓΓΡΑΦΟ, και ο λόγος είναι ο ίδιος με το `mreq`: έχει ΔΥΟ
                              // μέρη (επισκέπτης + οικοδεσπότης) και επιβιώνει της άρνησης —
                              // ένα `cancelled` κρατά ποιος ζήτησε τι και πότε, ώστε η
                              // ακύρωση να έχει ιστορία αντί να είναι εξαφάνιση.
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `offr` (PROPERTY_OFFER): εκείνο είναι η
                              // ΔΙΑΘΕΣΗ («νοικιάζω αυτό το κατάλυμα, 65 €/βράδυ») — στοιχείο
                              // πίνακα μέσα στο ακίνητο, μία ανά κατάλυμα. Αυτό είναι μια
                              // ΚΑΤΑΛΗΨΗ πάνω της — πολλές ανά διάθεση, καθεμιά με δικό της
                              // διάστημα. Κοινό πρόθεμα θα σήμαινε ότι «τι προσφέρεται» και
                              // «τι είναι πιασμένο» μοιράζονται χώρο ταυτοτήτων, και η
                              // σύγχυση θα φαινόταν ως ΔΙΠΛΟΚΡΑΤΗΣΗ.
                              // ⚠️ ΚΑΙ ΞΕΧΩΡΙΣΤΟ από το `appointment` (ραντεβού επίσκεψης):
                              // εκείνο είναι ώρα ενός ΜΕΣΙΤΗ, αυτό είναι νύχτες ενός ΧΩΡΟΥ.
  STAY_BLOCK: 'sblk',         // ADR-835 §20 (Στάδιο Α): ΚΛΕΙΣΜΕΝΕΣ ΝΥΧΤΕΣ — «εδώ δεν μένει κανείς»,
                              // ΧΩΡΙΣ επισκέπτη. ⚠️ ΞΕΧΩΡΙΣΤΟ από το `stay`: η κράτηση κουβαλά
                              // άνθρωπο (GDPR), το block όχι — και ο κριτής ξεχωρίζει τις δύο
                              // πηγές από το πρόθεμα της ταυτότητας (`occupancyId`). Κοινό
                              // πρόθεμα θα έκανε το «άνοιξε τις μέρες» ικανό να σβήσει ΚΡΑΤΗΣΗ.
  STAY_CALENDAR_MONTH: 'scmo', // ADR-835 §21 (Στάδιο Β): ΟΙ ΚΑΝΟΝΕΣ ΑΝΑ ΗΜΕΡΟΜΗΝΙΑ ΕΝΟΣ ΜΗΝΑ (τιμή, ελάχ./μέγ.
                              // νύχτες, CTA/CTD). ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ ανά (ακίνητο, μήνας): δύο ρυθμίσεις του ίδιου
                              // μήνα γράφουν το ΙΔΙΟ έγγραφο χωρίς ερώτημα. ⚠️ ΞΕΧΩΡΙΣΤΟ από το `sblk`: εκείνο
                              // ΚΛΕΙΝΕΙ νύχτες (κατάληψη), αυτό τις ΡΥΘΜΙΖΕΙ — κοινό πρόθεμα θα έκανε μια
                              // αλλαγή τιμής να μοιάζει με κλεισμένες μέρες στον κριτή.
  STAY_CHANNEL_FEED: 'schf',  // ADR-835 §22 (Στάδιο Γ): ΠΗΓΗ iCal ενός καταλύματος (Airbnb/Booking/Vrbo).
                              // ⚠️ ΞΕΧΩΡΙΣΤΟ από το `sblk`: η πηγή είναι ο ΛΟΓΟΣ που υπάρχουν κλεισμένες
                              // νύχτες, όχι οι νύχτες. Η ταυτότητά της ζει μέσα στο `channel.feedId` ΚΑΘΕ
                              // εξωτερικού block — κοινό πρόθεμα θα έκανε «σβήσε την πηγή» και «σβήσε τις
                              // νύχτες» να μοιάζουν ίδια πράξη.
  LISTING_VIEW_SALT: 'lvsl',  // ADR-777 §8.72: ΤΟ ΗΜΕΡΗΣΙΟ ΑΛΑΤΙ των προβολών — ένα ανά ημέρα, σβήνεται μετά
                              // από 2 μέρες ⇒ το hash επισκέπτη δεν ξαναϋπολογίζεται ποτέ (καμία PII).
  LISTING_VIEW_MARK: 'lvmk',  // ADR-777 §8.72: «ΑΥΤΟΣ Ο ΕΠΙΣΚΕΠΤΗΣ ΜΕΤΡΗΘΗΚΕ ΣΗΜΕΡΑ» — ντετερμινιστικό από το
                              // hash· το `create()` αποτυγχάνει αν υπάρχει ⇒ ο αποδυπλασιασμός είναι δομικός.
  LISTING_VIEW_SHARD: 'lvsh', // ADR-777 §8.72: ΖΕΣΤΟΣ ΜΕΤΡΗΤΗΣ (ακίνητο, ημέρα, shard). ⚠️ ΞΕΧΩΡΙΣΤΟ από το
                              // `lsta`: εκείνο είναι η ψυχρή σύνοψη που γράφει ΜΟΝΟ το cron.
  LISTING_STATS: 'lsta',      // ADR-777 §8.72: Η ΣΥΝΟΨΗ ΠΡΟΒΟΛΩΝ ενός ακινήτου — μία ανά ακίνητο, όχι ανά
                              // αγγελία: η απόσυρση σβήνει την προβολή, όχι την ιστορία (μάθημα §8.61).
  SAVED_LISTING: 'svls',      // ADR-777 §8.74: «ΤΗΝ ΚΡΑΤΗΣΑ» — μία ανά (άνθρωπο, αγγελία), ντετερμινιστική ⇒
                              // το δεύτερο κλικ βρίσκει το ίδιο έγγραφο. Η αφαίρεση το ΣΒΗΝΕΙ (ελαχιστοποίηση).
  // ADR-884 Φ0.7 — ΧΩΡΙΚΗ ΠΕΡΙΗΓΗΣΗ (πανοράματα 360° + BIM σε ΕΝΑ χώρο).
  SPATIAL_TOUR: 'stour',      // ντετερμινιστικό από (είδος ρίζας, id) ⇒ ΜΙΑ περιήγηση ανά αγγελία
  TOUR_NODE: 'tnod',          // σημείο στον χώρο — σταθερό στον χρόνο
  TOUR_CAPTURE: 'tcap',       // μία λήψη του σημείου, σε μία ημερομηνία (χρονολόγιο)
  TOUR_ACCESS_REQUEST: 'tacr', // ντετερμινιστικό από (περιήγηση, άνθρωπο) ⇒ ένα αίτημα θέασης ανά άνθρωπο
  TOUR_CAPTURE_INVITATION: 'tcin', // πρόσκληση φωτογράφου· επαναποστολή = νέο id, το παλιό `revoked` (ADR-853 §20)
  OWNERSHIP_TABLE: 'owntbl',  // ADR-235: Ownership percentage tables (deterministic composite key)
  TITLE_BLOCK_BINDING: 'tbb', // ADR-745 Φ3β: title-block cell → entity provenance (composite key)
  PROPERTY_OFFER: 'offr',     // ADR-777 Α20: ΔΙΑΘΕΣΗ — «ένα ακίνητο, πολλές διαθέσεις». Στοιχείο
                              // πίνακα μέσα στο Property, ΟΧΙ έγγραφο — και παίρνει ταυτότητα για
                              // τον ίδιο λόγο με τις γραμμές του ADR-759 Φ2β: μια διάθεση επιβιώνει
                              // αναδιάταξης, κλεισίματος και επαναδημοσίευσης. Χωρίς σταθερή
                              // ταυτότητα, «απόσυρε τις άλλες» (Α20 σημείο 4) δεν έχει υποκείμενο.
  SURVEY_RECORD: 'srv',       // ADR-759 Φ2: survey_records collection — institutional/legal plot data
                              // declared by a surveyor on a date. NOT `topo` (ADR-650) — that is TIN
                              // surface GEOMETRY per floor. Two meanings, two prefixes (ADR-759 §Ζ.2).

  // ADR-759 Φ2β — REPEATING ROWS INSIDE a survey record. Not documents; array
  // elements. They still get enterprise ids, and the reason is a rule, not a habit:
  //
  //   IFC gives a `GlobalId` only to ROOTED entities (subtypes of `IfcRoot`). A
  //   non-rooted value object — `IfcDocumentReference`, for instance — gets none,
  //   because it exists only through whoever references it. Revit draws the same
  //   line: every *element* carries a `UniqueId` assigned at creation that never
  //   changes; the *parameters* inside it do not, they are identified by definition.
  //
  // An act, an approval and a title deed are the rooted kind: the engineer points at
  // them one by one, and a deed links out to a notary contact. So each gets its own
  // prefix — one per row TYPE, mirroring `PO_ITEM` ('poi'), the project's existing
  // embedded-row precedent (`types/procurement/purchase-order.ts:193`).
  //
  // 🔴 The ΦΕΚ references (`GazetteRef`) and the remark strings deliberately get
  // NOTHING. They are value objects; their identity is their position. Minting ids
  // for them would claim an independence they do not have.
  SURVEY_ACT: 'svact',        // InstitutionalAct row — decree / ΓΠΣ / zoning act
  SURVEY_APPROVAL: 'svapr',   // SurveyApproval row — section Θ (ΕΓΚΡΙΣΕΙΣ)
  SURVEY_TITLE_DEED: 'svdeed', // SurveyTitleDeed row — section Ι (ΤΙΤΛΟΙ ΙΔΙΟΚΤΗΣΙΑΣ)

  // Legal Documents & Obligations
  SECTION: 'sec',
  ARTICLE: 'art',
  PARAGRAPH: 'par',
  OBLIGATION: 'obl',
  TRANSMITTAL: 'xmit',

  // OAuth 2.1 Authorization Server (ADR-738) — έγγραφα ΜΟΝΟ Admin SDK, deny-all στα rules
  /** Στιγμιότυπο CIMD ενός MCP client (client_id = HTTPS URL, βλ. ADR-738 §4). */
  OAUTH_CLIENT: 'oacli',
  /**
   * Εκκρεμές αίτημα εξουσιοδότησης — ζει όσο ο **άνθρωπος** σκέφτεται.
   * Ξεχωριστό από το `OAUTH_CODE` επίτηδες: άλλος κύκλος ζωής (λεπτά έναντι
   * δευτερολέπτων) και άλλος καταναλωτής (browser έναντι μηχανής).
   */
  OAUTH_AUTH_REQUEST: 'oareq',
  /** Authorization code — εφήμερο (60s), μιας χρήσης. */
  OAUTH_CODE: 'oacode',
  /** Access ή refresh token — αποθηκεύεται **μόνο** ως SHA-256, ποτέ ωμό. */
  OAUTH_TOKEN: 'oatok',
  /** Συγκατάθεση χρήστη προς client — ό,τι ο Γιώργος βλέπει και ανακαλεί. */
  OAUTH_CONSENT: 'oacons',

  // Runtime & Ephemeral
  SESSION: 'sess',
  TRANSACTION: 'txn',
  NOTIFICATION: 'notif',
  TASK: 'task',
  EVENT: 'evt',
  REQUEST: 'req',
  MESSAGE: 'msg',
  JOB: 'job',

  // DXF / CAD Viewer
  OVERLAY: 'ovrl',
  LEVEL: 'lvl',
  /** ADR-375 Phase B.3 — BIM View Template (reusable preset of drawingScale + viewRange + objectStyles). */
  VIEW_TEMPLATE: 'vtmpl',

  // Floorplan Background System (ADR-340)
  RASTER_BACKGROUND: 'rbg',

  // UI & Visualization
  LAYER: 'lyr',
  ELEMENT: 'elem',
  HISTORY: 'hist',
  ANNOTATION: 'annot',
  CONTROL_POINT: 'cp',
  ENTITY: 'ent',
  CUSTOMIZATION: 'cust',

  // Observability & Monitoring
  ERROR: 'err',
  METRIC: 'metric',
  ALERT: 'alert',
  TRACE: 'trace',
  SPAN: 'span',
  SEARCH: 'search',
  AUDIT: 'audit',

  // DevOps & Operations
  CONTAINER: 'ctr',
  DEPLOYMENT: 'deploy',
  PIPELINE: 'pipe',
  BACKUP: 'backup',
  RESTORE: 'rst',
  MIGRATION: 'migr',
  TEMPLATE: 'tpl',
  OPERATION: 'op',

  // BOQ / Quantity Surveying (ADR-175)
  BOQ_ITEM: 'boq',
  BOQ_CATEGORY: 'boqcat',
  BOQ_PRICE_LIST: 'boqpl',
  BOQ_TEMPLATE: 'boqtpl',

  // Accounting (Subapp — ADR-ACC-001 through ADR-ACC-010)
  JOURNAL_ENTRY: 'je',
  INVOICE_ACC: 'inv',
  BANK_TRANSACTION: 'btxn',
  FIXED_ASSET: 'fxa',
  DEPRECIATION: 'depr',
  EFKA_PAYMENT: 'efka',
  IMPORT_BATCH: 'batch',
  MATCH_GROUP: 'mgrp',
  MATCHING_RULE: 'mrule',
  EXPENSE_DOC: 'exdoc',
  APY_CERTIFICATE: 'apy',
  SERVICE_PRESET: 'sp',
  CUSTOM_CATEGORY: 'custcat',
  CUSTOMER_BALANCE: 'cbal',
  FISCAL_PERIOD: 'fp',
  ACCOUNTING_AUDIT_LOG: 'alog',

  // File & Media Operations
  PHOTO: 'photo',
  ATTACHMENT: 'att',
  FILE: 'file',
  SHARE: 'share',
  DISPATCH: 'dispatch',
  PENDING: 'pending',
  SUBSCRIPTION: 'sub',
  FOLDER: 'fldr',
  COMMENT: 'cmt',
  APPROVAL: 'appr',

  // Construction & Building (ADR-034: Gantt Chart)
  CONSTRUCTION_PHASE: 'cphase',
  CONSTRUCTION_TASK: 'ctask',
  CONSTRUCTION_BASELINE: 'cbase',
  CONSTRUCTION_RESOURCE_ASSIGNMENT: 'crasn',
  CONSTRUCTION_ALERT: 'calert',
  MILESTONE: 'mile',

  // Attendance (ADR-170: QR + GPS Geofencing)
  ATTENDANCE_QR_TOKEN: 'qrtok',
  ATTENDANCE_EVENT: 'attev',

  // Address Corrections Telemetry (ADR-332 §3.7 Phase 9)
  ADDRESS_CORRECTION_LOG: 'acl',

  // HR & Employment
  EMPLOYMENT_RECORD: 'emprec',
  APPOINTMENT: 'appt',

  // Org Structure (ADR-326)
  ORG_STRUCTURE: 'org',
  ORG_DEPARTMENT: 'odep',
  ORG_MEMBER: 'omem',

  // Integrations
  WEBHOOK: 'whk',

  // AI Learning
  LEARNED_PATTERN: 'lp',
  QUERY_STRATEGY: 'qstr',
  AI_CHAT_HISTORY: 'ach',

  // Omnichannel Conversations (ADR-031)
  CONVERSATION: 'conv',
  MESSAGE_DOC: 'msg',
  EXTERNAL_IDENTITY: 'eid',

  // Banking
  BANK_ACCOUNT: 'bacc',

  // Navigation & Routing
  NAVIGATION: 'nav',
  ROUTE_CONFIG: 'rcfg',

  // Voice Commands (ADR-164)
  VOICE_COMMAND: 'vcmd',

  // AI Pipeline & Audit
  FEEDBACK: 'fb',
  PIPELINE_AUDIT: 'paud',
  ENTITY_AUDIT: 'eaud',
  CLOUD_FUNCTION_AUDIT: 'cfaud', // ADR-874: `audit_log` rows written by Cloud Functions (was declared only in functions/)
  // ADR-873 Φ1 §9.1 — ο δείκτης «αυτή η ΑΛΛΑΓΗ έγινε ήδη» των Cloud Functions.
  // Η ταυτότητα είναι ντετερμινιστική από τον σπόρο της αλλαγής (`lib/idempotency/event-claim.ts`),
  // ώστε ΚΑΘΕ παρατηρητής του ίδιου γεγονότος να φτάνει στο ΙΔΙΟ έγγραφο και το `create()` να
  // αποτυγχάνει στον δεύτερο. Συλλογή: `function_event_records`.
  FUNCTION_EVENT: 'fevt',
  AI_USAGE: 'aiu',            // ADR-259A
  CONTRACT: 'lc',
  PIPELINE_QUEUE: 'pq',
  BROKERAGE: 'brk',
  COMMISSION: 'com',
  PAYMENT_PLAN: 'pp',
  PLAN_GROUP: 'ppg',
  PAYMENT_RECORD: 'pay',
  LOAN: 'loan',
  CHEQUE: 'chq',

  // Financial Intelligence (SPEC-242C)
  DEBT_MATURITY: 'dmt',
  BUDGET_VARIANCE: 'bvar',

  // Procurement (ADR-267)
  PURCHASE_ORDER: 'po',
  PO_ITEM: 'poi',
  PO_ATTACHMENT: 'poatt',

  // Quotes & RFQ (ADR-327)
  QUOTE: 'qt',
  RFQ: 'rfq',
  VENDOR_INVITE: 'vi',
  VENDOR_INVITE_CREDENTIAL: 'vic', // ADR-876 §5: ένας σύνδεσμος πύλης = ένα διαπιστευτήριο
  TRADE: 'trd',
  VENDOR_LOGO: 'vlogo',       // ADR-327 §6: deterministic per-quote logo claim

  // Quotes & RFQ — Multi-Vendor extension (ADR-327 §17 Q28-Q31, 2026-04-29)
  SOURCING_EVENT: 'srcev',    // §17 Q31: parent collection multi-trade RFQ package (HYBRID A-Enhanced)
  RFQ_LINE: 'rfqln',          // §17 Q29: sub-collection rfqs/{rfqId}/lines/{lineId} (HYBRID Γ BOQ-first)

  // Material Catalog (ADR-330 Phase 4)
  MATERIAL: 'mat',            // company-wide material master with ATOE FK + preferred suppliers

  // Framework Agreements (ADR-330 Phase 5)
  FRAMEWORK_AGREEMENT: 'fwa', // multi-project vendor contract with volume discount rules

  // Reports (ADR-268 Phase 7)
  SAVED_REPORT: 'srpt',

  // Cash Flow (ADR-268 Phase 8)
  RECURRING_PAYMENT: 'rpay',

  // DXF / CAD / BIM (ADR-344 · ADR-358 · ADR-362 · ADR-363 · ADR-366 · ADR-373 · ADR-676)
  ...DXF_BIM_ID_PREFIXES,

  // Optimistic & Temporary
  OPTIMISTIC: 'opt',
  TEMP: 'tmp',
} as const;

export type EnterpriseIdPrefix = typeof ENTERPRISE_ID_PREFIXES[keyof typeof ENTERPRISE_ID_PREFIXES];

// `EnterpriseId` + `IdGenerationConfig` live in `./enterprise-id-types` (N.7.1 SRP split).
