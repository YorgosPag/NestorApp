# HANDOFF — ADR-408 Φ-B2b EXTENSION: 3D junction xyz-matching + connector-host incidents (no spurious cap) — NEXT

**Ημερομηνία:** 2026-06-05
**Μοντέλο:** Opus. **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`
**Execution:** **Plan Mode, ΦΑΣΗ-ΠΡΟΣ-ΦΑΣΗ** (απόφαση Giorgio). Recognition → (έρευνα Revit/IFC αν χρειαστεί) → Plan → ExitPlanMode → υλοποίηση → browser verify.
**Στόχος Giorgio (verbatim):** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ ΟΠΩΣ Η REVIT. FULL ENTERPRISE + FULL SSOT.»

---

## ⚠️ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.** Απλά λόγια όταν καθοδηγείς τον Giorgio σε browser ελέγχους.
- 🚫 **COMMIT/PUSH μόνο ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`. (Ο Giorgio το ξανατόνισε: «COMMIT ΘΑ ΚΑΝΩ ΕΓΩ».)
- 🌳 **SHARED working tree** με άλλον agent (ADR-414/415/417 + Sanitary Φ14). `git add` **ΜΟΝΟ δικά σου** specific files· **ΠΟΤΕ** `-A`. **ΜΗΝ αγγίξεις adr-index** (shared).
- 🤖 **AUTO-COMMIT ENV πιθανό:** αν watcher κάνει granular auto-commits, ΕΣΥ ΔΕΝ τρέχεις git commit· μην κάνεις reset.
- 🔬 tsc: `cd /c/Nestor_Pagonis; NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit > /tmp/tsc.txt 2>&1`. **Τα δικά σου = 0.** Γνωστό pre-existing (ΟΧΙ δικό σου): `mesh-to-object3d.ts(124)` (ADR-411). Τρέξ' το background + Monitor μέχρι `TSC_EXIT`.
- 🧪 jest: `npx jest mep-fitting mep-pipe-junctions mep-segment-trim`. Bash tool = bash. Git path = `"C:\Program Files\Git\cmd\git.exe"`. Firebase = **pagonis-87766**. Giorgio test scene = **σε ΜΕΤΡΑ** (`sceneUnits:'m'`).
- 🧠 Κανόνες N.0.1 (ADR-driven), N.7.2 (Google checklist), N.14 (Opus — συνέχεια task, SKIP block), **N.15 (update ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR + memory, ΟΧΙ adr-index)**.
- 🔥 **Firestore MCP:** ΜΟΝΟ read (query/count/list) — εξαιρετικό για διάγνωση. ΔΕΝ σβήνεις (ο Giorgio σβήνει με `firebase firestore:delete <coll> -r -f --project pagonis-87766`).
- 🔁 **Reconciler/bridge hooks δεν κάνουν HMR** → πες στον Giorgio **restart dev server + hard refresh** για να δει αλλαγές σε junctions/fitting reconciliation.

---

## ✅ ΤΙ ΕΓΙΝΕ (2026-06-05) — DONE, browser-verified, tsc 0 δικά μου, 🔴 pending commit (Giorgio)
1. **Φ11 unit-aware join tolerance hotfix** — `PIPE_JOIN_TOLERANCE_MM=25` + `resolvePipeJoinTolerance` + delete-by-id self-heal. ✅ verified.
2. **Manifold host-follow** — `resolveManifoldConnectedPipePatches` + CompoundCommand. ✅ verified.
3. **Reducing elbow** — angled+diffΘ → ΕΝΑ κωνικό reducing elbow (Revit single-component). Files: `mep-fitting-classify.ts`/`mep-fitting-bend.ts`/`mep-fitting-body.ts`/`mep-fitting-to-mesh.ts`. ✅ verified («τώρα η μούφα είναι κωνική»).
4. **Φ-B2b 3D-aware fittings** — οι μούφες ήταν ΕΠΙΠΕΔΕΣ (`planDirToWorld` μηδένιζε κατακόρυφη)→2ος σωλήνας δεν ταυτιζόταν σε κεκλιμένο κόμβο. Fix: `directionUnit`→3D + NEW `bim/geometry/mep-fitting-bend-3d.ts` (3D arc slerp) + `planDirToWorld((x,y,z))→(x,z,−y)` + inline/legs/cap 3D-orient. **TRIM ΑΜΕΤΑΒΛΗΤΟ** (2D `tangentLen`, ταυτίζεται by construction). ✅ verified («τώρα είναι σωστή η σύνδεση»).
- **N.15 docs: ✅ ΟΛΑ ΕΓΙΝΑΝ** (ADR-408 changelog + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory `project_adr408_phiA_per_endpoint_z` & `phi11` + MEMORY.md). ΟΧΙ adr-index.
- **Δικά μου αρχεία (uncommitted, μόνο αυτά κάνεις git add):** `bim/mep-fittings/mep-fitting-classify.ts`, `bim/geometry/mep-fitting-bend.ts`, `bim/geometry/mep-fitting-body.ts`, `bim/geometry/mep-fitting-bend-3d.ts` (NEW), `bim-3d/converters/mep-fitting-to-mesh.ts`, `bim/mep-systems/mep-pipe-junctions.ts` + tests (`__tests__/mep-fitting-classify.test.ts`, `mep-fitting-bend.test.ts`, `mep-fitting-body.test.ts`, `mep-fitting-bend-3d.test.ts` NEW, `mep-pipe-junctions.test.ts`) + ADR-408.

