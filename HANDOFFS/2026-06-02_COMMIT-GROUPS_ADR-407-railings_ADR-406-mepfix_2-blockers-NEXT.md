# HANDOFF — Commit σε ομάδες: ADR-407 railings + ADR-406 MEP fixture (2 hook blockers)

**Ημ/νία:** 2026-06-02
**Session model:** Opus 4.8
**Εντολή Giorgio:** «COMMIT TUTTO ΑΛΛΑ ΣΕ ΚΑΤΑΛΛΗΛΕΣ ΟΜΑΔΕΣ»
**⚠️ ΤΟ COMMIT ΤΟ ΚΑΝΕΙ Ο GIORGIO — ΟΧΙ Ο AGENT.**
**⚠️ ΤΟ WORKING TREE ΕΙΝΑΙ ΚΟΙΝΟ ΜΕ ΑΛΛΟΝ AGENT** → ΠΟΤΕ `git add -A` / `git add -u` / blanket staging. ΜΟΝΟ ρητά αρχεία ανά ομάδα. ΠΟΤΕ `git checkout/restore` σε αρχεία· επιτρέπεται μόνο `git reset HEAD` (unstage).

---

## ΚΑΤΑΣΤΑΣΗ ΤΩΡΑ

`HEAD = 4ded6cd3`. Έγιναν **2 τοπικά commits** (NOT pushed) πριν ο Giorgio πει «εγώ θα κάνω commit». Είναι σωστά & ανεξάρτητα — κράτησέ τα ή κάν' τα reset, ο Giorgio αποφασίζει:

| Commit | Μήνυμα | Αρχεία |
|--------|--------|--------|
| `48777ac5` | `fix(tooling): i18n missing-keys check understands i18next plurals` | `scripts/check-i18n-missing-keys.js` |
| `4ded6cd3` | `fix(bim): ADR-363 column-perimeter dialog ESC cancel + plural noun phrases` | `ColumnPerimeterConfirmDialog.tsx`, `useRibbonColumnBridge.test.tsx` |

**Το index είναι ΞΕΣΤΑΡΙΣΜΕΝΟ** (`git reset HEAD .` έγινε). Τα 110 υπόλοιπα αρχεία (working tree) είναι ανέπαφα, μη-staged.

---

## ΤΙ ΜΕΝΕΙ: ΟΜΑΔΑ 3 (μπλοκαρισμένη)

**`feat(bim): ADR-407 railings vertical slice + ADR-406 MEP fixture 2D integration & ghost`** — ~110 αρχεία.

**Γιατί ADR-406 + ADR-407 ΜΑΖΙ (όχι ξεχωριστά):** ~14 κοινά entity-registry/dispatcher αρχεία περιέχουν αλλαγές **και των δύο** features (κάθε feature προσθέτει το δικό του `case`/branch):
`CanvasSection.tsx`, `types/entities.ts`, `types/base-entity.ts`, `EventBus.ts`, `bim/utils/bim-bounds.ts`, `services/HitTestingService.ts`, `config/bim-object-styles.ts`, `config/bim-subcategories.ts`, `bim/types/ifc-entity-mixin.ts`, `bim/types/bim-base.ts`, `DeleteEntityCommand.ts`, `useBimEntityRestoredPersistEffect.ts`, `useFloors3DAggregator.ts`, `enterprise-id.service.ts`.
Καθαρό split θα απαιτούσε hunk-surgery σε 14 αρχεία σε **κοινό tree** → πολύ ρίσκο. Συστήνεται ΕΝΑ commit.

### Περιεχόμενο ομάδας 3
- **ADR-407 (νέο feature):** `RailingEntity` type/schemas, `bim/railings/` (geometry/symbol/firestore-service/audit-client/add-to-scene), `useRailingTool` + `railing-completion`, `RailingRenderer` (ADR-040 leaf), `railing-to-three` (InstancedMesh), `RailingPersistenceHost` + `useRailingPersistence`, `UpdateRailingParamsCommand`, `railing-tool-bridge-store`, `railing.factory`, ΑΤΟΕ/BOQ feed, discipline visibility, `ral_*` prefix, `FLOORPLAN_RAILINGS` collection, home-tab κουμπί (RL) + i18n el/en, wiring στα κοινά dispatchers.
- **ADR-406 follow-up (συμπλήρωση 2D + bugfix):** DXF render pipeline case (`DxfMepFixture`) ώστε τα fixtures να φαίνονται σε 2D· hit-test/marquee/zoom bbox· delete cascade + restore· server-side audit `entityType`· rename/backup no-op· 2D placement ghost (`MepFixtureGhostRenderer` + `useMepFixtureGhostPreview` + micro-leaf)· ref-counted `placement-cursor` SSoT (κοινό με column placement)· work-plane fix (ceiling luminaire raycast σε floor+mounting → ghost==cursor WYSIWYG).

