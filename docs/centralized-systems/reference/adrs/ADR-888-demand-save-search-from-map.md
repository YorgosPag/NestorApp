# ADR-888 — «Αποθήκευση αναζήτησης» από τον χάρτη αποτελεσμάτων: η ζήτηση με πολλά σχήματα

| | |
|---|---|
| **Status** | IMPLEMENTED — 2026-09-25 · ζωντανά επαληθευμένο (§6) · εκκρεμούν: ανώνυμη ροή, κινητό, μετάπτωση |
| **Date** | 2026-09-25 |
| **Προέλευση** | Handoff `2026-09-25_demand-B2-B3-email-lang` §2 (Β2). Στόχος Giorgio: ίσο ή ανώτερο Zillow / Redfin / Rightmove / Idealista |
| **Σχετικά** | ADR-885 (σχεδίαση περιοχής, `GeoDrawnArea`) · ADR-886 (όνομα ζήτησης) · ADR-887 (όνομα σε ειδοποιήσεις) · ADR-777 §7 (Α9 — η ζήτηση) |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα

1. Ζήτηση γεννιόταν **μόνο** από τη φόρμα `/demands/new` — και αυτή είναι **desktop-only** (`DemandCreationGate`).
   Ο άνθρωπος που σχεδίασε περιοχές στον χάρτη αποτελεσμάτων (ADR-885) **δεν μπορούσε να τις κρατήσει**.
2. **Ασυμφωνία μοντέλων**: η ζήτηση κρατούσε **ένα** σχήμα (`{ kind:'area'; outline }`), ενώ ο χάρτης κρατά έως
   **8** (`GeoDrawnArea.shapes`, `MAX_DRAWN_SHAPES`).
3. **Απώλεια στην επιστροφή**: η ζήτηση→φίλτρα έκανε την περιοχή **περικλείοντα κύκλο** και δήλωνε
   `area-outline` ως χαμένο άξονα. Ο σύνδεσμος «δες τι υπάρχει σήμερα» έδειχνε **άλλα** αποτελέσματα από όσα θα
   ειδοποιούσε ο cron.

## 2. Έρευνα — τι κάνουν οι μεγάλοι (2026-09-25)

| Πλατφόρμα | Πολλά σχήματα | Αποθήκευση από χάρτη | Πηγή |
|---|---|---|---|
| **Zillow** | ναι («draw several boundaries») | «Save search» + όνομα | zillow.com/news/new-draw-your-own-search-on-zillow-com |
| **Redfin** | «Multiple Area Search» | «Save Search» πάνω από τον χάρτη | support.redfin.com …/360001432532 · …/360025724771 |
| **Rightmove** | αποθηκευμένες «drawn areas» με όνομα | ναι + email alert νέων/μειώσεων | faq.rightmove.co.uk …/7000048757 |
| **Idealista** | 1–2 ζώνες | «Guardar búsqueda» ανεξαρτήτως σχήματος | idealista.com/news … 741324 |

Κανένας **δεν** συγχωνεύει ή περικόπτει τα σχήματα στην αποθήκευση. Κανένας **δεν** λέει ποια φίλτρα της οθόνης
**δεν** κρατήθηκαν στην ειδοποίηση.

## 3. Απόφαση

1. **`DemandPlace.area` = πολλά σχήματα**: `{ kind:'area'; shapes: readonly GeoOutline[] }`, η **ίδια** γεωμετρία
   με το `GeoDrawnArea` του ADR-885. Invariants: `area-empty` · `outline-degenerate` (ανά σχήμα) ·
   `area-too-many` (> `MAX_DRAWN_SHAPES`) · `area-too-large` (δεν χωρά στο URL budget του ADR-885) ⇒ κάθε
   αποθηκευμένη ζήτηση **χωρά** πάντα στον σύνδεσμο.
2. **Ένας κριτής χώρου**: το ταίριασμα της ζήτησης ρωτά το `areaRelation` (`lib/geo/geo-area.ts`) — τον **ίδιο**
   κριτή με τον χάρτη αποτελεσμάτων, με σημασιολογία **ένωσης** (ποτέ even-odd: δύο επικαλυπτόμενα σχήματα
   **δεν** ακυρώνονται).
3. **Χωρίς απώλεια στην επιστροφή**: ζήτηση→φίλτρα γράφει `GeoDrawnArea` (`?draw=`) — το `area-outline` **φεύγει**
   από το `axesLostProjectingDemand`.
