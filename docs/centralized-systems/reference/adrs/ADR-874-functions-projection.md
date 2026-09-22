# ADR-874 — Προβολή του SSoT στο Cloud Functions: **ο κώδικας παράγεται, τα κλειδιά υπολογίζονται**

| Πεδίο | Τιμή |
|---|---|
| **Category** | Infrastructure / SSoT |
| **Status** | ACCEPTED — υλοποιημένο 2026-09-22 (όχι ακόμη committed, **όχι ακόμη deployed**) |
| **Date** | 2026-09-22 |
| **Πύλη** | **CHECK 3.93** — `docs/gates/3.93.md` · `npm run test:functions-projection` |
| **Προηγούμενα** | ADR-873 *(Ε-873.1/Ε-873.2 — το mirror που απέκλινε)* · ADR-029 *(search index, μοναδικός writer η Cloud Function)* · ADR-727/744 *(CHECK 3.33/3.34 — πρότυπο φρεσκάδας)* · ADR-017 *(enterprise IDs)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα

Το `functions/` είναι **χωριστή μονάδα npm**: το Firebase ανεβάζει μόνο αυτόν τον φάκελο (`firebase.json` →
`source: functions`) και τρέχει `npm install` στο Cloud Build. Τα επίσημα docs προβλέπουν τοπικά modules μόνο με
`file:` μέσα στον φάκελο της συνάρτησης. Άρα **δεν** μπορεί να κάνει import από το `src/`, και κρατούσε
**χειρόγραφα αντίγραφα**. Μετρημένα 2026-09-22 — **καμία** πύλη δεν τα συνέκρινε:

| Αντίγραφο στο `functions/src` | Πρωτότυπο | Κατάσταση |
|---|---|---|
| `search/search-config.mirror.ts` | `src/config/search-index-config.ts` + `src/types/search.ts` | **απέκλινε ~5 μήνες** (Ε-873.1) |
| `search/indexBuilder.ts` — `normalizeSearchText` / `generateSearchPrefixes` / `extractTitle` / `buildHref` | `src/lib/search/search.ts` + helpers του SSoT | 🔴 **άλλος αλγόριθμος** (Ε-874.1) |
| `config/firestore-collections.ts` (24 ονόματα) | `src/config/firestore-collections.ts` | συμφωνούσε — τυχαία |
| `config/enterprise-id.ts` — προθέματα `eaud` / `cfaud` | `src/services/enterprise-id-prefixes.ts` | 🟠 το `cfaud` **δεν υπήρχε** στο μητρώο (Ε-874.2) |
| `shared/decode-processed-json.ts` | `src/app/api/admin/migrate-dxf-thumbnails/…` | συμφωνούσε — τυχαία |

Το `scripts/check-search-config-sync.js` υπήρχε, αλλά (α) **δεν το έτρεχε κανείς** και (β) συνέκρινε **μόνο** το
μπλοκ `SEARCH_INDEX_CONFIG` με έναν χειροποίητο parser 250 γραμμών και regex «κανονικοποίηση» — τα
`SEARCH_ENTITY_TYPES`, οι τύποι και ο normalizer ήταν εκτός ελέγχου.

## 2. Τι κάνουν οι μεγάλοι

| Πρακτική | Πότε | Εδώ |
|---|---|---|
| **Μία πηγή, πολλοί στόχοι** (Bazel `ts_library`, Nx libs) | ο στόχος **φτάνει** την πηγή στο build | ❌ το Cloud Build βλέπει μόνο το `functions/` — θα ήθελε bundler (esbuild) στην αλυσίδα παραγωγής, αλλαγή διάταξης `lib/` λίγο πριν τη Φάση 1 του ADR-873 |
| **Παραγόμενος κώδικας + πύλη επαλήθευσης** (Kubernetes `hack/update-codegen.sh` + `hack/verify-codegen.sh`, `go generate` + CI diff, protobuf) | ο στόχος **δεν** φτάνει την πηγή | ✅ **αυτό** |
| Χειρόγραφο αντίγραφο + ανιχνευτής απόκλισης | — | ❌ ανιχνεύει, δεν προλαμβάνει· και εδώ ο ανιχνευτής δεν έτρεχε |

**Και ένα βήμα πέρα από το Kubernetes**: η λίστα των κλειδιών των σταθερών **δεν γράφεται** — **υπολογίζεται** από τον
κώδικα (κάθε `COLLECTIONS.KEY` κάτω από το `functions/src`). Χειρόγραφη λίστα θα ήταν ένα ακόμη mirror.

## 3. Απόφαση

