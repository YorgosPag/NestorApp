# HANDOFF — ADR-479 Slice 2/2b/2c: browser-verify + commit

**Ημ/νία:** 2026-06-18 · **Γλώσσα:** ΠΑΝΤΑ Ελληνικά. **commit/push/tsc = Giorgio.**
**Shared tree** — git add ΜΟΝΟ δικά μας, ΠΟΤΕ `-A`.

## ΚΑΤΑΣΤΑΣΗ: κώδικας DONE & jest GREEN (44), UNCOMMITTED. Λείπει: browser-verify recompute (έντονο) + commit.

## ΤΙ ΕΓΙΝΕ (Slices 1/2/2b/2c)
- **S1** preset SSoT `bim/structural/presets/*` + store `applyStructuralPreset`.
- **S2** `resolveActivePresetKind` + `StructuralPresetSelector` (canonical `ui/select`) στο `FloorManagementDialog` + i18n `structural.preset.*` (el+en).
- **S2b** κεντρικός `hooks/useStructuralSettingsRecompute.ts` (store.subscribe → user settings change → `bim:compute-loads-requested` → οπλισμός/σχέδια· guard `lastLocalMutationAt`· reuse ribbon event) + mount στο `app/DxfViewerContent.tsx`.
- **S2c** confirm πριν full-replace: reuse `BuildingSpaceConfirmDialog` + `pendingKind` state στο selector + i18n `structural.preset.confirm.*`.

## VERIFY ΜΕΧΡΙ ΤΩΡΑ (από Firestore, αντικειμενικά)
- ✅ **Apply+persist+confirm dialog** ΔΟΥΛΕΥΟΥΝ. Building `bldg_58f47bf1` structuralSettings: `greek-legacy/soil 300` → `eurocode/χωρίς soil` (=preset «Κενό»), `_v` 8→9. Confirm dialog εμφανίστηκε με σωστό κείμενο/interpolation.
- ⚠️ **Recompute visible: ΑΝΕΠΙΒΕΒΑΙΩΤΟ** — το σενάριο (4 κολόνες + 4 strip πεδιλοδοκοί, **χωρίς πλάκα/δοκάρι**) είναι πολύ ελαφρύ → ελάχιστη ορατή αλλαγή (κανένα audit `updated` μετά το apply· idempotent no-op). Ο μηχανισμός είναι wired + unit-tested (5 jest), αλλά δεν φάνηκε οπτικά.

## ΣΕΝΑΡΙΟ ΣΤΗ ΒΑΣΗ (έτοιμο)
- Building `bldg_58f47bf1-4d41-4276-9929-bed8f1aa1a9d` «Κτήριο Α1», residential.
- Active level «Ισόγειο» `lvl_21982f3b-ecbe-46b0-b357-d13dbfb8d656` (sceneFileId `file_80efad96`).
- 4 κολόνες 40×40×300· 4 strip πεδιλοδοκοί (w600/t400/−1000mm): `fnd_641a5817`, `fnd_26b07588`, `fnd_9c778756`, `fnd_639b2fef`.
- ⚠️ `showReinforcement`=FALSE στο Ισόγειο → toggle ON για να δεις ράβδους.
- Τρέχον preset (μετά το test) = «Κενό» (eurocode). Άρα dropdown θα δείχνει «Κενό» τώρα.

## ΕΠΟΜΕΝΟ: ΚΑΘΑΡΟ VERIFY RECOMPUTE
1. Πρόσθεσε **1 πλάκα** πάνω στις 4 κολόνες (gravity load — απαραίτητο για έντονη αλλαγή).
2. «Οπλισμός» ON· επίλεξε πεδιλοδοκό → structural panel → σημείωσε readout.
3. dropdown «Δομοστατικό πρότυπο» → «Ελληνικό RC (ΕΚΩΣ-ΕΑΚ)» → confirm → ΧΩΡΙΣ «Υπολογισμό Φορτίων» το readout αλλάζει = ✅.
4. Cancel test: ξανα-διάλεξε → «Άκυρο» → dropdown επιστρέφει, μηδέν αλλαγή.
5. Επιβεβαίωση από βάση (προαιρετικό): `buildings/bldg_58f47bf1` structuralSettings αλλάζει + audit `updated` σε foundations.

## ΑΡΧΕΙΑ ΓΙΑ COMMIT (git add ΜΟΝΟ ΑΥΤΑ)
**NEW:** `bim/structural/presets/{reference-static-report,structural-preset-types,structural-preset-defaults,resolve-active-preset,index}.ts` + `presets/__tests__/{reference-static-report,resolve-active-preset}.test.ts` · `ui/components/StructuralPresetSelector.tsx` · `hooks/useStructuralSettingsRecompute.ts` + `hooks/__tests__/useStructuralSettingsRecompute.test.ts`
**MOD:** `ui/components/FloorManagementDialog.tsx` · `app/DxfViewerContent.tsx` · `state/structural-settings-store.ts`[+test] · `i18n/locales/{el,en}/dxf-viewer-shell.json` **[⚠️ shared—ήδη dirty άλλου agent· θα μπουν & ξένα keys· απόφαση Giorgio]** · `docs/.../ADR-479-structural-project-presets.md` · `adr-index.md` · `docs/.../structural-guides/*` · `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt`
> ⚠️ ΟΧΙ δικά μου (shared tree): `bim/structural/analytical/*` (ADR-480), `member-load-geometry.ts`, `structural-organism-types.ts`, `drawing-event-map-bim.ts`, `useProactiveStructuralAnalysis`.

## DEFER
Slice 3 persisted user/company presets (Firestore, mirror StairPresetsService)· ψ1/ψ2.

## SSoT/MEMORY: `project_adr479_structural_project_presets`. ADR-479 §Verification + Changelog ενημερωμένα.
