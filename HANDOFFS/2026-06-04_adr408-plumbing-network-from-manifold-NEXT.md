# HANDOFF — ADR-408 Φ13: Δίκτυο Ύδρευσης από Συλλέκτη (Plumbing Network from Manifold) — NEXT

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus. **Σχετικό ADR:** `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md`
**Πρότυπο 1:1:** Ηλεκτρικό circuit-from-selection (Φ5.A) + circuit-management panel (Φ6).

---

## ⚠️ ΠΛΑΙΣΙΟ (ΜΗΝ το αγνοήσεις)
- 🌐 **Ελληνικά πάντα.**
- 🚫 **COMMIT/PUSH μόνο ο Giorgio.** Ποτέ εσύ. Ποτέ `--no-verify`.
- 🌳 **SHARED working tree** με άλλον agent (ADR-415 floorplan-symbol). `git add` **ΜΟΝΟ δικά σου**· **ΠΟΤΕ** `-A`. **ΜΗΝ αγγίξεις adr-index** (shared).
- 🔬 tsc: `NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit 2>&1 | grep "error TS"`. **Γνωστό non-mine error (ΑΓΝΟΗΣΕ):** `mesh-to-object3d.ts:124` (string-not-narrow, προϋπάρχον). ⚠️ /tmp ΔΕΝ persist-άρει μεταξύ Bash invocations — κάνε `tee /dev/stderr` αντί redirect σε /tmp.
- 🧪 Bash tool = bash. Test scene units = **cm/mm**. Firebase project = **pagonis-87766**.

---

## ✅ ΤΙ ΕΓΙΝΕ ΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ADR-408 Φ12 — Συλλέκτης, pending commit ΑΠΟ GIORGIO)

**Φ12 Plumbing Manifold (Συλλέκτης ύδρευσης) DONE** — Plan Mode + 8 subagents. Νέο point-based BIM entity «σαν Revit Plumbing Equipment» = πηγή διανομής ύδρευσης, καθρέφτης 1:1 του Ηλεκτρικού Πίνακα (Φ3).

- EntityType `'mep-manifold'`, kind `'floor-manifold'`, rectangular μπάρα, BimCategory `'mep-manifold'`→**plumbing**, IfcType `IfcPipeFitting`, prefix `'mfld'`, collection `FLOORPLAN_MEP_MANIFOLDS`.
- **Connectors:** 1 inlet (`m-in`, flow `in`) + N outlets (`m-out-0..N`, flow `out`, default 4, MAX 12), domain `pipe`, classification `domestic-cold-water`. SSoT `buildMepManifoldConnectors(params)` (καλείται completion + seed). Snap μέσω `MepConnectorSnapEngine` (+`isMepManifoldEntity` στον point-host κλάδο).
- floor-mounted units-safe `manifoldToMesh` (stair `sceneUnitsToMeters`). Grips = reuse `centred-box-grips` SSoT (μηδέν fork). Source → **ΔΕΝ tint-άρεται** (members-only color index).
- ~22 NEW files + ~40 registrations σε 15 κατηγορίες. **tsc 0 δικά μου**· 39 νέα tests + 178 MEP regression + 487 grip/ghost/bounds PASS. Boy-Scout: διόρθωσα stale `bim-discipline.test.ts`.
- **✅ firebase rules+indexes DEPLOYED** στο pagonis-87766 (rules released + 2 manifold indexes).
- N.15 docs ενημερωμένα: ADR-408 changelog (Φ12 entry) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (Φ12) + memory `project_adr408_phi12_plumbing_manifold.md` + MEMORY.md. **ΟΧΙ** adr-index.

### 🔴 ΕΚΚΡΕΜΗ από Φ12 (πριν προχωρήσεις, ΕΠΙΒΕΒΑΙΩΣΕ με Giorgio):
1. **Browser verify SNAP** — ο Giorgio επιβεβαίωσε place/select/grips(move/rotate/4 corners)/delete-undo/persist-after-refresh. **ΔΕΝ** έχει επιβεβαιώσει ακόμη το **snap σωλήνα στους outlet/inlet connectors** (◇ diamond). Αυτό είναι το core του slice — ζήτησέ του να το τσεκάρει αν δεν το έκανε.
2. **Commit Φ12** (ο Giorgio). Shared tree — μην committάρεις εσύ.
3. **ΓΝΩΣΤΟ DEFERRED:** ο συλλέκτης ΔΕΝ έχει contextual «Ιδιότητες» tab ακόμη (όπως και οι σωλήνες Φ8). Είναι σκόπιμο — μέρος του παρόντος Φ13.

---

## 🎯 ΕΠΟΜΕΝΟ ΘΕΜΑ (απόφαση Giorgio): ΔΙΚΤΥΟ ΥΔΡΕΥΣΗΣ ΑΠΟ ΣΥΛΛΕΚΤΗ — ADR-408 Φ13

**Εντολή Giorgio:** «Δίκτυο ύδρευσης από συλλέκτη» (option 3). FULL ENTERPRISE + FULL SSOT.

### Τι είναι (Revit)
Επιλέγεις τον **συλλέκτη + τους σωλήνες** που τροφοδοτεί → δημιουργείς ένα **plumbing `MepSystem`** (systemType `'pipe-network'`) με **source = ο συλλέκτης** (outlet connector) και **members = οι σωλήνες**. Όπως ο Ηλεκτρικός Πίνακας είναι source ενός electrical circuit (Φ5.A), ο Συλλέκτης είναι source ενός δικτύου ύδρευσης. Color-by-system: τα members (σωλήνες) χρωματίζονται· ο συλλέκτης (source) ΔΕΝ tint-άρεται.

