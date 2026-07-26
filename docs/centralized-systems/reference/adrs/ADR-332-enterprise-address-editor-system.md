# ADR-332 — Enterprise Address Editor System (Full Transparency)

**Status:** ✅ IMPLEMENTED — Phase 10 completed 2026-05-06
**Date:** 2026-05-05
**Author:** Claude (Opus 4.7) + Γιώργος
**Mandate:** GOL + SSOT — full enterprise scope, no MVP variants
**Related ADRs:** ADR-168 (draggable markers), ADR-277 (drag hierarchy clear), ADR-279/280 (i18n runtime resolver), ADR-294 (SSoT ratchet), ADR-298 (Firestore rules tests), ADR-318 (derived work addresses), ADR-319 (HQ positional invariant), ADR-330 (procurement hub)

---

### Changelog

| Date | Changes |
|------|---------|
| 2026-07-26 | 🟢 **Η επιλεγμένη επαφή ζει στο URL· ο δεύτερος μηχανισμός καταργήθηκε** (D21). Το «ποια επαφή είναι ανοιχτή;» απαντιόταν από **δύο** μηχανισμούς (`?contactId=` για ανάγνωση + `contact-selected` στο `sessionStorage` ως δικλείδα) — **διπλότυπο αρμοδιότητας**, αόρατο σε κάθε gate (δεν είναι διπλότυπο κώδικα). Το URL δεν χρειάζεται δικλείδα ⇒ ολόκληρη η κατηγορία ελαττωμάτων του D20/D20.1 **εξαφανίζεται** αντί να διορθώνεται· ο κώδικας του D20.1 έγινε νεκρός και **διαγράφηκε**. 🔴 **Το εύρημα που ανέτρεψε τον σχεδιασμό:** η τεκμηριωμένη υπόσχεση του Next ότι τα `pushState`/`replaceState` «integrate into the Next.js Router … sync with `useSearchParams`» **ισχύει μόνο στο production build** — το ίδιο ακριβώς probe (`?filter=Δοκ`, χωρίς router) στο **production** εμφάνισε banner + φιλτράρισε 4→2, στον **dev server** έδωσε **μηδέν** επανασχεδίαση. Η πρώτη υλοποίηση στηρίχθηκε σε αυτό και έσπασε τοπικά («πατάω πάνω στις κάρτες και δεν ανοίγουν»). **Διόρθωση:** η αντιδραστικότητα **παράγεται**, δεν ανατίθεται — `@/lib/url-query-state` τυλίγει μία φορά τα history APIs + `popstate`, ο hook καταναλώνει με `useSyncExternalStore` (ο μηχανισμός του `nuqs`, χωρίς την εξάρτηση). Λύθηκαν και **δύο σημασιολογικές συγκρούσεις**: το `if (contactIdParam) return true` απενεργοποιούσε **όλα** τα φίλτρα για **όλες** τις επαφές (⇒ κάθε κλικ θα σκότωνε την αναζήτηση) και το banner επιστροφής κρεμόταν από την παρουσία του param (⇒ θα εμφανιζόταν σε κάθε κλικ). Η **επαφή** είναι πλέον **παράγωγο** της λίστας ⇒ διαγράφηκαν ο χειροκίνητος συγχρονιστής επιλογής + 3 διπλές εγγραφές. **Φάση 0 (production):** **κανένα remount** σε επιλογή + lazy καρτέλα ⇒ το Π1 **δεν αναπαράγεται** και το «στένεμα Suspense» **δεν** χρειάστηκε· ο ισχυρισμός «το Suspense πετάει τη σελίδα» παραμένει **αναπόδεικτος**. **Παράπλευρα (N.0.2/N.18):** ADR-400 `viewport-persistence` + `camera3d-persistence` delegate στο κοινό primitive· `useReportBuilder` έκανε `replaceState(null, …)` που **έσβηνε το `history.state` του App Router**· 3 κλώνοι καθαρίστηκαν. **80/80** στις θιγμένες σουίτες, **+35 νέα tests**, `jscpd:diff` καθαρό. Ζωντανή επαλήθευση: επιλογή/εναλλαγή/reload-επιβίωση/banner ✅, καμία προειδοποίηση hydration. |
| 2026-07-26 | 🔴 **Η δικλείδα επιλογής έσβηνε το ίδιο της το κλειδί** (D20.1). Πρώτη ζωντανή επαλήθευση του D20 Μέρος Α — είχε κλείσει με 13 πράσινα tests και **μηδέν** ζωντανή εκτέλεση, το ίδιο μοτίβο με τη D18.1. Ανιχνευτής σε φρέσκο document: `INIT{stored:"cont_54fa…", cacheLen:0, hasLoaded:false, result:null}` → 325ms μετά `WRITE{id:null}` → **το κλειδί σβήστηκε πριν φτάσουν τα δεδομένα**. **Αιτία:** το `null` έχει **δύο** σημασίες — «η επαφή δεν υπάρχει πια» (σβήσε) και «η λίστα δεν φόρτωσε ακόμη» (**μη** σβήσεις) — και το «ΕΝΑ σημείο γραφής» τις μετέφραζε **και τις δύο** σε `removeItem`. Το κενό ήταν γραμμένο **αυτολεξεί** στο doc-comment («και όταν η λίστα δεν έχει φορτώσει ακόμη»): περιγράφηκε ως συμπεριφορά αντί να αναγνωριστεί ως ελάττωμα. **Διόρθωση:** η διάκριση παίρνεται **όταν υπάρχει η πληροφορία** — φρουρά γραφής `isSelectionWriteAllowed` + δεύτερη-και-τελευταία ευκαιρία `resolveLateSelectionRestore` (`restored`/`garbage`/`nothing`), και οι δύο **καθαρές αποφάσεις** στο υπάρχον SSoT· ο κύκλος ζωής περνά σε **ΕΝΑΝ** ιδιοκτήτη, `useSelectedContactPersistence` (γραφή **και** καθυστερημένη επαναφορά μαζί, ιδεμποτεντικά — αλλιώς διαγραμμένη επαφή θα «επανερχόταν» σε κάθε ανανέωση λίστας). **+8 tests (13 → 21/21), mutation-verified** (φρουρά → `return true` ⇒ **3 πτώσεις**, reverted)· σουίτα επαφών **225/225 σε 18 suites**· `jscpd:diff` καθαρό σε 4 αρχεία. **Ζωντανά στο production:** (α) η επιλογή **επιβιώνει** σε πραγματικό reload· (β) «Νέα Διεύθυνση» → Ακύρωση ⇒ «Διευθύνσεις (9)» αμετάβλητο, **καμία** κενή γραμμή — το draft promotion δουλεύει. ⚠️ **Ειλικρίνεια:** το ελάττωμα του ίχνους **δεν αναπαράγεται στο production** (εκεί η λίστα είναι διαθέσιμη στον αρχικοποιητή)· η διόρθωση αφορά το αποδεδειγμένο παράθυρο όπου δεν είναι — **δεν** δηλώνεται ότι το production ήταν σπασμένο. ⚠️ Το dev περιβάλλον μπλόκαρε το `sessionStorage` (`SecurityError`) μετά από επανειλημμένα reload ⇒ οι τελευταίες τοπικές μετρήσεις ήταν άκυρες και η επαλήθευση μεταφέρθηκε στο production. ΟΧΙ tsc (N.17). |
| 2026-07-27 | 🔵 **«Εξαφανίστηκαν οι διευθύνσεις μου» — η επικεφαλίδα δεν έλειπε, είχε κυλήσει εκτός οθόνης** (D19). Μετά το save η καρτέλα Διευθύνσεων φαινόταν κομμένη, χωρίς «Διευθύνσεις (N)» και χωρίς μπάρα καρτελών· hard reload τις έδειχνε όλες. **Η βάση ήταν σωστή σε κάθε μέτρηση** (8/8 διευθύνσεις σε `customFields.companyAddresses` **και** `addresses`) — το write path της D18.1 δεν φταίει, ούτε το `handleContactUpdatedInPlace` (κάνει φρέσκο `getContact`), ούτε race με το Firestore. **Αιτία:** ο inline editor διεύθυνσης είναι ~600px· στο τέλος της επεξεργασίας αποπροσαρτάται και ο πάνακας κονταίνει απότομα, ενώ το `scrollTop` **μένει** — ο χρήστης κοιτά το κάτω κομμάτι μιας πλέον κοντής λίστας τη στιγμή που το σύστημα λέει «επιτυχώς». Το reload «διόρθωνε» επειδή μηδενίζει την κύλιση. **Διόρθωση στον ΕΝΑ ιδιοκτήτη της κύλισης:** προαιρετικό `scrollResetToken` στον `DetailsContainer` (κατέχει το μοναδικό scroll container **όλων** των σελίδων λεπτομερειών) — επαναφορά στην κορυφή όταν αλλάζει, ποτέ στο πρώτο mount, **καμία** επίδραση σε σελίδες που δεν περνούν token· ο `useContactDetailsController` το αυξάνει σε κάθε τέλος συνεδρίας επεξεργασίας, **αποθήκευση και ακύρωση** (η ακύρωση άφηνε την ίδια κομμένη εικόνα). Re-anchor και όχι διατήρηση θέσης, γιατί το άγκυρο (η φόρμα) **έπαψε να υπάρχει**. **Δεύτερο εύρημα, ίδια οικογένεια — «το κουμπί δεν κάνει τίποτα»:** η αλλαγή καρτέλας σε αποτυχία επικύρωσης ήταν **νεκρός κώδικας**· το `setActiveTab(errorTab)` κατέληγε στο `defaultTab` του `StateTabs`, που διαβάζεται **μία φορά** στον αρχικοποιητή του `useState`. Το `StateTabs` υποστήριζε ήδη ελεγχόμενο `value` — το `FormTabsShell` **δεν το περνούσε ποτέ**. Προστέθηκε προαιρετικό `activeTab` με δικλείδα «άγνωστο id ⇒ αγνοείται» (αλλιώς το Radix αφήνει τον πάνακα **κενό** όταν το αποθηκευμένο id ανήκει σε άλλον τύπο επαφής: `addresses` vs `address`). Και το `focusField` περίμενε `setTimeout 0`: το Radix κρατά όλα τα panels προσαρτημένα και κρύβει τα ανενεργά με CSS, άρα το `querySelector` **έβρισκε** το πεδίο αλλά `focus()`/`scrollIntoView()` σε κρυμμένο στοιχείο δεν κάνουν τίποτα — περιμένει πλέον σε rAF μέχρι `offsetParent !== null`. **Επαληθευμένο στην οθόνη:** save από κυλισμένη καρτέλα → κορυφή με «Διευθύνσεις (8)» και τις 8 ορατές· save με άκυρο «Όνομα» από την καρτέλα Διευθύνσεων → **αυτόματη** μετάβαση στα «Βασικά Στοιχεία» + εστίαση + inline σφάλμα. **Καταγράφεται ανοιχτό:** σε δύο πρώιμες εκτελέσεις χάθηκε ολόκληρη η **επιλογή** επαφής μετά το save· με ανιχνευτή στο `setSelectedContact` **δεν αναπαράχθηκε σε 6 επόμενες** ⇒ **καμία αιτία δεν αποδίδεται**. Ο toaster είναι `position: fixed` (μετρημένο) — η υπόθεση «toast εκτός οθόνης» δεν ισχύει· εκτός οθόνης έβγαινε η επικεφαλίδα. **Χρέος:** το χειρόγραφο `VALIDATION_FIELD_TAB` μπορεί να παραχθεί από τα section registries· σήμερα καλύπτει όλα τα παραγόμενα κλειδιά (καμία επικύρωση διεύθυνσης δεν υπάρχει), γίνεται υποχρεωτικό μόλις προστεθεί. **10 νέα tests, mutation-verified** (επαναφορά της διόρθωσης → 2 κόκκινα)· **161/161** σε 20 suites· `jscpd:diff` καθαρό σε 10 αρχεία. ΟΧΙ tsc (N.17). |
| 2026-07-27 | 🔴 **Η D18 δεν έφτανε ποτέ στη βάση: `setDoc` έσκαγε σε κάθε νέα επαφή με διεύθυνση.** Πρώτη ζωντανή επαλήθευση της D18 στον browser (τα 280 tests της ήταν πράσινα, ζωντανή εκτέλεση **μηδέν**). Η δημιουργία φυσικού προσώπου απέτυχε αμέσως με «*Function setDoc() called with invalid data — Unsupported field value: undefined*». Διάγνωση με προσωρινό ανιχνευτή μονοπατιών πριν το `setDoc`: `customFields.companyAddresses[0].customLabel` και `…[0].country`. **Αιτία:** ο `sanitizeContactData` ελέγχει τους πίνακες **μόνο για μήκος** και δεν κατεβαίνει ποτέ στα στοιχεία τους· η φόρμα διευθύνσεων γράφει πάντα τα κλειδιά `customLabel`/`country` (με τιμή μόνο όταν ο τύπος είναι `other` / υπάρχει χώρα), και το Firestore απορρίπτει `undefined` σε **οποιοδήποτε** βάθος. Λανθάνον μέχρι τη D18: πριν, το `customFields` δεν παραγόταν καθόλου για `individual`/`service`. **Δεν είναι regression της D18 — είναι κενό του write chokepoint που η D18 εξέθεσε.** **Διόρθωση σε ΕΝΑ σημείο** (`sanitizeContactData` + `sanitizeContactForUpdate`) με τον **υπάρχοντα** SSoT `stripUndefinedDeep` (`utils/firestore-sanitize`, ως τότε αχρησιμοποίητο export) — όχι σε κάθε σημείο που φτιάχνει διεύθυνση: το `undefined` στο form state σημαίνει σκόπιμα «καθάρισε», και η μετάφρασή του σε «παράλειψη κλειδιού» ανήκει στο persistence layer· τα sentinels (`serverTimestamp()`) προστίθενται **μετά**, άρα δεν τα αγγίζει η αναδρομή. **Επαληθευμένο στη βάση**, όχι στην οθόνη: φυσικό πρόσωπο → `customFields.companyAddresses` **2** (`home`+`office`) & `addresses` **2**· υπηρεσία → **2** (`central_service`+`annex`) & **2**· κανένα top-level `companyAddresses`· round-trip μετά από hard reload με τους τύπους ορατούς. **Μη-παλινδρόμηση ALFA:** save χωρίς αλλαγή → `companyAddresses` **2** και **`activityType` = `"main"` επιβίωσε** ⇒ η υποψία ότι το `updateDoc` αντικαθιστά ολόκληρο το `customFields` **ΔΕΝ ισχύει** (ο `updateExistingContact` κάνει deep-merge πριν το `Object.assign`). **3 νέα tests, mutation-verified:** με επαναφορά της διόρθωσης πέφτουν **2**, δείχνοντας ακριβώς `customLabel`/`country: undefined`. ⚠️ Χρησιμοποιούν **`toStrictEqual`** — το `toEqual` αγνοεί κλειδιά με τιμή `undefined` και θα ήταν πράσινο **και με το bug ζωντανό**. 18/18 · `jscpd:diff` καθαρό. ΟΧΙ tsc (N.17). |
| 2026-07-26 | 🔴 **Απώλεια δεδομένων: η λίστα διευθύνσεων κρατιόταν ΜΟΝΟ σε εταιρείες** (D18). Το UI δέχεται επιπλέον διευθύνσεις και στους **τρεις** τύπους επαφής (ίδιο component, κουμπί «Νέα διεύθυνση» χωρίς έλεγχο τύπου), αλλά **πέντε** σημεία τις πετούσαν σιωπηλά για `individual`/`service`: το μπλοκ αποθήκευσης ήταν μέσα σε `if (type === 'company')`· το `addresses[]` έβγαινε μόνο από τα flat πεδία (**μία** εγγραφή)· το `stripTypeExclusiveFields` έσβηνε και το top-level αντίγραφο· ο create path δεν έγραφε `customFields`· ο read path διάβαζε μόνο `addresses[0]`. **Ότι ήταν ελάττωμα και όχι σχεδίαση** το λέει το ADR-319 (`home`/`office`/`vacation` για φυσικά πρόσωπα, `regional_service`/`annex`/`department` για υπηρεσίες) και ο ίδιος ο τύπος `CompanyAddress` («*so individuals can pick home/vacation/office*»). **Κανένα gate δεν μπορούσε να το πιάσει** — δεν είναι διπλότυπο, είναι **απουσία** κλάδου· μόνο round-trip test, που δεν υπήρχε. Νέο SSoT ανάγνωσης `contact-addresses-reader.ts` (το `resolveCompanyAddresses` ήταν ιδιωτικό στον `companyMapper`) — **διορθώθηκε μαζί** το fallback που έγραφε σταθερά `headquarters`/`branch`, τιμές **εκτός** του επιτρεπτού συνόλου φυσικού προσώπου/υπηρεσίας. **Το όνομα `companyAddresses` ΔΕΝ άλλαξε** (μετονομασία = μετάπτωση εγγράφων εταιρειών· δεν δένεται με διόρθωση απώλειας δεδομένων) — χρέος στο D18. **Τρία clones διορθώθηκαν επιτόπου** (N.0.2/N.18): 18 γραμμές flat-πεδίων σε individual/serviceMapper — όπου ο δεύτερος είχε **ήδη ξεχάσει** το `neighborhood`, δηλαδή η συνοικία υπηρεσίας αποθηκευόταν αλλά δεν ξαναδιαβαζόταν· το προοίμιο των create mappers **×3**· οι λίστες ταυτότητας του `contact-type-fields` **×2** (τα σύνολα επαληθεύτηκαν προγραμματιστικά ταυτόσημα με του HEAD). **Εντοπίστηκε νεκρό `individualAddresses`** — κανένας writer, κανένα UI· ημιτελές υπόλειμμα του ADR-318 που εξηγεί την προέλευση του κενού. **22 νέα tests, mutation-verified ×2** (επαναφορά του `if company` → 6 κόκκινα, ακριβώς individual+service)· **140/140**· `jscpd:diff` 12 αρχεία **3→0**. ΟΧΙ tsc (N.17). |
| 2026-07-26 | 🔵 **ΕΝΑΣ κατασκευαστής `addresses[]` + κανονικός Τ.Κ.** (D15/D16/D17). **(1)** Η μετατροπή `CompanyAddress → AddressInfo` υπήρχε **τρεις** φορές, όχι δύο· το χειρότερο αντίγραφο (`mappers/company.ts`, χωρίς ιεραρχία **και** χωρίς `neighborhood`) **κέρδιζε** στη ζωντανή διαδρομή create/guarded-update, ενώ το δεύτερο έγραφε **πάνω** από το πλήρες. Ένα `address-info-builder` με πίνακα `HIERARCHY_PROJECTION`· η τοπική `buildAddresses` **διαγράφηκε** (μηδέν νέος κώδικας — το `enterpriseData.addresses` ήταν ήδη σωστό, όπως στα αδέλφια `individual.ts`/`service.ts`). Το `type:'work'` **δεν** ήταν bug (άλλο λεξιλόγιο· φορέας σημασιολογίας το `label`) αλλά έγινε παράγωγο μέσω `toAddressInfoType()`· το σταθερό `country:'GR'` σέβεται πλέον το `ca.country`. **Μετρημένο Firestore, ίδιο υποκατάστημα ALFA:** πριν 9 πεδία· μετά **+10 πεδία ιεραρχίας + `neighborhood:"Κέντρο"`**, με το `companyAddresses` αμετάβλητο. **(2)** Ο Τ.Κ. αποθηκεύεται **κανονικός** («54624») και μορφοποιείται **μόνο στο render** («546 24»)· η μάσκα εισαγωγής είναι εμφάνιση. Το «546 24» δεν ήταν αλλοίωση αλλά **ασυνέπεια** που έσπαγε ήδη ζωντανά: το `administrative-hierarchy.json` έχει **949 Τ.Κ. / 0 με κενό** ⇒ αναζήτηση οικισμού δεν επέστρεφε ποτέ τίποτα· δύο επικυρωτές απέρριπταν αποθηκευμένες τιμές· το badge «ταιριάζει» ήταν πάντα mismatch. Γεννιόταν σε **τρία** σημεία (input handler, `applyResolvedPath`, πάροχος) — κανονικοποίηση και στα τρία. **Δύο δικλείδες:** ξένοι Τ.Κ. (`SW1A 1AA`, σουηδικό «111 51») μένουν **ανέπαφοι** (μόνο σχήμα `\d{3} \d{2}` + πύλη χώρας — το παλιό `replace(/\D/g,'')` τους ακρωτηρίαζε σιωπηλά)· και `postalCodeAppearsIn` ώστε η κανονικοποίηση να **μη** ρίξει το `postalMatch` του confidence (το `display_name` γράφει με κενό) — αντίστροφα το `buildFieldMatches` **διορθώθηκε**. Μετάπτωση `migrate-postal-codes` μέσω του **`createMigrationRoute` factory** (όχι αντιγραφή wrappers — N.18), πίνακας 4 διαδρομών σε contacts/projects/buildings· **μετρημένο ζωντανά:** dry-run 4 σαρωμένα → 1 επηρεαζόμενο → execute → `"54622"` → **δεύτερο dry-run 0**. **Boy Scout (N.0.2):** το «Οδός, Αριθμός, Πόλη, Τ.Κ.» ήταν γραμμένο **4 φορές** χωρίς καμία να μορφοποιεί Τ.Κ. ⇒ ένα `formatContactAddressLine`· και το «είναι ελληνική;» υπήρχε ως πλήρης χάρτης στον engine **και** ως inline αλυσίδα `\|\|` στο UI ⇒ `@/utils/address/country-codes` (ο engine το εισάγει πλέον από εκεί). **(3) D17 — μόνιμα κόκκινο test στο main διορθώθηκε:** το `address-helpers.test.ts` περίμενε `'Ελλάδα'` ενώ **κανένα** πραγματικό `.env` δεν ορίζει `NEXT_PUBLIC_DEFAULT_COUNTRY` (μόνο το `.env.example`) ⇒ παντού ίσχυε το fallback `'Greece'`. Το assertion ελέγχει πλέον τη **συμπεριφορά** (`DEFAULT_COUNTRY` + `not.toBe('GR')`)· η επιλογή λεξιλογίου χώρας (`GR`/`Greece`/`gr`) **καταγράφεται ρητά ως ανοιχτή απόφαση προϊόντος**, δεν κρίνεται από assertion. 3 νέα modules στο `.ssot-registry.json` (tier 3). Tests **437/437** σε 34 suites· `jscpd:diff` καθαρό σε 12 αρχεία (N.18). Καμία νέα user-facing συμβολοσειρά (N.11). NO push (N.(-1)). |
| 2026-07-26 | 🔴 **Ο geocoder δεν ήταν νεκρός — έλεγε ψέματα και ρωτούσε λάθος.** Το handoff διέγνωσε «νεκρό geocoder / λείπουν env vars». **Και τα δύο λάθος**, επαληθευμένα ζωντανά: το Nominatim απαντά (HTTP 200, 0,55s), το `/api/geocoding` απαντά, και τα env vars έχουν λειτουργικά defaults. Η οδός «Ονειροπόλων» της δοκιμής **δεν υπάρχει στο OSM** (`[]` σε freeform **και** structured) — και το UI ονόμαζε αυτή την ειλικρινή απάντηση «**Σφάλμα αναζήτησης**». Διορθώσεις: **D11** νέα φάση `not-found` + event `GEOCODE_EMPTY` + `GeocodingOutcome` discriminated union· το `geocodeAddress()` μένει wrapper ώστε να μην αγγιχτούν οι δύο άλλοι καταναλωτές· cache **μόνο** για επιτυχίες· ο νεκρός `classifyError`/`catch` αφαιρέθηκε (το service δεν κάνει ποτέ throw). **D12** ενιαία έξοδος `finishWith()` για τις 8 παραλλαγές (−8 διπλότυπες εκφράσεις) → `enforceCountryIntegrity()`: εκτός δηλωμένης χώρας ⇒ `outOfDeclaredCountry` + `confidence: 0`· και **βαθύτερη αιτία** — το `countryNameToCode()` αστοχούσε σε «ΕΛΛΑΔΑ» και σε **NFD** (macOS/iOS clipboard), ρίχνοντας το `countrycodes` από κάθε παραλλαγή· νέο `COUNTRY_CODE_INDEX` μέσω του **υπάρχοντος** `normalizeGreekText`. **D13** το `postalcode` βγαίνει από τα structured params (μετρημένο: μόνο αφαιρεί)· μένει στα free-form. **D14** ο **αριθμός** φτάνει επιτέλους στον πάροχο μέσω ενός `composeStreet(params, order)` (δύο σειρές, ένας ιδιοκτήτης) + κόμματα στα free-form. **Μετρημένα, πριν/μετά, ίδιο ερώτημα:** «Ονειροπόλων 42, 54624, Ελλάδα» → πριν **Wisconsin, ΗΠΑ @ 0,55**· μετά **404 → «Δεν βρέθηκε»**. «Τσιμισκή 43, Θεσσαλονίκη, 54623, Ελλάδα» → πριν αποτυχία/Μιλάνο· μετά «**Γενικό Προξενείο των ΗΠΑ, 43, Ιωάννη Τσιμισκή, Λαδάδικα, Θεσσαλονίκη**» @ **0,85**. i18n `coordinator.phase.not-found` σε el **και** en (N.11). Tests: 24 νέα (8 query-shape/country + 16 service outcome) — σουίτα διευθύνσεων **183/183 πράσινη**· `jscpd:diff` καθαρό σε 8 αρχεία (N.18). **Ανοιχτό χρέος που καταγράφεται ρητά, με μετρημένους αριθμούς:** (α) `NOMINATIM_RESULT_LIMIT` = **`'1'`** ⇒ το `alternatives` είναι **πάντα άδειο** και το πάνελ προτάσεων δεν μπορεί να προσφέρει τίποτα πέρα από το ήδη ορατό αποτέλεσμα· (β) **ολόκληρο το Phase 9 είναι νεκρός κώδικας** — `autoFillFromPostalCode`, `validateGreekHierarchy`, `loadHierarchyLookup` δεν καλούνται από πουθενά στην παραγωγή (μόνο από τα δικά τους πράσινα tests), και το `administrative-hierarchy.json` έχει 20.721 οντότητες αλλά **μόνο 949 με Τ.Κ. / 78 μοναδικούς** στους ~1.300 — το `54624` **δεν υπάρχει**, ενώ το `isValidGreekPostalCode` (`/^[1-9]\d{4}$/`) **απορρίπτει** τη μορφή «546 24»· (γ) το **δημόσιο** Nominatim έχει όριο 1 req/s και **απαγορεύει** χρήση παραγωγής — απαιτείται μετακόμιση πριν το production. **Μετρήσεις που καθόδησαν την απόφαση παρόχου:** το δημόσιο **Photon** επιστρέφει **μηδέν** αποτελέσματα για κάθε ελληνικό ερώτημα που δοκιμάστηκε (με/χωρίς τόνους, με γεωγραφική προκατάληψη) ⇒ απορρίφθηκε· το **OSM ως δεδομένα επαρκεί** (~9.700 αντικείμενα με `addr:housenumber` στο κέντρο Θεσσαλονίκης) ⇒ **η στενωπός ήταν η δική μας κατασκευή ερωτημάτων, όχι ο πάροχος**. |
| 2026-07-25 | 🐞 **Τρία bugs συνοχής στην ενσωμάτωση του editor με την καρτέλα Επαφής** (live end-to-end έλεγχος, όχι στατική ανάλυση). **(1) «Διόρθωση» που δεν διόρθωνε.** Το `handleApplyField` του coordinator έκανε σωστά `setUserInput` + `onChange`, αλλά ο καταναλωτής `AddressesSectionWithFullscreen.handleHqChange` έγραφε **μόνο** `formData.city`, ενώ το ορατό combobox «Οικισμός / Πόλη» διαβάζει `settlement \|\| city`. Το apply κατέληγε σε **σκιώδες πεδίο**: η οθόνη έμενε με την παλιά τιμή ενώ το badge γινόταν πράσινο (τεχνικά ειλικρινές — συνέκρινε το `userInput.city` που όντως άλλαξε — αλλά για τον χρήστη ψευδές). Επιπλέον το `formDataToResolvedFields` χρησιμοποιούσε **αντίστροφη** προτεραιότητα (`city \|\| settlement`) από αυτήν που αποδίδει το UI, άρα ο πίνακας «Συμφωνία Πεδίων» συνέκρινε άλλη τιμή από την εμφανιζόμενη. **Διόρθωση:** μία προτεραιότητα παντού (`settlement \|\| city`) και το `handleHqChange` γράφει `city` **και** `settlement` συνεκτικά· όταν το όνομα αλλάζει από πηγή εκτός ιεραρχίας, το `settlementId` μηδενίζεται ώστε ταυτότητα και ετικέτα να μην αποκλίνουν. **Σημείωση:** το `pending` του `useAddressReconciliation` ήταν ήδη data-driven (το `conflicts` είναι memoized στο `inputsKey` που περιλαμβάνει το `userInput`, και το `decisions` μηδενίζεται σε κάθε αλλαγή) — **δεν** χρειάστηκε αλλαγή εκεί· η ροή «Άφησέ το» έμεινε άθικτη. **(2) Σιωπηλή απώλεια «Περιοχή / Συνοικία».** Το πεδίο `neighborhood` υπήρχε στο UI του editor και στο `ResolvedAddressFields`, αλλά **όχι** στο persisted `AddressInfo` ούτε στο `ContactFormData` — και πετιόταν σε τέσσερα σημεία, με χαρακτηριστικότερο το `handleHqDragApplied` που το έθετε **hardcoded σε `''`** τη στιγμή που το reverse-geocoding το είχε γεμίσει σωστά. Πλήρης καλωδίωση round-trip (τύποι → form → persist → read-back) **και για τις εταιρικές διευθύνσεις/υποκαταστήματα**, όπου υπήρχε το ίδιο σφάλμα στα `branchToResolvedFields`/`applyResolvedToBranch`. **(3) City picker που έγραφε άλλη τιμή από την επιλεγμένη.** Ο χρήστης επέλεγε «Θεσσαλονίκη» και αποθηκευόταν «Θεσαλονίκης» (ένα σίγμα, γενική). Ο handler επιλογής ήταν **σωστός** — έγραφε το όνομα από το τοπικό `administrative-hierarchy.json`. Έφταιγε το debounced auto-fill effect του `AddressWithHierarchy`: το `clearTimeout` δεν ακυρώνει fetch που έχει ήδη φύγει, οπότε το καθυστερημένο promise διάβαζε το **closure πριν την επιλογή** — περνούσε τον έλεγχο «δεν υπάρχει οικισμός» και με stale spread πετούσε το μόλις τεθέν `settlementId` και όλη την ιεραρχία, γράφοντας τη Nominatim τιμή (το τυπογραφικό είναι στην **πηγή** OSM, δεν διορθώνεται από εμάς). **Διόρθωση:** epoch guard + ανάγνωση ζωντανής κατάστασης μέσω ref τη στιγμή της άφιξης + ακύρωση κάθε auto-fill σε πτήση μόλις ο χρήστης επιλέξει — η πειθαρχία `buildSelected` του ADR-601: **δεσμεύεται ό,τι είδε ο χρήστης**, οι εξωτερικές πηγές δίνουν μόνο metadata. **Boy Scout (N.18):** εξήχθησαν τα `applyResolvedPath`/`clearHierarchyLevels` στο `AddressWithHierarchy` (ο κανόνας «id και όνομα γράφονται/καθαρίζονται ΜΑΖΙ» ζει πλέον σε ένα σημείο) και το `DRAG_RESOLVED_HIERARCHY_RESET`· `jscpd:diff` καθαρό σε 26 αρχεία. **Γνωστό κενό:** το `AddressWithHierarchy` παραμένει bespoke combobox εκτός του picker SSoT (`src/components/shared/pickers/`, ADR-601) — η μετανάστευση είναι ξεχωριστή εργασία. **Επίσης καταγράφεται:** τα ADR-318/ADR-319 αναφέρονται ονομαστικά σε πολλά σημεία κώδικα ως SSoT της ταξινομίας διευθύνσεων, αλλά **τα αρχεία δεν υπάρχουν** και λείπουν από το `adr-index.md` — φαντάσματα. |
| 2026-05-06 | ✅ **Phase 10 COMPLETED — Hardening + A11y + Keyboard + Final Lock**. ADR status: `📋 PROPOSED → ✅ IMPLEMENTED`. **Telemetry wiring**: `useAddressTelemetry` fully wired into `AddressEditor` coordinator — `markInputStart()` on first field edit, `markUndoOccurred()` in undo handler, `flush()` on all 3 terminal actions (drag confirm → `'used-drag'`, suggestion select → `'accepted-suggestion'` with rank, reconciliation merge → `'mixed-correction'` / `'kept-user'` based on per-field decisions). Pure helpers extracted to `helpers/coordinatorHelpers.ts` (`extractResult`, `buildFieldActionsMap`, `resolveReconciliationAction`) to keep `AddressEditor.tsx` at exactly 500 lines (N.7.1 ✅). **Keyboard**: `Ctrl+Shift+R` force re-geocode added to `useEditorKeyboard` (calls `editor.triggerGeocode()`). **A11y**: `AddressDragConfirmDialog` confirm button receives `autoFocus` — focus goes to primary action when dialog opens; Radix Dialog restores focus on close (belt-and-suspenders). `AddressSuggestionsPanel` dismiss button `aria-label` fixed from hardcoded `"dismiss"` to `t('editor.suggestions.dismiss')` (N.11 ✅). **Esc to close suggestions**: `onDismiss` wired in coordinator via `dismissedSuggestions` state; resets on new field edit. **i18n**: `"dismiss"` key added under `editor.suggestions` in el + en locale JSONs (N.11). **ContactListCard mini-badges (Phase 8 deferred)**: `AddressInfo` extended with `source?: AddressSourceType` + `verifiedAt?: number` (additive, retro-compat); `ContactListCard` renders `AddressSourceLabel` + `AddressFreshnessIndicator` as `ListCard` children when primary address has enrichment data. NEW file: `helpers/coordinatorHelpers.ts`. MODIFY: `AddressEditor.tsx` (500 lines), `AddressDragConfirmDialog.tsx`, `AddressSuggestionsPanel.tsx`, `contracts.ts` (AddressInfo), `ContactListCard.tsx`, `el/addresses.json`, `en/addresses.json`. ALL files ≤500 lines (N.7.1 ✅). NO push (CLAUDE.md N.(-1)). |
| 2026-05-06 | ✅ **Phase 9 COMPLETED** — Telemetry + Hierarchy Validation (ADR-332 §3.7 + §3.9). NEW server-only collection `address_corrections_log/` with enterprise id `acl_<ulid>` (N.6 compliant — `ADDRESS_CORRECTION_LOG: 'acl'` + `generateAddressCorrectionLogId()`); registered in `src/config/firestore-collections.ts` as `ADDRESS_CORRECTIONS_LOG`. NEW telemetry service `src/services/geocoding/address-corrections-telemetry.service.ts` (server-only via `import 'server-only'`, `recordCorrection()` writes via Admin SDK with `companyId`/`userId` injected from auth ctx — never client payload, `validateRecordCorrectionInput()` validates context type / action / fieldActions / confidence range / duration; `listRecentCorrections()` queries with mandatory `where('companyId','==',ctx.companyId)` per CHECK 3.10). NEW API route `src/app/api/geocoding/telemetry/route.ts` (`withAuth` + `withStandardRateLimit`, 10s maxDuration, fire-and-forget compatible). NEW client hook `src/components/shared/addresses/editor/hooks/useAddressTelemetry.ts` (timer via `markInputStart()`, `markUndoOccurred()` flag, `flush(action, payload)` posts to telemetry endpoint with silent error swallowing — telemetry never blocks UX, injectable `fetchImpl`/`nowMs` for tests). NEW pure helpers: `helpers/hierarchyLookup.ts` (DI interface `HierarchyLookup` + `buildHierarchyLookup(entities)` for fixtures + `loadHierarchyLookup()` lazy-loader cached for module lifetime), `helpers/postalCodeAutoFill.ts` (Greek 5-digit validator `isValidGreekPostalCode`, `autoFillFromPostalCode()` returns common-ancestor chain when settlement homonyms share a postal code), `helpers/validateGreekHierarchy.ts` (3-rule validator: format / unknown postal / region mismatch — emits `HierarchyMismatch` with i18n keys under `addresses.hierarchy.*`, NFD-normalised Greek matching). MODIFY `firestore.rules` — new `match /address_corrections_log/{aclId}` block (server-only writes, tenant-scoped reads via `belongsToCompany`). MODIFY `firestore.indexes.json` — 2 composite indexes added: `(companyId ASC, timestamp DESC)` + `(companyId ASC, contextEntityType ASC, timestamp DESC)`. MODIFY `tests/firestore-rules/_registry/coverage-manifest.ts` — `address_corrections_log` registered with `adminWriteOnlyMatrix()` and rulesRange `[2339, 2347]` (CHECK 3.16 compliant). NEW Firestore rules suite `tests/firestore-rules/suites/address-corrections-log.rules.test.ts` with inline seeder (keeps `seed-helpers.ts` at exactly 500 lines per N.7.1). NEW unit tests: `__tests__/postalCodeAutoFill.test.ts` (3 dataset → unique / shared / unknown), `__tests__/validateGreekHierarchy.test.ts` (10 cases: malformed / 4-digit / unknown / matching / case+accent insensitive / mismatch on city + county + i18n key contract), `services/geocoding/__tests__/address-corrections-telemetry.service.test.ts` (12 cases: payload validation rejection paths + Admin SDK write contract + Firestore unavailable fallback + boom-error capture). ALL files ≤500 lines (N.7.1 ✅). All N.7.2 invariants explicit: proactive (timer starts at first edit, not coordinator mount), idempotent (server-side `acl_<ulid>` per call), tenant-isolated at 3 layers (rules + service + enterprise id), fire-and-forget at API surface so telemetry never blocks UX. ✅ Google-level: YES — server-only writes, tenant isolation via `companyId` claim, rules-tests presubmit-grade, no hardcoded i18n. NO push (CLAUDE.md N.(-1)). |
| 2026-05-06 | ✅ **Phase 8 COMPLETED** — Migration Wave 3: read-only enrichment + procurement provenance. **Type SSoT shift**: `AddressSourceType` moved from `editor/types.ts` to `@/lib/geocoding/geocoding-types.ts` (now consumed by both `ProjectAddress` and the editor coordinator); `editor/types.ts` re-exports it. `ProjectAddress` extended with `source?: AddressSourceType`, `verifiedAt?: number`, `geocodingMetadata?: { confidence; accuracy; variantUsed; osmType? }` — all optional, retro-compatible (legacy records render as `source='unknown'` + `level='never'`). NEW pure helper `editor/helpers/computeFreshness.ts` (verifiedAt → `AddressFreshness` with 24h/7d/30d Salesforce-style tiers, injectable `nowMs` for determinism). NEW SSoT chip `editor/components/AddressCoordsBadge.tsx` (replaces 3 duplicated local sub-components on first draft of AddressCard/SharedAddressActionCard/PODeliveryAddressField). Barrel `editor/index.ts` adds `AddressFreshnessIndicator`, `AddressCoordsBadge`, `computeFreshness`, and the `AddressSourceType`/`AddressFreshness`/`AddressFreshnessLevel` types. `AddressCard`: enrichment row (source + freshness + coords badges) under the existing block-side row, opt-out via `hideEnrichment` prop; legacy users (e.g. `AddressListCard`, `BuildingAddressesManualList`) get the badges automatically since they consume `AddressCard`. `SharedAddressActionCard`: optional `source`/`verifiedAt`/`hasCoordinates` props render the same badge row when supplied, omitted by default for backward compat. **N.11 Boy Scout fix**: 5 hardcoded Greek default-prop labels (`Επεξεργασία`/`Διαγραφή`/`Εκκαθάριση`/`Ορισμός ως κύρια`/`Κύρια`) replaced with i18n keys under new `actionCard.*` namespace (el + en); callers may still override via props. `PODeliveryAddressField`: tracks the picked `ProjectAddress` in local state so when an operator selects a project address by type the source/freshness/coords badges render below the input; typing in the free-text input clears the picked-address tracking. NEW i18n keys under `addresses.card.coords.*`, `addresses.actionCard.*`, `addresses.procurement.selectedFromAddress` (el + en, no defaultValue per N.11). NEW unit test `computeFreshness.test.ts` (12 tests, full boundary coverage incl. spy on `Date.now()` fallback). **Discrepancies** (code = source of truth, ADR §4 outdated): (1) `AddressMapPicker.tsx` is **NOT** an edit form — it's a "open in Google Maps/Waze/Bing/etc." dropdown that takes a single `address: string` and never mutates it; no `AddressEditor` wrapper applies. (2) `AddressListCard.tsx` and `BuildingAddressesManualList.tsx` need **no** edits — both already render `<AddressCard>` so the enrichment propagates automatically. (3) `ContactsList.tsx` "inline mini badges" require touching `ContactListCard` (domain layer outside Phase 8 surface scope) — deferred to Phase 10 hardening. ALL files ≤500 lines (N.7.1 ✅). NO push (CLAUDE.md N.(-1)). |
| 2026-05-06 | ✅ **Phase 7 COMPLETED** — Migration Wave 2: Projects + Buildings. `editor/index.ts`: added `AddressDragConfirmDialog` export. `AddressFormSection`: complete rewrite — now controlled (`value: Partial<AddressWithHierarchyValue>`, `onChange`) using `AddressWithHierarchy` (context-aware → field badges active when inside `AddressEditor`); optional project fields (type/blockSide/label/isPrimary) rendered when `onTypeChange` provided; ~110 LOC (was 395). `LocationInlineForm`: `forwardRef<AddressEditorHandle>` — exposes `setPendingDrag` to `ProjectLocationsTab`; `AddressEditor` wraps `AddressWithHierarchy` with `formOptions.hideGrid=true` + `activityLog.collapsed=true`; `handleDragApplied` clears ELSTAT ids/names on drag confirm; `ProjectAddressFields` + save/cancel outside coordinator. `ProjectLocationsTab`: `addEditorRef` + `editEditorRef` refs; `handleCombinedDragUpdate` routes pending-pin drag → `setPendingDrag` on add-form ref, real-pin + edit-form → edit-form ref, real-pin + view mode → local `pendingViewDrag` state + inline `AddressDragConfirmDialog` (no silent overwrite in any mode). `BuildingAddressesEditor`: complete rewrite from 88 → ~260 LOC — local state (hierarchy/type/blockSide/label/isPrimary), 4 local converters, `editorRef`, `resolvedValue` useMemo, per-field callbacks, `AddressEditor` wraps `AddressFormSection` with `formOptions.hideGrid=true`; drag routed via `editorRef.current.setPendingDrag()`; deprecated `externalValues`/`onExternalValuesChange` kept for `BuildingAddressesCard` backward compat. `FrontageAddressCreateDialog`: rewrite — `hierarchy` state replaces raw inputs; `AddressEditor` wraps `AddressWithHierarchy`; `fromHierarchyValue` derives city; new i18n key `frontages.cityRequired` (el + en). `demo/addresses/page.tsx`: updated to new `AddressFormSection` API (value/onChange). ALL files ≤500 lines (N.7.1 ✅). |
| 2026-05-06 | ✅ **Phase 6 COMPLETED** — Migration Wave 1: Contacts. `AddressEditor` extended: `forwardRef` + `AddressEditorHandle` (exposes `setPendingDrag`), `formOptions.hideGrid` (children replace internal grid), `onDragApplied` callback (called specifically on drag confirm, separate from `onChange`). Barrel `index.ts` now exports `AddressFieldBadge`, `AddressSourceLabel`, `AddressEditorHandle`. `AddressWithHierarchy` optionally reads `AddressEditorContext` and renders `AddressFieldBadge` next to street/number/postalCode/city when inside coordinator (500 lines exactly). `AddressesSectionWithFullscreen`: HQ inline edit wrapped in `<AddressEditor ref={hqEditorRef} formOptions={{hideGrid:true}}>` — activity log + reconciliation + suggestions + `AddressDragConfirmDialog` all active; HQ map drag routed to `hqEditorRef.current.setPendingDrag()` replacing ADR-277 `AlertDialog`; derived work addresses (ADR-318) show `<AddressSourceLabel source="derived"/>`. `CompanyAddressesSection`: branch inline edit wrapped via `BranchEditorWrapper` (stable `useMemo` for resolved fields, per-branch `AddressEditor`). ALL files ≤500 lines (N.7.1 ✅). |
| 2026-05-05 | ✅ **Phase 5 COMPLETED** — Coordinator AddressEditor (Layer 6). 4 NEW files: `AddressEditor.tsx` (431 LOC coordinator — wires all 6 Layer 4 hooks, renders form+panels, exposes context), `AddressEditorContext.tsx` (React context, `useAddressEditorContext` hook), `AddressEditor.types.ts` (public API `AddressEditorProps` + re-exports), `index.ts` (barrel). Features: semi-controlled form (parent resets via `key`), keyboard Ctrl+Z/Ctrl+Shift+Z undo/redo, reconciliation merge confirm, suggestion accept with undo entry, drag confirm dialog wired, activity log in edit mode only, view mode (all inputs disabled, no log). 20 i18n keys added (el + en): `editor.coordinator.phase.*` (10 phases) + `editor.undo.*` (5 op kinds) + `editor.coordinator.retryGeocode`. Demo `/demo/addresses-editor` upgraded: `<AddressEditorDemo>` live section (mode toggle + JSON debug panel) at top, existing Phase 3-4 sections retained below. 1 NEW integration test file (8 tests). `AddressMap` untouched — backward compat preserved. NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | ✅ **Phase 4 COMPLETED** — Presentational Components Set 2 (Layer 5 panels). 6 NEW files: `AddressActivityLog` (ring buffer display, verbosity toggle via `<select>`, clear + copy-JSON toolbar, auto-scroll, `role="log" aria-live="polite"`), `AddressReconciliationPanel` (per-field apply/keep rows + applyAll/keepAll footer, wires `useAddressReconciliation`, resolved badge), `AddressSuggestionsPanel` (`role="listbox/option"` a11y, keyboard nav ↑↓ Enter Esc via `itemRefs`, retry-without footer), `AddressDiffSummary` (compact before/after table with ArrowRight separator), `AddressDragConfirmDialog` (Radix Dialog, computes diff via `diffAddressFields`, CHECK 3.23 compliant — no `title=`), `helpers/fieldLabels.ts` (SSoT map `keyof ResolvedAddressFields` → i18n key). 1 MODIFY `AddressMapStatusChip` (+`hasConflicts`/`hasSuggestions` optional props). Demo page `/demo/addresses-editor` upgraded — all Phase 3+4 components live with interactive hooks (useAddressActivity, useAddressReconciliation). ~45 i18n keys per locale (el + en). NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | ✅ **Phase 3 COMPLETED** — Presentational Components Set 1 (Layer 5 compact indicators). 5 NEW components: `AddressFieldTooltip` (Radix wrapper, CHECK 3.23 compliant), `AddressFieldBadge` (5 kinds: match/mismatch/unknown/not-provided/pending, with Lucide icons + field-aware tooltip params), `AddressConfidenceMeter` (0..1 → colour-coded bar, role="meter" ARIA, animated fill), `AddressSourceLabel` (6 source types with distinct icons + variant chips), `AddressFreshnessIndicator` (5 freshness levels + staleReason tooltip routing). ~50 i18n keys added in `addresses.editor.*` namespace (el + en). Demo page `/demo/addresses-editor` covers all states. 7 jest tests for AddressFieldBadge. NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | ✅ **Phase 2 COMPLETED** — Suggestions + Reconciliation Logic (Layer 4 helpers/hooks). 7 NEW files. Helpers: `computeSuggestionTriggers.ts` (4 trigger algorithm + priority resolution + `nextOmitField` retry-priority sequencer + `OMIT_RETRY_PRIORITY` SSoT) and `rankSuggestions.ts` (top + alternatives merged, weighted score `confidenceWeight*confidence + (1-w)*proximity`, Haversine distance, `proximityCapM` default 5 km, `confidenceWeight` clamped to 0..1). Hooks: `useAddressSuggestions` (consumes both helpers, tracks omit-attempts state, auto-resets on fresh result), `useAddressReconciliation` (wraps `diffAddressFields`, per-field `apply`/`keep` decisions, auto-reset on input change, exposes `merged` + `pending` + `applyAll`/`keepAll`), `useAddressUndo` (sessionStorage stack at key `address-editor-undo-stack`, 60s TTL, max 20 per side, 5 op kinds, push clears redo, undo/redo return popped entry). All 5 hooks side-effect-free w.r.t. geocoding (orchestrator owns retry calls — N.7.2 explicit ownership). 38 new jest tests green (24 triggers + 14 ranking) → 73 total in editor suite. Commit: `6a26512c` + follow-up. NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | ✅ **Phase 1 COMPLETED** — state machine + core hooks (Layer 3+4). 9 files NEW + 1 MODIFY (`editor/types.ts` extended `FIELD_EDITED`/`CORRECTION_APPLIED` events with `nowMs` for full purity, added `AddressEditorErrorReason` helper type). State machine pure (no React, no `Date.now()` inside reducer): `addressEditorMachine.ts` exposes `reduce()` + `createAddressEditorMachine()` factory; `transitions.ts` holds the switch + `buildFreshness()` + helpers. Hooks: `useAddressEditor` (master, wires `geocodeAddress` + debounce + diff + activity), `useAddressFieldStatus` (per-field status map), `useAddressActivity` (verbosity-filtered ring buffer, max 200 events). Helper: `diffAddressFields` (case+accent-insensitive via `normalizeGreekText`). Demo page `/demo/addresses-editor-state` = state debugger. Tests: 35 green (27 machine + 8 diff). NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | ✅ **Phase 0 COMPLETED** — engine multi-result + foundation types. 5 files (3 NEW + 2 MODIFY). 11 jest tests green. Two commits in same session: (a) ADR file proposed, (b) Layer 1+2 implementation (engine returns top + up to 4 alternatives, resolvedFields normalized, attemptsLog with i18n keys for all 8 variants, per-field match matrix, partialMatch detection, source provenance). Backward compatibility: legacy `GeocodingApiResponse` core fields (lat/lng/accuracy/confidence/displayName/resolvedCity) preserved unchanged — additive enrichment only. NO push (CLAUDE.md N.(-1)). |
| 2026-05-05 | 📋 PROPOSED — bozza iniziale dopo session di clarificazione (3 round Q&A — coordinator A+optin → coordinator pieno; 1 form → 3 form; trigger 1 → trigger 4). Mandate Giorgio: "πιο προηγμένο σύστημα που μπορεί να υπάρχει… πλήρης πληροφόρηση κάθε στιγμή". 11 phases, 1 phase per session, handoff-driven. |

