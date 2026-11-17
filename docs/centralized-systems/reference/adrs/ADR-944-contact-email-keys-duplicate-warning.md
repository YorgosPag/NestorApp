# ADR-944 — Κλειδιά email επαφής και προειδοποίηση «το email υπάρχει ήδη σε άλλη επαφή»

| | |
|---|---|
| **Status** | ✅ IMPLEMENTED (κώδικας) — 2026-11-17 · ⏳ ανάπτυξη δείκτη στο Firebase · ⏳ συμπλήρωση υπαρχουσών επαφών · ✅ jest (21/21) + ai-pipeline (86 σουίτες) πράσινα · ⏳ browser |
| **Date** | 2026-11-17 |
| **Category** | Contacts / Data Model |
| **Canonical Location** | `src/lib/contacts/contact-email-keys.ts` (παραγωγή) · `src/lib/validation/contact-email-uniqueness.ts` (έλεγχος) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-915 §40.8 (ίδια αφορμή: «Συνδέθηκε ως») · ADR-884 §4.6 (`findContactByEmail` σαρώνει όλες τις επαφές) · ADR-268 Q88 (`personaTypes`, το πρότυπο παράγωγου πεδίου) · ADR-017 / N.6 |

---

## 1. Το πρόβλημα

Ερώτημα Giorgio (2026-11-17): «είναι σωστό η εφαρμογή να δέχεται δύο ίδια email που ανήκουν σε διαφορετικά άτομα;»

- Η φόρμα επαφών ελέγχει διπλό email **μόνο μέσα στην ίδια επαφή** (`validateEmailsArray`). Ανάμεσα σε επαφές
  υπάρχει έλεγχος για **ΑΦΜ** (`checkVatUniqueness`), **όχι** για email.
- **Δομική αιτία:** το `emails` είναι πίνακας **αντικειμένων** (`{email, type, isPrimary, label}`). Το Firestore δεν
  μπορεί να ρωτήσει «ποια επαφή έχει αυτό το email» — το `array-contains` θέλει ολόκληρο το αντικείμενο. Γι' αυτό το
  `findContactByEmail` (διακομιστής) **σαρώνει όλες** τις επαφές του γραφείου σε σελίδες των 500.

## 2. Έρευνα (2026-11-17)

| Παίκτης | Πρακτική | Πηγή |
|---|---|---|
| Salesforce | Duplicate Rules: email **ακριβές, χωρίς διάκριση πεζών/κεφαλαίων**· ενέργεια «Block» ή «Allow with Alert» με **σύνδεσμο** στις υπάρχουσες εγγραφές | Trailhead *Duplicate Management* · salesforceben.com |
| HubSpot | email = μοναδικό κλειδί επαφής, **αποκλείει** δεύτερη επαφή με ίδιο email | knowledge.hubspot.com *Deduplication of records* |
| HubSpot (κοινότητα) | παράπονα για κοινά `info@` που **δεν** μπορούν να ανήκουν σε δύο επαφές | community.hubspot.com |

**Συμπέρασμα:** **προειδοποίηση, όχι φραγμός** («Allow with Alert»). Σε κατασκευαστική/μεσιτική πράξη κοινά
γραμματοκιβώτια (γραμματεία γραφείου, `info@`) είναι **θεμιτά**· ο HubSpot είναι το αντιπαράδειγμα.

## 3. Απόφαση

### 3.1 Παράγωγο πεδίο `emailKeys: string[]`
- **Κλειδί = πεζά + trim.** **Όχι** αφαίρεση `+tag`/τελειών Gmail: `x+arch1@gmail.com` και `x@gmail.com` είναι
  **διαφορετικά** γραμματοκιβώτια για την εφαρμογή (οι προσκλήσεις πάνε στο ακριβές)· η ένωσή τους θα ήταν μαντεψιά.
- Μοναδικά, ταξινομημένα ⇒ ιδεμπότητο, σταθερό diff.
- **ΕΝΑ SSoT παραγωγής:** `contactEmailKeys(emails, flatEmail)` · `emailKeyOf(email)` · `CONTACT_EMAIL_KEYS_FIELD`.
- Τύπος: `BaseContact.emailKeys?: string[]` (`types/contacts/contracts.ts`), δίπλα στο `personaTypes`.

### 3.2 Κάθε γραφέας επαφής το γράφει — στην **ίδια** εγγραφή με τα email

