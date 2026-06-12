# HANDOFF — ADR-401 Phase D (αντίστροφη φορά): «Τοίχος → auto-attach κορυφής στην κάτω παρειά δοκαριού/πλάκας από πάνω»

**Date:** 2026-06-12 · **Branch:** main · **Μοντέλο: Opus** · **Shared working tree** (άλλοι agents δουλεύουν ταυτόχρονα — ειδικά **icon-agent** στο `ui/ribbon/data/structural-tab.ts`+`.test.ts`· **git add ΜΟΝΟ δικά σου hunks, ΠΟΤΕ `git add -A`**)

> 🎯 **ΕΝΤΟΛΗ GIORGIO (διαρκής):** «όπως οι μεγάλοι, όπως η Revit. FULL ENTERPRISE + FULL SSoT.» Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ:** Ο Giorgio κάνει commit/push — **ΠΟΤΕ εσύ** (N.(-1)). N.8 (5+ files/2+ domains→ρώτα mode). N.14 (δήλωσε μοντέλο πριν κώδικα). N.17 (ΕΝΑ tsc τη φορά — έλεγξε process πρώτα). function ≤40γρ, file ≤500γρ, no `any`, i18n ICU single-brace `{var}`. N.0.1 ADR-driven (Phase 1 recognition ΠΡΩΤΑ — code=SoT).

---

## 0. ΣΤΟΧΟΣ (το παράπονο του Giorgio)

Στον κάναβο 3×3 (test floorplan), όταν δημιουργεί **δοκάρια ΠΡΩΤΑ → μετά τοίχους** (από κάναβο), οι τοίχοι **φτάνουν μέχρι την ΕΠΑΝΩ παρειά των δοκαριών** (διαπερνούν το δοκάρι). Το σωστό (Revit/σκυρόδεμα): η κορυφή του τοίχου να **σταματά στην ΚΑΤΩ παρειά** του δοκαριού που τρέχει από πάνω (το δοκάρι «κουρώνει» τον τοίχο).

Παρατήρηση Giorgio: με την **αντίστροφη σειρά** (τοίχοι→μετά δοκάρια) δούλεψε σωστά (τοίχοι κόλλησαν στην κάτω παρειά). → **Ασυμμετρία**: το auto-attach τρέχει μόνο όταν δημιουργείται ο **host**, ΟΧΙ όταν δημιουργείται ο **τοίχος** πάνω σε υπάρχον host.

**Z-γεωμετρία (DB-verified):** τοίχος height 3000 `storey-floor→storey-ceiling` → z[0,3000]· δοκάρι `topElevation 3000` depth 500 → z[2500,3000]. Πάνω παρειά τοίχου (3000)=πάνω παρειά δοκαριού (3000) → overlap. Θέλουμε κορυφή τοίχου=2500 (κάτω παρειά δοκαριού).

---

## 1. ⚠️ ΤΟ ΑΚΡΙΒΕΣ ΚΕΝΟ (Phase-1 recognition — ΗΔΗ έγινε, επιβεβαίωσέ το)

**Υπάρχει πλήρες SSoT σύστημα auto-attach (ADR-401 Phase D):**

- `hooks/useStructuralAutoAttach.ts` — listener στο `drawing:entity-created`. Όταν το νέο entity είναι **host** (beam/slab/roof), καλεί `findWallsToAutoAttachToHost(host, entities)` → `AttachWallsTopCommand(hostId, wallTargets, sm)`. Κάνει το ΙΔΙΟ για columns/stairs (Phase F.3/G.3) + base-attach (κάτω σε θεμέλιο/πεδιλοδοκό).
- `bim/walls/wall-structural-attach-coordinator.ts` — `findWallsToAutoAttachToHost(host, entities)`:
  - host=beam/slab/roof αλλιώς `[]` (early return).
  - για κάθε τοίχο με `topBinding==='storey-ceiling'`: (2) plan-overlap μέσω `buildHostUndersidePlans` (SSoT projector) + (3) Z-gate `hostInput.undersideZmm > wallBaseZmm + 1mm`.
  - returns wall ids.
- `core/commands/entity-commands/AttachWallsTopCommand.ts` — batch: θέτει `topBinding='attached'` + `attachTopToIds=[hostId]` στους τοίχους-στόχους. Το ύψος τους γίνεται live derivation από `resolveWallTopProfile` (lower-envelope κάτω παρειάς host) — ΔΕΝ persist-άρεται ύψος.
- `bim/types/wall-types.ts`: `topBinding: WallTopBinding` ('storey-ceiling'|'attached'|'unconnected'|'absolute')· `attachTopToIds?: readonly string[]` (FK→host· ≥1 όταν 'attached'· πολλαπλά=σκαλωτή κορυφή).

