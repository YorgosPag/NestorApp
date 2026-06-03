# HANDOFF — ADR-408 Φ7/Φ5 roadmap: Seed legacy connectors (NEXT)

**Ημερομηνία:** 2026-06-03
**Από:** Opus 4.8 session (colour-by-system toggle + per-circuit edit από φωτιστικό + RibbonRoot fix)
**Προς:** επόμενη συνεδρία
**Γλώσσα απαντήσεων:** Ελληνικά πάντα (CLAUDE.md LANGUAGE RULE)

---

## 0. ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)
- ⚠️ **Working tree μοιράζεται με άλλον agent** (ADR-410/ADR-411 mesh/furniture work σε εξέλιξη) → `git add` ΜΟΝΟ specific αρχεία, **ΠΟΤΕ `git add -A`**.
- ⚠️ **Commit/push τα κάνει Ο GIORGIO, ΟΧΙ ο agent** (N.(-1)). Μην κάνεις commit ποτέ χωρίς ρητή εντολή.
- N.14 model gate: δήλωσε μοντέλο & περίμενε «ok» πριν μη-τετριμμένη υλοποίηση.
- N.15: μετά την υλοποίηση ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ + ADR-408 + adr-index (αν χρειαστεί) + memory (ίδιο commit).
- ADR-040: το seed πιθανότατα ΔΕΝ αγγίζει micro-leaf/canvas αρχεία (state/coordinator hook) → ΕΚΤΟΣ CHECK 6B/6D. Επιβεβαίωσε αν τελικά αγγίξεις renderer.

---

## 1. ΚΑΤΑΣΤΑΣΗ — τι έγινε (ΟΛΑ pending commit, ✅ browser-verified από Giorgio)
Αυτή η συνεδρία ολοκλήρωσε **3 items** στο shared tree (uncommitted, ο Giorgio θα κάνει commit):

1. **🟢 Φ7 colour-by-system View toggle** — View-tab ON/OFF master switch (Revit «Color circuits by system»). NEW `colorBySystem` flag (default true) στο `bim-render-settings` SSoT· 4 gates (2D fixture/wire + 3D fixture/wire)· `DEFAULT_WIRE_COLOR='#b45309'`· NEW `ColorBySystemToggle.tsx`. STAGE ADR-040. ✅ verified.
2. **🟢 Φ7 per-circuit edit από φωτιστικό** — select φωτιστικό → panel «Κύκλωμα» στο fixture tab (όνομα + colour swatch) + button «Επεξεργασία Κυκλώματος» → select πίνακα-πηγή → circuit tab (manage). NEW `RibbonMepFixtureCircuitWidget.tsx`· bridge `editCircuit`/`hasCircuit`. ✅ verified.
3. **🐛 RibbonRoot auto-activation fix** — γενικό ribbon bug: `contextual→ΑΛΛΟ contextual` μετάβαση πήγαινε στο «Αρχική» (το `activeTabId` έμενε σε εξαφανισμένο tab). FIX στο `RibbonRoot.tsx` effect (activate πρώτο visible contextual εκτός αν ήδη ενεργό). ✅ verified.

Όλα: tsc 0 (δικά μου), MEP tests PASS. ⚠️ 25 pre-existing wall-attach 3D failures (`syncWalls` topBinding, ADR-401/404 άλλου agent) = ΟΧΙ regression. ⚠️ 2 pre-existing tsc errors άλλου agent (`mesh-to-object3d.ts:124`, `furniture-gltf-cache.ts:81 bumpFurnitureAssetVersion` — ADR-410/411) — ΟΧΙ δικά μου.

Μετά από αυτό, ο κορμός ADR-408 «MEP σαν Revit» (electrical) είναι ουσιαστικά πλήρης — μένει ΜΟΝΟ το seed legacy connectors.

---

## 2. ΕΠΟΜΕΝΗ ΕΡΓΑΣΙΑ — Seed legacy connectors (τελευταίο Φ7/Φ5 roadmap item)

### Πρόβλημα (Φ5 caveat)
Φωτιστικά/πίνακες που **φτιάχτηκαν πριν** το connector model (Φ1/Φ2) **δεν έχουν** `params.connectors`. Συνέπεια:
- **Χρώμα** δουλεύει (το `buildEntitySystemColorIndex` είναι entityId-based — δεν χρειάζεται connector).
- **ΑΛΛΑ** το `connector.systemId` derived cache + πλήρης reconciliation (`reconcileEntityConnectors`) **δεν** εφαρμόζονται (δεν υπάρχει connector να γράψεις το cache).
- Create-circuit ΗΔΗ δουλεύει σε legacy μέσω canonical-id fallback (`findMemberConnectorId` → `FIXTURE_POWER_CONNECTOR_ID`), αλλά αυτό είναι patch — το seed κλείνει το κενό στη ρίζα.

### Στόχος
Κάθε connector-host (fixture/panel) **χωρίς** embedded default connector να αποκτά τον default του, ώστε να συμμετέχει πλήρως σε reconciliation / wire-routing / `connector.systemId` cache — όπως ένα νέο φωτιστικό. **Idempotent.** FULL ENTERPRISE + FULL SSOT (όπως όλο το ADR-408).

