# HANDOFF — ADR-441 Slice 6b: Re-host / Migration legacy ορφανών πεδιλοδοκών

**Date:** 2026-06-11 · **Branch:** main · **Shared working tree** (άλλος agent δουλεύει ταυτόχρονα — grips/snapping/rotation: ADR-397) · **Μοντέλο: Opus**

> 🎯 **ΕΝΤΟΛΗ GIORGIO:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ, ΟΠΩΣ Η REVIT — ΥΛΟΠΟΙΗΣΗ ΜΕ ΣΥΣΤΗΜΑ, FULL ENTERPRISE + FULL SSOT.» **SEARCH FIRST** (code=SoT· τα signatures στο §3 επιβεβαιώθηκαν 2026-06-11). Απάντα **ΕΛΛΗΝΙΚΑ**.
>
> ⚠️ **ΚΑΝΟΝΕΣ (απαράβατοι):** ΠΟΤΕ `git commit`/`push` — **ο Giorgio κάνει commit**. `git add` **ΜΟΝΟ τα δικά σου αρχεία**, **ΠΟΤΕ `-A`** (shared tree — μην αγγίξεις grips/snapping/rotation/SnapEngine/ProSnapToolbar/bim-characteristic-* άλλου agent). **N.17: ΕΝΑ tsc τη φορά** (έλεγξε process: `Get-CimInstance Win32_Process … *tsc*`· ΠΟΤΕ `tsc | head`). function ≤40γρ, file ≤500γρ, no `any`/`as any`/`@ts-ignore`, i18n ICU. **Confirm repro ΠΡΙΝ γράψεις κώδικα.**

---

## 0. ΔΙΑΒΑΣΕ ΠΡΩΤΑ (Recognition — N.0.1 Phase 1)
1. **`ADR-441-foundation-strip-grid-auto-design.md`** — §10 (Slices 0-6, τι υπάρχει)· §9 changelog (Slice 6 + tolerance fix).
2. **`ADR-436-…foundation.md`** — BIM Foundation Discipline + persistence.
3. Αυτό το handoff (§2 πρόβλημα· §3 signatures· §4 σχέδιο).
4. MEMORY `[[project_adr441_foundation_strip_grid]]` (πλήρες ιστορικό Slices).

---

## 1. ΤΙ ΕΓΙΝΕ ΗΔΗ (Slice 6 — DONE, LIVE-verified, **ΕΚΚΡΕΜΕΙ COMMIT από Giorgio**)

**ADR-441 Slice 6 — Reconciling «Εσχάρα από κάναβο» (signature-set diff)** ✅ **LIVE-VERIFIED** (Giorgio 2026-06-11, και το tolerance fix). Λύνει το σκέλος **(β)** του αρχικού προβλήματος (διπλοί από τυφλή παραγωγή).

- **signature-set diff:** κάθε grid λωρίδα → `gridStripSignature` = `segmentKey | bucket(start) | bucket(end)`. Diff target↔existing → create missing, delete obsolete (split-superseded / stale corner-fill), αμετάβλητες κρατούν id. Atomic `CompoundCommand([Delete?,Create?])` (1 undo). No-op → `reason:'up-to-date'`.
- **tolerance fix (κρίσιμο μάθημα):** `SIGNATURE_COORD_TOL` `1→0.001` σκην. μονάδα — το `1` «έτρωγε» το corner-fill overhang (`width/2 × 0.001 ≈ 0.25` σε **σκηνές μέτρων**) → περιμετρική & εσωτερική ίδιο signature → δεν αντικαθίστατο (Giorgio screenshot: «εισχωρεί w/2»). **ΜΑΘΗΜΑ: κάθε geometric tolerance εδώ ΠΡΕΠΕΙ να είναι λεπτότερο από το μικρότερο σημαντικό βήμα (corner-fill `w/2`), που σε μέτρα είναι εκατοστά. Ισχύει ΚΑΙ για το 6b matching tolerance.**

