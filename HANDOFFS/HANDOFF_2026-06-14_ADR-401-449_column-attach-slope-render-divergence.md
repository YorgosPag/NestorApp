# HANDOFF — ADR-401/441 κεκλιμένη κορυφή κολόνας + render↔DB divergence + δοκάρι μετακινείται νότια

**Ημερομηνία:** 2026-06-14 (Opus) · συνέχεια του `HANDOFF_2026-06-14_ADR-449_wall-column-finish-junction-PathB.md`
**Quality bar:** FULL ENTERPRISE + FULL SSOT, Revit-grade. **Firestore-first. Confirm repro πριν re-implement.**
**Κανόνες:** Commit/push **ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree SHARED με άλλον agent → `git add` ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `-A`/`--no-verify`.** tsc: ο agent ΔΕΝ μπορεί να ελέγξει running-tsc (process-query denied) + τρέχουν codex agents → **tsc ο Giorgio** (`! npx tsc --noEmit`, N.17). **Ελληνικά πάντα.**

---

## 0. ΤΟ ΝΕΟ ΠΡΟΒΛΗΜΑ (η αποστολή της νέας συνεδρίας)

Ο Giorgio έβαλε **1 δοκάρι** στην ανατολική πλευρά μιας **μεμονωμένης κολόνας** (να δούμε συμπεριφορά δοκαριού). Δύο symptoms:

### Bug 1 — Κεκλιμένη κορυφή κολόνας ΠΑΡΑ ΤΟ καθαρό DB
- Η κολόνα εμφανίζεται με **κεκλιμένη/τριγωνική κορυφή** (η ΝΑ γωνία κατεβαίνει στα ~2500, οι άλλες 3 μένουν 3000 → το πάνω quad σπάει σε 2 τρίγωνα, το ένα γέρνει). Screenshot: `Στιγμιότυπο οθόνης 2026-06-14 221402.jpg`.
- **ΚΡΙΣΙΜΟ Firestore εύρημα (code=SoT):** τα **per-entity DB docs είναι ΚΑΘΑΡΑ** — η κολόνα είναι `topBinding:'storey-ceiling'`, `attachTopToIds:[]` (το επανέφερα χειροκίνητα, **κράτησε**, `updatedAt` αμετάβλητο μετά). Το δοκάρι αμετάβλητο (axis y=3.6377). **ΟΜΩΣ το render δείχνει attached/κεκλιμένη.** → **το render ΑΠΟΚΛΙΝΕΙ από τα per-entity docs.**

### Bug 2 — Το δοκάρι μετακινείται ΝΟΤΙΑ σε κάθε hard-refresh
- Μετά από **κάθε** σκληρή ανανέωση το δοκάρι εμφανίζεται **μετακινημένο νότια** (−y)· μετά την «κίνηση» η **νότια πλευρά κολόνας & δοκαριού δεν είναι collinear**.
- Το DB δοκάρι **δεν** αλλάζει (axis y=3.6377, `updatedAt`=δημιουργία) → η μετακίνηση είναι **render/in-memory, ΟΧΙ persisted** → επαναλαμβάνεται κάθε φορά από καθαρή βάση.

### ΥΠΟΘΕΣΗ (να επιβεβαιωθεί ΠΡΩΤΑ — confirm repro):
Δύο μη-αποκλειόμενες αιτίες:
- **(Α) Dual persistence (ADR-390):** η σκηνή φορτώνει από **DXF JSON snapshot (`autoSaveV2`)** αντί για τα `floorplan_columns/_beams` per-entity docs → το snapshot κρατά το παλιό attached + beam state → το per-entity revert μου δεν φαίνεται.
- **(Β) Load-time render reconcile:** ο render επανα-ανιχνεύει framing/attach **live** (αγνοώντας το `topBinding`) και κατεβάζει/μετακινεί **in-memory** (δεν persist → DB μένει καθαρό). Ύποπτο: ο render-time top-profile/sync κάνει framing detection ανεξάρτητα από το stored `topBinding`.

