# HANDOFF — ADR-422 L7: Ετήσια Ενεργειακή Ζήτηση Θέρμανσης + Ενδεικτική Κατηγορία (degree-day, ΤΟΤΕΕ 20701-3 / Revit Energy / 4M-FineHEAT-KENAK)

**Ημερομηνία:** 2026-06-09
**Μοντέλο:** Opus 4.8
**Εντολή Giorgio:** «ΟΠΩΣ ΟΙ ΜΕΓΑΛΟΙ ΠΑΙΧΤΕΣ (Revit / 4M-FineHEAT) — **FULL ENTERPRISE + FULL SSOT**. Ετήσια κατανάλωση / ΚΕΝΑΚ rating.»
**Κατάσταση:** **PLAN ΕΤΟΙΜΟ & ΕΓΚΕΚΡΙΜΕΝΟ DE-FACTO** — όλες οι αποφάσεις κλειδωμένες (§2). Το VS Code **πάγωσε** πάνω στη διευκρ. ερώτηση εύρους, αλλά η απόφαση είναι ήδη λυμένη στο plan (v1 = ζήτηση + ενδεικτική κατηγορία· επίσημο rating = future L8). **Ξεκίνα κατευθείαν υλοποίηση** — μην ξανα-ρωτήσεις εύρος ([[feedback_make_revit_grade_decisions_yourself]]).
**⚠️ SHARED working tree** με άλλον agent (δουλεύει ΠΑΡΑΛΛΗΛΑ στον **λέβητα / Heating Auto-Design ADR-408/428**). `git add` **ΜΟΝΟ** δικά σου αρχεία — **ΠΟΤΕ `-A`**. **COMMIT/PUSH τα κάνει ο Giorgio, ΟΧΙ εσύ** (N.(-1)).
**Απάντα στα ελληνικά.**

---

## 0) ΠΟΥ ΒΡΙΣΚΟΜΑΣΤΕ (ADR-422 — αναλυτική μελέτη θέρμανσης, στρώμα-στρώμα)

| Στρώμα | Τι κάνει | Κατάσταση |
|---|---|---|
| **L0** | Θερμικός χώρος (IfcSpace) + click-in-region «Place Space» + tab | ✅ |
| **L1** | Heat-load engine `Φ = Φ_T + Φ_V` (EN 12831) + analytical overlay/heat-map | ✅ |
| **L1.5** | Θερμογέφυρες (ΔU_TB) + Reheat (Φ_RH) — πληρότητα EN 12831 | ✅ |
| **L2** | Radiator sizing (EN 442) + boiler equipment-sizing | ✅ |
| **L3** | Pipe sizing (velocity+friction) — προτεινόμενη DN + overlay | ✅ engine+viz (🔴 **Apply command pending** — §6) |
| **L4** | Hydraulic balancing (Darcy index-circuit + kv valves) + overlay | ✅ engine+viz |
| **L5** | Μηχανολογική Μελέτη — Printout/PDF Report (σύνοψη + πίνακες) | ✅ |
| **L6** | Έλεγχος Συμμόρφωσης Κελύφους ΚΕΝΑΚ (U-compliance) — 6η section | ✅ (2026-06-09, commit `12c9b0c1` + follow-up) |
| **L7** | **Ετήσια Ενεργειακή Ζήτηση + Ενδεικτική Κατηγορία** ← **ΑΥΤΟ ΤΟ HANDOFF** | ⬜ PLAN ΕΤΟΙΜΟ |

**Τι έκλεισε μόλις (L6, για context):** πλήρης πίνακας `U_max` ανά στοιχείο × ζώνη (ΤΟΤΕΕ 20701-1 Πίν. 3.3α) + per-boundary έλεγχος έναντι ορίου → ✓/✗ ανά στοιχείο + 6η section στο L5 report. NEW `kenak-envelope-limits.ts` + `derive-envelope-compliance.ts`. Advisory/soft. 15/15 tests. ΕΚΤΟΣ ADR-040.

---

## 1) ΤΙ ΘΑ ΚΑΝΕΙΣ (L7)

Σήμερα η μελέτη υπολογίζει **φορτίο σχεδιασμού** (Φ, W — στιγμιαία αιχμή) αλλά **δεν λέει πόσες kWh/έτος** καταναλώνει το κτίριο. Οι «μεγάλοι παίχτες» (Revit Energy, 4M-FineHEAT-KENAK) δίνουν **ετήσια ενεργειακή ζήτηση** + κατηγορία.

