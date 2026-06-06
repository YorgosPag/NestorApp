# HANDOFF — Βαθιά έρευνα: U-value + IFC θερμοπρόσοψης (ETICS) vs Revit/ArchiCAD

**Ημερομηνία:** 2026-06-06
**Subapp:** `http://localhost:3000/dxf/viewer`
**Τύπος εργασίας:** ΕΡΕΥΝΑ (read-only) → gap analysis → πρόταση/πλάνο (Plan Mode). Πιθανή υλοποίηση σε follow-up.
**ADR:** ADR-396 (External Thermal Envelope / ETICS) — P8 (θερμική απόδοση/U-value) + P9 (IFC).
**Mode:** Ξεκίνα σε **Plan Mode**. ΜΗΝ γράψεις κώδικα πριν εγκριθεί πλάνο.
**⚠️ Working tree SHARED με άλλον agent** — μόνο στοχευμένα αρχεία, ΟΧΙ `git add -A`.
**⚠️ COMMIT: ο Giorgio, ΟΧΙ εσύ.** Καμία αυτόματη commit/push. Καμία `--no-verify`.
**Γλώσσα απαντήσεων: Ελληνικά πάντα.**
**Πρότυπο ποιότητας:** «όπως οι μεγάλοι (Revit). FULL ENTERPRISE + FULL SSOT.»

---

## 0. ΤΙ ΖΗΤΑΕΙ Ο GIORGIO

Βαθιά, τεκμηριωμένη σύγκριση του **πώς υπολογίζει η εφαρμογή μας τον συντελεστή
θερμοπερατότητας U (U-value) και πώς εξάγει IFC** για τη θερμοπρόσοψη (ETICS),
**έναντι του πώς το κάνουν οι μεγάλοι (Revit, ArchiCAD, openBIM/IFC standard)**.
Στόχος: να βρεθεί αν αποκλίνουμε από τα πρότυπα και να προταθεί FULL-ENTERPRISE/SSOT
ευθυγράμμιση (Revit-grade), με συγκεκριμένο πλάνο.

---

## 1. ΠΡΟΪΣΤΟΡΙΑ — ΤΙ ΒΡΕΘΗΚΕ ΣΤΗΝ ΠΡΟΗΓΟΥΜΕΝΗ ΣΥΝΕΔΡΙΑ (ΣΗΜΑΝΤΙΚΟ)

Έγινε αρχιτεκτονική ανάλυση της εντολής «Εφαρμογή Θερμοπρόσοψης». Ευρήματα:

- Το ETICS είναι **υβριδικό 3 επιπέδων (ADR-396 D1)**:
  - **DEFINITION**: `ThermalEnvelopeSpec` (υλικό + πάχος + ζώνες Z1-Z4) ανά όροφο, στο doc του ορόφου.
  - **DATA (per-element)**: `envelopeLayer` σε **κολώνες/δοκάρια/πλάκες** + `revealInsulation` στα ανοίγματα.
  - **DISPLAY**: παράγωγο **συνεχές κέλυφος** (outward offset footprint) — 2D overlay + 3D extruded band.
- **ΚΡΙΣΙΜΟ:** οι **ΤΟΙΧΟΙ ΔΕΝ** παίρνουν στρώση μόνωσης στο `WallDna` τους. Μπαίνουν μόνο
  στο παράγωγο κέλυφος + ένα flag `envelopeFunction` (auto/exterior/interior).
  → Επιβεβαιωμένο: `bim/services/envelope-element-applicator.ts` γράφει `envelopeLayer`
  μόνο σε column/beam/slab, `revealInsulation` σε opening — **όχι** στο wall DNA.
- **Απόκλιση κώδικα↔ADR:** το ίδιο το ADR-396 §3 (διάγραμμα, γρ. 87) λέει ότι για τους
  τοίχους το data = `wall.dna.layers[side=exterior]` — αλλά **ο κώδικας δεν το υλοποιεί**.

### Ετυμηγορία προηγούμενης συνεδρίας (να την έχεις ως βάση):
Το σύστημα είναι **ως επί το πλείστον σωστό** και **δεν** αντιβαίνει στα πρότυπα:
- Η εντολή «Εφαρμογή» = UX automation πάνω σε σωστό per-element data model (Revit-aligned).
- Το «ανεξάρτητο συνεχές κέλυφος» είναι **πιο σωστό** για ETICS (συνέχεια πάνω από φέροντα
  σκελετό + σωστά m²/ΚΕΝΑΚ) — ο Revit «κολλάει» εδώ. Το IFC `IfcCovering` (ξεχωριστό
  στοιχείο) επιβεβαιώνει ότι το «ανεξάρτητο» είναι standard-compliant.