**Uncommitted Slice 6 αρχεία (git add ΜΟΝΟ αυτά, ο Giorgio θα τα commit-άρει):**
- NEW: `bim/foundations/foundation-grid-segments.ts` (+test)· `bim/foundations/foundation-grid-reconcile.ts` (+test)· `core/commands/entity-commands/DeleteFoundationsCommand.ts` (+test)
- MOD: `bim/foundations/foundation-grid-commit.ts` (+test)· `ui/ribbon/hooks/useRibbonFoundationBridge.ts`· `hooks/useDxfViewerNotifications.ts`· `systems/events/drawing-event-map.ts`· `i18n/locales/el|en/dxf-viewer-shell.json`· `ADR-441…md`
- `foundation-from-grid.ts` (+test): **net-zero** (6a coveredKeys → revert) — όχι staged.
- 48 jest πράσινα· tsc 0 errors στα δικά μας (6 pre-existing άλλου agent).

> ⚠️ Αν ο Giorgio έχει ήδη κάνει commit το Slice 6 πριν ξεκινήσεις, αγνόησε τη λίστα — απλώς συνέχισε στο 6b.

---

## 2. ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙΣ (Slice 6b — σκέλος **(α)**, ΕΠΙΒΕΒΑΙΩΜΕΝΟ)

**Αρχικό παράπονο Giorgio (handoff Slice 6 §2.1):** «**παλιοί** πεδιλοδοκοί ΔΕΝ ακολουθούν τη μετακίνηση των οδηγών». Root cause: δημιουργήθηκαν **πριν** το Slice 3 binding-persistence → τα Firestore docs τους **δεν έχουν `guideBindings`** → φορτώνονται **ορφανοί** → δεν είναι «κρεμασμένοι» σε κανέναν άξονα → ο follow-move reconciler (Slice 3) τους αγνοεί.

Το **Slice 6 reconcile** τους αφήνει **σκόπιμα ανέγγιχτους** (`gridStripSignature===null` → ΠΟΤΕ delete) — αλλά **ούτε τους ζωντανεύει**.

**ΣΤΟΧΟΣ Slice 6b (Revit/Tekla migration):** οι ορφανοί που **γεωμετρικά ευθυγραμμίζονται** με τους **τρέχοντες** άξονες → αποκτούν `guideBindings` (re-host by geometry) → **αρχίζουν να ακολουθούν**, **ΧΩΡΙΣ διαγραφή**, χωρίς να χάνεται καμία χειροκίνητη αλλαγή. Όσοι δεν ευθυγραμμίζονται (ο χρήστης μετακίνησε άξονες αλλιώς) → μένουν ελεύθεροι (v1).

---

## 3. SSoT / SIGNATURES — REUSE αυτούσια (ΕΠΙΒΕΒΑΙΩΜΕΝΑ 2026-06-11, code=SoT)

