# HANDOFF — Πλάκες με ΣΤΡΩΣΕΙΣ (build-up) + 3D Preview panel (mirror του wall-type preview)

**Ημερομηνία:** 2026-06-04
**Μοντέλο:** Opus (cross-cutting — N.14)
**Γλώσσα:** Ελληνικά πάντα.
**Commit/Push:** ΜΟΝΟ ο Giorgio (N.(-1)). **Working tree = SHARED με άλλον agent** → stage ΜΟΝΟ δικά σου αρχεία, ΠΟΤΕ `git add -A`, ΜΗΝ αγγίξεις `adr-index.md`.

---

## 0. ΑΜΕΣΗ ΕΝΕΡΓΕΙΑ ΝΕΑΣ ΣΥΝΕΔΡΙΑΣ
Ο Giorgio θέλει για τις **ΠΛΑΚΕΣ** ό,τι κάναμε για τους τοίχους (ADR-414): **floating panel, δεξιά οι ρυθμίσεις στρώσεων, αριστερά ζωντανή 3D προεπισκόπηση**. Ξεκίνα με **Phase 1 RECOGNITION (N.0.1)** και μετά **Plan Mode** με πλήρες plan για έγκριση. ΜΗΝ γράψεις κώδικα χωρίς approved plan. **FULL ENTERPRISE + FULL SSOT, «όπως οι μεγάλοι» (Revit/ArchiCAD).**

⚠️ **Αυτό είναι ΜΕΓΑΛΥΤΕΡΟ από τους τοίχους:** οι πλάκες σήμερα είναι **μονοστρωματικές** (single material/thickness) και **εκτός family-types**. Πρέπει ΠΡΩΤΑ να αποκτήσει η πλάκα έννοια στρώσεων (build-up), μετά το preview. Πιθανό Orchestrator μετά το plan (N.8).

---

## 1. ΤΟ DOMAIN — ΑΠΟΦΑΣΗ ΚΛΕΙΔΩΜΕΝΗ (πώς το κάνουν οι μεγάλοι, για να μη χαθεί)

**Ναι, το μοντέλο του Giorgio είναι ΣΩΣΤΟ.** Revit «Floor», ArchiCAD «Slab» (composite), Vectorworks, Tekla → ΟΛΟΙ μοντελοποιούν πλάκες/δάπεδα ως **πολυστρωματικό build-up**, ακριβώς όπως τοίχους (Revit: Floor → Edit Type → Structure → πίνακας Function/Material/Thickness + **Core Boundary**).

### Τυπικές στρώσεις (residential δάπεδο, πάνω→κάτω):
1. **Τελική επίστρωση** — πλακάκι / laminate / parquet / μάρμαρο
2. **Κόλλα πλακιδίων / underlay** (laminate foam)
3. **Τσιμεντοκονία / screed** (επιπεδωτική· **εδώ ενσωματώνεται η ενδοδαπέδια**)
4. **Ηχομόνωση κρουστικού ήχου** + tape περιμετρικά (interstorey)
5. **Θερμομόνωση** (XPS/EPS) — κυρίως πάνω από μη-θερμαινόμενο/έδαφος
6. **Φράγμα υδρατμών / στεγανοποίηση** (υγροί χώροι, πλάκα εδάφους)
7. **ΔΟΜΙΚΟΣ ΠΥΡΗΝΑΣ: οπλισμένο σκυρόδεμα (RC)** — το «Core» του Revit
8. **Σοβάς οροφής / soffit** (κάτω όψη) **Ή** ξεχωριστή ψευδοροφή

Revit Function codes ανά στρώση: Structure[1] / Substrate[2] / Thermal-Air[3] / Finish1[4] / Finish2[5] / Membrane + **Core Boundary** (χωρίζει δομικό από φινιρίσματα).

### Πλάκα ΔΑΠΕΔΟΥ vs ΟΡΟΦΗΣ — η κρίσιμη διαφορά:
- Στους μεγάλους είναι **ΜΙΑ φυσική πλάκα** (element «Floor» hosted σε level): η **πάνω** όψη = δάπεδο του πάνω ορόφου· η **κάτω** όψη = οροφή του κάτω ορόφου. **Ασύμμετρο build-up** (φινιρίσματα πάνω, RC core, σοβάς/soffit κάτω).
- «Πλάκα οροφής» ως **ξεχωριστό element** = **ψευδοροφή** (Revit «Ceiling» tool): γυψοσανίδα σε μεταλλικό σκελετό + plenum κενό για MEP. Μοντελοποιείται ΧΩΡΙΣΤΑ, κρέμεται κάτω από τη δομική πλάκα, με δικές της στρώσεις.
- **ΤΟ ΕΧΟΥΜΕ ΗΔΗ:** `SlabParams.kind = 'floor'|'ceiling'|'roof'|'ground'|'foundation'` → ο discriminator υπάρχει! Οι **default στρώσεις διαφέρουν ανά kind**:
  - `floor` (μεσοπατώματος): φινιρίσματα + screed + ηχομόνωση + RC core + σοβάς οροφής
  - `roof`: RC core + ρύσεις/screed + φράγμα υδρατμών + θερμομόνωση + στεγανωτική μεμβράνη + προστασία/χαλίκι
  - `ground`/`foundation`: μπετόν καθαριότητας + στεγάνωση + θερμομόνωση (XPS) + RC + screed + τελική (ΧΩΡΙΣ soffit — πατάει στο έδαφος)
  - `ceiling` (ψευδοροφή): γυψοσανίδα + plenum + (ηχοαπορρόφηση)