**Στόχος L7:** ετήσια ζήτηση θέρμανσης `Q_H` (kWh/έτος) με **μέθοδο βαθμοημερών (degree-day, ΤΟΤΕΕ 20701-3 / EN ISO 13790 simplified)**, ειδική ζήτηση `q_H` (kWh/m²·έτος) και **ενδεικτική κατηγορία** ζήτησης → ως **νέα 7η section** στο υπάρχον PDF report + 3 νέα summary KPIs. Όλα **derived** (μηδέν persist), **advisory** (mirror L6), **πλήρως self-contained** στο `bim/thermal/*`.

**Έντιμο όριο (HONESTY):** η επίσημη ΚΕΝΑΚ κατάταξη (Α+→Η) είναι λόγος **πρωτογενούς ενέργειας** προς **κτίριο αναφοράς** — απαιτεί βαθμό απόδοσης συστήματος + συντελεστή καυσίμου, που είναι **pending δουλειά του παράλληλου boiler agent**. Άρα v1 = **ζήτηση** (ανεξάρτητη συστήματος) + **ενδεικτική** κατηγορία, ρητά «μη-επίσημο». Πλήρης primary-energy κατάταξη = future **L8**.

---

## 2) ΑΠΟΦΑΣΕΙΣ (Revit-grade, ΗΔΗ LOCKED — μην ξανα-ρωτήσεις)

- **D-A — μέθοδος = degree-day** (ΤΟΤΕΕ 20701-3, μηδέν εξάρτηση από σύστημα/καύσιμο). Πηγή απωλειών = τα **L1 results** (μηδέν νέα φυσική, μηδέν re-resolve geometry).
- **D-B — νέο config** `bim/thermal/heat-load/annual-energy-config.ts` (ΟΧΙ fork του ADR-396 `kenak-thermal-config`· isolation, mirror της D-B του L6):
  - `HEATING_DEGREE_DAYS: Record<ClimateZone, number>` — base-18 αντιπροσωπευτικές editable τιμές: **A≈900 / B≈1300 / C≈1800 / D≈2400 K·ημέρα** (documented, επιβεβαίωσε με ΤΟΤΕΕ 20701-3).
  - `ENERGY_DEMAND_CLASS_BANDS` — ταξινομημένα κατώφλια kWh/m²·έτος → ετικέτα A+…H (documented indicative).
  - `getHeatingDegreeDays(zone)` + `classifyEnergyDemand(qH)`. **Reuse `ClimateZone`. Καμία inline literal στον engine.**
- **D-C — pure aggregator** `bim/thermal/heat-load/derive-annual-energy.ts` (mirror `deriveEnvelopeCompliance`):
  - `deriveAnnualHeating(results, spaces, zone)` → per-space `{ spaceId, lossCoefficientWperK, floorAreaM2, annualDemandKWh, specificDemandKWhM2 }` + σύνοψη `{ rows, totalAnnualKWh, totalAreaM2, specificDemandKWhM2, energyClass, hdd, zone }`.
  - Heated area από `space.geometry.area` (cached snapshot)· **guard area>0**.
- **D-D — UI = νέα 7η section στο υπάρχον PDF report + επέκταση summary** (ΟΧΙ νέο ribbon widget, ΟΧΙ overlay) → **μηδέν shared αρχείο με boiler agent**. `spaceLoads` + `climateZone` είναι **ήδη** στο `ThermalStudyReportInput` → **καμία αλλαγή hook/input**.
- **D-E — έντιμη ονοματοδοσία**: section «Ετήσια Ενεργειακή Ζήτηση Θέρμανσης (ενδεικτική)»· κατηγορία = «Ενδεικτική κατηγορία ζήτησης». Επίσημο primary-energy ΚΕΝΑΚ = future L8.
- **D-F — μονάδες**: H [W/K] 2-δεκ· Q kWh **ακέραιο** (col type 'count')· q kWh/m²·έτος 1-δεκ· class text.