---

## 🎯 ΕΠΟΜΕΝΟ TASK — Φ-B2b EXTENSION (αυτό ζήτησε ο Giorgio)

Δύο **συζευγμένα** κομμάτια. **Πρωτεύον = #1 (junction xyz-matching, το ονόμασε ρητά ο Giorgio).** Το #2 (no spurious cap) είναι ο φυσικός σύντροφος — Plan Mode να αποφασίσει αν μπαίνουν μαζί ή σε δύο φάσεις.

### 🐛 #1 — JUNCTION xyz-MATCHING + junction z (πρωτεύον)
**Πρόβλημα:** το `derivePipeJunctions` (`bim/mep-systems/mep-pipe-junctions.ts`) ταιριάζει endpoints **μόνο σε κάτοψη**: `dist2(a,b)` (γρ. ~85) = `dx²+dy²` (z αγνοείται)· `position.z=0`· `centerlineElevationMm`=μέσος όρος. Συνέπεια: δύο σωλήνες που **διασταυρώνονται σε κάτοψη αλλά είναι σε διαφορετικό ύψος** (π.χ. ένας περνά πάνω από τον άλλο, ΧΩΡΙΣ σύνδεση) **συγχωνεύονται ψευδώς** σε έναν κόμβο → λάθος cross/tee + λάθος μούφα.
**Revit-correct:** match σε **xyz** — δύο endpoints είναι ο ίδιος κόμβος μόνο αν συμπίπτουν και στα τρία. 
**Approach (FULL SSOT):**
- `SegmentEndpoint` ήδη έχει `elevationMm` (το χρησιμοποίησα στο Φ-B2b). Κάνε το `dist2`→**3D**: `dx²+dy²+(Δz_scene)²` όπου `Δz_scene = (elevA−elevB)·mmToSceneUnits(units)` (ίδια μονάδα με xy — ίδιο pattern με το `directionUnit` 3D που μόλις μπήκε).
- Tolerance: ίδιο `resolvePipeJoinTolerance` (25mm unit-aware) — τώρα 3D σφαίρα αντί για 2D δίσκο.
- Junction z: μετά το xyz-matching τα coincident endpoints μοιράζονται z → `centerlineElevationMm` = το κοινό z (ο μέσος όρος γίνεται ακριβής)· σκέψου να βάλεις και `position.z` = node z (τώρα 0· έλεγξε ότι κανείς consumer δεν σπάει — ο fitting converter χρησιμοποιεί `centerlineElevationMm` για worldY, ΟΧΙ position.z).
- ⚠️ **Φ-B2a propagation** ευθυγραμμίζει τα συνδεδεμένα endpoints στο ίδιο z → εντός tolerance → συγχωνεύονται σωστά. Τα ασύνδετα διασταυρούμενα → εκτός tolerance → χωρίζουν. ✅
- **Tests:** `mep-pipe-junctions.test.ts` — δύο σωλήνες ίδιο xy / διαφορετικό z (>tolerance) → **ΔΥΟ** junctions (όχι ένα)· ίδιο xy+z → ένα. Back-compat: τα υπάρχοντα horizontal cases (z=0) αμετάβλητα.

