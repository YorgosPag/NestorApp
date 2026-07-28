# ADR-719 — SSoT των ambient declarations πάνω από το όριο των δύο tsconfig

**Κατάσταση**: IMPLEMENTED (2026-07-28)
**Σχετικά**: ADR-650 v29 (η πρώτη γέφυρα, για το `cdt2d`), ADR-663 (CHECK 3.29 — dxf tsc ratchet στο CI),
ADR-294/N.12 (SSoT registry), ADR-584/N.18 (anti-duplication), ADR-587 (ένα anchor χωρίς gate είναι σχόλιο)

---

## 1. Το πρόβλημα

Το έργο έχει **τρία TypeScript programs που επικαλύπτονται**:

| Program | `include` | Τι μπαίνει επιπλέον |
|---|---|---|
| **root** `tsconfig.json` | `src/app/**`, `src/middleware.ts`, `src/**/*.d.ts` — με `exclude: src/subapps/dxf-viewer/**` | τα αρχεία **παραγωγής** του subapp, μέσω import-chain από το `src/app/**` |
| **subapp** `src/subapps/dxf-viewer/tsconfig.json` | `**/*.ts(x)` σχετικά με τον φάκελο του subapp (μαζί με τα tests) | αρχεία του `src/lib`/`src/services`, μέσω import-chain |
| **canvas-v2** `src/subapps/dxf-viewer/canvas-v2/tsconfig.json` | `**/*.ts(x)` σχετικά με το `canvas-v2/` + **ρητή απαρίθμηση** τριών `.d.ts` | ό,τι τραβά το import-chain του canvas-v2 |

Το τρίτο βρέθηκε **κατά λάθος**, καθαρίζοντας: δεν το καλεί κανένα npm script ούτε CI (είναι
IDE-scoped), αλλά η γραμμή `"../../../types/utif.d.ts"` στο `include` του ήταν **αντίγραφο της
διαδρομής** ενός αρχείου που δεν όριζε το ίδιο — δηλαδή θα έσπαγε σιωπηλά μόλις η δήλωση
μετακινηθεί. Είχε ήδη κενό: τα `three/examples/jsm/lines/*` που χρησιμοποιεί το
`canvas-v2/webgl-lines/` δεν ήταν ποτέ στο `include` του. Πλέον απαριθμεί **τις δύο γέφυρες**
αντί για μεμονωμένα αρχεία, οπότε ενημερώνεται μόνο του.

Το `exclude` **φιλτράρει** τα αποτελέσματα του `include`. Άρα κάθε program βλέπει τα *αρχεία* του
άλλου (τα τραβούν τα imports) αλλά **όχι τις ambient δηλώσεις του** — γιατί μια `declare module`
δεν εισάγεται από κανέναν· δεν υπάρχει import να την τραβήξει.

Αποτέλεσμα: κάθε πακέτο χωρίς επίσημους τύπους χρειάζεται ρητή ορατότητα **και στα δύο** programs.
Επειδή δεν υπήρχε κανόνας, αυτό λύθηκε **δύο διαφορετικούς λάθος τρόπους**.

### 1.1 Ο πρώτος λάθος τρόπος: αντιγραφή (4 πακέτα)

| Πακέτο | Αντίγραφο Α | Αντίγραφο Β | Απόκλιση |
|---|---|---|---|
| `opentype.js` | `src/types/opentype.d.ts` | `text-engine/fonts/opentype.d.ts` | μορφοποίηση + 1 σχόλιο |
| `utif` | `src/types/utif.d.ts` | μέσα στο `types/test-modules.d.ts` | καμία |
| `@jest/globals` | `src/types/jest-globals.d.ts` | μέσα στο `types/test-modules.d.ts` | άλλοι τύποι· το Β πρόσθετε αχρησιμοποίητο `vi` |
| `@google-cloud/storage` | `src/types/google-cloud-storage.d.ts` | μέσα στο `types/test-modules.d.ts` | **σοβαρή** — βλ. παρακάτω |

