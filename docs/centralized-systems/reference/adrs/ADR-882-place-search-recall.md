# ADR-882 — Ανάκληση τόπου στο πεδίο αναζήτησης: «Τρέχουσα τοποθεσία» + «Ιστορικό αναζητήσεων»

| | |
|---|---|
| **Status** | IMPLEMENTED — Φάση 1 (ιστορικό ανά συσκευή) 2026-09-25, χωρίς commit |
| **Date** | 2026-09-25 |
| **Προέλευση** | Αίτημα Giorgio με στιγμιότυπα Zillow: *«όταν κάνεις κλικ μέσα στο πεδίο αναζήτησης εμφανίζεται Current Location και το ιστορικό — θέλω και σε μας»* |
| **Σχετικά** | ADR-777 Α3 *(οθόνη 1 — το κουτί «πού ψάχνεις;»)* · ADR-841 §7 Α4.5 *(πεδία ανά λειτουργία)* · ADR-841 §7 Α19.4 *(combobox APG, «η προσφορά είναι επιλογή»)* · ADR-170 *(GPS check-in)* · ADR-744 *(budget κελύφους i18n)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Τι κάνουν οι μεγάλοι

| Πλατφόρμα | Στην εστίαση του πεδίου | Όταν γράφεις |
|---|---|---|
| **Zillow** | «Current Location» + «SEARCH HISTORY» (ό,τι έγραψες, π.χ. «NY») | προτάσεις (autocomplete) |
| **Idealista** | «Buscar cerca de mí» + τελευταίες αναζητήσεις | προτάσεις |
| **Google Maps** | πρόσφατα, το καθένα με ✕ | φιλτράρισμα + προτάσεις |

**Κανόνας browser (Chrome/Lighthouse, web.dev «User Location»)**: η άδεια θέσης ζητείται **μόνο** ως απάντηση σε
χειρονομία του ανθρώπου — ποτέ στο φόρτωμα ή στην εστίαση. Άρα η εστίαση **δείχνει** την επιλογή· το αίτημα γίνεται
στο **πάτημά** της.

## 2. SSoT audit (grep, 2026-09-25)

| Ανάγκη | Υπήρχε | Απόφαση |
|---|---|---|
| Ένα κουτί τόπου | `components/search/PlaceSearchBox` — **ένας** καταναλωτής ανά σελίδα (`/` και `/stay`) | Αλλαγή σε **ένα** σημείο |
| Θέση browser | `hooks/useGeolocation` — state-based, **με ελληνικά σφάλματα μέσα στον κώδικα** (N.11) | Νέα καθαρή συνάρτηση `lib/geo/current-position`· το hook **την καλεί** (μία υλοποίηση) |
| Αποθήκευση συσκευής | `lib/storage/safe-storage` (`STORAGE_KEYS`, SSR-safe) | Νέο κλειδί `RECENT_PLACE_SEARCHES` |
| Combobox APG | `searchable-combobox`: `optionDomId`, `applyRovingArrowKey`, `useRevealHighlightedOption`, `Popover` με `role="presentation"` | Επαναχρησιμοποίηση — **καμία** δεύτερη μηχανή πληκτρολογίου |
| Geocoder | `geocodeAddressDetailed` | Αμετάβλητο |

## 3. Απόφαση

### 3.1 Τι δείχνει η λίστα (`place-recall-options.ts`, καθαρή συνάρτηση)

| Κείμενο στο πεδίο | Επιλογές |
|---|---|
| κενό | «Τρέχουσα τοποθεσία» · ομάδα «Ιστορικό αναζητήσεων» · «Καθαρισμός ιστορικού» *(μόνο αν υπάρχει ιστορικό)* |
| κάτι | μόνο οι αναζητήσεις που **ταιριάζουν** (χωρίς τόνους, πεζά) |

### 3.2 Ιστορικό (`lib/geo/recent-place-searches.ts`)

- **Έως 8**, η πιο πρόσφατη πρώτη, **ιδεμπότητα**: ίδια αναζήτηση (χωρίς τόνους/πεζά/κενά) δεν διπλασιάζεται.
- 🏆 **Κρατά το κέντρο που ήδη εντοπίστηκε** ⇒ η επανεπιλογή πηγαίνει **κατευθείαν** στα αποτελέσματα, χωρίς δεύτερη
  κλήση στον geocoder (το Zillow ξαναρωτά).
- 🔴 **Μπαίνει μόνο ό,τι εντοπίστηκε** — `not-found` δεν γράφεται ποτέ (ιστορικό με τυπογραφικά λάθη θα πρότεινε ό,τι απέτυχε).
- 🔒 **Η θέση GPS δεν αποθηκεύεται ποτέ** — η «Τρέχουσα τοποθεσία» ταξιδεύει μόνο στη διεύθυνση.
- Σχήμα με `version: 1`· χαλασμένη εγγραφή πέφτει σιωπηλά, ποτέ δεν ρίχνει την οθόνη.
- Συγχρονισμός: `useSyncExternalStore` + τοπικοί ακροατές **και** συμβάν `storage` (άλλες καρτέλες). Στιγμιότυπο με
  σταθερή ταυτότητα ανά ωμό κείμενο (αλλιώς βρόχος απόδοσης).

### 3.3 Τρέχουσα τοποθεσία (`lib/geo/current-position.ts`)

- Διακριτή ετυμηγορία: `found` | `failed: unsupported · denied · unavailable · timeout` — **κλειδιά i18n**, ποτέ κείμενο
  (`GEOLOCATION_FAILURE_I18N_KEYS` → `common-shared:geolocation.*`).