---

## 1. Context

L'editor di indirizzi è una superficie ad alta densità informativa che attraversa **7 domain** dell'applicazione (contacts, projects, buildings, building-code, procurement, property-showcase, geocoding service). Il flusso utente coinvolge:

1. **Form input** — l'utente scrive street/number/postal/city/region
2. **Geocoding service** — chiamata client → API route → Nominatim (3 livelli, 6-8 varianti retry)
3. **Map render** — pin sulla posizione restituita
4. **Reverse geocoding** — quando l'utente trascina il pin, restituisce nuovi campi
5. **Hierarchy picker** — ELSTAT 4-tier (settlement/community/municipal unit/municipality/regional unit/region)
6. **Persistence** — Firestore con `companyId` tenant isolation

### Stato attuale (2026-05-05)

L'implementazione esistente è **funzionale ma opaca**:

| Aspetto | Stato attuale | Problema |
|---------|---------------|----------|
| **Status feedback** | `AddressMapStatusChip` con 6 stati (idle/loading/partial/stale/error/success) | Non dice **perché** è partial, non dice **cosa** è in conflitto |
| **Field-level validation** | Inesistente | Utente non sa quale campo sta facendo fail il geocoding |
| **Suggestions** | Inesistenti — il service prende solo `data[0]` da Nominatim ignorando 4 candidati che ha già richiesto (`limit=5`) | Utente non vede alternative quando il match è ambiguo |
| **Reconciliation** | Inesistente — silent overwrite quando il drag restituisce dati diversi | Utente perde dati inseriti senza warning |
| **Activity log** | Inesistente | "Cosa sta facendo l'app adesso?" — l'utente non lo sa |
| **Source of pin** | Inesistente | "Questo pin è geocodato, trascinato manualmente, o derivato?" |
| **Freshness** | Esiste solo flag `stale` boolean | Non dice **quando** è stato verificato l'ultimo |
| **Confidence visibility** | Inesistente | `confidence` viene calcolato ma mai mostrato all'utente |
| **Conflict resolution** | Inesistente | Non c'è UI per "il sistema dice X, tu dici Y, scegli" |
| **Telemetry** | Solo logger.info/warn server-side | Nessuna learning loop dalle correzioni utente |
| **Undo/Redo** | Inesistente | Drag accidentale = perdita dati |
| **Hierarchy validation** | Inesistente | Postal code 99999 con città Θεσ/νίκη accettato senza warning |
| **A11y** | Limitata | Activity changes non annunciati a screen reader |

