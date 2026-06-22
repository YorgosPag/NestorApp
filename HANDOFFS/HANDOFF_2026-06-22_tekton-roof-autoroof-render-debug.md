# HANDOFF — Tekton `<autoroof>` export: η στέγη ΔΕΝ ζωγραφίζεται στον Τέκτονα (ADR-512 Φ-A)

**Ημ/νία:** 2026-06-22
**ADR:** ADR-512 (Tekton .TEK export) · σχετικά: ADR-417 (roof), ADR-505 (unified export)
**Κατάσταση:** Φ-A autoroof exporter **ΚΩΔΙΚΑΣ ΕΤΟΙΜΟΣ + 147 export-suite GREEN + tsc clean**, αλλά **UNCOMMITTED** και **η στέγη ΔΕΝ εμφανίζεται στον Τέκτονα** (browser-verify FAILED). Το record παρσάρεται σωστά (panel δείχνει γωνία/υψόμετρο/πάχος) αλλά **δεν ζωγραφίζεται**.

---

## 0. ΚΑΝΟΝΕΣ (ΑΠΑΡΑΒΑΤΟΙ)
- **Commit ΜΟΝΟ ο Giorgio** (N.(-1)). **Working tree ΜΟΙΡΑΖΕΤΑΙ με άλλον agent** → `git add` ΜΟΝΟ τα δικά σου αρχεία (λίστα §6), ΠΟΤΕ `git add -A`.
- **FULL ENTERPRISE + FULL SSOT, σαν Revit.** **ΠΡΑΓΜΑΤΙΚΟ SSoT audit (grep) ΠΡΙΝ κάθε νέο κώδικα** — ο Giorgio το ελέγχει σκληρά. Reuse υπάρχοντα SSoT, ΜΗΔΕΝ διπλότυπα.
- Απαντάς **ΕΛΛΗΝΙΚΑ**. GOL + SSOT. tsc: ΕΝΑ τη φορά (N.17). N.15: μετά από κάθε φάση → update ADR-512 changelog/status + `local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt` + adr-index + memory `reference_tekton_tek_export.md`.

---

## 1. ΤΟ ΠΡΟΒΛΗΜΑ (ΤΟ ΑΝΟΙΧΤΟ ΖΗΤΗΜΑ)
Ζωγραφίζεις στέγη στο Nestor → export `.TEK` → άνοιγμα στον Τέκτονα → **η στέγη δεν φαίνεται πουθενά** (ακόμα και μετά Zoom Extents = δεν είναι θέμα προβολής). Το `<autoroof>` record **παρσάρεται** (το panel «Στέγη» δείχνει σωστά Γωνία/Υψόμετρο/Πάχος), αλλά **δεν χτίζεται/ζωγραφίζεται**.

**ΣΗΜΑΝΤΙΚΟ — το «warning 4000m» είναι RED HERRING:** εμφανίζεται ΚΑΙ στο working δείγμα του Τέκτονα → είναι κανονικό μήνυμα του skeleton/building params, **ΟΧΙ** αιτία του προβλήματος. Μην ασχοληθείς μ' αυτό.

---

## 2. ΤΙ ΕΧΕΙ ΓΙΝΕΙ (όλα UNCOMMITTED, 147 export-suite GREEN, tsc clean δικά μου)
Ο autoroof exporter **υπάρχει και είναι σχεδόν σωστός**. Modules:
- `export/core/tek/tek-record-templates.ts` — `AUTOROOF_RECORD_TEMPLATE` (placeholders ID/ELEVATION/**VOLUME**/WIDTH/COLOR/V3LIST/POINTS) + `AUTOROOF_POINT_TEMPLATE` (X/Y/ANGLE) + `AUTOROOF_V3_TEMPLATE` (X/Y/Z). AUTO-GEN από δείγμα.
- `export/core/tek/tek-types.ts` — `TekRoof`/`TekRoofPoint`/`TekRoofFace`.
- `export/core/tek/tek-geometry.ts` — `roofFaceRingToMeters` (per-vertex z, mm→m, + `dedupeFaceRing`)· `signedAreaXY`· `reverseRoofFootprint` (CCW normalization με σωστή μετατόπιση κλίσης ανά ακμή).
- `export/core/tek/tek-xml-writer.ts` — `buildAutoroofRecordXml`/`buildRoofPointsXml`/`buildRoofV3ListXml`· `injectTekEntities` πήρε 4ο `autoroofsXml` param.
- `export/core/tek/bim-to-tek.ts` — `collectTekRoofs`/`toTekRoof` (στέγη βγήκε από `isTekPlaneEntity`).
- `export/core/tek/tek-skeleton.template.ts` — marker `<!--TEK_AUTOROOF_RECORDS-->` μέσα στο `<autoroof>`.
- `export/formats/tek-export-adapter.ts` — wiring `collectTekRoofs`→`autoroofsXml`.