**ΤΟ ΚΕΝΟ:** όταν δημιουργείται **ΤΟΙΧΟΣ** (manual draw Ή «Τοίχοι από κάναβο» — και τα δύο εκπέμπουν `drawing:entity-created` tool='wall' μέσω `CreateWallsCommand`/`addWallToScene`), το `useStructuralAutoAttach` τον περνά ως `host` → `findWallsToAutoAttachToHost(wall, …)` → ο τοίχος δεν είναι beam/slab/roof → `[]` → **καμία attach**. Δεν υπάρχει **αντίστροφη** ανίχνευση «βρες τα δοκάρια/πλάκες ΠΑΝΩ από αυτόν τον νέο τοίχο».

---

## 2. ΣΥΣΤΑΣΗ ΥΛΟΠΟΙΗΣΗΣ (FULL SSoT, Revit parity — γενική, ΟΧΙ grid-only)

**Πάρε την enterprise απόφαση (Giorgio: «μην ρωτάς, κάνε το Revit-σωστό»):** φτιάξε την **αντίστροφη φορά** στο ΙΔΙΟ SSoT, ώστε **ΚΑΘΕ** δημιουργία τοίχου (manual + κάναβος) να κάνει auto-attach την κορυφή του στα hosts από πάνω. Έτσι το πρόβλημα λύνεται σε ΕΝΑ σημείο, για όλα τα paths — όχι grid-specific hack.

### 2A. NEW reverse detector στο `wall-structural-attach-coordinator.ts`
`findHostsToAttachWallTop(wall: Entity, entities): string[]` — mirror/inverse του `findWallsToAutoAttachToHost`:
- αν `!isWallEntity(wall)` ή `wall.params.topBinding !== 'storey-ceiling'` → `[]`.
- για κάθε beam/slab/roof στο `entities`: φτιάξε `HostFootprintInput` (`beamHostInput`/`slabHostInput`/`roofHostInput`), **ΙΔΙΟ** plan-overlap (`buildHostUndersidePlans(wallStart, wallEnd, [hostInput]).length>0`) + **ΙΔΙΟ** Z-gate (`hostInput.undersideZmm > resolveWallBaseZmm(wall.params,{floorElevationMm:0}) + AUTO_ATTACH_Z_GATE_MM`).
- returns host ids (μπορεί πολλά → σκαλωτή κορυφή).
- **REUSE** τα ίδια helpers (`buildHostUndersidePlans`, `resolveWallBaseZmm`, `*HostInput`, `AUTO_ATTACH_Z_GATE_MM`) — μηδέν duplication.
- (προαιρετικά mirror base) `findHostsToAttachWallBase` με `buildHostTopsidePlans` + inverted Z-gate (τοίχος πάνω σε θεμέλιο/πεδιλοδοκό από κάτω).

### 2B. Extend `useStructuralAutoAttach.ts`
Στον ίδιο listener, **όταν το νέο entity είναι τοίχος** (`isWallEntity(entity)`):
- `hostTopIds = findHostsToAttachWallTop(entity, entities)`.
- αν >0 → για κάθε hostId: `execute(new AttachWallsTopCommand(hostId, [{wallId: entity.id, kind}], sm))` (ή batch αν πολλά hosts — **ΕΛΕΓΞΕ** αν το `AttachWallsTopCommand` κάνει **append** ή **replace** στο `attachTopToIds`· για σκαλωτή κορυφή θες append/union των hostIds· ίσως χρειαστεί ΕΝΑ command με όλα τα hostIds μαζί → δες το API του command).
- emit `bim:walls-auto-attached`.
- ⚠️ **Guard διπλού-trigger:** το host-created path ΚΑΙ το wall-created path δεν πρέπει να συγκρούονται (idempotent — αν ο τοίχος ήδη 'attached' δεν ξανα-attach· το detector ήδη φιλτράρει `topBinding==='storey-ceiling'`).
- ⚠️ **Infinite-loop guard:** το `AttachWallsTopCommand` εκπέμπει `drawing:entity-created`; (μάλλον ΟΧΙ — είναι update, όχι create). Επιβεβαίωσε ότι δεν re-triggers.

### 2C. Σειρά/undo (grid)
«Τοίχοι από κάναβο» → `CreateWallsCommand` (1 undo) → deferred `drawing:entity-created` ανά τοίχο → auto-attach = ξεχωριστό `AttachWallsTopCommand` (1 undo). Αποδεκτό v1 (ίδιο pattern με το host-created auto-attach). Fold σε CompoundCommand = DEFER.

### 2D. Tests
- `wall-structural-attach-coordinator.test.ts`: +`findHostsToAttachWallTop` (beam πάνω→hit· beam δίπλα/χωρίς overlap→miss· Z-gate πλάκα-πάτωμα από κάτω→miss· τοίχος ήδη 'attached'→skip).
- hook/integration αν υπάρχει.

---

