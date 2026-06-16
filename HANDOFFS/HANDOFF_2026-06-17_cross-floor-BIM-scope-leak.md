# HANDOFF — 2026-06-17 — Cross-floor BIM **scope leak** (κολώνα/πέδιλο σε ΟΛΟΥΣ τους ορόφους)

> **Γλώσσα:** απάντα στον Giorgio **στα Ελληνικά**.
> **Commit:** ΜΟΝΟ ο Giorgio κάνει commit/push. Εσύ ΔΕΝ committάρεις.
> **⚠️ SHARED WORKING TREE** με ΑΛΛΟΝ agent → `git add` **ΜΟΝΟ τα δικά σου αρχεία**, ΠΟΤΕ `git add -A`.
> **Ποιότητα:** FULL ENTERPRISE + FULL SSOT, Revit-grade. **ΠΡΙΝ γράψεις κώδικα → Grep για υπάρχοντα** (N.0.2).

---

## 0) ΚΥΡΙΟΣ ΣΤΟΧΟΣ (νέο bug — ΑΥΤΟ είναι το ζητούμενο)

Διόρθωσε το **cross-floor BIM scope leak**: BIM entities (κολώνα, πέδιλο, κλπ) που τοποθετούνται σε
**έναν** όροφο εμφανίζονται σε **ΟΛΟΥΣ** τους ορόφους και είναι **η ίδια οντότητα** (delete/undo σε
έναν όροφο επηρεάζει όλους). Πρέπει κάθε όροφος να βλέπει ΜΟΝΟ τα δικά του BIM (Revit: κάθε storey =
δικός του χώρος).

### Repro (από Giorgio, 2026-06-17)
1. Τοποθέτησε **κολώνα + πέδιλο** στο **Ισόγειο**.
2. Πλοηγήσου Ισόγειο → 1ος → Ισόγειο → 1ος (επανειλημμένα). → Τα βλέπεις **ΚΑΙ στους 2 ορόφους** (λάθος).
3. Πήγαινε στον **1ο** και **διέγραψέ** τα → σβήνονται **ΚΑΙ από το Ισόγειο** (= ίδιο doc).
4. **Undo** → επανήλθε μόνο η κολώνα, και πάλι εμφανίζεται **και στους 2 ορόφους**.

---

## 1) ROOT CAUSE (βρέθηκε — smoking gun)

**`src/subapps/dxf-viewer/app/DxfViewerTopBar.tsx:85`**
```ts
const floorId = levelManager.saveContext?.floorId ?? currentLevel?.floorId ?? undefined;
```
Το `floorId` που δίνεται σε **ΟΛΑ** τα 26 BIM persistence hosts (props `floorId={floorId}`) παράγεται
**ΠΡΩΤΑ από το volatile `saveContext.floorId`** — που είναι το DXF save target του **τελευταίου
import/save** (π.χ. Ισόγειο) και **ΔΕΝ αλλάζει** όταν πλοηγείσαι σε άλλον όροφο. Άρα:

- Στον 1ο όροφο, το BIM scope = `saveContext.floorId` = **Ισόγειο** (stale).
- Το Firestore query (`buildBimScopeConstraints` → `where('floorId','==', …)`) επιστρέφει τα BIM του
  **Ισογείου** ενώ είσαι στον 1ο → **leak**.
- Τοποθέτηση κολώνας στον 1ο → γράφεται με `floorId` = Ισόγειο (stale) → ίδιο scope → φαίνεται παντού,
  delete/undo κοινά.

**Παραβιάζει την αρχή ADR-420:** BIM persistence scope = **durable identity** (`floorId` από το `Level`
doc, που ΑΚΟΛΟΥΘΕΙ την πλοήγηση), **ΠΟΤΕ** το volatile DXF save target. Το `projectId` δίπλα (γρ.93)
ήδη χρησιμοποιεί `currentLevel.projectId` ως fallback (ADR-420 incident 2026-06-16) — αλλά το `floorId`
ΕΜΕΙΝΕ `saveContext`-first. Αυτό είναι το εναπομείναν κενό του ίδιου incident.