| Τι | Πού | Σημείωση για 6b |
|---|---|---|
| **Guide reader** | `systems/guides/guide-store.ts` `getGlobalGuideStore()` → `getGuides()` (όλοι) / `getGuidesByAxis('X'\|'Y')` → `Guide{id, offset, axis, visible}` | `X` = κατακόρυφη σε `x=offset`· `Y` = οριζόντια σε `y=offset`. Offsets σε **scene units** (ίδια με `params.start/end`). Φιλτράρισε `visible` + axis≠'XZ'. |
| **Slot→coordinate (να ΑΝΤΙΣΤΡΕΨΕΙΣ)** | `bim/hosting/derive-params-from-guides.ts` `deriveFoundationParamsFromGuides` | Δίνει τη λογική `start-x→start.x` κλπ. Το 6b κάνει το **αντίστροφο**: coordinate → βρες guide με `offset≈coord` → attach binding με το σωστό slot. |
| **Binding model** | `bim/hosting/guide-binding-types.ts` `GuideBinding{guideId, slot, extend?}`· slots `start/end/center-x/y`· `hasGuideBindings(e)` | Vertical strip (start.x==end.x): `[{X,'start-x'},{X,'end-x'},{Yi,'start-y'},{Yj,'end-y'}]`. Horizontal: mirror. **v1: ΧΩΡΙΣ `extend`** (μην ανακατασκευάζεις corner-fill· bind σκέτο start/end → ακολουθεί). |
| **Builder bind-λογική (mirror)** | `bim/foundations/foundation-from-grid.ts` `makeBinding`/`emitVerticalStrips`/`emitHorizontalStrips` | Ίδια slot mapping — αναπαρήγαγε τη bind-σύνθεση (ΟΧΙ το geometry). |
| **Orphan detection** | `types/entities.ts` `isFoundationEntity` + `hasGuideBindings` | Orphan = `isFoundationEntity` ΚΑΙ kind line (`'strip'\|'tie-beam'`) ΚΑΙ **όχι** `hasGuideBindings` (ή bindings προς διαγραμμένους guides — v1: μόνο no-bindings). |
| **Geometry coords** | `bim/types/foundation-types.ts` `StripFootingParams.start/end: Point3D` (mm world / scene units) | Match: vertical αν `|start.x-end.x|<tol`· βρες X-guide `|offset-start.x|<tol`, Y-guides `|offset-start.y|<tol` & `|offset-end.y|<tol`. **tol scale-aware** (βλ. §1 μάθημα· reuse `SIGNATURE_COORD_TOL`=0.001 ή half-min-spacing). |
| **Persistence (ΧΡΕΙΑΖΕΤΑΙ ΕΠΕΚΤΑΣΗ)** | `bim/foundations/foundation-firestore-service.ts` | ⚠️ **`FoundationUpdateInput` + `updateFoundation` ΔΕΝ περιλαμβάνουν `guideBindings`** (γρ.100-105, 175-187)! Για να persist-άρει το re-host σε **υπάρχον** doc → **πρόσθεσε** `guideBindings?` στο `FoundationUpdateInput` + `payload.guideBindings` στο `updateFoundation`. (`saveFoundation`/`entityToSaveInput` ΗΔΗ τα γράφουν — αλλά setDoc σπάει στο update λόγω immutable `createdAt`.) Rules: το update block επιτρέπει nested field (MEMORY Slice 3· **verify** `firestore.rules` `floorplan_foundations` update). |
| **Persist trigger** | `hooks/data/useFoundationPersistence.ts` `persist()` (γρ.259· καλεί `updateFoundation`) + `useBimEntityMovedPersistEffect` | Μόλις επεκταθεί το `updateFoundation`, ο `persist()` πρέπει να περάσει & `guideBindings`. Είτε επέκτεινε το `persist` update-branch (γρ.274) να στείλει `entity.guideBindings`, είτε νέο μονοπάτι. |
| **Scene-attach command** | `core/commands/entity-commands/UpdateFoundationParamsCommand.ts` (single, **δεν** αλλάζει bindings) + `CompoundCommand` | Το re-host αλλάζει **bindings** (όχι params/geometry). Χρειάζεσαι **NEW** atomic command (π.χ. `RehostFoundationsCommand`: set bindings σε scene + deferred persist event· undo αφαιρεί). Mirror του deferred-microtask pattern του `CreateFoundationsCommand`/`DeleteFoundationsCommand`. |

---

## 4. ΣΧΕΔΙΟ — Slice 6b (FULL SSoT, phased· **Plan Mode**· έγκριση Giorgio)

> Recognition πρώτα (code=SoT· verify κάθε υπογραφή §3) → Plan Mode → έγκριση → incremental, tsc serialized, Revit-grade.

### 4.1 NEW pure `bim/foundations/foundation-grid-rehost.ts`
- `rehostOrphanStrips(orphans, guides, sceneUnits, tol?) → { entity: FoundationEntity; bindings: GuideBinding[] }[]`
- Για κάθε orphan line-strip: classify vertical/horizontal (από start/end)· βρες parallel guide + 2 endpoint guides με `|offset-coord|<tol` (scale-aware)· αν **και τα 3** βρεθούν → σύνθεσε bindings (mirror builder slot-λογική, **χωρίς extend**)· αλλιώς skip (μένει ελεύθερος). Total/pure/tested.

### 4.2 Persistence επέκταση
- `FoundationUpdateInput` +`guideBindings?` + `updateFoundation` `payload.guideBindings`. + `persist()` update-branch περνά `entity.guideBindings`. Verify `firestore.rules` update block επιτρέπει.

### 4.3 NEW `core/commands/entity-commands/RehostFoundationsCommand.ts`
- Atomic batch: set `guideBindings` στις scene entities (forward) + deferred persist event· undo αφαιρεί bindings + persist. 1 undo. Mirror Create/DeleteFoundationsCommand deferred pattern.