| Γραφέας | Πώς |
|---|---|
| Πελάτης create / update (`contacts.service.ts`) | `applyDerivedFieldsOnCreate` / `…OnUpdate` (`services/contacts/contact-derived-fields.ts`, εξήχθη μαζί με το δίδυμο μπλοκ `personaTypes` — το αρχείο **μίκρυνε** 500 → 494) |
| Πελάτης μαζική εισαγωγή (`contacts-query.service.ts importContacts`) | `applyDerivedFieldsOnCreate` |
| Διακομιστής: κοινός builder (`contact-document-builder.ts`) — καλύπτει `createContactServerSide` + `account-contact-resolver` | `contactEmailKeys([], params.email)` |
| `contact-lookup-crud.ts` προσθήκη / καθαρισμός email | `arrayUnion(key)` / `[]` |
| `resolve-helpers.ts storeContactEmail` | `arrayUnion(emailKeyOf(email))` |
| `contact-handler.ts` (AI, προσθήκη email) · `invoice-auto-enrichment.ts` · `email-inbound-service.ts` · `commit-signatory-service.ts` | `contactEmailKeys(…)` πάνω στον πίνακα που γράφεται |

🔑 **Update = μερικό:** κλειδιά γράφονται **μόνο** όταν το φορτίο αγγίζει `emails`. `undefined` ⇒ άθικτα· sentinel
διαγραφής (ο καθαριστής μετατρέπει `[]` σε `deleteField()`) ⇒ διαγραφή και των κλειδιών.

### 3.3 Ερώτημα δείκτη
`where('companyId','==',c) · where('emailKeys','array-contains',k) · limit(3)` — σύνθετος δείκτης `contacts` ·
`companyId ASC` + `emailKeys CONTAINS` στο `firestore.indexes.json`. Ο μισθωτής από το token (`useCompanyId`).

### 3.4 Προειδοποίηση στη φόρμα
- `findEmailDuplicates` (ως 10 email/φόρμα) → `useContactEmailUniqueness` (debounce 500ms · αυτο-εξαίρεση · **καμία
  κούρσα**: παλιότερη απάντηση απορρίπτεται με αύξοντα αριθμό) → `EmailDuplicateNotice` κάτω από την ενότητα email του
  `DynamicContactArrays`, **μόνο σε επεξεργασία**.
- «Το {email} υπάρχει ήδη σε: <σύνδεσμος επαφής>» + «Η αποθήκευση επιτρέπεται — ελέγξτε μήπως πρόκειται για το ίδιο
  πρόσωπο, ή για κοινό γραμματοκιβώτιο». `role="status"` (όχι `alert`)· κείμενο + εικονίδιο (CHECK 3.41).
- **Fail-open:** αποτυχία ερωτήματος ⇒ καμία προειδοποίηση· η αποθήκευση **ποτέ** δεν μπλοκάρεται από τον έλεγχο.
- Κλειδιά `contacts-form:validation.emailDuplicate.*` (el + en).

### 3.5 Συμπλήρωση
`scripts/backfill-contact-email-keys.ts` — `CONFIRM_BACKFILL=true` · ξηρή εκτέλεση προεπιλογή · `--execute` για εγγραφή ·
γράφει **μόνο** όπου διαφέρει (`sameEmailKeys`) · αγγίζει **μόνο** το `emailKeys` (χωρίς σφραγίδα χρήστη) · τυπώνει ids
και πλήθος κλειδιών, **όχι** διευθύνσεις.

### 3.6 Αναζήτηση στον διακομιστή (2026-11-17)
- `findContactByEmail` (`ai-pipeline/shared/contact-lookup-search.ts`): **ερώτημα δείκτη** `companyId ==` +
  `emailKeys array-contains` · `limit(1)` — αντί για σάρωση όλων των επαφών σε σελίδες των 500 (ADR-884 §4.6).
  Σφάλμα (π.χ. δείκτης μη αναπτυγμένος) **ανεβαίνει** — «δεν ξέρω» δεν γίνεται ποτέ «δεν υπάρχει».
- Ο ιδιωτικός δίδυμος του `email-inbound-service.ts` (έψαχνε **μόνο** επίπεδα πεδία `email`/`primaryEmail`/
  `contactEmail`/`officialEmail` ⇒ δεν έβρισκε επαφή με `emails[]` και έφτιαχνε δεύτερη) **διαγράφηκε**· καλεί τον ΕΝΑ.