**ΠΡΩΤΟ ΒΗΜΑ:** διάκρινε Α vs Β. (i) grep/read τον scene loader: φορτώνει per-entity docs ή `autoSaveV2` JSON; (ii) διάβασε αν ο `resolveColumnTopProfile`/`syncColumns`/`columnToMesh` attached-path τρέχει **μόνο** όταν `topBinding==='attached'` ή κάνει live framing detection. Αν Β → ο render αγνοεί το DB μου → το πραγματικό fix είναι εκεί.

---

## 1. FIRESTORE BASELINE (αναπαράξιμη σκηνή)
- company `comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757` · project `proj_1d45b55b-e5ea-41fb-9466-bda795361e65`
- floorplan `file_f6b1782f-9e78-4ef6-a461-11ae41724d45` · floor `flr_4e7868ba-32b3-4327-9a24-b2de5320adb5` · level/layerId `lvl_aec46939-c091-4eb9-955a-2b3be650e71a`
- **Κολόνα** `col_fb3215e9-cabc-4c35-bc79-61669775d5a1`: `rectangular`, footprint X∈[21.3855, 21.8851] (width 499.56mm) · Y∈[3.6377, 4.6368] (depth 999.13mm) · center (21.635, 4.137) · height 3000 · sceneUnits 'm' · finish 15mm. **topBinding=`storey-ceiling`, attachTopToIds=`[]`** (μετά το manual revert μου — DB καθαρό). (Έχει leftover composite/ushape/tshape + reinforcement ADR-456 → άσχετα.)
- **Δοκάρι** `beam_dbe75163-e7f6-40b6-ac82-2d4f7bcba76f`: `straight`, axis (21.8851, 3.6377)→(23.9094, 3.6377) (**ανατολικά, πάνω στη νότια ακμή κολόνας**), width 250, depth 500, topElevation 3000, zOffset 0 → **z∈[2.5, 3.0]**, outline y∈[3.5127, 3.7627]. west end = **ΝΑ γωνία κολόνας** (frame-into πλευράς, ΟΧΙ από πάνω).
- MCP: `mcp__firestore__firestore_get_document`/`_query`/`_count` (collections `floorplan_columns`/`_beams`/`_walls`, filter `floorplanId == file_f6b1782f…`). **walls=0, beams=1, columns=1.**

---

## 2. ΤΙ ΕΓΙΝΕ ΑΥΤΗ ΤΗ ΣΥΝΕΔΡΙΑ (DONE, UNCOMMITTED — ο Giorgio θα κάνει commit)