Η απόκλιση του `@google-cloud/storage` είναι το διδακτικό εύρημα. Το root δήλωνε
`Bucket.file() → File` μαζί με `File`, `FileMetadata`, `DeleteFilesOptions`, `Storage`. Το subapp
δήλωνε **stub**: `Bucket.file() → unknown`, `[key: string]: unknown`, τίποτε άλλο. Το subapp program
μεταγλώττιζε τα ίδια 9 αρχεία παραγωγής (`src/lib`, `src/services`, `src/app/api`) απέναντι σε
**ψεύτικο SDK**. Κανείς δεν το είδε, γιατί τα δύο αντίγραφα δεν συναντήθηκαν ποτέ στο ίδιο program.

> ⚠️ Η καταγεγραμμένη εκκρεμότητα πρότεινε «σβήσε το `src/types/` αντίγραφο, βάλε reference προς το
> subapp». Για το `@google-cloud/storage` αυτό θα **υποβάθμιζε την παραγωγή** στο stub. Η κατεύθυνση
> της γέφυρας δεν είναι σταθερή· εξαρτάται από το πού ζουν οι καταναλωτές.

### 1.2 Ο δεύτερος λάθος τρόπος: παράλειψη (5 πακέτα)

| Πακέτο | Δηλωμένο σε | Αόρατο στο | Καταναλωτές που έμεναν άτυποι |
|---|---|---|---|
| `three/examples/jsm/lines/*` | subapp bundle | **root** | 7 αρχεία παραγωγής (`bim-3d/**`, `canvas-v2/webgl-lines/**`) |
| `nspell` | subapp | **root** | `text-engine/spell/{dictionary-loader,spell.worker}.ts` |
| `three-gpu-pathtracer` | subapp | **root** | `bim-3d/render/PathTracerRenderer.ts` |
| `pako` | root | **subapp** | `services/dxf-firestore-storage.impl.ts` |
| `vitest` | subapp bundle | **root** | `src/lib/audit/__tests__/audit-diff.test.ts` |

Δηλαδή το πραγματικό πρόβλημα δεν ήταν «4 αντίγραφα». Ήταν ότι **δεν υπήρχε κανόνας ιδιοκτησίας**,
οπότε 9 πακέτα αντιμετωπίστηκαν ad-hoc: 4 με αντιγραφή, 5 με παράλειψη.

### 1.3 Γιατί το bundle **επέβαλλε** την αντιγραφή

Το `src/subapps/dxf-viewer/types/test-modules.d.ts` περιείχε 8 `declare module` από 4 άσχετους
vendors (Jest, Vitest, three, utif, Google Cloud). Ένα triple-slash reference προσθέτει **ολόκληρο
αρχείο** στο program — δεν γίνεται reference σε *μέρος* αρχείου. Άρα όποιος ήθελε μόνο το `utif`
από εκείνο το αρχείο **δεν είχε άλλη επιλογή** από το να αντιγράψει.

**Μία δήλωση ανά αρχείο (ή μία οικογένεια ενός vendor) είναι δομική απαίτηση, όχι αισθητική.**

## 2. Τι υπήρχε ήδη (και δεν ξαναγράφτηκε)

Ο μηχανισμός είχε ήδη βρεθεί στο **ADR-650 v29** για το `cdt2d`: το αρχείο
`src/types/dxf-viewer-ambient.d.ts` με μία γραμμή
`/// <reference path="../subapps/dxf-viewer/systems/topography/cdt2d.d.ts" />`.

Το reference directive προσθέτει το αρχείο στο program **ρητά**, παρακάμπτοντας το `exclude`, χωρίς
να αντιγράψει τύπο και χωρίς να αγγίξει το `tsconfig.json`. Το ADR-719 δεν εφευρίσκει μηχανισμό —
**γενικεύει τον υπάρχοντα σε κανόνα** και τον κάνει αμφίδρομο.

## 3. Η απόφαση

### 3.1 Κανόνας ιδιοκτησίας

> Κάθε πακέτο έχει **ακριβώς μία** δήλωση, σε **ακριβώς ένα** αρχείο. Ιδιοκτήτης είναι το
> πλησιέστερο κοινό σημείο των **καταναλωτών** του.