**Μηχανή**: `scripts/lib/functions-projection/` (`ast` · `constants` · `reads` · `plan` · `judge`) — TypeScript parser,
**ποτέ** regex. Γεννήτορας `scripts/generate-functions-projection.js` (`npm run generate:functions-projection`),
πύλη `scripts/check-functions-projection.js` (**CHECK 3.93**, ⛔ ZERO-TOL, καμία baseline). **Ένα** σχέδιο που
το γράφει ο γεννήτορας και το συγκρίνει η πύλη — δεν μπορούν να διαφωνήσουν. Manifest: `.functions-projection.json`.

| Είδος | Κανόνας |
|---|---|
| **module** | αντιγράφεται **αυτούσιο** (bytes του SSoT, LF) κάτω από `functions/src/generated/<ίδια διαδρομή>`. Η ίδια σχετική διάταξη ⇒ τα σχετικά imports λύνονται **χωρίς καμία μετατροπή** |
| **κλειστότητα** | φορητό module κάνει import **μόνο** node builtins και άλλα προβαλλόμενα. `@/`, πακέτο, μη προβαλλόμενο σχετικό ⇒ ⛔ |
| **constants** | υποσύνολο εξαγόμενου χάρτη. Κλειδιά = ό,τι διαβάζεται (`NAME.KEY`, `NAME['KEY']`)· τιμή = literal ή `process.env.X \|\| 'literal'` (κρατείται η προεπιλογή, σημειώνεται inline). Άλλη χρήση του αντικειμένου (`Object.keys`, spread) ⇒ ⛔ — **άρνηση, ποτέ μαντεψιά** |
| **σύνορο** | αρχείο του `functions/src` που κάνει import **έξω** από αυτό ⇒ ⛔ — παράκαμψη της πύλης **και** μετακίνηση του `rootDir` του `tsc` (`lib/index.js` → `lib/functions/src/index.js`, ενώ `main: lib/index.js` ⇒ **σπασμένο deploy**) |
| **orphan** | αρχείο στο `generated/` εκτός σχεδίου ⇒ ⛔· ο γεννήτορας το σβήνει |

**Φορητά modules που δημιουργήθηκαν** (αποσύνδεση από τύπους/ψευδώνυμα της εφαρμογής):
- `src/types/search-core.ts` — entity types, audience, `SearchIndexCoreConfig`. Το `src/types/search.ts` τα επανεξάγει
  και `SearchIndexConfig extends SearchIndexCoreConfig` (+ `statsFields`).
- `src/config/search-index-core.ts` — `SEARCH_INDEX_CORE`, `SEARCH_REQUIRED_PERMISSIONS` (`as const`) και οι καθαρές
  συναρτήσεις (`extractTitle` · `extractSubtitle` · `determineAudience` · `extractSearchableText` · `extractStatus` ·
  `buildSearchResultHref` · `generateSearchDocId`). Το `src/config/search-index-config.ts` κρατά μόνο την
  **παρουσίαση** (`statsFields`, `extractStats`) και την **απόδειξη** ότι κάθε άδεια είναι πραγματικό `PermissionId`
  (ανάθεση `Readonly<Record<SearchEntityType, PermissionId>>` — ό,τι έκανε πριν το `satisfies`, χωρίς το core να
  εισάγει RBAC). Διπλό lambda `isPublished` (BUILDING/PROPERTY) → ένα `publishedAudience`.
- `src/lib/dxf/decode-processed-json.ts` — μετακινήθηκε από `src/app/api/admin/migrate-dxf-thumbnails/` (ουδέτερη θέση
  για κοινό κώδικα· 2 importers + το test μετακινήθηκαν).
- `src/lib/search/search.ts` — ήδη φορητό (μηδέν imports), **αμετάβλητο**.

**Boy Scout στους app writers**: `search-indexer.ts` και `backfill-engine.ts` καλούν πλέον `extractSearchableText` ·
`extractStatus` · `generateSearchDocId` του core αντί για inline αντίγραφα. ⚠️ Μία ορατή διαφορά: ο indexer έγραφε
`status ?? 'active'` ⇒ κενό string έμενε `''`· τώρα `|| 'active'`, όπως ήδη ο writer της παραγωγής και το backfill.

**Προβολές constants**: `COLLECTIONS` (**24** κλειδιά υπολογισμένα — το `FLOORPLAN_OVERLAYS` που δεν διάβαζε κανείς
**έφυγε**, το `PURCHASE_ORDERS` **μπήκε**) · `ENTERPRISE_ID_PREFIXES` (**2**: `ENTITY_AUDIT`, `CLOUD_FUNCTION_AUDIT`).

**Διαγράφηκαν**: `functions/src/search/search-config.mirror.ts` · `functions/src/shared/decode-processed-json.ts` ·
`scripts/check-search-config-sync.js` + `npm run search-config:sync` · τα 24 χειρόγραφα ονόματα στο
`functions/src/config/firestore-collections.ts` (τώρα επανεξαγωγή της προβολής).

## 4. Ευρήματα