### Bundle A — ADR-449 σοβάς Δρόμος Β (#A/#C + prev #2/#3) · ΟΛΑ jest GREEN
- **#A (column finish junction over-reach σε τοίχο):** ο resolver σημάδευε ΚΑΘΕ obstacle-touching άκρο ως junction → Slice 10 EXTEND υπερ-εκτεινόταν μέσα στον τοίχο. **Fix:** NEW `junctionObstacles` input (υποσύνολο obstacles, ΜΟΝΟ δομικά) → `aJunction/bJunction` (EXTEND)· wall obstacle αλλά ΟΧΙ junction → NEW `aSquareEnd/bSquareEnd` → `closeOpenOuterEnds` τετράγωνο butt (ούτε chamfer ούτε extend). Silhouette default `[]`. ✅ **browser-verified από Giorgio (2Δ≡3Δ, μηδέν προεξοχή).**
- **#C (embed διέρρεε στο cut-plane fast-path):** embed→**pull-back** (η άκρη τοίχου υποχωρεί 2mm μακριά από κολόνα → z-fight σπάει + occluded end-cap + ΜΗΔΕΝ geometry μέσα → μηδέν διαρροή). ✅ **browser-verified από Giorgio.**
- Αρχεία: MOD `bim/finishes/{structural-finish-types,structural-finish-resolver,structural-finish-outline-geometry,structural-finish-scene}.ts` + MOD test `bim/finishes/__tests__/structural-finish-resolver.test.ts` + `bim-3d/converters/__tests__/structural-finish-3d-beam.test.ts`· NEW `bim-3d/converters/wall-column-pullback-3d.ts`(+`__tests__/wall-column-pullback-3d.test.ts`)· **DELETED** `wall-column-embed-3d.ts`(+test, ήταν untracked)· prev NEW `bim/walls/wall-layer-lines-2d.ts`(+test) + MOD `bim/renderers/WallRenderer.ts` **[stage ADR-040 CHECK 6B/6D]**· **MIXED (ΜΟΝΟ δικές μου γραμμές)** `bim-3d/converters/BimToThreeConverter.ts`, `bim-3d/scene/bim-scene-attach-syncs.ts`· DOCS ADR-449 changelog + ADR-040 changelog (#3). **102/102 jest** [structural-finish+pullback+wall-layer-lines].

### Bundle B — ADR-401/441 attach-criterion fix (δοκάρι corner-graze)
- **Αιτία:** `findColumnsToAutoAttachToHost` (covering, per-corner soffit = σύλληψη ΓΙΑ ΠΛΑΚΕΣ) επέστρεφε true σε **corner-graze δοκαριού** (μία γωνία κολόνας στο beam footprint) → λάθος attach → per-corner resolver έγερνε ΜΟΝΟ αυτή τη γωνία → κεκλιμένη κορυφή. Το framing path (`findColumnsFramedByBeam`, flat top) σωστά είπε «όχι» (perp 0.4993m >> half-width 0.125m).
- **Fix (surgical):** `hostCoversColumn` +`requireCentroid` flag· **δοκάρι** hosts (top+base) απαιτούν κάλυψη **ΚΕΝΤΡΟΥ** (corner-graze→no attach· framing = ο beam detector)· **πλάκες** κρατούν corner-tolerant.
- Αρχεία: MOD `bim/columns/column-structural-attach-coordinator.ts` (+test update) + DOCS ADR-401 changelog. **59/59 jest** [attach-coordinator/AttachColumns/vertical-profile/attach-persist].
- ⚠️ **ΑΥΤΟ ΑΠΟ ΜΟΝΟ ΤΟΥ ΔΕΝ ΕΛΥΣΕ ΤΟ Bug 1** — γι' αυτό υπάρχει αυτό το handoff. Το fix αποτρέπει το λάθος attach σε **νέα** δοκάρια (στο `drawing:entity-created`), αλλά το render συνεχίζει κεκλιμένο επειδή **αποκλίνει από το DB** (βλ. §0 Bug 1). Πιθανόν χρειάζεται ΚΑΙ fix στο render/load path Ή στο `resolveColumnTopProfile` (αν κάνει live framing).

### Manual Firestore edit (έγινε)
- Επανέφερα `col_fb3215e9…` params: `topBinding` attached→`storey-ceiling`, `attachTopToIds`→`[]` (έγραψα ΟΛΟ το params object → μηδέν field loss, verified). **Κράτησε** — αλλά το render δεν το σέβεται (→ Bug 1).

### Tracking ενημερωμένα
`local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ADR-449 Δρόμος Β + ADR-401/441 attach γραμμές) · MEMORY topic `project_adr449_structural_finish_skin` · ADR-449/ADR-040/ADR-401 changelogs.

---

## 3. SSoT TOUCHPOINTS (διάβασε ΠΡΩΤΑ — PHASE 1 RECOGNITION)

| Αρχείο | Ρόλος / γιατί ύποπτο |
|---|---|
| `systems/levels/hooks/useLevelSceneLoader.ts` | **Bug 1/2 εδώ;** scene load — φορτώνει per-entity ή `autoSaveV2` JSON snapshot; |
| `DxfFirestoreService` (`loadFileV2`/`autoSaveV2`) | **Dual persistence (ADR-390).** grep για `autoSaveV2`/`loadFileV2` — ποια πηγή ζωγραφίζει; |
| `bim/geometry/column-vertical-profile.ts` (`resolveColumnTopProfile`/`classifyTopHosts`/`resolveColumnBaseZmm`) | **render-time top profile.** ΕΛΕΓΞΕ: σλοπάρει μόνο όταν `topBinding==='attached'`, ή κάνει **live framing detection** αγνοώντας το topBinding; (αν live → Bug 1 ρίζα) |
| `bim-3d/scene/BimSceneLayer.ts` `syncColumns` + `bim-3d/converters/BimToThreeConverter.ts` `columnToMesh` (attached-prism path) | render attach· πού διαβάζεται το topBinding/attachTopToIds |
| `bim/columns/column-structural-attach-coordinator.ts` | **το fix μου (Bundle B).** framing vs covering. |
| `hooks/useStructuralAutoAttach.ts` | auto-attach on `drawing:entity-created` (ΟΧΙ on load — επιβεβαιωμένο: το event εκπέμπεται μόνο σε Create*Command) |
| beam reconcile/justification/re-host on load (ADR-441 `bim/grid/**`, `bim-cascade-resolver.ts`, beam-from-grid) | **Bug 2 (δοκάρι→νότια).** Ψάξε load-time beam geometry re-derive/justification offset. |

**Canonical geom SSoT (grep ΠΡΙΝ γράψεις):** `pointToSegmentDistance` (`systems/guides/guide-types`), `pointInPolygon`/`polygonCentroid` (`bim/geometry/shared/polygon-utils`), `isPointInPolygon` (`utils/geometry/GeometryUtils`).

---

## 4. ΚΑΤΕΥΘΥΝΣΗ FIX (Revit-grade, FULL SSOT — αφού επιβεβαιωθεί η αιτία)
- **Revit truth:** δοκάρι που frame-into-άρει στην **πλευρά/γωνία** κολόνας ΔΕΝ αλλάζει το ύψος της κολόνας (μένει full-height μέχρι την οροφή). Μόνο δοκάρι που **κάθεται από πάνω** (column supports beam, center under beam) → top = beam soffit (**flat**, ΟΧΙ per-corner κεκλιμένο για compact column).
- **Αν Bug 1 = live framing στο render:** το `resolveColumnTopProfile` πρέπει να σέβεται το stored `topBinding` (ή να εφαρμόζει το ΙΔΙΟ centroid-criterion με το coordinator → SSoT: ένα κοινό «does host bear on column» predicate για detection ΚΑΙ render).
- **Αν Bug 1 = dual-persistence snapshot:** ο σωστός fix είναι single-source-of-truth load (per-entity = SSoT· το `autoSaveV2` JSON να μην κρατά stale BIM attach state ή να regenerate-άρει). Cross-ref ADR-390 (BIM filter από `autoSaveV2` ήταν DEFER εκεί).
- **Bug 2 (δοκάρι→νότια):** βρες το load-time reconcile/justification που μετατοπίζει το δοκάρι· πρέπει να σέβεται την persisted axis (idempotent load — render == DB).
- **FULL SSOT:** ένα predicate «host bears on column top» κοινό σε detection (coordinator) + render (vertical-profile)· ένα source-of-truth για load (per-entity)· μηδέν duplicate.

---

## 5. ΚΑΝΟΝΕΣ + ΠΡΩΤΟ ΒΗΜΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
1. Recognition: §3 αρχεία (loader + vertical-profile + syncColumns) + MEMORY `project_adr449_structural_finish_skin`.
2. **Confirm repro (Firestore-first §1):** επιβεβαίωσε ότι DB καθαρό αλλά render κεκλιμένο → διάκρινε αιτία Α (snapshot) vs Β (live framing render). Μην re-implement πριν κλειδώσει η αιτία.
3. Fix Bug 1 + Bug 2 (Revit-grade, FULL SSOT, §4).
4. **Commit/push ΜΟΝΟ Giorgio.** Shared tree → `git add` ΜΟΝΟ δικά σου. tsc ο Giorgio (N.17). Stage ADR-040 αν αγγίξεις 2Δ canvas/render files. N.15: ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + MEMORY ίδιο commit. N.11 i18n.
5. Pending από αυτή τη συνεδρία (Giorgio commit): Bundle A (ADR-449 #A/#C/#2/#3, browser-verified) + Bundle B (ADR-401/441 attach-criterion) — βλ. §2 λίστες αρχείων.
