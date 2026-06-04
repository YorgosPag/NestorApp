# HANDOFF — ADR-408: Revit-true 3D Pipe Connection (συλλέκτης→σωλήνας→μούφα→σωλήνας) — NEXT

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus. **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`
**Execution:** **Plan Mode, ΦΑΣΗ-ΠΡΟΣ-ΦΑΣΗ** (απόφαση Giorgio). Ξεκίνα με **Φ-A**, browser verify, μετά Φ-B κλπ.

---

## ⚠️ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH μόνο ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`.
- 🌳 **SHARED working tree** με άλλον agent (ADR-415 floorplan-symbol). `git add` **ΜΟΝΟ δικά σου** specific files· **ΠΟΤΕ** `-A`. **ΜΗΝ αγγίξεις adr-index** (shared).
- 🔬 tsc: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "error TS"`. **Γνωστό non-mine error (ΑΓΝΟΗΣΕ):** `mesh-to-object3d.ts:124` (string-not-narrow, προϋπάρχον).
- 🧪 Bash tool = bash. Test scene units = **cm/mm**. Firebase project = **pagonis-87766**.
- 🧠 Κανόνες N.0.1 (ADR-driven), N.7.2 (Google checklist), N.8 (execution mode), N.14 (Opus), N.15 (update ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+memory, ΟΧΙ adr-index).
- 🎯 **Στόχος Giorgio (verbatim):** «ΟΠΩΣ ΤΟ ΚΑΝΟΥΝ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ ΟΠΩΣ Η REVIT. FULL ENTERPRISE + FULL SSOT. ΤΟ ΘΕΛΩ ΤΕΛΕΙΟ.»

---

## ✅ ΤΙ ΜΟΛΙΣ ΕΓΙΝΕ (προηγούμενη συνεδρία — pending commit Giorgio)

**Contextual Property Tabs «Ιδιότητες Συλλέκτη» (Φ12) + «Ιδιότητες Σωλήνα/Αεραγωγού» (Φ8) DONE.** Browser-tested: τα tabs δουλεύουν (ο Giorgio άλλαξε διάμετρο + ύψος άξονα, σώθηκαν). FULL SSOT, ΜΗΔΕΝ νέο command. Fold-in «σαν Revit»: panel «Δίκτυο» μέσα στο manifold tab (self-hide `hasNetwork`). 6 NEW + 2 test suites (21/21 PASS), tsc 0 δικά μου.

**NEW files (uncommitted, ready):**
- `ui/ribbon/hooks/bridge/mep-manifold-command-keys.ts` + `data/contextual-mep-manifold-tab.ts` + `hooks/useRibbonMepManifoldBridge.ts`
- `ui/ribbon/hooks/bridge/mep-segment-command-keys.ts` + `data/contextual-mep-segment-tab.ts` + `hooks/useRibbonMepSegmentBridge.ts`
- `ui/ribbon/hooks/__tests__/useRibbonMepManifoldBridge.test.tsx` + `useRibbonMepSegmentBridge.test.tsx`

**MOD files:** `app/ribbon-contextual-config.ts` (register 2 tabs + 2 `resolveContextualTrigger` cases + **αφαίρεσα** το manifold→network manage branch — fold-in)· `ui/ribbon/hooks/useRibbonCommands.ts`· `app/useDxfBimBridges.ts`· `app/useDxfViewerRibbon.ts`· `i18n/locales/{el,en}/dxf-viewer-shell.json`· `ADR-408` changelog· `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`· memory.

⚠️ **Σημείωση:** το «Ύψος άξονα» (`mepSegment.params.centerlineElevation`) στο segment tab θα **εξελιχθεί** σε per-endpoint στη Φ-A (δες κάτω).

---

## 🐛 ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΟΥΜΕ (screenshot Giorgio 3D)

Ο χρήστης έφτιαξε συλλέκτη + 2 σωλήνες, δημιούργησε δίκτυο ύδρευσης, άλλαξε διάμετρο/ύψος, και στο 3D **όλα φαίνονται σπασμένα — καμία συνέχεια** συλλέκτης→σωλήνας→μούφα→σωλήνας. Τα στοιχεία είναι σκόρπια σε διαφορετικά ύψη.

### Root cause (επιβεβαιωμένο από Recognition — ΟΧΙ bug των tabs):
1. **Αναντιστοιχία υψομέτρων:** συλλέκτης floor-mounted **400mm** (`DEFAULT_MANIFOLD_MOUNTING_ELEVATION_MM`) vs σωλήνας default **2800mm** (`DEFAULT_SEGMENT_CENTERLINE_ELEVATION_MM`, στάθμη οροφής/plenum). Γεννιούνται 2.4m χώρια.
2. **Snap = μόνο κάτοψη (xy), ΟΧΙ Z.** Άρα ένωση άκρων σε κάτοψη δεν σημαίνει ένωση σε 3D.
3. **Junctions/μούφες είναι ΕΠΙΠΕΔΑ (xy)** και πιάνουν **ΜΟΝΟ σωλήνα-σωλήνα** — ο συλλέκτης δεν συμμετέχει ποτέ. Η μούφα μπαίνει στον **μέσο όρο** των δύο υψομέτρων → δεν κουμπώνει σε κανέναν αν διαφέρουν.
4. **Σωλήνες αυστηρά οριζόντιοι** — ένα `centerlineElevationMm` για ΚΑΙ τα δύο άκρα → αδύνατο κατακόρυφο riser με το σημερινό μοντέλο.

---

## 🏛️ ΑΡΧΙΤΕΚΤΟΝΙΚΗ «ΣΑΝ REVIT» (5 πυλώνες — απόφαση Giorgio: full enterprise/SSOT)

1. **3D μοντέλο σωλήνα (per-endpoint Z):** `startPoint.z`/`endPoint.z` γίνονται η **αυθεντική** στάθμη κάθε άκρου (το `MepSegmentParams.startPoint/endPoint` είναι **ήδη `Point3D`** — σήμερα το z αγνοείται). Ο σωλήνας μπορεί να ανεβαίνει/κλίνει (riser/sloped). `centerlineElevationMm` → **derived/back-compat** (horizontal ⇒ start.z==end.z). **Migration**: υπάρχοντα segments → set start/end z = `centerlineElevationMm` στο load.
2. **Connector-mate στο snap (3D):** όταν άκρο σωλήνα κουμπώνει σε connector (outlet συλλέκτη / άλλο σωλήνα / φωτιστικό), κληρονομεί την **πλήρη 3D θέση (x,y,z)** του connector.
3. **Junctions σε 3D + γενίκευση incident:** `derivePipeJunctions` ενώνει connector endpoints σε **xyz**· το `MepFittingIncident` γενικεύεται από `segmentId` → **`entityId+connectorId`** ώστε ο **συλλέκτης (outlet) να γίνεται incident**.
4. **Auto-fittings/risers σε 3D:** όταν incidents έχουν διαφορετικό Z → η μούφα γίνεται **κατακόρυφο riser/transition**· 3D fitting mesh με πραγματικό 3D path (ήδη TubeGeometry για radiused elbow).
5. **Physical-network SSoT:** ένα pure μέρος που resolve-άρει το συνεκτικό 3D δίκτυο από το connector graph (η «συνέχεια» manifold→pipe→fitting→pipe).

---

## 📋 ΦΑΣΕΟΛΟΓΗΣΗ (Plan Mode, verify ανάμεσα)

- **Φ-A — per-endpoint Z foundation:** types/schemas (start/end z authoritative, centerlineElevationMm derived) + migration + **όλοι οι ~14 consumers** (geometry/3D mesh/2D renderer/grips/ghost/connectors/BOQ/command/completion/bridge) + tests. ⚠️ Ενημέρωσε το segment tab «Ύψος άξονα» → start/end (ή «κλίση»).
- **Φ-B — 3D connect:** connector-mate snap (inherit xyz) + 3D junctions + γενίκευση `MepFittingIncident` → συλλέκτης/φωτιστικό incidents.
- **Φ-C — risers/fittings 3D:** fitting classify/geometry/mesh για 3D (κατακόρυφο riser/transition).
- **Φ-D — verify + polish** (browser, tsc full, BOQ, undo/redo, persistence/reload).

---

## 🔑 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (Recognition χαρτογραφημένο)

**Consumers του `centerlineElevationMm` (~14 — άγγιξέ τα ΟΛΑ στη Φ-A):**
- `bim/types/mep-segment-types.ts` (+`.schemas.ts`) — `MepSegmentParams`, `resolveSegmentSection`, defaults
- `bim/geometry/mep-segment-geometry.ts` — `computeMepSegmentGeometry`
- `bim/mep-segments/mep-segment-connectors.ts` — **γρ.48** `segmentConnectorWorldPosition` → `z: centerlineElevationMm`
- `bim-3d/converters/mep-segment-to-mesh.ts` — 3D positioning
- `core/commands/entity-commands/UpdateMepSegmentParamsCommand.ts`
- `hooks/drawing/mep-segment-completion.ts` — γρ.80-88 defaults
- `ui/ribbon/hooks/useRibbonMepSegmentBridge.ts` — (μόλις έφτιαξα)
- `bim/mep-systems/mep-pipe-junctions.ts` — `derivePipeJunctions` (PLANAR — `dist2` αγνοεί z, `junctionKey`=`qx:qy`, μόνο pipe segments, fitting στον μέσο όρο elevation)
- `bim/mep-fittings/mep-fitting-resolve.ts` + `bim/geometry/mep-fitting-geometry.ts` + `bim/types/mep-fitting-types.ts` (+`.schemas.ts`) — `MepFittingIncident` (keyed `segmentId`)
- `bim-3d/converters/mep-fitting-to-mesh.ts`

**Junctions/Fittings (Φ11):** `useMepFittingAutoReconciliation.ts` (persisted `mep-fitting` entities, idempotent BY `junctionKey`, debounced)· `mep-fitting-classify.ts` (τοπολογία→kind: 1=cap/2 collinear=coupling/reducer/2 angled=elbow/3=tee/4=cross).

**Manifold:** `bim/mep-manifolds/mep-manifold-geometry.ts` `buildMepManifoldConnectors` (1 inlet + N outlets, outlets local z=0 → world Z = `mountingElevationMm`≈400· box centre). `mep-manifold-types.ts`.

**Snap:** `snapping/engines/MepConnectorSnapEngine.ts` (segment→2 endpoints· fixture/panel/manifold→`connectorWorldPosition`)· εφαρμόζεται κεντρικά στο mouse-handler-up (κάτοψη). Δες πώς να inherit-άρει Z στο connect.

**Φυσικό δίκτυο:** `bim/mep-systems/mep-pipe-network-derive.ts` (`derivePipeNetworks` union-find, `DEFAULT_PIPE_JOIN_TOLERANCE`).

---

## ⚠️ ΜΑΘΗΜΑΤΑ (μην τα ξαναπατήσεις)
- **Νέο/άλλαγμένο BIM geometry = case σε ~5-6 σημεία** (geometry + 3D mesh + 2D renderer + Bounds + HitTestingService + selection-duplicate). Silent-drop αν ξεχάσεις.
- **UpdateMepSegmentParamsCommand ΔΕΝ emit-άρει** — το `useMepSegmentPersistence` auto-save ακούει `bim:mep-segment-params-updated` (ο bridge το κάνει emit). Manifold = scene-diff auto-save (command emit-άρει ήδη).
- **Rename/γενίκευση export = grep ΟΛΟΥΣ τους consumers** (στο Φ13 ξεχάστηκαν 2 → build error).
- **Migration:** μην σπάσεις υπάρχοντα Firestore segments — fallback `centerlineElevationMm` → start/end z όταν λείπει.
- Radix Select no-value = `SELECT_CLEAR_VALUE`. i18n el+en parity πριν το `t()`. 40γρ/function, 500γρ/file.

## 🟡 Roadmap μετά
- Duct (air) systems· grips add/remove manifold outlet· Φ14 system browser/sizing.