### 🐛 #2 — CONNECTOR-HOST INCIDENTS → no spurious cap (σύντροφος, μεγαλύτερο refactor)
**Πρόβλημα:** το `derivePipeJunctions` μαζεύει **μόνο `mep-segment` endpoints**. Όταν ένα άκρο σωλήνα κουμπώνει σε **outlet συλλέκτη** ή **connector φωτιστικού**, ο host ΔΕΝ είναι incident → ο κόμβος βλέπει 1 σωλήνα → classify=`cap` → **ψεύτικη τάπα** εκεί που ο σωλήνας πιάνει τον συλλέκτη/φωτιστικό (Revit: εκεί δεν μπαίνει cap — ο συλλέκτης ΕΙΝΑΙ το fitting).
**Approach (FULL SSOT, Revit «the equipment is the fitting»):**
- Γενίκευση `MepFittingIncident`: `segmentId` → **`entityId`** (+κράτα `connectorId`). Ο κόμβος μαζεύει ΚΑΙ τα connector positions των manifold/fixture/panel (reuse `connectorWorldPosition`/`getEntityConnectors` — υπάρχουν στο connector subsystem).
- Classify: αν στον κόμβο υπάρχει host-connector (manifold/fixture), **ΟΧΙ cap** (ο host καλύπτει το άκρο). Ίσως νέο rule «pipe-end-at-host → no fitting» ή κρατάς incident με flag host.
- **Consumers του incident type (rename ripples — grep `directionUnit`/`segmentId` σε):** `mep-fitting-classify.ts`, `mep-fitting-body.ts`, `mep-segment-trim.ts`, `mep-fitting-geometry.ts`, `mep-fitting.schemas.ts`, `mep-fitting-types.ts`, `mep-fitting-to-mesh.ts` + tests. ⚠️ **persisted πεδίο** `incidents[].segmentId` → migration-safe (κράτα `segmentId` optional + νέο `entityId`, ή derive· z optional precedent).
- **Tests:** σωλήνας→outlet συλλέκτη = ΚΑΝΕΝΑ cap· σωλήνας→ελεύθερο άκρο = cap (όπως πριν).

---

## 🔑 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ (Recognition — ήδη χαρτογραφημένα)
- **Junctions SSoT:** `bim/mep-systems/mep-pipe-junctions.ts` (`derivePipeJunctions`, `dist2` planar γρ.~85, `buildJunction` z=avg γρ.~123, `toIncident` γρ.~113, `SegmentEndpoint.elevationMm/otherElevationMm`).
- **Classify:** `bim/mep-fittings/mep-fitting-classify.ts` (`classifyJunction`: 1 incident→cap).
- **Incident type:** `bim/types/mep-fitting-types.ts` (`MepFittingIncident.segmentId`) + `bim/types/mep-fitting.schemas.ts` (Point3DSchema z optional ήδη).
- **Connectors:** `bim/types/mep-connector-types.ts` (`connectorWorldPosition`, `getEntityConnectors`, `buildMepManifoldConnectors`) + `bim/mep-segments/mep-connector-elevation.ts` (`resolveMepConnectorElevationMmAt` — host datum=`mountingElevationMm`).
- **Trim:** `bim/mep-fittings/mep-segment-trim.ts` (uses incidents· planar 2D, ΜΗΝ το σπάσεις).
- **3D fitting converter:** `bim-3d/converters/mep-fitting-to-mesh.ts` (`planDirToWorld` τώρα 3D· `computeBend3DArcPoints`).
- **3D bend SSoT (μόλις δημιουργήθηκε):** `bim/geometry/mep-fitting-bend-3d.ts`.
- **Pipe 3D mesh (reference για ταύτιση):** `bim-3d/converters/mep-segment-to-mesh.ts` (startW/endW 3D + trim κατά 3D άξονα).

## ⚠️ ΜΑΘΗΜΑΤΑ (από σήμερα)
- **Φ-B2b αρχή:** το fitting ταυτίζεται με τον σωλήνα **by construction** όταν μοιράζονται `tangentLen` + κατεύθυνση — άρα **ΜΗΝ αλλάξεις το trim**· κράτα το 2D `tangentLen`, άλλαξε μόνο matching/incidents.
- **Unit-consistency:** ΟΛΑ τα 3D vector maths σε ομοιογενή μονάδα — `Δz = mm · mmToSceneUnits(units)` (η σκηνή του Giorgio = ΜΕΤΡΑ).
- **Persisted incident rename:** `segmentId`→`entityId` σπάει schema + persisted docs → migration-safe (optional/derive, όπως το z optional precedent).
- **ΕΚΤΟΣ ADR-040** (όλα `bim/` pure + `bim-3d/converters/`). STAGE ADR-408. ΜΗΝ adr-index.

## 📋 ΠΡΩΤΑ ΒΗΜΑΤΑ ΕΠΟΜΕΝΗΣ ΣΥΝΕΔΡΙΑΣ
1. Recognition: ξαναδιάβασε `mep-pipe-junctions.ts` (state μετά Φ-B2b) + `mep-fitting-classify.ts` + incident type/schema.
2. Plan Mode → παρουσίαση στον Giorgio: #1 xyz-matching μόνο, ή #1+#2 μαζί (no spurious cap)· εύρος/migration του incident rename.
3. Υλοποίηση SSOT + tests + tsc 0 + browser verify (restart dev + hard refresh).
4. N.15 docs (ADR-408 + ΕΚΚΡΕΜΟΤΗΤΕΣ + memory `project_adr408_phiA_per_endpoint_z`). ΟΧΙ adr-index. ΜΗΝ κάνεις commit — ο Giorgio.
