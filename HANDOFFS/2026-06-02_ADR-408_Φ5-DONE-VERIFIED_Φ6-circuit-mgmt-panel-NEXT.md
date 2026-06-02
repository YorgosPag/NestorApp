# HANDOFF — ADR-408 MEP Connectors & Systems
**Φ5 (Circuit UI + colour-by-system + reconciliation) DONE + ✅ BROWSER-VERIFIED + COMMITTED · Φ6 Circuit-Management Panel = NEXT**
Ημερομηνία: 2026-06-02 · Μοντέλο: Opus 4.8 · Mode: Plan→Implement

---

## §0 — ΚΡΙΣΙΜΟΙ ΚΑΝΟΝΕΣ (διάβασέ τους ΠΡΩΤΑ)

- 🚫 **COMMIT/PUSH τα κάνει Ο GIORGIO, ΟΧΙ ο agent** (N.(-1)). Μην κάνεις commit μόνος σου.
- 🚫 **ΠΟΤΕ `--no-verify`** (N.(-1.1)). Αν κολλήσει pre-commit hook → ανάφερε, μη bypass.
- ⚠️ **SHARED WORKING TREE** — δουλεύει ΚΑΙ άλλος agent (railings/beam/grips) ταυτόχρονα. **ΠΟΤΕ `git add -A`**. Μόνο specific `git add <file>` + `git diff --cached` πριν από οτιδήποτε. (Incident: στο Φ5 αρχεία μου σαρώθηκαν σε commits άλλου agent με `git add -A` — τίποτα δεν χάθηκε, αλλά commit boundaries μπερδεύτηκαν.)
- 🌐 Απαντάς **στα Ελληνικά** πάντα (LANGUAGE RULE).
- 📋 N.14 (δήλωσε μοντέλο) + N.8 (execution mode) πριν γράψεις κώδικα. N.0.1 ADR-driven (code=SoT). N.15 (ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+adr-index+memory μαζί).

---

## §1 — ΤΙ ΕΓΙΝΕ (Φ5 — DONE, VERIFIED, COMMITTED)

MEP «σαν Revit» σε επίπεδα: ADR-405 disciplines → ADR-406 φωτιστικό → ADR-408 connectivity backbone (Φ1+Φ2) → Φ3 ηλεκτρικός πίνακας (circuit «πηγή») → Φ4 ακεραιότητα (cascade/undo) → **Φ5 UI ανάθεσης + colour-by-system + reconciliation**.

**Αποφάσεις Giorgio:** Plan Mode σειριακά · **FULL ENTERPRISE / FULL SSoT, Revit-grade** · το **System κατέχει το χρώμα του** (persisted, editable).

**Υλοποιήθηκε (3 κομμάτια):**
- **Φ5.A Create-circuit UI:** `MepSystemParams.color?` (persisted hex, `.strict()` Zod +regex· Firestore rules valid-άρουν μόνο top-level → **zero** αλλαγή rules/indexes). NEW `bim/mep-systems/mep-system-color.ts` (παλέτα + `pickNextSystemColor` least-used + `buildEntitySystemColorIndex`/`resolveEntitySystemColor` + `hexToThreeInt`/`buildEntitySystemColorIntIndex`/`hexToRgba` + memo `getEntitySystemColorIndexCached`). NEW `bim/mep-systems/mep-circuit-from-selection.ts` (`resolveCircuitFromSelection`: source=πίνακας `flow:'out'` + members=φωτιστικά `flow:'in'` + **Revit single-circuit reassign**· **canonical-id fallback** για legacy entities χωρίς connector· typed errors). NEW `core/commands/entity-commands/CreateMepSystemCommand.ts` (inverse Dissolve· pre-minted enterprise id· `execute/redo→mutator.createSystem`, `undo→dissolve`)· `MepSystemMutator += createSystem`· `useMepSystemPersistence` shared `persistSystemEntity` + `createSystemEntity`. Ribbon (clone beam): NEW `ui/ribbon/data/contextual-mep-circuit-tab.ts` + `ui/ribbon/hooks/bridge/mep-circuit-command-keys.ts` + `ui/ribbon/hooks/useRibbonMepCircuitBridge.ts` (`CompoundCommand(create + reassign UpdateMepSystemParamsCommand)`→executeCommand)· trigger `app/ribbon-contextual-config.ts` (≥1 πίνακας ΚΑΙ ≥1 φωτιστικό)· wired `useDxfBimBridges`/`useDxfViewerRibbon`/`useRibbonCommands`· EventBus `bim:mep-circuit-created`/`-failed`→`useDxfViewerNotifications` toasts· i18n el+en.
- **Φ5.B Reconciliation:** NEW `hooks/data/useMepConnectorReconciliation.ts` (subscribe `useMepSystemStore`+scene → `buildConnectorSystemIndex`→`reconcileEntityConnectors` ανά fixture/panel → ΕΝΑ `setLevelScene` μόνο σε diff· **idempotent**, referential-stable → κανένα render loop· **SCENE-ONLY, όχι Firestore** — derived cache)· mount `MepSystemPersistenceHost`.
- **Φ5.C Colour-by-system:** **ΜΟΝΟ τα φωτιστικά-μέλη χρωματίζονται· ο ΠΙΝΑΚΑΣ-πηγή ΟΧΙ** (research-backed: Revit Electrical Equipment δεν παίρνει circuit colour — κοινή πηγή πολλών· `buildEntitySystemColorIndex` χαρτογραφεί μόνο `members[].entityId`). 2D `MepFixtureRenderer` (ADR-040 leaf, `getState()` zero-sub). 3D `SyncContext.systemColorIndex` + `BimSceneLayer.buildContext` + `fixtureToMesh +systemColor?` + NEW `getSystemTintedMaterial3D` (cache per `${type}:${colorInt}`, **ΠΟΤΕ** mutate singleton) + `use-bim3d-vg-resync` sub(d). `ElectricalPanelRenderer`/`panelToMesh`/`syncPanels` ΔΕΝ χρωματίζονται (πίνακας μένει equipment teal).