- Για «πού ψάχνεις;»: `enableHighAccuracy: false`, `maximumAge: 5′`, `timeout: 10s` — θέση γειτονιάς σε δευτερόλεπτα.
- 🏆 Στο άνοιγμα γίνεται **ερώτημα** άδειας (`permissions.query`, χωρίς παράθυρο)· αν είναι μόνιμα `denied`, η επιλογή
  γράφει *«Απενεργοποιημένη — ενεργοποίησέ την από τις ρυθμίσεις του browser»* αντί για νεκρό κουμπί.
- Αγώνας: `requestSeq` στο `PlaceSearchBox` — **μόνο η τελευταία πράξη πλοηγεί**.

### 3.4 Προσβασιμότητα (W3C ARIA APG — Combobox, list autocomplete)

↓/↑ κυκλικά · Enter επιλέγει (χωρίς επισήμανση: κανονική υποβολή) · Esc κλείνει · **Shift+Delete** αφαιρεί την
επισημασμένη (Chrome omnibox/Google), δηλωμένο με `aria-keyshortcuts`. Το ✕ είναι λαβή **μόνο για ποντίκι**, `aria-hidden`
— διαδραστικό μέσα σε `option` είναι σφάλμα axe (`nested-interactive`), και κείμενο εκεί θα γινόταν μέρος του ονόματος.
Ο «Καθαρισμός» είναι **επιλογή**, όχι κουμπί (ίδια απόφαση με ADR-841 §7 Α19.4δ). `autoComplete="off"`: αλλιώς η λίστα
του browser θα σκέπαζε τη δική μας.

### 3.5 i18n — γιατί `common-shared`, όχι νέο namespace, όχι `search-results`

Μετρημένο 2026-09-25 με `generate:i18n-shell-slice`:
- Στο `search-results` (εγγυημένο **ολόκληρο** στο κέλυφος): 15.582 / 15.200 ⇒ **εκτός budget**. Τα κείμενα φαίνονται μόνο
  μετά την εστίαση, άρα δεν δικαιολογούν bytes σε **κάθε** σελίδα.
- Νέο namespace `place-recall`: το `PlaceSearchBox` είναι στην κλειστότητα του κελύφους ⇒ *«ΜΠΗΚΕ ΣΤΟ ΚΕΛΥΦΟΣ χωρίς
  δήλωση»* + *«μεγάλωσε σε ΠΛΗΘΟΣ namespaces»*.
- `common-shared` (ήδη στο κέλυφος, **κομμένο ανά κλειδί**): μόνο τα χρησιμοποιούμενα κλειδιά, `search-results` πίσω στα
  15.152 / 15.200. Κλειδιά: `common-shared:placeRecall.*` + `common-shared:geolocation.*`.

## 4. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/geo/current-position.ts` | Η ΜΙΑ ερώτηση θέσης + ερώτημα άδειας + κλειδιά αιτίας |
| `src/lib/geo/recent-place-searches.ts` | Ιστορικό: καθαρές πράξεις + Ι/Ο + συνδρομή |
| `src/hooks/geo/useRecentPlaceSearches.ts` | React όψη (`useSyncExternalStore`) |
| `src/hooks/useGeolocation.ts` | Πλέον καλεί το `current-position`· `error: string` → `errorReason` |
| `src/components/search/place-recall/*` | Επιλογές · κατάσταση/πληκτρολόγιο · λίστα (Popover) |
| `src/components/search/PlaceSearchBox.tsx` | Καλωδίωση, εγγραφή ιστορικού στην επιτυχία, `SubmitState` ως ένωση |
| `src/components/attendance/check-in/CheckInClient.tsx` | Μεταφράζει την αιτία (ήταν ωμά ελληνικά) |

Tests: `lib/geo/__tests__/recent-place-searches.test.ts` · `lib/geo/__tests__/current-position.test.ts` ·
`components/search/__tests__/place-recall.test.tsx` (πραγματικό Radix Popover, εστίαση/κλικ/πληκτρολόγιο).

## 5. Επόμενα (δηλωμένα, όχι υλοποιημένα)

1. **Συγχρονισμός στον λογαριασμό** για συνδεδεμένους (Zillow signed-in): συλλογή Firestore ανά χρήστη, κανόνες + tests,
   enterprise IDs, συγχώνευση με το τοπικό κατά `savedAt`. Το `savedAt` υπάρχει ήδη γι' αυτό.
2. **Προτάσεις καθώς γράφεις (autocomplete)**: η πολιτική χρήσης του Nominatim **απαγορεύει** autocomplete ⇒ χρειάζεται
   Photon/δικό μας ευρετήριο — ξεχωριστή απόφαση.

## 6. Changelog

- **2026-09-25** — Φάση 1: «Τρέχουσα τοποθεσία» + ιστορικό ανά συσκευή στο `PlaceSearchBox`· `useGeolocation` χωρίς
  hardcoded ελληνικά (N.11)· 3 σουίτες jest (36 tests).
- **2026-09-25** — Πύλες commit: οι ακροατές του ιστορικού (`recent-place-searches.ts`) πάνε στο SSoT
  `createExternalStore` (σήμα έκδοσης· CHECK 3.7 `create-external-store`)· το Escape του `usePlaceRecall`
  δηλώθηκε στο allowlist του `escape-command-bus` με το προηγούμενο «editable focus»· αφαιρέθηκε αδρανής
  εξαίρεση tenant-scope στο `usePublicListings.ts` (CHECK 3.35 — ανάγνωση ενός εγγράφου, όχι ερώτημα).