### ΦΥΣΙΚΗ (κρίσιμη — μην την αλλάξεις)
Ανά χώρο, από τα **ήδη υπολογισμένα** L1 results:
- Συντ. απωλειών `H = (transmissionW + ventilationW) / deltaTC` **[W/K]**.
  - ⚠️ Το `transmissionW` **ήδη περιλαμβάνει** θερμογέφυρες (L1.5)· το **`reheatW` ΕΞΑΙΡΕΙΤΑΙ** (εφάπαξ προθέρμανση, όχι συνεχής απώλεια).
- `Q_H = H × HDD × 24 / 1000` **[kWh/έτος]** — οι βαθμοημέρες ολοκληρώνουν ΔΤ επί την περίοδο → **ΔΕΝ** χρησιμοποιείται το ΔΤ σχεδιασμού.
- **Εσωτερικά/ηλιακά κέρδη συντηρητικά αμελούνται** v1 (ζήτηση = συντηρητικό άνω όριο· documented, μελλοντικός utilisation factor).
- Σύνολα: `Q_total = ΣQ_H`, `A_total = ΣA`, `q_H = Q_total / A_total` → κατηγορία.

---

## 3) ΑΡΧΕΙΑ

**ΝΕΑ (pure SSoT, δικά σου):**
- `src/subapps/dxf-viewer/bim/thermal/heat-load/annual-energy-config.ts` — HDD table + class bands + getters (config/types → εξαιρείται 500-line).
- `src/subapps/dxf-viewer/bim/thermal/heat-load/derive-annual-energy.ts` — pure read-model (≤40γρ/func).

**MOD (δικά σου, additive):**
- `src/subapps/dxf-viewer/bim/thermal/report/thermal-study-report.ts` — `buildAnnualEnergySection` (7η section, mirror `buildComplianceSection`) + 3 νέα summary KPIs στο `buildSummarySection`. Append: `sections: [..., compliance, annualEnergy]`.
- `src/subapps/dxf-viewer/bim/thermal/report/thermal-study-report-types.ts` — doc comment (7 πίνακες).
- `src/i18n/locales/el/dxf-viewer-shell.json` **ΚΑΙ** `src/i18n/locales/en/dxf-viewer-shell.json` — `thermalStudyReport.sections.annualEnergy` + `columns.{lossCoeff,floorArea,annualDemand,specificDemand}` + `summary.{annualEnergy,specificDemand,energyClass}` (additive, μόνο δικές σου γραμμές). **ΠΡΟΣΟΧΗ: shared locale με boiler agent — μόνο δικά σου keys, ΠΟΤΕ overwrite.**

**ΖΕΡΟ αλλαγή:** `useThermalStudyReport.ts` (climateZone+spaceLoads ήδη περνιούνται), `useRibbonCommands.ts`, οποιοδήποτε boiler/heating/MEP αρχείο.

**Reuse (ΜΗΝ fork):** `ClimateZone` (`kenak-thermal-config.ts`)· `SpaceHeatLoadResult` fields (`heat-load-types.ts`: transmissionW/ventilationW/reheatW/deltaTC)· `ThermalSpaceGeometry.area` (`thermal-space-types.ts`)· report helpers `col()`/`ReportRow`/`ReportSection`/`ReportColumn` + το **pattern `buildComplianceSection`** (το έγραψα στο L6 — κλώνος).

---

## 4) TESTS (worked-example, jest globals — ΟΧΙ vitest)
- `bim/thermal/heat-load/__tests__/annual-energy-config.test.ts` — HDD ανά ζώνη (D>C>B>A)· class bands (μονοτονία/όρια)· getters.
- `bim/thermal/heat-load/__tests__/derive-annual-energy.test.ts` — worked: `H=(transmission+ventilation)/ΔΤ`· `Q=H·HDD·24/1000`· **reheat εξαιρείται**· area από geometry· totals + class· empty/zero-area guard.
- MOD `bim/thermal/report/__tests__/thermal-study-report.test.ts` — 7η section παρούσα (length 6→7)· summary KPIs annual/specific/class· null-zone → 0 γραμμές.
- Factory: `createThermalSpace` από `@/services/factories/thermal-space.factory` (δες `heat-load/__tests__`).

**Worked-example sanity:** χώρος 4×4 m, H≈40 W/K, ζώνη Β (HDD 1300) → `Q ≈ 40×1300×24/1000 ≈ 1248 kWh/έτος`· `q ≈ 78 kWh/m²·έτος` → κατηγορία ανά bands.