## 3. DB ANCHORS (project pagonis-87766, read-only MCP firestore — verify protocol)
- company `comp_9c7c1a50-…757` · project `proj_3a8e2b2c-…c57` · floorplan `file_32a7a4fb-a2df-4b82-a391-761241152478` · floor `flr_161aa890-…b9b9` · level/layer `lvl_b997c956-…bf97` · **sceneUnits `'m'`** (συντεταγμένες σε ΜΕΤΡΑ).
- Κάναβος 3×3: X `be38435f`(10.75)/`7baf5045`(15.89)/`b6d02652`(22.99)· Y `593441c0`(3.31)/`f79075c9`(9.36)/`6b277b97`(15.51).
- Τρέχουσα κατάσταση DB (όλα UNCOMMITTED): **`floorplan_columns`=9** (center-x/y bindings)· **`floorplan_beams`=12** (frame-into κολωνών, extend ±200mm)· **`floorplan_walls`=12** (frame-into κολωνών, extend ±200mm)· `floorplan_foundations`=24 (GEN-TIE, άσχετο).
- **Verification protocol (Giorgio το θέλει):** baseline (read-only query τοίχων → `params.topBinding`/`attachTopToIds`) → πάτα ξανά «Τοίχοι από κάναβο» (αφού ΔΙΑΓΡΑΨΕΙΣ τους 12 untrimmed/unattached πρώτα — create-only) → re-query: οι τοίχοι κάτω από δοκάρι έχουν `topBinding:'attached'` + `attachTopToIds:[beamId]` → 3Δ: κορυφή τοίχου στην κάτω παρειά δοκαριού.

---

## 4. ΚΑΤΑΣΤΑΣΗ REPO — 🔴 UNCOMMITTED (GEN-BEAM ΜΟΛΙΣ ΕΓΙΝΕ· ΜΗΝ τα revert)

**Η προηγούμενη συνεδρία ολοκλήρωσε το ADR-441 Slice GEN-BEAM «Δοκάρια από κάναβο»** (DONE + DB-verified 3×3, 34 jest, tsc καθαρό· UNCOMMITTED — ο Giorgio committαρει). Αρχεία (ΜΗΝ τα πειράξεις χωρίς λόγο):
- NEW `bim/hosting/beam-hosting-strategy.ts` (+registry στο `hosting-strategy.ts`)
- `bim/beams/beam-firestore-service.ts` + `hooks/data/useBeamPersistence.ts` (guideBindings round-trip)
- NEW `bim/beams/beam-from-grid.ts` + `bim/beams/beam-grid-commit.ts` + `core/commands/entity-commands/CreateBeamsCommand.ts`
- NEW `bim/columns/column-face-trim.ts` (**kind-agnostic SSoT frame-into**· `wall-column-trim.ts`→thin re-export shim)
- `ui/ribbon/hooks/bridge/beam-command-keys.ts` + `useRibbonBeamBridge.ts` + `ui/ribbon/data/structural-tab.ts`(+test, **shared icon-agent**)
- `systems/events/drawing-event-map.ts` + `hooks/useDxfViewerNotifications.ts` + i18n el/en (`beamGrid.*`+`beamsFromGrid`)
- tests: `beam-from-grid.test.ts`, `beam-grid-commit.test.ts`, `hosting-strategy.test.ts` (+beam)
- docs: `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`, `ADR-441` changelog, MEMORY `project_adr441_foundation_strip_grid.md`

**Το column-trim (frame-into) δουλεύει ΚΑΙ για τοίχους ΚΑΙ για δοκάρια** (DB extend ±200mm). Η ΝΕΑ δουλειά (αυτό το handoff) είναι **ορθογώνια**: κατακόρυφο wall-top attach, ΟΧΙ XY trim.

---

## 5. DOCS ΝΑ ΕΝΗΜΕΡΩΣΕΙΣ (N.15, ίδιο commit με κώδικα)
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (νέα γραμμή — μόνο τι εκκρεμεί)· **ADR-401** changelog+§ Phase D (αντίστροφη φορά)· MEMORY (νέο/υπάρχον topic ADR-401). **ΜΗΝ** `adr-index` (shared tree).

## 6. REF
- Πρότυπα: `hooks/useStructuralAutoAttach.ts` (trigger) · `bim/walls/wall-structural-attach-coordinator.ts` (`findWallsToAutoAttachToHost` — mirror-it) · `core/commands/entity-commands/AttachWallsTopCommand.ts` (έλεγξε append/replace attachTopToIds) · `bim/geometry/wall-host-plan-builder.ts` (`buildHostUndersidePlans`/`*HostInput`) · `bim/geometry/wall-top-profile.ts` (`resolveWallBaseZmm`/`resolveWallTopProfile`) · `bim/types/wall-types.ts` (`topBinding`/`attachTopToIds`).
- ADR: `ADR-401-bim-wall-top-base-constraints-attach-to-structural.md` (§6 Phase D auto-attach).
- ADR-441 (η προηγ. δουλειά GEN-BEAM/WALL/COL): `bim/beams/beam-grid-commit.ts`, `bim/columns/column-face-trim.ts`.