---

## 🚫 2 HOOK BLOCKERS — ΠΡΕΠΕΙ ΝΑ ΛΥΘΟΥΝ ΠΡΙΝ ΤΟ COMMIT 3

### Blocker 1 — CHECK 4 (File size >500 γραμμές)
3 code αρχεία πέρασαν το όριο 500 λόγω αυτής της δουλειάς (extract helper, N.7.1):
| Αρχείο | Γραμμές | Αιτία |
|--------|---------|-------|
| `src/subapps/dxf-viewer/hooks/tools/useSpecialTools.ts` | **514** | προστέθηκε `railingTool` wiring |
| `src/subapps/dxf-viewer/hooks/canvas/useDxfSceneConversion.ts` | **509** | προστέθηκε `case 'mep-fixture'` |
| `src/subapps/dxf-viewer/systems/events/EventBus.ts` | **504** | προστέθηκαν railing events |

**Fix:** extract helper/module από κάθε ένα ώστε <500. (π.χ. `useSpecialTools` → βγάλε το railing-tool setup σε `useSpecialTools-railing.ts` mirror του `useSpecialTools-slab-opening.ts` που ήδη υπάρχει· `useDxfSceneConversion` → βγάλε converters σε helper· `EventBus` → αν είναι κυρίως event-map types ίσως εξαιρείται, αλλιώς split το map.)

### Blocker 2 — CHECK 3.15 (Firestore Index Coverage)
`src/subapps/dxf-viewer/bim/railings/railing-firestore-service.ts:111` (`subscribe('FLOORPLAN_RAILINGS', …)`) → **3 missing composite indexes** για `floorplan_railings`. Πρόσθεσέ τα στο `firestore.indexes.json` (mirror των `floorplan_mep_fixtures` entries).

Τρέξε για ΑΚΡΙΒΗ entries:
```
node scripts/check-firestore-index-coverage.js --all --verbose
```
Variants που ζητάει: `default` (companyId+floorplanId+projectId), `super_admin` (projectId+floorplanId), + 1 ακόμη. Αντίγραψε τα έτοιμα JSON entries που εκτυπώνει ο checker.

⚠️ **Αν προστεθούν indexes** → πιθανόν χρειάζεται και Firestore rules test coverage (CHECK 3.16, ADR-298) αν αγγιχτεί το `firestore.rules` — αλλά εδώ μόνο `firestore.indexes.json` αγγίζεται, οπότε μάλλον όχι. Επιβεβαίωσε από hook output.

---

## ΡΟΗ ΓΙΑ ΝΕΑ ΣΥΝΕΔΡΙΑ
1. Fix Blocker 1 (3 file splits) + Blocker 2 (firestore indexes) — **ρητό staging μόνο των σχετικών αρχείων**.
2. Stage ρητά τα ~110 αρχεία της ομάδας 3 (ΟΧΙ blanket — κοινό tree!).
3. Ο **Giorgio** κάνει το commit (όχι ο agent).
4. **N.15:** ενημέρωσε `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + ADR-407 + ADR-406 + `adr-index.md` + memory `MEMORY.md` στο ίδιο commit.
5. 🔴 browser verify (railing draw RL, 2D fixture visible, ghost WYSIWYG) εκκρεμεί ακόμη.

## ΣΗΜΕΙΩΣΕΙΣ
- Τα CRLF warnings (`LF will be replaced by CRLF`) είναι benign (Windows).
- Δύο fix έγιναν ήδη στην πορεία (όχι bypass, N.(-1.1)): i18n checker plural-aware (commit `48777ac5`) + dialog ESC→`useEscapeHandler` ADR-364 SSoT (commit `4ded6cd3`).
