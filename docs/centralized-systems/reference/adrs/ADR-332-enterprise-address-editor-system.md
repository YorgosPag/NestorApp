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
| 2026-09-12 | ✅ **D27 Ζ5 ΕΚΛΕΙΣΕ — η Αποθήκευση δεν περιμένει πια τη μηχανή** (Plan Mode· απόφαση Giorgio: **και τα τρία στρώματα**). 🔴 **Η έρευνα άλλαξε τον χαρακτήρα του ευρήματος: δεν ήταν UX, ήταν ΣΥΜΜΟΡΦΩΣΗ** — η πολιτική του Nominatim **απαιτεί** μνήμη (*«Results must be cached on your side… may be classified as faulty and blocked»*), και η διαδρομή του διακομιστή δεν είχε **καμία**: κάθε αποθήκευση ξαναρωτούσε **έως 8 παραλλαγές** με `sleep(1100ms)` πριν από κάθε μία. ⚠️ **Η μνήμη υπήρχε ήδη στη ΛΑΘΟΣ πλευρά του συνόρου** (το `geocoding-service.ts` είναι περιτύλιγμα **πελάτη**). **Ε**: μνήμη + in-flight dedup **στη μηχανή**, πάνω στο υπάρχον SSoT `EnterpriseAPICache` — επειδή πληκτρολόγηση και αποθήκευση καταλήγουν στο **ίδιο** `geocodeWithVerdict`, ό,τι έλυσε ο συντάκτης το βρίσκει η αποθήκευση **δωρεάν**· πολιτική ανά ετυμηγορία (`hit` μακρά · `absent` **σύντομη** αρνητική μνήμη · `unavailable` **ποτέ**). **Π**: *deadline propagation* όπως το Β13, **όγδοη έκβαση `budget-exhausted`** («δεν πρόλαβα» ≠ «δεν απάντησε»), **θέσεις πριν από συμβουλές**, αναβίωση της **νεκρής** `RESOLVER_TIMEOUT_MS` + `retry: false` στον πελάτη (ο `apiClient` επαναλάμβανε **3 φορές**). **Υ**: νέο SSoT `useInFlightAction` + `pending`/`pendingLabel` στην **κοινή** `EntityHeaderAction` (`disabled` **και** `aria-busy` **και** ετικέτα — W3C ARIA25)· ο τύπος του `createEntityAction` **απέκλειε** ακόμη και το `disabled`· καλωδιώθηκε και το **δεύτερο, αφύλαχτο** κουμπί του κινητού. **Ειλικρίνεια**: εκκρεμείς θέσεις **ονομαστικά** («η θέση εκκρεμεί»), εκεί που η Salesforce σιωπά. 🔑 Αίτημα που ξεπέρασε την προθεσμία **ζεσταίνει τη μνήμη** ⇒ όφελος ασύγχρονου **χωρίς** δεύτερη εγγραφή. Άγκυρες Ε1–Ε6 (με **καλωδίωση**) · Π1–Π5β · Υ1–Υ4γ· **μεταλλάξεις 20/20** · **20 σουίτες / 214 πράσινα** · `jscpd:diff` ✅ · 3.33 · 3.34 · 3.53 · 3.54 · 3.71 ✅. 🔴 **Η ζωντανή μέτρηση βρήκε κενό στην πρώτη υλοποίηση**: η προθεσμία έφραζε «πόσες διευθύνσεις ξεκινώ», όχι «πόσο κρατά η καθεμία» (**29,2″** με προϋπολογισμό 9) — τα unit tests ήταν πράσινα επειδή ο πλαστός γεωκωδικοποιητής απαντούσε **ακαριαία**. Διορθώθηκε (`askWithinBudget`, άγκυρα Π5 με μηχανή που **δεν απαντά ποτέ**). **Ζωντανά μετά**: ίδια διεύθυνση **29,2″ → 743 ms** (~40×)· νέα άλυτη **8,7″**· **τρεις** άλυτες **9,79″** με την τρίτη να αναφέρεται **ονομαστικά** ως εκκρεμής και τη θέση της ανέπαφη. Boy-Scout: `aria-busy` στο `SaveButton` της δημιουργίας· ενοποιήθηκαν **δύο ταυτόσημα** σκέλη στο `ContactDetailsHeader`. ΟΧΙ tsc (N.17). |
| 2026-09-11 | 🔴 **D27 Β-ΙΙ ζωντανή επαλήθευση — Εύρημα Ζ1 (όχι του Β-ΙΙ, προϋπήρχε): ατέρμονος βρόχος στο κοινό `SearchInput`.** Γρήγορη πληκτρολόγηση στην αναζήτηση της λίστας ⇒ «ALF» ↔ «ALFA» για πάντα + «Maximum update depth» ~1/s ώσπου πάγωσε ο renderer — δύο effects σε αντίθετες κατευθύνσεις πάνω σε δύο πηγές αλήθειας. Διορθώθηκε με `useSearchInputValue` (εκπομπή από το συμβάν, υιοθέτηση μόνο μη-ηχούς με ακύρωση της εκκρεμούς) + `useDebouncedCallback.cancel()` (ADR-217). Σ1–Σ9 + Δ1–Δ4 · **κόκκινο πρώτα** (η 1η εκδοχή του Σ1 πέρασε πάνω στον παλιό κώδικα ⇒ αντικαταστάθηκε από ιχνηλατημένη συνθήκη ταυτόσημη με το ζωντανό αποτύπωμα) · μεταλλάξεις **6/6** · 9 σουίτες / 101 tests · ζωντανά: 0 σφάλματα. **Λ1–Λ5 + Λ7 ✅ ζωντανά** (Chrome + Firestore σε κάθε βήμα): `customFields` κλειδί-κλειδί · ταυτότητες + θέσεις σε μία εγγραφή · διάλογος έδρας αμέσως + «Μόνο η θέση» ⇒ `dragged` · reload ⇒ δεν πηδά (~3 m) · υποκατάστημα ⇒ ιεραρχία έδρας ανέγγιχτη · «Μετακίνησε / Κράτα» (Κράτα χωρίς εγγραφή, Μετακίνησε χωρίς reload, 456 m = η ειδοποίηση) · κρέμασμα γραφέα ⇒ η αποθήκευση προχωρά. **Νέα ευρήματα**: 🔴 Ζ3 διάλογος συρσίματος αόρατος στην πλήρη οθόνη (+ τυφλό σημείο CHECK 3.50) · 🔴 Ζ5 Αποθήκευση 61″ χωρίς ένδειξη · ⚠️ Ζ2 / Ζ4 / Ζ6 (λεξιλόγιο και ετικέτα θέσης). Λ6 εκκρεμεί (ΑΦΜ + οριστική διαγραφή = άνθρωπος). |
| 2026-09-11 | 📍 **D27 Βήμα Β-ΙΙ — οι επαφές ΚΡΑΤΟΥΝ θέση, με τον ΙΔΙΟ γραφέα** (Salesforce Geocode Data Integration Rules σε create **και** update · Salesforce Maps Verified Location — εδώ με **μετρημένη** απόκλιση). Ο διακομιστής **αποφασίζει** (`POST /api/contacts/[contactId]/address-positions` + `/api/contacts/address-positions` για νέα επαφή, resolve-only, κοινός εκτελεστής ADR-742), ο πελάτης γράφει **μία** φορά. `StoredAddressPosition` = ένας τύπος θέσης για έργα/κτίρια/επαφές· `CompanyAddress` + `id` (δίνεται στην πρώτη αποθήκευση)· έδρα → διάλογος editor με «Μόνο η θέση», υποκατάστημα → διάλογος προβολής (κοινό `ViewDragConfirm`)· «Μετακίνησε / Κράτα» μόνο σε προβολή· D25: οι δύο οθόνες επαφών καλωδιώθηκαν, εξαιρέσεις πύλης **0**· D20: θέση = περιεχόμενο. 🔴 **Βρέθηκαν και διορθώθηκαν:** (1) **σιωπηλή απώλεια δεδομένων ΠΡΙΝ το Β-ΙΙ** — το `updateDoc({ customFields })` αντικαθιστούσε τον χάρτη ⇒ αποθήκευση μόνο διευθύνσεων εταιρείας έσβηνε ΚΑΔ/ΓΕΜΗ/κεφάλαιο (άγκυρα κόκκινη στον παλιό κώδικα)· (2) η δημιουργία εταιρείας παρέκαμπτε τη δικλείδα D20· (3) σύρσιμο υποκαταστήματος μηδένιζε την ιεραρχία **της έδρας** και όχι τη δική του· (4) race δύο εγγραφών στον ίδιο κύκλο· (5) η απήχηση `CONTACT_UPDATED` δεν κουβαλούσε διευθύνσεις. Μεταλλάξεις **29/29** (η M29 επέζησε πρώτα — δηλωμένο κενό, έκλεισε με εξαγωγή + άγκυρα)· παλινδρόμηση **132 σουίτες / 1803 tests**· `jscpd:diff` καθαρό σε 42 αρχεία. Ζωντανή επαλήθευση **εκκρεμεί**. ΟΧΙ tsc (N.17). |
| 2026-09-10 | ✅ **D27 Β9–Β13 — ΕΠΑΛΗΘΕΥΤΗΚΑΝ ΖΩΝΤΑΝΑ** (Chrome + Firestore, ERGO TEST): διάλογος σε **175 ms** με «Μόνο η θέση» · `/reverse` **7,93″** (ήταν 24–38″) · κρέμασμα ⇒ «δεν απάντησε» στα **12,08″** · καμία «Χώρα», καμία «Παλιές συντεταγμένες» · πινέζα στο σημείο αφής μετά την αποθήκευση · `address` με ένα κενό · βήμα 3 με πλήρη διεύθυνση αποθηκεύτηκε και σβήστηκε από την εφαρμογή. ⛔ Βήμα 7 (κτίριο χωρίς έργο) **μη προσβάσιμο** από την εφαρμογή (`building.projectRequired`). Βρέθηκαν και διορθώθηκαν: **Β14** (καδράρισμα που «καταναλωνόταν» πριν το `mapReady` — ⚠️ το ζωντανό σύμπτωμα ήταν συγχυσμένο με κρυμμένη καρτέλα) και **επίπεδο καταγραφής** (ακύρωση/λήξη ως `error` ⇒ ψεύτικα «Issues» στο Next). Μεταλλάξεις **21/21**. ΟΧΙ tsc (N.17). |
| 2026-09-10 | 🔴→✅ **Το deploy στο Netcup έσπασε από τη σελίδα demo** (`docker-build.yml`, run 34520028352, commit `5efd7ce2`): `Error occurred prerendering page "/demo/addresses-editor"` — `TypeError: Cannot read properties of undefined (reading 'kind')`. Ρίζα: το D27 Β6 (`f2bec96f`) αντικατέστησε το prop `newAddress` του `AddressDragConfirmDialog` με `proposal: PinDropText<…>` και ενημέρωσε τους 3 πραγματικούς καταναλωτές, **όχι** το `demo/addresses-editor/page.tsx`. Το `proposal.kind` διαβάζεται στο σώμα του component, άρα σκάει **και με `open={false}`**, δηλαδή ήδη στο prerender. Διόρθωση: `proposal={{ kind: 'resolved', address: MOCK_RESOLVED }}`. 🔶 **Τυφλό σημείο, δηλωμένο**: το `next build` τρέχει με `Skipping validation of types` και το CHECK 3.55 κρίνει μόνο `useSearchParams` χωρίς `<Suspense>` ⇒ καταναλωτής που **δεν άγγιξε** το commit της μετονομασίας δεν τον βλέπει καμία πύλη πριν το Tier 1. |
| 2026-09-10 | ✅ **D27 Β9–Β13 διορθώθηκαν** (ευρήματα της ζωντανής επαλήθευσης Β-Ι, πριν το Β-ΙΙ). Κοινή ρίζα Β10/Β11/Β12: **δεύτερος κριτής ή δεύτερο αντίγραφο στον πελάτη**. **Β9** η χώρα περνά στον editor και συγκρίνεται ως ISO (`countryNameToCode`). **Β10** αφαιρέθηκε ο ανιχνευτής «Παλιές συντεταγμένες» + «Ανανέωση χάρτη» (και η δίδυμη λίστα `ADDRESS_GEOCODING_FIELDS`)· η απόκλιση ζει μόνο στα `positionAdvisories`. **Β11** το κάτοπτρο `address`/`city` το παράγει ο διακομιστής από ό,τι γράφει (έργα + κτίρια). **Β12** ελεγχόμενος χάρτης: `displayedPosition` + `dropSupersededOverrides`. **Β13** μία προθεσμία ανά αίτημα (`createDeadline`, Google SRE deadline propagation) · ένα ερώτημα Overpass αντί για τρία · όριο πελάτη + ακύρωση · 503 αντί για 404 όταν ο πάροχος δεν απαντά · **προοδευτικός διάλογος** (`pending` αμέσως, «Μόνο η θέση» από την πρώτη στιγμή, `usePinDropGate`). Μικρό: η πινέζα προσθήκης γράφει τον τύπο της φόρμας. Βήμα 3: σχεδιασμένο. Άγκυρες και μεταλλάξεις: D27 «Β9–Β13 — διορθώθηκαν». ΟΧΙ tsc (N.17). |
| 2026-09-10 | 🔴 **D27, δεύτερο εύρημα — η θέση του συρσίματος ήταν η θέση ΤΗΣ ΜΗΧΑΝΗΣ.** Βρέθηκε στη ζωντανή επαλήθευση, **πριν** από το σύρσιμο: το `reverseResultToAddress` έγραφε `coordinates: result.lat/lng`, και το `/api/geocoding/reverse` επιστρέφει το σημείο του αντικειμένου OSM που ταίριαξε (μετρημένο: πόρτα του 16 → ο δρόμος, **19,5 μ.**). Με `source: 'dragged'` ⇒ «Ακριβής διεύθυνση · Πινέζα που έβαλε άνθρωπος» πάνω στον άξονα του δρόμου. **Διόρθωση σε ΕΝΑ σημείο:** `reverseResultToAddress(result, dropPoint)` — η θέση από το χέρι, το κείμενο από τη μηχανή· μοναδικός καλών ο `handleDragEnd` ⇒ διορθώνονται όλοι οι χάρτες διευθύνσεων. Άγκυρα `drag-drop-point.test.ts` (4 — εκτελεί τον **πραγματικό** `handleDragEnd`), μεταλλάξεις **2/2**, παλινδρόμηση **324/324** σε 27 σουίτες, `jscpd:diff` καθαρό. ✅ **Επαληθεύτηκε ζωντανά** (τοπικά, κοινή Firestore): πόρτα εισόδου 1 από Street View + OSM → έργο `dragged` χωρίς `geocodingMetadata`, `number: '16'` · αγγελία `manual` · δημόσια σελίδα «Ακριβής διεύθυνση · Πινέζα που έβαλε άνθρωπος». Νέα ανοιχτά 4-6 στο D27 (κάρτα μπαγιάτικη ως την επαναφόρτωση · σιωπηλή απώλεια σε αποτυχία reverse · θόρυβος παύλας/κενού). ΟΧΙ tsc (N.17). |
| 2026-09-10 | 🔴 **Το σύρσιμο πινέζας ΔΕΝ «κολλούσε» όταν ξαναέγραφε το κείμενο** (D27). Αναφορά Giorgio: «Σαμοθράκης 16, Ελευθέριο Κορδελιό» → δημόσιος χάρτης «Δρόμος χωρίς αριθμό». Ζωντανό Nominatim: `highway/residential`, `place_rank 26`, **χωρίς `house_number`** ⇒ το `interpolated` ήταν **σωστό**. Όμως η θεραπεία (σύρσιμο) ήταν **αδύνατη**: το `handleAddressDragUpdate` ξαναγράφει οδό/**αριθμό** από το reverse geocode ⇒ το κείμενο αλλάζει ⇒ ο κανόνας 1 του `resolveAddressPosition` («κείμενο ίδιο») δεν πιάνει ⇒ ο κανόνας 3 ξαναρωτά τη μηχανή και **σβήνει το σημείο του ανθρώπου**. **Διόρθωση:** (α) νέο `applyDraggedPin` (`location-converters`) **δηλώνει** `source: 'dragged'`· ο κανόνας 1 την τιμά και όταν άλλαξε το κείμενο, **μόνο** με αλλαγμένο σημείο· (β) ο διάλογος συρσίματος αποκτά «**Μόνο η θέση — κράτα τη διεύθυνση**» (προαιρετικό prop, view-mode έργου)· (γ) η κάρτα «Στον δημόσιο χάρτη» δίνει θεραπεία για κάθε σχήμα με επιφύλαξη (`shapeHasHalo`)· (δ) διατύπωση: «Στον δρόμο, όχι στην πόρτα» αντί για «Δρόμος χωρίς αριθμό» (τον αριθμό **τον ξέρουμε** — τον δήλωσε ο άνθρωπος). Άγκυρες Κ1γ/Κ1δ (παρονομαστής)/Κ1ε · Δ1/Δ2 · Ο4/Ο4β. ⚠️ **Η Δ1 κοκκίνισε στην πρώτη εκτέλεση** και αποκάλυψε ανοιχτό κενό: το `diffAddressFields` δεν μετρά το άδειασμα ως διαφορά ⇒ «16 → κενό» = **μηδέν** γραμμές, και το «Ναι, ενημέρωσε» σβήνει τον αριθμό **σιωπηλά** ⇒ ✅ **λύθηκε την ίδια μέρα**: δεύτερη ονομασμένη ερώτηση `diffAddressReplacement` (σβήσιμο = αλλαγή) πάνω στον **ίδιο** πυρήνα, γραμμή «θα σβηστεί», εστίαση στην ασφαλή επιλογή όταν κάτι σβήνεται, και `ProjectViewDragConfirm` που δείχνει το **πραγματικό** αποτέλεσμα του `applyDraggedPin` — δες D27. ΟΧΙ tsc (N.17). |
| 2026-09-03 | 🔴 **Η εγγύτητα των προτάσεων τρεφόταν από το τίποτα** (D23). Ο μοναδικός καλών του `useAddressSuggestions` δεν έδινε options ⇒ `distanceFromCenterM` **πάντα `null`** ⇒ η γραμμή απόστασης **δεν εμφανίστηκε ποτέ**, `proximityCapM`/`confidenceWeight` αδρανείς, **13** αναφορές `mapCenter` στη σουίτα με συνθετικές αφετηρίες. **Απόφαση Giorgio: αφετηρία = το ΕΡΓΟ** (⛔ όχι το κέντρο του χάρτη — ένα σύρσιμο θα ανέβαζε τη λάθος πόλη **πρώτη**). Μετονομασία `MapCenter`→`ProximityAnchor` *(το παλιό όνομα ήταν οδηγία προς την απορριφθείσα επιλογή)*, νέο SSoT `address-list-center` *(«κύρια χωρίς συντεταγμένες δεν είναι κέντρο», απόρριψη `NaN`)*, νέα `AddressEditorSuggestionOptions`, καλωδίωση Card→Editor→hook. Νέα άγκυρα **εκτελεί** τον παραγωγικό καλόντα· 3/3 μεταλλάξεις κόκκινες. |
| 2026-09-02 | 🔴 **«Μήπως εννοούσες;» με ΜΙΑ επιλογή — αυτήν που ήδη βλέπεις** (D22). Το `NOMINATIM_RESULT_LIMIT` ήταν **`'1'`** ⇒ `alternatives` **πάντα `[]`** ⇒ κατάλογος μιας γραμμής, **σε παραγωγή** (καρτέλα «Γενικά» κτιρίου). **Δύο** από τις 4 σκανδάλες δεν έφταναν ποτέ στην οθόνη· μαζί τους απρόσιτο και το κουμπί «δοκίμασε χωρίς Τ.Κ.». **42 άγκυρες πράσινες** στο νεκρό σκέλος, **0** στο ίδιο το πάνελ. **22 ζωντανά ερωτήματα** πριν από κώδικα έδειξαν ότι το «1→5» σκέτο είναι **χειρότερο**: με τοπωνύμιο **16/16** των θέσεων 2-5 είναι POI **της ίδιας πόρτας** (Τσιμισκή 43 → Προξενείο/Μασούτης/ODEON/σπίτι, 0-57 m)· χωρίς τοπωνύμιο **28/33** γνήσιες (Αθηνάς 5 → 5 πόλεις, 212-349 km). **Λύση:** `limit='5'` **+** νέο SSoT `address-candidate-identity` (ίδια πόρτα ⇒ μία επιλογή, `SAME_DOOR_RADIUS_M=150`) που συμπτύσσει **στη μηχανή** πριν την κοπή στους 4, **+** δύο τρόποι πάνελ (`chooser` ≥2 / `advisory` αλλιώς — πρότυπο Google `CONFIRM`⇄`FIX`), **+** οι εναλλακτικές εκτός δηλωμένης χώρας φεύγουν (κενό που **ενεργοποιεί** το `limit=5`, παραλλαγές 7/8). Καμία άγκυρα δεν διαγράφηκε — **αντικαταστάθηκε η τροφή τους**. |
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

> 🔴 **ΑΥΤΗ Η ΠΑΡΑΓΡΑΦΟΣ ΗΤΑΝ ΨΕΥΔΗΣ ΕΠΙ ~4 ΜΗΝΕΣ** (μετρημένο 2026-09-02): το
> `NOMINATIM_RESULT_LIMIT` ήταν **`'1'`**, άρα το `results.length` ήταν πάντα ≤ 1 και το
> `alternatives` **πάντα `[]`**. Η σκανδάλη (3) ήταν **δομικά νεκρή**, και το πάνελ άνοιγε
> από τις (2)/(4) δείχνοντας κατάλογο **μιας** γραμμής: **την απάντηση που ο άνθρωπος ήδη
> έβλεπε**. Δες **D22**.

**ΤΙ ΙΣΧΥΕΙ ΤΩΡΑ** (D22, 2026-09-02):

- `limit=5` **στη ρύθμιση**, όχι μόνο στο κείμενο ⇒ οι σκανδάλες (2)/(3)/(4) έχουν όντως
  δεδομένα και εξακολουθούν να μη στοιχίζουν **κανένα** επιπλέον αίτημα.
- «Εναλλακτική» σημαίνει **άλλη διεύθυνση**, όχι άλλη σειρά: ο διακομιστής συμπτύσσει τους
  υποψήφιους που είναι **η ίδια πόρτα** (`lib/geocoding/address-candidate-identity`) πριν
  γεμίσει το `alternatives`, και **μετά** κόβει στους 4.
- Το πάνελ έχει **δύο τρόπους** (`suggestionPresentation`): **`chooser`** με ≥2 διακριτές
  επιλογές, **`advisory`** με μία ή καμία — λόγος + επόμενη κίνηση, **χωρίς κατάλογο** και
  χωρίς επανάληψη της διεύθυνσης.
- Εναλλακτική **εκτός δηλωμένης χώρας φεύγει** (ο κορυφαίος μένει σημαιοδοτημένος, D12).

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

> **ΕΝΗΜΕΡΩΣΗ 2026-09-11 (D27 Β-ΙΙ) — ρητή απόφαση πάνω στον κανόνα:** **θέση ΕΙΝΑΙ περιεχόμενο.**
> Μια εγγραφή μόνο με σημείο (χωρίς κείμενο) τη γεννά **μόνο** άνθρωπος («Μόνο η θέση» όταν η μηχανή
> δεν βρήκε διεύθυνση) — δήλωση «εδώ», πρακτική Google «Dropped pin» / Business Profile «pin your
> business on the map». Η μηχανή δεν δίνει ποτέ σημείο χωρίς κείμενο. `NaN` δεν είναι θέση (`usablePoint`).
> Ο «Καθαρισμός» της έδρας φτιάχνει **νέα** εγγραφή χωρίς θέση και χωρίς `id`, άρα κλαδεύεται κανονικά.
> 🔴 Βρέθηκε επίσης: η **δημιουργία εταιρείας** (`mappers/company.ts`) έγραφε την **ωμή** λίστα της φόρμας
> ⇒ η δικλείδα **δεν ίσχυε** στη δημιουργία εταιρείας (τα φυσικά πρόσωπα/υπηρεσίες ήταν σωστά). Διορθώθηκε.

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

### D22 — «Μήπως εννοούσες;» με μία επιλογή: μια ρύθμιση σκότωσε ένα υποσύστημα, και οι άγκυρες δεν το είδαν

**RESOLVED 2026-09-02 — τροφοδότηση + σύμπτυξη + δύο τρόποι παρουσίασης**

#### Το εύρημα

`src/config/geographic-config.ts` ζητούσε από τον πάροχο **ένα** αποτέλεσμα:

```
NOMINATIM_RESULT_LIMIT: process.env.NEXT_PUBLIC_NOMINATIM_RESULT_LIMIT || '1'
```

Ο μηχανισμός εναλλακτικών είναι γραμμένος για **έως 4** (`formatTopResult`), άρα το
`alternatives` ήταν **πάντα `[]`**. Το `rankSuggestions` χτίζει τον κατάλογο ως
`[result, ...alternatives]` ⇒ **μία γραμμή: το ίδιο το αποτέλεσμα**. Δεν ήταν αόρατο
χαρακτηριστικό — ήταν **ορατή ανόητη οθόνη**, και **σε παραγωγή**
(`BuildingAddressesEditor.tsx`, καρτέλα «Γενικά» κτιρίου), όχι μόνο στη σελίδα demo.

🔴 **Και δύο σκανδάλες από τις τέσσερις δεν έφταναν ΠΟΤΕ στην οθόνη**, για δύο
διαφορετικούς λόγους: η (3) επειδή απαιτεί `alternatives.length >= 2`· η (1)
`no-results-after-retry` επειδή το `showSuggestions` απαιτούσε `candidates.length > 0` ενώ η
σκανδάλη συμβαίνει **μόνο** με `result === null` ⇒ **μηδέν** υποψήφιους. Δύο συνθήκες που δεν
μπορούσαν να αληθεύουν μαζί — μαζί τους ήταν απρόσιτο και **ολόκληρο** το κουμπί «δοκίμασε
χωρίς Τ.Κ.».

🔴 **42 άγκυρες ήταν πράσινες πάνω στο νεκρό σκέλος** (`rankSuggestions` 12 ·
`computeSuggestionTriggers` 23 · `AddressResolutionSlot` 7), τρέφοντάς το με **συνθετικές**
εναλλακτικές που η παραγωγή δεν μπορούσε να παραγάγει — και το ίδιο το πάνελ είχε **μηδέν**
άγκυρες. *Κάλυψη σε νεκρό δίδυμο δεν είναι κάλυψη.*

#### Η μέτρηση που άλλαξε την απόφαση

Πριν από κώδικα, **22 ζωντανά ερωτήματα** στον Nominatim με `limit=5`. Το «σήκωσε το 1 σε 5»
θα ήταν λάθος:

| Είσοδος | Θέσεις 2-5 | Τι ΕΙΝΑΙ |
|---|---|---|
| **ΜΕ** τοπωνύμιο *(η κοινή περίπτωση)* | **16 / 16 άχρηστες** | «Τσιμισκή 43» → Προξενείο ΗΠΑ · Μασούτης · ODEON · το σπίτι — **τέσσερα POI στην ίδια πόρτα**, 0-57 m. «Αγ. Δημητρίου 55» → **5 τμήματα** του ίδιου δρόμου, κανένα με αριθμό. |
| **ΧΩΡΙΣ** τοπωνύμιο *(αμφίσημη)* | **28 / 33 γνήσιες** | «Αθηνάς 5» → Άγ. Ανάργυροι · Θεσσαλονίκη · Λάρισα · Καβάλα · Καστοριά, **212-349 km** |

⇒ Το `limit=5` **σκέτο** θα αντικαθιστούσε μία ανόητη γραμμή με **τέσσερις**. Η τροφοδότηση
και η σύμπτυξη είναι **μία** απόφαση, όχι δύο.

⚠️ **Και η ίδια η μέτρηση έπεσε στην παγίδα που φυλάει**: η πρώτη εκδοχή της έχτισε ταυτότητα
από `(αριθμός, οδός, Τ.Κ., τοπωνύμιο)` και μέτρησε τα 4 POI της Τσιμισκή ως **τέσσερις**
διευθύνσεις, επειδή ο πάροχος γράφει για την ίδια πόρτα άλλοτε `city: "Θεσσαλονίκη"` κι
άλλοτε `municipality: "Δημοτική Ενότητα Θεσαλονίκης"`. **Το όνομα τόπου είναι ετικέτα· η
συντεταγμένη είναι ταυτότητα.**

#### Η απόφαση

1. **`NOMINATIM_RESULT_LIMIT: '5'`**. Το `limit` μεγαλώνει την **απάντηση**, όχι τα
   **αιτήματα**: η πολιτική OSMF περιορίζει ρυθμό (1/δευτ., τηρείται με `NOMINATIM_DELAY_MS`)
   και απαγορεύει **autocomplete** — καμία ρήτρα για πλήθος αποτελεσμάτων ανά αίτημα. Η ροή
   μας είναι **μία** γεωκωδικοποίηση ανά αποθήκευση, από τον διακομιστή.
2. **ΝΕΟ SSoT `src/lib/geocoding/address-candidate-identity.ts`** — `sameAddressChoice` /
   `distinctAddressChoices`. Δύο υποψήφιοι είναι **η ίδια ερώτηση** όταν (α) έχουν
   **ταυτόσημη ορατή γραμμή**, ή (β) είναι **η ίδια πόρτα**: ίδιος αριθμός *(ή απών και στους
   δύο)*, ίδια οδός, απόσταση ≤ **`SAME_DOOR_RADIUS_M = 150`** *(ένα οικοδομικό τετράγωνο· το
   πλησιέστερο ζεύγος που **οφείλει** να μείνει χωριστό απέχει **1,6 km**)*.
3. **Η σύμπτυξη γίνεται στη ΜΗΧΑΝΗ** (`formatTopResult`), όχι στην οθόνη — αλλιώς κάθε
   καταναλωτής θα ξαναφιλτράριζε και η σκανδάλη (3) θα πυροδοτούσε πάνω σε μηδέν αμφισημία.
   Η κοπή στους 4 γίνεται **μετά**, ώστε τα δίδυμα να μην τρώνε τη θέση των γνήσιων.
4. **Δύο τρόποι παρουσίασης** (`suggestionPresentation` στο `computeSuggestionTriggers`):
   `chooser` με ≥2 επιλογές, `advisory` αλλιώς. Είναι η διάκριση **`CONFIRM` ⇄ `FIX`** της
   Google Address Validation και το `suggestedAddress` *(ενικός)* + modal σύγκρισης του Adobe
   Commerce: όταν υπάρχει *επιλογή* δίνεις κατάλογο, όταν υπάρχει *μία απάντηση με επιφύλαξη*
   δίνεις **τον λόγο και την επόμενη κίνηση**. Στο `advisory` η διεύθυνση **δεν
   επαναλαμβάνεται** — είναι ήδη στη φόρμα και στον χάρτη.
5. **Οι εναλλακτικές εκτός δηλωμένης χώρας φεύγουν** (ο κορυφαίος μένει σημαιοδοτημένος,
   D12). Ασυμμετρία σκόπιμη: ο κορυφαίος είναι **εξήγηση**, μια εναλλακτική είναι **επιλογή σε
   κατάλογο** — «μήπως εννοούσες Ουισκόνσιν;» δεν είναι επιλογή. Το κενό ήταν αόρατο με
   `limit=1` και **ενεργοποιείται** από το `5`: οι παραλλαγές 7/8 σηκώνουν επίτηδες τον
   περιορισμό χώρας.

#### Τι ΔΕΝ έγινε

- **Δεν διαγράφηκε καμία άγκυρα.** Το `fixtureSamothraki16Alt` **αντικαταστάθηκε**: γεννούσε
  τέσσερις «εναλλακτικές» με **ταυτόσημες συντεταγμένες** που διέφεραν μόνο στον Τ.Κ. — τροφή
  που η παραγωγή δεν παράγει. Η νέα είναι αντιγραφή **μετρημένης** απάντησης.
- **Δεν άλλαξε το κατώφλι της σκανδάλης (3)** (`alternatives.length >= 2`). Με γνήσια
  σύμπτυξη ο πήχης «τρεις διακριτές διευθύνσεις» είναι σωστός, και μια σιωπηλή αλλαγή
  σημασιολογίας είναι ακριβώς ό,τι απαγορεύει το μάθημα του D12.
- **Δεν προστέθηκε δεύτερη μηχανή.** Η ερώτηση απαντιέται από την υπάρχουσα, με μία ρύθμιση
  και ένα φίλτρο.

---

### D23 — Η εγγύτητα των προτάσεων τρεφόταν από το τίποτα, και το όνομά της ζητούσε λάθος καλωδίωση

**RESOLVED 2026-09-03 — αφετηρία = το ΕΡΓΟ (απόφαση Giorgio), + μετονομασία, + SSoT «πού είναι αυτό»**

#### Το εύρημα

Το D22 έδωσε στο πάνελ **πραγματικές** επιλογές. Αμέσως φάνηκε ότι η **σειρά** τους
βγαίνει μόνο από τη βεβαιότητα του παρόχου: ο **μοναδικός** καλών του
`useAddressSuggestions` σε όλο το δέντρο (`AddressEditor.tsx`) τον καλούσε **χωρίς
options** ⇒ `mapCenter` πάντα `undefined` ⇒ `scoreCandidate` βραχυκύκλωνε πάντα ⇒
`distanceFromCenterM` **πάντα `null`** ⇒ η γραμμή απόστασης στο πάνελ **δεν εμφανίστηκε
ποτέ**, και τα `proximityCapM` / `confidenceWeight` ήταν **αδρανείς σταθερές**.
**13** αναφορές `mapCenter` στη σουίτα τρέφονταν με συνθετικές αφετηρίες — **πέμπτη**
εμφάνιση του σχήματος «άγκυρες πράσινες σε σκέλος που δεν τρέχει».

#### Η απόφαση — και γιατί ρωτήθηκε ο άνθρωπος

Το «από πού μετράμε το κοντά;» **δεν έχει τεχνική απάντηση**. Μετρημένο: για «Αθηνάς 5»
χωρίς τοπωνύμιο ο πάροχος δίνει **πέντε αληθινές** διευθύνσεις σε πέντε πόλεις.
Επιλέχθηκε **το ΕΡΓΟ του κτιρίου**, με υποχώρηση στην ήδη αποθηκευμένη θέση της εγγραφής,
και `undefined` αν λείπουν και τα δύο.

⛔ **Απορρίφθηκε ρητά το κέντρο προβολής του χάρτη**: το έργο εκφράζει **πρόθεση** (πού
χτίζεις)· ο χάρτης εκφράζει **τι κοιτάς τώρα**, που είναι τυχαίο. Ένας χρήστης που έσυρε
τον χάρτη στην Αθήνα ενώ καταχωρεί Θεσσαλονίκη θα έβλεπε **την Αθήνα πρώτη** — δηλαδή η
βοήθεια θα ανέβαζε τη λάθος γραμμή εκεί ακριβώς που πατάει ο κόσμος.

#### Τι άλλαξε

1. **Μετονομασία `MapCenter`/`mapCenter` → `ProximityAnchor`/`proximityAnchor`** (3 αρχεία).
   Δεν είναι καλλωπισμός: το παλιό όνομα ήταν **οδηγία προς την απορριφθείσα επιλογή** —
   ο επόμενος που θα το συνέδεε θα έδινε φυσιολογικά το κέντρο προβολής.
2. **ΝΕΟ SSoT `src/utils/address/address-list-center.ts`** — `addressListCenter`.
   🔑 **Δεν είναι το γνωστό `find(isPrimary) ?? [0]`**: εκείνο απαντά «ποια *διεύθυνση*
   εκπροσωπεί», αυτό «ποιο *σημείο*». **Κύρια διεύθυνση χωρίς συντεταγμένες δεν είναι
   κέντρο** — αν επιστρεφόταν, ο καλών θα συμπέραινε ότι *καμία* διεύθυνση δεν έχει θέση
   ενώ η δεύτερη έχει. Απορρίπτει `NaN`/`±Infinity` (μια `NaN` αφετηρία μολύνει **κάθε**
   απόσταση και οι συγκρίσεις της είναι όλες ψευδείς ⇒ σιωπηλή κατάρρευση της κατάταξης).
   Δεν υπολογίζει **μέσο όρο**: για έργο με δύο μετωπικές διευθύνσεις θα έπεφτε **μέσα
   στο οικοδομικό τετράγωνο** — σημείο που δεν υπάρχει.
3. **Νέα ομάδα `AddressEditorSuggestionOptions`** — **όχι** στο `AddressEditorMapOptions`
   (που περιγράφει *ζωγραφική* χάρτη και **δεν το διαβάζει κανείς**: 0 καταναλωτές).
4. **Καλωδίωση**: `BuildingAddressesCard` *(έχει ήδη `projectAddresses`)* →
   `BuildingAddressesEditor` → `AddressEditor` → `useAddressSuggestions`.

#### Άγκυρες — και τι ΔΕΝ καλύπτουν

Νέα άγκυρα **εκτελεί τον παραγωγικό καλόντα** (`AddressEditor.integration.test.tsx`):
γεωκωδικοποιεί αληθινά, ζωγραφίζει τον κατάλογο, και απαιτεί απόσταση **με** αφετηρία /
καμία **χωρίς**. Μετάλλαξη «σταμάτα να περνάς την αφετηρία» ⇒ **κόκκινο**. Το mock του
`geocoding-service` **δεν δήλωνε καθόλου** το `geocodeAddressDetailed` — δηλαδή καμία
υπάρχουσα άγκυρα δεν είχε φτάσει ποτέ στη γεωκωδικοποίηση.

🔶 **Δηλωμένο κενό**: το πέρασμα `BuildingAddressesCard → BuildingAddressesEditor` (η
`projectAddresses` prop) **δεν έχει άγκυρα** — καμία σουίτα δεν ζωγραφίζει αυτά τα δύο.
Γράφεται εδώ αντί να υπονοείται.

---

### D25 — Το χαρακτηριστικό υπήρχε σε **μία** οθόνη· και δύο από τις υπόλοιπες **δεν μπορούν** να το έχουν

**RESOLVED 2026-09-05** — 3 καλωδιώσεις + 1 demo + **2 δηλωμένες εξαιρέσεις με λόγο που ελέγχεται** + πύλη κλειστού συνόλου

#### Το εύρημα

Το **D23** έδωσε στον `AddressEditor` αφετηρία εγγύτητας. Την έδωσε σε **έναν** καταναλωτή.
Το ερώτημα «ποιοι άλλοι τη ζητούν;» δεν είχε απαντηθεί — και όσο δεν απαντιόταν, το
χαρακτηριστικό ήταν για τις υπόλοιπες οθόνες **αόρατο**: η μόνη διαφορά από το ανύπαρκτο
ήταν ο κώδικας που συντηρούσαμε γι' αυτό.

⚠️ **Και ο ίδιος ο αριθμός «επτά» ήταν λάθος** — έκτη εμφάνιση του σχήματος του N.12. Το
`grep -l "<AddressEditor"` μετρά **αρχεία που αναφέρουν το όνομα**, όχι σημεία
μονταρίσματος: το `ProjectLocationsTab` είχε μόνο `useRef<AddressEditorHandle>`, το
`AddressFormSection` το αναφέρει σε **σχόλιο** *(είναι παιδί του, όχι καλών του)*, και το
`AddressEditorContext` σε **μήνυμα σφάλματος**. Τα πραγματικά σημεία είναι **έξι**.

#### Η επαλήθευση ΑΝΑ ΑΡΧΕΙΟ — γιατί η «ένδειξη» δεν ήταν απόδειξη

Το προηγούμενο σημείωμα υπέθετε ότι *«και οι έξι έχουν συμφραζόμενα διευθύνσεων, άρα η
αφετηρία είναι πιθανώς διαθέσιμη»*. Μετρήθηκε **ανά αρχείο**, και η υπόθεση **έπεσε στα
δύο τρίτα**:

| # | Καταναλωτής | Αφετηρία | Απόδειξη |
|---|---|---|---|
| 1 | `LocationInlineForm` *(μέσω `ProjectLocationsTab`)* | ✅ **καλωδιώθηκε** | `loc.localAddresses` = `ProjectAddress[]`, με `coordinates` που **γράφει** ο ένας γραφέας θέσης |
| 2 | `FrontageAddressCreateDialog` | ✅ **καλωδιώθηκε** | `project.addresses` στο ίδιο πεδίο εμβέλειας |
| 3 | `demo/addresses-editor` | ✅ **πλασματική, δηλωμένη** | δεν έχει οντότητα· υπάρχει ώστε η γραμμή απόστασης να είναι **ορατή** σε άνθρωπο |
| 4 | `BuildingAddressesEditor` | ✅ *(D23)* | — · ⚠️ **αδρανής στην πράξη**, βλ. **D24** εύρημα #4 |
| 5 | `AddressesSectionWithFullscreen` | ⛔ **αδύνατη** | `CompanyAddress` **δεν έχει πεδίο θέσης** |
| 6 | `CompanyAddressesSection` | ⛔ **αδύνατη** | ίδιο μοντέλο, ίδια απουσία |

#### 🔴 Η απόφαση που δεν ήταν στο σχέδιο: **οι δύο οθόνες επαφών ΔΕΝ καλωδιώνονται**

Το σχέδιο έλεγε «καλωδίωσε τα #2-#6, ο κανόνας είναι αποφασισμένος». Η μέτρηση το
ακύρωσε για δύο από αυτά: το `CompanyAddress` *(και το `PostalAddressFields` που
επεκτείνει, και η διοικητική ιεραρχία)* **δεν δηλώνει συντεταγμένες**. Οι πινέζες του
`ContactAddressMapPreview` γεννιούνται γεωκωδικοποιώντας **κείμενο** τη στιγμή της
απόδοσης, και η απάντηση **πετιέται** — είναι ο καταναλωτής **#1** του πίνακα «πέντε
τόποι απαντούσαν *πού είναι αυτή η διεύθυνση;*» στο `lib/geocoding/address-position.ts`.

⇒ Ένα `addressListCenter(companyAddresses)` εκεί επιστρέφει **πάντα `undefined`**.

⛔ **Καλωδίωση εκεί θα ήταν ΧΕΙΡΟΤΕΡΗ από την απουσία**: θα ήταν **σκέλος που δεν
τρέχει**, ντυμένο ως χαρακτηριστικό — το ακριβές σχήμα που το D22 και το D23 πλήρωσαν να
ξεμπερδέψουν *(42 και 13 πράσινες άγκυρες πάνω σε νεκρό κώδικα)*. **Η σιωπή είναι η τίμια
απάντηση.**

🔑 **Τι πρέπει να γίνει πρώτα** *(δικό του εύρος)*: οι διευθύνσεις επαφών να αποκτήσουν
**αποθηκευμένη** θέση μέσω του ενός γραφέα, όπως ήδη έχουν οι διευθύνσεις έργου.

#### Ο φρουρός — **μία** πύλη, όχι έξι άγκυρες

`src/components/shared/addresses/editor/__tests__/proximity-anchor-reach.test.ts`

Έξι χειρόγραφες άγκυρες φυλάνε έξι οθόνες· ο **έβδομος** καταναλωτής γεννιέται αφύλακτος.
Η πύλη παράγει τη λίστα **από το δέντρο** και ρωτά κάθε σημείο μονταρίσματος: *δηλώνεις
αφετηρία, ή είσαι δηλωμένη εξαίρεση;* Τέσσερα κριτήρια: **κανάρι άδειας σάρωσης** ·
**αδήλωτος** · **μπαγιάτικη** εξαίρεση · **αντιφατική** εξαίρεση.

🔑 **Και ο ΛΟΓΟΣ της εξαίρεσης εκτελείται**: η πύλη διαβάζει το `ContactFormTypes.ts` και
απαιτεί ότι το `CompanyAddress` εξακολουθεί να **μην** έχει πεδίο θέσης. Την ημέρα που θα
αποκτήσει, **κοκκινίζει και λέει τι να γίνει** — δεν χρειάζεται να το θυμηθεί κανείς.
*(Μια εξαίρεση με λόγο που δεν μπορεί να πάψει να ισχύει είναι απλώς η παράλειψη,
γραμμένη πιο επίσημα.)*

⚠️ **Δηλωμένο τυφλό σημείο, και καλυμμένο**: η στατική πύλη βλέπει ότι η prop *γράφτηκε*,
όχι ότι η **τιμή** φτάνει. Γι' αυτό υπάρχουν και οι άγκυρες που **εκτελούν** τη διαδρομή
*(`ProjectLocationsTab.proximity` · `FrontageAddressCreateDialog.proximity` ·
`AddressEditor.integration` του D23 · `building-addresses-card-project-anchor` του D24)*.
Η μετάλλαξη **Μ6** το αποδεικνύει: καλωδίωση μόνο στη μία από τις δύο φόρμες του
`ProjectLocationsTab` αφήνει τη στατική πύλη **πράσινη** και κοκκινίζει η άγκυρα απόδοσης.

#### SSoT audit — **τρεις** ερωτήσεις που μοιάζουν μία, και τα τρία σπίτια τους

| Η ερώτηση | Πού ζει | Γιατί **δεν** ενοποιείται |
|---|---|---|
| «ποιο **σημείο** εκπροσωπεί αυτή τη λίστα;» | `utils/address/address-list-center` | παραλείπει επίτηδες την κύρια **χωρίς** συντεταγμένες |
| «ποια **εγγραφή** εκπροσωπεί;» | `lib/primary-entry` *(D24)* | δεν κοιτά καθόλου θέση |
| «**πού να τοποθετηθεί** η νέα πινέζα για να πιαστεί;» | `useProjectLocations.handleOpenAddForm` | **κεντροειδές**, μετατόπιση 150 m, ή προεπιλεγμένο κέντρο Αθήνας — τιμές που το `addressListCenter` **απορρίπτει ρητά** |

⛔ Το τρίτο **απαγορεύεται** ως αφετηρία εγγύτητας: το προεπιλεγμένο κέντρο θα ανέβαζε την
Αθήνα **πρώτη** — η αστοχία που απέρριψε το D23, από άλλη πόρτα. Γράφεται εδώ ώστε να μην
«κεντρικοποιηθούν» αργότερα ως διπλότυπα.

#### ✅ Μετρημένα

**8/8 μεταλλάξεις κόκκινες**: αφαίρεση αφετηρίας από `LocationInlineForm` *(5 κόκκινα σε
2 σουίτες)* · από `FrontageAddressCreateDialog` *(4)* · από τη demo *(1)* · αφαίρεση
εξαίρεσης *(1)* · **προσθήκη θέσης στο `PostalAddressFields`** ⇒ ο λόγος έπαψε να ισχύει
*(1)* · καλωδίωση μόνο της μιας φόρμας *(2, με τη στατική πύλη πράσινη)* · αντιφατική
εξαίρεση *(1)* · μπαγιάτικη εξαίρεση *(2)*.

#### §πινέζα — **Η ΠΙΝΕΖΑ ΠΟΥ ΕΣΥΡΕ Ο ΑΝΘΡΩΠΟΣ ΝΙΚΑΕΙ ΤΗΝ ΟΝΤΟΤΗΤΑ** *(απόφαση Giorgio, 2026-09-05)*

Η ιεράρχηση της αφετηρίας έγινε **τρία σκαλιά**:

1. **Το σημείο που τοποθέτησε ο άνθρωπος**, αν υπάρχει.
2. Αλλιώς **το σημείο της οντότητας** — οι άλλες διευθύνσεις της λίστας (D23).
3. Αλλιώς `undefined`: *«δεν ξέρουμε πού είναι»* — δεδομένο, όχι σφάλμα.

🔑 **Γιατί ΔΕΝ αναιρεί την απόρριψη του χάρτη (D23).** Η διαφορά δεν είναι «χάρτης
εναντίον δεδομένων» — είναι **ποιος το είπε**. Το κέντρο προβολής μετακινείται από κάθε
σύρσιμο **σάρωσης** *(«τι κοιτάς τώρα», τυχαίο)*· η εκκρεμής πινέζα μετακινείται **μόνο**
από σύρσιμο **τοποθέτησης** *(«εδώ», δήλωση πρόθεσης, πριν καν πληκτρολογηθεί οδός)*.
Έργο στη Θεσσαλονίκη με νέα διεύθυνση στην Καλαμαριά κατατάσσει σωστά **μόνο** έτσι.
Κανένας από τους παρόχους που μελετήθηκαν στο D22 *(Google Address Validation, Adobe
Commerce)* δεν έχει έννοια «πού μόλις έδειξε ο άνθρωπος».

⛔ **ΚΑΙ ΕΙΝΑΙ ΜΙΑ ΓΡΑΜΜΗ ΑΠΟ ΤΗΝ ΑΣΤΟΧΙΑ ΠΟΥ ΑΠΕΡΡΙΨΕ ΤΟ D23.** Η εκκρεμής πινέζα
**υπάρχει πάντα** όσο η φόρμα προσθήκης είναι ανοιχτή, και γεννιέται σε *κεντροειδές*, ή
150 m βόρεια της μοναδικής υπάρχουσας, ή στο **προεπιλεγμένο κέντρο Αθήνας**. Αν περνιόταν
εκείνη, η αφετηρία θα ήταν **η Αθήνα για κάθε νέο έργο** — η ίδια αστοχία, από άλλη πόρτα.
Η **διάκριση** είναι όλο το χαρακτηριστικό.

#### Πώς η διάκριση έγινε αδύνατο να ξεχαστεί

| Απόφαση | Γιατί |
|---|---|
| **Καμία παράμετρος `hasDragged`** στο `resolveProximityAnchor` | Είναι *«όρισμα-κατηγόρημα που ο καλών μπορεί να ξεχάσει»* — το επιχείρημα του `lib/primary-entry.ts` (D24), αυτούσιο. Ο καλών περνά `humanPlacedPoint` **μόνο** όταν ισχύει· το **όνομα του πεδίου** κάνει τη λάθος χρήση ψέμα στο σημείο κλήσης. |
| **Η διάκριση ΔΕΝ ξαναγράφτηκε** | Το `useProjectLocations` την απαντούσε ήδη, για να αποφασίσει αν θα **αποθηκεύσει** συντεταγμένες. Εκτέθηκε ως `humanPlacedPoint`· τώρα **μία** τιμή τρέφει αποθήκευση **και** αφετηρία. |
| **Ένας επικυρωτής σημείου** | Το `usablePoint` **εξήχθη** από το `address-list-center`· ο δεύτερος έλεγχος `Number.isFinite` δεν γεννήθηκε. |
| **ΔΥΟ ονόματα αφετηρίας** στην οθόνη *(`addFormAnchor` / `entityAnchor`)* | Η φόρμα επεξεργασίας αγνοεί την πινέζα **δομικά**. Μία κοινή αφετηρία θα «δούλευε» επειδή το `handleCancelAdd` καθαρίζει — δηλαδή θα ήταν **συμπερασμός από μηχανή καταστάσεων**, και μια μελλοντική διαδρομή που δεν καθαρίζει θα μετέφερε σιωπηλά την πινέζα σε άλλη εγγραφή. |
| **Άκυρη πινέζα ΥΠΟΧΩΡΕΙ, δεν ΤΕΡΜΑΤΙΖΕΙ** | Ένα `NaN`/`Infinity` δεν σβήνει τη γνωστή θέση του έργου. Μια υλοποίηση `if ('humanPlacedPoint' in sources) return …` θα ήταν πράσινη παντού αλλού. |

#### ✅ Μετρημένα — δεύτερο κύμα

**6 ακόμη μεταλλάξεις, 6/6 κόκκινες** *(σύνολο D25: **14/14**)*: η πινέζα αγνοείται *(5
κόκκινα)* · άκυρη πινέζα τερματίζει αντί να υποχωρεί *(7)* · περνιέται η **μαντεμένη**
πινέζα *(3)* · η φόρμα επεξεργασίας παίρνει την αφετηρία της προσθήκης *(1)* · ο hook
χάνει τη διάκριση *(2)* · η σημαία σηκώνεται σε ενημέρωση χωρίς σημείο *(1)*.

🔑 **Και το ίδιο το fixture διορθώθηκε πριν μετρηθεί**: αρχικά άφηνε το `pendingDragCoords`
κενό, ενώ στην παραγωγή **δεν είναι ποτέ** κενό όσο η φόρμα είναι ανοιχτή. Με το πιστό
σχήμα, η μετάλλαξη «πέρασε τη μαντεμένη πινέζα» κοκκινίζει **3** ελέγχους αντί για 2 —
συμπεριλαμβανομένου εκείνου που την ονομάζει. *Άγκυρα που τρέφεται με είσοδο που η
παραγωγή δεν παράγει είναι μισή άγκυρα.*

🔶 **Νέα άγκυρα εκεί που δεν υπήρχε καμία**: ο φάκελος `locations/__tests__` είχε **ένα**
αρχείο *(μετατροπείς)*. Η διάκριση «το τοποθέτησε άνθρωπος;» ήταν **αφύλακτη** όσο χαλούσε
ένα πράγμα *(διεύθυνση κολλημένη στην προεπιλεγμένη θέση)*· με δύο καταναλωτές δεν είναι
αφύλακτη — είναι **διπλή**.

#### Τι ΔΕΝ έγινε — και γιατί

- ⛔ **Δεν καλωδιώθηκαν οι δύο οθόνες επαφών** — παραπάνω. → ✅ **ΕΚΛΕΙΣΕ 2026-09-11 (D27 Β-ΙΙ)**: το
  `CompanyAddress` κληρονομεί `StoredAddressPosition` (τη γράφει ο ένας γραφέας θέσης) και οι δύο οθόνες
  περνούν `suggestions={{ proximityAnchor: addressListCenter(…) }}`. Οι εξαιρέσεις της πύλης **σβήστηκαν**·
  το μπλοκ «ο λόγος ισχύει ακόμη» αντικαταστάθηκε από την **αντίστροφη** διαβεβαίωση — με `extends` η παλιά
  regex θα έμενε σιωπηλά πράσινη. Άγκυρα απόδοσης: `AddressesSectionWithFullscreen.placement.test.tsx`.
- ✅ **Η πινέζα υιοθετήθηκε** — βλ. **§πινέζα** παραπάνω *(εγκρίθηκε 05/09· είχε τεθεί ως
  ερώτηση επειδή ήταν **νέα σημασιολογία**, και το μάθημα του D12 απαγορεύει να
  αποφασίζεται σιωπηλά μέσα σε καλωδίωση)*.
- 🔶 **Η φόρμα ΕΠΕΞΕΡΓΑΣΙΑΣ δεν απέκτησε ανθρώπινη πινέζα**, και δεν είναι παράλειψη: εκεί
  το σύρσιμο υπαρκτής πινέζας περνά από **διάλογο επιβεβαίωσης** και ζει στο
  `editEditorRef`, όχι στην κατάσταση της οθόνης. Θα ήταν **δεύτερη** απόφαση.
- 🔶 **Το `useProjectLocations` είναι στις 484 γραμμές** *(όριο N.7.1: 500)*. Δεν χρειάζεται
  διάσπαση σήμερα· η επόμενη προσθήκη θα τη χρειαστεί.
- ⛔ **Δεν αγγίχθηκε το `AddressEditorMapOptions`** — νεκρό, και αφορά *ζωγραφική* χάρτη.

---

### D26 — Ο κατάλογος έδειχνε πέντε αληθινές διευθύνσεις 300 χλμ μακριά, και **καμία τους δεν υπήρχε στον χάρτη**

**RESOLVED 2026-09-05** — δεσμός καταλόγου⇄χάρτη + **δείκτες άκρης** (μηδέν αυτόματη κίνηση κάμερας) · 2 αποφάσεις Giorgio · 5 νέα αρχεία, 8 τροποποιημένα

#### Το εύρημα — μετρημένο ζωντανά

«Αθηνάς 5» *(χωρίς τοπωνύμιο)* σε έργο **Θεσσαλονίκης** ⇒ **πέντε** αληθινές διευθύνσεις
σε πέντε δήμους της Αττικής, **292-318 χλμ**, **όλες με βεβαιότητα 65%**. Στον χάρτη
δεξιά — που είναι το μισό της οθόνης — **καμία**. Ο άνθρωπος διάλεγε διαβάζοντας ονόματα
δήμων και έναν αριθμό χιλιομέτρων, ενώ το μόνο ορατό ήταν το εργοτάξιο που **ήδη ήξερε**.

🔑 **Και ΤΙΠΟΤΑ σχεδόν δεν έλειπε.** Ο `AddressMap` είχε ήδη `activeEditingAddressId`,
`onMarkerClick`, `readOnlyAddressIds`· το `ProjectLocationsTab` έβαζε ήδη **συνθετική**
πινέζα (`PENDING_ID`)· η αναζήτηση ακινήτων είχε ήδη **ολόκληρο** τον δεσμό λίστας⇄χάρτη
*(`ListingCard` / `ResultsList` / `SearchResultsContent`)*. Έλειπε **μόνο η σύνδεση**.

#### 🔴 Απόφαση #1 (Giorgio 05/09): **η κάμερα ΔΕΝ κουνιέται μόνη της**

Η προφανής λύση ήταν η πρακτική του **Zillow**: μόλις εμφανιστεί ο κατάλογος, fit-bounds
ώστε να χωρέσουν υποψήφιοι + αφετηρία. Απορρίφθηκε, και ο λόγος είναι **αριθμητικός**:

| | Zillow / Idealista / Airbnb | εδώ |
|---|---|---|
| πόσο μακριά τα αποτελέσματα | **εντός πόλης** | **292-318 χλμ** |
| τι δείχνει το fit-bounds | γειτονιές, αναγνωρίσιμες | **μισή Ελλάδα**, έξι κουκκίδες |
| τι είναι ο χάρτης | **η ίδια η αναζήτηση** | **το έργο** |

Δηλαδή στα 300 km το fit-bounds δείχνει *«μακριά»*, **όχι** *«πού»* — και ταυτόχρονα
πετάει τον άνθρωπο έξω από κάδρο που δεν ζήτησε να αλλάξει.

#### 🏆 Απόφαση #2 (Giorgio 05/09): **δείκτες άκρης** — και εδώ ξεπερνάμε τους μεγάλους

Ό,τι δεν χωράει στο κάδρο εμφανίζεται ως **δείκτης κολλημένος στην άκρη του χάρτη**,
στραμμένος προς τα εκεί, με τον αριθμό της γραμμής. Η κάμερα μένει ακίνητη.

Το μοτίβο είναι καθιερωμένο *(«digital signposts» της χαρτογραφίας, off-screen indicators
των παιχνιδιών)* αλλά **κανένας** επιλογέας διεύθυνσης δεν το εφαρμόζει — επειδή κανένας
τους δεν έχει υποψήφιους 300 χλμ μακριά. Και το Google Places Autocomplete δεν έχει καν
χάρτη. Άρα εδώ **δεν αντιγράφουμε· συνθέτουμε**.

**Τρία σημεία υπεροχής, όλα μετρήσιμα:**

1. **Οι πινέζες είναι ΑΡΙΘΜΗΜΕΝΕΣ, με τον ίδιο αριθμό της γραμμής.** Η αντιστοίχιση
   διαβάζεται **χωρίς καμία χειρονομία**· ο Zillow απαιτεί hover για να τη μάθεις.
2. **Ο δεσμός ακολουθεί το ΠΛΗΚΤΡΟΛΟΓΙΟ.** Ο κατάλογος είχε ήδη πλοήγηση με βελάκια·
   ο δεσμός δένεται στην **ενεργή επιλογή** *(hover **ή** focus)*, όπως το precedent
   `ListingCard.tsx:181-184`. Ο Zillow είναι ποντικοκεντρικός.
3. **Ο χάρτης δείχνει την ΑΦΕΤΗΡΙΑ μαζί με τους υποψήφιους** *(κουμπί «δες τα όλα»)*.
   Η κατάταξη λέει «296 χλμ»· ο χάρτης απαντά **από πού**. Κανένας επιλογέας δεν το
   κάνει, επειδή κανένας δεν έχει αφετηρία εγγύτητας — **εμείς την αποκτήσαμε στο D23/D25**.

#### Η αρχιτεκτονική — τρεις αποφάσεις που κάνουν την αστοχία ΔΟΜΙΚΑ αδύνατη

**1. Οι υποψήφιοι ΔΕΝ γίνονται `ProjectAddress`.** Ήταν ο εύκολος δρόμος *(το `PENDING_ID`
είναι ακριβώς αυτό)* και απορρίφθηκε με μέτρηση: το `addresses` τρέφει τη
γεωκωδικοποίηση, την ανίχνευση παλαιότητας, τη σειρά συρσίματος *(το
`onAddressDragUpdate` δεικτοδοτεί με `index`)* **και το αυτόματο fit-bounds**. Πέντε
ψεύτικες διευθύνσεις θα ξεκινούσαν και τα τέσσερα — και το τέταρτο είναι **ακριβώς η
συμπεριφορά που απορρίφθηκε στην απόφαση #1**. Αντ' αυτού ο `AddressMap` απέκτησε
`overlay`: **δεν είναι νέα τρύπα, είναι τοίχος που έπεφτε κατά λάθος** — ο
`InteractiveMap` δέχεται `children` εδώ και καιρό (`InteractiveMapContainer:393`) και ο
`AddressMap` απλώς **τα κατάπινε**.

**2. Η ταυτότητα του δεσμού είναι το `originalRank`, ΠΟΤΕ η θέση στη λίστα.** Η εγγύτητα
**ανακατατάσσει** *(αυτός είναι ο λόγος ύπαρξης του `originalRank`)*, οπότε δεσμός με
δείκτη θέσης θα τόνιζε **άλλη γραμμή** από αυτή που δείχνει ο δείκτης, ακριβώς τη στιγμή
που αλλάζει η κατάταξη.

**3. Η πράξη επιλογής ταξιδεύει ΜΑΖΙ με τα δεδομένα** (`SuggestionMapReport`). Η
εναλλακτική ήταν `ref` προς τον συντάκτη + `selectSuggestion(rank)` — και **γράφτηκε
πρώτα, μετά αφαιρέθηκε**: αυτή η οθόνη έχει **δύο** συντάκτες *(προσθήκη / επεξεργασία)*
με **δύο** καταλόγους. Ένα `rank` σε λάθος συντάκτη **βρίσκει** εκεί δικό του υποψήφιο με
τον ίδιο αριθμό και διαλέγει **άλλη διεύθυνση**, σιωπηλά. Δεμένη έτσι, η αστοχία δεν
χρειάζεται φύλακα — **δεν μπορεί να συμβεί**.

#### Τι έπιασαν οι άγκυρες που δεν θα έπιανε κανένα στιγμιότυπο

🔴 **Κενό στην αρίθμηση.** Το `toMapCandidates` έδινε `position: index + 1` πάνω στον
πίνακα **εισόδου**: ένας υποψήφιος με μη πεπερασμένη συντεταγμένη απορρίπτεται, και η
οθόνη έγραφε **«2, 3»** — ο άνθρωπος θα έψαχνε πινέζα «1» που δεν υπάρχει. Πλέον μετράει
**όσα μπήκαν**, όχι σε ποια θέση εισόδου βρισκόμαστε.

🔴 **Έμφαση που επιβιώνει από κατάλογο σε κατάλογο.** Ο `originalRank` είναι μοναδικός
**μέσα** σε έναν κατάλογο, όχι ανάμεσα σε δύο — ο επόμενος αριθμεί κι αυτός από το μηδέν.
Κρατημένη έμφαση θα τόνιζε **άλλη διεύθυνση** και θα φαινόταν απολύτως φυσιολογική. Το
σβήσιμο ζει στο `useSuggestionMapBond`, με δική του άγκυρα.

#### Αρχεία

| Αρχείο | Τι |
|---|---|
| `lib/geo/offscreen-edge-indicator.ts` | **νέο** — καθαρή γεωμετρία: πού ακουμπά την άκρη η ακτίνα προς σημείο εκτός κάδρου. Μηδέν DOM, μηδέν React ⇒ **αποδεικνύεται** |
| `components/shared/addresses/address-map-candidates.ts` | **νέο** — το συμβόλαιο· `rank` *(ποιος)* vs `position` *(πόστος)*· είσοδος **δομική**, όπως το `AddressChoiceLike` |
| `components/shared/addresses/AddressMapCandidateLayer.tsx` | **νέο** — πινέζες + δείκτες άκρης + «δες τα όλα» |
| `components/shared/addresses/useSuggestionMapBond.ts` | **νέο** — ο δεσμός, κοινός· τοπικό `useState` όπως το `SearchResultsContent:68` |
| `editor/hooks/useSuggestionMapReport.ts` | **νέο** — τι φεύγει προς τα έξω και πότε σβήνει |
| `AddressMap.tsx` · `address-map-config.tsx` | `overlay` |
| `editor/types.ts` · `AddressEditor.tsx` · `AddressSuggestionsPanel.tsx` · `editor/index.ts` | ο δεσμός, από άκρη σε άκρη |
| `LocationInlineForm.tsx` · `ProjectLocationsTab.tsx` | η καλωδίωση της οθόνης |
| `locales/{el,en}/addresses.json` · `types/i18n.ts` | **ένα** κλειδί: `map.fitCandidates` *(εγκρίθηκε ρητά· το παραγόμενο άλλαξε **μόνο** εκεί — επαληθεύτηκε με `git diff`)* |

#### Απόφαση για το `LocationInlineForm`: **ολόκληρη η ομάδα, όχι ένα-ένα τα πεδία**

Το `proximityAnchor?: {lat,lng}` έγινε `suggestions?: AddressEditorSuggestionOptions`.
Ήταν χειρόγραφο αντίγραφο **ενός** πεδίου· κάθε νέο πεδίο θα απαιτούσε δεύτερη δήλωση, και
η παράλειψη θα ήταν prop που ο καλών **δεν μπορεί να περάσει**, σιωπηλά. Είναι κατά λέξη
το εύρημα που κατέγραψε ο `InteractiveMap` *(«ήταν χειρόγραφο αντίγραφο 40 γραμμών… και
είχε ήδη αποκλίνει»)*.

⚠️ **Συνέπεια στην πύλη**: το `ProjectLocationsTab.proximity.test.tsx` βεβαίωνε
`toEqual({ proximityAnchor })` πάνω σε **ολόκληρο** το αντικείμενο. Η επιβεβαίωση
στοχεύει πλέον **την αφετηρία** — που ήταν πάντα ο ισχυρισμός του αρχείου. Η πύλη
`proximity-anchor-reach` μένει **ανέπαφη**: ελέγχει την παρουσία του `suggestions=`.

#### Ανοιχτά — δηλωμένα, όχι ξεχασμένα

- 🔶 **`AddressEditor.tsx` στις 466 γραμμές, `ProjectLocationsTab.tsx` στις 492,
  `AddressMap.tsx` στις 493** *(όριο N.7.1: 500)*. Ο πρώτος διασπάστηκε ήδη σε αυτή τη
  δουλειά (`useSuggestionMapReport`). Οι άλλοι δύο **θα το χρειαστούν στην επόμενη
  προσθήκη** — η εξαγωγή, όχι το κόψιμο σχολίων.
- 🔶 **Ο `AddressMapCandidateLayer` δεν έχει άγκυρα απόδοσης**: εισάγει `maplibre-gl`, που
  απαιτεί `URL.createObjectURL` — ανύπαρκτο στο jsdom. Η **γεωμετρία** του *(το μέρος που
  μπορεί να είναι λάθος σιωπηλά)* είναι πλήρως αγκυρωμένη ξεχωριστά.
  🔴 **ΔΙΟΡΘΩΣΗ 2026-09-05 (§D26.1)**: αυτή η γραμμή έλεγε επίσης «η **σύνθεση**
  επαληθεύτηκε με **περπάτημα οθόνης**» — **ψευδές, το περπάτημα δεν είχε γίνει**. Έγινε,
  και βρήκε **τρία** ελαττώματα. Η όψη μετακόμισε στο `address-map-edge-indicator.tsx`,
  που **δεν** εισάγει χάρτη και **είναι** αγκυρωμένη. Ένα περιβάλλον με WebGL για τον
  ίδιο τον layer θα ήταν δική του απόφαση.
- 🔶 **Το κατώφλι `proximityCapM = 5 km` παραμένει απόλυτο.** Στα 300 km κάθε υποψήφιος
  δίνει όρο εγγύτητας **0**, οπότε με ταυτόσημη βεβαιότητα η σειρά πέφτει πίσω σε αυτήν
  του παρόχου — γι' αυτό η οθόνη δείχνει **296 → 318 → 301 → 292 → 297**. **Είναι σωστό**
  *(στα 300 km το «ποιος είναι πιο κοντά» δεν σημαίνει τίποτα)*, και αυτή η δουλειά το
  λύνει **οπτικά**. Το αν το κατώφλι πρέπει να γίνει μαλακό είναι **ξεχωριστή απόφαση**.
- 🔶 **Ο δεσμός δόθηκε μόνο στο `ProjectLocationsTab`.** Είναι το ένα από τα έξι σημεία
  μονταρίσματος με χάρτη **δίπλα στον κατάλογο**· τα υπόλοιπα θα το πάρουν με τρεις
  γραμμές, επειδή ο δεσμός έγινε **κοινός** (`useSuggestionMapBond`) και όχι τοπικός.

---

#### D26.1 — Το περπάτημα της οθόνης, και τα **τρία** ελαττώματα που βρήκε *(2026-09-05, απόγευμα)*

> 🔑 **Η υπόσχεση της προηγούμενης ενότητα ήταν πρόωρη.** Το «η σύνθεση επαληθεύτηκε με
> περπάτημα οθόνης» γράφτηκε **πριν** γίνει το περπάτημα. Έγινε τώρα, και βρήκε **τρία**
> ελαττώματα σε κώδικα με **524 πράσινες άγκυρες** και **18/18** κόκκινες μεταλλάξεις —
> τρίτη επιβεβαίωση του μοτίβου D23 → D25 → D26.

**Πώς μετρήθηκαν** *(οθόνη «Διευθύνσεις Έργου», έργο Θεσσαλονίκης, «Αθηνάς 5» ⇒ 5
υποψήφιοι σε 1 / 119 / 127 / 297 / 1.096 χλμ)*:

| # | Ελάττωμα | Όργανο | Μέτρηση |
|---|---|---|---|
| **Ε1** | το βέλος έδειχνε **45° λάθος** σε **κάθε** υποψήφιο | `getScreenCTM()` στο ίδιο το πολύγωνο | +45,0° σε **4/4** |
| **Ε2** | το βέλος **αόρατο** στο σκοτεινό θέμα | υπολογισμένη αντίθεση | **1,06 : 1** *(WCAG 1.4.11 ζητά ≥ 3 : 1)* |
| **Ε3** | ο δείκτης πάνω στο «δες τα όλα» | τομή ορθογωνίων DOM | επικάλυψη **15×23 px** |

##### Ε1 — η γεωμετρία ήταν σωστή· η **όψη** ήταν λάθος

Το `Navigation` του `lucide` **δεν δείχνει πάνω**: πολύγωνο `3 11 · 22 2 · 13 21 · 11 13`,
κορυφή **(22, 2)**, εγκοπή **(11, 13)** ⇒ άξονας `(+11, −11)` = **βορειοανατολικά**. Με
`rotate(angleDeg)` πάνω σε αυτό, κάθε δείκτης έδειχνε **45° δεξιόστροφα**.

🔴 **Γιατί καμία από τις 16 άγκυρες της γεωμετρίας δεν μπορούσε να το πιάσει**: έλεγχαν
το `angleDeg`, **και το `angleDeg` ήταν σωστό**. Επαληθεύτηκε ανεξάρτητα με προβολή
Mercator *(Άγιοι Ανάργυροι: 168,2° υπολογισμένο vs 167,0° αποδοθέν)*. Το λάθος ζούσε
**ανάμεσα** στον σωστό αριθμό και στην εικόνα — σε αρχείο που εισάγει `maplibre-gl`,
δηλαδή **δεν εκτελείται ποτέ σε jsdom**.

**Διόρθωση**: `Navigation2` — πολύγωνο `12 2 · 19 21 · 12 17 · 5 21`, κορυφή **(12, 2)**
ακριβώς πάνω από την εγκοπή **(12, 17)**: άξονας **κατακόρυφος**. Η σύμβαση που ο κώδικας
**δήλωνε**, γίνεται αληθινή.

⚠️ **ΔΕΝ αφαιρέθηκαν 45 μοίρες.** Μια σταθερά αντιστάθμισης θα έδενε τη σωστή εικόνα σε
**αδήλωτο** χαρακτηριστικό ξένης βιβλιοθήκης: αναβάθμιση του `lucide` που ισιώνει το
εικονίδιο θα το χαλούσε **ξανά**, σιωπηλά.

##### Ε2 — το βέλος δανειζόταν φόντο από τον **χάρτη**

Ήταν `text-foreground/70` με `fill: none` — περίγραμμα χωρίς γέμισμα. Από κάτω του δεν
είναι η εφαρμογή αλλά **ο χάρτης**, ανοιχτόχρωμος **και στα δύο θέματα**: μετρημένο
`rgba(248, 250, 252, 0.7)` πάνω σε πλακίδιο OSM ⇒ **1,06 : 1**. Σε φωτεινό θέμα ο ίδιος
κανόνας δίνει ~6 : 1 — γι' αυτό ήταν αόρατο σε κάθε έλεγχο που δεν άλλαξε θέμα.

🔑 **Η ταμπέλα δίπλα του είχε ήδη τη λύση** *(βάφει δικό της `bg-background`)*. Πλέον τα
δύο μοιράζονται **ΕΝΑ** δηλωμένο ζεύγος (`SIGN_PAINT`): η απόκλιση δεν αποφεύγεται με
προσοχή — **δεν μπορεί να γραφτεί**.

##### Ε3 — **δύο ερωτήματα, ένα περιθώριο**

Το κέλυφος του χάρτη δεν είναι συμμετρικό: το «δες τα όλα» κάθεται **κάτω κεντρικά**, και
ο δείκτης ενός υποψήφιου **ακριβώς νότια** πέφτει στο ίδιο σημείο. Δεν ήταν ατυχία —
ήταν **βεβαιότητα** για κάθε φορά κοντά στις 180°.

Η ρίζα ήταν ότι **ένα** περιθώριο απαντούσε σε **δύο** ερωτήματα:

| Ερώτημα | Ποιος απαντά τώρα |
|---|---|
| *«φαίνεται η ίδια η πινέζα, ή είναι κομμένη;»* | `inset` — **ομοιόμορφο**, 24 px |
| *«πού επιτρέπεται να καθίσει ο δείκτης;»* | `placement: EdgeInsets` — **ανά πλευρά** |

⚠️ **Και ο διαχωρισμός δεν είναι καλλωπισμός**: με ένα κοινό περιθώριο, η δέσμευση 66 px
για το κουμπί θα σήμαινε ότι πινέζα **50 px πάνω από την κάτω ακμή** — απολύτως ορατή —
θα κρινόταν «κρυμμένη» και θα έπαιρνε **και** δείκτη: δύο σημεία για μία διεύθυνση,
δηλαδή ακριβώς αυτό που το `null` της συνάρτησης υπάρχει για να αποτρέπει. Το φυλάει
δική του άγκυρα.

Το `EDGE_PLACEMENT_INSETS.bottom` **υπολογίζεται** από το `FIT_BUTTON_BOX` *(`bottom-3` +
30 px ύψος)* + διάκενο + μισό τονισμένο σήμα = **66 px**, ποτέ γραμμένο ως αριθμός.

##### Τι επαληθεύτηκε ΖΩΝΤΑΝΑ και βγήκε **σωστό** *(μην ξαναδοκιμαστεί)*

- Ένας δείκτης **ανά υποψήφιο εκτός κάδρου**, κολλημένος στην ακμή στο δηλωμένο περιθώριο.
- Το `angleDeg` **σωστό** σε 4/4, επαληθευμένο ανεξάρτητα με Mercator.
- Ο δείκτης **σβήνει** μόλις ο υποψήφιος μπει στο κάδρο — μετρημένη ακολουθία **5 → 4 → 0**
  *(το `null` σκέλος, ζωντανά)*.
- Το «δες τα όλα» κινεί την κάμερα ώστε να δείχνει **εργοτάξιο + υποψηφίους** *(ως την
  Κύπρο)*, και **μόνο** όταν πατηθεί.
- Οι θέσεις ακολουθούν κάθε αλλαγή κάμερας *(διαδρομή `map.on('move' | 'resize')`)*.

##### Νέο αρχείο, και **γιατί**

`components/shared/addresses/address-map-edge-indicator.tsx` — η **όψη** του σήματος
*(εικονίδιο, χρώματα, δεσμευμένος χώρος)*, χωρίς `maplibre-gl`.

🔑 **Η θεραπεία δεν ήταν «γράψε κι άλλα test» — ήταν να ΜΕΤΑΚΟΜΙΣΕΙ η απόφαση σε μέρος
όπου μπορεί να ερωτηθεί.** Ό,τι έμενε μέσα στον `AddressMapCandidateLayer` ήταν δομικά
αδύνατο να αγκυρωθεί, και ακριβώς εκεί κρύφτηκαν τα Ε1 και Ε2. Παράπλευρο κέρδος:
ο layer έπεσε **428 → 393** γραμμές (**EXTRACT**, όχι trim — N.7.1).

##### Η επαλήθευση **μετά** τη διόρθωση — ίδια όργανα, ίδια οθόνη

| Τι | Πριν | Μετά |
|---|---|---|
| σφάλμα φοράς *(`getScreenCTM`, 4 υποψήφιοι)* | **+45,0°** σε 4/4 | **0,0°** σε 4/4 |
| γέμισμα βέλους, σκοτεινό θέμα | `none` ⇒ **1,06 : 1** | `rgb(22, 26, 34)` ⇒ **≈ 14,9 : 1** |
| γέμισμα βέλους, φωτεινό θέμα | — | `rgb(220, 235, 254)` με μελάνι `rgb(15, 23, 42)` ⇒ **≈ 14,9 : 1** |
| επικάλυψη με το «δες τα όλα» | **15×23 px** | **καμία**, με **6 px** ανάσα στη χειρότερη φορά |

🔑 **Το ζεύγος αντέχει και στα δύο θέματα για ΔΙΑΦΟΡΕΤΙΚΟ λόγο**, και αυτό είναι το ζητούμενο:
στο σκοτεινό το **γέμισμα** ξεχωρίζει από τον ανοιχτόχρωμο χάρτη, στο φωτεινό το
**περίγραμμα**. Ένα σχήμα με αδιαφανές γέμισμα **και** αντίθετο μελάνι δεν εξαρτάται από
το τι έτυχε να είναι από κάτω — ούτε καν από το αν φόρτωσαν τα πλακίδια.

✅ **Οι δηλωμένες σταθερές επαληθεύτηκαν στο ζωντανό κέλυφος**: το κουμπί μετρήθηκε
`bottom: 12 px`, `height: 30 px` — **ταυτόσημο** με το `FIT_BUTTON_BOX`. Η δέσμευση δεν
είναι εικασία.

**Μεταλλάξεις**: **10/10 κόκκινες** *(εικονίδιο · κρυφή αντιστάθμιση · `fill:none` ·
διαφάνεια μελανιού · άρση δέσμευσης · παράλειψη περιθωρίων στο περιτύλιγμα · σύγχυση
ορατότητας/τοποθέτησης · άρση του `Math.max` · όριο Y χωρίς πρόσημο · άρση του ελέγχου
δεσμευμένης πλευράς)*. **Σουίτα**: `544/544`, 39 σουίτες *(από `524/524`, 38)*.

⚠️ **Δύο μεταλλάξεις γύρισαν ΠΡΑΣΙΝΕΣ και δεν αγνοήθηκαν** — και οι δύο δίδαξαν κάτι:
1. Η άγκυρα του Ε3 δοκίμαζε τη **σταθερά**, όχι τη διαδρομή που καλεί η οθόνη: η
   παράλειψη των περιθωρίων **από τον `AddressMapCandidateLayer`** έμενε πράσινη. Γι' αυτό
   γεννήθηκε το `edgeIndicatorForCandidate` — άγκυρα και οθόνη καλούν πλέον **την ίδια
   συνάρτηση**, και δεν υπάρχει παράμετρος να ξεχαστεί.
2. Ο έλεγχος «τα περιθώρια είναι αριθμοί;» ήταν **νεκρός** — το `NaN` το έπιανε ήδη ο
   φράχτης του `scale`. Αφαιρέθηκε: πλεονασμός που δεν μπορεί να κοκκινίσει δεν είναι
   ασφάλεια.

##### Το σύρσιμο της εκκρεμούς πινέζας — **η κληρονομιά του D25 έκλεισε** *(2026-09-06)*

Ήταν **γραμμένο με 16/16 κόκκινες μεταλλάξεις αλλά ποτέ δοκιμασμένο από άνθρωπο**: ο
αυτοματισμός **δεν μπορεί** να το κάνει — δοκιμάστηκαν `MouseEvent` **και** `PointerEvent`
απευθείας στον marker, η maplibre απορρίπτει και τα δύο *(δεύτερη ανεξάρτητη επιβεβαίωση)*.
Το σύρσιμο έγινε με **ανθρώπινο χέρι**, από τη Θεσσαλονίκη προς τη Στερεά Ελλάδα.

| Υποψήφιος | Από το εργοτάξιο | Από τη νέα θέση |
|---|---|---|
| Κουλέ Καφέ, Θεσσαλονίκη | 1 χλμ. | **174 χλμ.** |
| Άγιος Αθανάσιος, Λάρισα | 119 χλμ. | **75 χλμ.** |
| Ποταμούδια, Καβάλα | 127 χλμ. | **245 χλμ.** |
| Άγιοι Ανάργυροι, Αττική | 297 χλμ. | **137 χλμ.** |
| Στρόβολος, Κύπρος | 1.096 χλμ. | **1.024 χλμ.** |

🔑 **Το κριτήριο δεν ήταν «άλλαξαν»** — αυτό το πετυχαίνει και ένα σφάλμα. Οι πέντε
αποστάσεις **τριγωνίστηκαν** και δείχνουν όλες στο **ίδιο** νέο σημείο, ≈ (39,0° Β,
22,9° Α). Η αφετηρία εγγύτητας ακολουθεί **πραγματικά** την πινέζα, και **αντιδραστικά**:
οι τιμές ενημερώθηκαν **χωρίς** επαναπληκτρολόγηση.

✅ **Και η ίδια κίνηση επαλήθευσε ΚΑΙ τη ροή επιβεβαίωσης του D25 / ADR-277.** Τα πεδία
Περιοχή / Τ.Κ. / Πόλη έδειχναν «Δεν συμπληρώθηκε» **όχι** επειδή απέτυχε η αντίστροφη
γεωκωδικοποίηση, αλλά επειδή ο διάλογος **«Επιβεβαίωση Αλλαγής Θέσης»** ήταν ανοιχτός και
περίμενε τον άνθρωπο, με σύνοψη *«**1 πεδίο αλλάζει** — Οδός: `Αθηνάς` → `Παράλευκη Οδός`»*.
Δηλαδή: **καμία σιωπηλή αντικατάσταση** — ακριβώς η υπόσχεση του πίνακα «Reconciliation».

🔴 **ΤΟ ΔΙΔΑΓΜΑ ΤΗΣ ΣΤΙΓΜΗΣ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΜΙΚΡΟ**: το «τα πεδία έμειναν κενά» διαβάστηκε
πρώτα ως πιθανό **τέταρτο ελάττωμα**, με έτοιμη εξήγηση *(«ορεινό σημείο, αραιό αποτέλεσμα
του παρόχου»)* — αληθοφανή, τεκμηριωμένη με ανάγνωση κώδικα, και **λάθος**. Την ανέτρεψε
**ένα στιγμιότυπο**: υπήρχε ολόκληρος modal διάλογος που το DOM query των πεδίων δεν
κοίταξε ποτέ. **Το ερώτημα «τι δείχνει η οθόνη;» δεν απαντιέται με `querySelector` στα
πεδία που υποψιάζεσαι.**

##### Παρατήρηση που **δεν** διορθώθηκε *(εκτός D26)*

Στη μετάβαση **πλήρους οθόνης** ο καμβάς της maplibre μένει πίσω από το δοχείο κατά
**70 px** *(μετρημένο: δοχείο 1186×1077 vs καμβάς 1186×1007)*, δηλαδή ο χάρτης
ζωγραφίζεται σε μικρότερο ορθογώνιο από αυτό που πιάνει. Στη **φυσιολογική** διάταξη
συμφωνούν, και μετά από επάνοδο επανέρχονται. Ανήκει στον χειρισμό `resize` του
`AddressMap`/του δοχείου πλήρους οθόνης — **όχι** στον δεσμό του D26.

---

### D27 — Το σύρσιμο πινέζας δεν «κολλούσε» όταν ξαναέγραφε το κείμενο *(2026-09-10)*

**Αναφορά.** «Διαμέρισμα 80 τ.μ.» (ERGO TEST → KTIRIO A TEST): η δημόσια σελίδα έγραφε «Δρόμος
χωρίς αριθμό», ενώ η διεύθυνση του έργου είναι «Σαμοθράκης **16**, Ελευθέριο Κορδελιό, 56334».

**Η ταξινόμηση ήταν σωστή.** Ζωντανό ερώτημα στο Nominatim: `class: highway`, `type: residential`,
`place_rank: 26`, **χωρίς** `address.house_number` ⇒ `determineAccuracy` → `interpolated` →
`pin-with-ring`. Το OSM ξέρει τον δρόμο, όχι τον αριθμό.

**Η θεραπεία ήταν αδύνατη.** Σύρσιμο → `reverseGeocode` → `AddressDragConfirmDialog` →
`handleAddressDragUpdate` ξαναγράφει οδό, **αριθμό** (άνευ όρων) και δήμο → `PATCH` →
`resolveAddressPosition`: ο κανόνας 1 απαιτούσε `!identityMoved` ⇒ δεν πιάνει ⇒ ο κανόνας 3
γεωκωδικοποιεί το **νέο** κείμενο ⇒ συντεταγμένες μηχανής **αντί** για του ανθρώπου, πάλι
`interpolated`. Η υπόδειξη της ίδιας της εφαρμογής («σύρε την πινέζα») ακυρωνόταν σιωπηλά.

**Απόφαση: δήλωση, όχι συμπερασμός.**

| Σκέλος | Αλλαγή |
|---|---|
| Πελάτης | `applyDraggedPin(addr, dragged, mode)` — **ΕΝΑ** σημείο, γράφει **πάντα** `source: 'dragged'` |
| Διακομιστής | κανόνας 1: `(!identityMoved \|\| incoming.source === 'dragged') && pointChanged` |
| Διάλογος | προαιρετικό `onConfirmPositionOnly` → «Μόνο η θέση — κράτα τη διεύθυνση» |

**Γιατί η δήλωση είναι ασφαλής:** στον τομέα έργων οι **μόνοι** client writers συντεταγμένων είναι
διαδρομές συρσίματος (`useProjectLocations` / `ProjectLocationsTab` — μετρημένο με grep). Η δήλωση
μετρά **μόνο με αλλαγμένο σημείο**: ένα μπαγιάτικο `dragged` που ξαναστέλνεται με `{...addr}` **δεν**
παγώνει τη διεύθυνση (άγκυρα Κ1ε). Την **αποθηκευμένη** προέλευση την αποφασίζει πάντα ο διακομιστής
(`applyAddressPosition`).

**🔴 Δεύτερο εύρημα — η θέση του συρσίματος ήταν η θέση ΤΗΣ ΜΗΧΑΝΗΣ.** Βρέθηκε στη ζωντανή
επαλήθευση, **πριν** από το σύρσιμο, διαβάζοντας τη διαδρομή που θα γινόταν εγγραφή:
`handleDragEnd` → `reverseGeocode(lat, lng)` → `reverseResultToAddress(result)` έγραφε
`coordinates: result.lat/lng` — και ο διακομιστής αντίστροφης (`/api/geocoding/reverse`,
`formatReverseResult`) επιστρέφει το σημείο του **αντικειμένου OSM που ταίριαξε**, όχι το ζητούμενο.
Μετρημένο ζωντανά στο Nominatim: πόρτα `40.6641899, 22.8974273` → `40.6643548, 22.8975059` = ο
**δρόμος** (way 15743648), **19,5 μ.** μακριά· δεύτερο σημείο → 14,3 μ., ίδιος δρόμος. Μαζί με το
`applyDraggedPin` (`source: 'dragged'`) αυτό θα γινόταν «Ακριβής διεύθυνση · Πινέζα που έβαλε
άνθρωπος» **πάνω στον άξονα του δρόμου** — χειρότερο από το «Στον δρόμο» που διορθώναμε. Τα 333
πράσινα δεν το είδαν: το `applyDraggedPin` δοκιμαζόταν με **έτοιμες** συντεταγμένες και **κανένα**
test δεν άγγιζε το `reverseResultToAddress`.

**Διόρθωση — ΕΝΑ σημείο:** `reverseResultToAddress(result, dropPoint)` — η **θέση** από το χέρι, το
**κείμενο** από τη μηχανή (η αντίστροφη απαντά «τι γράφει εδώ», όχι «πού είναι»). Μοναδικός καλών
`useAddressMapGeocoding.ts` (`handleDragEnd`) ⇒ διορθώνονται **όλοι** οι χάρτες διευθύνσεων και **και
τα δύο** κουμπιά του διαλόγου· η πινέζα στην οθόνη (`dragPositions`) και η αποθηκευμένη θέση είναι
πλέον **το ίδιο** σημείο. Άγκυρα `__tests__/drag-drop-point.test.ts` (4) — εκτελεί τον **πραγματικό**
`handleDragEnd` (mock μόνο δίκτυο/WebGL), με τις μετρημένες τιμές· μεταλλάξεις **2/2** (βοηθός που
επιστρέφει το σημείο της μηχανής → 3 κόκκινα · καλών που το περνά → 2 κόκκινα). Παλινδρόμηση
**324/324** σε 27 σουίτες (`shared/addresses` + `projects/tabs` + `address-position`).

**✅ Επαληθεύτηκε ζωντανά — 2026-09-10, τοπικά** (dev → Firestore `pagonis-87766`, **κοινή** με την
παραγωγή — ρητό ΟΚ Giorgio). **Η πόρτα δεν μαντεύτηκε:** Google Street View «16 Σαμοθράκης» (Μάρ 2026)
→ ο Giorgio σημείωσε την είσοδο **1** (γραφεία· η **2**, των διαμερισμάτων, είναι μέσα στην πυλωτή —
ίδια πολυκατοικία, ίδια διεύθυνση)· και οι δύο επιχειρήσεις του κτιρίου δηλώνουν «Σαμοθράκης 16» στο
Google Maps. Σημείο = τομή της ακτίνας από την κάμερα (`40.6642991, 22.8975408`, αζιμούθιο **200,6°** —
δύο λήψεις με άλλο οπτικό πεδίο συμφωνούν ±0,1°) με την ακμή πρόσοψης του OSM (way 974517331, 17,8 μ.,
τομή στο 49,8% — εκεί που το Street View δείχνει την πόρτα) ⇒ **`40.6642462, 22.8975146`** (±2 μ.).

| Βήμα | Μέτρηση |
|---|---|
| Κάρτα πριν | «Στον δρόμο, όχι στην πόρτα» + υπόδειξη ✅ |
| Σύρσιμο (ζουμ 19,5 · 0,08 μ./px) | άκρη πινέζας **0,05 μ.** από τον στόχο |
| Διάλογος | «Αριθμός: 16 → **θα σβηστεί**» · εστίαση στο «Μόνο η θέση» ✅ |
| Firestore έργου | `40.66424605, 22.89751400` · `source: 'dragged'` · **χωρίς** `geocodingMetadata` · `number: '16'` ✅ |
| Firestore αγγελίας | `position.provenance: 'manual'`, **ίδιο** σημείο, χωρίς `accuracy` (πριν: `geocoded` / `interpolated`) ✅ |
| Κάρτα μετά από επαναφόρτωση | «Ακριβής διεύθυνση — η πινέζα δείχνει το κτίριο», χωρίς υπόδειξη ✅ (πριν την επαναφόρτωση ⚠️ — ανοιχτό 4) |
| Δημόσια σελίδα (τοπικά) | «Τι ακριβώς ξέρουμε: **Ακριβής διεύθυνση**» · «Από πού προκύπτει η θέση: **Πινέζα που έβαλε άνθρωπος**» ✅ |

Χωρίς τη διόρθωση του δεύτερου ευρήματος, το **ίδιο** σύρσιμο θα είχε γράψει `40.6643548, 22.8975059`
(τον δρόμο) ως `dragged`.

**Ανοιχτά — δεν λύθηκαν εδώ, με λόγο:**

1. ✅ **ΛΥΘΗΚΕ ΤΗΝ ΙΔΙΑ ΜΕΡΑ (απόφαση Giorgio).** Το `diffAddressFields` **δεν** μετρά το άδειασμα
   πεδίου ως διαφορά — σωστά για τη συμφιλίωση, λάθος για τον διάλογο συρσίματος: «16 → κενό» ⇒
   **μηδέν** γραμμές, και το autoFocus «Ναι, ενημέρωσε» **έσβηνε τον αριθμό σιωπηλά** (το έπιασε η
   άγκυρα Δ1, κόκκινη στην πρώτη εκτέλεση). **Δεν** άλλαξε η σημασιολογία του — προστέθηκε **δεύτερη,
   ονομασμένη ερώτηση** πάνω στον **ίδιο** πυρήνα (`collectFieldDiffs`): `diffAddressReplacement` =
   «τι αλλάζει αν το νέο **αντικαταστήσει** το παλιό» (προσθήκη · αλλαγή · **σβήσιμο**) +
   `isClearedField`. Ο διάλογος ρωτά αυτήν· το `AddressDiffSummary` γράφει «**θα σβηστεί**» (λέξη, όχι
   μόνο χρώμα)· όταν κάτι σβήνεται η εστίαση πάει στο «Μόνο η θέση», ώστε το Enter από συνήθεια να μη
   χάνει δεδομένα. Ισχύει και για το `AddressEditor`, που κάνει `setUserInput(pendingDrag)` — δηλαδή
   **επίσης** αντικαθιστά. Στο έργο, το νέο `ProjectViewDragConfirm` δίνει στον διάλογο το
   **πραγματικό** αποτέλεσμα του `applyDraggedPin` αντί για το ωμό reverse geocode (εκείνο **κρατά**
   οδό/πόλη/Τ.Κ. όταν λείπουν — η σύνοψη περιέγραφε άλλο πράγμα από αυτό που γραφόταν).
2. Οι φόρμες **προσθήκης/επεξεργασίας** και ο `BuildingAddressesEditor` **δεν** περνούν το νέο prop.
   Στην επεξεργασία το `handleSaveEdit` δεν κουβαλά καν τις συρμένες συντεταγμένες
   (`fromHierarchyValue` = μόνο κείμενο) ⇒ ο διακομιστής ξαναλύνει το κείμενο.
3. Το `resolveAddressPosition` ήταν ήδη ~65 γραμμές (> 40, N.7.1) και το αρχείο στις **499/500**: η
   αλλαγή κρατήθηκε στις +3 γραμμές, χωρίς αναδόμηση.
4. ⚠️ **Η κάρτα μένει μπαγιάτικη ως την επαναφόρτωση** (βρέθηκε στη ζωντανή επαλήθευση): μετά το «Μόνο
   η θέση» έγραφε ακόμα «Στον δρόμο, όχι στην πόρτα», ενώ η βάση είχε **ήδη** `dragged` χωρίς
   `geocodingMetadata`. Πιθανή αιτία — **ανεπαλήθευτη**: το `applyDraggedPin` κάνει `{...addr}` και κρατά
   τοπικά το `geocodingMetadata: interpolated`, από το οποίο η κάρτα βγάζει το σχήμα· το σβήνει μόνο ο
   διακομιστής. Θεραπεία προς απόφαση: ο πελάτης να **υιοθετεί την απάντηση** του `PATCH` — **όχι**
   δεύτερος κριτής «άνθρωπος ή μηχανή;» στον πελάτη.
5. Αποτυχία του reverse geocode (404 / timeout / όριο 10/λεπτό) ⇒ ο `handleDragEnd` δεν καλεί τον γονέα
   και το σύρσιμο **χάνεται σιωπηλά** — ενώ το «Μόνο η θέση» δεν χρειάζεται κείμενο.
6. Θόρυβος στη σύνοψη του διαλόγου: «Περιοχή: Ελευθέριο-Κορδελιό → Ελευθέριο Κορδελιό» (μόνο παύλα — το
   `cleanNominatimName` κανονικοποιεί, το αποθηκευμένο όχι). Και η οδός του ERGO TEST είναι αποθηκευμένη
   ως `"Σαμοθράκης "` (κενό στο τέλος) ⇒ η κάρτα γράφει «Σαμοθράκης , 16».

#### Βήμα Β — σύγκριση ADR ⇄ κώδικα, **πριν** από κώδικα *(2026-09-10, ανάγνωση κώδικα, όχι ζωντανό)*

| # | Το ADR έλεγε | Ο κώδικας λέει |
|---|---|---|
| 2 | η επεξεργασία δεν κουβαλά συρμένες συντεταγμένες | ✅ επιβεβαιώνεται **και νωρίτερα**: το `ProjectLocationsTab` περνά στο `editEditorRef.setPendingDrag` το `toResolvedFields(...)` = **μόνο κείμενο**· η θέση χάνεται **πριν** από τον διάλογο, όχι μόνο στο `handleSaveEdit` |
| 2β | — *(νέο)* | 🔴 **Φόρμα προσθήκης: το «Άκυρο» κρατά τη θέση.** Το `handleCombinedDragUpdate` καλεί `handlePendingDragUpdate({ coordinates })` **πριν** τον διάλογο ⇒ `pendingHasDragged = true` ⇒ το «Άκυρο» ισοδυναμεί σιωπηλά με «Μόνο η θέση» και η θέση **αποθηκεύεται** |
| 2γ | `BuildingAddressesEditor` χωρίς «Μόνο η θέση» | ✅ και **χειρότερο**: `handleDragApplied` → `hierarchyToPartial` = μόνο κείμενο ⇒ το σύρσιμο κτιρίου **δεν αποθηκεύει ποτέ** θέση· ο χάρτης δείχνει μόνο το `initialValues` |
| 4 | πιθανή αιτία: `{...addr}` κρατά `geocodingMetadata` | ✅ **επιβεβαιώνεται στον κώδικα**: το `PATCH /api/projects/[id]` απαντά `{ projectId, updated, _v }` — **χωρίς** τις διευθύνσεις που έγραψε ο διακομιστής· το `persistAddresses` κάνει `setLocalAddresses(newAddresses)` (το αντίγραφο του **πελάτη**) και το `RealtimeService.dispatch('PROJECT_UPDATED')` το διαδίδει και σε άλλες σελίδες. **Ίδιο** σχήμα στα κτίρια (`useBuildingAddressesCardState.persistAddresses`) |
| 5 | το σύρσιμο χάνεται σιωπηλά | ✅ και παραβιάζει το «ό,τι βλέπεις αποθηκεύεται»: η πινέζα **μένει** στην οθόνη (`dragPositions`), ο γονιός **δεν μαθαίνει τίποτα** |
| 6 | θόρυβος παύλας / κενού | ✅ το `normalize` του `diffAddressFields` = `normalizeGreekText` + `trim` + πεζά, **χωρίς** αναδίπλωση παύλας· το `projectAddressSchema` δεν κάνει `trim` |
| Β4 *(handoff)* | «μάλλον το σύρσιμο επαφής χάνει τη θέση» | ⚠️ **Διόρθωση**: δεν υπάρχει θέση να χαθεί. Οι επαφές **δεν έχουν μοντέλο θέσης** (`CompanyAddress` χωρίς πεδίο — ήδη D25· το `AddressInfo.coordinates` έχει **0 γραφείς**)· και γράφονται από τον **πελάτη** (`contacts.service.updateContact` → `updateDoc`), όχι από διακομιστή ⇒ ο ένας γραφέας θέσης **δεν** τις αγγίζει. Η πινέζα ξαναγεωκωδικοποιεί το κείμενο ⇒ μετά το σύρσιμο **πηδά** στο σημείο της μηχανής |

⚠️ **Όριο μεγέθους**: `useProjectLocations` 477 · `ProjectLocationsTab` 490 · `AddressEditor` 466 ·
`useAddressMapGeocoding` 495 · `AddressMap` 496 · `address-position` 499 γραμμές ⇒ κάθε προσθήκη εκεί
προϋποθέτει **εξαγωγή** (N.7.1).

#### Βήμα Β — υλοποίηση, Β-Ι: έργα + κτίρια *(2026-09-10)*

**Έρευνα — πηγές που διαβάστηκαν, όχι υποθέσεις:**
- **Revit** Location: σύρσιμο πινέζας ⇒ lat/long στο πεδίο διεύθυνσης, «*Click Search to resolve the address*».
- **Google Business Profile**: «*pin your business directly on the map*», όταν η διεύθυνση δεν βρίσκεται.
- **HERE**: `position` = προβολή ≠ `access` = «*for instance the entrance*».
- **INSPIRE Addresses**: 1..* θέσεις ανά διεύθυνση, «*exactly one … 'default' = 'true'*».
- **Salesforce Maps** Verified Location: υπερισχύει της γεωκωδικοποίησης, και οι μαζικές ενέργειες ρωτούν πριν τη σβήσουν.
- **Zoho CRM**: «*move a pin to adjust coordinates without changing the full address*».
- **Apple Maps**: η πινέζα του σπιτιού διαφέρει από την κάρτα επαφής.
- **Apollo**: η αισιόδοξη εκδοχή αντικαθίσταται από «*values returned from the server*».

**Κανόνας:** το σύρσιμο δίνει **ΠΑΝΤΑ** θέση και **ΠΡΟΑΙΡΕΤΙΚΑ** κείμενο. Ό,τι βλέπεις, αυτό αποθηκεύεται. Την αποθηκευμένη προέλευση την αποφασίζει ο διακομιστής.

| # | Διόρθωση | SSoT / πού |
|---|---|---|
| Β6 | σύρσιμο **χωρίς** κείμενο (404 / timeout / 429) φτάνει **πάντα** στον γονιό· ο διάλογος προσφέρει μόνο «Μόνο η θέση» | `shared/addresses/pin-drop.ts` (`PinDrop`, `resolvePinDrop`) · `reverseGeocodeDetailed` (3 εκβάσεις· αντικατέστησε το `reverseGeocode`) · `AddressDragConfirmDialog.proposal` |
| Β1/Β2 | επεξεργασία έργου: «Μόνο η θέση» + η θέση **αποθηκεύεται** | `editor/hooks/useAddressEditorDrag` (εξαγωγή από τον `AddressEditor`, με αναίρεση πινέζας) · `AddressEditorPlacementOptions` · `useFormPlacedPoint` · `locations/useLocationFlows` |
| Β1β | προσθήκη: το «Άκυρο» **δεν** αποθηκεύει πια θέση — θέση γράφεται **μόνο** με επιβεβαίωση | `useLocationFlows` · `locations/useLocationsMap` |
| Β3 | κτίρια: η θέση αποθηκεύεται· ο χάρτης δείχνει την πινέζα της φόρμας· ακύρωση/αναίρεση την επαναφέρει | `useBuildingAddressesCardState` (κατέχει τη θέση — **αυτό** αποθηκεύει) · `BuildingAddressesEditor` |
| Β5 | τα PATCH έργου/κτιρίου επιστρέφουν τις **γραμμένες** διευθύνσεις· ο πελάτης **υιοθετεί** αυτές, και το Realtime διαδίδει αυτές | `services/address-mutation-echo.ts` (`settleEntityUpdate`) |
| Φ2β | η πινέζα του ανθρώπου **μένει** όταν αλλάζει αργότερα το κείμενο (`human-kept`)· απόκλιση πάνω από `max(αβεβαιότητα μηχανής, 50 μ.)` ⇒ μη-μπλοκαριστική ειδοποίηση «Μετακίνησε / Κράτα» | `lib/geocoding/address-position-rules` (`measureDrift` → `focusPresentation` + `distanceMeters`) · `HUMAN_PIN_DRIFT_FLOOR_METRES` · `relocateAddressIds` · `AddressPositionDriftNotice` |
| Β7 | παύλα/κενά = **γραφή**, όχι όνομα· προθέματα **χωρίς τόνους**· `trim` στο σύνορο εγγραφής· η κάρτα χωρίς «Σαμοθράκης , 16» | `utils/address/place-name.ts` (αντικατέστησε το `cleanNominatimName` και το σώμα του `stripAdminPrefix`) · `withTrimmedIdentity` · `address-line` |

**Ευρήματα στην πορεία (διορθώθηκαν, με άγκυρα που τα αποδεικνύει):**
- 🔴 Το `keepStored` έγραφε `verifiedAt: null` ⇒ **κάθε** αποθήκευση που δεν άγγιζε τη θέση **έσβηνε** τη φρεσκάδα. Η άγκυρα Ζ ήταν **κόκκινη πάνω στον παλιό κώδικα** πριν τη διόρθωση.
- 🔴 Το `building-services.updateBuilding` διάβαζε `response?.data?._v`, ενώ το `apiClient` ξετυλίγει ήδη το `{ success, data }`. Άρα η έκδοση κτιρίου (SPEC-256A) δεν έφτανε **ποτέ** στον καλούντα.
- 🔴 Ο προσαρμογέας `geocodeAddress` πετούσε το `extent` της μηχανής.
- 🔴 Δύο δίδυμα κανόνα προθεμάτων **είχαν αποκλίνει**: το ένα έπιανε μόνο κεφαλαία χωρίς τόνους, το άλλο μόνο πεζά με τόνους.
- ✅ Το `address-position.ts` έπεσε από 499 σε 333 γραμμές, και το `resolveAddressPosition` σε ~20 (**Ανοιχτό 3**).

**Απόκλιση από το εγκεκριμένο σχέδιο (δηλωμένη):** η δήλωση «μετακίνησε» ταξιδεύει ως `relocateAddressIds` σε επίπεδο **αιτήματος**, όχι ως `positionIntent` μέσα στη διεύθυνση. Έτσι το μοντέλο δεν αποκτά πεδίο που δεν αποθηκεύεται ποτέ, και η αφαίρεσή του πριν τη γραφή ζει σε **ένα** σημείο ανά διαδρομή (άγκυρα Ψ1).

**Άγκυρες** (εκτελούν την πραγματική διαδρομή· mock μόνο στα σύνορα) **και μεταλλάξεις** (αριθμός κόκκινων tests):

| Άγκυρα | Τι ελέγχει | Μετάλλαξη → κόκκινα |
|---|---|---|
| `drag-drop-point` | Β6 | Μ1 → 2 |
| `AddressDragConfirmDialog` Δ6–Δ7 | διάλογος χωρίς κείμενο | — |
| `AddressEditor.placement` | «Μόνο η θέση», «Άκυρο», αναίρεση πινέζας | — |
| `useProjectLocations.human-placed-point` | Β1, Β1β, Β2, Β5, Φ2β πελάτη | Μ2 → 1 · Μ3 → 2 · Μ5 → 1 |
| `building-addresses-placement` | Β3 | Μ4 → 2 |
| `address-position-lifecycle` Ζ/Η/Β7 | φρεσκάδα, `human-kept`, απόκλιση, `trim` | Μ7 → 6 · Μ8 → 2 · Μ9 → 3 · Μ11 → 1 |
| `project-place-wiring` Ψ1–Ψ3 | αίτημα που δεν γράφεται, απήχηση, απόκλιση | Μ6 → 1 |
| `place-name` | κανόνας ονομάτων και καταναλωτές του | Μ10 → 1 · Μ12 → 1 |
| `address-mutation-echo` | απήχηση και διάδοση | Μ13 → 2 |
| `AddressPositionDriftNotice` | η ειδοποίηση | — |

Η **Κ1ε** άλλαξε **ρητά**, από `geocoded` σε `human-kept`, με αναφορά σε αυτή την απόφαση. Παλινδρόμηση: **88 σουίτες, 1168 tests**. `jscpd:diff` καθαρό σε 31 αρχεία: αρχικά βρέθηκαν **3 κλώνοι**, και λύθηκαν με εξαγωγή, όχι με παράκαμψη.

**Ανοιχτά — επόμενες συνεδρίες (απόφαση Giorgio):**
- **Β-ΙΙ επαφές**: αποθηκευμένη θέση, ίδιος γραφέας, resolve-only διαδρομή, μία εγγραφή. → ✅ **υλοποιήθηκε 2026-09-11** (βλ. «Βήμα Β-ΙΙ» παρακάτω).
- **Β-ΙΙΙ είσοδοι**: `accessPoints[]`, με το `coordinates` ως default σημείο.

Σχέδιο: `HANDOFFS/2026-09-10_ADR-332-D27_vima-B-II_epafes_handoff.md`.

#### Βήμα Β-Ι — ζωντανή επαλήθευση *(2026-09-10, Chrome + Firestore `pagonis-87766`, ERGO TEST `proj_2eb4b755-…`)*

Συρσίματα με **`project()` της άγκυρας**, όχι με το μάτι. Κάθε γραμμή έχει στιγμιότυπο και ανάγνωση Firestore.

| # | Βήμα | Τι φάνηκε | Firestore |
|---|---|---|---|
| 1 | επεξεργασία → σύρσιμο έξω και **πίσω στην πόρτα** → «Μόνο η θέση» (×2) → Αποθήκευση | ✅ ο διάλογος («16 → θα σβηστεί») · το «Μόνο η θέση» κρατά πινέζα **και** «16» · η κάρτα ανανεώνεται **χωρίς** επαναφόρτωση (`performance.now` συνεχές) | `_v` 2→3 · `coordinates` **0,057 μ.** από την πόρτα · `source: 'dragged'` · `number: '16'` · νέο `verifiedAt` · `street` «Σαμοθράκης␣» → «Σαμοθράκης» (**`trim` Β7 στο σύνορο**) |
| 2 | επεξεργασία → σύρσιμο → «Ακύρωση» | ✅ η πινέζα στο **ίδιο** pixel (0 μ.) | `_v` 3 — τίποτα |
| 3 | νέα διεύθυνση → σύρσιμο → «Ακύρωση» → Αποθήκευση | ⚠️ **μισό**: η πινέζα επιστρέφει (0 μ.), το κείμενο μένει · η «Αποθήκευση» με αμφίσημο κείμενο («Σαμοθράκης 20», χωρίς πόλη) άνοιξε «Πιθανές Τοποθεσίες» (5 στην Αττική) και **δεν** αποθήκευσε — **σχεδιασμένο** (κρίθηκε στον κώδικα): η πόλη είναι υποχρεωτική (`readFormAddress` → `cityRequired`) και το «Πιθανές Τοποθεσίες» είναι το panel αποσαφήνισης του editor· ✅ ζωντανή επανάληψη με **πλήρη** διεύθυνση: αποθηκεύτηκε (Λ7, «Β9–Β13 — διορθώθηκαν») | `_v` 5 — τίποτα |
| 4 | κάρτα Σαμοθράκης | ✅ «Σαμοθράκης, 16, …» ενώ η βάση είχε ακόμα «Σαμοθράκης␣» | — |
| 5 | 16 → 18 → Αποθήκευση → πίσω στο 16 | ✅ **καμία** ειδοποίηση απόκλισης· η πινέζα μένει | `_v` 4: `number: '18'`, ίδιες `coordinates`, `source: 'dragged'`, **ίδιο** `verifiedAt` (η διόρθωση `keepStored` ισχύει ζωντανά) · `_v` 5: «16» |
| 6 | σύρσιμο χωρίς διεύθυνση | ✅ UI: 404 → «Σε αυτό το σημείο δεν βρέθηκε διεύθυνση» · 429 → «Η υπηρεσία διευθύνσεων δεν απάντησε» · κουμπιά **μόνο** «Ακύρωση» / «Μόνο η θέση» | — |
| 7 | κτίριο χωρίς έργο | ⛔ **δεν έγινε**: και τα 7 κτίρια της εταιρείας έχουν `projectId` · απόφαση Giorgio: **δοκιμαστικό κτίριο** χωρίς έργο — ⛔ **μη προσβάσιμο**: η εφαρμογή απαιτεί έργο για νέο κτίριο (`building.projectRequired`, Λ8) | — |

⚠️ **Βήμα 6, δηλωμένο**: ο πάροχος απαντήθηκε ψεύτικα **μόνο στο σύνορο** (`window.fetch` της σελίδας για `/api/geocoding/reverse`). Όλη η υπόλοιπη διαδρομή του πελάτη έτρεξε αληθινά. Ο λόγος: ο αληθινός Nominatim απαντά «Ελλάδα» **ακόμα και σε διεθνή ύδατα** (39,99, 24,72), και «Καλοχώρι, 57009» μέσα στον Θερμαϊκό. Άρα το «δεν βρέθηκε» **δεν** προκύπτει ζωντανά κοντά στην Ελλάδα.

**Β8 — Η ΜΥΤΗ ΕΙΝΑΙ Η ΑΓΚΥΡΑ** *(βρέθηκε στην επαλήθευση, διορθώθηκε — commit `ccf92f4e`)*.
- **Το σφάλμα**: ο `Marker` δένεται `anchor="bottom"`, και το `<figure>` του `DraggableMarkerPin` περιείχε **και** την ετικέτα. Άρα η μηχανή αγκύρωνε τη **βάση της ετικέτας**. Μετρημένο στο DOM: μύτη y 940,4 ⇄ `project()` 968,2, δηλαδή **27,8 px** (~6,3 μ. στο ζουμ 18, ~25 μ. στο 16). Επιπλέον το `animate-bounce` σήκωνε τη μύτη 25% τον περισσότερο χρόνο. Ισχύει από **2026-03-07** (`dc163ed8`).
- **Πρακτική (διαβάστηκε)**: Google `Icon.anchor`, «*the center point of the bottom of the image*», **χωριστά** από το `labelOrigin` · Advanced Markers `anchorLeft/anchorTop` · `crossOnDrag`.
- **Διόρθωση, σε ΕΝΑ SSoT** (`address-map-config.tsx`): viewBox κομμένο στη μύτη (`PIN_TIP_Y`) με `overflow="visible"` · σκιά εδάφους **πάνω** στη μύτη · ετικέτα `absolute` (εκτός ροής) · το `flex` μένει (αλλιώς το κενό γραμμής βάσης μπαίνει κάτω από τη μύτη) · καμία κίνηση σώματος, η ένδειξη επεξεργασίας είναι **δακτύλιος εδάφους** (`motion-safe:animate-ping`).
- **Ζωντανά μετά**: **0,5 px**, η στρογγυλοποίηση θέσης δείκτη της MapLibre.
- **Άγκυρα**: `shared/addresses/__tests__/map-pin-anchor.test.tsx`. Η μύτη **υπολογίζεται** από το `path` και ελέγχονται και οι 2 πινέζες ΙΚΑ, ήδη σωστές. 16/16.
- **Μεταλλάξεις**: M14 viewBox 50 → 4 · M15 ετικέτα στη ροή → 3 · M16 `animate-bounce` → 4 · M17 σκιά `cy=47` → 1 · M18 δακτύλιος εκτός μύτης → 1.
- Παλινδρόμηση 27 σουίτες / 304 tests. `jscpd:diff` καθαρό.
- ⚠️ **Συνέπεια**: συρσίματα ανθρώπου από 2026-03-07 αποθηκεύτηκαν ~28 px (στο ζουμ του συρσίματος) **νοτιότερα** από τη μύτη που είδε. Δεν διορθώνονται αυτόματα, γιατί το ζουμ δεν αποθηκεύτηκε. Το ERGO TEST μπήκε με υπολογισμό και **δεν** επηρεάζεται.

**Β9–Β13 — ΔΙΟΡΘΩΘΗΚΑΝ** *(2026-09-10, πριν το Β-ΙΙ — απόφαση Giorgio)*. Κοινή ρίζα των Β10/Β11/Β12: **δεύτερος κριτής ή δεύτερο αντίγραφο στον πελάτη** πάνω σε δεδομένα που ο διακομιστής είχε ήδη αποφασίσει — παράβαση του Β5.

| # | Ρίζα (μετρημένη στον κώδικα) | Διόρθωση — σε ΕΝΑ σημείο | Πρακτική |
|---|---|---|---|
| Β9 | `hierarchyToResolvedAddress` πετούσε το `country` (ο τύπος το κουβαλούσε) · η σύγκριση ήταν **κειμένου** ⇒ «Greece» ≠ «Ελλάδα» | η χώρα περνά · το `diffAddressFields` συγκρίνει τη χώρα ως **ISO 3166-1** μέσω του SSoT `countryNameToCode` (άγνωστο όνομα ⇒ σύγκριση κειμένου, καμία επινοημένη ταυτότητα) | Google `address_components`: χώρα = `short_name` ISO, το όνομα είναι προβολή |
| Β10 | ο ανιχνευτής «stale» πυροδοτούσε **μόνο** σε διευθύνσεις **με** συντεταγμένες, δηλαδή αποθηκευμένες και ήδη κριμένες από το `address-position`. Οι επαφές δεν έχουν ποτέ συντεταγμένες ⇒ εκεί **ποτέ**. Άρα ήταν **πάντα** δεύτερος κριτής, και η «Ανανέωση» έδειχνε το σημείο της μηχανής πάνω από την πινέζα του ανθρώπου | αφαιρέθηκαν: ανιχνευτής · «Ανανέωση χάρτη» · `'stale'` του `GeocodingStatus` · `ADDRESS_GEOCODING_FIELDS` (και η **Κ7** του `address-position.test`, που φύλαγε την ισότητα των **δύο** λιστών — δεν υπάρχει πια δεύτερη) · κλειδιά `mapStatus.stale*` / `forceRegeocode`. Η απόκλιση ζει **μόνο** στα `positionAdvisories` του διακομιστή | Revit · Apple Maps: αλλαγή κειμένου δεν μετακινεί πινέζα |
| Β11 | το κάτοπτρο `address`/`city` το έφτιαχνε ο **πελάτης** από τη γραφή **πριν** το `trim` του συνόρου (Β7) | το παράγει ο **διακομιστής** από ό,τι **γράφει**, σε έργα **και** κτίρια (`extractLegacyFields`)· ό,τι στείλει ο πελάτης αγνοείται, και οι πελάτες δεν το στέλνουν πια. Το `extractLegacyFields` έγινε δομικό, ρωτά το `primaryOrFirst` (D24) και κόβει τα κενά | ένας γραφέας για πηγή **και** παράγωγο |
| Β12 | το `dragPositions` γέμιζε με **κάθε** θέση, «μόνο όσα λείπουν» ⇒ ποτέ ανανέωση, και `dragPos ?? geocoded` | **ελεγχόμενος χάρτης**: το `dragPositions` είναι **μόνο** η υπερίσχυση μιας χειρονομίας σε εξέλιξη και σβήνει όταν ο γονιός δώσει άλλο σημείο (`dropSupersededOverrides`) · θέση = `displayedPosition` (χειρονομία → σημείο γονιού **απευθείας**, όχι μέσω του debounce των 500 ms → γεωκωδικοποίηση οθόνης)· ο ίδιος κανόνας και στις πινέζες μόνο-ανάγνωσης | React controlled component |
| Β13 | Nominatim 8″ + έως **3 διαδοχικά** Overpass × έως 3 προσπάθειες × 6″ · `fetch` πελάτη **χωρίς** σήμα · «ο πάροχος δεν απάντησε» έφευγε ως **404** · ψευδής υπόσχεση «Greek bounding box» | (α) **μία προθεσμία** ανά αίτημα (`createDeadline` στο `lib/async-utils`, `GEOCODING.REVERSE_BUDGET_MS` = 9″): κάθε στάδιο παίρνει το **υπόλοιπο**, και επανάληψη Overpass γίνεται μόνο αν χωρά · (β) **ένα** ερώτημα Overpass, οι τρεις βαθμίδες επιλέγονται στη μνήμη · (γ) όριο πελάτη = προθεσμία + 3″, ακυρώσιμο (`linkedAbortSignal`) · (δ) `absent` → 404, `unavailable` → **503** · (ε) **προοδευτικός διάλογος**: `PinDropText` `pending` **αμέσως**, με «Μόνο η θέση» διαθέσιμο, και η σύνοψη όταν απαντήσει η μηχανή· νέα χειρονομία ακυρώνει την ερώτηση της παλιάς και **δεν** την παραδίδει· `usePinDropGate`: κλεισμένη χειρονομία **δεν** ξανανοίγει (editor **και** προβολή έργου)· ταυτότητα χειρονομίας μονότονη σε όλη τη σελίδα (`nextPinGesture`) · (στ) η υπόσχεση bbox **αφαιρέθηκε** αντί να υλοποιηθεί: θα απέρριπτε τις επαφές σε Κύπρο/Βουλγαρία (D12) | Google SRE *deadline propagation* · Google «Dropped pin» (σημείο αμέσως, διεύθυνση μετά) |

Μικρό: η πινέζα προσθήκης γράφει τον τύπο **της φόρμας** (`pendingPinAddress(point, id, type)`), όχι πάντα «Εργοτάξιο». Εκτός πεδίου: hydration mismatch στα Radix ids του `JobSwitch` / `ShellUtilities`.

⚠️ **Δηλωμένες διαφορές συμπεριφοράς**: (1) στις βαθμίδες 1–2 του Overpass το «μέσα στα 60 μ.» κρίνεται πλέον με την απόσταση του **κέντρου** του στοιχείου — το ίδιο μέτρο με το οποίο ήδη γινόταν η κατάταξη· πριν, το `around` μετρούσε τη **γεωμετρία**. Η βαθμίδα 3 είναι ταυτόσημη. (2) Αν λήξει η προθεσμία πριν βρεθεί αριθμός, η απάντηση φεύγει **χωρίς** αριθμό, όπως όταν το OSM δεν έχει αριθμό — ο άνθρωπος κρατά τον δικό του με «Μόνο η θέση».

**Άγκυρες** (εκτελούν την πραγματική διαδρομή, mock μόνο στα σύνορα): `address-map-controlled.test.ts` *(νέο)* · `drag-drop-point.test.ts` (+Β13) · `AddressEditor.placement.test.tsx` (+Β13) · `view-drag-gate.test.ts` *(νέο)* · `AddressDragConfirmDialog.test.tsx` (Δ8 · Δ9) · `diffAddressFields.test.ts` · `administrative-hierarchy-round-trip.test.ts` · `address-helpers.test.ts` · `project-place-wiring.test.ts` (Ψ4 · Ψ5) · `overpass-housenumber.test.ts` *(νέο)* · `overpass-retry.test.ts` (Κ4) · `async-utils-deadline.test.ts` *(νέο)* · `geocoding-service.test.ts` (+αντίστροφη) · `reverse-route.test.ts` *(νέο)*. Παλινδρόμηση **62 σουίτες / 795 tests** πράσινα (διευθύνσεις · τοποθεσίες έργων · κτίρια · επαφές · γεωκωδικοποίηση · Overpass · API έργων/κτιρίων). `jscpd:diff` καθαρό σε 42 αρχεία.
- **Μεταλλάξεις 17/17 κόκκινες** (αντίγραφο → εφαρμογή με έλεγχο ότι **εφαρμόστηκε** → jest → επαναφορά στην ίδια εντολή → `cmp`, και στο τέλος ανεξάρτητη επαλήθευση ότι **και τα 17 σημεία** είναι στην αρχική τους μορφή): M1 χώρα στην ιεραρχία · M2 σύγκριση ISO · M3 κάτοπτρο από τον διακομιστή · M4 κόψιμο κενών · M5 σειρά θέσης · M6 σβήσιμο υπερίσχυσης · M7 δεύτερη ερώτηση για αποθηκευμένο σημείο · M8 βαθμίδα οδού · M9 αναμονή που δεν χωρά · M10 ελάχιστη προσπάθεια · M11 σήμα πελάτη · M12 503 · M13 ακυρωμένη χειρονομία · M14 `pending` · M15 φύλακας editor · M16 τύπος πινέζας · M17 φύλακας προβολής.
- ⚠️ Η **M9 επέζησε στην πρώτη εκτέλεση**: η άγκυρα Κ4 μετρούσε **κλήσεις**, και τον επόμενο γύρο τον έκοβε ο **δεύτερος** φραγμός (ελάχιστη προσπάθεια) — ίδιο αποτέλεσμα, **1″ αργότερα**. Η άγκυρα μετρά πλέον τον **χρόνο** (η απάντηση έρχεται αμέσως). Η M14 δεν εφαρμόστηκε την πρώτη φορά (κλείδωμα αρχείου των Windows, `EUNKNOWN`) και ξανάτρεξε.
- ⚠️ Το `drag-drop-point.test.ts` έδινε στον χάρτη `addresses: []` (νέος πίνακας σε κάθε απόδοση) και σερνόταν id που **δεν** ήταν στα props. Περνούσε μόνο επειδή η παλιά εκκαθάριση έτρεχε μετά από 500 ms που το test δεν περίμενε ποτέ. Με ελεγχόμενο χάρτη κοκκίνισε **σωστά**· διορθώθηκε το test.
- ⚠️ Το κάτοπτρο των **κτιρίων** δεν έχει άγκυρα σε επίπεδο handler (δεν υπάρχει σουίτα `building-update`)· καλύπτεται από την **ίδια** συνάρτηση και από την άγκυρα του έργου.
- **Μεταλλάξεις Β14 + καταγραφή: 4/4** — M18 σκανδάλη επεξεργασίας · M19 σκανδάλη προβολής (⚠️ **επέζησε** στην πρώτη εκτέλεση: στην προβολή το καδράρισμα ξανατρέχει σε κάθε `mapReady`, άρα η βλάβη εκεί ήταν η **πρόθεση** — «ταξίδι» αντί «άφιξη» — και η άγκυρα ελέγχει πλέον το `cameraFraming('arrive', …)`) · M20/M21 επίπεδο καταγραφής. **Σύνολο 21/21.**

**Ζωντανή επαλήθευση Β9–Β13** *(2026-09-10, Chrome + Firestore `pagonis-87766`, ERGO TEST)*:

| # | Βήμα | Αποτέλεσμα |
|---|---|---|
| Λ1 (Β13) | επεξεργασία → σύρσιμο | ✅ ο διάλογος ανοίγει σε **175 ms** με «Αναζήτηση διεύθυνσης…» + «Μόνο η θέση», **χωρίς** «Ναι, ενημέρωσε» · το `/reverse` απάντησε σε **7,93″** (ήταν 24–38″) |
| Λ2 (Β13) | «Μόνο η θέση» στα **168 ms**, πριν απαντήσει η μηχανή | ✅ ο διάλογος **δεν** ξανάνοιξε όταν ήρθε η απάντηση (έλεγχος 1,5″ **μετά** την απάντηση) |
| Λ3 (Β9) | σύνοψη διαφορών | ✅ **μία** γραμμή («Αριθμός 16 → θα σβηστεί»), **καμία** «Χώρα» · η φόρμα δείχνει πλέον Χώρα «Greece» |
| Λ4 (Β10/Β12) | «Μόνο η θέση» → Αποθήκευση | ✅ καμία «Παλιές συντεταγμένες» / «Ανανέωση χάρτη» · η πινέζα **μένει** στο σημείο αφής (ήταν: στο «πριν») |
| Λ5 (Β11) | Firestore | ✅ `_v` 5→6 · `address: "Σαμοθράκης 16"` (**ένα** κενό) · `number: '16'` · `source: 'dragged'` · νέο `verifiedAt` · ~0,25 μ. από την πόρτα (σύρσιμο «έξω και πίσω» +1 CSS px, **όχι** θέση από εικασία) |
| Λ6 (Β13) | κρέμασμα **μόνο** στο σύνορο `window.fetch` (σέβεται την ακύρωση, όπως ο αληθινός) | ✅ `pending` σε 144 ms → «Η υπηρεσία διευθύνσεων δεν απάντησε» στα **12,08″** (9″ + 3″) · το `fetch` επανήλθε |
| Λ7 (βήμα 3) | νέα διεύθυνση **πλήρης** (Σαμοθράκης 20 · 56334 · Ελευθέριο Κορδελιό) | ✅ αποθηκεύτηκε (`_v` 7 · `geocoded` / `interpolated` · `type: 'entrance'`) · η πινέζα προσθήκης έγραφε «Είσοδος» (όχι «Εργοτάξιο») · κάτοπτρο = η **κύρια** («Σαμοθράκης 16») · **διαγράφηκε από την εφαρμογή** (`_v` 8, μία διεύθυνση) |
| Λ8 (βήμα 7) | κτίριο **χωρίς** έργο | ⛔ **μη προσβάσιμο από την εφαρμογή**: η δημιουργία κτιρίου απαιτεί έργο (`building.projectRequired` — «Επίλεξε Έργο για να συνεχίσεις»). Κτίριο χωρίς έργο υπάρχει **μόνο** ως παλιά δεδομένα. Δεν δημιουργήθηκε τίποτα (επαληθευμένο: `buildings` με το όνομα → 0). Κάλυψη **μόνο** από άγκυρες |

**Βρέθηκαν στην επαλήθευση και διορθώθηκαν**:
- **Β14 — το καδράρισμα «καταναλωνόταν» όταν ο χάρτης δεν ήταν έτοιμος.** Οι σκανδάλες σημείωναν «καδράρισα» (και απομνημόνευαν τα πλήθη) ακόμη κι όταν το `runFitBounds` επέστρεφε χωρίς να κάνει τίποτα (`!mapReady`) ⇒ θέσεις που έφταναν **πριν** το `mapReady` δεν καδραρίζονταν ποτέ. Πλέον το `runFitBounds` επιστρέφει **αν** καδράρισε, και μόνο τότε γράφονται σημαία και πλήθη. ⚠️ **Ειλικρινώς**: το ζωντανό σύμπτωμα (χάρτης στην Αθήνα, πινέζα στη Θεσσαλονίκη) ήταν **συγχυσμένο** με κρυμμένη καρτέλα (`visibilityState: 'hidden'` ⇒ `requestAnimationFrame` παγωμένο ⇒ κανένα καδράρισμα, καμβάς 641 ⇄ 802 px). Με ορατό Chrome ο χάρτης καδράρισε. Η βλάβη **λογικής** αποδεικνύεται από τις άγκυρες (M18/M19), όχι από την οθόνη.
- **Επίπεδο καταγραφής**: η ακύρωση από τον καλούντα και η λήξη χρόνου γράφονταν `logger.error` ⇒ το overlay του Next μετρούσε ψεύτικα «Issues» σε κάθε νέο σύρσιμο. Πλέον `info` / `warn`· σφάλμα μένει **μόνο** το απρόσμενο (`logReverseFailure`).
- ⚠️ Παγίδες μέτρησης: (α) ο buffer του `performance` ήταν γεμάτος (250) ⇒ `performance.clearResourceTimings()` **πριν** το σύρσιμο· (β) μέτρηση που αρχίζει σε **άλλη** κλήση από το σύρσιμο μετρά και τον χρόνο του πράκτορα (πρώτη ένδειξη «20″» = άνω όριο, όχι μέτρηση)· (γ) ο πρώτος ανιχνευτής «ξανάνοιξε;» έπιασε το **animation κλεισίματος** του Radix — ψευδώς θετικό.

**Περιβάλλον επαλήθευσης (για την επόμενη φορά)**:
- κοινό tree ⇒ οι αλλαγές του άλλου agent προκαλούν **πλήρη επαναφόρτωση** ή **ξαναστήσιμο** (Turbopack HMR «*Expected module to match pattern*» σε locale JSON) και σβήνουν τη φόρμα
- ο buffer `performance` γεμίζει μετά από ~30′ ⇒ για αιτήματα χρησιμοποίησε `read_network_requests`
- η καρτέλα Radix ενεργοποιείται με `mousedown`, όχι `click`
- η ζώνη `AUTO_PAN` (60 px) μετακινεί τον χάρτη στη μέση του συρσίματος

#### Βήμα Β-ΙΙ — επαφές: αποθηκευμένη θέση, ο ίδιος γραφέας *(2026-09-11)*

**Το πρόβλημα:** η πινέζα επαφής (έδρα + υποκαταστήματα) **δεν αποθηκευόταν ποτέ**. Το `CompanyAddress` δεν
είχε θέση ούτε `id`, το `AddressInfo.coordinates` είχε 0 γραφείς, και ο χάρτης γεωκωδικοποιούσε το **κείμενο**
σε κάθε απόδοση ⇒ μετά το σύρσιμο η πινέζα **πηδούσε** στο σημείο της μηχανής.

**Πρακτική (διαβάστηκε, όχι υπόθεση):** Salesforce **Geocode Data Integration Rules** — γεωκωδικοποίηση
Contact/Account σε **create και update** · Salesforce Maps **Verified Location** — η πινέζα του ανθρώπου
επιβιώνει αλλαγής διεύθυνσης («clear only unverified»), **χωρίς** να το λέει · Zoho «move a pin … without
changing the full address» · Google «Dropped pin». **Πέρα από αυτούς:** η απόκλιση είναι **μετρημένη** και ο
άνθρωπος αποφασίζει («Μετακίνησε / Κράτα»).

**Σχήμα:** ο διακομιστής **αποφασίζει** (resolve-only, ο **ίδιος** γραφέας `resolveProjectAddressPositions`)· ο
πελάτης γράφει **μία** φορά — ένα `updateDoc`/`setDoc`, μία γραμμή CDC. Εγγραφή από τη διαδρομή θα έδινε δύο
εκδοχές του εγγράφου και δύο γραμμές ιστορικού για μία πράξη του ανθρώπου.

| # | Τι | SSoT / πού |
|---|---|---|
| Φ0 | 🔴 **Σιωπηλή απώλεια δεδομένων, υπαρκτή ΠΡΙΝ το Β-ΙΙ.** Το `updateDoc({ customFields: {...} })` **αντικαθιστά** τον χάρτη, και η αποθήκευση στέλνει dirty diff (ADR-323) ⇒ αλλαγή **μόνο διευθύνσεων** εταιρείας έσβηνε ΚΑΔ / ΓΕΜΗ / επιμελητήριο / κεφάλαιο· σβήσιμο όλων των διευθύνσεων σημάδευε **ολόκληρο** το `customFields` για `deleteField()`. Καμία γραμμή κώδικα δεν έγραφε διαδρομές `customFields.x`, κανένα test δεν το έβλεπε | `utils/contacts/contact-update-paths` (`flattenCustomFieldsForUpdate`) στο `ContactsService.updateContact`, **πριν** τον καθαριστή — το κενό γίνεται `deleteField()` **στο κλειδί**. Άγκυρα **κόκκινη πάνω στον παλιό κώδικα** (2 κόκκινα) |
| Φ1 | Μοντέλο: `StoredAddressPosition` (**ένας** τύπος για έργα/κτίρια/επαφές — το `ProjectAddress` τον κληρονομεί) · `CompanyAddress` + `id` · `AddressInfo` + `id` + `geocodingMetadata` · **ένα** σχήμα Zod θέσης (`addressPositionFieldsSchema`) · ταυτότητες στο **ένα** σημείο από όπου περνούν create **και** update (`convertToEnterpriseStructure`, γεννήτορας `addr_`, N.6) · builder/reader κρατούν `id` + θέση **και προς τις δύο** κατευθύνσεις · **D20: θέση = περιεχόμενο** | `types/address-position` · `utils/address/stored-address-position` · `EnterpriseContactSaver.withResolvedAddresses` |
| Φ2 | Διαδρομές **resolve-only**: `POST /api/contacts/[contactId]/address-positions` (ο κοινός εκτελεστής του ADR-742: ρυθμός + `crm:contacts:update` + φύλακας ιδιοκτησίας) και `POST /api/contacts/address-positions` (νέα επαφή, `crm:contacts:create`). **Όψη θέσης**: μία συνάρτηση για αποθηκευμένες (διακομιστής) **και** εισερχόμενες (πελάτης), λεξιλόγιο μέσω `projectAddressVocabulary` (ADR-772) — αλλιώς η γεωκωδικοποίηση θα έχανε τη διάκριση δήμου. Σύνορο **strict**· επιστρέφονται **μόνο αποφάσεις** ανά `id` | `app/api/contacts/_shared/contact-address-positions` · `utils/contacts/contact-address-position-view` |
| Φ3 | Πελάτης: θέση σε create (**πριν** το `setDoc`) **και** update· αποτυχία διαδρομής ⇒ η αποθήκευση **προχωρά** με τις θέσεις της φόρμας (σημασιολογία `geocoder-unavailable`: άγνοια ≠ γνώση)· «Μετακίνησε» = `relocateAddressPin` (μία εγγραφή — η αποτυχία **φτάνει** στον άνθρωπο)· η απήχηση `CONTACT_UPDATED` κουβαλά τις διευθύνσεις που **γράφτηκαν** και η λίστα τις υιοθετεί (πρακτική Β5) | `services/contact-address-positions.client` · `services/contacts/contact-address-advisories` · `components/contacts/page/contact-realtime-updates` |
| Φ4 | UI: πινέζες με **αποθηκευμένη** θέση + πραγματικό `id` · ο χάρτης δίνει **ολόκληρο** το `PinDrop` (και `pending`) · έδρα → διάλογος **του editor** με «Μόνο η θέση» (`placement`) · υποκατάστημα → διάλογος **προβολής** με φύλακα χειρονομίας (το κοινό `ViewDragConfirm`, εξήχθη από το `ProjectViewDragConfirm`) · το «σύρσιμο χωρίς κείμενο επαναφέρει την πινέζα» **καταργήθηκε** (Β6) · ειδοποίηση «Μετακίνησε / Κράτα» **μόνο σε προβολή** | `useContactAddressDragRouting` · `use-hq-address-mutations` · `contact-address-drag` · `ContactViewDragConfirm` · `useContactDriftFooter` |
| Φ5 | D25: οι δύο οθόνες επαφών περνούν αφετηρία εγγύτητας (`addressListCenter`) · εξαιρέσεις πύλης **0** | βλ. D25 «ΕΚΛΕΙΣΕ» |

**Βρέθηκαν στην πορεία — διορθώθηκαν, με άγκυρα που τα αποδεικνύει:**
- 🔴 **Φ0** παραπάνω.
- 🔴 Η **δημιουργία εταιρείας** (`mappers/company.ts`) έγραφε την **ωμή** λίστα της φόρμας ⇒ η δικλείδα D20 **δεν ίσχυε** στη δημιουργία εταιρείας (τα φυσικά πρόσωπα/υπηρεσίες περνούσαν ήδη από τον saver).
- 🔴 Το σύρσιμο **υποκαταστήματος** μηδένιζε τη διοικητική ιεραρχία **της έδρας** και της έγραφε τη συνοικία του υποκαταστήματος — ενώ **δεν** μηδένιζε την ιεραρχία του ίδιου του υποκαταστήματος (μπαγιάτικος δήμος δίπλα σε νέα οδό, ADR-277).
- 🔴 **Race:** ο wrapper του `setFormData` εφαρμόζει ακόμη και τις functional ενημερώσεις πάνω στο **κλειστό** `formData` ⇒ δύο κλήσεις στον ίδιο κύκλο αλληλοσβήνονται. Θέση και κείμενο της έδρας γράφονται πλέον σε **μία**.
- 🔴 Η απήχηση `CONTACT_UPDATED` μετέφερε μόνο όνομα / αγαπημένο / κατάσταση ⇒ ένα «Μετακίνησε» θα έμενε αόρατο ως την επαναφόρτωση.
- Boy scout (N.0.2): ιδιωτικό regex διάσπασης αριθμού → `splitStreetAndNumber` (SSoT) · `COMPANY_ADDRESS_HIERARCHY_CLEARED` (ήταν inline στον «Καθαρισμό») · `hqEntryFromFlatFields` (η συνθετική έδρα και η υλοποίηση της λίστας ρωτούν το **ίδιο**) · `DragApplyMode` στο `pin-drop` · `WRITTEN_ADDRESS_SOURCES` πίνακας χρόνου εκτέλεσης (στένεμα με `z.enum` χωρίς cast) · το `useContactsPageState` (495 γρ.) έδωσε την εφαρμογή της απήχησης σε καθαρή συνάρτηση.

**Δηλωμένες αποφάσεις και διαφορές:**
1. Η διαδρομή επιστρέφει **αποφάσεις θέσης**, όχι εγγραφές: κανένα σχήμα συνόρου δεν μπορεί να κόψει κείμενο ή ιεραρχία (μάθημα ADR-759 Φ3).
2. Το ελεύθερο `neighborhood` της επαφής **δεν** είναι πεδίο ταυτότητας — ίδιο με τα έργα, όπου το `neighborhood` του λεξιλογίου είναι η κοινότητα. Το `trim` του Β7 εφαρμόζεται στην **όψη**, όχι στο κείμενο της επαφής (ο διακομιστής δεν γράφει).
3. Ο πελάτης μπορεί ακόμη να γράψει θέση απευθείας (οι κανόνες Firestore δεν περιορίζουν το `customFields`) — ίδιο καθεστώς με κάθε πεδίο επαφής. Η πλήρης λύση είναι μεταφορά ολόκληρης της εγγραφής επαφής στον διακομιστή· **δικό της** εύρος.
4. Η συμβουλή απόκλισης ζει στη μνήμη της σελίδας (γεγονός της τελευταίας αποθήκευσης), όπως στα έργα.
5. Υποκατάστημα με **ανοιχτό** inline editor: το σύρσιμο πηγαίνει στον διάλογο προβολής, και ο editor ξανασυγχρονίζει από το `value`.
6. Η ειδοποίηση «λείπει αριθμός» μόνο για την **έδρα** — παλιά άνοιγε τον editor **της έδρας** και για σύρσιμο υποκαταστήματος.

**Άγκυρες** (εκτελούν την πραγματική διαδρομή· mock μόνο στα σύνορα) **και μεταλλάξεις — 29/29 κόκκινες** (αντίγραφο →
εφαρμογή με έλεγχο ότι **εφαρμόστηκε** → jest → επαναφορά στην **ίδια** εκτέλεση → τελικός έλεγχος ταυτότητας όλων των αρχείων):

| Άγκυρα | Τι φυλάει | Μεταλλάξεις → κόκκινα |
|---|---|---|
| `services/__tests__/contacts-update-custom-fields` | Φ0: `customFields` κλειδί-κλειδί · σβήσιμο **κλειδιού**, όχι χάρτη · `null` = ρητή διαγραφή | M1 → 2 · **κόκκινη πάνω στον παλιό κώδικα** |
| `utils/contacts/__tests__/contact-address-position-model` | ταυτότητες στην πρώτη αποθήκευση · δημιουργία εταιρείας με τη λίστα του saver · round-trip `id` + θέση · `withResolvedAddresses` · D20 θέση = περιεχόμενο | M2 → 3 · M3 → 3 · M4 → 1 · M5 → 2 · M6 → 1 |
| `app/api/contacts/_shared/__tests__/contact-address-positions` | resolve-only (**0** εγγραφές) · αμετάβλητη πινέζα = 0 ερωτήσεις · Φ2β `human-kept` + συμβουλή · relocate · ξένος tenant ⇒ 404 **χωρίς** ερώτηση στη μηχανή · νέα επαφή (`crm:contacts:create`) · σύνορο strict ⊇ `ADDRESS_IDENTITY_FIELDS` | M10 → 2 · M27 → 1 |
| `services/__tests__/contacts-address-positions-write` | **μία** ερώτηση + **ένα** `updateDoc` με θέση + `id` σε λίστα **και** παράγωγο · `id` πριν την ερώτηση · υποχώρηση σε αποτυχία · καμία ερώτηση χωρίς διευθύνσεις · συμβουλή στο store · δημιουργία πριν το `setDoc` · «Μετακίνησε» (relocate, ένα `updateDoc`, απήχηση) · αποτυχία του «Μετακίνησε» **φτάνει** στον άνθρωπο | M7 → 3 · M8 → 1 · M9 → 1 · M11 → 1 · M12 → 1 · M23 → 1 |
| `components/contacts/dynamic/__tests__/contact-address-drag` | υποκατάστημα: **δική του** ιεραρχία καθαρή, η έδρα ανέγγιχτη · «Μόνο η θέση» χωρίς μπαγιάτικα μεταδεδομένα · έδρα ADR-277 · υλοποίηση λίστας από επίπεδα πεδία (με ιεραρχία) · race ίδιου κύκλου · αναίρεση · SSoT διάσπασης αριθμού | M13 → 1 · M14 → 1 · M15 → 1 · M16 → 1 · M26 → 1 |
| `components/contacts/dynamic/__tests__/AddressesSectionWithFullscreen.placement` | πινέζες με αποθηκευμένη θέση + `id` · διάλογος υποκαταστήματος **αμέσως** (`pending`) · φύλακας χειρονομίας · «Άκυρο» ⇒ τίποτα + επαναφορά πινέζας · έδρα → editor με `placement` · D25: η αφετηρία **φτάνει** στον editor · συμβουλή **μόνο** σε προβολή | M17 → 1 · M18 → 1 · M19 → 2 · M20 → 1 · M21 → 1 · M22 → 1 |
| `…/__tests__/useClearCompanyHqAddress.position` | ο «Καθαρισμός» σβήνει θέση **και** `id` | M25 → 1 |
| `components/contacts/page/__tests__/contact-realtime-updates` · `useContactUpdatedAdoption` | η λίστα υιοθετεί τις διευθύνσεις της απήχησης χωρίς να αγγίξει τα αδέλφια του `customFields` · η σύνδεση **καλείται** | M24 → 1 · M29 → 1 |
| πύλη D25 `proximity-anchor-reach` | καμία εξαίρεση επαφών · η αντίστροφη διαβεβαίωση | M28 → 1 |

- ⚠️ **Η M29 επέζησε στην πρώτη εκτέλεση** — δηλωμένη **εκ των προτέρων**: η σύνδεση `CONTACT_UPDATED` ζούσε μέσα στο `useContactsPageState` χωρίς άγκυρα. Εξήχθη σε `useContactUpdatedAdoption`, με δική της άγκυρα ⇒ κόκκινη.
- ⚠️ Η **M23 δεν εφαρμόστηκε** στην πρώτη εκτέλεση: ο κατάλογος έψαχνε με `\n` σε αρχείο με άλλες αλλαγές γραμμής. Το έπιασε ο έλεγχος «εφαρμόστηκε;» του script (αλλιώς θα μετρούσε ως «επέζησε» ή, χειρότερα, ως ψευδώς πράσινη). Ξανάτρεξε με διορθωμένο μοτίβο ⇒ κόκκινη.
- Παλινδρόμηση **132 σουίτες / 1803 tests** (επαφές · διευθύνσεις · έργα · κτίρια · γεωκωδικοποίηση · API επαφών/έργων/κτιρίων · τύποι · realtime). `jscpd:diff` καθαρό σε 42 αρχεία. Πύλες: 3.68 ✅ · 3.70 ✅ · 3.33 ✅ · 3.71 ✅ · 3.34 ✅ — ⚠️ **μόνο μετά από δεύτερη γέννηση**: η πρώτη έγινε πριν γραφτούν τα αρχεία UI της Φ4, που αλλάζουν τη στατική κλειστότητα της σελίδας επαφών ⇒ το `shell-slice.manifest.json` ήταν μπαγιάτικο (Χ1/Χ3 κόκκινα). Μπαίνει στο **ίδιο** commit με τον κώδικα. · 3.47 ❌ **όχι από το Β-ΙΙ**: το 6ο e2e spec `test-harness/camera-motion/camera-motion.e2e.spec.ts` (ADR-847, `2778b952`, 09/09) δεν έχει μπει στην άγκυρα Μ0.3 («και τα 5 e2e spec»).

**Ζωντανή επαλήθευση — εκκρεμεί** (Chrome δίπλα στο τερματικό, `localhost`, στιγμιότυπο **και** ανάγνωση Firestore σε κάθε βήμα, στη δοκιμαστική «ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.»): (α) αποθήκευση μόνο διευθύνσεων ⇒ ΚΑΔ/ΓΕΜΗ **άθικτα** · (β) σύρσιμο έδρας → «Μόνο η θέση» → αποθήκευση ⇒ `source: 'dragged'`, `id`, η πινέζα **δεν πηδά** μετά το reload · (γ) σύρσιμο υποκαταστήματος → διάλογος · (δ) αλλαγή κειμένου ⇒ «Μετακίνησε / Κράτα» · (ε) νέα δοκιμαστική επαφή με σύρσιμο ⇒ θέση στο `setDoc` → **διαγραφή από την εφαρμογή**.

**Ζωντανή επαλήθευση — 2026-09-11, πρώτη συνεδρία (σε εξέλιξη):**
- 🔴 **Εύρημα Ζ1 — ΟΧΙ του Β-ΙΙ, αλλά μπλόκαρε την επαλήθευση: ατέρμονος βρόχος στο κοινό `SearchInput`.** Γρήγορη πληκτρολόγηση «ALFA» στην αναζήτηση της λίστας επαφών ⇒ η τιμή ταλαντευόταν «ALF» ↔ «ALFA» (12 δείγματα / 3″), «Maximum update depth exceeded» ~1/s (154 σε ~2′) από το `SearchInput.useEffect` (στοίβα τη στιγμή του σφάλματος), ώσπου ο renderer σταμάτησε να απαντά (CDP timeout 45″). **Αιτία:** δύο πηγές αλήθειας (`localValue` + `value`) με **δύο effects σε αντίθετες κατευθύνσεις** ⇒ όταν αποκλίνουν στο ίδιο commit, ανταλλάσσονται σε κάθε απόδοση. Ίδιο σχήμα με `debounceMs={0}` σε `CompactToolbar` / `GenericListHeader` (όλες οι λίστες) / `GlobalSearchDialog` / επιλογείς αρχείων· και inline `onChange` + effect ⇒ επανεκπομπή σε **κάθε** απόδοση (π.χ. `TasksPageContent`). Κανένα από τα `SearchInput` / `CompactToolbar` / `ContactsList` δεν άλλαξε λογική από 07–08/2026 ⇒ **προϋπήρχε**.
  **Διόρθωση (N.0.2):** `useSearchInputValue` — εκπομπή **από το συμβάν** (ποτέ από effect, ποτέ στο mount, ποτέ λόγω ταυτότητας `onChange`) · καθαρισμός **αμέσως** · υιοθέτηση εξωτερικής τιμής **μόνο αν δεν είναι ηχώ** μας, με ακύρωση της εκκρεμούς εκπομπής · `useDebouncedCallback` + `cancel()` (προσθετικό, ADR-217). Άγκυρες `ui/search/__tests__/search-input-flow` Σ1–Σ9 + `hooks/__tests__/useDebouncedCallback` Δ1–Δ4.
  **Κόκκινο πρώτα:** η 1η εκδοχή του Σ1 (`startTransition`) **πέρασε πάνω στον παλιό κώδικα** ⇒ δεν ήταν άγκυρα. Ιχνηλάτηση ανά commit βρήκε τη συνθήκη (εξωτερική ενημέρωση στην ουρά + πληκτρολόγηση στο ίδιο commit) με αποτύπωμα **ταυτόσημο** με το ζωντανό (`value=ALF input=ALFA ↔ value=ALFA input=ALF` + «Maximum update depth»). Μεταλλάξεις **6/6 κόκκινες**: παλιός κώδικας ⇒ 7 (μέσα **Σ1 + Σ9**) · χωρίς φρουρό ηχούς ⇒ Σ9 · υιοθέτηση χωρίς ακύρωση ⇒ Σ4 · καθαρισμός με debounce ⇒ Σ5 · debounce 0 ασύγχρονα ⇒ Σ6 · `cancel` no-op ⇒ 6. `--findRelatedTests` **9 σουίτες / 101 tests** ✅ · `jscpd:diff` καθαρό (5 αρχεία). **Ζωντανά μετά:** η ίδια πράξη ⇒ τιμή σταθερή, λίστα 9→1, **0** σφάλματα.
- Παρατηρήσεις (όχι Β-ΙΙ, **ανεπιβεβαίωτες** ως προς την αιτία): στη στενή στήλη (~960px) οι κάρτες διευθύνσεων επικαλύπτουν κείμενο και κουμπιά · στην προβολή της ALFA το ΑΦΜ γράφει «χρησιμοποιείται ήδη από: Άγνωστη Επαφή».
- **Λ1 ✅** (η έδρα ήταν **κενή** ⇒ συμπληρώθηκε «Ιωάννη Τσιμισκή 50, 546 23» = αλλαγή **μίας** διεύθυνσης): `customFields.activityType` **επιβίωσε** (Φ0) · και οι 3 διευθύνσεις πήραν `id` (`addr_…`) + `coordinates` + `source:'geocoded'` + `verifiedAt` + `geocodingMetadata`, **ίδια** ids σε `companyAddresses` **και** `addresses[]`, **ένα** `_lastModifiedAt` · `POST …/address-positions` → 200. Το «Ονειροπόλων 42» πήρε ειλικρινά `accuracy:'center'` (conf. 0,66).
- **Λ2 ✅** (σε **κανονική** προβολή): σύρσιμο έδρας ⇒ διάλογος **αμέσως** («Αναζήτηση διεύθυνσης… Μπορείς ήδη να κρατήσεις μόνο τη θέση») · απάντηση «Ερμού 18, Φραγκομαχαλάς» · «Μόνο η θέση» → Αποθήκευση ⇒ `source:'dragged'`, νέες `coordinates` (~300 m), **ίδιο** `id`, νέο `verifiedAt`, κείμενο **ίδιο**, **κανένα** μπαγιάτικο `geocodingMetadata`, υποκαταστήματα ανέγγιχτα.
- **Λ3 ✅**: reload + 3 επίπεδα zoom **πάνω στη μύτη** (`path.getBBox`+`getScreenCTM`) ⇒ συντεταγμένες κάτω από τη μύτη 22,940931 / 40,635392 έναντι Firestore 22,940902 / 40,635363 (**~3 m**, όσο η ανάλυση του δείκτη)· η θέση της μηχανής απέχει **~340 m** ⇒ **δεν πηδά**.
- **Λ4 ✅** (σε **επεξεργασία** — σε προβολή οι πινέζες **δεν** σύρονται, `draggableMarkers` μόνο στην επεξεργασία· το σύρσιμο εκεί **μετακινεί τον χάρτη**, σωστά): `ViewDragConfirm` **αμέσως** (`pending`) · πρόταση «Πόντου, 570 08, Νέα Μαγνησία» (**άλλος δήμος**) · «Ναι, ενημέρωσε» ⇒ του **υποκαταστήματος** η ιεραρχία **καθαρίστηκε** (`municipalityId/settlementId: null`, `*Name: ''`), της **έδρας** ταυτόσημη (λίστα, παράγωγο, επίπεδα πεδία, `customFields.municipality`).
- **Λ5 ✅**: οδός έδρας → «Εγνατία» ⇒ πινέζα **μένει** (`source:'dragged'`, ίδιο `verifiedAt`) · σε προβολή «Η πινέζα απέχει 217 μ. …» + «Μετακίνησε / Κράτα» · «Κράτα» ⇒ φεύγει, **καμία** εγγραφή (ίδιο `_lastModifiedAt`) · αριθμός → 100 ⇒ «απέχει 455 μ.» · «Μετακίνησε» ⇒ πινέζα κινείται **χωρίς reload** (ίδια φόρτωση, 644″), Firestore `source:'geocoded'`, `accuracy:'exact'`, νέο `verifiedAt`, απόσταση από την προηγούμενη **≈ 456 m** (= η ειδοποίηση).
- **Λ7 ✅ (κατά σχεδιασμό)**: ψεύτικο κρέμασμα **μόνο** στο σύνορο `window.fetch` για `…/address-positions`, που **σέβεται** το `AbortSignal` (όπως πραγματικό κολλημένο αίτημα — αλλιώς θα κρεμούσε **για πάντα** από σφάλμα της δοκιμής) ⇒ ακύρωση στα **60.001 ms** (`fetchWithTimeout`, προεπιλογή `60000`) · `408 REQUEST_TIMEOUT` **χωρίς** επανάληψη (`shouldRetry`: μόνο 5xx / δικτυακό `TypeError`) · `warn` «Θέσεις διευθύνσεων: ο γραφέας δεν απάντησε — αποθήκευση με τις θέσεις της φόρμας» · η αποθήκευση **προχώρησε** (αριθμός 102, θέση και `verifiedAt` **ίδια** με της φόρμας) · το `fetch` **επανήλθε** (εγγενές, επαληθευμένο).
- 🔴 **Εύρημα Ζ5 (UX) — ένας μη κρίσιμος γραφέας κρατά την Αποθήκευση ένα ΛΕΠΤΟ.** Κλικ → ολοκλήρωση **61,4″**, με το κουμπί «Αποθήκευση» **ενεργό** και **χωρίς** καμία ένδειξη εξέλιξης (ο άνθρωπος μπορεί να ξαναπατήσει). Ο ίδιος ο πελάτης γράφει «η διαθεσιμότητα μιας επαφής δεν εξαρτάται από τον γεωκωδικοποιητή» — αλλά ο **χρόνος** της εξαρτάται πλήρως.

  ✅ **ΕΚΛΕΙΣΕ 2026-09-12 (Plan Mode, τρία στρώματα — απόφαση Giorgio «όλα»).**

  🔴 **Η έρευνα άλλαξε την προτεραιότητα: δεν ήταν μόνο UX, ήταν ΣΥΜΜΟΡΦΩΣΗ.** Η πολιτική του Nominatim
  λέει ρητά *«Results **must** be cached on your side. Clients sending repeatedly the same query may be
  classified as faulty and **blocked**»*. Η διαδρομή του διακομιστή δεν είχε **καμία** μνήμη: κάθε
  αποθήκευση ξαναρωτούσε από την αρχή, **έως 8 παραλλαγές** (`geocoding-engine.ts:67-76`) με
  `sleep(1100ms)` πριν από κάθε μία (7 σημεία). Δηλαδή τα 61,4″ ήταν ταυτόχρονα **κίνδυνος αποκλεισμού**.

  ⚠️ **Η μνήμη υπήρχε ήδη — στη ΛΑΘΟΣ πλευρά του συνόρου.** Το `geocoding-service.ts` έχει cache +
  in-flight dedup, αλλά είναι περιτύλιγμα **πελάτη**. Η αποθήκευση καλεί τη μηχανή **μέσα στη διεργασία**
  και δεν το έβλεπε ποτέ.

  | Στρώμα | Τι έγινε |
  |---|---|
  | **Ε — μην ρωτάς** | Μνήμη + in-flight dedup **στη μηχανή** (`geocoding-cache.ts`, πάνω στο υπάρχον SSoT `EnterpriseAPICache`). Επειδή πληκτρολόγηση (`/api/geocoding`) **και** αποθήκευση καταλήγουν στο **ίδιο** `geocodeWithVerdict`, ό,τι έλυσε ο συντάκτης όσο πληκτρολογούσε ο άνθρωπος, η αποθήκευση το βρίσκει **δωρεάν**. Πολιτική ανά ετυμηγορία: `hit` μεγάλη διάρκεια · `absent` **σύντομη** (αρνητική μνήμη, πρότυπο DNS — αλλιώς η **χειρότερη** περίπτωση πλήρωνε και τις 8 παραλλαγές σε κάθε αποθήκευση) · `unavailable` **ποτέ**. |
  | **Π — ρώτα με προθεσμία** | *Deadline propagation* (Google SRE), το **ίδιο** πρότυπο που το Β13 έβαλε στο αντίστροφο: κάθε διεύθυνση ρωτά το **υπόλοιπο** πριν ρωτήσει. **Όγδοη έκβαση `budget-exhausted`** — «δεν πρόλαβα» **δεν είναι** «δεν απάντησε»· ίδια πράξη, άλλη αιτία, και μια λογιστική που τα ισοπεδώνει κατηγορεί πεσμένο γεωκωδικοποιητή ενώ απλώς σεβαστήκαμε τον χρόνο του ανθρώπου. **Θέσεις πριν από συμβουλές**: η μέτρηση απόκλισης (`keepHumanPin`) θυσιάζεται **πρώτη**. Αναβίωσε η **νεκρή** `RESOLVER_TIMEOUT_MS` (9.000, ίδια με το `REVERSE_BUDGET_MS`) + `RESOLVER_CLIENT_GRACE_MS` (3.000). Ο πελάτης φράσσεται σε προθεσμία+περιθώριο με **`retry: false`** — ο `apiClient` επαναλαμβάνει **3 φορές**, άρα σκέτο `timeout` θα τριπλασίαζε την αναμονή **και** θα ξανάστελνε ταυτόσημο ερώτημα. |
  | **Υ — πες την αλήθεια** | Νέο SSoT `useInFlightAction` (φραγμός επανεισόδου + `finally` + το σφάλμα **περνά**), γιατί η σωστή συμπεριφορά υπήρχε **μόνο** στη δημιουργία και πουθενά κοινή. Η **κοινή** `EntityHeaderAction` απέκτησε `pending`/`pendingLabel` ⇒ `disabled` **και** `aria-busy` **και** εναλλαγή ετικέτας (W3C ARIA25: η παράλειψη της απενεργοποίησης είναι *«a common mistake»*). Ο τύπος του `createEntityAction` **απέκλειε** ακόμη και το `disabled` — γι' αυτό ο καλών δεν *μπορούσε* να το δηλώσει. Καλωδιώθηκε και το **δεύτερο, ξεχωριστό** κουμπί του κινητού, που ήταν εντελώς αφύλαχτο. Μηδέν νέα κλειδιά για την ετικέτα (`common-actions:actions.save_loading`). |
  | **Ειλικρίνεια** | «Γνωστά εκκρεμές», όχι σιωπή: οι εκκρεμείς θέσεις ταξιδεύουν **ονομαστικά** (`pendingIds` → `positionsPending`) και η κάρτα δείχνει «η θέση εκκρεμεί». Η Salesforce στην ίδια κατάσταση αφήνει τη συντεταγμένη κενή **χωρίς να πει τίποτα**. |

  **Πού ξεπερνάμε τους μεγάλους**: η Google λύνει το «μην ξαναρωτάς» στον **πελάτη** (μεταφορά
  συντεταγμένων ⇒ αλλαγή σχήματος + όριο εμπιστοσύνης)· εμείς στη **μηχανή** — χωρίς αλλαγή σχήματος,
  χωρίς να εμπιστευτούμε συντεταγμένες από τον πελάτη, και για **κάθε** καλούντα. Και κρατάμε «μία
  εγγραφή, μία γραμμή ιστορικού» εκεί που η Salesforce παραιτείται. 🔑 **Λεπτομέρεια που το κάνει
  καλύτερο από το ασύγχρονο**: ένα αίτημα που ξεπέρασε την προθεσμία **δεν πάει χαμένο** — όταν
  προσγειωθεί, γεμίζει τη μνήμη, οπότε η **επόμενη** αποθήκευση το βρίσκει έτοιμο.

  **Άγκυρες**: `geocoding-cache` (Ε1–Ε6, μαζί με άγκυρα **καλωδίωσης**) · `address-position-budget`
  (Π1–Π4) · `useInFlightAction` (Υ1–Υ3β) · `entity-action-pending` (Υ4–Υ4γ). **Μεταλλάξεις 19/19**
  σκοτωμένες (η Υ-M2 ξαναγράφτηκε επειδή σκότωνε με **συντακτικό** σφάλμα — δεν αποδείκνυε σημασιολογία).
  **20 σουίτες / 214 πράσινα.** Boy-Scout: `aria-busy` και στο `SaveButton` της δημιουργίας (δεν το είχε
  **ούτε** το «σωστό» κουμπί)· ενοποιήθηκαν δύο **ταυτόσημα** σκέλη στο `ContactDetailsHeader` (CHECK 3.28).

  #### Ζωντανή επαλήθευση (Chrome + πραγματική διαδρομή διακομιστή, 2026-09-12)

  | Μέτρηση | Αποτέλεσμα |
  |---|---|
  | Ίδια διεύθυνση, **κρύα** μνήμη | **29,2″** |
  | Ίδια διεύθυνση, **ζεστή** μνήμη | **743 ms** · επανάληψη **703 ms** ⇒ **~40× ταχύτερα** |
  | Νέα άλυτη διεύθυνση, **μετά** τη διόρθωση | **8,7″** · **4,7″** — εντός του προϋπολογισμού των 9″ |
  | **Τρεις** άλυτες διευθύνσεις | **9,79″** συνολικά · `positionsPending: ["addr_p_…_3"]` ⇒ η τρίτη αναφέρεται **ονομαστικά**, με τη θέση της **ανέπαφη** |
  | Κουμπί αποθήκευσης | `aria-busy` παρόν (πριν: **δεν υπήρχε καθόλου** το γνώρισμα) |

  🔴 **Η ζωντανή μέτρηση βρήκε κενό στην ΠΡΩΤΗ υλοποίηση, και το κενό ήταν στον ισχυρισμό μου.** Ο έλεγχος
  «απομένει χρόνος;» γινόταν **πριν από κάθε διεύθυνση**, όχι **μέσα** στην κλήση. Με **μία** διεύθυνση ο
  έλεγχος περνά μία φορά και μετά η σκάλα των 8 παραλλαγών τρέχει ανεμπόδιστη: μετρήθηκαν **29,2″** ενώ ο
  προϋπολογισμός ήταν **9**. Δηλαδή η προθεσμία έφραζε «**πόσες** διευθύνσεις ξεκινώ», όχι «**πόσο** κρατά
  η καθεμία» — και τα unit tests ήταν πράσινα επειδή χρησιμοποιούσαν **ακαριαίο** πλαστό γεωκωδικοποιητή.
  Διόρθωση: `askWithinBudget` φράζει την **ίδια** την κλήση στο υπόλοιπο· άγκυρα **Π5** (μηχανή που δεν
  απαντά **ποτέ** ⇒ ο γραφέας οφείλει να γυρίσει μόνος του) + **Π5β** παρονομαστής · μετάλλαξη **Π-M7**.
  **Σύνολο μεταλλάξεων 20/20.**
- ⚠️ **Εύρημα Ζ6 — μετά από αποτυχία του γραφέα η θέση ισχυρίζεται «geocoded / exact» για ΑΛΛΟ κείμενο.** Στο Λ7 η έδρα λέει «Εγνατία **102**» αλλά η θέση είναι της «Εγνατία **100**» με `source:'geocoded'`, `accuracy:'exact'` — κανένα σημάδι «δεν λύθηκε για το τρέχον κείμενο». Ξαναλύνεται **μόνο** στην επόμενη αλλαγή διεύθυνσης (dirty diff, ADR-323)· χωρίς αυτήν μένει έτσι. «Άγνοια ≠ γνώση» κρατιέται για το **σβήσιμο**, όχι για την **ετικέτα**.
- 🔴 **Εύρημα Ζ3 — ο διάλογος συρσίματος είναι ΑΟΡΑΤΟΣ στην πλήρη οθόνη, και το πρώτο κλικ τον ΑΚΥΡΩΝΕΙ σιωπηλά.** Το `FullscreenOverlay` (`src/core/containers/FullscreenOverlay.tsx:131`) δηλώνει ωμό `z-[60]`· ο `ui/dialog` (`:78`, `:117`) `z-50` ⇒ ο διάλογος (και το σκούρο φόντο του) ζωγραφίζεται **κάτω** από την πλήρη οθόνη. Το Radix βάζει `pointer-events:none` στο `body` ⇒ η πλήρης οθόνη **δεν δέχεται** κλικ· το πρώτο κλικ του ανθρώπου (π.χ. «έξοδος πλήρους οθόνης») διαβάζεται ως «κλικ έξω» ⇒ **Ακύρωση** ⇒ η πινέζα **πηδά πίσω**. Αποδεδειγμένο: DOM (δύο `role=dialog`, z 60 / 50) · στιγμιότυπο (τίποτα ορατό) · το κλικ εξόδου **δεν** βγήκε από την πλήρη οθόνη, **έκλεισε** τον διάλογο. Άρα **σε πλήρη οθόνη το σύρσιμο έδρας δεν ολοκληρώνεται ΠΟΤΕ**. Ίδιο ρίσκο για κάθε διάλογο/sheet/context-menu (`z-50`) που ανοίγει μέσα από `FullscreenOverlay` (15 καταναλωτές). **Τυφλό σημείο της CHECK 3.50**: κατώφλι «καθολικής στρώσης» **1000** ⇒ το 60 και το 50 ταξινομούνται `local-stacking`, ενώ είναι `fixed inset-0` σε portal στο `body` — καθολικές. ⚠️ **Όχι απλή διόρθωση**: `popover`/`dialog`/`sheet`/`context-menu` είναι **όλα** `z-50` (DOM order αποφασίζει) ⇒ αν ανέβει **μόνο** ο διάλογος στο `modal`, κάθε Popover/Combobox μέσα σε διάλογο πέφτει **πίσω** του (η ένσταση του ADR-780 §… «3 Radix Select»). Απόφαση εύρους → Giorgio.
  ✅ **ΔΙΟΡΘΩΘΗΚΕ — ADR-780 Φάση Δ (§5quater)** (απόφαση Giorgio: Plan Mode): **ένα** σκαλί `transientStack` (1095) για όλη την παροδική οικογένεια (μέσα της νικά ο νεότερος — κανόνας top layer), **δικός** ρόλος `fullscreenSurface` (1045) για την πλήρη οθόνη (κάτω από την πλωτή παλέτα DXF, που αιωρείται σκόπιμα πάνω της)· σβήστηκε η **σκιώδης αυθεντία** του Select στο `globals.css` (έριχνε κάθε Select στο 1000 — πίσω από κάθε διάλογο που θα ανέβαινε)· η CHECK 3.50 ρωτά πλέον τη **δομή** (`global-by-structure`, `shadow-authority`). Άγκυρα `ui/__tests__/layer-contract` (11) + 14 της πύλης· 8/8 μεταλλάξεις κόκκινες. **✅ Ζωντανά επαληθευμένο** (ALFA, πλήρης οθόνη): διάλογος ορατός (1095 > 1045) · το πρώτο κλικ φτάνει στον διάλογο · «Μόνο η θέση» ολοκληρώνεται (πινέζα μένει, πλήρης οθόνη μένει) · Select = 1220 · ακύρωση επεξεργασίας ⇒ καμία εγγραφή. 🔴 **Νέο εύρημα της επαλήθευσης**: ένα **Escape** σε αυτόν τον διάλογο κλείνει **και** την πλήρη οθόνη (ωμός listener του `useFullscreen`, εκτός ADR-364) — ανήκει στο χωριστό βήμα της συμπεριφοράς modal (ADR-241).
  ✅ **ΒΗΜΑ 2 ΚΛΕΙΣΤΗΚΕ ΣΕ ΚΩΔΙΚΑ (2026-09-11, Plan Mode — ADR-241 «Επιφάνεια»)**: η 2η δέσμη ζωντανών του Ζ3 (ADR-780 §5quater.4) έβγαλε το διπλό Escape σε **4** καταναλωτές **και στον DXF**, και τρία ακόμη ελαττώματα της ίδιας επιφάνειας — **κεφαλίδα ύψους 0** (ρίζα: `globals.css` `overflow-x: hidden`, δεύτερη εμφάνιση του ADR-750 §21.10), **remount των παιδιών σε κάθε εναλλαγή** (Νομικά «Ανάθεση» χαμένη · DXF 4/4 καμβάδες ξαναστημένοι) και **ψευδές `starved`** (το «1 Issue»). Όλα κλειστά: στοίβα `escape-layers` («ένα Esc = ένα πλαίσιο»: στρώση → πεδίο κειμένου → πλήρης οθόνη) · `inert` έξω με συνοδούς ζωντανούς · focus μέσα/πίσω · σταθερός ξενιστής + `moveBefore` · `clip` + `:where` · κρίση `unarmed`. 18 σουίτες / 278 πράσινα · μεταλλάξεις 42/42. ✅ **ΚΑΙ ΖΩΝΤΑΝΑ (2026-09-12)** — και τα έξι σημεία πέρασαν, με τους αριθμούς στον πίνακα «Ζωντανή επαλήθευση της επιφάνειας» του ADR-241: κεφαλίδα **36px** · «Ανάθεση» **ίδιος κόμβος DOM** είσοδο και έξοδο · DXF **4/4 καμβάδες, 0 ξαναστημένοι** · Esc#1 μόνο τη στρώση Radix · Esc με εργαλείο ⇒ `consumedBy: measure/dist` και η πλήρης οθόνη μένει · σεντινέλα `ok` (τέλος το «1 Issue») · `focusIsOpener: true` · χάρτης με **ζωντανό** WebGL context · 5 σελίδες στα 625px με **0** παλινδρομήσεις. 🔴 Η ζωντανή επαλήθευση βρήκε **ένα ελάττωμα αόρατο στα tests**: ο περιέκτης ειδοποιήσεων αδρανοποιούνταν (το `[data-sonner-toaster]` γεννιέται **τεμπέλικα**) ⇒ κάθε ειδοποίηση σε πλήρη οθόνη ήταν απάτητη **και** ανακοίνωτη· διορθώθηκε με αρχή (`body > [aria-live]`), άγκυρα C5, μεταλλάξεις 3/3 (ADR-711 §10.11). Δεδομένα δοκιμής που έμειναν (εντολή Giorgio): «ΔΟΚΙΜΗ Γ» Κρατημένη + πρόγραμμα 9 δόσεων · φάση PH-002 στο «KTIRIO A TEST».
- ⚠️ **Εύρημα Ζ2 (δεδομένα)**: ο οικισμός γράφεται «Δημοτική Ενότητα Θε**σ**αλονίκης» — τον επιστρέφει έτσι ο **Nominatim** (τεκμηριωμένο στο `lib/geocoding/address-candidate-identity.ts:24`). Ενώ έχουμε `settlementId` (`settlement:0701010001`), αποθηκεύουμε την **ετικέτα της μηχανής** στο `city`/`settlement` αντί για το όνομα του **δικού μας** μητρώου.
- ⚠️ **Εύρημα Ζ4 (λεξιλόγιο)**: μετά από «Ναι, ενημέρωσε» το υποκατάστημα έχει `country:'Ελλάδα'` ενώ όλες οι άλλες `'GR'`, και `region:'Περιφέρεια Κεντρικής Μακεδονίας'` (πεζά, της μηχανής) **δίπλα** σε `regionName:''` — `components/contacts/dynamic/contact-address-drag.ts:49-50` περνά **ωμά** `dragged.region` / `dragged.country`. Επίσης η ιεραρχία του υποκαταστήματος μένει **κενή** (καθαρίστηκε, δεν ξαναλύθηκε — δηλωμένο ως «καθαρή» στο Β-ΙΙ, αλλά το υποκατάστημα χάνει δήμο).

  ✅ **Ζ4α + Ζ4δ ΕΚΛΕΙΣΑΝ — Φάση Α «η χώρα είναι ΚΩΔΙΚΑΣ, το όνομα ΠΑΡΑΓΕΤΑΙ» (2026-09-12, Plan Mode).**

  **Η αρχή**: αποθηκεύεται **ISO 3166-1 alpha-2**, εμφανίζεται **παραγόμενο** όνομα — ό,τι ορίζει το `schema.org/addressCountry` και ό,τι **το ίδιο το έργο ήδη τηρούσε** για το `birthCountry` (`VOCAB_COUNTRY_OPTIONS` = ISO + κλειδί i18n). **Η διεύθυνση ήταν η εξαίρεση, και γι' αυτό έσπασε.**

  🔑 **Η ασυμμετρία που ήταν η ρίζα**: το `diffAddressFields.comparable()` περνούσε **ήδη** από το SSoT (`countryNameToCode`, ADR-332 D27 Β9) — **συγκρίναμε σε ταυτότητα και αποθηκεύαμε σε ετικέτα**. Δεν έλειπε μηχανή· έλειπε **κλήση στη γραφή**.

  **Τι έγινε**: το `utils/address/country-codes.ts` έγινε **ο ΕΝΑΣ πίνακας** (16 χώρες × ταυτότητα + κλειδί ετικέτας + όσες γραφές φτάνουν πραγματικά), με `toStoredCountryCode()` (κενό ⇒ `undefined` · γνωστή ⇒ ISO κεφαλαία · **άγνωστη ⇒ το κείμενο αυτούσιο** — καμία απώλεια, καμία επινόηση), `DEFAULT_STORED_COUNTRY_CODE`, `countryLabelKey()` και `ADDRESS_COUNTRY_OPTIONS`. Πέρασαν από το σύνορο **και οι δέκα** γραφείς: `contact-address-drag` · `addresses-section-form-mapping` · `use-hq-address-mutations` (×3) · `CompanyAddressesSection` · `address-info-builder` · `types/project/address-helpers` (×2) · `pin-drop` · `useAddressMapGeocoding.helpers` · `postalCodeAutoFill` · `ContactsList`.

  🔴 **Τα «τρία λεξιλόγια χώρας» έγιναν ένα.** Το σχόλιο του `address-info-builder:59-66` έλεγε *«η ενοποίηση των τριών είναι ξεχωριστή απόφαση με δική της μετάπτωση»*. **Καμία μετάπτωση δεν χρειάστηκε**: η ανάγνωση ήταν ήδη ανεκτική σε «Greece»/«Ελλάδα»/«GR», οπότε άλλαξε μόνο ο **ιδιοκτήτης** της τιμής.

  🔴 **ΔΕΥΤΕΡΟ, ΑΔΗΛΩΤΟ ΣΦΑΛΜΑ ΠΟΥ ΑΠΟΚΑΛΥΨΕ Η ΑΛΛΑΓΗ** — `types/project/address-helpers.ts:149`: ο κανόνας «μη δείχνεις τη χώρα όταν είναι η προεπιλεγμένη» συνέκρινε **κείμενο** (`!== 'Greece'`), ενώ το σύρσιμο πινέζας αποθήκευε «Ελλάδα». Άρα **κάθε ελληνικό έργο με συρμένη πινέζα τύπωνε «…, Ελλάδα»** σε δημόσια βιτρίνα και PDF (`formatFullAddressLine` → `snapshot-field-builders`). Η σύγκριση γίνεται πλέον σε **ταυτότητα**.

  🏆 **Και η ΟΘΟΝΗ άλλαξε, γιατί έπρεπε**: το πεδίο χώρας ήταν ελεύθερο `<Input>` δεμένο στην αποθηκευμένη τιμή — **αντίφαση πάνω σε κωδικό** (ή δείχνεις «GR», ή αποθηκεύεις ετικέτα· το δεύτερο **ήταν** το Ζ4α). Έγινε **επιλογέας** (`SearchableCombobox`, το ίδιο ιδίωμα με τα άλλα οκτώ επίπεδα της φόρμας), με `allowFreeText` ώστε **καμία δυνατότητα να μην αφαιρεθεί** — μόνο η αμφισημία. Είναι η πρακτική κάθε σοβαρής φόρμας διεύθυνσης (Google · Stripe · Amazon).

  **Άγκυρες** (`__tests__/contact-address-drag.test.ts`, **κόκκινες πριν**): «Ελλάδα» από τη μηχανή ⇒ `'GR'` · **άγνωστη χώρα δεν χάνεται** · **Ζ4δ** «η αυθεντική εγγραφή και το παράγωγο συμφωνούν στη χώρα» (πριν: `undefined` vs `'GR'` — δύο αποφάσεις για την κενή χώρα σε δύο αρχεία, μέσα στο ίδιο έγγραφο).

  ⏳ **Μένουν Ζ4β** (ωμό `region` δίπλα σε κενό `regionName`) **και Ζ4γ** (κενή ιεραρχία υποκαταστήματος) → Φάση Β′, μαζί με το **Ζ2**.
- **Λ6 ✅ (2η συνεδρία, 2026-09-11)** — νέα επαφή «ΔΟΚΙΜΗ Β-ΙΙ Λ6» (`contacts/cont_f090b89c…`): «Ιωάννη Τσιμισκή 50, 546 23» → υποψήφια 1 (100%) → σύρσιμο στην **κανονική** προβολή ⇒ διάλογος **αμέσως** (πρόταση «Μητροπόλεως 43, Λαδάδικα») → «Μόνο η θέση» ⇒ κείμενο **αμετάβλητο**, πινέζα **μένει**, οι υποψήφιες δείχνουν πλέον απόσταση (89 μ.) → ΑΦΜ (ο Giorgio) → Δημιουργία ⇒ **μία** εγγραφή (`createdAt` = `_lastModifiedAt`) με `customFields.companyAddresses[0]` = `id` (`addr_d490acd9…`) + `coordinates` + `source:'dragged'` + `verifiedAt`, και `addresses[0]` με **ίδιο** `id` / θέση / `source` · `POST …/address-positions` → 200 (διάρκεια > 6,4″· η φόρμα **δημιουργίας** έδειχνε «Αποθήκευση…» με απενεργοποιημένο κουμπί — η **επεξεργασία** όχι, βλ. Ζ5) · κάδος ⇒ `status:'deleted'`, `previousStatus:'active'`, `deletedAt`/`deletedBy`, `DELETE` → 200 · οριστική διαγραφή: ο Giorgio.
  Στο ίδιο έγγραφο φάνηκαν τα Ζ2/Ζ4 **και σε νέα επαφή**: `city`/`settlement` = «Δημοτική Ενότητα Θεσαλονίκης» με `settlementId`/`municipalityId: null` (η ιεραρχία **δεν λύνεται ούτε μετά από επιλογή υποψήφιας 100%**) · στο `companyAddresses[0]` το `country` **λείπει εντελώς**, ενώ το παράγωγο `addresses[0]` γράφει `'GR'`.
- ⚠️ **Εύρημα Ζ7 (διάταξη) — σε παράθυρο ~1200 CSS px τα πεδία Οδός / Αριθμός / Τ.Κ. του `AddressEditor` έχουν ωφέλιμο πλάτος ΜΗΔΕΝ.** Μετρημένο: πλάτος 26 px, padding 12+12 ⇒ `clientWidth − padding = 0`· ο χάρτης 215 px, η πινέζα εκτός κάδρου. Ο άνθρωπος **δεν βλέπει τι γράφει**. Επιβεβαιώνει την «ανεπιβεβαίωτη» παρατήρηση της 1ης συνεδρίας για τη στενή στήλη. Στα 2180 CSS px: Οδός 333 px, κανονικά.
  Σύμπτωμα που **παραπλάνησε**: το εργαλείο του browser στέλνει ελληνικούς χαρακτήρες ως `insertText` **χωρίς** `keydown`· σε πεδίο μηδενικού ωφέλιμου πλάτους ο κέρσορας μένει στο 0 ⇒ «Τσιμισκή» → «ιμισκήσΤ». Αποκλείστηκαν με μέτρηση: λογική (το **ίδιο** πεδίο πλατυσμένο ⇒ σωστό· `SearchInput`, «Περιοχή», γυμνό `<input>` ⇒ σωστά) και καθολικοί listeners (grep: κανένας capture `input`). **Δεν είναι σφάλμα λογικής — είναι σύμπτωμα της διάταξης.**
- Παρατήρηση: στον διάλογο συρσίματος η κεφαλίδα και ο πίνακας «Σύνοψη Αλλαγών» ξεχειλίζουν ~148 px δεξιά από το πλαίσιο των 384 px (μετρημένο)· η γραμμή «Χώρα: — → Ελλάδα» δηλώνει **κενή** την τρέχουσα χώρα, ενώ η φόρμα δείχνει «Ελλάδα»· η μηχανή προτείνει ως **Πόλη** τη γειτονιά «Λαδάδικα» (οικογένεια Ζ2).
- Παρατηρήσεις: `verifiedAt` (ρολόι διακομιστή) έως **1,6″ μετά** το `updatedAt` (ρολόι Firestore) — απόκλιση ρολογιών, όχι σφάλμα· δεν συγκρίνεται χρονικά με τα timestamps του Firestore · στη στενή κάρτα το κουμπί «Μετακίνησε στη θέση τη…» κόβεται · το νέο παράθυρο της ομάδας καρτελών άνοιξε **κρυφό** (`visibilityState: hidden`) — ο Giorgio το έφερε μπροστά.

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

### D24 — «Το κύριο ή το πρώτο» ήταν ~30 αντίγραφα σε **τρεις διαφορετικές ερωτήσεις**· και η αφετηρία του D23 δεν έφτασε ποτέ στην οθόνη

**RESOLVED (μερικώς) 2026-09-05** — SSoT + **δύο διορθώσεις σφάλματος** + **ένα δηλωμένο κενό**

#### Το εύρημα #1 — ο αριθμός στο backlog ήταν **δεκαπλάσια μικρός**

Το `pending-ratchet-work.md` κατέγραψε *«αντιγραμμένο σε **τρία** domains»*. Η μέτρηση
βρήκε **~30 σημεία**. Το «τρία» ήταν όσα είχε μπροστά της εκείνη η συνεδρία — **ίδιο
σχήμα με τους μπαγιάτικους αριθμούς που ονομάζει ο N.12**: άνοιξε και μέτρα, μην
εμπιστεύεσαι αριθμό γραμμένο σε έγγραφο.

#### 🔴 Το εύρημα #2 — και **δεν είναι το ίδιο μοτίβο**

Το backlog πρότεινε *«η σωστή αφαίρεση είναι **γενική**, όχι ειδική για διευθύνσεις»*.
**Λάθος**, και μια γενική αφαίρεση που τα κατάπινε όλα θα άλλαζε συμπεριφορά σιωπηλά:

| # | Η ερώτηση | Η μορφή | Κεντρικοποιήθηκε; |
|---|---|---|---|
| 1 | «το κύριο, **αλλιώς το πρώτο**» | `find(isPrimary) ?? list[0]` | ✅ **ΝΑΙ** |
| 2 | «το κύριο **που είναι και χρήσιμο**» | `find(e => e.isPrimary && e.email)` | ⚠️ **συντίθεται** |
| 3 | «το κύριο, **αυστηρά**» | `find(isPrimary)` **χωρίς** fallback | ⛔ **ΟΧΙ, ΠΟΤΕ** |

🔑 **Η #2 δεν πήρε δική της συνάρτηση — φιλτράρεις πρώτα**: `primaryOrFirst(list.filter(…))`.
Ένα δεύτερο όρισμα-κατηγόρημα είναι παράμετρος που ο καλών **μπορεί να ξεχάσει**· ένα
φιλτραρισμένο όρισμα είναι **αδύνατο** να ξεχαστεί.

⛔ **Η #3 μένει ως έχει**: *«αν δεν όρισε κανείς κύριο, **δεν ξέρω**»* είναι υπαρκτή και
**σωστή** απάντηση σε μερικά σημεία *(`apply-project-value.ts`: η πινακίδα δεν μαντεύει
διεύθυνση)*. Fallback εκεί θα ήταν **σιωπηλή αλλαγή σημασίας**, όχι κεντρικοποίηση.

#### 🔴🔴 Το εύρημα #3 — **ΣΦΑΛΜΑ σε διαδρομή ειδοποιήσεων**, όχι απλό διπλότυπο

Το `extractPrimaryEmail` *(`api/notifications/professional-assigned/hierarchy-resolver.ts`)*
τελείωνε σε `emails[0]?.email ?? null` — **χωρίς έλεγχο κενού**. Επαφή με `{ email: '' }`
*(μισοσυμπληρωμένη φόρμα — συνηθισμένο)* επέστρεφε `''`, που **δεν είναι `null`** ⇒
περνούσε κάθε φρουρό «υπάρχει διεύθυνση;» και έφτανε στον πάροχο ως παραλήπτης. Το
`extractPrimaryPhone` είχε **το ίδιο**.

⚠️ **Η παγίδα ήταν ΗΔΗ ΟΝΟΜΑΣΜΕΝΗ** στην κεφαλίδα του `primaryEmailOf` (ADR-777 §8.33),
λέξη προς λέξη — απλώς **κανείς δεν είχε συνδέσει τα δύο σημεία**. 🔑 **Ένα SSoT που δεν
το καλεί κανείς είναι τεκμηρίωση, όχι φρουρός.**

#### 🔴🔴 Το εύρημα #4 — **η αφετηρία του D23 δεν έφτασε ΠΟΤΕ στην οθόνη**

Το ratchet ζητούσε άγκυρα για το *«αφύλακτο πέρασμα `BuildingAddressesCard →
BuildingAddressesEditor`»*. Η μέτρηση βρήκε ότι η κατάσταση είναι **χειρότερη**:

| | ο συντάκτης ανοίγει; | `projectAddresses` |
|---|---|---|
| **με** έργο | ❌ **ποτέ** — και τα **τρία** χειριστήρια είναι πίσω από `!hasProject` | γεμάτο, **αόρατο** |
| **χωρίς** έργο | ✅ ναι | **πάντα `[]`** *(ο hook το αδειάζει)* |

⇒ Οι δύο συνθήκες είναι **αμοιβαία αποκλειόμενες**. Η prop δεν είναι απλώς αφύλακτη —
είναι **ΑΔΡΑΝΗΣ** (σχήμα ADR-749): το `addressListCenter(projectAddresses)` του συντάκτη
επιστρέφει **πάντα** `null` και πέφτει στο `initialValues`. **Δεν χρειάζεται να τη σβήσει
κανείς· ήδη δεν κάνει τίποτα.**

⛔ **ΔΕΝ διορθώθηκε από πράκτορα, επίτηδες**: η θεραπεία απαντά στο *«επιτρέπεται
χειροκίνητη διεύθυνση σε κτίριο που ανήκει σε έργο;»* — **απόφαση προϊόντος**. Η άγκυρα
**δηλώνει** την τρέχουσα αλήθεια και **κοκκινίζει** την ημέρα που κάποιος κάνει τον
συντάκτη προσβάσιμο με έργο, ζητώντας να ξαναδιαβαστεί το D23.

#### Τι άλλαξε

| Αρχείο | Τι |
|---|---|
| `lib/primary-entry.ts` | **ΝΕΟ** — `primaryOrFirst`, η **μία** διατύπωση της #1 |
| `lib/contacts/primary-email.ts` | ο **πρώτος καταναλωτής** — το ειδικό («τι είναι χρήσιμο email») μένει, η επιλογή φεύγει |
| `api/buildings/building-update.handler.ts` | το `as { isPrimary?: boolean }` **έφυγε μαζί** με το διπλότυπο |
| `api/notifications/…/hierarchy-resolver.ts` | **2 διορθώσεις σφάλματος** + η διεύθυνση |
| `api/properties/[id]/hierarchy/route.ts` | το `?.` σε κάθε βήμα έφυγε — ο κοινός δέχεται `undefined` |

#### ✅ Μετρημένα

**16/16** `primary-entry.test.ts` *(ΜΕΡΟΣ Γ **εκτελεί** την παλιά γραφή και αποδεικνύει ότι
επέστρεφε `''`)* · **430/430 · 37 suites** regression *(συμπ. `route.resolver.test.ts`)* ·
**2/2 μεταλλάξεις πιάστηκαν** *(αντιστροφή προτεραιότητας → **3** κόκκινα · truthy αντί
`=== true` → **4**)*.

#### 🔴 Το εύρημα #5 — η ερώτηση #1 έχει **ΔΥΟ μορφές**, και η δεύτερη κουβαλά **το ίδιο σφάλμα**

*(Μέτρηση δεύτερης συνεδρίας, 05/09 — αντικαθιστά το πρόχειρο «μένουν ~25, τα περισσότερα
κάτω από `ai-pipeline`». **Και τα δύο σκέλη εκείνης της πρότασης ήταν λάθος.**)*

| Μορφή | Γραφή | Σημεία |
|---|---|---|
| **#1α ωμή** | `find(isPrimary) ?? list[0]` | **11** |
| **#1β προβεβλημένη** | `find(isPrimary)?.f ?? list[0]?.f` | **4** |
| **#3 αυστηρή** *(δεν μεταναστεύει **ποτέ** — δες παραπάνω)* | `find(isPrimary)` χωρίς fallback | **11** |

⇒ **μεταναστεύσιμα: 15**, όχι «~25». ⚠️ Τα **11 αυστηρά** γράφονται εδώ **ώστε η επόμενη
σάρωση να μην τα ξαναμετρήσει ως χρέος** — είναι σωστός κώδικας.

🔴 **ΚΑΙ ΤΑ 4 ΤΗΣ #1β ΕΧΟΥΝ ΤΟ ΕΥΡΗΜΑ #3, ΖΩΝΤΑΝΟ** *(`messaging-handler.ts:124` ·
`contact-linker.ts:216,217` · `sales-accounting-helpers.ts:107`)*: η **προβολή γίνεται
ΜΕΤΑ** το fallback, άρα το `?? null` στο τέλος **δεν σώζει** — το `''` δεν είναι nullish.
Είναι **αυτούσιο** το σφάλμα που ο `hierarchy-resolver` μόλις έπαψε να έχει, σε **τρία
ακόμη αρχεία**, δύο από αυτά σε **διαδρομή μηνυμάτων**.

🔑 Γι' αυτό η #1β **δεν είναι στιλιστική παραλλαγή**: το `primaryOrFirst` επιστρέφει
**εγγραφή**, οπότε το φιλτράρισμα του κενού μπαίνει **πριν** — ο κανόνας που το ίδιο το
SSoT γράφει *(«ΦΙΛΤΡΑΡΕ ΠΡΙΝ»)*. Η μετανάστευση των 4 **είναι** η διόρθωση του σφάλματος.

⚠️ **Ο ισχυρισμός «τα περισσότερα κάτω από `ai-pipeline`» ΔΕΝ επαληθεύεται**: εκεί
υπάρχουν **59** αναφορές `isPrimary`, αλλά **ένα** μεταναστεύσιμο σημείο
*(`messaging-handler.ts:124`)*. **Ο N.10 δεν είναι ο φραγμός** — η αναβολή χρειάζεται
άλλον λόγο, ή καθόλου.

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