- καταναλώνεται **μόνο από το subapp** → η δήλωση ζει στο subapp, όσο πιο κοντά στον καταναλωτή
  γίνεται· το root τη βλέπει από τη γέφυρα·
- καταναλώνεται **από το root** ή **και από τα δύο** → η δήλωση ζει στο `src/types/`· το subapp τη
  βλέπει από τη δική του γέφυρα.

### 3.2 Δύο γέφυρες, κατοπτρικές

| Γέφυρα | Κατεύθυνση | Περιεχόμενο |
|---|---|---|
| `src/types/dxf-viewer-ambient.d.ts` | root → subapp | `cdt2d`, `opentype.js`, `nspell`, `utif`, `three/examples/jsm/lines/*`, `three-gpu-pathtracer` |
| `src/subapps/dxf-viewer/types/root-ambient.d.ts` | subapp → root | `@google-cloud/storage`, `pako`, `@jest/globals`, `vitest` |

Οι γέφυρες **δεν περιέχουν τύπους**. Είναι δείκτες ορατότητας. Τύπος μέσα σε γέφυρα είναι η αρχή
της επόμενης αντιγραφής.

### 3.3 Τελική τοποθεσία ανά πακέτο

| Πακέτο | Ιδιοκτήτης (SSoT) | Καταναλωτές |
|---|---|---|
| `cdt2d` | `systems/topography/cdt2d.d.ts` | subapp |
| `opentype.js` | `text-engine/fonts/opentype.d.ts` | subapp (8 αρχεία) |
| `nspell` | `text-engine/spell/nspell.d.ts` | subapp (2) |
| `utif` | `floorplan-background/providers/utif.d.ts` ⟵ **νέο** | subapp (1) |
| `three/examples/jsm/lines/*` | `types/three-examples-lines.d.ts` ⟵ **νέο** | subapp (7, δύο υποσυστήματα) |
| `three-gpu-pathtracer` | `types/three-gpu-pathtracer.d.ts` | subapp (1) |
| `@google-cloud/storage` | `src/types/google-cloud-storage.d.ts` | root (9) |
| `pako` | `src/types/pako.d.ts` | root (3) + subapp (1) |
| `@jest/globals` | `src/types/jest-globals.d.ts` | tests, παντού |
| `vitest` | `src/types/vitest.d.ts` ⟵ **νέο** | 2 tests |

Το `utif` και το `three/examples/jsm/lines/*` τοποθετήθηκαν διαφορετικά επίτηδες: το πρώτο έχει
**έναν** καταναλωτή, οπότε ζει δίπλα του· το δεύτερο έχει επτά σε δύο υποσυστήματα, οπότε ζει στον
κοινό τους πρόγονο (`types/`).

### 3.4 Το bundle καταργείται

`src/subapps/dxf-viewer/types/test-modules.d.ts` → **διαγράφηκε**. Τα περιεχόμενά του μοιράστηκαν σε
ιδιοκτήτες. Το `include` του subapp `tsconfig.json` δείχνει πλέον στο `types/root-ambient.d.ts`.

## 4. Ο φύλακας

`src/types/__tests__/ambient-declaration-ssot.test.ts` — 9 έλεγχοι, ~5 s, ένα πέρασμα του `src/`:

| # | Αναλλοίωτο |
|---|---|
| 1 | υπάρχουν και οι δύο γέφυρες |
| 2 | ο σαρωτής βρίσκει πραγματικές δηλώσεις (**αντι-«0 σημαίνει κανείς δεν κοίταξε»**) |
| 3 | κανένα πακέτο δεν δηλώνεται σε δύο αρχεία |
| 4 | κάθε `reference path` δείχνει σε υπαρκτό αρχείο |
| 5 | οι γέφυρες δεν περιέχουν `declare` |
| 6 | κάθε δήλωση του subapp είναι στη root γέφυρα |
| 7 | κάθε δήλωση του root **με καταναλωτή στο subapp** είναι στη subapp γέφυρα |
| 8 | κανένα `tsconfig` δεν απαριθμεί ανύπαρκτο `.d.ts` στο `include` |
| 9 | δεν επανεμφανίστηκε bundle πολλαπλών vendors |