### Έτοιμα building blocks (reuse, ΜΗΝ ξαναγράψεις)
- `bim/types/mep-connector-types.ts`:
  - `buildDefaultLightingConnector()` → fixture connector, `connectorId = FIXTURE_POWER_CONNECTOR_ID = 'c1'` (flow 'in').
  - `buildDefaultPanelOutgoingConnector()` → panel connector, `connectorId = PANEL_OUT_CONNECTOR_ID = 'c1'` (flow 'out').
  - `connectorWorldPosition(...)` — derived θέση από host position/rotation.
- `bim/mep-systems/connector-access.ts`: `getEntityConnectors(entity)` / `isMepConnectorHost(entity)` (SSoT accessors, ήδη καλύπτουν fixture+panel).
- `hooks/data/useMepConnectorReconciliation.ts` — **ΤΟ ΠΡΟΤΥΠΟ**: scene-only, idempotent, `getLevelScene→map→setLevelScene μόνο σε diff`, subscribe systems+scene, μηδέν render loop. Το seed είναι ο **αδελφός** του (seed missing connector → μετά reconcile systemId).
- `bim/mep-systems/mep-system-coordinator.ts`: `buildConnectorSystemIndex` / `reconcileEntityConnectors` (το reconciliation που τρέχει ΜΕΤΑ το seed).
- Persistence: `useMepFixturePersistence` / `useElectricalPanelPersistence` (diff-merge· ΠΡΟΣΟΧΗ: ήδη υπάρχει `projectConnectorSystemIds` που αγνοεί το doc's systemId — System-wins· βλ. idle ping-pong fix στο memory).

### Ανοιχτή ΑΠΟΦΑΣΗ (Revit-faithful — ρώτησε Giorgio με AskUserQuestion στο Plan Mode)
**Scene-only seed vs persisted migration:**
- **(A) Scene-only** (πρότυπο reconciliation): inject default connector στο scene entity κατά το load· ΟΧΙ Firestore write· re-seeds κάθε load (idempotent). Ο connector είναι deterministic default derivable από host → rendering/routing/reconciliation δουλεύουν. **Μηδέν migration/write risk.** ← προτεινόμενο default.
- **(B) Persisted one-time backfill**: γράψε τον default connector πίσω στο Firestore μία φορά. Πιο «σωστό» data-wise αλλά: write + migration concern + companyId/rules + idle-loop κίνδυνος (προσοχή στο diff-merge — ο connector ΧΩΡΙΣ systemId πρέπει να μη re-trigger-άρει). 
- Ίσως **υβριδικό**: scene-only seed τώρα (ασφαλές), persisted backfill ως ξεχωριστό optional βήμα. Άσε τον Giorgio να διαλέξει.

### Πιθανή υλοποίηση (μετά την απόφαση)
- NEW pure helper στο coordinator (ή νέο `mep-connector-seed.ts`): `seedDefaultConnectors(entity): Entity` — αν `isMepConnectorHost(entity)` ΚΑΙ `getEntityConnectors(entity).length === 0` → επέστρεψε entity με τον σωστό default connector (fixture vs panel)· αλλιώς **same ref** (idempotent).
- Scene-only: NEW `useMepConnectorSeed` hook (mirror reconciliation) **Ή** fold μέσα στο `useMepConnectorReconciliation` (seed-then-reconcile σε ΕΝΑ pass — λιγότερα setLevelScene). Προτίμησε ΕΝΑ pass.
- Mount όπου ήδη mount-άρει το reconciliation (`MepSystemPersistenceHost` / αντίστοιχο).
- Tests: pure `seedDefaultConnectors` (fixture seeds c1 in· panel seeds c1 out· host-με-connector → same ref· non-host → same ref)· integration idempotency (2× → ίδιο ref, μηδέν loop).

### Reuse / templates
- Hook template: `useMepConnectorReconciliation.ts` (scene-only idempotent pattern).
- Builders: `buildDefaultLightingConnector` / `buildDefaultPanelOutgoingConnector`.
- Accessors: `getEntityConnectors` / `isMepConnectorHost`.

### Verify (browser)
Φόρτωσε σχέδιο με **legacy** φωτιστικό/πίνακα (χωρίς connector). Μετά το seed: create-circuit + colour-by-system + home-run wire να δουλεύουν πλήρως· `connector.systemId` cache να γεμίζει· καμία re-render loop σε ηρεμία (έλεγξε το idle — βλ. idle ping-pong fix).

### N.15 (ίδιο commit με κώδικα)
ADR-408 changelog + roadmap (seed → DONE) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr408_mep_connectors_systems.md` (+ MEMORY.md index line).

---

## 3. ΥΠΟΛΟΙΠΟ roadmap (μετά από αυτό)
- duct/pipe domains & systems (reserved στους τύπους, **χωρίς pipeline** — μεγάλο νέο frontier, orchestrator-tier).

## 4. Πηγή αλήθειας = ο κώδικας
Τα file pointers επιβεβαιώθηκαν με grep αυτή τη συνεδρία, αλλά επανέλεγξε πριν γράψεις (shared tree αλλάζει).