### Σωληνώσεις ύδρευσης + ενδοδαπέδια θέρμανση — **ΔΕΝ είναι στρώσεις πλάκας:**
- Είναι **ξεχωριστά δίκτυα MEP** (ADR-408 ύδρευση/θέρμανση) που **φιλοξενούνται μέσα / διαπερνούν** την πλάκα.
- **Ενδοδαπέδια:** οι σωλήνες στρώνονται πάνω στη μόνωση και **εγκιβωτίζονται στο screed**. Στο BIM: η ΠΛΑΚΑ δίνει αρκετά παχύ screed layer που τους φιλοξενεί· οι ΣΩΛΗΝΕΣ = ξεχωριστό MEP radiant circuit (ΟΧΙ material layer). (Κάποιοι βάζουν nominal «heating screed» layer για πάχος/θερμικά — αλλά το θερμαντικό στοιχείο = MEP.)
- **Ύδρευση:** σε τοίχους + screed/κενό· MEP pipes, ΟΧΙ slab layers.
- **Αποχέτευση:** διαπερνά κάθετα → MEP pipes + **slab penetrations/openings** (έχουμε ήδη `floorplan_slab_openings`, kind `'duct'`/`'shaft'`). Η πλάκα παίρνει opening· ο σωλήνας = MEP.

➡️ **ΑΡΧΙΤΕΚΤΟΝΙΚΟΣ ΔΙΑΧΩΡΙΣΜΟΣ (ο τρόπος των μεγάλων):**
- **Slab TYPE = στρώσεις build-up** (φινιρίσματα/screed/μόνωση/δομικό/σοβάς). **ΑΥΤΟ κάνει το preview.**
- **MEP (ενδοδαπέδια/ύδρευση/αποχέτευση) = ξεχωριστά δίκτυα** (ADR-408) που host-άρονται/διαπερνούν την πλάκα. **ΕΚΤΟΣ scope του slab-layer feature** (μελλοντικό integration: π.χ. «heated floor» flag ή host loop σε layer — ξεχωριστή φάση).

---

## 2. ΤΡΕΧΟΥΣΑ ΚΑΤΑΣΤΑΣΗ (RECOGNITION — code wins)
- **`SlabParams`** (`bim/types/slab-types.ts:93`): `kind` (5 τιμές, γρ.44), `outline`, `levelElevation`, `thickness` (μονό, γρ.86), `material?` (ΕΝΑ string ID, γρ.112), `geometryType` box/tilted, `slope?`, `reinforcement?`, `slabOpeningIds?`. **ΚΑΜΙΑ έννοια στρώσεων/dna/composite.**
- **family-types:** `BimTypeParamsByCategory` (`bim/types/bim-family-type.ts:173`) = `wall | stair` ΜΟΝΟ. **Δεν υπάρχει `'slab'`** ούτε `SlabTypeParams` ούτε built-in slab types.
- **3D:** `BimToThreeConverter.ts:463 slabToMesh()` = ΕΝΑ ExtrudeGeometry, ΕΝΑ uniform material (`getElementMaterial3D('slab')`), + slope shear. Μονοστρωματικό.
- **2D:** `bim/renderers/SlabRenderer.ts` = polygon outline + fill + reinforcement hatch. Μονοστρωματικό.
- **UI:** ΔΕΝ υπάρχει `slab-advanced-panel/` (υπάρχουν wall-/stair-). Μόνο contextual ribbon tab (`ui/ribbon/data/contextual-slab-tab.ts` + `useRibbonSlabBridge.ts`, flat controls). **Κανένας layer editor.**
- **MEP↔slab:** μόνο `SlabOpeningParams.slabId` (opening→host) + kind `'duct'`. Κανένα underfloor/pipe-in-slab.