### Pattern industry dominante

| Vendor | Pattern Address Editor |
|--------|------------------------|
| **Google Maps Places + Address Form** | Web Component `<gmpx-place-picker>` — coordinator unico, autocomplete inline, partial_match flag, multiple results, confidence implicit |
| **HERE WeGo / HERE Studio** | Real-time validation per-field, alternative rankings con distance, source labels |
| **Mapbox Geocoding API + Address SDK** | Multi-result default, confidence score esposto, "did you mean" UI |
| **OpenCage Geocoder** | Componenti normalized esposti, confidence 1-10, fallback chain visibile |
| **Smarty (US/intl)** | Field-level match status, suggestions panel, "validate as you type" |

Il **pattern enterprise convergente**: **single coordinator component** che possiede form+map+activity+suggestions+reconciliation in un'unica sorgente di verità (SSoT), con **transparency totale** allo utente su tutto ciò che il sistema sta facendo o ha trovato.

### Convergenza con CLAUDE.md mandates

- **N.7 Google-level quality** — proactive feedback, zero silent overwrite, idempotenza, belt-and-suspenders
- **N.0/N.12 SSoT** — eliminare 3-form duplication, un punto canonico per geocoding/conflict logic
- **N.7.1 file size** — coordinator + presentational split, ognuno < 500 LOC, funzioni < 40 LOC
- **N.7.2 architecture checklist** — ownership esplicito, race-free, single source of truth
- **N.11 i18n SSoT** — tutte le nuove stringhe via `t()` con keys in locale JSONs
- **N.10 testing** — pure helpers + state machine + hooks coperti da test

---

## 2. Decision

Costruire un **Address Editor System v2.0** end-to-end enterprise con **transparency totale**, applicato a **TUTTI** i 28 punti dell'app dove gli indirizzi vengono editati, visualizzati o renderizzati su mappa.

Il sistema espone all'utente **in ogni momento**:

1. **Cosa sta facendo** (Activity Log live)
2. **Cosa ha trovato** (Suggestions panel)
3. **Quale campo è in conflitto** (Field-level badges)
4. **Quanto è sicuro** (Confidence meter)
5. **Da dove viene** (Source label)
6. **Quando è stato verificato** (Freshness indicator)
7. **Cosa cambierà** (Drag confirm dialog + Reconciliation panel)
8. **Come tornare indietro** (Undo/Redo)

---

## 3. Architecture

### 3.1 Layered structure

```
┌─────────────────────────────────────────────────────────┐
│  LAYER 7 — Migration sites (28 components rewired)      │
│  contacts/projects/buildings/showcase/procurement/...   │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 6 — <AddressEditor> coordinator                  │
│  Public API. Wraps Form + Map + Panels + Activity log   │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 5 — Presentational components (~14 nuovi)        │
│  FieldBadge, ConfidenceMeter, SuggestionsPanel,         │
│  ReconciliationPanel, ActivityLog, SourceLabel,         │
│  FreshnessIndicator, DiffSummary, DragConfirmDialog     │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 4 — Hooks                                        │
│  useAddressEditor (master)                              │
│  useAddressFieldStatus, useAddressSuggestions,          │
│  useAddressReconciliation, useAddressActivity,          │
│  useAddressTelemetry, useAddressUndo                    │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 3 — State machine                                │
│  Pure logic: idle/typing/debouncing/loading/partial/    │
│  success/conflict/stale/error states + transitions      │
│  Fully testable, no React deps                          │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 2 — Service (client)                             │
│  geocoding-service.ts: multi-result, alternatives,      │
│  cache TTL, telemetry hooks, in-flight dedup            │
└─────────────────────────────────────────────────────────┘
                          ↑
┌─────────────────────────────────────────────────────────┐
│  LAYER 1 — Engine (server)                              │
│  geocoding-engine.ts: returns ALL 5 candidates,         │
│  resolvedFields, partialMatch, reasoning                │
│  ELSTAT cross-check, hierarchy validation               │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Type contracts

#### `GeocodingApiResponse` (estesa)

```typescript
export interface GeocodingApiResponse {
  // Existing
  lat: number;
  lng: number;
  accuracy: 'exact' | 'interpolated' | 'approximate' | 'center';
  confidence: number;
  displayName: string;
  resolvedCity?: string;

  // NEW — Layer 1 enrichment
  resolvedFields: ResolvedAddressFields;
  partialMatch: boolean;
  reasoning: GeocodingReasoning;
  alternatives: GeocodingApiResponse[];  // top 4 (without their alternatives — flat)
  source: {
    provider: 'nominatim' | 'cache' | 'manual';
    osmType?: string;
    osmId?: string;
    importance?: number;
    variantUsed: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  };
}

export interface ResolvedAddressFields {
  street?: string;
  number?: string;
  postalCode?: string;
  neighborhood?: string;
  city?: string;
  county?: string;
  region?: string;
  country?: string;
}

export interface GeocodingReasoning {
  /** Match score per field — for badge logic */
  fieldMatches: {
    [K in keyof ResolvedAddressFields]: 'match' | 'mismatch' | 'unknown' | 'not-provided';
  };
  /** Variants attempted (for activity log) */
  attemptsLog: GeocodingAttempt[];
  /** Why this confidence score */
  confidenceBreakdown: {
    base: number;
    streetMatch: number;
    cityMatch: number;
    postalMatch: number;
    countyMatch: number;
    municipalityMatch: number;
  };
}

export interface GeocodingAttempt {
  variant: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  description: string;  // i18n key, not raw string
  status: 'success' | 'no-results' | 'error' | 'skipped';
  durationMs: number;
}
```

#### `AddressFieldStatus` (Layer 5)

```typescript
export type AddressFieldStatus =
  | { kind: 'match'; userValue: string; resolvedValue: string }
  | { kind: 'mismatch'; userValue: string; resolvedValue: string }
  | { kind: 'unknown'; userValue: string }       // Nominatim non riconosce
  | { kind: 'not-provided'; resolvedValue?: string }  // user vuoto, Nominatim potrebbe avere
  | { kind: 'pending' };                          // geocoding in flight
```

#### `GeocodingActivityEvent` (Layer 4)

```typescript
export interface GeocodingActivityEvent {
  id: string;             // ULID
  timestamp: number;      // unix ms
  level: 'info' | 'success' | 'warn' | 'error';
  category: 'input' | 'request' | 'response' | 'conflict' | 'suggestion' | 'apply' | 'drag' | 'undo';
  i18nKey: string;        // resolves via t()
  i18nParams?: Record<string, string | number>;
}
```

#### `AddressSourceType` & `AddressFreshness`

```typescript
export type AddressSourceType =
  | 'geocoded'    // automatic Nominatim
  | 'dragged'     // user drag pin
  | 'manual'      // user typed without geocoding
  | 'derived'     // ADR-318 from parent contact
  | 'imported'    // external import (future)
  | 'unknown';

export interface AddressFreshness {
  verifiedAt: number | null;  // unix ms; null = mai verificato
  level: 'never' | 'fresh' | 'recent' | 'aging' | 'stale';
  staleReason?: 'field-changed' | 'time-elapsed' | 'force-refresh-pending';
}
```

#### `AddressEditorState` (Layer 3)

```typescript
export type AddressEditorState =
  | { phase: 'idle' }
  | { phase: 'typing'; lastEditMs: number }
  | { phase: 'debouncing'; etaMs: number }
  | { phase: 'loading'; attempt: number; totalAttempts: number; variantDescription: string }
  | { phase: 'success'; result: GeocodingApiResponse; freshness: AddressFreshness }
  | { phase: 'partial'; resolved: number; total: number; conflicts: AddressFieldConflict[] }
  | { phase: 'conflict'; result: GeocodingApiResponse; conflicts: AddressFieldConflict[] }
  | { phase: 'suggestions'; candidates: GeocodingApiResponse[]; reason: SuggestionTrigger }
  | { phase: 'stale'; lastResult: GeocodingApiResponse; reason: 'field-changed' }
  | { phase: 'error'; reason: 'no-results' | 'timeout' | 'rate-limit' | 'network'; canRetry: boolean };

export type SuggestionTrigger =
  | 'no-results-after-retry'
  | 'low-confidence'
  | 'multiple-candidates-similar'
  | 'partial-match-flag';
```

### 3.3 Coordinator API

```typescript
<AddressEditor
  // Required
  value={address}
  onChange={(addr) => ...}

  // Mode
  mode="edit" | "view"
  domain="contact" | "project" | "building" | "procurement" | "showcase" | "frontage"

  // Form options (vary by domain)
  formOptions={{
    showHierarchy?: boolean;     // ELSTAT picker
    showAddressType?: boolean;
    showBlockSide?: boolean;
    showCustomLabel?: boolean;
  }}

  // Map options
  mapOptions={{
    height?: 'small' | 'medium' | 'large' | 'full';
    showLocateMe?: boolean;
    initialZoom?: number;
  }}

  // Activity log
  activityLog={{
    enabled?: boolean;          // default true in edit, false in view
    verbosity?: 'basic' | 'detailed' | 'debug';  // default 'detailed'
    collapsed?: boolean;        // default false in edit
  }}

  // Telemetry
  telemetry={{
    enabled?: boolean;          // default true
    contextEntityType?: string; // e.g. 'contact', 'project'
    contextEntityId?: string;
  }}

  // Multi-address layout (contacts/projects/buildings can have N addresses)
  addresses?: ProjectAddress[];  // alternative to single value
  onAddressesChange?: (addrs: ProjectAddress[]) => void;
  primaryAddressIndex?: number;  // ADR-319 invariant

  // Read-only enriched display
  readOnlyExtraAddresses?: ProjectAddress[];  // ADR-318 derived

  // Backward compat
  legacy?: {
    onAddressDragUpdate?: (addr, idx) => void;  // bridges to old code
  };