---

## 5) ADR-040 / docs / N.15
- **ΕΚΤΟΣ ADR-040** (καθαρή αριθμητική + data + report· μηδέν canvas).
- **ΜΗΝ** adr-index.md (shared tree).
- **N.15 μετά την υλοποίηση:** ADR-422 changelog (L7 entry) + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + memory `project_adr422_thermal_space.md` + `MEMORY.md`.

## 6) PENDING ΑΠΟ ΠΡΟΗΓΟΥΜΕΝΑ (ΟΧΙ μέρος του L7)
- **L3 Apply command:** ribbon «Εφαρμογή Διαστασιολόγησης» → `CompoundCommand`. **Blocked στο shared `useRibbonCommands.ts`** (boiler agent) — ΡΩΤΑ τον Giorgio αν ελευθερώθηκε πριν το πιάσεις.
- **L1.5 / L6 tsc full** δεν έτρεξε (N.17 slot). Γνωστό pre-existing `mesh-to-object3d.ts(124)` αγνοείται.

## 7) ΚΑΝΟΝΕΣ ΠΟΙΟΤΗΤΑΣ (CLAUDE.md)
- **FULL ENTERPRISE + FULL SSOT**, Revit/4M-FineHEAT grade. No `any`/`as any`/`@ts-ignore`. Functions **≤40γρ**, code files **≤500γρ** (config/types εξαιρούνται). Semantic HTML, no inline styles.
- **i18n (N.11):** keys ΠΡΩΤΑ σε `el` **ΚΑΙ** `en`· namespace `dxf-viewer-shell`. ΟΧΙ hardcoded strings στον κώδικα.
- **License (N.5):** δεν χρειάζεται νέο npm package.
- **TSC (N.17):** ΠΡΙΝ τρέξεις `tsc` βεβαιώσου ότι δεν τρέχει άλλος (boiler agent τρέχει tsc συχνά). ΕΝΑ tsc τη φορά, background. Ζήτα από Giorgio `! npx tsc --noEmit` αν ο process-check μπλοκάρεται.

## 8) ISOLATION (shared tree με τον boiler/Heating agent)
- Ο άλλος agent δουλεύει: `bim/mep-boilers/*`, `bim/renderers/MepBoilerRenderer.ts`, `systems/mep-design/heating/*`, `recognition/*`, **+ shared `useRibbonCommands.ts`** + shared i18n locales + ADR-408/423/428.
- `git add` **ΜΟΝΟ** δικά σου: τα 2 NEW (`annual-energy-config.ts`, `derive-annual-energy.ts`) + 2 NEW tests · `report/{thermal-study-report,thermal-study-report-types}.ts` + report test · i18n locales (**μόνο δικές σου γραμμές**, additive). **ΠΟΤΕ `-A`.**
- **ΜΗΝ** αγγίξεις: `useRibbonCommands.ts`, boiler/heating/MEP/recognition αρχεία, ADR-408/423/428.
- **Commit/push τα κάνει ο Giorgio**, όχι εσύ.

## 9) ΠΗΓΕΣ ΝΑ ΔΙΑΒΑΣΕΙΣ ΠΡΩΤΑ
- Το **plan**: `C:\Users\user\.claude\plans\unified-sparking-karp.md` (πλήρες· αυτό το handoff είναι περίληψή του).
- `bim/thermal/heat-load/heat-load-types.ts` — `SpaceHeatLoadResult` (transmissionW/ventilationW/reheatW/deltaTC).
- `bim/thermal/heat-load/derive-envelope-compliance.ts` + `kenak-envelope-limits.ts` — **το πρότυπο L6 (γραμμένο χθες — κλώνος)**.
- `bim/thermal/report/thermal-study-report.ts` (+types) + `report/__tests__/thermal-study-report.test.ts` — `buildComplianceSection`/`buildSummarySection`/`col()`/`ReportRow`.
- `bim/thermal/kenak-thermal-config.ts` — `ClimateZone`.
- `bim/thermal/thermal-space-types.ts` — `ThermalSpaceGeometry.area`.
- memory `project_adr422_thermal_space.md` (L0→L6 + μαθήματα μονάδων/SSoT/isolation).
- Αναφορά: ΤΟΤΕΕ 20701-3 (βαθμοημέρες ανά κλιματική ζώνη).