- **Το ένα σημείο που αξίζει αναθεώρηση (Revit parity):** η μόνωση του **τοίχου** καλό είναι
  να εμφανίζεται **και** ως εξωτερική στρώση στον **τύπο τοίχου** (wall DNA), ώστε η τομή
  + το U-value να διαβάζονται «αυτο-πλήρως» από τον τοίχο (όπως στον Revit).
  - **Επιλογή A** (Revit-parity): apply → προσθήκη exterior insulation layer στο wall DNA· το κέλυφος ΠΑΡΑΓΕΤΑΙ από τις στρώσεις.
  - **Επιλογή B** (energy-model): κράτα τους τοίχους εκτός DNA, αλλά τεκμηρίωσε ότι το ETICS = building-envelope system + διόρθωσε το ADR διάγραμμα.

Η ΤΩΡΙΝΗ έρευνα (U-value/IFC) πρέπει να **τροφοδοτήσει** αυτή την A vs B απόφαση με σκληρά στοιχεία.

---

## 2. ΟΙ ΔΥΟ ΑΞΟΝΕΣ ΤΗΣ ΕΡΕΥΝΑΣ

### Άξονας 1 — U-value (θερμοπερατότητα)
**Τι κάνουμε (διάβασε):**
- `bim/thermal/assembly-u-value.ts` — τύπος `U = 1/(Rsi + Σ(d/λ) + Rse)`.
- `bim/thermal/kenak-thermal-config.ts` — `U_max` ανά κλιματική ζώνη Α/Β/Γ/Δ (ΤΟΤΕΕ) + reference τοίχος.
- `bim/walls/wall-material-catalog.ts` — λ (thermal conductivity) ανά υλικό.
- `ui/components/bim-envelope/ThermalEnvelopeDialog.tsx` — live U-value + ΚΕΝΑΚ pass/warn panel.
- `Building.climateZone` (OQ-7a).

**Τι να συγκρίνεις με Revit/πρότυπα (web research + domain):**
- Revit: Wall Type → **Analytical Properties** → Thermal Resistance (R), Heat Transfer Coefficient (U),
  Thermal mass· **Material Thermal Assets** (Thermal Conductivity λ, Specific Heat, Density).
  Πώς αθροίζει στρώσεις, Rsi/Rse (surface resistances), air gaps/cavities, repeating thermal bridges.
- Πρότυπα: **ISO 6946** (R/U υπολογισμός, Rsi/Rse, αεροδιάκενα), ΤΟΤΕΕ 20701-2 (ελληνικά Rsi/Rse/λ).
- **Ερωτήματα-κλειδιά:** Χρησιμοποιούμε σωστά Rsi/Rse ανά προσανατολισμό/ροή θερμότητας; Λαμβάνουμε
  υπόψη αεροδιάκενα, θερμογέφυρες (point/linear), ανομοιογενείς στρώσεις; Τα λ μας ταιριάζουν ΤΟΤΕΕ;
  Υπολογίζουμε U **ανά τύπο τοίχου** (Revit) ή μόνο για το κέλυφος;

### Άξονας 2 — IFC interoperability
**Τι κάνουμε (διάβασε/εντόπισε):**
- `app/IfcExportHost.tsx` — host εξαγωγής IFC.
- `ui/components/bim-pset/pset-templates.ts` — Pset templates (περιέχει thermal αναφορές).
- `bim/types/ifc-entity-mixin.ts` — IFC type mixin στις οντότητες.
- **ΨΑΞΕ** τον πραγματικό serializer του ETICS σε IFC (P9 «IfcCovering») — grep `IfcCovering`,
  `Pset_MaterialThermal`, `ThermalTransmittance` (scope: `src/subapps/dxf-viewer`). Δεν βρέθηκε
  dedicated `envelope-ifc` αρχείο — επιβεβαίωσε ΠΟΥ/ΑΝ γίνεται η σειριοποίηση (ίσως μόνο σχεδιασμένο).

**Τι να συγκρίνεις με Revit/IFC standard:**
- Revit IFC export τοίχου: `IfcWall` + `IfcMaterialLayerSet`/`IfcMaterialLayer` (+ `IfcMaterialLayerSetUsage`),
  thermal μέσω `Pset_MaterialCommon`/`Pset_MaterialThermal` (ThermalConductivity, SpecificHeatCapacity,
  MassDensity) + `Pset_WallCommon.ThermalTransmittance` (U).