4. **Αντίστροφη προβολή** δίπλα στην ορθή (`lib/demand/demand-listing-filters.ts`): φίλτρα→πρόχειρο ζήτησης +
   **`notCarried`** (τα κριτήρια της οθόνης που η ζήτηση δεν εκφράζει) — τα δείχνει το παράθυρο αποθήκευσης.
5. **Παλιά έγγραφα**: ανάγνωση-με-ανοχή (`outline` → `shapes:[outline]`) + ιδεμπότητο script μετάπτωσης
   (`--dry-run` προεπιλογή), που τρέχει **μόνο με εντολή Giorgio**. Ο κλάδος συμβατότητας φεύγει όταν η απογραφή
   δώσει 0.
6. **Κουμπί «Αποθήκευση αναζήτησης»** στον χάρτη αποτελεσμάτων → παράθυρο (δουλεύει **και στο κινητό**) με όνομα
   (ADR-886 `DemandTitleField`), σύνοψη, «δεν αποθηκεύονται», επιλογή διάθεσης αν λείπει, και σύνδεσμο
   «Περισσότερες ρυθμίσεις» → `/demands/new?from=<αναζήτηση>` (ο **σύνδεσμος** είναι ο φορέας, όχι sessionStorage).
   Ανώνυμος → σύνδεση → επιστροφή στο ίδιο URL με ανοιχτό παράθυρο.
7. **Κανόνες Firestore: καμία αλλαγή** — το `place` δεν ελέγχεται στο `firestore.rules`.

## 4. Απορριφθείσες εναλλακτικές

- **Ένα σχήμα** (κουμπί μόνο με 1 σχήμα): λιγότερα από τους μεγάλους.
- **Μία ζήτηση ανά σχήμα**: διπλές ειδοποιήσεις, σπασμένη ταυτότητα «μία ανάγκη».
- **Κυρτό περίβλημα / συγχώνευση**: αλλάζει αυτό που ζήτησε ο άνθρωπος.

## 5. Υλοποίηση (χάρτης αρχείων)

| Τι | Πού |
|---|---|
| SSoT περιοχής (όρια · κριτής ένωσης · ανάγνωση-με-ανοχή) | `src/lib/demand/demand-area.ts` |
| Τύπος + invariants | `src/types/property-demand.ts` (`area.shapes`, `area-empty/too-many/too-large`) |
| Σύνορο ανάγνωσης | `src/lib/demand/property-demand-from-document.ts` (`withAreaShapes`) |
| Ταίριασμα | `src/lib/demand/demand-match-axes.ts` → `isPointInDemandArea` |
| Ζήτηση → φίλτρα (`?draw=` αυτούσιο) | `src/lib/demand/demand-listing-filters.ts` |
| Φίλτρα → φόρμα (+ `notCarried`) | `src/lib/demand/demand-form-from-filters.ts` |
| Ομοιότητα ζητήσεων (συμμετρία με σχέδιο) | `src/lib/demand/demand-similarity.ts` |
| Φόρμα: πολλά σχήματα | `components/demand/form/DemandAreaOutline.tsx` · `PlaceMap` (`shapes`) · `placeShapes` |
| Split N.7.1 | `demand-form-blockers.ts` (από το `demand-form-values.ts`, 535 → 471 γρ.) |
| Μία πόρτα δημιουργίας ιδιώτη | `createPersonalDemand` στο `services/demand/property-demand.service.ts` |
| Κουμπί + παράθυρο | `components/search-results/save-search/{SaveSearchButton,SaveSearchDialogBody}.tsx` · `MapAreaControl.saveButton` |
| Διαδρομές | `demand-routes.ts`: `newDemandFromSearchHref` (`?from=`) · `SAVE_SEARCH_INTENT_PARAM` (`?save=1`) |
| Κωδικοποιητής Firestore (`{ring}`) | `demandPlaceForStorage` (γραφή) · `withAreaShapes` (ανάγνωση) στο `demand-area.ts` |
| «✓ Αποθηκευμένη αναζήτηση» | `lib/demand/demand-saved-search.ts` (`savedDemandForSearch`) + `useMyDemands` στο `SaveSearchButton` |
| Μετάπτωση | `scripts/migrate-demand-area-shapes.ts` (dry-run προεπιλογή) |
| i18n | `search-region:saveSearch.button` · `search-region:draw.addShape` · `property-market:demand.saveSearch.*` · plural `demand.name/summary.area` |