### Διορθώσεις που εφαρμόστηκαν (κατά σειρά αποκλεισμού — ΟΛΕΣ σωστές αλλά καμία δεν έλυσε το render):
1. **dedup faces** (`dedupeFaceRing`): το `geometry.faces[].outline` είναι closed ring με διπλές διαδοχικές κορυφές + κλείσιμο → καθαρίστηκε σε απλά πολύγωνα. ✅ σωστό, ΔΕΝ έλυσε render.
2. **CCW winding** (`signedAreaXY`+`reverseRoofFootprint`): το footprint έβγαινε **CW** (canvas Y «κάτω»), τα working roofs είναι **CCW**. Normalize σε CCW (επιβεβαιωμένο: τα working flat+hip είναι CCW). ✅ σωστό, ΔΕΝ έλυσε render.
3. **roof_volume_acc** (από 0 → `geometry.volumeM3`): **ΑΠΟΔΕΙΧΘΗΚΕ ΛΑΘΟΣ ΥΠΟΘΕΣΗ** — το working **επίπεδο** roof έχει `roof_volume_acc=0` και ΖΩΓΡΑΦΙΖΕΤΑΙ. Κρατήθηκε (harmless/faithful) αλλά **ΔΕΝ** είναι ο λόγος. (Μπορείς να το κρατήσεις ή revert — δική σου κρίση.)

---

## 3. Η ΤΡΕΧΟΥΣΑ ΥΠΟΘΕΣΗ (το επόμενο βήμα διάγνωσης)
Σύγκριση δικού μου record vs **2 working roofs** (φτιαγμένα ΣΤΟΝ Τέκτονα, `ΔΙΑΦΟΡΑ-2.tek`, ΖΩΓΡΑΦΙΖΟΝΤΑΙ):

| | working επίπεδη | working τετράριχτη (hip) | **δικιά μου (αόρατη)** |
|---|---|---|---|
| roof_volume_acc | **0** | 168.66 | 0 (→ volume=0 OK) |
| winding `<point>` | CCW | CCW | CCW ✅ |
| **`<angle>` ανά ακμή** | **όλες 0** | **όλες 0.366519 (21°)** | **[0.5236, 0, 0.5236, 0] ΑΝΑΜΕΙΚΤΕΣ** ⚠️ |
| `<v3list>` | 1 onev3list / **1 vertex** (degenerate!) | 4 faces πλήρη | 2 faces πλήρη |

**ΚΡΙΣΙΜΟ ΣΥΜΠΕΡΑΣΜΑ #1:** το working **επίπεδο** roof έχει `<v3list>` με **ΜΙΑ degenerate κορυφή** → άρα **ο Τέκτων ΞΑΝΑΥΠΟΛΟΓΙΖΕΙ το 3D από `<point>`+`<angle>`** (το v3list είναι απλώς cache, αγνοείται στο import). Άρα **το πρόβλημα είναι στο `<point>`/`<angle>` ή σε field εκτός roof record**, ΟΧΙ στα faces.

**ΚΡΙΣΙΜΟ ΣΥΜΠΕΡΑΣΜΑ #2 (η ΚΥΡΙΑ υπόθεση):** και τα 2 working roofs έχουν **ΟΜΟΙΟΜΟΡΦΗ** κλίση σε ΟΛΕΣ τις ακμές (hip=όλες 21°, flat=όλες 0°). Το δικό μου είναι **δικλινές/gable** με **ΑΝΑΜΕΙΚΤΕΣ** κλίσεις [30°,0,30°,0]. **Υπόθεση: ο Τέκτων autoroof ίσως δεν υποστηρίζει gable (ανάμεικτες angle=0/angle≠0 ακμές) → αδύνατη γεωμετρία → αόρατη στέγη.**