/>
```

### 3.4 Suggestion trigger algorithm

Pattern C (Suggestions Panel) si attiva quando **ALMENO UNO** dei seguenti:

1. **Hard fail** — 0 results dopo TUTTE le 6-8 varianti del Layer 1 → retry chiamando di nuovo Layer 1 con `omitField: 'postalCode'` (priorità: postalCode > number > neighborhood)
2. **Low confidence** — `confidence < 0.7`
3. **Ambiguous** — `alternatives.length >= 2` AND `top.confidence - alternatives[0].confidence < 0.15`
4. **Partial match** — `partialMatch === true`

In ALL cases except (1), **non si chiama Nominatim ulteriormente** — si usano i 5 candidati già richiesti con `limit=5`.

### 3.5 Reconciliation logic

Pattern B (Reconciliation Panel) si attiva quando:
- `partialMatch === true` con conflicts su uno o più campi specifici
- Drag end con `reverseGeocode` returns che differiscono da formData esistente

Output: lista `AddressFieldConflict[]` con buttons inline:
- `[Διόρθωση]` → applica resolved value
- `[Άφησέ το]` → mantieni user value (mark address as `manual` source)
- `[Διόρθωσέ τα όλα]` → applica tutti i resolved values
- `[Δοκίμασε άλλον συνδυασμό]` → trigger Pattern C suggestions

### 3.6 Activity Log specification

Default verbosity: **`detailed`** — l'utente vede 15-20 lines per geocoding cycle.

Mandatory events da registrare:
- `input` — field change detected con field name e old→new value
- `request` — debounce eta + Nominatim call kickoff con variant description
- `response` — top result + confidence + alternatives count
- `conflict` — per ogni field con mismatch
- `suggestion` — quando triggers algorithm fires
- `apply` — quando user accetta correction
- `drag` — drag start/move/end + reverse geocode
- `undo` — undo/redo events

Verbosity levels:
- `basic` — solo `success` + `error` events (5-6 lines)
- `detailed` — tutti tranne `info`-level low-importance (15-20 lines) — **DEFAULT**
- `debug` — tutto, incluso variant attempts dettagliati (50+ lines)

Toolbar: `[clear log]` `[copy as JSON]` `[verbosity ▼]` `[collapse/expand]`

A11y: `<div role="log" aria-live="polite" aria-relevant="additions">` per screen reader announcements automatici.

### 3.7 Telemetry schema

Nuova collection Firestore `address_corrections_log/`:

```typescript
{
  id: 'acl_<ulid>',
  companyId: string,                    // tenant isolation (mandatory N.11 + ADR-294)
  userId: string,
  contextEntityType: 'contact' | 'project' | 'building' | 'procurement' | 'showcase',
  contextEntityId: string,
  timestamp: Timestamp,

  // What user typed initially
  userInput: ResolvedAddressFields,

  // What Nominatim returned
  nominatimResolved: ResolvedAddressFields,
  confidence: number,
  variantUsed: number,
  partialMatch: boolean,

  // Action taken
  action: 'accepted-top' | 'accepted-suggestion' | 'kept-user' | 'mixed-correction' | 'used-drag',
  acceptedSuggestionRank?: number,    // 0=top, 1-4=alternatives

  // Per-field actions
  fieldActions: {
    [K in keyof ResolvedAddressFields]?: 'kept' | 'corrected-to-resolved' | 'corrected-to-suggestion';
  },

  // Metadata
  durationFromInputToActionMs: number,
  undoOccurred: boolean,
  finalAddress: ResolvedAddressFields,
}
```

Firestore rules: tenant-scoped read (own `companyId`), Admin-only delete, server-only write (via API route con `withAuth`).

Indexes: `(companyId, timestamp DESC)` + `(companyId, contextEntityType, timestamp DESC)`.

### 3.8 Undo/Redo

Stack scope: **per session** (sopravvive a navigation tra address editors). Persistito in `sessionStorage` come `address-editor-undo-stack`.

Timeout: **60 secondi** dopo l'ultima azione → flush dello stack (Google standard inline-undo è 30s, ma per address correction enterprise = 60s perché user può alternare focus tra mappa+form).

Ops trackable:
- field correction (single field)
- bulk correction (Reconciliation panel "Διόρθωσέ τα όλα")
- suggestion accept
- drag-resolved apply
- form clear (Ctrl+Backspace)

Keybinding: `Ctrl+Z` undo / `Ctrl+Shift+Z` redo.

### 3.9 Hierarchy validation (ELSTAT)

Greek-specific rules in `validateGreekHierarchy.ts`:

1. Postal code 5 digits, primo digit 1-9
2. Postal code prefix → expected city/region check (lookup table da ELSTAT)
3. Settlement → community → municipal unit → municipality → regional unit → region chain consistency
4. Mismatch → warning event in activity log + badge `unknown` su field

Lookup data: deriva da `src/data/elstat/` (esiste già — confermare in Phase 9).

### 3.10 Read-only mode enrichment

In `mode="view"`, il coordinator NON chiama Nominatim ma mostra comunque:

- **Source label** chip ("geocoded" / "manual" / "derived") — derivato da `address.source` (campo nuovo)
- **Freshness badge** ("verified 5 min ago" / "never verified") — derivato da `address.verifiedAt`
- **Has-coordinates** badge ("📍 has coords" / "❓ no coords")
- **Activity log** disabled (no live events)
- **No drag, no edit** — pure visualization con tooltips

Storage: `ProjectAddress` schema esteso con:

```typescript
interface ProjectAddress {
  // existing fields...
  source?: AddressSourceType;
  verifiedAt?: number;       // unix ms
  geocodingMetadata?: {
    confidence: number;
    accuracy: string;
    variantUsed: number;
    osmType?: string;
  };
}
```

Migration: campi opzionali, retro-compatibili. Esistenti addresses senza `source` fallback a `'unknown'`.

---

## 4. Phasing — 11 Phases, 1 Phase per Session

Ogni phase è progettata per:
- **Completarsi in una singola chat session** (~80-120k tokens budget)
- Avere **deliverable testabile** alla fine
- Avere **handoff template** preformattato per la sessione successiva
- Includere **commit + ADR Phase 3 update** entro la session
- **NESSUN push** senza ordine esplicito di Giorgio (CLAUDE.md N.(-1))

### Phase 0 — ADR + Foundation Types (corrente)
**Scope:** Questo file ADR + extension dei types core.
**Files:** ~5
**Deliverable:**
- ✅ `docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md`
- `src/lib/geocoding/geocoding-types.ts` (NEW) — tutti i types condivisi (Layer 1+2)
- `src/components/shared/addresses/editor/types.ts` (NEW) — Layer 3-5 types
- `src/app/api/geocoding/geocoding-engine.ts` (MODIFY) — multi-result return + resolvedFields + reasoning + variant tracking
- `src/lib/geocoding/geocoding-service.ts` (MODIFY) — types extension, no behavior change yet
- `src/lib/geocoding/__tests__/geocoding-engine-multiresult.test.ts` (NEW)

**Acceptance:**
- TypeScript compile clean
- Engine returns 5-result array (top + 4 alternatives) ma il client legacy (Layer 7 esistente) continua a funzionare leggendo solo `data[0]`/top
- Test multi-result green
- Commit `feat(addresses): ADR-332 Phase 0 — engine multi-result + types foundation`
- ADR §10 Implementation Tracking aggiornato

**Handoff:** Phase 1 — State Machine + Core Hooks

---

### Phase 1 — State Machine + Core Hooks
**Scope:** Pure logic + main hooks, no UI yet.
**Files:** ~8
**Deliverable:**
- `src/components/shared/addresses/editor/state/addressEditorMachine.ts` (NEW) — pure state machine
- `src/components/shared/addresses/editor/state/transitions.ts` (NEW) — transition tables
- `src/components/shared/addresses/editor/helpers/diffAddressFields.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressEditor.ts` (NEW) — main hook
- `src/components/shared/addresses/editor/hooks/useAddressFieldStatus.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressActivity.ts` (NEW) — log accumulator
- `src/components/shared/addresses/editor/__tests__/addressEditorMachine.test.ts` (NEW)
- `src/components/shared/addresses/editor/__tests__/diffAddressFields.test.ts` (NEW)

**Acceptance:**
- State machine 100% test coverage
- `useAddressEditor` hook compila + standalone usable (no UI)
- Demo `app/demo/addresses-editor-state/page.tsx` mostra state transitions live (debugger view)
- ADR §10 update

**Handoff:** Phase 2 — Suggestions + Reconciliation Logic

---

### Phase 2 — Suggestions + Reconciliation Logic
**Scope:** Pattern B + C logic + supporting hooks.
**Files:** ~7
**Deliverable:**
- `src/components/shared/addresses/editor/helpers/computeSuggestionTriggers.ts` (NEW)
- `src/components/shared/addresses/editor/helpers/rankSuggestions.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressSuggestions.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressReconciliation.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressUndo.ts` (NEW) — sessionStorage stack
- `src/components/shared/addresses/editor/__tests__/computeSuggestionTriggers.test.ts` (NEW)
- `src/components/shared/addresses/editor/__tests__/rankSuggestions.test.ts` (NEW)

**Acceptance:**
- 4 suggestion triggers covered by tests (no-results, low-confidence, ambiguous, partial-match)
- Reconciliation diff produces correct field-by-field conflict list
- Undo stack persists across page navigation in sessionStorage
- ADR §10 update

**Handoff:** Phase 3 — Presentational Components Set 1

---

### Phase 3 — Presentational Components Set 1 (status indicators)
**Scope:** Compact status UI (badge, meter, source, freshness).
**Files:** ~10
**Deliverable:**
- `src/components/shared/addresses/editor/components/AddressFieldBadge.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressFieldTooltip.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressConfidenceMeter.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressSourceLabel.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressFreshnessIndicator.tsx` (NEW)
- `src/i18n/locales/el/addresses.json` (MODIFY) — ~15 keys
- `src/i18n/locales/en/addresses.json` (MODIFY) — ~15 keys
- `src/app/demo/addresses-editor/page.tsx` (NEW) — showcase page
- `src/components/shared/addresses/editor/__tests__/AddressFieldBadge.test.tsx` (NEW)

**Acceptance:**
- Demo page mostra tutti 5 components con tutti gli states (match/mismatch/unknown/etc.)
- i18n keys validated (no hardcoded strings — N.11)
- A11y: tooltips accessibili keyboard
- ADR §10 update

**Handoff:** Phase 4 — Presentational Components Set 2

---

### Phase 4 — Presentational Components Set 2 (panels)
**Scope:** Heavy UI panels (activity, reconciliation, suggestions, dialogs).
**Files:** ~10
**Deliverable:**
- `src/components/shared/addresses/editor/components/AddressActivityLog.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressReconciliationPanel.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressSuggestionsPanel.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressDiffSummary.tsx` (NEW)
- `src/components/shared/addresses/editor/components/AddressDragConfirmDialog.tsx` (NEW)
- `src/components/shared/addresses/AddressMapStatusChip.tsx` (MODIFY) — extend states
- `src/i18n/locales/el/addresses.json` (MODIFY) — ~15 more keys
- `src/i18n/locales/en/addresses.json` (MODIFY) — ~15 more keys
- Demo page wiring update
- 1-2 test files

**Acceptance:**
- Activity log scrolla auto, supporta verbosity toggle
- Reconciliation panel wires `useAddressReconciliation` hook
- Suggestions panel keyboard-nav functional (↑↓ Enter Esc)
- Drag confirm dialog wires `useAddressEditor` drag flow
- ADR §10 update

**Handoff:** Phase 5 — Coordinator AddressEditor

---

### Phase 5 — Coordinator AddressEditor
**Scope:** Top-level orchestrator + Context, demo end-to-end.
**Files:** ~6
**Deliverable:**
- `src/components/shared/addresses/editor/AddressEditor.tsx` (NEW) — coordinator
- `src/components/shared/addresses/editor/AddressEditorContext.tsx` (NEW)
- `src/components/shared/addresses/editor/AddressEditor.types.ts` (NEW) — public API
- `src/components/shared/addresses/editor/index.ts` (NEW) — barrel export
- Demo page upgrade — full flow: typing → debounce → load → success/conflict/suggestions → apply → undo
- 1 integration test

**Acceptance:**
- Demo `/demo/addresses-editor` mostra end-to-end flow funzionante
- AddressEditor < 500 LOC, ogni funzione < 40 LOC
- Backward compat: il vecchio `AddressMap` rimane intatto e funzionante (per Phase 6+ migration graduale)
- ADR §10 update

**Handoff:** Phase 6 — Migration Wave 1: Contacts

---

### Phase 6 — Migration Wave 1: Contacts
**Scope:** Tutti i punti contacts che editano/visualizzano addresses.
**Files:** ~5
**Deliverable:**
- `src/components/contacts/dynamic/AddressesSectionWithFullscreen.tsx` (MODIFY) — wrap in AddressEditor
- `src/components/shared/addresses/AddressWithHierarchy.tsx` (MODIFY) — consume context for badges
- `src/components/contacts/details/ContactAddressMapPreview.tsx` (MODIFY) — bridge to AddressEditor
- `src/components/contacts/dynamic/CompanyAddressesSection.tsx` (MODIFY) — branches use editor
- `src/components/contacts/relationships/hooks/useDerivedWorkAddresses.ts` (verifica/touch only se serve)

**Acceptance:**
- HQ edit form mostra activity log + field badges + reconciliation panel
- Drag pin produce confirm dialog (no più silent overwrite)
- Branches editor stesso comportamento
- Derived work addresses (ADR-318) mostrano source label `derived` + read-only
- Test E2E manuale: edit contact → modifica ΤΚ → vede activity log + suggestion → applica → undo
- ADR §10 update

**Handoff:** Phase 7 — Migration Wave 2: Projects + Buildings

---

### Phase 7 — Migration Wave 2: Projects + Buildings
**Scope:** Project locations + building addresses + frontage.
**Files:** ~7
**Deliverable:**
- `src/components/projects/tabs/ProjectLocationsTab.tsx` (MODIFY)
- `src/components/projects/tabs/locations/LocationInlineForm.tsx` (MODIFY)
- `src/components/projects/tabs/locations/ProjectAddressFields.tsx` (MODIFY)
- `src/components/shared/addresses/AddressFormSection.tsx` (MODIFY)
- `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesEditor.tsx` (MODIFY)
- `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesMapPane.tsx` (MODIFY)
- `src/components/projects/building-code/FrontageAddressCreateDialog.tsx` (MODIFY)

**Acceptance:**
- 3 forms (project, building, frontage) mostrano stesso enterprise UI
- Test manuale per ognuno
- ADR §10 update

**Handoff:** Phase 8 — Migration Wave 3: Showcase + Procurement + Read-only

---

### Phase 8 — Migration Wave 3: Showcase + Procurement + Read-only Cards
**Scope:** Last edit form + read-only display surfaces.
**Files:** ~8
**Deliverable:**
- `src/components/property-showcase/AddressMapPicker.tsx` (MODIFY)
- `src/components/procurement/PODeliveryAddressField.tsx` (MODIFY)
- `src/components/shared/addresses/AddressCard.tsx` (MODIFY) — source/freshness badges
- `src/components/shared/addresses/AddressListCard.tsx` (MODIFY)
- `src/components/shared/addresses/SharedAddressActionCard.tsx` (MODIFY)
- `src/components/building-management/tabs/GeneralTabContent/building-addresses-card/BuildingAddressesManualList.tsx` (MODIFY)
- `src/components/contacts/list/ContactsList.tsx` (MODIFY) — inline mini badges (only source-coords-status)
- `src/types/project/addresses.ts` (MODIFY) — `source` + `verifiedAt` + `geocodingMetadata` fields

**Acceptance:**
- Read-only cards mostrano source label + freshness + has-coords
- Tutti i 28 punti dell'app ora rispettano lo standard nuovo
- ADR §10 update

**Handoff:** Phase 9 — Telemetry + Hierarchy Validation

---

### Phase 9 — Telemetry + Hierarchy Validation
**Scope:** Firestore logging + ELSTAT cross-check.
**Files:** ~10
**Deliverable:**
- `src/services/geocoding/address-corrections-telemetry.service.ts` (NEW)
- `src/components/shared/addresses/editor/hooks/useAddressTelemetry.ts` (NEW)
- `src/app/api/geocoding/telemetry/route.ts` (NEW) — server-only write endpoint
- `src/components/shared/addresses/editor/helpers/validateGreekHierarchy.ts` (NEW)
- `src/components/shared/addresses/editor/helpers/postalCodeAutoFill.ts` (NEW)
- `firestore.rules` (MODIFY) — `address_corrections_log` rules
- `firestore.indexes.json` (MODIFY) — 2 composite indexes
- `src/config/firestore-collections.ts` (MODIFY) — register collection
- Tests
- `services/enterprise-id` — `acl_*` prefix se non esiste

**Acceptance:**
- Telemetry write su correction action — Firestore doc creato con tenant isolation
- Hierarchy validation produce activity events su mismatch
- Postal code auto-fill funzionante per `54635` → city `Θεσσαλονίκη`
- Firestore rules tested (ADR-298)
- ADR §10 update

**Handoff:** Phase 10 — Hardening

---

### Phase 10 — Hardening + A11y + Keyboard + Final
**Scope:** Polish + comprehensive a11y + ADR final lock.
**Files:** ~5 + tests
**Deliverable:**
- A11y audit pass: ARIA roles, live regions, focus management, screen reader announcements
- Keyboard shortcuts: `Ctrl+Z` undo, `Ctrl+Shift+Z` redo, `Ctrl+Shift+R` force re-geocode, `Esc` close panels, `↑↓ Enter` suggestions nav
- Comprehensive E2E test sweep
- `docs/centralized-systems/reference/adrs/ADR-332-...md` (MODIFY) — Phase 3 changelog finale, status `📋 PROPOSED → ✅ IMPLEMENTED`
- Update `docs/centralized-systems/reference/adr-index.md` (auto-generated; just run script)
- README/internals doc se necessario

**Acceptance:**
- A11y audit report: zero AA-level violations su demo + 1 contact form
- Keyboard nav fully functional senza mouse
- Tests > 90% coverage on new files
- ADR `IMPLEMENTED`
- Final commit `feat(addresses): ADR-332 IMPLEMENTED — enterprise address editor system v2.0`

**Handoff:** END (system ready for production)

---

## 5. Decisions log

### D1 — Coordinator vs prop-drilling vs Context
**RESOLVED — Coordinator (Layer 6) `AddressEditor`**
- Rejected: bare AddressMap + opt-in prop (compromise, not Google-grade)
- Rejected: global Context (overkill, breaks with multiple form/map pairs on same page)
- Chosen: **dedicated coordinator** che possiede form + map + tutti i panel
- Rationale: Google `<gmpx-place-picker>` pattern, SAP/Oracle/Mapbox convergence, single ownership = N.7.2 explicit lifecycle

### D2 — Form scope V1
**RESOLVED — All 9 forms migrated (Phases 6-8)**
- Rejected: contacts-only V1 (canary launch — ammessibile in MVP, rifiutato Enterprise)
- Rejected: 2/3 forms V1 phased
- Chosen: **all 9 forms** + read-only cards + map previews (Phases 6-8 progressive)
- Rationale: "Completeness over MVP" memory rule — Giorgio explicit GOL+SSOT mandate

### D3 — Pattern C trigger scope
**RESOLVED — 4 triggers (no-results / low-confidence / ambiguous / partial-match)**
- Rejected: 0-results-only (1 trigger) — under-utilized given limit=5 already requested
- Chosen: **all 4 triggers** with 0-extra Nominatim cost on triggers 2/3/4 (data already in response)
- Rationale: Google Geocoder API equivalent transparency

### D4 — Activity log default verbosity
**RESOLVED — `detailed` (default)**
- Rejected: `basic` (under-informs the user — contradicts mandate "πλήρη πληροφόρηση κάθε στιγμή")
- Rejected: `debug` (too noisy as default)
- Chosen: **`detailed`** with toggle to `basic` or `debug`
- Rationale: Giorgio explicit "πλήρη πληροφόρηση κάθε στιγμή"

### D5 — Telemetry collection
**RESOLVED — YES, `address_corrections_log/`**
- Storage cost: ~1 doc per address change, minimal vs business value
- Future ML/heuristics: track which suggestions are accepted to improve ranking
- Rules: tenant-isolation via companyId + Admin-only delete

### D6 — Undo timeout
**RESOLVED — 60 seconds**
- Rejected: 30s (Google standard inline-undo) — insufficient per address correction (user alterna mappa+form)
- Rejected: permanent stack — confusing scope
- Chosen: **60s session-scoped** in sessionStorage

### D7 — Read-only enrichment
**RESOLVED — Source + Freshness + Has-coords badges everywhere**
- Includes ContactsList inline (compact only-coords-status badge)
- Schema migration: `ProjectAddress.source` + `.verifiedAt` + `.geocodingMetadata` (optional fields, retro-compatible)

### D8 — Hierarchy validation engine
**RESOLVED — `validateGreekHierarchy.ts` + ELSTAT data lookup**
- Postal code 5-digit + first-digit 1-9 strict
- Postal-code → expected-region table from ELSTAT (data layer pre-existente)
- Mismatch produce activity event + field badge `unknown`

### D9 — Backward compatibility durante rollout
**RESOLVED — Old `AddressMap` standalone preservato fino al Phase 8 done**
- Phases 0-5 building su parallel tree (`editor/` subdir)
- Phase 6-8 migration progressive
- Ogni session è committable + non-breaking

### D11 — «Δεν βρέθηκε» δεν είναι «Σφάλμα»
**RESOLVED (2026-07-26) — νέα φάση `not-found`, ξεχωριστό event `GEOCODE_EMPTY`**

Το `GEOCODE_FAILED` οδηγούσε στη φάση `error` για **κάθε** αιτία, μαζί με το `'no-results'`. Ο
πάροχος που απαντά ειλικρινά «αυτή η διεύθυνση δεν υπάρχει στα δεδομένα μου» εμφανιζόταν ως
**«Σφάλμα αναζήτησης»**. Ο κώδικας γνώριζε τη διάκριση (`canRetry: reason !== 'no-results'`) αλλά το
UI τη διέγραφε.

Παράλληλα το `geocodeAddress()` επέστρεφε `null` και για 404 και για 429/500/network και **ποτέ δεν
έκανε throw** — άρα το `catch` και το `classifyError` του `useAddressEditor` ήταν **νεκρός κώδικας**
και ένα πραγματικό rate-limit εμφανιζόταν ως «δεν βρέθηκε».

- Νέο `GeocodingOutcome = found | not-found | error{reason}` στο `geocoding-types.ts`.
- Νέα `geocodeAddressDetailed()`· η `geocodeAddress()` μένει **λεπτό wrapper** ώστε οι δύο άλλοι
  καταναλωτές (`useAddressMapGeocoding`, `AddressWithHierarchy`) να μην αγγιχτούν — κοινό cache/dedup.
- Στην cache μπαίνουν **μόνο** επιτυχίες: ένα παροδικό 429 δεν πρέπει να καρφώσει μόνιμη αποτυχία.
- `AddressEditorErrorReason` πλέον = `timeout | rate-limit | network | server`· κάθε αιτία που φτάνει
  στη φάση `error` είναι επαναλήψιμη, άρα `canRetry: true` πάντα.

**Κόστος αν αγνοηθεί:** ολόκληρη η προηγούμενη συνεδρία διέγνωσε «νεκρό geocoder» από αυτή ακριβώς
την ετικέτα. Ο geocoder δούλευε· η δοκιμαστική οδός «Ονειροπόλων» απλώς δεν υπάρχει στο OSM
(μετρημένο: το Nominatim επιστρέφει `[]` και για freeform και για structured).

### D12 — Ακεραιότητα χώρας
**RESOLVED (2026-07-26) — `outOfDeclaredCountry` + μηδενισμός βεβαιότητας + ανθεκτική αντιστοίχιση ονόματος**

Οι παραλλαγές 7/8 σηκώνουν σκόπιμα τον περιορισμό χώρας για να σώσουν είσοδο με τυπογραφικά. Αυτό
επέστρεφε **σιωπηλά** διεύθυνση σε άλλη ήπειρο: μετρημένο 2026-07-26,
`{street:"Ονειροπόλων", postalCode:"54624", country:"Ελλάδα"}` → **Town of Wheatland, Vernon County,
Wisconsin, ΗΠΑ**, confidence 0,55.

- Ενιαία έξοδος `finishWith()` για **και τις 8** παραλλαγές (αντικατέστησε 8 πανομοιότυπες εκφράσεις)·
  περνά από `enforceCountryIntegrity()`, που συγκρίνει το `address.country_code` του Nominatim με τη
  δηλωμένη χώρα. Εκτός χώρας → `outOfDeclaredCountry: true` + `confidence: 0`. Ο υποψήφιος
  **εξακολουθεί να επιστρέφεται** (εξηγεί τι ταίριαξε ο πάροχος) αλλά δεν διαβάζεται ποτέ ως επαληθευμένος.
- **Δεύτερη, βαθύτερη αιτία:** το `countryNameToCode()` έκανε ωμό `toLowerCase()` σε literal keys με
  τόνους. Άρα «ΕΛΛΑΔΑ» (πολύ συνηθισμένη εισαγωγή) και η **αποσυντεθειμένη (NFD)** μορφή που βάζουν
  macOS/iOS στο πρόχειρο **δεν αντιστοιχίζονταν** → έπεφτε το `countrycodes` από **κάθε** παραλλαγή →
  ανεξέλεγκτη αναζήτηση. Μετρημένο: «Τσιμισκή 43, Θεσσαλονίκη, 54623» χωρίς περιορισμό επέστρεφε
  **Viale Ungheria, Μιλάνο**· με περιορισμό, το σωστό κτίριο. Νέο `COUNTRY_CODE_INDEX` κανονικοποιημένο
  με το **υπάρχον** `normalizeGreekText` (πεζά + αφαίρεση τόνων + NFD-safe) — μηδέν νέο βοηθητικό.

### D13 — Το Τ.Κ. βγαίνει από τα structured params
**RESOLVED (2026-07-26) — μετρημένο, όχι θεωρητικό**

Στο Nominatim το `postalcode` ως structured φίλτρο **μόνο αφαιρεί**. Μετρημένο 2026-07-26:
`street=Τσιμισκή 43 & city=Θεσσαλονίκη` → ταιριάζει· `+postalcode=54623` → `[]`· `+postalcode=546 23`
→ `[]`. Το Τ.Κ. παραμένει στα free-form ερωτήματα, όπου **βοηθά** και δέχεται και τις δύο μορφές.

Σχετική παρατήρηση για το χρέος αποθήκευσης: το OSM Ελλάδας αποθηκεύει τον Τ.Κ. **με κενό** («546 24»),
που είναι και η επίσημη ελληνική μορφή — άρα το «546 24» στη βάση **δεν είναι αλλοίωση, είναι
ασυνέπεια**. Η κανονικοποίηση ανήκει σε ξεχωριστή εργασία.

### D14 — Ο αριθμός φτάνει στον πάροχο
**RESOLVED (2026-07-26)**

Το `toQuery()` του `useAddressEditor` **παρέλειπε** το `number`, και το `GeocodingRequestBody` δεν το
είχε καν. Το geocoding ήταν μόνιμα σε επίπεδο άξονα δρόμου· το `accuracy: 'exact'` ήταν **απρόσιτο**.

Ένας composer `composeStreet(params, order)` παράγει και τις δύο σειρές ώστε να μην αποκλίνουν: το
structured slot του Nominatim θέλει «<αριθμός> <όνομα>», το ελεύθερο κείμενο ακολουθεί την ελληνική
γραφή «<όνομα> <αριθμός>». Τα free-form ερωτήματα χωρίζονται πλέον με **κόμματα** (η προηγούμενη
συνένωση με κενά έδινε `[]` εκεί που το κόμμα ταιριάζει).

**Μετρημένο αποτέλεσμα:** «Τσιμισκή 43, Θεσσαλονίκη, 54623, Ελλάδα» → «**Γενικό Προξενείο των ΗΠΑ, 43,
Ιωάννη Τσιμισκή, Λαδάδικα, Θεσσαλονίκη**», βεβαιότητα **0,85**, παραλλαγή 1 — ακρίβεια κτιρίου που
πριν ήταν αδύνατη.

### D15 — ΕΝΑΣ κατασκευαστής του παράγωγου `addresses[]`
**RESOLVED — `src/utils/contacts/address-info-builder.ts`**

**Η αρχική διάγνωση ήταν ανακριβής και διορθώνεται εδώ.** Το προηγούμενο handoff περιέγραφε «διπλή &
ασύμφωνη εγγραφή». Ο κώδικας λέει κάτι διαφορετικό: το `customFields.companyAddresses` είναι η
**αυθεντική** εγγραφή και το `addresses[]` **παράγωγο** — νόμιμο σχήμα SSoT, όχι διπλή εγγραφή.

Το πραγματικό ελάττωμα ήταν ότι η παραγωγή υπήρχε **τρεις** φορές, όχι δύο:

| # | Πού | Ιεραρχία | `neighborhood` | `country` | `type` |
|---|---|---|---|---|---|
| A | `EnterpriseContactSaver` (flat πεδία → έδρα) | ✅ πλήρης | ✅ | σταθερό `'GR'` | από είδος επαφής |
| B | `EnterpriseContactSaver.buildAddressesFromCompany` | ❌ **καμία** | ✅ | σταθερό `'GR'` | σταθερό `'work'` |
| C | `mappers/company.ts buildAddresses` | ❌ **καμία** | ❌ **χανόταν** | σταθερό `'GR'` | σταθερό `'work'` |

Το σχόλιο πάνω από το B έλεγε κυριολεκτικά *«Same logic as mappers/company.ts buildAddresses»* —
**σχόλιο αντί για κοινή συνάρτηση**, και το C είχε ήδη ξεφύγει. Χειρότερα, το B έγραφε **πάνω** από το
A (`enterpriseData.addresses = buildAddressesFromCompany(...)`), οπότε ο κλάδος εταιρειών πετούσε την
ιεραρχία που το A μόλις είχε φτιάξει σωστά για την έδρα. Και το **C κέρδιζε** στη ζωντανή διαδρομή:
`mapFormDataToContact` (create **και** guarded-update) → `mapCompanyFormData` → C.

**Γιατί κανένα gate δεν το έπιασε:** διαφορετικά ονόματα συναρτήσεων ⇒ αόρατο στο name/regex-based
`ssot:discover` (CHECK 3.18). Η κατηγορία **ADR-584** που βλέπει μόνο το token-based `jscpd`.

**Τι κόστιζε:** κάθε αναγνώστης του `contact.addresses` (λίστα επαφών, `ContactListCard`,
`building-update.handler`, `hierarchy-resolver`, `report-data-aggregator`, λογιστική, branding) έβλεπε
διεύθυνση **χωρίς διοικητική ιεραρχία**· και οι `individualMapper`/`serviceMapper` διαβάζουν την
ιεραρχία **από το `addresses[0]`**, άρα εκεί η απώλεια ήταν και round-trip.

**Η λύση:** ένα module με δύο εισόδους (flat / `CompanyAddress`) και **κοινά** εσωτερικά — πίνακας
`HIERARCHY_PROJECTION` (μία γραμμή ανά επίπεδο, αντί για τρεις χειρόγραφες αντιστοιχίσεις ονομάτων),
`projectHierarchy`, `resolveAddressLabel`. Το `mappers/company.ts` **δεν** απέκτησε νέο κώδικα: η
τοπική `buildAddresses` **διαγράφηκε** και χρησιμοποιείται το `enterpriseData.addresses`, ακριβώς
όπως έκαναν ήδη τα αδέλφια `individual.ts` / `service.ts`.

**Το `type: 'work'` ΔΕΝ ήταν bug** — ο κώδικας νίκησε: το `AddressInfo['type']` είναι ταχυδρομικό
είδος (`home|work|billing|shipping|other`), ενώ ο φορέας της σημασιολογίας ADR-319 είναι το `label`.
Ήταν όμως **σταθερά** εκεί που πρέπει να είναι παράγωγο ⇒ `toAddressInfoType()` δίπλα στο λεξιλόγιο
που μεταφράζει. Μοναδική αλλαγή συμπεριφοράς: `other → 'other'`.

**Μετρημένο, ίδιο υποκατάστημα ALFA, Firestore πριν/μετά:**
πριν `{ street, number, city, postalCode, region:"", country:"GR", type:"work", label:"branch" }` —
μετά τα ίδια **συν** `settlement`, `settlementId`, `community`, `municipalUnit`, `municipality`,
`municipalityId`, `regionalUnit`, `region`, `decentAdmin`, `majorGeo`, `neighborhood:"Κέντρο"`.
Το `customFields.companyAddresses` **αμετάβλητο**.

### D16 — Κανονικός Τ.Κ. στη βάση, μάσκα στην οθόνη
**RESOLVED — `src/utils/address/postal-code.ts`**

**Το «546 24» δεν ήταν αλλοίωση — ήταν ασυνέπεια.** Είναι η **επίσημη** ελληνική μορφή (ΕΛΤΑ). Το
πρόβλημα ήταν ότι η ίδια τιμή υπήρχε σε δύο μορφές και **κάθε εσωτερική σύγκριση έσπαγε σιωπηλά**:

- `public/data/administrative-hierarchy.json`: **949 οικισμοί με Τ.Κ., 0 με κενό** ⇒ το
  `findSettlementsByPostalCode("546 24")` δεν επέστρεφε **ποτέ** τίποτα.
- `isValidGreekPostalCode` (`/^[1-9]\d{4}$/`) και `validateGreekHierarchy` **απέρριπταν** τιμή που
  ήταν ήδη στη βάση· το `validateAddress` (`/^\d{5}$/`) απέρριπτε το αποθηκευμένο «546 22».
- Το badge «Τ.Κ. ταιριάζει» συνέκρινε «54624» με «546 24» ⇒ **πάντα** mismatch.

**Πού γεννιόταν** (τρία σημεία, όχι ένα): `AddressWithHierarchy.handleBasicChange` περνούσε **κάθε**
πληκτρολόγηση από `formatGreekPostalCode` και έβαζε τη **μορφοποιημένη** τιμή στο state·
`applyResolvedPath` το ίδιο· και ο πάροχος (`extractResolvedFields`, `reverse/route`) επέστρεφε τη
μορφή του OSM αυτούσια.

**Απόφαση:** κανονική μορφή (5 ψηφία) στη βάση = κλειδί σύγκρισης/αναζήτησης· μορφοποίηση **μόνο στο
render**. Η μάσκα είναι εμφάνιση — τα σύμβολά της δεν αποθηκεύονται ποτέ.

**Δύο δικλείδες που δεν είχε η προηγούμενη υλοποίηση:**
1. **Ξένοι Τ.Κ. μένουν ανέπαφοι.** Η κανονικοποίηση αφορά **μόνο** το ακριβές σχήμα `\d{3} \d{2}`, και
   η μετάπτωση εφαρμόζεται **μόνο σε ελληνική διεύθυνση**. Τυφλό `replace(/\s/g,'')` θα έκανε το
   `SW1A 1AA` → `SW1A1AA` και το σουηδικό «111 51» → «11151». Το παλιό `replace(/\D/g,'')` στο input
   έκοβε ήδη σιωπηλά κάθε μη-ελληνικό Τ.Κ. σε ψηφία — διορθώθηκε με πύλη χώρας.
2. **`postalCodeAppearsIn`.** Το `display_name` του Nominatim γράφει τον Τ.Κ. **με κενό**. Με κανονικό
   ερώτημα, ένα σκέτο `includes` θα έχανε το `postalMatch` ⇒ **παλινδρόμηση εμπιστοσύνης από τη
   διόρθωση, όχι από τα δεδομένα**. Αντίστροφα, το `buildFieldMatches` **διορθώθηκε** (συγκρίνει
   κανονικές μορφές και στις δύο πλευρές).

**Boy Scout (N.0.2):** το «Οδός, Αριθμός, Πόλη, Τ.Κ.» ήταν γραμμένο **τέσσερις** φορές
(`formatHqStreetLine`, inline στο `AddressesSectionWithFullscreen`, `formatBranchStreetLine`, τοπικό
δίδυμο στο `AddressCard`) και **καμία** δεν μορφοποιούσε τον Τ.Κ. ⇒ ένα
`formatContactAddressLine`. Επίσης ενοποιήθηκε το «είναι ελληνική διεύθυνση;»: ο engine είχε πλήρη
accent-insensitive χάρτη, το UI **inline αλυσίδα `||`** έξι τιμών ⇒ `@/utils/address/country-codes`.

**Μετάπτωση:** `GET /api/admin/migrate-postal-codes` (dry-run) / `POST` (execute), πίνακας στόχων
`contacts.addresses[]` + `contacts.customFields.companyAddresses[]` + `projects.addresses[]` +
`buildings.addresses[]`. Χρησιμοποιεί το **`createMigrationRoute` factory** αντί για αντιγραφή των
wrappers του `migrate-address-labels` (εκείνο τους χρειάστηκε για `?companyId=`· εδώ η
κανονικοποίηση είναι καθολική) — αλλιώς θα ήταν το sibling clone του N.18.
**Μετρημένο ζωντανά:** dry-run 4 σαρωμένα / 1 επηρεαζόμενο (`projects…«546 22»`) → execute →
`"54622"` → **δεύτερο dry-run: 0** (ιδιοτροπία).

### D17 — Τρία λεξιλόγια χώρας: καταγράφεται, ΔΕΝ ενοποιείται σιωπηλά
**OPEN — απόφαση προϊόντος, όχι τεχνική**

Το έργο κουβαλά **τρεις** διαφορετικές τιμές για την ίδια χώρα:

| Πού | Τιμή |
|---|---|
| `contacts.addresses[].country` | `"GR"` |
| `projects.addresses[].country` | `"Greece"` |
| `GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY_CODE` | `"gr"` |

**Και το `.env.example` λέει κάτι που δεν ισχύει πουθενά:** ορίζει
`NEXT_PUBLIC_DEFAULT_COUNTRY=Ελλάδα`, αλλά **κανένα** πραγματικό `.env` δεν την ορίζει ⇒ σε dev, σε
jest **και** στην παραγωγή ισχύει το fallback `'Greece'`. Ζωντανό τεκμήριο:
`projects/proj_2497…addresses[0].country === "Greece"`.

**Πώς εκδηλώθηκε:** το `address-helpers.test.ts` έγραφε `expect(country).toBe('Ελλάδα')` με σχόλιο
*«From geographic config»* — δηλαδή κωδικοποιούσε την **πρόθεση** της ρύθμισης, όχι την τιμή της.
Ήταν **μόνιμα κόκκινο, παντού** (όχι «περιβαλλοντικό»).

**Τι έγινε:** το assertion ελέγχει πλέον τη **συμπεριφορά** (`toBe(GEOGRAPHIC_CONFIG.DEFAULT_COUNTRY)`
συν `not.toBe('GR')` για το πραγματικό regression). **Τι ΔΕΝ έγινε:** δεν επιλέχθηκε σιωπηλά «σωστή»
τιμή — αλλάζει αποθηκευμένα δεδομένα και θέλει δική της μετάπτωση. Ο νέος
`address-info-builder` κρατά ρητά το υπάρχον `'GR'` των επαφών ως **ονομασμένη σταθερά με σχόλιο**,
ώστε η ενοποίηση να είναι μία αλλαγή σε ένα σημείο όταν αποφασιστεί.

### D18 — Η λίστα διευθύνσεων ανήκει σε ΚΑΘΕ είδος επαφής
**RESOLVED — 2026-07-26**

**Το ελάττωμα: σιωπηλή απώλεια δεδομένων στο save.** Το UI δέχεται επιπλέον διευθύνσεις και για τους
τρεις τύπους επαφής (`AddressesSectionWithFullscreen` — **ίδιο** component σε `individual`/`company`/
`service` μέσω `contactRenderersCore`, με το κουμπί «Νέα διεύθυνση» χωρίς κανέναν έλεγχο τύπου). Η
αποθήκευση όμως τις κρατούσε **μόνο** για εταιρείες. Ό,τι δεν ήταν στη θέση 0 εξαφανιζόταν χωρίς
καμία προειδοποίηση.

Η αλυσίδα, και τα πέντε σημεία:

| # | Σημείο | Τι έκανε |
|---|---|---|
| 1 | `EnterpriseContactSaver:138` | `customFields.companyAddresses` + παραγωγή `addresses[]` **μέσα** σε `if (type === 'company')` |
| 2 | `EnterpriseContactSaver:81` | για τους άλλους δύο, το `addresses[]` έβγαινε **μόνο** από τα flat πεδία ⇒ μία εγγραφή |
| 3 | `stripTypeExclusiveFields` | το `companyAddresses` ήταν στα **απαγορευμένα** για individual + service ⇒ σβηνόταν και το top-level |
| 4 | `mappers/individual.ts`, `mappers/service.ts` | create path: **κανένα** `customFields` |
| 5 | `individualMapper`, `serviceMapper` | read path: **μόνο** `addresses[0]` |

**Ότι ήταν ελάττωμα και όχι σχεδιαστική επιλογή το λέει το ίδιο το σχήμα:** το
`CONTACT_ADDRESS_TYPE_METADATA` (ADR-319) ορίζει ρητά `home`/`office`/`vacation` για φυσικά πρόσωπα
και `central_service`/`regional_service`/`annex`/`department` για υπηρεσίες, ενώ ο τύπος
`CompanyAddress` το τεκμηριώνει κατά λέξη: *«wider than the legacy headquarters|branch pair **so
individuals can pick** home/vacation/office»*. Το λεξιλόγιο υπήρχε· η αποθήκευση δεν το ακολούθησε.

**Γιατί κανένα gate δεν το έπιασε:** δεν είναι διπλότυπο ούτε παράβαση ονόματος — είναι **απουσία**
κλάδου. Ούτε το `ssot:discover` ούτε το `jscpd` έχουν όργανο γι' αυτό. Το μόνο που θα το έπιανε είναι
round-trip test σε φυσικό πρόσωπο με δεύτερη διεύθυνση· δεν υπήρχε.

**Τι έγινε**
- Το μπλοκ διευθύνσεων βγήκε από το `if (type === 'company')` — τρέχει για **όλους**, και η αφαίρεση
  του top-level αντιγράφου γίνεται πλέον καθολικά (η αυθεντική λίστα ζει στα `customFields`).
- Νέο SSoT ανάγνωσης **`src/utils/contacts/contact-addresses-reader.ts`**: το
  `resolveCompanyAddresses` ήταν ιδιωτικό στον `companyMapper`, τώρα είναι κοινό και δέχεται
  `contactType`. **Διορθώθηκε μαζί:** το τρίτο fallback έγραφε σταθερά `headquarters`/`branch` —
  τιμές που το ADR-319 **δεν επιτρέπει** σε φυσικό πρόσωπο ή υπηρεσία· τώρα βγαίνουν από
  `getPrimaryAddressType` / `getDefaultSecondaryAddressType`.
- Νέος `buildCompanyAddressFromAddressInfo` (αντίστροφος του `resolveAddressLabel`): ελεύθερη ετικέτα
  επιστρέφει ως `other` + `customLabel`, αλλιώς ένα «Εξοχικό Πηλίου» θα εξαφανιζόταν στο reload.
- Το `companyAddresses` **αφαιρέθηκε** από τα `FORBIDDEN_FOR_INDIVIDUAL` / `FORBIDDEN_FOR_SERVICE`.
  Τα σύνολα επαληθεύτηκαν προγραμματιστικά ως **ταυτόσημα** με του HEAD κατά τα λοιπά.

**Το όνομα ΔΕΝ άλλαξε.** Το `customFields.companyAddresses` κρατά το όνομά του και για φυσικά
πρόσωπα. Ένα ουδέτερο όνομα θα απαιτούσε μετάπτωση υπαρχόντων εγγράφων εταιρειών· διόρθωση απώλειας
δεδομένων δεν δένεται με μετονομασία σχήματος. **Χρέος, καταγεγραμμένο εδώ.**

**Τρία ευρήματα δίπλα στη διόρθωση (N.0.2 / N.18)**
1. `individualMapper` ↔ `serviceMapper`: 18 γραμμές flat-πεδίων αντιγραμμένες, και ο δεύτερος είχε
   **ήδη ξεχάσει** το `neighborhood` — η «Περιοχή / Συνοικία» υπηρεσίας αποθηκευόταν αλλά δεν
   ξαναδιαβαζόταν ποτέ. Ενοποιήθηκε σε `buildFlatFieldsFromAddressInfo`, πάνω στον **ίδιο**
   `HIERARCHY_PROJECTION` (μια χειρόγραφη αντίστροφη θα ήταν sibling clone).
2. Το προοίμιο `enterpriseData/emails/phones` ήταν αντιγραμμένο **τρεις** φορές στους create mappers
   → `buildEnterpriseContactArrays`.
3. Οι λίστες του `contact-type-fields` είχαν τα ίδια μπλοκ ταυτότητας δύο φορές → σύνθεση από ομάδες.
   ⚠️ Οι διαφορές τους είναι **πραγματικές** (`prefecture` απαγορεύεται σε φυσικό πρόσωπο αλλά όχι σε
   εταιρεία, όπου είναι πεδίο ΓΕΜΗ) και διατηρήθηκαν.

**Νεκρός κώδικας που εντοπίστηκε (ΔΕΝ αφαιρέθηκε):** το `individualAddresses` (τύπος
`ContactFormTypes:148` + read στον `individualMapper`) **δεν το γράφει κανείς** και **κανένα UI δεν
το χρησιμοποιεί** — ημιτελές υπόλειμμα του ADR-318 που εξηγεί γιατί υπήρξε το κενό: η πρόθεση για
multi-address σε φυσικά πρόσωπα υπήρχε, το UI πήγε στο `companyAddresses`, το write δεν γράφτηκε ποτέ.

**Επαλήθευση:** 22 νέα tests (round-trip και για τα τρία είδη), **mutation-verified ×2** — επαναφορά
του `if (type === 'company')` έριξε **6** tests (ακριβώς individual+service, τα company πράσινα),
επαναφορά των σταθερών slug έριξε **1**. Σύνολο **140/140** στα `src/utils/contacts` +
`src/utils/contactForm`. `jscpd:diff` σε 12 αρχεία: **3 clones → 0**. **ΟΧΙ tsc (N.17).**

#### D18.1 — Ζωντανή επαλήθευση (2026-07-27): η διόρθωση δεν έφτανε στη βάση

Η D18 κλείστηκε με **280 πράσινα tests και μηδέν ζωντανή εκτέλεση**. Στην πρώτη πραγματική
αποθήκευση, η δημιουργία φυσικού προσώπου **απέτυχε ολόκληρη**:

```
[SubmissionError] contactType:"individual" isEdit:false
Function setDoc() called with invalid data (via `toFirestore()`).
Unsupported field value: undefined
```

Απομόνωση με δύο εκτελέσεις: επαφή **χωρίς** διεύθυνση αποθηκεύτηκε κανονικά· επαφή με **μία**
διεύθυνση απέτυχε ⇒ η αιτία ήταν στη διαδρομή διευθύνσεων, όχι στα βασικά πεδία. Προσωρινός
ανιχνευτής μονοπατιών πριν το `setDoc` έδωσε τα ακριβή πεδία:

```
createData.customFields.companyAddresses[0].customLabel
createData.customFields.companyAddresses[0].country
```

**Η ρίζα.** Ο `sanitizeContactData` — το chokepoint πριν τη βάση — ελέγχει τους πίνακες **μόνο για
μήκος** (`value.length === 0`) και **δεν κατεβαίνει ποτέ στα στοιχεία τους**. Η φόρμα διευθύνσεων
γράφει πάντα τα κλειδιά `customLabel` και `country`, με τιμή μόνο όταν ο τύπος είναι `other` ή
υπάρχει χώρα (`AddressesSectionWithFullscreen:257-258`, `CompanyAddressesSection:108`). Το Firestore
απορρίπτει `undefined` σε **οποιοδήποτε** βάθος.

**Δεν είναι παλινδρόμηση της D18** — είναι προϋπάρχον κενό που η D18 **εξέθεσε**: πριν, το
`customFields` δεν παραγόταν καθόλου για `individual`/`service`, οπότε τα `undefined` δεν έφταναν
ποτέ σε έγγραφο. Ο ίδιος τυφλός πίνακας υπάρχει και στο `sanitizeContactForUpdate` (ο έλεγχος
`value === undefined` πιάνει κλειδιά αντικειμένων, ποτέ στοιχεία πινάκων).

**Η διόρθωση: ΕΝΑ σημείο, υπάρχον SSoT.** Και οι δύο sanitizers επιστρέφουν πλέον μέσω
`stripUndefinedDeep` (`src/utils/firestore-sanitize.ts` — ήδη γραμμένο, ως τότε **αχρησιμοποίητο**
export· μπαίνει και μέσα σε πίνακες). Δεν κυνηγήθηκαν τα ~4 σημεία UI που παράγουν το `undefined`:
εκεί η τιμή έχει **σκόπιμη** σημασιολογία «καθάρισε το προηγούμενο» μέσα στο React state, και η
μετάφρασή της σε «παράλειψη κλειδιού» ανήκει στο persistence layer — αλλιώς κάθε νέο σημείο
διεύθυνσης θα ξανάσπαγε το save. Τα FieldValue sentinels (`serverTimestamp()`) προστίθενται **μετά**
από αυτό το layer, οπότε η αναδρομή δεν τα καταστρέφει.

**Απόδειξη στη βάση** (όχι στην οθόνη):

| Σενάριο | `customFields.companyAddresses` | `addresses` | top-level `companyAddresses` |
|---|---|---|---|
| Φυσικό πρόσωπο | **2** — `home` + `office` | **2** — labels `home`/`office` | απόν ✅ |
| Υπηρεσία | **2** — `central_service` + `annex` | **2** — labels ίδιοι | απόν ✅ |
| ALFA (save χωρίς αλλαγή) | **2** — `headquarters` + `branch` | **2**, με `neighborhood: "Κέντρο"` | απόν ✅ |

Round-trip: μετά από **hard reload**, το φυσικό πρόσωπο εμφανίζει «Διευθύνσεις (2)» με τους τύπους
**Κατοικία** και **Γραφείο**.

**Η υποψία περί `updateDoc` ΔΕΝ ισχύει.** Ο έλεγχος μη-παλινδρόμησης της ALFA κρατά το
`customFields.activityType = "main"` άθικτο μετά από save — ο `EnterpriseContactSaver.
updateExistingContact` κάνει **deep-merge** των `customFields` πριν το `Object.assign`. Το `customFields`
δεν αντικαθίσταται ολόκληρο· ΚΑΔ/ΓΕΜΗ δεν κινδυνεύουν.

**Tests:** 3 νέα στο `data-cleaning.test.ts`, **mutation-verified** — με επαναφορά της διόρθωσης
πέφτουν **2**, δείχνοντας ακριβώς `customLabel: undefined` / `country: undefined`.
⚠️ Χρησιμοποιούν **`toStrictEqual`**: το `toEqual` του Jest **αγνοεί** κλειδιά με τιμή `undefined`,
οπότε ένα `toEqual` test θα ήταν πράσινο **και με το bug ζωντανό** — διακοσμητικό anchor. 18/18 ·
`jscpd:diff` καθαρό · **ΟΧΙ tsc (N.17)**.

**Το μάθημα:** 280 πράσινα unit tests δεν αποδεικνύουν ότι ένα byte έφτασε στη βάση. Η D18 άλλαξε
**τι** στέλνεται· κανένα test δεν έτρεχε τον πραγματικό write path.

### D19 — Μετά το save, ο πάνακας πρέπει να ξανα-αγκυρωθεί· δεν αρκεί να είναι σωστά τα δεδομένα
**RESOLVED 2026-07-27 — μετρημένη αναπαραγωγή, διόρθωση σε δύο κοινόχρηστα SSoT**

**Η αναφορά:** «μετά την αποθήκευση η καρτέλα Διευθύνσεις δείχνει **μία** διεύθυνση αντί για όλες·
λείπει ακόμη και η επικεφαλίδα «Διευθύνσεις (N)»· μετά από hard reload είναι όλες εκεί».

**Τι ΔΕΝ έφταιγε** (αποκλείστηκε με μέτρηση, όχι με ανάγνωση κώδικα): η βάση. Τη στιγμή του
σφάλματος το έγγραφο είχε **και τις οκτώ** διευθύνσεις σε `customFields.companyAddresses` **και** σε
`addresses`. Ούτε το `handleContactUpdatedInPlace` έφταιγε (κάνει φρέσκο `getContact`), ούτε ο
`contact-addresses-reader`, ούτε race με το Firestore write. **Το write path της D18.1 είναι σωστό.**

**Η αιτία — η επικεφαλίδα δεν έλειπε, είχε κυλήσει εκτός οθόνης.** Ο inline editor διεύθυνσης είναι
ψηλός (~600px: πεδία + ιεραρχία + πάνελ συμφωνίας + αρχείο δραστηριότητας). Όταν τελειώνει η
επεξεργασία, **αποπροσαρτάται** και ο πάνακας κονταίνει απότομα — αλλά το `scrollTop` του scroll
container μένει εκεί που ήταν. Ο χρήστης μένει να κοιτά το **κάτω κομμάτι** μιας πλέον κοντής λίστας:
χωρίς μπάρα καρτελών, χωρίς επικεφαλίδα ενότητας, με μόνο τις τελευταίες γραμμές ορατές. Το
διαβάζει ως **«εξαφανίστηκαν οι διευθύνσεις μου»** τη στιγμή ακριβώς που το σύστημα λέει
«ενημερώθηκε επιτυχώς». Το hard reload «διόρθωνε» απλώς επειδή μηδενίζει την κύλιση.

**Γιατί re-anchor και όχι διατήρηση θέσης.** Το scroll anchoring σωστά διατηρεί τη θέση όταν το
περιεχόμενο είναι σταθερό. Εδώ το περιεχόμενο **αλλάζει σχήμα**: το άγκυρο που κοίταζε ο χρήστης
(η φόρμα) έπαψε να υπάρχει. Όταν συμβαίνει αυτό, η πρακτική των μεγάλων παικτών είναι επαναφορά σε
σταθερή, αυτο-εξηγούμενη κατάσταση — και εδώ αυτή είναι η κορυφή, γιατί εκεί ζει η **απόδειξη** που
ζητά ο χρήστης: «Διευθύνσεις (8)» και ολόκληρη η λίστα.

**Πού μπήκε η διόρθωση — στον ΕΝΑ ιδιοκτήτη της κύλισης.** `DetailsContainer` (`src/core/containers/`)
κατέχει το μοναδικό scroll container **όλων** των σελίδων λεπτομερειών (επαφές, έργα, κτίρια,
parking, storage). Νέο **προαιρετικό** prop `scrollResetToken`: όταν αλλάζει η τιμή του, η κύλιση
επιστρέφει στην κορυφή (ποτέ στο πρώτο mount, ποτέ χωρίς token). Καμία άλλη σελίδα δεν χρειάζεται
δικό της αντίγραφο — και όσες δεν περνούν token μένουν **απολύτως** ανεπηρέαστες. Ο
`useContactDetailsController` αυξάνει το token σε κάθε **τέλος** συνεδρίας επεξεργασίας — αποθήκευση
**και ακύρωση**, γιατί η ακύρωση αποπροσαρτά τον ίδιο ψηλό editor και άφηνε την ίδια κομμένη εικόνα.

**Δεύτερο εύρημα, ίδια οικογένεια: η αλλαγή καρτέλας στο validation ήταν ΝΕΚΡΟΣ ΚΩΔΙΚΑΣ.**
Όταν η επικύρωση αποτύγχανε σε πεδίο άλλης καρτέλας, ο χρήστης βίωνε «το κουμπί δεν κάνει τίποτα».
Το `handleSaveEdit` **καλούσε** `setActiveTab(errorTab)` — αλλά η τιμή κατέληγε στο `defaultTab` του
`StateTabs`, το οποίο διαβάζεται **μία φορά** στον αρχικοποιητή του `useState`· κάθε μεταγενέστερη
αλλαγή αγνοούνταν σιωπηλά. Το `StateTabs` υποστήριζε ήδη ελεγχόμενο `value` — το `FormTabsShell`
απλώς **δεν το περνούσε ποτέ**. Και το `focusField` έψαχνε το πεδίο αμέσως (`setTimeout 0`): το Radix
κρατά όλα τα panels προσαρτημένα και κρύβει τα ανενεργά με CSS, άρα το `querySelector` **έβρισκε** το
στοιχείο, αλλά `focus()`/`scrollIntoView()` σε κρυμμένο στοιχείο δεν κάνουν **τίποτα**.

Διόρθωση: προαιρετικό `activeTab` (ελεγχόμενο) στο `FormTabsShell` → `StateTabs value`, με δικλείδα
ότι άγνωστο id **αγνοείται** (αλλιώς το Radix αφήνει τον πάνακα κενό — συμβαίνει όταν το αποθηκευμένο
id ανήκει σε άλλον τύπο επαφής: `addresses` εταιρείας vs `address` φυσικού προσώπου). Το `focusField`
περιμένει πλέον σε rAF μέχρι το πεδίο να γίνει **ορατό** (`offsetParent !== null`, έως ~330ms).

**Επαληθευμένο στην οθόνη** (η μόνη έγκυρη απόδειξη για ελάττωμα προβολής):

| Σενάριο | Πριν | Μετά |
|---|---|---|
| Save από κυλισμένη καρτέλα Διευθύνσεων | κομμένη λίστα, χωρίς καρτέλες/επικεφαλίδα | κορυφή· «Διευθύνσεις (8)» + **και οι 8** ορατές |
| Save με άκυρο «Όνομα» από την καρτέλα Διευθύνσεων | καμία αντίδραση πλην toast | **αυτόματη** μετάβαση στα «Βασικά Στοιχεία» + εστίαση + inline σφάλμα |

**Τι ΔΕΝ διορθώθηκε και καταγράφεται ρητά:** σε **δύο** πρώιμες εκτελέσεις παρατηρήθηκε πλήρης
απώλεια της **επιλογής** επαφής μετά το save (κενή κατάσταση «Δημιουργία Επαφής»). Με εγκατεστημένο
ανιχνευτή στο `setSelectedContact` **δεν αναπαράχθηκε σε καμία** από τις επόμενες έξι εκτελέσεις,
οπότε **δεν αποδίδεται αιτία** — μένει ανοιχτό. Ο τοαster είναι `position: fixed` (μετρημένο), άρα
η υπόθεση «το μήνυμα βγαίνει εκτός οθόνης» **δεν** ισχύει· αυτό που έβγαινε εκτός οθόνης ήταν η
**επικεφαλίδα**.

**Χρέος που καταγράφεται:** ο πίνακας `VALIDATION_FIELD_TAB` είναι χειρόγραφος ενώ τα section
registries (`individual-config`, `company-gemi/section-registry`, `service-config`) δηλώνουν ήδη
`fields[]` ανά ενότητα — μπορεί να **παραχθεί**. Σήμερα καλύπτει όλα τα παραγόμενα κλειδιά (η
`contact-validation` δεν βγάζει ποτέ πεδία διεύθυνσης), οπότε δεν αντικαταστάθηκε: θα ήταν αλλαγή
χωρίς διαφορά συμπεριφοράς πάνω σε **τρία** ανόμοια σχήματα ρύθμισης, με το id της ενότητας
διευθύνσεων να διαφέρει ανά τύπο επαφής. Γίνεται υποχρεωτικό μόλις προστεθεί επικύρωση διεύθυνσης.

**Tests:** 10 νέα, **mutation-verified** (με επαναφορά της διόρθωσης πέφτουν 2 στο
`details-container-scroll-reset`). 161/161 σε 20 suites· `jscpd:diff` καθαρό σε 10 αρχεία.
**ΟΧΙ tsc (N.17).**

### D20 — Κενές διευθύνσεις δεν φτάνουν στη βάση· η επιλογή επιβιώνει σε remount

**RESOLVED — 2026-07-26, Opus 5 (δύο ανεξάρτητα ελαττώματα, κοινός κύκλος)**

#### Μέρος Α — η απώλεια επιλογής ΜΕΤΡΗΘΗΚΕ: το σύνορο είναι το `<Suspense>`

Ανιχνευτής σε `sessionStorage` (επιβιώνει remount) που κατέγραφε **και την τιμή** της επιλογής:

```
PAGE_STATE_UNMOUNT[sel=cont_54fa61f9-…]  @356122
PAGE_STATE_MOUNT  [sel=null]             @356173   ← 51ms, hmr: 0
```

Τρία οριστικά συμπεράσματα: (α) η κατάσταση **πετιέται**, δεν μηδενίζεται — σε καμία εκτέλεση
δεν καταγράφηκε σκόπιμο `setSelectedContact(null)`· (β) ο `ProtectedRoute` **παρέμεινε
προσαρτημένος** ⇒ το υποδέντρο πετάχτηκε από το `<Suspense>` του `src/app/contacts/page.tsx:11`,
που τυλίγει **ΟΛΗ** τη σελίδα· (γ) **το save είναι αθώο** — ένα περιστατικό συνέβη ενώ γραφόταν
το πεδίο «Οδός», χωρίς κανένα «Αποθήκευση». Η λίστα επιβιώνει επειδή το `contactsCache` είναι
module-level (ADR-300)· η επιλογή όχι, επειδή είναι React state.

**Δεν αποδίδεται** ποιος απόγονος κάνει suspend — ο δείκτης στο fallback δεν πιάστηκε σε πράξη.
Η διόρθωση δεν εξαρτάται από την απάντηση.

**Διόρθωση (δικλείδα):** νέο SSoT `src/utils/contacts/contact-session-storage.ts` — αρχικοποιητής
που ψάχνει **μόνο** το module cache (καμία ανάκτηση ⇒ κανένα flash) + **ΕΝΑ** σημείο γραφής
(effect πάνω στο `selectedContact?.id`). Κάθε σκόπιμος μηδενισμός περνά από το ίδιο state, άρα
**κανένας handler δεν άλλαξε** και μια διαγραμμένη επαφή δεν μπορεί να «επανέλθει» — αυτό ήταν το
πραγματικό ρίσκο, χειρότερο από το αρχικό ελάττωμα. Ονομασία `contact-selected`, ίδιο σχήμα με το
υπάρχον `contact-tab-<id>`.

⚠️ **Η κύρια διαδρομή (στένεμα του Suspense) ΔΕΝ έγινε** — βλ. «Ανοιχτό» παρακάτω.

#### Μέρος Β — κενές διευθύνσεις: τρεις παραγωγοί, μία δικλείδα

Επαληθεύτηκε **στη βάση** (MCP firestore): η «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.» — **δοκιμαστική**
εγγραφή (επιβεβαίωση Giorgio 2026-07-26· η αρχική καταγραφή του handoff την περνούσε για
πραγματικό δεδομένο) — έχει ολότελα κενή έδρα σε **δύο** σημεία (`addresses[0]` **και**
`customFields.companyAddresses[0]`, με `country:"GR"`, `type:"work"`). **Δεν την πρόσθεσε χρήστης:
τη συνθέτει ο κώδικας και τη γράφει αυτούσια** — αυτό ισχύει ανεξάρτητα από το αν η συγκεκριμένη
επαφή είναι δοκιμαστική· ο παραγωγός είναι ο ίδιος για κάθε επαφή.

| # | Παραγωγός | Διόρθωση |
|---|-----------|----------|
| A | `addBranch()` έβαζε **αμέσως** κενό αντικείμενο στο `formData` | **Draft promotion**: η νέα γραμμή ζει τοπικά· προάγεται μόνο όταν αποκτήσει πρώτη πραγματική τιμή. Ακύρωση/φυγή ⇒ δεν υπήρξε ποτέ. |
| B | Η **συνθετική** κενή έδρα (`effectiveAddresses`) έρρεε στο `onChange` | Placeholder **μόνο στο render** — το σημείο γραφής κλαδεύει πριν γράψει. |
| C | Παλαιά μολυσμένα έγγραφα | Δικλείδα στο form→domain όριο ⇒ καθαρίζουν στο επόμενο save **που αφορά διευθύνσεις**, χωρίς μετάπτωση. |
| **D** | **Το AI append (`contact-handler`) κρατούσε την κενή εγγραφή** | **Δεν ήταν στον χάρτη του handoff — βρέθηκε με audit όλων των writers.** Το `isPrimary: currentAddresses.length === 0` έδινε στη νέα, **πραγματική** διεύθυνση `isPrimary:false` όταν προϋπήρχε κενή ⇒ η επαφή έμενε με **κενή κύρια** διεύθυνση. Τώρα οι κενές φιλτράρονται πριν το append. |

**Ο 4ος παραγωγός επέβαλε γενίκευση του κατηγορήματος**: το AI path δουλεύει με `AddressInfo`
(αποθηκευμένο παράγωγο), όχι `CompanyAddress` (φόρμα) — **δύο σχήματα, δύο λεξιλόγια ιεραρχίας**
(`municipalityName` ↔ `municipality`). Το **ερώτημα** όμως είναι ΕΝΑ, οπότε το ίδιο κατηγόρημα
δέχεται και τα δύο (ένωση πεδίων). Δεύτερη συνάρτηση θα διαφωνούσε σιωπηλά για το τι μετράει ως
περιεχόμενο — ακριβώς η κατηγορία ADR-584 που βλέπει μόνο το jscpd.

**Writers που ελέγχθηκαν και ΔΕΝ χρειάζονται αλλαγή** (τεκμηριώνεται για να μην ξαναψαχτούν):
`invoice-auto-enrichment` (αντικαθιστά, και μόνο όταν υπάρχει περιεχόμενο)· `ContactsList` CSV
import (γράφει μόνο υπό `street || city`)· `useClearCompanyHqAddress` (παράγει κενή έδρα **σκόπιμα**
— είναι το κουμπί «Καθαρισμός», και η δικλείδα την κλαδεύει σωστά στο save)·
`updateExistingContact` (τροφοδοτεί validation/photo-diff/name-cascade, **δεν** είναι διαδρομή
γραφής — γράφει το `enterpriseDiff` από το `convertToEnterpriseStructure`).

**Επαληθεύτηκε ότι το κλάδεμα φτάνει στη ΒΑΣΗ** (μάθημα D18.1, όχι μόνο στο output της συνάρτησης):
`sanitizeContactForUpdate` μεταφράζει κενό array σε `fieldsToDelete` → `deleteField()` ⇒ το στάσιμο
`addresses` **αφαιρείται** από το έγγραφο αντί να μείνει με την κενή εγγραφή.

**Νέο SSoT** `src/utils/contacts/contact-address-blankness.ts`: `isBlankContactAddress` (ένα
γεμάτο πεδίο αρκεί· `type`/`customLabel`/`country` **δεν** μετρούν ως περιεχόμενο — αλλιώς η
εγγραφή της ALFA θα περνούσε ως «γεμάτη» και η δικλείδα θα ήταν διακοσμητική) και
`pruneBlankContactAddresses`.

**Ο κανόνας κλαδέματος σέβεται τη θετική αναλλοίωτη του ADR-319**: κενά υποκαταστήματα φεύγουν
πάντα· η κενή **έδρα** φεύγει **μόνο** αν δεν απομένει κανένα υποκατάστημα. Αλλιώς το υποκατάστημα
θα ανέβαινε στη θέση 0 και θα εμφανιζόταν ως έδρα στο επόμενο άνοιγμα — παλινδρόμηση χειρότερη από
την κενή γραμμή.

**Η δικλείδα ζει σε ΕΝΑ σημείο**: `EnterpriseContactSaver.convertToEnterpriseStructure`, ακριβώς
πριν χωρίσουν οι δρόμοι της αυθεντικής λίστας και του παράγωγου `addresses[]` ⇒ **δεν μπορούν να
αποκλίνουν**. ⛔ **ΟΧΙ** στους `sanitizeContactData`/`sanitizeContactForUpdate` (D18.1, ρητή
προειδοποίηση «ΜΗ ΑΓΓΙΖΕΙΣ»). Καμία επικύρωση, κανένα μπλοκάρισμα save: **μερικώς** συμπληρωμένες
διευθύνσεις είναι θεμιτά δεδομένα.

**Ειλικρίνεια για την έρευνα:** δεν υπάρχει αυθεντικό δόγμα «μεγάλων παικτών» — το **Salesforce
επιτρέπει** κενές διευθύνσεις. Ο σχεδιασμός στέκει στις πρώτες αρχές και στη λίστα N.7.2, **όχι**
σε επίκληση αυθεντίας.

#### Boy-scout (N.0.2, N.11)
- `ariaLabel="Διευθύνσεις & Υποκαταστήματα"` = ωμό ελληνικό σε JSX που **κανένα** gate δεν βλέπει
  (ο scanner ψάχνει μόνο `defaultValue:` και `toast(`) → νέο κλειδί `addressesSection.fullscreenAriaLabel` σε el+en.
- `useContactsPageState`: **δύο** προϋπάρχοντα δίδυμα ενοποιήθηκαν (`finishBulkContactAction`,
  `resolveBulkTargetIds`) — τα βρήκε το `jscpd:diff`, όχι το `ssot:discover` (name-based ⇒ τυφλό).

#### N.7.1 — εξαγωγή, όχι περικοπή
Το `useContactsPageState` έφτασε τις **520** γραμμές. Εξήχθη το φιλτράρισμα σε νέο
`contactsPageFilters.ts` (καθαρή συνάρτηση, μηδέν state, αδελφό του `contactDashboardStats.ts`)
→ **459** γραμμές. Δύο imports έμειναν ορφανά και αφαιρέθηκαν (`CONTACT_TYPES`, `normalizeToDate`).
Η εξαγωγή είναι **συμπεριφορικά ουδέτερη** και κλειδώνεται από 16 tests μεταγραμμένα από τον
προ-εξαγωγής κώδικα — συμπεριλαμβανομένης της γωνίας «άγνωστη κάρτα δεν φιλτράρει τίποτα», που
στο παλιό `switch` προέκυπτε από την **απουσία** `default`.

#### Verification
**73 νέα tests** (13 session-storage + 36 blankness/δικλείδα/2ο σχήμα + 6 draft promotion +
16 φίλτρα + 2 AI append), **295/295 σε 23 suites** + **1181/1181 σε 73 suites ai-pipeline** (N.10).
**Mutation-verified ×4**: αφαίρεση του `removeItem` → 2 πτώσεις· αφαίρεση του prune από τον saver
→ 3· επαναφορά του παλιού `addBranch` → 6· αφαίρεση του φίλτρου κενών στο AI append → 1. Όλα
reverted. ⚠️ Το 4ο mutation **πέρασε αρχικά αθόρυβα** (1179/1179) — απόδειξη ότι η διόρθωση ήταν
ακάλυπτη· τα 2 tests γράφτηκαν γι' αυτό ακριβώς. Το round-trip μέρος περνά από τον **πραγματικό** saver και ελέγχει **και τους
δύο** πίνακες (μάθημα D18.1: πράσινα unit tests δεν αποδεικνύουν ότι το κλάδεμα τρέχει στο σωστό
σημείο). `jscpd:diff` **0 clones** σε 11 αρχεία (2 γύροι). Registry: 2 νέα modules με patterns που
δεν χτυπούν υπάρχοντα αρχεία ⇒ **καμία ανάγκη για `ssot:baseline`**. **ΟΧΙ tsc (N.17).**

#### Ανοιχτό
- 🔴 **Κύρια διαδρομή Π1 — στένεμα του Suspense: ΔΕΝ έγινε.** Το μοτίβο
  `<Suspense fallback={<StaticPageLoading/>}><XPageContent/>` επαναλαμβάνεται σε **5** σελίδες
  (`contacts`, `spaces/parking`, `spaces/storage`, `spaces/properties`, `properties`). Για τις
  Επαφές το εύρος είναι **ένα** call site (`useContactsPageState.ts:54`), αλλά **ένα κεντρικό
  `SearchParamsBoundary` αγγίζει 5 σελίδες / 2+ domains ⇒ N.8, θέλει απόφαση Giorgio.** Χωρίς αυτό,
  ένα suspend εξακολουθεί να πετάει **μισοσυμπληρωμένη φόρμα** — η δικλείδα σώζει μόνο την επιλογή.
- ⚠️ **browser-verify εκκρεμεί** (κανένα test δεν αποδίδει την πραγματική σελίδα): (α) επιλογή →
  Fast Refresh με **αλλαγή σχήματος hooks** → η επιλογή πρέπει να επιβιώνει· (β) «Νέα Διεύθυνση»
  → Ακύρωση → **καμία** νέα γραμμή στη φόρμα και τίποτα στη βάση.
- ⚠️ **Η δικλείδα τρέχει μόνο όταν το save περιλαμβάνει διευθύνσεις.** Το `formData` είναι
  **dirty diff** (ADR-323): αν ο χρήστης δεν αγγίξει τις διευθύνσεις, το `companyAddresses` λείπει
  από το payload και η κενή εγγραφή επιβιώνει μέχρι το επόμενο save **που τις αφορά**. Σκόπιμο —
  δεν σβήνουμε ό,τι δεν άγγιξε ο χρήστης — αλλά η διατύπωση «καθαρίζουν στο επόμενο save» ήταν
  ανακριβής και διορθώνεται εδώ.

---

### D20.1 — Το `null` της επιλογής έχει ΔΥΟ σημασίες· η δικλείδα έσβηνε το ίδιο της το κλειδί

**Πώς βρέθηκε.** Ζωντανή επαλήθευση του D20 στον browser (το Μέρος Α είχε κλείσει με **13 πράσινα
tests και μηδέν ζωντανή εκτέλεση** — ακριβώς το μοτίβο της D18.1). Ανιχνευτής στον αρχικοποιητή
και στο effect γραφής, σε **φρέσκο document** (`navType: reload`) στο dev:

```
INIT  { stored:"cont_54fa61f9-…", cacheLen:0, hasLoaded:false, result:null }  @32877
WRITE { id:null, contactsLen:0 }                                              @33202  ← 325ms μετά
sel: null   ← το κλειδί σβήστηκε πριν φτάσουν τα δεδομένα
```

**Η αιτία.** Ο αρχικοποιητής βρίσκει το **σωστό** αποθηκευμένο id, αλλά το module cache είναι ακόμη
κενό ⇒ `restoreSelectedContact` επιστρέφει `null` — **όχι** επειδή η επαφή λείπει, αλλά επειδή δεν
έχει έρθει ακόμη. Το «ΕΝΑ σημείο γραφής» μετέφραζε αυτό το `null` σε `removeItem`, οπότε όταν 325ms
αργότερα έφταναν οι επαφές **δεν υπήρχε πια id να επαναφερθεί**. Η δικλείδα αυτοκαταστρεφόταν
ακριβώς στο σενάριο για το οποίο χτίστηκε.

**Γιατί κανένα test δεν το έπιασε.** Και τα 13 δίνουν τη λίστα **έτοιμη** στον αρχικοποιητή. Κανένα
δεν εκφράζει την **ακολουθία** «κενή λίστα στο mount → η λίστα φτάνει μετά». Το κενό ήταν μάλιστα
γραμμένο αυτολεξεί στο doc-comment («και όταν η λίστα δεν έχει φορτώσει ακόμη») — **περιγράφηκε ως
συμπεριφορά αντί να αναγνωριστεί ως ελάττωμα**.

**Η διόρθωση.** Η διάκριση παίρνεται **όταν υπάρχει η πληροφορία**, όχι πριν:

| Συνάρτηση | Ρόλος |
|-----------|-------|
| `isSelectionWriteAllowed(id, listSettled)` | Φρουρά γραφής: `null` **πριν** καθίσει η λίστα = «δεν ξέρω ακόμη» ⇒ καμία γραφή. Μετά = όντως αποεπιλογή ⇒ σβήσε. |
| `resolveLateSelectionRestore(contacts)` | Δεύτερη και τελευταία ευκαιρία, με φορτωμένη λίστα: `restored` / `garbage` / `nothing`. Μόνο το `garbage` δικαιολογεί σβήσιμο. |
| `useSelectedContactPersistence` | **ΕΝΑΣ** ιδιοκτήτης κύκλου ζωής (N.7.2 #7) — γραφή **και** καθυστερημένη επαναφορά μαζί, ιδεμποτεντικά (μία προσπάθεια ανά mount, αλλιώς διαγραμμένη επαφή θα «επανερχόταν» σε κάθε ανανέωση λίστας). |

Οι δύο πρώτες είναι **καθαρές αποφάσεις** και μένουν στο `contact-session-storage` (ελέγξιμες χωρίς
React)· το hook ζει στο `src/hooks/contacts/`.

**Γνωστό όριο, καταγράφεται αντί να «λυθεί»**: αποεπιλογή μέσα στο παράθυρο **πριν** καθίσει η λίστα
(~300ms) θα αναιρεθεί από την επαναφορά. Το tradeoff είναι ένα render window έναντι διαρροής
άσχετης κατάστασης (`creationMode`) σε SSoT module.

#### Verification
**+8 tests** (13 → **21/21**), **mutation-verified**: αντικατάσταση της φρουράς με `return true` →
**3 πτώσεις**, reverted. Σουίτα επαφών **225/225 σε 18 suites**. `jscpd:diff` καθαρό σε 4 αρχεία.
**ΟΧΙ tsc (N.17).**

**Ζωντανή επαλήθευση στο production** (`nestorconstruct.gr`, 2026-07-26 — το dev περιβάλλον είχε
μπλοκάρει το `sessionStorage` με `SecurityError` μετά από επανειλημμένα reload, άρα οι τελευταίες
τοπικές μετρήσεις ήταν άκυρες):
- 🟢 **(α) η επιλογή επιβιώνει σε πραγματικό reload** — κάρτα με highlight, πλήρες πάνελ.
- 🟢 **(β) «Νέα Διεύθυνση» → Ακύρωση** — ο μετρητής μένει «Διευθύνσεις (9)», **καμία** κενή γραμμή
  στη φόρμα, τίποτα στη βάση. Το draft promotion δουλεύει.
- ⚠️ **Το ελάττωμα του ίχνους ΔΕΝ αναπαράγεται στο production**: εκεί η λίστα είναι διαθέσιμη στον
  αρχικοποιητή, οπότε η επαναφορά πετυχαίνει με την πρώτη. Η διόρθωση αφορά το **αποδεδειγμένο
  παράθυρο** όπου δεν είναι (κρύα cache, αργό δίκτυο, πρώτη επίσκεψη) — τότε το παλιό effect έσβηνε
  το κλειδί **μόνιμα**. Δεν δηλώνεται ότι το production ήταν σπασμένο.
- 🟡 **Παρατηρήθηκε στη βάση**: η «Δοκιμή Δ18» έχει ακόμη **κενή** 9η διεύθυνση («—»). Αναμενόμενο
  κατά το §Ανοιχτό του D20 (dirty diff) — θα φύγει στο επόμενο save **που αφορά διευθύνσεις**.

---

### D21 — Η επιλεγμένη επαφή ζει στο URL· ο δεύτερος μηχανισμός καταργήθηκε
**RESOLVED — 2026-07-26**

#### Το ελάττωμα δεν ήταν bug· ήταν **διπλότυπο αρμοδιότητας**

Το ερώτημα «ποια επαφή είναι ανοιχτή;» απαντιόταν από **δύο** ανεξάρτητους μηχανισμούς:

| # | Μηχανισμός | Ρόλος |
|---|-----------|-------|
| A | `?contactId=` στο URL | **μόνο ανάγνωση** — εξωτερικά deep links |
| B | `contact-selected` σε `sessionStorage` (D20/D20.1) | δικλείδα επιβίωσης σε remount |

Κανένα gate δεν το έβλεπε: δεν είναι διπλότυπο **κώδικα** (το jscpd/CHECK 3.28 δεν το πιάνει),
είναι διπλότυπο **αρμοδιότητας**. Το Β μπήκε για να καλύψει αδυναμία που το Α δεν έχει — και
γέννησε τη δική του σειρά ελαττωμάτων, με κορυφαίο το D20.1 (το `null` με δύο σημασίες, η
δικλείδα που έσβηνε το ίδιο της το κλειδί 325ms πριν φτάσουν τα δεδομένα).

**Το URL δεν χρειάζεται δικλείδα.** Επιβιώνει reload, remount, Fast Refresh, back/forward,
bookmark, share και restore-tab **δωρεάν**. Άρα ολόκληρη η κατηγορία ελαττωμάτων του Β παύει να
υπάρχει — δεν διορθώνεται, **εξαφανίζεται**. Επιπλέον η κατάσταση γίνεται μοιράσιμη: το «άνοιξε
αυτή την επαφή» είναι πλέον σύνδεσμος.

Δεν εφευρέθηκε μοτίβο — **επεκτάθηκε υπάρχον**: το `viewport-persistence.ts` (ADR-400) ήδη κρατά
το viewport του DXF Viewer στο URL (`/dxf/viewer?s=…&ox=…&oy=…&lvl=…`).

#### 🔴 Το εύρημα που ανέτρεψε τον σχεδιασμό: ο συγχρονισμός του Next ισχύει **μόνο στο production**

Η τεκμηρίωση του Next είναι ρητή:

> «`pushState` and `replaceState` calls integrate into the Next.js Router, allowing you to sync
> with `usePathname` and `useSearchParams`.» — *Linking and Navigating → Native History API*

**Μετρήθηκε ότι αυτό ισχύει μόνο στο production build** (Next 15.5.22). Το **ίδιο ακριβώς**
probe — σκέτο `history.replaceState` με `?filter=Δοκ`, χωρίς καθόλου router:

| Περιβάλλον | Αποτέλεσμα |
|---|---|
| **production** (`nestorconstruct.gr`) | ✅ banner φίλτρου, λίστα **4→2**, η ανοιχτή καρτέλα + το scroll **επιβίωσαν** |
| **dev server** (turbopack) | ❌ **καμία** επανασχεδίαση |

Η πρώτη υλοποίηση στηρίχθηκε σε αυτή την υπόσχεση (`useSearchParams()` για ανάγνωση) και
**έσπασε τοπικά**: ο Giorgio ανέφερε «πατάω πάνω στις κάρτες και δεν ανοίγουν». Το URL γραφόταν
σωστά, αλλά η ανάγνωση ήταν κουφή· και ο φρουρός ταυτότητας (ίδιο id ⇒ καμία εγγραφή) έκανε το
κόλλημα μόνιμο.

**Απόφαση: η αντιδραστικότητα δεν ανατίθεται στον router — παράγεται.** Το
`@/lib/url-query-state` τυλίγει **μία φορά** τα `pushState`/`replaceState` (καλεί πρώτα την
αρχική, άρα ο Next κάνει ό,τι κάνει) και ακούει `popstate`· ο hook καταναλώνει μέσω
`useSyncExternalStore`. Έτσι πιάνονται **και** οι δικές μας γραφές **και** οι πλοηγήσεις του
router. Είναι ο ίδιος μηχανισμός που χρησιμοποιεί εσωτερικά το `nuqs` (MIT) — **χωρίς** την
εξάρτηση, που δεν εγκρίθηκε.

> ⚠️ Μάθημα γενικής ισχύος: **μια συμπεριφορά που δουλεύει μόνο στο production δεν είναι λύση —
> είναι παγίδα** για τον επόμενο που θα τη δοκιμάσει τοπικά και θα τη νομίσει σπασμένη.

#### Η δεύτερη σημασιολογική σύγκρουση: το `?contactId=` σήμαινε **δύο** πράγματα

Το `contactsPageFilters.ts` είχε `if (contactIdParam) return true` — δηλαδή η **παρουσία** του
param απενεργοποιούσε **όλα** τα φίλτρα για **όλες** τις επαφές. Στεκόταν όσο το param έμπαινε
μόνο από εξωτερικά deep links· από τη στιγμή που το URL έγινε πηγή αλήθειας της επιλογής, **κάθε
κλικ θα σκότωνε την αναζήτηση**. Η πρόθεση ήταν πάντα η στενή: *μην κρύβεις αυτό που είναι
ανοιχτό* ⇒ `if (contact.id === selectedContactId) return true`.

Ίδια σύγκρουση στο banner «Προβολή πελάτη X — Επιστροφή»: κρεμόταν από την παρουσία του param,
οπότε θα εμφανιζόταν σε κάθε κλικ. Το ερώτημα που πραγματικά απαντά δεν ήταν ποτέ «είναι κάτι
επιλεγμένο;» αλλά «**χρειάζεται ο χρήστης δρόμο επιστροφής;**» ⇒ `arrivedViaDeepLink`.

#### Αρχιτεκτονική

```
?contactId=<id>                                  ← Η ΜΟΝΗ πηγή αλήθειας
        │
        ├─ γραφή ──→ useSelectedEntityUrlState.setSelectedId
        │                └─ replaceUrlSearchParams  (χωρίς πλοήγηση, διατηρεί άσχετα keys+hash+history.state)
        │
        └─ ανάγνωση ─→ useSyncExternalStore(subscribeToUrlQuery, getUrlQuerySnapshot)
                         │
                         └─ selectedContact = contacts.find(id) ?? detachedContact   ← ΠΑΡΑΓΩΓΟ
```

Η **επαφή** δεν αποθηκεύεται πλέον· **παράγεται** από τη λίστα. Αυτό διέγραψε από μόνο του:
- το effect «Sync selectedContact when contacts list refreshes» (ήταν χειροκίνητος συγχρονισμός),
- τη δεύτερη εγγραφή στον realtime handler,
- την εγγραφή επιλογής στο `handleContactUpdatedInPlace` και στο `loadSpecificContact`.

`detachedContact` = η τελευταία γνωστή **μορφή** μιας επαφής που ήρθε από deep link και δεν χωράει
στη συνδρομή (`limitCount: 1000`). **Δεν** είναι δεύτερη πηγή αλήθειας — το *ποια* επαφή το λέει
πάντα το URL· αυτό κρατά μόνο το *πώς δείχνει*, ώστε το πάνελ να μην αδειάζει αν το επόμενο
στιγμιότυπο του Firestore την πετάξει έξω.

#### Το μάθημα του D20.1 μεταφέρθηκε **αυτούσιο**

Το param καθαρίζεται **μόνο** με θετική απόδειξη ανυπαρξίας: λίστα καθισμένη (`!isLoading`)
**ΚΑΙ** απευθείας ανάκτηση που γύρισε άδεια. Η διαφορά με τη δικλείδα του D20 είναι ότι εδώ μια
πρόωρη λάθος απόφαση **δεν καταστρέφει τίποτα** — το id ζει στο URL και κανένα μονοπάτι δεν
μπορεί να το σβήσει κατά λάθος.

#### Τι καταργήθηκε

- `src/utils/contacts/contact-session-storage.ts` + το test του (21 tests)
- `src/hooks/contacts/useSelectedContactPersistence.ts`
- 2 registry modules (`contact-session-storage`, `selected-contact-persistence`)

Ο κώδικας του D20.1 έγινε νεκρός — **και σωστά**: ήταν η σωστή διόρθωση ενός λάθους σχεδιασμού,
όχι λόγος να τον κρατήσουμε. Η απαγόρευση του κλειδιού `contact-selected` **επιβιώνει** ως
forbidden pattern στο νέο module, ώστε ο μηχανισμός να μην μπορεί να επιστρέψει.

#### Τι προστέθηκε

- `src/lib/url-query-state.ts` — ο **ΕΝΑΣ** γραφέας query state (+ registry module)
- `src/hooks/useSelectedEntityUrlState.ts` — το **ΕΝΑ** δοχείο επιλογής, γενικό ως προς το
  param name (+ registry module)
- `src/components/contacts/page/useSelectedContactAvatarRefresh.ts` — ό,τι απέμεινε από τον
  καταργημένο συγχρονιστή

#### Παράπλευρες κεντρικοποιήσεις (N.0.2 / N.18)

- `viewport-persistence.ts` (ADR-400) + `camera3d-persistence.ts` **delegate** πλέον στο νέο
  κοινό primitive αντί να το ξαναγράφουν. Επίσης ενοποιήθηκε το `applyViewportToParams` — οι
  τέσσερις `set` ήταν δίδυμες σε δύο συναρτήσεις (το jscpd το επιβεβαίωσε).
- `useReportBuilder.ts` έκανε `replaceState(null, …)` — **έσβηνε το `history.state` του App
  Router** και το hash. Πέρασε στο `replaceUrlQueryString`.
- `ContactsPageContent.tsx`: δύο προϋπάρχοντες κλώνοι (props της λίστας ×2, κουμπί διαγραφής ×2).

#### Επαλήθευση

- **Ζωντανά (dev)**: επιλογή ✅ · εναλλαγή ✅ · reload → επιβίωση **με** την ανοιχτή καρτέλα ✅ ·
  banner εμφανίζεται σε άφιξη και **σβήνει** μετά από κλικ χρήστη ✅ · καμία προειδοποίηση
  hydration ✅
- **Ζωντανά (production, Φάση 0)**: **κανένα remount** κατά την επιλογή + εναλλαγή lazy καρτέλας
  (άγκυρα DOM παρέμεινε συνδεδεμένη). ⇒ Το **Π1 δεν αναπαράγεται στην παραγωγή** και το
  «στένεμα Suspense» **δεν** χρειάστηκε. Ο ισχυρισμός «το Suspense πετάει τη σελίδα» παραμένει
  **αναπόδεικτος** (ο παλιός ανιχνευτής HMR ήταν τυφλός στο turbopack).
- **Tests**: 80/80 στις θιγμένες σουίτες· 25 νέα (13 `url-query-state`, 12 `useSelectedEntityUrlState`)
  + 7 `useSelectedContactAvatarRefresh` + 3 νέα στο `contactsPageFilters`. `jscpd:diff` καθαρό.

#### Ανοιχτό

- Το `useEntityPageState` (ADR-203: Projects/Buildings/Parking/Storages) **διαβάζει** το
  `?<entity>Id=` αλλά δεν το **γράφει** ποτέ — ίδιος μισός μηχανισμός με τον προ-D21 κώδικα των
  Επαφών. Ο νέος hook είναι ήδη γενικός ως προς το param name, οπότε η υιοθέτηση είναι μηχανική.
  **Δεν** έγινε εδώ: άλλο εύρος, άλλη απόφαση.

---

### D10 — Phase split granularity
**RESOLVED — 11 phases, 1 phase per session, handoff-driven**
- Mandate Giorgio: clean context per session, no noise
- Dopo ogni phase: handoff template paste-able per nuova session
- Self-contained: nuova session non richiede memoria della precedente, solo l'handoff

---

## 6. Files inventory (final estimate)

### Layer 1+2 (Engine + Service) — Phase 0
- 1 NEW types file
- 2 MODIFY (engine, service)
- 1 NEW test

### Layer 3 (State machine) — Phase 1
- 2 NEW (machine, transitions)
- 1 NEW helper (diffAddressFields)
- 1 NEW test

### Layer 4 (Hooks) — Phase 1+2
- 6 NEW hooks
- 2 NEW helpers (computeSuggestionTriggers, rankSuggestions)
- 3-4 NEW tests

### Layer 5 (Presentational) — Phase 3+4
- 10 NEW components
- 1 MODIFY (AddressMapStatusChip)
- 2 NEW tests
- 2 MODIFY i18n (~30 keys total)

### Layer 6 (Coordinator) — Phase 5
- 3 NEW (AddressEditor, Context, types)
- 1 NEW barrel export
- 1 NEW integration test
- Demo page upgrade

### Layer 7 (Migration) — Phase 6+7+8
- ~20 MODIFY across all 7 domains

### Layer 8 (Telemetry + Hierarchy) — Phase 9
- 5 NEW files
- 4 MODIFY (rules, indexes, collections, enterprise-id)
- 2-3 NEW tests

### Layer 9 (Hardening) — Phase 10
- A11y audit + adjustments (~5 MODIFY)
- ADR final lock
- E2E test sweep

**Total estimate: ~50-55 files** (NEW + MODIFY combined). Distribuiti in 11 phases.

---

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| **Performance regression** — coordinator wraps form+map adding render cost | React.memo + selective context; before/after profile in Phase 5 |
| **Backward compat break** — 28 sites depend on existing AddressMap API | Old AddressMap preserved untouched fino al Phase 8; new editor è additive subdir |
| **i18n key explosion** — ~50 nuove keys | Namespace dedicato `addresses.editor.*`; aggiungere keys in baseline (CHECK 3.8) prima di compilare |
| **Telemetry storage cost** — 1 doc/correction × N users | TTL via Cloud Function (30 days retention default — configurabile) |
| **State machine complexity** — 9 phase states + transitions | Pure logic con 100% test coverage Phase 1; XState-style se serve |
| **Session token budget overflow** — phase non sta in 1 session | Phase 6+7+8 splittable in sub-sessions se needed; ADR § 4 modifiable |
| **i18n CHECK 3.13 (runtime resolver reachability)** | Use single useTranslation per file; ensure keys reachable via static analyzer |

---

## 8. Pre-commit Implications

- **CHECK 3.7 SSoT ratchet** — new module `address-editor` aggiunto a `.ssot-registry.json` Phase 5
- **CHECK 3.8 i18n missing keys** — ~50 nuove keys aggiunte a baseline Phase 3+4+9
- **CHECK 3.10 Firestore companyId** — `address_corrections_log` queries devono includere companyId (Phase 9)
- **CHECK 3.13 i18n resolver reachability** — Phase 3+4+10 audit
- **CHECK 3.14 Audit value catalogs** — N/A (no enum/catalog changes)
- **CHECK 3.15 Firestore index coverage** — 2 nuovi composite indexes Phase 9
- **CHECK 3.16 Firestore rules tests** — `address_corrections_log/` test in `firestore-rules-tests/` Phase 9
- **CHECK 3.17 Entity audit coverage** — N/A (telemetry separato da entity audit)
- **CHECK 3.18 SSoT discover** — geocoding-engine no duplicates (Phase 0 audit)
- **CHECK 3.23 Native HTML tooltip** — `AddressFieldTooltip` use Radix Tooltip, non `title=`

---

## 9. Acceptance Criteria — System-level

Sistema considerato `IMPLEMENTED` quando:

1. ✅ Tutti i 28 punti dell'app usano `<AddressEditor>` o consumano i suoi badge components
2. ✅ Activity log visibile in tutti gli edit forms con verbosity togglabile
3. ✅ Field-level badges visibili in tutti i 9 form fields
4. ✅ Reconciliation panel triggers correttamente su partial-match + drag conflict
5. ✅ Suggestions panel triggers correttamente su tutti i 4 trigger types
6. ✅ Confidence meter visibile su map status chip
7. ✅ Source label + freshness indicator visibili su tutte le read-only cards
8. ✅ Telemetry logging funzionante (Firestore docs creati con tenant isolation)
9. ✅ Undo/redo funzionante con sessionStorage persistence
10. ✅ Keyboard shortcuts tutti funzionanti
11. ✅ A11y audit passes (zero AA-level violations)
12. ✅ Test coverage > 90% su nuovi files
13. ✅ ADR-332 status `IMPLEMENTED`
14. ✅ adr-index.md auto-rigenerato

---

## 10. Implementation Tracking

| Phase | Status | Session Date | Commit Hash | Notes |
|-------|--------|--------------|-------------|-------|
| Phase 0 — ADR + Foundation Types | ✅ COMPLETED | 2026-05-05 | ADR + multi-result | Two commits: (a) ADR file proposed, (b) engine multi-result + types foundation. 11 tests green. Backward-compat preserved. |
| Phase 1 — State Machine + Core Hooks | ✅ COMPLETED | 2026-05-05 | TBD | 9 NEW + 1 MODIFY. Pure machine + 3 hooks (useAddressEditor, useAddressFieldStatus, useAddressActivity) + diff helper + demo page. 35 jest tests green. `nowMs` added to FIELD_EDITED/CORRECTION_APPLIED events for full reducer purity. |
| Phase 2 — Suggestions + Reconciliation Logic | ✅ COMPLETED | 2026-05-05 | 6a26512c | 7 NEW files. Helpers: `computeSuggestionTriggers` (4 triggers + priority + omit-field retry sequencer) + `rankSuggestions` (Haversine + weighted confidence/proximity score). Hooks: `useAddressSuggestions` + `useAddressReconciliation` + `useAddressUndo` (sessionStorage 60s TTL, 5 op kinds, max 20/side). 38 new jest tests green → 73 total. Suggestion triggers: zero-extra Nominatim cost on triggers 2/3/4. Decisions in reconciliation auto-reset on input change. |
| Phase 3 — Presentational Components Set 1 | ✅ COMPLETED | 2026-05-05 | TBD | 5 NEW components (AddressFieldTooltip, AddressFieldBadge, AddressConfidenceMeter, AddressSourceLabel, AddressFreshnessIndicator) + demo page `/demo/addresses-editor` (all states covered) + test file (7 tests). ~50 i18n keys added under `addresses.editor.*` (el + en). CHECK 3.23 compliant (Radix Tooltip only). A11y: role="meter" + aria-label on confidence meter, keyboard-accessible tooltips. NO hardcoded strings (N.11). |
| Phase 4 — Presentational Components Set 2 | ✅ COMPLETED | 2026-05-05 | TBD | 6 NEW files (AddressActivityLog, AddressReconciliationPanel, AddressSuggestionsPanel, AddressDiffSummary, AddressDragConfirmDialog, fieldLabels helper). 1 MODIFY (AddressMapStatusChip: +hasConflicts/hasSuggestions props). Demo page upgraded with all Phase 3+4 panels. ~45 i18n keys added per locale (activity/reconciliation/suggestions/diff/dragConfirm/fields/mapStatus). A11y: role="log" aria-live="polite" on activity log, role="listbox/option" on suggestions. Keyboard nav ↑↓ Enter Esc on suggestions panel. Radix Dialog for drag confirm (CHECK 3.23 compliant). NO push (CLAUDE.md N.(-1)). |
| Phase 5 — Coordinator AddressEditor | ✅ COMPLETED | 2026-05-05 | TBD | 4 NEW files (AddressEditor coordinator 431 LOC, AddressEditorContext, AddressEditor.types, index barrel). Semi-controlled form state (initialized from `value`; parent resets via `key` prop). Hooks wired: useAddressEditor + useAddressSuggestions + useAddressReconciliation + useAddressUndo. Keyboard Ctrl+Z/Ctrl+Shift+Z undo/redo via `useEditorKeyboard`. Context exposed via `useAddressEditorContext`. Panels: reconciliation (conflict/partial phases), suggestions (trigger+candidates), activity log (edit mode only), drag confirm dialog. Merge confirm step after reconciliation.resolved. 20 i18n keys added (coordinator.phase.*, undo.*). Demo `/demo/addresses-editor` upgraded: `<AddressEditorDemo>` live section at top + mode toggle + JSON preview. 1 NEW integration test (8 tests: form fields, onChange, disabled view, undo buttons, activity log, context). AddressMap untouched (backward compat). NO push (CLAUDE.md N.(-1)). |
| Phase 6 — Migration Wave 1: Contacts | ✅ COMPLETED | 2026-05-06 | TBD | 7 files changed. `AddressEditor`: forwardRef + `AddressEditorHandle.setPendingDrag()` + `formOptions.hideGrid` + `onDragApplied` callback. `index.ts`: exports `AddressFieldBadge`, `AddressSourceLabel`, `AddressEditorHandle`. `AddressWithHierarchy`: optional field badges (street/number/postalCode/city) from `AddressEditorContext` when inside coordinator. `AddressesSectionWithFullscreen`: HQ edit wrapped in `<AddressEditor ref={hqEditorRef}>` (activity log + reconciliation + suggestions + drag confirm dialog); HQ drag → `hqEditorRef.setPendingDrag()` replaces AlertDialog (ADR-277 pattern absorbed); `AddressSourceLabel source="derived"` on ADR-318 work addresses. `CompanyAddressesSection`: `BranchEditorWrapper` component wraps each branch edit with `<AddressEditor formOptions={{hideGrid:true}}>` + stable `useMemo` for resolved fields. NO push (CLAUDE.md N.(-1)). |
| Phase 7 — Migration Wave 2: Projects + Buildings | ✅ COMPLETED | 2026-05-06 | TBD | 6 files MODIFIED. `AddressFormSection` rewrite (controlled, `AddressWithHierarchy`, field badges). `LocationInlineForm` → `forwardRef<AddressEditorHandle>` + `AddressEditor` wrapper. `ProjectLocationsTab`: 3-mode drag routing (add-form / edit-form / view-mode) + view-mode `AddressDragConfirmDialog`. `BuildingAddressesEditor`: local state + `AddressEditor` + `editorRef`. `FrontageAddressCreateDialog`: `AddressWithHierarchy` + `AddressEditor`. i18n key `frontages.cityRequired` (el + en). Demo page updated. ALL ≤500 lines. |
| Phase 8 — Migration Wave 3: Showcase + Procurement + Read-only | ✅ COMPLETED | 2026-05-06 | TBD | 7 files MODIFIED + 3 NEW. **Type SSoT**: `AddressSourceType` moved to `geocoding-types.ts`, `editor/types.ts` re-exports. `ProjectAddress` extended (`source`/`verifiedAt`/`geocodingMetadata`, all optional). NEW `helpers/computeFreshness.ts` (pure, injectable clock; 24h/7d/30d Salesforce tiers). NEW `components/AddressCoordsBadge.tsx` (SSoT chip; eliminates 3× duplication). Barrel exports `AddressFreshnessIndicator`/`AddressCoordsBadge`/`computeFreshness` + `AddressSourceType`/`AddressFreshness`/`AddressFreshnessLevel`. `AddressCard`: enrichment row (source + freshness + coords) below block-side; `hideEnrichment` opt-out. `SharedAddressActionCard`: optional `source`/`verifiedAt`/`hasCoordinates` props + N.11 Boy Scout fix (5 hardcoded Greek default-props → `actionCard.*` i18n keys). `PODeliveryAddressField`: tracks picked `ProjectAddress` in local state, renders provenance badges below input; typing clears the picked-address tracking. NEW i18n keys (el+en): `card.coords.*`, `actionCard.*`, `procurement.selectedFromAddress`. NEW unit test `computeFreshness.test.ts` (12 tests). **Discrepancies vs §4**: (1) `AddressMapPicker.tsx` is NOT an edit form (dropdown for opening external map providers — no AddressEditor wrapper applies). (2) `AddressListCard`/`BuildingAddressesManualList` need no direct edits (consume `AddressCard` → enrichment propagates). (3) `ContactsList.tsx` mini-badges deferred to Phase 10 (require touching `ContactListCard` domain component). ALL ≤500 lines. NO push. |
| Phase 9 — Telemetry + Hierarchy Validation | ✅ COMPLETED | 2026-05-06 | TBD | 11 NEW + 5 MODIFY. NEW `address_corrections_log/` collection with `acl_<ulid>` enterprise id (N.6). NEW telemetry service (server-only, Admin SDK, 3-layer tenant isolation, payload validator). NEW API route `/api/geocoding/telemetry` (withAuth + withStandardRateLimit). NEW client hook `useAddressTelemetry` (timer + undo flag + fire-and-forget post). NEW pure helpers `hierarchyLookup` (DI interface + lazy loader for 20,721 ELSTAT entities), `postalCodeAutoFill` (Greek 5-digit validator + common-ancestor resolver for shared postal codes), `validateGreekHierarchy` (3-rule validator with NFD-normalised matching, i18n keys under `addresses.hierarchy.*`). MODIFY `firestore.rules` (new tenant-scoped read / server-only write block), `firestore.indexes.json` (+2 composite indexes), `coverage-manifest.ts` (CHECK 3.16). Tests: rules suite + 3 unit-test files (~25 cases). ALL files ≤500 lines (N.7.1 ✅). Google-level invariants explicit (proactive / idempotent / tenant-isolated / fire-and-forget). NO push (CLAUDE.md N.(-1)). |
| Phase 10 — Hardening + A11y + Keyboard + Final | ✅ COMPLETED | 2026-05-06 | TBD | Telemetry wiring (flush on drag/suggestion/reconciliation), Ctrl+Shift+R, autoFocus confirm dialog, Esc dismiss suggestions, i18n dismiss key, ContactListCard mini-badges, coordinatorHelpers.ts extraction. AddressEditor.tsx = 499 lines. Tests: 16 new tests (coordinatorHelpers). Telemetry wired in AddressesSectionWithFullscreen (contact) + FrontageAddressCreateDialog (project). ADR IMPLEMENTED + adr-index.md updated. |
| Post-10.a — Ιδιοκτησία πεδίου στο `SearchableCombobox` | ✅ COMPLETED | 2026-07-25 | TBD | **Live-observed bug**, όχι θεωρητικό. Το reverse-geocoding auto-fill έγραψε `Θεσαλονίκης` στον οικισμό· ο χρήστης εστίασε και πληκτρολόγησε `Θεσσαλονί` με τον δρομέα στο τέλος → τιμή `ΘεσαλονίκηςΘεσσαλονί`. Το `SearchableCombobox` δεν ξεχώριζε **ποιος** έγραψε το περιεχόμενο. NEW `isSystemProvidedRef` (τίθεται στο sync effect· καθαρίζεται σε `handleInputChange`/`handleSelect`/`handleClear`) + select-all στο `handleFocus` όταν η τιμή είναι πρόταση συστήματος + `handleMouseUp` που προστατεύει **μόνο** εκείνη την επιλογή από το mouseup του κλικ. Ίδια πειθαρχία με Chrome autofill / Google Maps. Επηρεάζει και τους 16 καταναλωτές του primitive. NEW test suite `searchable-combobox-field-ownership.test.tsx` (6 tests). Επιπλέον: αποκαταστάθηκαν **8 προϋπάρχοντα κόκκινα** tests (`AddressEditor.integration` ×7 — έλειπε `TooltipProvider` που στην εφαρμογή δίνει το `ConditionalAppShell`, + λάθος προσδοκίες `Undo`/`Redo` και `getByLabelText(/addr-*/)`· `AddressFieldBadge` ×1 — `svg.className` είναι `SVGAnimatedString`, όχι string). 162/162 πράσινα, `jscpd:diff` καθαρό. |
| Post-10.b — Ζώνη ασύγχρονης επίλυσης (CLS / κλεμμένο κλικ) | ✅ COMPLETED | 2026-07-25 | TBD | **Live-observed, με πραγματική ζημιά:** τα panels «Πιθανές Τοποθεσίες» + «Συμφωνία Πεδίων» προσαρτώνται **inline** ~2s μετά το τελευταίο πλήκτρο (όταν γυρίζει το reverse geocoding) και σπρώχνουν προς τα κάτω ό,τι βρίσκεται από κάτω. Ο χρήστης στόχευε το «Άφησέ τα όλα» και πάτησε Αποθήκευση — **η επαφή αποθηκεύτηκε κατά λάθος**. Μετρήσιμο CLS, όχι αισθητική λεπτομέρεια. ⚠️ **Το handoff είχε λάθος διάγνωση** («το panel συρρικνώνεται 3→2→0 καθώς λύνονται οι διαφορές»): ο `AddressReconciliationPanel` map-άρει τα `conflicts`, **όχι** τα `pending` — οι γραμμές μένουν και αλλάζει μόνο το styling της απόφασης. Η πραγματική μετατόπιση είναι η **προσάρτηση/αποπροσάρτηση** των panels, συν το επιπλέον κουμπί commit που εμφανίζεται όταν `resolved`. **Λύση — δέσμευση χώρου με βάση τον FSM, όχι μέτρηση:** το `AddressEditorState` προαναγγέλλει την επίλυση (`typing` → `debouncing` → `loading` → `conflict`|`suggestions`), άρα η ζώνη δεσμεύεται **όσο ο δρομέας είναι ακόμη στο πεδίο** — τη μόνη στιγμή που ένα reflow δεν κοστίζει τίποτα — και ελευθερώνεται μόνο όταν κλείσει ο κύκλος (`reserving || occupied`, ώστε το handover reconciliation→suggestions να μη συρρικνωθεί ενδιάμεσα). NEW `AddressResolutionSlot.tsx` (owns και τα δύο panels + το commit κουμπί). Η δεσμευμένη ζώνη **δεν είναι κενή**: όσο εκκρεμεί δείχνει `Skeleton` (υπάρχον primitive) — μια γυμνή τρύπα 12rem διαβάζεται ως bug διάταξης. **Χωρίς label** — ο δείκτης φάσης προβάλλεται ήδη στο chrome του editor (`editor.coordinator.phase.*`, γρ. 368) και η επανάληψη θα ήταν θόρυβος· **μηδέν νέα κλειδιά i18n**. **Απορρίφθηκαν τεκμηριωμένα:** (α) entry animation — κρύβει την κίνηση χωρίς να την αφαιρεί, το κλικ πέφτει ακόμη λάθος στη μετάβαση· (β) measured latch με ResizeObserver → θα έκλεινε 100% το κενό αλλά απαιτεί **inline style** ανά στοιχείο (N.3). **Υπολειπόμενο κενό, δηλωμένο:** panel ψηλότερο από το `min-h-[12rem]` μεγαλώνει ακόμη τη ζώνη κατά την άφιξη — φραγμένο, και συμβαίνει στο ίδιο frame με την εμφάνιση, όχι σιωπηλά κάτω από κινούμενο δείκτη. **Bonus:** ο coordinator `AddressEditor.tsx` έπεσε **497 → 496** γραμμές (ήταν 1 γραμμή από το όριο N.7.1). NEW test suite `AddressResolutionSlot.test.tsx` (6 tests — το «releases the band» αποδεικνύει ότι τα υπόλοιπα πιάνουν πραγματικό σήμα και όχι σταθερή κλάση). 144/144 πράσινα, `jscpd:diff` καθαρό. |

---

## 11. Handoff Templates

### Template — End of Phase N → Start of Phase N+1

```
ΣΥΝΕΧΕΙΑ ΕΡΓΑΣΙΑΣ: ADR-332 Enterprise Address Editor System — Phase {N+1}

ΟΛΟΚΛΗΡΩΜΕΝΑ (committed, NOT pushed):
- Phase 0 → ... → Phase N (commit hashes)
- ADR `docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md` aggiornato
- Last commit: <hash> "<message>"

ΕΠΟΜΕΝΟ ΒΗΜΑ — Phase {N+1}: <phase title>
- Scope: <copy from §4 of ADR-332>
- Files: <list>
- Deliverable: <list>
- Acceptance: <list>

ΑΡΧΕΙΑ ΠΡΟΣ ΕΛΕΓΧΟ/ΕΠΕΞΕΡΓΑΣΙΑ (estimate):
- <files>

ΣΗΜΑΝΤΙΚΕΣ ΡΥΘΜΙΣΕΙΣ (CLAUDE.md):
- N.(-1): NO push χωρίς ρητή εντολή
- N.7.1: αρχεία ≤ 500 lines, functions ≤ 40 lines
- N.11: zero hardcoded i18n strings — keys πρώτα στα locale JSONs
- GOL + SSOT mandatory
- LANGUAGE: Giorgio γράφει ελληνικά → απαντάς ιταλικά by default

ΠΡΩΤΟ ΣΟΥ MESSAGE:
"🎯 Modello consigliato: Sonnet 4.6 (per Phase 1-4-7-8) / Opus 4.7 (per Phase 0-2-3-5-6-9-10)
Motivo: <riassunto scope>
⏸️ In attesa di conferma — rispondi 'ok' per procedere."

ΞΕΚΙΝΑ ΜΕ:
1. Διάβασε `docs/centralized-systems/reference/adrs/ADR-332-enterprise-address-editor-system.md` (Phase {N+1} sezione)
2. Διάβασε i file deliverable della phase precedente per capire il contesto
3. Implementa Phase {N+1} secondo § 4 dell'ADR
4. Tests + ADR §10 update + commit (NO push)
5. Genera handoff template per Phase {N+2}
```

---

## 12. References

- ADR-145 (super-admin-ai-assistant) — for telemetry collection pattern
- ADR-168 (draggable-markers) — extends drag flow with confirm dialog
- ADR-277 (drag-hierarchy-clear) — Reconciliation Panel applies to this flow
- ADR-279/280 (i18n-runtime-resolver) — array useTranslation pattern for keys
- ADR-282 (contact-persona-architecture) — derived addresses (ADR-318)
- ADR-294 (ssot-ratchet-enforcement) — register `address-editor` module
- ADR-298 (firestore-rules-tests) — `address_corrections_log` rules tested
- ADR-318 (derived-work-addresses) — read-only derived pins
- ADR-319 (hq-positional-invariant) — primary address index
- ADR-330 (procurement-hub-scoped-split) — pattern reference for phase-driven session work
- CLAUDE.md N.7 / N.7.1 / N.7.2 / N.11 / N.12 / N.14