- **Ε-874.1 — το ευρετήριο και το ερώτημα μιλούσαν δύο γλώσσες (ΔΙΟΡΘΩΘΗΚΕ στον κώδικα, εκκρεμεί deploy + backfill).**
  Ο builder του functions (ο writer της παραγωγής) κανονικοποιούσε με δικό του χάρτη τόνων: **χωρίς** `ς → σ`,
  **χωρίς** αφαίρεση λατινικών τόνων (NFD), **χωρίς** σπάσιμο σε `-._/`, **χωρίς** αφαίρεση σημείων στίξης. Το
  `/api/search` κανονικοποιεί το ερώτημα με το `src/lib/search/search.ts`. Μετρημένο στις άγκυρες: «001» **δεν**
  έβρισκε `PRJ-001` (Ι1), «νεος» **δεν** έβρισκε «Νέος» στο πρόθεμα 4 χαρακτήρων (Ι2). ⚠️ Τα **υπάρχοντα**
  `search_documents` κρατούν τα παλιά προθέματα μέχρι την επόμενη εγγραφή κάθε οντότητας — backfill = απόφαση
  Giorgio (ίδια με ADR-873 §5).
- **Ε-874.2 — πρόθεμα ID εκτός μητρώου (ΔΙΟΡΘΩΘΗΚΕ).** Το `cfaud` (γραμμές `audit_log` από Cloud Functions) δηλωνόταν
  **μόνο** στο `functions/` — αόρατο σε κάθε έλεγχο σύγκρουσης προθεμάτων της εφαρμογής (N.6). Προστέθηκε ως
  `CLOUD_FUNCTION_AUDIT: 'cfaud'` στο `ENTERPRISE_ID_PREFIXES` και φτάνει στο functions με προβολή. Ίδια τιμή ⇒ μηδέν
  αλλαγή στα IDs.
- **Ε-874.3 — δύο διαδρομές trigger γραμμένες ως literal (ΔΙΟΡΘΩΘΗΚΕ).** `'contacts/{docId}'` και
  `'purchase_orders/{poId}'` → `${COLLECTIONS.CONTACTS}` / `${COLLECTIONS.PURCHASE_ORDERS}`. Ίδια τιμή ⇒ ίδιος trigger.
- **Ε-874.4 — τρεις builders του `search_documents` (ΕΚΚΡΕΜΕΙ → `.claude-rules/pending-ratchet-work.md`).**
  `functions/src/search/indexBuilder.ts` · `src/lib/search/search-indexer.ts` · `src/app/api/admin/search-backfill/backfill-engine.ts`.
  Μοιράζονται πλέον τους κανόνες και τον normalizer, αλλά **συνθέτουν** το έγγραφο ο καθένας: το backfill λύνει μόνο
  το `{id}` στο href (η FLOOR χάνει το `buildingId`), γράφει `metadata` που οι άλλοι δεν γράφουν, και λύνει tenant με
  άλλον τρόπο· ο indexer παραλείπει κενό κείμενο, οι άλλοι όχι. Χρειάζεται **ένα** `buildSearchDocumentCore` στο
  φορητό core — με αποφάσεις συμπεριφοράς (metadata, κενό κείμενο), άρα όχι σιωπηλά εδώ.

## 5. Επαλήθευση

- `node scripts/check-functions-projection.js` → ✅ 6 παραγόμενα αρχεία φρέσκα.
- `npm run test:functions-projection` → πύλη Φ1–Φ7 · Κ1–Κ5 · Κλ1–Κλ6 · Δ1–Δ3, ισοτιμία Ι1–Ι6 (εκτελούν τον
  **πραγματικό** builder).
- Jest `functions/src` + `src/config/__tests__/search-index-config.test.ts` + `src/lib/dxf` + search-backfill → πράσινα.
- **Όχι** `tsc` (N.17). Το functions build το χτίζει το `predeploy` του `firebase.json`.

## 6. Google-level

✅ **Google-level: YES** — το αντίγραφο είναι **μη εκφράσιμο** να αποκλίνει (παράγεται αυτούσιο, η πύλη
ξαναπαράγει και συγκρίνει)· τα κλειδιά **υπολογίζονται**· κάθε ασάφεια ⇒ **άρνηση**, ποτέ μαντεψιά· και ο δρόμος
παράκαμψης (import έξω από το `functions/src`) είναι κι αυτός ⛔. Ανοιχτό υπόλοιπο **δηλωμένο**: Ε-874.4 (pending) και
backfill μετά το deploy (απόφαση Giorgio).

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-22 | Δημιουργία. Μηχανή προβολής + CHECK 3.93· φορητά core search/types/dxf· 5 χειρόγραφα αντίγραφα → 6 παραγόμενα αρχεία· Ε-874.1–Ε-874.3 διορθώθηκαν, Ε-874.4 → pending. |