### ⏳ ΑΠΟΦΑΣΙΣΤΙΚΟΣ ΕΛΕΓΧΟΣ ΠΟΥ ΕΚΚΡΕΜΕΙ (ζητήθηκε από Giorgio, περιμένει απάντηση):
**Σχεδίασε στο Nestor μια ΤΕΤΡΑΡΙΧΤΗ στέγη (ΟΛΕΣ οι πλευρές κεκλιμένες, uniform) → export → render;**
- **Αν εμφανιστεί** → επιβεβαιώνεται ότι το πρόβλημα είναι οι **δικλινείς/ανάμεικτες κλίσεις** → χρειάζεται ειδικός χειρισμός (βλ. §4).
- **Αν ΠΑΛΙ δεν εμφανιστεί** → το πρόβλημα είναι **εκτός roof record** (skeleton/building/floor params) → σύγκρινε το skeleton μου με το working `ΔΙΑΦΟΡΑ-2.tek` (§4 fallback).

---

## 4. ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (FULL SSoT, σαν Revit)

### Αν το πρόβλημα είναι gable/ανάμεικτες κλίσεις:
- Κατάλαβε πώς ο Τέκτων αναπαριστά **δικλινή** στέγη. Πιθανότητες: (α) δεν υποστηρίζεται από `<autoroof>` → χρειάζεται διαφορετική αναπαράσταση· (β) η angle=0 ακμή πρέπει να έχει διαφορετική σήμανση (όχι σκέτο 0) για «αέτωμα/gable end»· (γ) χρειάζεται **δείγμα Τέκτονα με δικλινή** για decode. **ΖΗΤΑ από Giorgio δείγμα δικλινούς στέγης φτιαγμένο στον Τέκτονα.**
- **SSoT:** η κλίση ανά ακμή έρχεται από `params.edges[i]` (`definesSlope`+`slope`) μέσω του υπάρχοντος `roofSlopeToRatio` (`bim/geometry/roof-slope-units.ts`). Το `definesSlope=false` = αέτωμα. ΜΗΝ φτιάξεις νέο slope subsystem.

### Fallback (αν δεν είναι gable — σύγκρινε skeletons):
- Έχεις 2 αρχεία: το **working** `ΔΙΑΦΟΡΑ-2.tek` (Τέκτων native, roofs ΖΩΓΡΑΦΙΖΟΝΤΑΙ) και τα **δικά μου exports** (δεν ζωγραφίζονται). Diff το **non-roof** μέρος (building/floor `<parameters>`) — ίσως το sanitized skeleton μου (`tek-skeleton.template.ts`) λείπει κάποια building/floor ιδιότητα που χρειάζεται το roof rendering.
- **ΟΡΙΣΤΙΚΟ ΠΕΙΡΑΜΑ:** πάρε το working `ΔΙΑΦΟΡΑ-2.tek`, **αντικατέστησε ΕΝΑ roof record** με το δικό σου format (ίδιες coords), δώσε στον Giorgio να το ανοίξει. Αν το δικό σου record ΔΕΝ ζωγραφίζεται μέσα στο working αρχείο → το πρόβλημα είναι στο record (bisect field-by-field). Αν ζωγραφίζεται → το πρόβλημα είναι στο skeleton μου.

### Διαγνωστική τεχνική που ΔΟΥΛΕΨΕ:
Γράψε temp jest test (`export/core/tek/__tests__/roof-diag.test.ts`) που χτίζει roof με **πραγματικό** `computeRoofGeometry` + `collectTekRoofs` και κάνει `console.log` το XML. Σύγκρινε field-by-field με τα working δείγματα. **ΔΙΑΓΡΑΨΕ το diag μετά.**

---