**✅ Browser-verified (Giorgio):** create-circuit · χρωματισμός φωτιστικών ανά κύκλωμα (μπλε/κόκκινο) · πίνακας σταθερό teal · reassign (μετακίνηση μέλους σε νέο κύκλωμα) · coherent single-undo · toast i18n.

**Verify:** tsc **0** · **124/124 MEP tests PASS** (22 νέα). ⚠️ 25 pre-existing wall-fixture 3D failures = ΟΧΙ regression (επιβεβαιωμένο: μηδέν αναφορά MEP/color στα failures). **COMMITTED** (e41653ef CreateMepSystemCommand · 4c5eb12a reconciliation · ee035b12 3D color+schemas · d8f9d109 tint tests+docs · 5df492b0 circuit refinements + κάποια σαρωμένα σε commits άλλων).

**Post-verify διορθώσεις (browser):** (1) legacy-safe create (canonical-id fallback)· (2) toast `created` → απλό i18n key (plural δεν resolve-άριζε runtime· locale JSON θέλει **full restart** dev server, όχι F5)· (3) πίνακας ΟΧΙ χρωματισμένος.

📘 ADR: `docs/centralized-systems/reference/adrs/ADR-408-mep-connectors-and-systems.md` (§Implementation Φ5 + changelog). ADR-040 changelog (Φ5.C micro-leaf compliance).

---

## §2 — ΕΤΟΙΜΑ BUILDING BLOCKS ΓΙΑ ΤΟ Φ6 (μην τα ξαναφτιάξεις!)

- **Command (undoable, έτοιμο):** `UpdateMepSystemParamsCommand(systemId, nextParams, prevParams, isDragging?)` — patch params (name / color / members) μέσω mutator port. **Αυτό καταναλώνει το Φ6.**
- **Mutator port:** `getMepSystemMutator()` → `updateSystemParams` / `createSystem` / `dissolveSystem` / `restoreSystem` (registered από `useMepSystemPersistence`).
- **Store:** `useMepSystemStore` → `getSystems()` / `subscribe` (read consumers). EventBus: `bim:mep-system-changed`.
- **Colour SSoT:** `mep-system-color.ts` → `MEP_SYSTEM_PALETTE` (για colour picker), `pickNextSystemColor`, `systemColor(system)`.
- **Reverse-lookups (pure):** `mep-system-coordinator.ts` → `buildConnectorSystemIndex`, `findSystemMembershipsByEntity(entityId, systems)` (βρες σε ποιο κύκλωμα ανήκει ένα φωτιστικό), `resolveMepCascadeOnDelete`.
- **Selection→circuit:** `mep-circuit-from-selection.ts` → `resolveCircuitFromSelection` (reuse για «πρόσθεσε επιλεγμένα φωτιστικά»).
- **Ribbon εκκίνηση:** `contextual-mep-circuit-tab.ts` (action-only τώρα: create/close) + `useRibbonMepCircuitBridge.ts` (εδώ προστίθενται τα νέα controls/actions· clone beam combobox/textbox pattern). Command-keys: `mep-circuit-command-keys.ts`.
- **i18n:** namespace `dxf-viewer-shell`· keys `mepCircuit.*` (top-level toasts) + `ribbon.tabs/panels/commands.mepCircuit.*`. **ΠΡΩΤΑ locales, μετά κώδικας (N.11). Απλά keys, ΟΧΙ plural `_one`/`_other`** (δεν resolve-άρισε runtime).