## 3. ΤΕΜΠΛΕΪΤΑ ΠΡΟΣ ΑΝΤΙΓΡΑΦΗ (ο δρόμος των τοίχων, ΗΔΗ δουλεμένος — ADR-412 v0.8 + ADR-414)
- **DNA data model:** `bim/types/wall-dna-types.ts` — `WallDnaLayer{id,name,thickness,materialId,side}` (γρ.18) + `WallDna{layers,totalThickness}` (γρ.29) + `getDefaultDnaForCategory` (γρ.89). → φτιάξε **`SlabDna`** με `layers[]` (zone: `'top'|'core'|'bottom'`) + `getDefaultSlabBuildupForKind(kind)`.
- **Pure preview geometry:** `bim-3d/converters/wall-type-preview-geometry.ts` (bands ανά layer, reuse **`layerBoundaryFractions`** `bim-3d/converters/wall-layer-geometry.ts:63`).
- **Mini-renderer:** `bim-3d/preview/WallTypePreviewRenderer.ts` (αυτόνομο THREE scene, render-on-demand, fixed camera, ΕΚΤΟΣ ADR-040).
- **React wrapper:** `ui/ribbon/components/WallTypePreviewPanel.tsx`.
- **Floating dialog:** `ui/ribbon/components/EditWallTypeDialog.tsx` (αριστερά preview, δεξιά settings· SSOT FloatingPanel· built-in guard· Duplicate-to-edit· follow-selection).
- **Layer editor (entity-agnostic!):** `ui/wall-advanced-panel/sections/WallDnaEditor.tsx` — ΗΔΗ entity-agnostic· **ίσως reusable ή Boy-Scout γενίκευση** για slab layers (zone αντί για side).
- **Multi-layer 3D placed element:** `bim-3d/converters/wall-multilayer-solid-3d.ts` (per-layer sub-solids) — πρότυπο για per-layer slab 3D (offset κατά πάχος στον κάθετο άξονα).

## 4. GAPS ΓΙΑ ΠΛΗΡΕΣ REVIT (να μπουν στο plan)
1. **`SlabDna` + per-kind default build-ups** (`getDefaultSlabBuildupForKind`) — SSoT, ασύμμετρο top/core/bottom.
2. **family-types integration:** πρόσθεσε `'slab'` στο `BimTypeParamsByCategory` + `SlabTypeParams` + `getBuiltInSlabTypes` (ένας built-in ανά kind) + resolver «type always wins». **Reuse** όλη τη μηχανή ADR-412 (store/service/commands/resolve-effective-params/auto-assign policy).
3. **Auto-typing** (ίδιο μοτίβο ADR-412 v0.8): νέα/legacy slabs → built-in τύπος kind τους, μη-καταστροφικά (μόνο αν ταιριάζουν default).
4. **3D per-layer:** `slabToMesh` → multi-layer sub-solids (πρότυπο `wall-multilayer-solid-3d`)· units-safe.
5. **Preview panel + Edit Slab Type dialog + Slab layer editor** (mirror τοίχου).
6. **i18n** el+en. **ADR:** επέκταση του slab ADR Ή νέο ADR (έλεγξε adr-index — likely **ADR-416**· ΜΗΝ αγγίξεις adr-index, side-task άλλου agent).
7. **MEP/ενδοδαπέδια = ΕΚΤΟΣ scope** (ξεχωριστή μελλοντική φάση, ADR-408).

## 5. ΚΑΝΟΝΕΣ
- N.0.1 RECOGNITION → Plan Mode (εγκεκριμένο) → ίσως Orchestrator (N.8, ~30+ αρχεία).
- N.14 Opus. N.(-1) commit/push ΜΟΝΟ Giorgio. N.15 ενημέρωσε ΕΚΚΡΕΜΟΤΗΤΕΣ+ADR+memory.
- **SHARED tree:** stage ΜΟΝΟ δικά σου· ΠΟΤΕ `git add -A`· ΜΗΝ αγγίξεις adr-index/MEP/furniture/άλλων.
- **ADR-040:** preview ΕΚΤΟΣ high-freq path (όπως ο τοίχος)· per-layer slab 3D ίσως αγγίξει `BimSceneLayer`/converters → τότε STAGE ADR-040 (CHECK 6B/6D). Έλεγξε στο recognition.

## 6. ΑΡΧΕΙΑ-ΚΛΕΙΔΙΑ
- Slab: `bim/types/slab-types.ts`, `bim-3d/converters/BimToThreeConverter.ts:463`, `bim/renderers/SlabRenderer.ts`, `ui/ribbon/data/contextual-slab-tab.ts`, `ui/ribbon/hooks/useRibbonSlabBridge.ts`
- Wall templates: τα §3 παραπάνω.
- Family-types infra: `bim/family-types/*` (built-in-types / resolve-effective-params / wall-type-auto-assign / store / service / commands)
- Memory: `project_adr412_bim_family_types.md`, `project_adr414_wall_type_live_preview.md`