## 5. DECODED SCHEMA (μην το ξανα-derive)
`<autoroof>` (type 8), από `ΔΙΑΦΟΡΑ.tek`/`ΔΙΑΦΟΡΑ-2.tek`:
- `<elevation>`=στάθμη βάσης/γείσου (m)· `<width>`=πάχος (m)· `<roof_volume_acc>`=όγκος (0 αποδεκτό).
- `<point><record>`: footprint κορυφή `pX/pY` (m, **CCW**) + **`<angle>`=κλίση ακμής σε RADIANS** (0=αέτωμα/επίπεδο). Ακμή i = κορυφή i→i+1. **Ο Τέκτων χτίζει τη στέγη ΑΠΟ ΕΔΩ.**
- `<v3list>`: cache «νερών» (faces)· `<onev3list>` ανά face με `<v3>` `pvX/pvY/pvZ` (m). **Αγνοείται στο import** (επίπεδο roof έχει degenerate 1-vertex v3list κι όμως ζωγραφίζεται).
- 3 `<material>` blocks + `<draw_vertical>1</draw_vertical>` = σταθερά.
- **`<line>` (type4)**: `v0X/Y`+`elevation0`→`v1X/Y`+`elevation1` (Φ-D decoded, ΟΧΙ implemented).
- **`<arc>` (type5)**: `<circle>0=τόξο/1=κύκλος`+`centreX/Y`+`p0X/Y`+`p1X/Y` (Φ-D decoded).
- **`<hatch>` ΚΕΝΟ** στα δείγματα (Φ-B blocked).

---

## 6. ΑΡΧΕΙΑ ΜΟΥ (stage ΜΟΝΟ αυτά — shared tree)
```
src/subapps/dxf-viewer/export/core/tek/bim-to-tek.ts
src/subapps/dxf-viewer/export/core/tek/tek-geometry.ts
src/subapps/dxf-viewer/export/core/tek/tek-types.ts
src/subapps/dxf-viewer/export/core/tek/tek-xml-writer.ts
src/subapps/dxf-viewer/export/core/tek/tek-record-templates.ts
src/subapps/dxf-viewer/export/core/tek/tek-skeleton.template.ts
src/subapps/dxf-viewer/export/core/tek/__tests__/tek-export.test.ts
src/subapps/dxf-viewer/export/formats/tek-export-adapter.ts
src/subapps/dxf-viewer/export/formats/__tests__/tek-export-adapter.test.ts
docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md
docs/centralized-systems/reference/adr-index.md
local_ΕΚΚΡΕΜΟΤΗΤΕΣ.txt
```
⚠️ ΜΗΝ αγγίξεις το `docs/.../ADR-507-hatch-creation-system.md` (άλλος agent).

## 7. ΔΕΙΓΜΑΤΑ (στο C:\Users\user\Downloads\)
- **`ΔΙΑΦΟΡΑ-2.tek.txt`** ⭐ — Τέκτων native, **roofs ΖΩΓΡΑΦΙΖΟΝΤΑΙ** (1 επίπεδη + 1 τετράριχτη + κύκλος+τόξο+5 γραμμές). **ΤΟ ΚΑΛΥΤΕΡΟ reference.** Επίπεδη roof @ γρ.24259, hip @ γρ.24285.
- `ΔΙΑΦΟΡΑ.tek.txt` — Τέκτων native (3 roofs, line/arc decoded από εδώ).
- `ΕΞΑΓΩΓΗ.tek.txt` / `Επίπεδο_1_Επίπεδο_1.tek.txt` — **δικά μου exports** (δεν ζωγραφίζονται· autoroof @ γρ.24174). Χρήσιμα για diff vs working.

## 8. Reference
- ADR: `docs/centralized-systems/reference/adrs/ADR-512-tekton-tek-export.md` (changelog έχει όλο το ιστορικό v2/v3/v4)
- Memory: `~/.claude/projects/C--Nestor-Pagonis/memory/reference_tekton_tek_export.md`
- SSoT roof: `bim/geometry/roof-slope-units.ts` (`roofSlopeToRatio`), `bim/geometry/roof-geometry.ts` (`computeRoofGeometry`, `RoofGeometry.faces[].outline`+`volumeM3`), `bim/types/roof-types.ts` (`RoofParams.outline/edges/basePivotZ/thickness`).