### ΠΡΟΤΕΙΝΟΜΕΝΟ FIX (πάρε την απόφαση μόνος σου, Revit-grade — ζήτα μόνο έγκριση plan)
Αντέστρεψε την προτεραιότητα ώστε να **νικά το durable `currentLevel.floorId`** (που tracks την πλοήγηση):
```ts
const floorId = currentLevel?.floorId ?? levelManager.saveContext?.floorId ?? undefined;
```
- Στο import-σε-όροφο το `currentLevel.floorId` είναι ΗΔΗ σωστό (`findOrCreateLevelForFloor` κάνει
  link + switch), άρα δεν χαλάει η περίπτωση import (γι' αυτήν είχε προτιμηθεί `saveContext`).
- Level χωρίς linked floor (manual/project-level) → `currentLevel.floorId` undefined → fallback σε
  `saveContext` (legacy). OK.

**ΠΡΟΣΟΧΗ / verify πριν το κλείσεις:**
- ΓΡΑΨΕ test/verify ότι μετά το import σε όροφο το BIM σώζεται στον ΣΩΣΤΟ floorId (μην επιστρέψεις
  το vanish/no-save incident 2026-06-16).
- **Grep** για άλλα σημεία που παράγουν floorId για BIM με `saveContext?.floorId` first (μην μείνει
  διπλότυπο μονοπάτι). Ψάξε: `saveContext?.floorId`, `saveContext.floorId ??`.
- **Firestore MCP verify:** μετά το fix, η κολώνα/πέδιλο doc πρέπει να έχει **διακριτό `floorId` ανά
  όροφο**. Έλεγξε ΚΑΙ τα ΗΔΗ-γραμμένα (leaked) docs — μπορεί να έχουν λάθος/κοινό `floorId` και να
  χρειάζονται data heal (όχι αυτόματο — δείξε στον Giorgio τι βρήκες).
- Δες αν χρειάζεται και το `projectId` (γρ.93) να γίνει `currentLevel`-first για συνέπεια (low-risk,
  αλλά projectId δεν αλλάζει ανά όροφο οπότε δεν προκαλεί leak — προαιρετικό).

---

## 2) SSoT / anti-duplicate pointers (ΧΡΗΣΙΜΟΠΟΙΗΣΕ ΤΑ, ΜΗΝ ξαναγράψεις)

| Αρχείο | Ρόλος |
|---|---|
| `app/DxfViewerTopBar.tsx:84-85` | **Το σημείο του fix** — derive floorId/projectId για όλα τα BIM hosts |
| `bim/persistence/bim-floor-scope.ts` | SSoT scope: `resolveBimPersistenceScope` (gate), `buildBimScopeConstraints` (query `where(floorId)`), `bimScopeWriteFields` (write floorId+floorplanId), `resolveBimScope` (floorId preferred) |
| `systems/levels/` (`useLevels`) | `currentLevel.floorId` = durable navigation-tracking source· `linkLevelToFloor` |
| `hooks/data/use*Persistence.ts` (26) | καταναλώνουν το `floorId` prop· subscription+write scope |

---

## 3) ⚠️ ΗΔΗ ΟΛΟΚΛΗΡΩΜΕΝΑ ΣΗΜΕΡΑ — UNCOMMITTED (shared tree· χρειάζονται commit + browser-verify)

Όλα δικά μου, tsc clean, jest GREEN. `git add` ΜΟΝΟ αυτά (ΟΧΙ `drawing-event-map-bim.ts` /
`structural-*` / `useDxfViewerCallbacks.ts` = άλλου agent).

### (Α) ADR-420 floorId-subscription-deps fix — «BIM εξαφανίζονται σε επανειλημμένο toggle» (ΛΥΘΗΚΕ, επιβεβαιωμένο από Giorgio)
- 12 persistence hooks: **+`floorId` στο subscription dep array** (ήταν μόνο στο instantiation effect →
  η συνδρομή έμενε δεμένη σε stale/null service → empty snapshot → ADR-390 drop → fast-path πάγωνε
  BIM-less scene). Αρχεία: `useFoundation/Column/Beam/Wall/Slab/SlabOpening/Opening/Railing/Roof/SpaceSeparator/ThermalSpace/FloorFinishPersistence.ts`.
- Boy-scout: `useBeamPersistence.ts` πρόσθεσα missing `import { beamDocToEntity } from './beam-persistence-helpers'` (προϋπάρχον σπασμένο file-split — committed code δεν τύπιζε).
- Doc: `ADR-420-bim-floor-scope-ssot.md` changelog (2026-06-17).
- ⚠️ **ΣΧΕΣΗ ΜΕ ΤΟ ΝΕΟ BUG:** αυτό το fix έκανε τα BIM να ΕΠΙΒΙΩΝΟΥΝ στο toggle → ΑΠΟΚΑΛΥΨΕ το leak
  του §1 (πριν, το vanish το έκρυβε). Τα δύο είναι ξεχωριστά bugs, ίδιος τομέας (ADR-420 scope).

### (Β) ADR-465 Cross-floor floorplan duplicate (κουμπί «Αντιγραφή κάτοψης σε όροφο…»)
- NEW: `features/floorplan-import/utils/floorplan-duplicate-core.ts` (+`__tests__/` 7 jest),
  `features/floorplan-import/components/DuplicateFloorplanDialog.tsx`,
  `docs/.../adrs/ADR-465-cross-floor-floorplan-duplicate.md`.
- MOD: `features/floorplan-import/index.ts`, `ui/components/LevelPanel.tsx`,
  `ui/components/level-panel-hooks.ts` (extract `useFloorplanImportComplete`),
  `domain/cards/level/LevelListCard.tsx` (`onDuplicate`), `i18n el/en dxf-viewer-panels.json`, `adr-index.md`.
- 🔴 browser-verify: κάρτα ορόφου → «Αντιγραφή κάτοψης σε όροφο…» → dest → νέο files-doc + κάτοψη.

### (Γ) ADR-466 Cross-floor entity clipboard (Revit Ctrl+C / Ctrl+V, paste-in-place)
- NEW: `systems/clipboard/EntityClipboardStore.ts` (+test 6 jest),
  `core/commands/entity-commands/PasteEntitiesCommand.ts`, `hooks/tools/useEntityClipboard.ts`,
  `bim/transforms/__tests__/build-clones-from-entities.test.ts` (4 jest),
  `docs/.../adrs/ADR-466-cross-floor-entity-clipboard.md`.
- MOD: `bim/transforms/bim-copy-builder.ts` (extract `buildClonesFromEntities`),
  `hooks/tools/useModifyTools.ts`, `systems/events/drawing-event-map.ts`,
  `config/keyboard-shortcuts.ts`, `hooks/useDxfToolbarShortcuts.ts`, `hooks/useDxfViewerState.ts`,
  `i18n el/en dxf-viewer.json`, `adr-index.md`.
- 🔴 browser-verify: Ισόγειο επίλεξε DXF+BIM → Ctrl+C → 1ος → Ctrl+V → ίδιες συντεταγμένες· **C+O** = παλιό base-point bim-copy.
- ⚠️ Το paste-in-place γράφει στον **τρέχοντα** όροφο μέσω `LevelSceneManagerAdapter` + BIM clone
  broadcasts. **ΜΕΤΑ το fix του §1**, βεβαιώσου ότι το paste σώζει στον σωστό floorId (ίδιο scope path).

### Master trackers ενημερωμένα: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `adr-index.md`, memory (`reference_bim_persistence_scope_ssot` follow-up + ADR-465/466 entries).

---

## 4) ΣΕΙΡΑ ΕΡΓΑΣΙΑΣ ΓΙΑ ΤΗ ΝΕΑ ΣΥΝΕΔΡΙΑ
1. **Recognition** (grep): επιβεβαίωσε `DxfViewerTopBar.tsx:85` + ψάξε άλλα `saveContext?.floorId` BIM-scope σημεία.
2. **Plan** (ζήτα έγκριση): swap precedence → `currentLevel?.floorId ?? saveContext?.floorId`.
3. **Impl + test**: το fix + jest/verify ότι import-σε-όροφο σώζει σωστά (μην επιστρέψει vanish).
4. **Firestore MCP verify**: distinct `floorId` ανά όροφο· έλεγξε leaked docs.
5. **Browser verify**: κολώνα/πέδιλο στο Ισόγειο → 1ος όροφος ΚΑΘΑΡΟΣ· delete σε έναν όροφο δεν αγγίζει τον άλλο.
6. Update ADR-420 changelog + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory.

## 5) ΚΑΝΟΝΕΣ
- Ελληνικά. Commit/push ΜΟΝΟ ο Giorgio. Shared tree → `git add` ΜΟΝΟ δικά σου.
- N.0.2 anti-duplicate (grep-first)· N.2 no `any`· N.7.1 ≤500/≤40· N.11 no hardcoded strings· N.17 ΕΝΑ tsc τη φορά.
- Revit-grade decisions μόνος σου, έγκριση plan πριν impl.
