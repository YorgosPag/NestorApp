# 🧠 HANDOFF — ADR-408 «Connectivity-Preserving Move» (host move + pipe move → τα συνδεδεμένα άκρα ακολουθούν): PLAN MODE

> **Σύνταξη:** Opus 4.8, 2026-06-08. **Στόχος νέας συνεδρίας: PLAN MODE → υλοποίηση** του Revit-grade «μετακινείς στοιχείο → οι συνδεδεμένοι σωλήνες ακολουθούν/τεντώνουν, δεν αποκολλώνται». Εντοπίστηκε από τον Giorgio κατά την επαλήθευση του ADR-426 (auto-design ύδρευσης). **Είναι ADR-408**, ΟΧΙ ADR-426/423.

---

## ⚠️ ΚΑΝΟΝΕΣ (αμετάβλητοι — πάγια εντολή Giorgio)
- **Ελληνικά** όλες οι απαντήσεις (LANGUAGE RULE CLAUDE.md).
- **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι παίχτες / η Revit»** — μηδέν `any`/`as any`/`@ts-ignore`, αρχεία ≤500 γρ., functions ≤40 γρ.
- **SHARED working tree** με άλλον agent (codex). Όταν γραφτεί κώδικας: `git add` **ΜΟΝΟ δικά σου** αρχεία, **ΠΟΤΕ** `git add -A`.
- **COMMIT/PUSH τον κάνει ΜΟΝΟ ο Giorgio** (N.(-1)). Εσύ ΔΕΝ κάνεις commit/push. **ΜΗΝ αγγίξεις adr-index** (shared tree).
- **Plan Mode πρώτα** (feature ~8-12 αρχεία, 2 domains) → σχεδίασε & ζήτα έγκριση plan **ΠΡΙΝ** κώδικα. Πάρε εσύ τις Revit αποφάσεις, ζήτα μόνο έγκριση plan.
- **N.17:** ΕΝΑΣ tsc τη φορά — έλεγξε ότι δεν τρέχει ήδη άλλος πριν ξεκινήσεις.
- **N.15:** μετά την υλοποίηση → update ADR-408 changelog + μνήμη + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` στο ΙΔΙΟ commit.
- **N.11 i18n:** αν χρειαστούν strings (μάλλον όχι — pure geometry/commands), keys el+en ΠΡΙΝ τη χρήση.

---

## 0) ΚΑΤΑΣΤΑΣΗ REPO (πριν ξεκινήσεις)

**🟢 ΟΛΟΚΛΗΡΩΜΕΝΑ ΑΥΤΟ ΤΟ SESSION (ο Giorgio κάνει/έκανε commit — μην τα ξαναγγίξεις):**
1. **ADR-426 Slice 2** (Water-Supply auto-design preview+commit) — DONE + browser-verified (Generate/Accept/Reject, ghost, selection 2D+3D, contextual tab).
2. **Elevation-at-source fix** — ο auto-σχεδιασμός χτίζει το δίκτυο στο υψόμετρο του outlet της πηγής (~400mm) αντί στο default 2800mm. Αρχεία: `systems/mep-design/water/{water-source-resolve,water-design-types,design-water-supply,commit/build-water-supply-commit}.ts` + tests. Reuse `resolveMepConnectorElevationMmAt`.
3. **ADR-408 Φ-B2a EXT — tee/body propagation (DONE)** — επεκτάθηκε το `bim/mep-segments/mep-elevation-propagation.ts`: αλλαγή υψομέτρου τώρα παρασέρνει και κλάδους που ακουμπούν στη **ΜΕΣΗ** (body) ενός σωλήνα (όχι μόνο endpoint-to-endpoint). «Main = anchor». 12/12 tests. **ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΣΕΜΕΛΙΟ ΓΙΑ ΤΟ ΝΕΟ TASK.**

**🔴 ΤΟ ΝΕΟ TASK (αυτό το handoff): «Connectivity-Preserving Move».**

---

## 1) ΤΟ ΠΡΟΒΛΗΜΑ (confirmed με κώδικα αυτό το session)

Ο Giorgio: «όταν μετακινώ είδος υγιεινής / συλλέκτη, ή όταν μετακινώ σωλήνα, **αποκολλώνται** από το δίκτυο — δεν ακολουθούν / δεν τεντώνουν».

**Τι κάνει η Revit (η σωστή συμπεριφορά-στόχος):** το **συνδεδεμένο άκρο** ακολουθεί το στοιχείο που μετακινείς → ο σωλήνας **τεντώνει/λυγίζει** (αλλάζει ΜΗΚΟΣ), το άλλο άκρο μένει. **ΟΧΙ** ολική άκαμπτη μετακίνηση όλου του δικτύου. Αποσύνδεση μόνο όταν είναι γεωμετρικά αδύνατο (+ προειδοποίηση).

**Δύο πτυχές (ίδια λογική):**
| Ενέργεια | Σημερινό κενό |
|---|---|
| Μετακίνηση **host** (συλλέκτης/fixture/λέβητας/καλοριφέρ/θερμοσίφωνας) σε XY/Z/περιστροφή | τα άκρα σωλήνων που είναι κουμπωμένα στους connectors **δεν** ακολουθούν |
| Μετακίνηση **σωλήνα** (translate) | τα coincident άκρα γειτονικών σωλήνων **δεν** ακολουθούν → αποκόλληση |

---

## 2) ΤΙ ΥΠΑΡΧΕΙ ΣΗΜΕΡΑ (reuse surface — επιβεβαιωμένο)

- **`bim/mep-segments/mep-elevation-propagation.ts`** (ΤΟ ΣΕΜΕΛΙΟ):
  - `resolveConnectedElevationPatches(entities, edited, editedNext, tol?)` — endpoint + 3-way + **tee/body** (νέο), αλλά **ΜΟΝΟ για Z σε edit υψομέτρου** (δέχεται edited segment params).
  - `resolveManifoldConnectedPipePatches(entities, manifoldId, nextParams, tol?)` — συλλέκτης move **ΜΟΝΟ Z** (όπου outlet XY μένει σταθερό· δεν καλύπτει XY translate).
  - Pure helpers ήδη εκεί: `projectOnSegmentBodyParam`, `interpolateSegmentZMm`, `withEndpointZ`, `resolveAnchorElevationAt`, `dist2`.
- **`bim/mep-manifolds/mep-manifold-param-update.ts:71`** — `buildManifoldParamUpdate` → CompoundCommand (manifold update + pipe patches). Πρότυπο για «host update + connected pipe patches σε ΕΝΑ undo».
- **`hooks/grips/grip-parametric-centred-box-commits.ts`** — εδώ ζουν τα grip commits:
  - `commitMepManifoldGripDrag` (~164) — translate/rotate συλλέκτη, **ΣΚΕΤΟ** `UpdateMepManifoldParamsCommand`, **ΔΕΝ** παρασέρνει σωλήνες ← ΚΥΡΙΟ ΚΕΝΟ.
  - `commitMepManifoldOutletCountGrip` (~217) — ΕΧΕΙ pipe-follow (μέσω buildManifoldParamUpdate).
  - fixture grip commit (~68-97, `applyMepFixtureGripDrag` + `bim:mep-fixture-params-updated`) — **καμία** pipe-follow.
  - radiator/boiler commits (~252+) — όμοια κενά.
- **SSoT helpers:** `connectorWorldPosition` (mep-connector-types), `getEntityConnectors` (mep-systems/connector-access), `resolveMepConnectorElevationMmAt` (mep-segments/mep-connector-elevation), `resolvePipeJoinTolerance` (mep-systems/mep-pipe-network-derive), projection `getNearestPointOnLine` (rendering/entities/shared/geometry-utils).
- **Move command path** (αν η μετακίνηση δεν γίνεται μόνο με grips): ψάξε `MoveEntityCommand` / bim move για mep-segment & point hosts.

---

## 3) ΤΟ ΖΗΤΟΥΜΕΝΟ ΣΧΕΔΙΟ (πρότεινε στο Plan Mode — Revit-grade, max reuse)

**Πυρήνας:** ΕΝΑΣ γενικός pure resolver «host moved old→new transform → patch connected pipe endpoints». Λογική:
1. Υπολόγισε connector world positions **ΠΡΙΝ** (old params) και **ΜΕΤΑ** (new params) — XY **και** Z (μέσω `connectorWorldPosition` + `resolveMepConnectorElevationMmAt`).
2. Για κάθε pipe segment endpoint που ταιριάζει (within tol) με ένα **OLD** connector position → retarget στο αντίστοιχο **NEW** position (XY μετακίνηση του άκρου + Z). Ο σωλήνας τεντώνει (άλλο άκρο μένει).
3. Host = anchor, σωλήνες ακολουθούν (ποτέ αντίστροφα).
4. **Pipe move:** ανάλογος resolver — μετακινείς σωλήνα → coincident άκρα γειτόνων ακολουθούν (XY), με «main=anchor» για body-taps (ίδια αρχή με το tee fix αυτού του session).

**Wiring:** CompoundCommand (host/segment update + όλα τα pipe patches) σε ΕΝΑ undo — πρότυπο `buildManifoldParamUpdate`. Σύνδεσε σε **όλα** τα grip commits (manifold/fixture/radiator/boiler/water-heater) + το generic move command.

**Αποφάσεις Revit (πάρ' τες εσύ):**
- Match σε OLD connector position, retarget σε NEW (όχι «nearest» — ακριβές tracking).
- XY + Z + rotation όλα μέσω connector-world-position delta (η περιστροφή αλλάζει τα connector XY → καλύπτεται φυσικά).
- Πολλαπλά άκρα στον ίδιο connector → όλα ακολουθούν.
- Tolerance: `resolvePipeJoinTolerance(entities)` (unit-aware).

**Παραδοτέο Plan:** γενικός resolver (πιθανόν NEW `mep-move-propagation.ts` ή επέκταση `mep-elevation-propagation.ts` → ίσως rename σε `mep-connectivity-propagation.ts` με Boy-Scout), λίστα grip-commit wirings, CompoundCommand pattern, tests, ADR-040 staging (τα grip-commit αρχεία ΔΕΝ είναι canvas micro-leaf αλλά **έλεγξε CHECK 6D** — αν αγγίξεις canvas/drawing αρχείο, stage ADR), N.15 updates. **Πρότεινε incremental** (π.χ. Φ-C1 host-move, Φ-C2 pipe-move).

---

## 4) ΤΙ ΝΑ ΜΗΝ ΚΑΝΕΙΣ
- ΜΗ γράψεις κώδικα πριν την έγκριση του plan.
- ΜΗΝ ξαναγγίξεις τα DONE του §0 (ADR-426 Slice 2 / elevation-at-source / tee-fix).
- ΜΗΝ commit/push/adr-index (Giorgio). ΜΗΝ `git add -A`.
- ΜΗΝ σπάσεις την υπάρχουσα elevation propagation (12 tests πρέπει να μείνουν πράσινα).
- ΜΗΝ τρέξεις 2ο tsc αν τρέχει ήδη (N.17).

## 5) ΠΡΩΤΗ ΕΝΕΡΓΕΙΑ (νέα session, Opus)
1. Διάβασε αυτό το handoff + `bim/mep-segments/mep-elevation-propagation.ts` (το σεμέλιο + το tee EXT) + `hooks/grips/grip-parametric-centred-box-commits.ts`.
2. Επιβεβαίωσε signatures (connectorWorldPosition, getEntityConnectors, resolveMepConnectorElevationMmAt, buildManifoldParamUpdate pattern, grip commit δομή).
3. **Μπες Plan Mode** → σχεδίασε τον γενικό «move → connected ends follow» resolver + wiring. Παρουσίασε plan για έγκριση.
4. Μετά έγκριση → υλοποίηση + tests + ADR-408 changelog + N.15. Browser-verify με τον Giorgio.

## 6) ΜΕΤΑ ΑΠΟ ΑΥΤΟ
Συνέχεια με τον **ADR-423** (MEP Auto-Design framework) — επόμενες disciplines (αποχέτευση → θέρμανση → …) μετά την ύδρευση pilot (ADR-426). Δες μνήμες `project_adr423_mep_auto_design`, `project_adr426_water_supply_auto_design`, `project_adr425_stage0_recognition`.