Ο #2 υπάρχει επειδή ένας σαρωτής που δεν βρίσκει τίποτα περνά κάθε άλλον έλεγχο κενός — το ίδιο
σχήμα με τα ψευδώς πράσινα «0» των N.11 και N.12.

**Mutation-verified** (δύο ανεξάρτητα): τεχνητό διπλότυπο `declare module 'utif'` → ο #3 κοκκίνισε
κατονομάζοντας **και τα δύο** αρχεία· τεχνητό `tsconfig` με ανύπαρκτο `include` → ο #8 κοκκίνισε
κατονομάζοντας config και διαδρομή. Ένα gate που δεν αποδείχθηκε ότι κοκκινίζει δεν είναι gate.

## 5. Layer 2 — pre-commit

Νέο module `ambient-declaration-ssot` στο `.ssot-registry.json` (Tier 3): απαγορεύει
`declare module` για τα 9 κατοχυρωμένα πακέτα εκτός των αρχείων-ιδιοκτητών. Το jest test είναι ο
δομικός έλεγχος· το registry entry είναι το φρένο τη στιγμή του commit.

## 6. Τι **δεν** αλλάζει

- **Καμία δήλωση δεν ξαναγράφτηκε.** Όλοι οι τύποι μεταφέρθηκαν αυτούσιοι· η μόνη σημασιολογική
  αλλαγή είναι ότι το subapp βλέπει πλέον τον **πλήρη** `@google-cloud/storage` αντί για το stub,
  δηλαδή τον ίδιο τύπο που ήδη έβλεπε το root.
- Το `types/dxf-modules.d.ts` μένει ως έχει: περιέχει `declare module './...'` με **σχετικές**
  διαδρομές, που έχουν νόημα μόνο εντός του subapp program.

## 7. Ρητή εκκρεμότητα — η πέμπτη διπλοεγγραφή

`src/types/window.d.ts` και `src/subapps/dxf-viewer/types/dxf-window.d.ts` κάνουν **και τα δύο**
global augmentation του `interface Window`, με ~7 κοινές ιδιότητες σε **αποκλίνουσες υπογραφές**:

```ts
// dxf-window.d.ts            // window.d.ts
runLayeringWorkflowTest?:     runLayeringWorkflowTest?:
  (...args: any[]) => any       () => Promise<unknown>
__debugSnapResults?:          __debugSnapResults?:
  Array<{ point?: … }>          DebugSnapResult[]
```

Αυτό **δεν** λύνεται με reference: αν τα δύο αρχεία βρεθούν στο ίδιο program, το interface merging
σκάει TS2717 («subsequent property declarations must have the same type»). Απαιτεί πραγματική
συγχώνευση με έλεγχο κάθε καταναλωτή — διαφορετικός μηχανισμός, διαφορετικό ρίσκο, ξεχωριστή
εργασία. Καταγράφεται στο `.claude-rules/pending-ratchet-work.md`.

Ο φύλακας του §4 **δεν** το πιάνει επίτηδες: ελέγχει `declare module`, όχι global augmentation.
Δηλωμένο όριο, όχι τυφλό σημείο.

## 8. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-28 | v1 — Αρχική έκδοση. 4 αντίγραφα εξαλείφθηκαν, 5 κενά ορατότητας έκλεισαν, bundle `test-modules.d.ts` καταργήθηκε, δύο γέφυρες, φύλακας 9 ελέγχων (2 mutation-verified), registry module. Βρέθηκε **τρίτο** program (`canvas-v2/tsconfig.json`) που απαριθμούσε διαδρομή αρχείου ξένης ιδιοκτησίας και είχε ήδη δικό του κενό· δείχνει πλέον στις γέφυρες. Η διπλοεγγραφή του `Window` καταγράφηκε ως ξεχωριστή εκκρεμότητα (§7). |