---

## §3 — ΕΠΟΜΕΝΗ ΦΑΣΗ: Φ6 — Circuit-Management Panel (rename / colour-edit / add-remove member)

**Στόχος:** ο χρήστης διαχειρίζεται **υπάρχον** κύκλωμα — μετονομασία, αλλαγή χρώματος, προσθήκη/αφαίρεση μελών — μέσω undoable `UpdateMepSystemParamsCommand` (ΗΔΗ έτοιμο). Κλείνει το MEP UX «όπως Revit System Browser / Electrical Circuits properties».

**🔴 ΣΧΕΔΙΑΣΤΙΚΕΣ ΑΠΟΦΑΣΕΙΣ ΠΡΟΣ GIORGIO (AskUserQuestion στη νέα συνεδρία — ΜΗΝ προαποφασίσεις):**
1. **Πού ζει το UI;** (α) Επέκταση του υπάρχοντος contextual ribbon tab «Ηλεκτρικό Κύκλωμα» με controls (name textbox + colour combobox από `MEP_SYSTEM_PALETTE` + add/remove member actions)· (β) ξεχωριστό side-panel/δέντρο «System Browser» (panels→circuits→devices, πιο Revit αλλά μεγαλύτερο)· (γ) properties dialog.
2. **Πώς επιλέγεις ΠΟΙΟ κύκλωμα;** Πιθανό: επίλεξε ένα φωτιστικό-μέλος → `findSystemMembershipsByEntity` βρίσκει το κύκλωμά του → contextual tab δείχνει τα properties του. (Σήμερα το tab εμφανίζεται μόνο σε πίνακας+φωτιστικό για create.)
3. **Colour picker:** dropdown από την `MEP_SYSTEM_PALETTE` (12 χρώματα) ή full colour picker; (Πρόταση: παλέτα — συνεπές με auto-assign.)
4. **Add member:** «πρόσθεσε τα επιλεγμένα φωτιστικά στο τρέχον κύκλωμα» (reuse `resolveCircuitFromSelection` λογική + reassign). **Remove member:** κουμπί ανά μέλος ή «αφαίρεσε επιλεγμένα».

**Υλοποίηση (όλα μέσω `UpdateMepSystemParamsCommand` → undoable):**
- rename: `nextParams = { ...prev, name }`.
- colour: `nextParams = { ...prev, color }` → colour-by-system resync αυτόματο (`use-bim3d-vg-resync` sub(d) + 2D leaf reads store).
- add/remove member: `nextParams = { ...prev, members: [...] }` + reassign-removal αν το μέλος ήταν αλλού (CompoundCommand, μοτίβο Φ5.A).

**ΠΡΟΣΟΧΕΣ (SSoT — μη το σπάσεις):** System κατέχει `members[]`+`color`· `connector.systemId`=derived cache· **ο πίνακας-πηγή ΔΕΝ χρωματίζεται** (μην το προσθέσεις ξανά στο color index)· colour resolver/index = ένα SSoT (`mep-system-color.ts`).

---

## §4 — ΥΠΟΛΟΙΠΟ ROADMAP (μετά το Φ6)

- **Φ7 — Ορατά καλώδια/οδεύσεις** (Revit home-run wires) — λογική όδευση πίνακα↔φωτιστικών, 2D annotation layer (+ προαιρετικά 3D conduit). Μεγάλο, δικό του Plan Mode/ADR section.
- **Seed connector σε legacy φωτιστικά** (μικρό) — ώστε το reconciliation να γράφει `connector.systemId` ΚΑΙ σε legacy (τώρα παίρνουν χρώμα μέσω entityId-index αλλά όχι connector cache, αφού δεν έχουν embedded connector).
- **«Colour by system» view toggle** (Revit view setting) — τώρα always-on.
- **duct/pipe domains & systems** — reserved στα types, no pipeline.

---

## §5 — VERIFY ΕΝΤΟΛΕΣ
```
npx jest "mep-system" "mep-circuit" "mep-connector" "electrical-panel" "mep-fixture"
npx tsc --noEmit
```
Για Φ6: tests για update-name/colour/add-remove member (UpdateMepSystemParamsCommand + reassign), ribbon bridge controls. Pre-commit: file ≤500 / func ≤40 (CHECK 4)· i18n keys σε el+en (CHECK 3.8, απλά keys)· αν αγγίξεις micro-leaf → stage ADR-040 (CHECK 6B/6D).
**Browser (🔴 Giorgio):** επίλεξε κύκλωμα → rename → χρώμα αλλάζει live (2D+3D) → add/remove μέλος → Ctrl+Z αναιρεί. **full restart dev server** για i18n αλλαγές.