### 4.4 Orchestrator wiring (ΑΠΟΦΑΣΗ σχεδίασης — πρότεινε στον Giorgio)
- **Option A (συνιστάται, Revit-grade):** το re-host τρέχει **μέσα** στο «Εσχάρα από κάναβο», **ΠΡΙΝ** το reconcile → οι ευθυγραμμισμένοι orphans γίνονται grid-managed → ο reconciler τους βλέπει ως existing → **μηδέν διπλοί** (το re-host de-dup-άρει & τους ορφανούς έναντι του grid). Ένα ενοποιημένο `CompoundCommand([Rehost?, Delete?, Create?])`.
- **Option B:** ξεχωριστή action «Re-host/Migration».
- Πρότεινε A· επιβεβαίωσε με Giorgio.

### 4.5 Tests
- pure rehost: vertical/horizontal orphan ευθυγραμμισμένος → σωστά bindings· εκτός grid → skip· **κλίμακα μέτρων** (tol scale-aware, μάθημα Slice 6)· orphan με υπάρχοντα bindings → αμετάβλητος.
- command: set/undo bindings.
- orchestrator: orphan ευθυγραμμισμένος → re-bind + (μετά) ακολουθεί follow-move· orphan εκτός grid → άθικτος· μηδέν διπλοί όταν orphan overlays grid segment.

### 4.6 ΡΙΣΚΑ
1. **tol scale-aware** (μάθημα Slice 6 — μέτρα): match σε εκατοστά· reuse 0.001 ή half-min-spacing.
2. **Persistence bindings:** χωρίς την §4.2 επέκταση, το re-host **δεν persist-άρει** → χάνεται μετά reload. ΚΡΙΣΙΜΟ.
3. **Ambiguous match:** 2 guides εντός tol → πάρε τον πλησιέστερο (ή skip). Deterministic.
4. **shared tree:** git add ΜΟΝΟ δικά σου· ΟΧΙ -A· μην αγγίξεις ADR-397 αρχεία.

---

## 5. ΚΑΝΟΝΕΣ / WORKING TREE
- **ΕΚΤΟΣ ADR-040** (pure rehost + command + persistence· καμία renderer/canvas· grid read event-time μέσω `getGlobalGuideStore()`).
- **Δικά σου (αναμενόμενα):** NEW `foundation-grid-rehost.ts`, NEW `RehostFoundationsCommand.ts`, MOD `foundation-firestore-service.ts`, MOD `useFoundationPersistence.ts`, MOD `foundation-grid-commit.ts` (αν Option A), + tests· ίσως `firestore.rules` (μόνο αν το update block ΔΕΝ επιτρέπει bindings — verify πρώτα).
- **ΑΛΛΟΥ agent (ΜΗΝ αγγίξεις):** grips/grip-temperature/SnapEngine/RotationSnapEngine/SnapContext/ProSnapToolbar/extended-types/*CornerSnapEngine/bim-characteristic-* (ADR-397). **ΠΟΤΕ `git add -A`.**
- N.15 docs: ADR-441 §10 +Slice 6b + changelog · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (1-2 γρ.) · MEMORY `[[project_adr441_foundation_strip_grid]]`. **ΜΗΝ** adr-index (shared tree).
- **COMMIT ΤΟΝ ΚΑΝΕΙ Ο GIORGIO.** Αν χρειαστεί deploy rules → ζήτα από Giorgio.

## 6. QUICK START
1. Recognition: ADR-441 §10 + §3 signatures αυτού του handoff (verify κάθε υπογραφή· **ειδικά** η persistence-bindings gap §3 + το scale-aware tol μάθημα).
2. `git status` (Slice 6 ίσως ήδη committed· ADR-397 από άλλον agent — μην τα αγγίξεις).
3. **Plan Mode** → πρότεινε Slice 6b (+ απόφαση Option A/B §4.4) → έγκριση Giorgio → incremental. tsc serialized. ΜΗΝ commit/push.
4. Browser-verify: παλιός ορφανός πεδιλοδοκός (χωρίς bindings) ευθυγραμμισμένος σε άξονα → τρέξε «Εσχάρα από κάναβο» → μετακίνησε τον άξονα → **τώρα ακολουθεί** (πριν: ακίνητος). Reload → εξακολουθεί να ακολουθεί (persist OK).