### Αρχιτεκτονική — **καθρέφτης Φ5.A (electrical circuit-from-selection) + Φ6 (management panel)**
Ο κορμός είναι **ΗΔΗ domain-agnostic** (Φ9/Φ10 ΣΤΡΩΜΑ Α έκανε το `MepSystemParams` discriminated union σε `systemType`). Επαναχρησιμοποίησε:
- **MepSystem pipe-network:** `bim/types/mep-system-types.ts` (`MepPipeSystemParams`, `systemType:'pipe-network'`, `buildDefaultPipeNetworkParams`, `isPipeSystemParams`). ΗΔΗ υπάρχει.
- **CreateMepSystemCommand** (entity-agnostic — δέχεται `sourceEntityId`/`sourceConnectorId`/`members`). ΗΔΗ υπάρχει.
- **Selection resolver:** NEW `bim/mep-systems/mep-pipe-network-from-selection.ts` — mirror του `mep-circuit-from-selection.ts` (`resolveCircuitFromSelection`): source = ο επιλεγμένος `mep-manifold` (το outlet connector του, flow `out`)· members = τα επιλεγμένα `mep-segment` domain `pipe`. Reassign όπως το electrical.
- **Auto-derive ΗΔΗ υπάρχει:** `bim/mep-systems/mep-pipe-network-derive.ts` `derivePipeNetworks` (union-find, picks lex-smallest segment seg-start ως source — **manifold-agnostic**). Η Φ13 προσθέτει την **explicit manifold-as-source** διαδρομή (selection-based, σαν Revit) + προαιρετικά: όταν υπάρχει manifold στο connected component, αυτός γίνεται ο source αντί του lex-smallest segment.
- **Reconciliation:** `useMepConnectorReconciliation` ΗΔΗ γράφει `connector.systemId` (System→connector). Επιβεβαίωσε ότι ο manifold outlet παίρνει σωστά το systemId.
- **UI:** mirror `ui/ribbon/data/contextual-mep-circuit-tab.ts` + `useRibbonMepCircuitBridge` + `mep-circuit-editor.ts`/`mep-circuit-editor-store.ts` (Φ6 management panel: rename/colour/add-remove member μέσω `UpdateMepSystemParamsCommand`). Action «Δημιουργία δικτύου ύδρευσης» όταν επιλεγεί συλλέκτης (+σωλήνες). Επίσης η υπάρχουσα action «Δίκτυα σωλήνων» (auto-derive, `mepCircuit.actions.deriveNetworks`) μπορεί να μείνει ως «auto» mode.

### ⚠️ ΜΑΘΗΜΑΤΑ (μην τα ξαναπατήσεις)
- **Κορμός domain-agnostic** — μην κάνεις fork· narrowing μέσω `systemType` guards (`isPipeSystemParams` vs `isElectricalSystemParams`). Electrical-only πεδία (wireStyle/waypoints/conductors) ΔΕΝ ισχύουν για pipe-network.
- **«1:1 mirror» = κίνδυνος διπλότυπου** (μάθημα grips). Έλεγξε ΠΡΙΝ copy αν υπάρχει domain-agnostic SSoT να επεκταθεί (π.χ. `mep-circuit-editor` ίσως γενικεύεται σε `mep-system-editor`).
- **Source ΔΕΝ tint-άρεται** (members-only `buildEntitySystemColorIndex`) — μην προσθέσεις τον manifold στα members.
- Snap ήδη δουλεύει (Φ12). Αν «δεν κουμπώνει» μετά από re-render → θυμήσου το ADR-040 `useGlobalSnapSceneSync` fix (cleanup μόνο σε unmount).
- Radix Select no-value = `SELECT_CLEAR_VALUE`, ΟΧΙ `''`.

### 🚦 Execution mode (N.8)
Πιθανώς **Plan Mode** (κορμός υπάρχει· ~8-15 αρχεία, 1-2 domains). Αν διογκωθεί (>15 αρχεία) → ρώτησε Giorgio για Orchestrator. Ξεκίνα με **Recognition**: διάβασε `mep-circuit-from-selection.ts` + `contextual-mep-circuit-tab.ts` + `mep-circuit-editor.ts` + `mep-pipe-network-derive.ts` + `mep-system-types.ts` (pipe arm).

### 🔑 ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
- Electrical πρότυπο: `bim/mep-systems/mep-circuit-from-selection.ts`, `ui/ribbon/data/contextual-mep-circuit-tab.ts`, `bim/mep-systems/mep-circuit-editor.ts` + `-store.ts`, `useRibbonMepCircuitBridge`.
- Pipe foundation: `bim/mep-systems/mep-pipe-network-derive.ts`, `bim/types/mep-system-types.ts` (pipe arm) + `.schemas.ts`.
- Manifold (Φ12): `bim/types/mep-manifold-types.ts`, `bim/mep-manifolds/*`, `isMepManifoldEntity`, connectors `m-in`/`m-out-N`.
- System core: `CreateMepSystemCommand`, `UpdateMepSystemParamsCommand`, `useMepConnectorReconciliation`, `bim/mep-systems/mep-system-store.ts`, `mep-system-color.ts`.

### 🟡 Προαιρετικά follow-ups (ρώτησε Giorgio αν μπουν στο ίδιο Φ ή ξεχωριστά)
- Contextual «Ιδιότητες Συλλέκτη» tab (outletCount/διάμετροι/elevation από panel — deferred από Φ12).
- Contextual props tab για σωλήνες (mep-segment Φ8 — επίσης deferred).
- Φ14: system browser / sizing.