- `normalizeEmail` (inbound) = `emailKeyOf(email) ?? ''` — ένας κανόνας κανονικοποίησης.
- 🔴 **Σειρά ανάπτυξης**: δείκτης στο Firebase **και** συμπλήρωση **πριν** το push — αλλιώς επαφή χωρίς κλειδιά
  δεν βρίσκεται (αποδοχή εντολής / έγκριση θέασης / εισερχόμενο email θα έφτιαχναν δεύτερη καρτέλα).

## 4. Απορρίφθηκαν
- **Φραγμός** (HubSpot) — κοινά γραμματοκιβώτια είναι θεμιτά.
- **Σάρωση από τον πελάτη** (όπως το `findContactByEmail`) — O(n) αναγνώσεις σε κάθε πλήκτρο.
- **Cloud Function που παράγει το πεδίο** — αντιδραστική, με παράθυρο όπου η επαφή δεν βρίσκεται, και χωριστή ανάπτυξη
  (Firebase, όχι Netcup). Η παραγωγή ζει στον γραφέα (Google N.7.2 #1 προληπτικό).
- **Κανονικοποίηση Gmail** (τελείες, `+tag`) — εξαρτάται από τον πάροχο· μαντεψιά.

## 5. Δηλωμένα όρια
- ⚠️ **Ο δείκτης πρέπει να αναπτυχθεί στο Firebase** (`firebase deploy --only firestore:indexes`) — το push πάει στο
  Netcup. Χωρίς αυτόν το ερώτημα αποτυγχάνει ⇒ fail-open ⇒ καμία προειδοποίηση (καμία ψευδής δήλωση).
- ⚠️ **Πριν τη συμπλήρωση** οι παλιές επαφές δεν βρίσκονται.
- Επαφή με **μόνο** παλαιό επίπεδο `email` (χωρίς `emails[]`): ο πελατικός update αφαιρεί το επίπεδο πεδίο από το φορτίο,
  άρα μετά από επεξεργασία των email του τα κλειδιά προκύπτουν από το `emails[]` μόνο. Η συμπλήρωση το καλύπτει για ό,τι
  υπάρχει σήμερα.

## 6. Tests (πράσινα 2026-11-17)
`src/lib/contacts/__tests__/contact-email-keys.test.ts` — Κ1–Κ3 (κλειδί), Π1–Π3 (παραγωγή, ιδεμποτία), Ι1 (σύγκριση).

## 7. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-11-17 | **Το `emailKeys` στο Ιστορικό: παράγωγο → αυθεντία (ADR-195 (η)).** Ζωντανή επαλήθευση: η συμπλήρωση έγραψε στο Ιστορικό επαφής «Προστέθηκε **emailKeys**: …» — ωμό όνομα πεδίου, και (μετρημένο στον κώδικα) **κάθε** αλλαγή email θα έγραφε ΚΑΙ δεύτερη γραμμή `emailKeys`. Θεραπεία: `emailKeys: 'emails'` στο `CONTACT_DERIVED_MIRRORS` (ίδιο πρότυπο με το `personaTypes`) ⇒ σωπαίνει όταν άλλαξαν και τα emails· όταν αλλάζει **μόνο του** (συμπλήρωση/απόκλιση) φαίνεται, με ετικέτα «Κλειδιά αναζήτησης email» (el + en). Αναπαράχθηκε η προβολή των Functions (CHECK 3.93). ⚠️ Ο CDC τρέχει στο Cloud Functions: η σιώπηση ισχύει **μετά** από `firebase deploy --only functions` — το push δεν το αναπτύσσει. |
| 2026-11-17 | Σήμα «Διαφορετικό όνομα» ως παράγωγη κατάσταση στον πελάτη → ADR-915 §40.10 (καμία αλλαγή στα `emailKeys`). |
| 2026-11-17 | Συνέχεια των σημάτων ταυτότητας επαφής: «Υιοθέτηση ονόματος από τον λογαριασμό» → ADR-915 §40.9 (καμία αλλαγή στα `emailKeys`). |
| 2026-11-17 | §3.6: `findContactByEmail` σε ερώτημα δείκτη (κλείνει ADR-884 §4.6 / ratchet) · διαγραφή δίδυμου του inbound · `normalizeEmail` → `emailKeyOf` · script συμπλήρωσης δέχεται κλειδί από το περιβάλλον (worktree). |
| 2026-11-17 | Αρχική έκδοση: `emailKeys` σε όλους τους γραφείς · δείκτης · έλεγχος + προειδοποίηση στη φόρμα · script συμπλήρωσης. |
