# HANDOFF — 2026-06-16 — ADR-420 auto-save `files` doc corruption (FIXED+VERIFIED) + perf FPS-1 + displayName

> **Γλώσσα:** απάντα στον Giorgio **στα Ελληνικά** (CLAUDE.md LANGUAGE RULE).
> **Commit:** ΜΟΝΟ ο Giorgio κάνει commit/push (N.(-1)). Εσύ ΔΕΝ committάρεις.
> **⚠️ SHARED WORKING TREE:** το working tree μοιράζεται με ΑΛΛΟΝ agent. `git add` **ΜΟΝΟ τα δικά μου αρχεία** (λίστα §A) — ΠΟΤΕ `git add -A`.

---

## 0) ΠΛΑΙΣΙΟ ΣΥΝΕΔΡΙΑΣ
Session ελέγχων στο DXF Viewer (`http://localhost:3000/dxf/viewer`). Δοκιμές πλήρους κύκλου
upload→process→reload→edit→delete→undo με baseline από **Firestore MCP + Storage** σε κάθε βήμα.
Project: **ΕΡΓΟ Α** (`proj_12788b6a-ea19-41cd-90a0-a340e6bacaab`), company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757`.
Test file: **`file_2bf08dc9-ddc6-410f-ad10-2f291ed4b354`** (DXF «Ισόγειο 1.dxf» linked στον όροφο
**F/Θεμελίωση** `flr_c25e29a6-5ecf-4bd4-929d-bb6ebd0feb1a` — σκόπιμο mismatch, δοκιμή).

Storage path (test file):
`companies/comp_9c7c1a50-.../projects/proj_12788b6a-.../entities/floor/flr_c25e29a6-.../domains/construction/categories/floorplans/files/file_2bf08dc9-....{dxf|scene.json|processed.json|thumbnail.png}`

---

## 1) ✅ FIX #1 — ADR-420 auto-save διαφθείρει το `files` doc (DONE + VERIFIED, UNCOMMITTED)

### Πρόβλημα (βρέθηκε με DB baseline μετά από DXF entity-delete auto-save)
Το server-side `writeToFilesCollection` (`dual-write-to-files.ts`) έγραφε με `merge:true` σε **κάθε** auto-save 3 πεδία που δεν έπρεπε:
1. **`createdAt: serverTimestamp()`** unconditional → πατούσε το creation time σε κάθε save (immutability violation· `createdAt===updatedAt` μετά από edit).
2. **`displayName`** regenerated κάθε save → το auto-save context (category default `drawings`, `entityLabel=fileName`) έγραφε «drawings - Ισόγειο 1» πάνω στο wizard «Κατόψεις Ορόφου - F».
3. **`sceneStats.layerCount`/`parseTimeMs` hardcoded `0`** → μηδένιζε τα πραγματικά.

### Λύση (ίδιο write-once pattern με το προϋπάρχον ADR-420)
- `createdAt` & `displayName` γράφονται **ΜΟΝΟ** όταν `isCreate=true` (merge διατηρεί σε update).
- Πραγματικό `layerCount` threaded από το scene μέσα από το payload chain.
- `parseTimeMs` παραλείπεται σε auto-save → merge διατηρεί την υπάρχουσα τιμή.

### Επαλήθευση στο πραγματικό DB (πλήρης κύκλος)
| Βήμα | entityCount | createdAt | layerCount | Verdict |
|---|---|---|---|---|
| move 2 endpoints | 299 | **18:13:06 αμετάβλητο** | **7** (ήταν 0) | ✅ |
| delete-many | 13 | **18:13:06** | 7 | ✅ |
| undo | **299** (επανήλθαν) | **18:13:06** | 7 | ✅ |
- revision increments 1→6, scene.json synced, κανένα timeout σε μετρημένες αλλαγές.
- 16 jest GREEN (`dual-write-to-files.test.ts` 8 + `scene-entity-count.test.ts` 8), full `tsc --noEmit` exit 0.

### SSoT (αποφυγή διπλότυπου — αίτημα Giorgio)
Δημιουργήθηκε `countSceneLayers(scene)` δίπλα στο υπάρχον `countSceneEntities` σε
`src/subapps/dxf-viewer/utils/scene-entity-count.ts`. Αντικατέστησε το scattered inline
`Object.keys(scene.layersById ?? {}).length` σε: `dxf-firestore-storage.impl.ts` (×2, incl. generateSceneChecksum),
`io/dxf-import.ts`, `workers/dxf-parser.worker.ts`. Αφέθηκε **σκόπιμα** inline στο
`security/DxfSecurityValidator.ts` (threshold guard `if > MAX` = διαφορετικό intent, per SSoT SCOPE note).

---

## A) ΑΡΧΕΙΑ FIX #1 (UNCOMMITTED — git add ΜΟΝΟ ΑΥΤΑ· shared tree)
```
src/app/api/cad-files/dual-write-to-files.ts            (createdAt+displayName write-once, real layerCount)
src/app/api/cad-files/cad-files.handlers.ts             (pass layerCount)
src/app/api/cad-files/cad-files.schemas.ts              (zod layerCount optional)
src/app/api/cad-files/__tests__/dual-write-to-files.test.ts  (+4 jest → 8)
src/services/cad-file-mutation-gateway.ts               (UpsertCadFilePayload.layerCount)
src/subapps/dxf-viewer/services/dxf-firestore-storage.impl.ts (countSceneLayers ×2)
src/subapps/dxf-viewer/utils/scene-entity-count.ts      (NEW countSceneLayers SSoT)
src/subapps/dxf-viewer/utils/__tests__/scene-entity-count.test.ts (+4 jest → 8)
src/subapps/dxf-viewer/io/dxf-import.ts                 (boy-scout → SSoT)
src/subapps/dxf-viewer/workers/dxf-parser.worker.ts     (boy-scout → SSoT)
docs/centralized-systems/reference/adrs/ADR-420-bim-floor-scope-ssot.md (changelog 2026-06-16)
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt                                  (νέο 🔴 item)
```
**ΕΝΕΡΓΕΙΑ:** Ο Giorgio κάνει commit (μήνυμα π.χ. `fix(dxf): ADR-420 auto-save files-doc write-once createdAt/displayName + real layerCount SSoT`).

---

## 2) 🔴 FIX #2 — Perf: FPS 1 + `chainSegments` σε μαζική διαγραφή (ΠΡΟΣ ΥΛΟΠΟΙΗΣΗ)
### Συμπτώματα (console κατά μαζική διαγραφή ~300 οντοτήτων)
```
[DxfPerformanceOptimizer] FPS below threshold: 1 < 45
[SegmentChaining] ❌ 375 segments remain unconnected. Trying force-connect...
[SegmentChaining] Force-connect failed. Min gap: 25.00 CAD units, max tolerance: 100
POST /api/cad-files - 408 (61345ms) Request timeout after 60000ms   ← starved event loop
```
### Διάγνωση (αρχική, προς επιβεβαίωση)
Το main thread κορεσμένο (FPS 1) → ο client-side 60s fetch-timer χτυπά πριν επεξεργαστεί την απάντηση
(ο server μάλλον απαντά κανονικά). Υποψήφια αιτία: **βαρύ σύγχρονο `chainSegments`** (`utils/geometry/SegmentChaining.ts`,
μέσω `services/EntityMergeService.ts` → `hooks/useEntityJoin.ts`) που τρέχει σε 375 segments + full-scene re-render.
### Tasks
1. Βρες ΠΟΥ/ΠΟΤΕ καλείται το `chainSegments` στη διαγραφή (είναι σε join command — γιατί τρέχει σε mass-delete;).
2. Μέτρα αν είναι per-frame ή one-shot. Αν μπλοκάρει το thread → off-main-thread / debounce / skip όταν δεν χρειάζεται.
3. Έλεγξε αν το full-scene rebuild (bitmap cache, ADR-040) είναι ο πραγματικός FPS-1 ένοχος αντί για το chaining.
4. Στόχος: μαζική διαγραφή χωρίς FPS<10 και χωρίς save-timeout.
**Workaround τώρα:** hard refresh μετά από timeout (το Storage κρατά το τελευταίο επιτυχές scene· τίποτα δεν χάνεται).

---

## 3) 🟡 FIX #3 — `displayName` του test doc έμεινε buggy (ΠΡΟΑΙΡΕΤΙΚΟ, εφάπαξ data-correction)
Το `file_2bf08dc9-...` έχει `displayName: "drawings - Ισόγειο 1"` (γράφτηκε από buggy save πριν το fix).
Το fix #1 σταματά μελλοντική καταστροφή αλλά ΔΕΝ θεραπεύει ήδη-χαμένη τιμή. Επίσης `parseTimeMs` έμεινε `0`
(ομοίως — ήδη μηδενισμένο πριν το fix· δεν είναι αποτυχία fix).
**Ενέργεια (αν θες):** εφάπαξ Firestore update του doc → `displayName: "Κατόψεις Ορόφου - F"`
(+ προαιρετικά `processedData.sceneStats.parseTimeMs` αν θες). Cosmetic, test-data μόνο. Μην το κάνεις code-change.

---

## ΚΑΝΟΝΕΣ ΠΟΥ ΙΣΧΥΟΥΝ
- Ελληνικά στις απαντήσεις. Commit/push ΜΟΝΟ ο Giorgio. **Shared tree → git add ΜΟΝΟ δικά μου.**
- N.15: μετά από κάθε υλοποίηση → ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR + memory.
- N.17: ΕΝΑ tsc τη φορά (έλεγξε με Get-CimInstance πριν).
- Firestore MCP για baseline/verify (δούλεψε άψογα όλη τη session).
- Μην επανυλοποιήσεις το fix #1 — είναι έτοιμο+verified, περιμένει ΜΟΝΟ commit.