⚠️ **Ο προϋπολογισμός i18n οδήγησε τη θέση των κλειδιών** (CHECK 3.34): στο `search-results` ξεπερνούσαν το ταβάνι του
μητρώου μετανάστευσης, και ένα `import type` από το σώμα του παραθύρου διπλασίαζε την κλειστότητα της δημόσιας σελίδας
(12.698 → 25.478). Θεραπεία: ετικέτα κουμπιού στο μικρό `search-region`, κείμενα παραθύρου στο `property-market` που το
δυναμικό σώμα φέρνει ήδη, τύπος props inline. Το `/demands/new` ξανασφραγίστηκε με γραμμένο λόγο (10.757 → 13.751).

## 6. Ζωντανή επαλήθευση (dev server, 2026-09-25)

✅ Αναζήτηση με 2 σχήματα (Θεσσαλονίκη + Κοζάνη) → «Αποθήκευση αναζήτησης» → αυτόματο όνομα «Αγορά · 2 σχεδιασμένες
περιοχές» (πληθυντικός) · καμία λίστα «δεν κρατιούνται» (σωστά) · όνομα → Αποθήκευση → «Η αναζήτηση αποθηκεύτηκε» →
έγγραφο `place.shapes:[{ring},{ring}]` · σελίδα ζήτησης: «Σε 2 σχεδιασμένες περιοχές», μηχανή: 1 ταιριάζει, 2 «εκτός της
περιοχής που σχεδίασες» · «Δες τα αποτελέσματα» → **ταυτόσημο URL** με το αρχικό · το κουμπί γίνεται «✓ Αποθηκευμένη
αναζήτηση». Με όριο περιφέρειας: «δεν κρατιούνται: το όριο περιοχής του χάρτη».

🔴 **Τρία σφάλματα που βρέθηκαν ΜΟΝΟ ζωντανά** (όλα διορθώθηκαν, με άγκυρα όπου γίνεται):
1. **`Nested arrays are not supported`** — το Firestore απέρριψε το `shapes: GeoOutline[]`. Κανένα jest δεν γράφει σε
   Firestore. Θεραπεία: κωδικοποιητής στο σύνορο αποθήκευσης (`{ring}`)· άγκυρα `hasNestedArray` + round-trip στο
   `demand-area.test.ts`. Η μνήμη μένει ίδια γεωμετρία με τον χάρτη.
2. **`DialogContent requires a DialogTitle`** — ο τίτλος ζούσε στο δυναμικό σώμα, άρα έλειπε όσο αυτό φόρτωνε
   (παράθυρο ανώνυμο για αναγνώστη οθόνης). Θεραπεία: τίτλος στατικός στο `SaveSearchButton`.
3. **Μετά την αποθήκευση το κουμπί έμενε «Αποθήκευση»** (παρατήρηση Giorgio) ⇒ δεύτερο κλικ = διπλή ζήτηση, διπλές
   ειδοποιήσεις. Θεραπεία: «✓ Αποθηκευμένη αναζήτηση» παραγόμενο από τις **ζωντανές** ζητήσεις (`useMyDemands`) με
   σύγκριση στην κανονική μορφή του URL — ισχύει σε ανανέωση, άλλη καρτέλα, άλλη συσκευή· κλείνει το κενό ιδεμπότητας.

⏳ Εκκρεμεί: ανώνυμος → σύνδεση → επιστροφή με ανοιχτό παράθυρο (ο δοκιμαστής ήταν συνδεδεμένος) · κινητό πλάτος ·
«Περισσότερες ρυθμίσεις» → `/demands/new?from=` · εκτέλεση μετάπτωσης.

## Changelog

- **2026-09-25** — Δημιουργία. Απόφαση Giorgio: πολλά σχήματα · ανάγνωση + μετάπτωση.
- **2026-09-25** — Υλοποίηση Βήματα 1–5 (§5). jest: `demand-area` (μετάλλαξη even-odd ⇒ κόκκινο) · `demand-form-from-filters` (round-trip) · `demand-listing-filters` · `property-demand` (invariants) · `demand-similarity` (συμμετρία με σχέδιο) · `migrate-demand-area-shapes`. ⏳ Ζωντανή επαλήθευση στον browser + εκτέλεση μετάπτωσης: εκκρεμούν (εντολή Giorgio).
- **2026-09-25** — Ζωντανή επαλήθευση (§6): τρία σφάλματα βρέθηκαν και διορθώθηκαν (πίνακας-σε-πίνακα Firestore · `DialogTitle` · «✓ Αποθηκευμένη αναζήτηση»). jest: `demand-saved-search` · κωδικοποιητής στο `demand-area`.