- ETICS ως ξεχωριστό: `IfcCovering` (PredefinedType=CLADDING/INSULATION) + `IfcRelCoversBldgElements`.
- **Ερωτήματα-κλειδιά:** Επιλέγουμε σωστή IFC οντότητα; Γράφουμε `Pset_MaterialThermal` με σωστά
  ονόματα/μονάδες (W/mK, J/kgK, kg/m³); Συνδέουμε το covering με τον host τοίχο (`IfcRelCoversBldgElements`);
  Εξάγουμε `ThermalTransmittance` στο `Pset_WallCommon`; IFC2x3 vs IFC4 διαφορές;

---

## 3. ΠΑΡΑΔΟΤΕΟ

Δομημένη αναφορά (στα Ελληνικά) με:
1. **Τι κάνουμε σήμερα** (U-value + IFC), με γραμμές κώδικα.
2. **Τι κάνουν οι μεγάλοι** (Revit/ArchiCAD/ISO 6946/ΤΟΤΕΕ/IFC4) — με πηγές (cite).
3. **Gap analysis** — πίνακας: άξονας → δικό μας → πρότυπο → απόκλιση → σοβαρότητα.
4. **Σύσταση** ευθυγράμμισης (FULL ENTERPRISE + FULL SSOT), δεμένη με την **Επιλογή A vs B** της §1.
5. **Πλάνο υλοποίησης** (αρχεία, SSoT σημεία, tests) — για έγκριση Giorgio πριν κώδικα.

Προτείνεται: χρήση **adversarial verification** στους ισχυρισμούς για Revit/IFC (μη βασιστείς
σε μνήμη — επιβεβαίωσε με web research· τα IFC Pset ονόματα/μονάδες είναι λεπτομέρειες που μετράνε).
Διαθέσιμο skill: `deep-research` (fan-out web search + cited report) — ιδανικό για τον standards άξονα.

---

## 4. ΠΡΩΤΑ ΒΗΜΑΤΑ ΝΕΟΥ SESSION

1. **Plan Mode.**
2. Διάβασε ADR-396 (§ P8 θερμική + § P9 IFC + §3 αρχιτεκτονική) — code = source of truth.
3. Διάβασε τα 5 thermal/IFC αρχεία της §2 + grep τον πραγματικό IFC serializer (`IfcCovering`).
4. (Προαιρετικά) τρέξε το skill `deep-research` για τον standards άξονα (Revit thermal assets,
   ISO 6946 Rsi/Rse, IFC4 `Pset_MaterialThermal` / `IfcCovering`).
5. **AskUserQuestion** για τα ανοιχτά (π.χ. A vs B· IFC2x3 vs IFC4 target· πόσο βαθιά θερμογέφυρες).
6. Δώσε αναφορά + (αν χρειάζεται κώδικας) ExitPlanMode με πλάνο για έγκριση.

---

## 5. ΚΑΤΑΣΤΑΣΗ WORKING TREE (να το ξέρεις — shared)

- Υπάρχουν **uncommitted** αλλαγές από προηγούμενη συνεδρία: **ADR-412 v0.9 auto-type-on-create
  (Revit «Generic Wall»)** + UI fix μετονομασίας generic τύπων. ✅ core browser-verified.
  Αρχεία: `bim/family-types/auto-wall-type.ts`, `useWallAutoTyping.ts`, `auto-wall-type.test.ts`,
  `wall-dna-types.ts`, `bim-family-type(.ts/.schemas.ts/-service.ts)`, `family-type-ui-helpers.ts`,
  `useSpecialTools.ts`, `RibbonWallTypePropertiesWidget.tsx`, i18n el/en, ADR-412, ΕΚΚΡΕΜΟΤΗΤΕΣ.
- Επίσης αλλαγές **άλλου agent** (ADR-417 roof κ.ά.).
- **ΜΗΝ** αγγίξεις/commit-άρεις τίποτα από τα παραπάνω. Δούλεψε ΜΟΝΟ στα δικά σου αρχεία.
  Ο Giorgio κάνει όλα τα commits.

---

## 6. ΚΑΝΟΝΕΣ (μη παραβιάσιμα)
- Plan Mode πρώτα· καμία γραμμή κώδικα χωρίς έγκριση.
- FULL SSOT (μηδέν fork)· FULL ENTERPRISE· N.2 (όχι `any`)· N.11 (i18n keys πρώτα).
- N.15: αν προκύψει υλοποίηση → update ADR-396 + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` (ΟΧΙ adr-index — shared tree).
- ΟΧΙ commit/push/`--no-verify`. Απάντα Ελληνικά.
