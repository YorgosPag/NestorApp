# ADR-648 — Πλήρης κάλυψη οντοτήτων στην εξαγωγή DXF & Τέκτονας (.tek)

**Status:** In progress (Στάδιο Α+Β DONE & verified · Στάδιο Γ TEK-hang **ROOT-CAUSED & FIXED** · TEK coverage gaps = follow-up)
**Date:** 2026-07-13
**Context:** DXF/TEK export entity coverage — δύο συμπτώματα δείγματα Giorgio (αρχεία 46.tek hang, 19.dxf missing entities)
**Related:** ADR-505 (unified export), ADR-636 (professional DXF), ADR-512 (Tekton areas), ADR-608 (tek objects), ADR-647 (R12 hatch parity)

---

## 1. Πρόβλημα

Κατά την εξαγωγή, δεν εξάγονται ΟΛΕΣ οι οντότητες σωστά:

1. **DXF (αρχείο 19):** ο dispatch `default:` παρέλειπε **σιωπηλά** `ellipse`/`spline`/`xline`/`ray`
   (+ group/array). Οι υπόλοιποι τύποι εξάγονταν σωστά (ανοίγει στο AutoCAD).
2. **TEK (αρχείο 46):** ο Τέκτονας **κολλάει** ανοίγοντάς το.

**⛔ ΑΠΑΡΑΒΑΤΟ:** μηδενικό regression στις ήδη-AutoCAD-συμβατές οντότητες. Λύση = per-format
isolated exporters (τα δύο paths δεν μοιράζονται writer) + additive-only DXF cases + golden lock.

## 2. SSoT Audit (2026-07-13)

| Τύπος | DXF | TEK |
|---|---|---|
| line/polyline/lwpolyline/rect(angle)/circle/arc/text/hatch | ✅ | ✅ |
| point / mtext / dimension / leader / block | ✅ native | ❌ MISSING |
| **ellipse / spline / xline / ray** | ❌→✅ (Στάδιο Β) | ❌ MISSING |
| annotation-symbol / scale-bar | ✅ decompose | ✅ |
| BIM wall/slab/roof/stair | ✅ flatten | ✅ native |
| BIM column/beam/opening/foundation/railing/furniture/mep-* | ✅ flatten | ❌ MISSING |

## 3. Στάδιο Α — Golden lock (DONE)

`export/core/__tests__/dxf-entity-dispatch-characterization.test.ts` — `toMatchInlineSnapshot`
(υπάρχον χαρακτηρισμός-pattern, reuse). Κλειδώνει byte-identical την ENTITIES-section έκδοση κάθε
τύπου· κάθε αλλαγή σε ΥΠΑΡΧΟΝΤΑ τύπο → σπάει το snapshot. Νέος τύπος = ΝΕΟ snapshot.

## 4. Στάδιο Β — DXF additive gaps (DONE & VERIFIED)

**Big-player πρακτική** (Revit/AutoCAD/ArchiCAD): native στο AutoCAD path, tessellated στον
minimal-parser Τέκτονα (ίδιο pattern με το υπάρχον `arc` explode).

- **ellipse** → native `ELLIPSE` (AcDbEllipse: center 10/20/30, major-axis endpoint 11/21/31,
  ratio 40=minor/major, params 41/42) · explode → tessellated polyline μέσω του SSoT
  `geometry-ellipse-utils.tessellateEllipseArc` (ίδιος sampler με τον καμβά).
- **spline** → native `SPLINE` με **generated clamped-uniform knot vector** (πάντα έγκυρο →
  δεν κάνει abort ο DXFIN) · explode → Catmull-Rom polyline μέσω νέου SSoT
  `rendering/entities/shared/geometry-spline-utils.tessellateSplinePoints` (κοινό με το trim →
  αφαιρέθηκε το διπλότυπο `catmullRom` από το `trim-intersection-mapper`).
- **xline/ray** → native `XLINE`/`RAY` (base 10/20/30 + UNIT direction 11/21/31) · explode →
  drop (ο Τέκτων δεν έχει infinite line· finite segment θα ήταν ψέμα για την έκταση).

Νέοι emitters στο `dxf-ascii-primitive-emitters.ts`: `emitEllipse`, `emitSpline` (+
`clampedUniformKnots`), `emitConstructionLine`, `unitDirection`. Cases στο
`dxf-ascii-entity-dispatch.ts`. **Μηδέν** αλλαγή σε υπάρχοντα case → byte-identical.

**Verification:** `ezdxf 1.4.4` round-trip σε πλήρες professional DXF με τους 7 νέους records →
**READFILE OK, 0 audit errors, 0 fixes**. 70 writer-tests + adapter + trim + golden **πράσινα**.
`jscpd:diff` καθαρό. Τελικός AutoCAD spot-check = Giorgio.

## 5. Στάδιο Γ — TEK hang: ROOT-CAUSED & FIXED

### 5.1 Αποκλεισμός file-level υποθέσεων (ground-truth vs native δείγματα)

| Υπόθεση | Έλεγχος | Ετυμηγορία |
|---|---|---|
| Εκατομμύρια `<line>` (dense hatch) | 5044 records μόνο | ❌ ΟΧΙ |
| NaN/Infinity coords | 0 | ❌ ΟΧΙ |
| Malformed XML | `ET.parse` OK | ❌ ΟΧΙ (well-formed) |
| Inline `<material>` bloat | native EYOT705 (savecount 33) το κάνει κι αυτό | ❌ ΟΧΙ (κανονικό) |
| Μεγάλο hatch span (23m) | native αρχεία έχουν έως 44m & ανοίγουν | ❌ ΟΧΙ |

### 5.2 Controlled isolation στον πραγματικό Τέκτονα (Giorgio, 2026-07-13)

1. **Container isolation:** άδειασμα ενός container τη φορά από το 46.tek → μόνο το `no_text`
   άνοιξε· τα no_line/no_arc/no_hatch κόλλησαν → **ένοχος = τα `<text>` records**.
2. **Content-vs-count:** 468 text με αλλαγμένο περιεχόμενο (ascii/greek/1-char) → **ΑΝΟΙΓΟΥΝ**·
   αρχικό περιεχόμενο ακόμα και 117 records → **κολλάει** ⇒ ΟΧΙ πλήθος, ΟΧΙ ελληνικά, αλλά **περιεχόμενο**.
3. **Field diff:** το `<s>` περιείχε `A&apos;`/`B&apos;` (άξονες Α'/Β') και `&amp;` — **XML entities**.
   Native `EYOT705` (savecount 33, ανοίγει) έχει **raw `'`**· καμία native έξοδος δεν έχει `&amp;`.
4. **Confirm fix:** un-escape (`&apos;`→`'`, `&amp;`→`+`) → **ΑΝΟΙΓΕΙ**· raw `&` → **κολλάει**.

### 5.3 Root cause & fix

**Ο parser του Τέκτονα ΔΕΝ αποκωδικοποιεί XML entities.** Ο TEK writer χρησιμοποιούσε το generic
`escapeXml` (`@/lib/xml/escape-xml`) στα user-content πεδία (`<s>`, tags, ονόματα τοίχων/ανοιγμάτων),
παράγοντας `&apos;`/`&amp;` → **hang**.

**Fix:** νέος Tekton-safe encoder `export/core/tek/tek-content-escape.ts` (`escapeTektonText`):
`'`/`"` γράφονται **ΣΚΕΤΑ** (νόμιμα σε XML text content, Tekton-readable)· τα δομικά `&`/`<`/`>`
(που θα απαιτούσαν entity) → **ασφαλής αντικατάσταση** (`&`→`+`, `<`→`(`, `>`→`)`). Το αρχείο μένει
έγκυρο XML ΧΩΡΙΣ κανένα entity. Οι 5 κλήσεις `escapeXml` στο `tek-xml-writer.ts` → `escapeTektonText`.
Το generic `escapeXml` (shared SSoT) **δεν** πειράχτηκε (άλλοι consumers το χρειάζονται σωστό).

## 6. Στάδιο Δ — Coverage guard

`export/core/entity-export-coverage.ts` (declarative SSoT «τύπος × απόφαση ανά format») +
`__tests__/entity-export-coverage.test.ts` δεμένο στο `RENDERABLE_ENTITY_TYPES` (mirror
`rotate-entity-coverage`): νέος renderable τύπος → σπάει το test → συνειδητή απόφαση ανά format,
ποτέ ξανά σιωπηλή απώλεια.

## 7. Στάδιο Ε — Πλήρης ταύτιση γραμμοσκιάσεων (DONE)

### 7.1 Ground-truth (δείγματα Giorgio, `Desktop/KADOS/ΓΡΑΜΜΟΣΚΙΑΣΕΙΣ/`)

Μία γραμμοσκίαση AutoCAD (`SQUARE`), το ίδιο σχέδιο σε 4 μορφές:

| Αρχείο | Μέτρηση |
|---|---|
| `ORIGINAL_AUTOCAD_EXPLODED.dxf` | **15.318 LINEs** ← ground truth: έτσι το ζωγραφίζει το AutoCAD |
| `EXPORTED_NESTOR.dxf` | 1 native `HATCH`, `78=2` γραμμές μοτίβου (53=0 & 53=90, delta 0.127, dashes ±0.127) — ο πρωτότυπος ορισμός **διατηρημένος** (`inlinePattern`, ADR-644 #7d) ✅ |
| `EXPORTED_NESTOR.tek` | 1 native `<hatch>`: `<type>72`, `scaleX 0.15`, `rotation 0` |
| `EXPORTED_TEKTON.tek/.dxf` (re-save από τον Τέκτονα, `savecount=1`) | **43 διαγώνιες γραμμές** ❌ |

**Το boundary μας ήταν ήδη τέλειο** (ο Τέκτων επέστρεψε τις 8 ακμές ταυτόσημες). Το **μοτίβο** ήταν
τελείως άλλο σχέδιο — όχι άλλη πυκνότητα: 15.318 τετραγωνάκια → 43 διαγώνιες.

### 7.2 Απόφαση: **διακόπτης** στο Export dialog (Επιλογή Γ)

Πρώτη υλοποίηση έκανε την αποδόμηση **πάντα** — ο Giorgio εξήγαγε πραγματικό σχέδιο και βγήκε
**107 MB**. Απόφαση: `TekHatchMode` (mirror του υπάρχοντος `TekSymbolMode`), **default `native`**.

| Mode | Αρχείο | Εμφάνιση | Επεξεργάσιμο; |
|---|---|---|---|
| **`native`** (default) | **Ελαφρύ** | Μοτίβο βιβλιοθήκης Τέκτονα — **κατά προσέγγιση** | ✅ ενιαίο hatch |
| **`exploded`** | **Βαρύ** (~1,4 KB/γραμμή) | **Πλήρης ταύτιση** με AutoCAD (~0,1%) | ❌ σκέτες γραμμές |

Touch points (ίδιο μονοπάτι με το `symbolMode`): `export/types.ts` → `export-service.ts` →
`tek-export-adapter.ts` → `useExportDialogState.ts` → `ExportDialog.tsx` + i18n (el/en).
i18n: `export.tekHatchMode` / `export.tekHatchModes.{native,exploded}`.

### 7.3 Ο μηχανισμός αποδόμησης (`exploded`)

Η βαθμονόμηση του native mapping (Επιλογή Α) **απορρίφθηκε**: ο Τέκτων δεν *έχει* το `SQUARE` στη
βιβλιοθήκη του (`pattern.inf` ≠ `acad.pat`) — καμία ρύθμιση scale/rotation δεν γεφυρώνει αυτό.

**NEW** `export/core/tek/tek-hatch-explode.ts` → `collectTekHatchFillLines()`: περίγραμμα + γραμμές
μοτίβου ως `<line>` records. **FULL SSoT** — ίδια κλήση στο ίδιο `buildHatchEntitySegments()` που
τρέφει ήδη τον canvas renderer ΚΑΙ το DXF lines-mode (`emitHatch`, explode=true). Μηδέν pattern math.
Το ακριβές AutoCAD μοτίβο επιβιώνει μέσω του `inlinePattern` — **κανένα name-mapping**.

**Αποτέλεσμα (μετρημένο):** 15.346 γραμμές vs 15.318 του AutoCAD → **απόκλιση ~0,1%** (οι 8 = το
περίγραμμα). Χρόνος 420 ms, XML 21,3 MB.

`collectTekHatches(entities, f, skipIds)` = **fallback**: native `<hatch>` μόνο για solid/gradient
(δεν έχουν γραμμές) και για ό,τι κόβει ο dense guard. Το `skipIds` αποτρέπει διπλό γέμισμα.

### 7.4 Dense guard — ΠΡΙΝ τον υπολογισμό, όχι μετά (ADR-647)

`estimateHatchFillLines()` = bbox-εμβαδόν ÷ βήμα² (reuse `hatchMinWorldSpacing` + `polygonBbox`).
Όρια: **40.000** ανά γραμμοσκίαση / **120.000** συνολικά → warning + fallback σε native.

> ⚠️ **Ο έλεγχος ΠΡΕΠΕΙ να είναι pre-flight.** Πρώτη υλοποίηση μετρούσε *μετά* το
> `buildHatchEntitySegments` → προστάτευε το αρχείο ενώ το UI είχε ήδη παγώσει: ένα 400×400 boundary
> με βήμα 0.127 χρειάστηκε **164 s** και μετά **έσκασε με OOM στα 4 GB**. Regression lock: το
> dense-guard test τρέχει με `timeout 5s`.

### 7.5 🐛 Bug που αποκαλύφθηκε στο SSoT (διορθώθηκε)

`hatchMinWorldSpacing()` ρωτούσε **πρώτα το catalog** και μόνο μετά το `inlinePattern` — αντίστροφη
σειρά από το `buildHatchEntitySegments` (inlinePattern-first, ADR-644 #7d). Άρα μετρούσε την
πυκνότητα **άλλου μοτίβου** από αυτό που τελικά χτίζεται. Συνέπειες:
- **(α)** ο density-LOD του `HatchRenderer` έκρινε με λάθος πυκνότητα κάθε *imported* hatch·
- **(β)** ο dense guard υποεκτιμούσε → ο builder έσκαγε (το OOM του §7.3).

**FIX** (`hatch-pattern-geometry.ts`): `inlinePattern` πρώτα, catalog μετά — ίδια σειρά με τον builder.

## 8. Επόμενα (TEK coverage gaps — §6 backlog)

Μετά τη διόρθωση του hang, τα εναπομείναντα TEK `missing` (coverage guard §6):
mtext→`<text>`, point, ellipse/spline→tessellated `<line>`/`<arc>`, dimension, block-expand,
BIM column/beam/opening/foundation/… (reuse decompose SSoTs). Καθένα κλείνει το αντίστοιχο
`missing` στο `entity-export-coverage.ts` + changelog εδώ.

**Σχετικό DXF-for-Tekton finding (2026-07-13):** ο minimal DXF importer του Τέκτονα δεν διαβάζει
old-style POLYLINE / native HATCH / INSERT-blocks — γι' αυτό ένα AutoCAD-mode (`polyline`) DXF χάνει
οντότητες στον Τέκτονα. Ο σωστός Tekton target είναι το `.tek` (τώρα που δεν κολλάει). Follow-up αν
χρειαστεί DXF-for-Tekton: `lines` mode + in-place explode των blocks.

## 9. Changelog

- **2026-07-13** — Στάδιο Α (golden lock) + Στάδιο Β (DXF ellipse/spline/xline/ray native +
  tessellated, ezdxf-verified, μηδέν regression) + Στάδιο Δ (coverage guard).
- **2026-07-13** — Στάδιο Γ (TEK hang) **ROOT-CAUSED & FIXED**: controlled Tekton isolation →
  ένοχος τα `<text>` records με XML entities (`&apos;`/`&amp;`) που ο parser του Τέκτονα δεν
  αποκωδικοποιεί. Νέος `escapeTektonText` (tek-content-escape.ts) + 5 call-sites στο tek-xml-writer.
  Confirm στον πραγματικό Τέκτονα (Giorgio). 128 tek-tests πράσινα, jscpd καθαρό.
- **2026-07-13** — **Στάδιο Ε (γραμμοσκιάσεις)**: ground-truth 4 αρχείων (§7.1) απέδειξε ότι το
  native `<hatch>` δίνει **43 διαγώνιες αντί για 15.318 τετραγωνάκια**. NEW `tek-hatch-explode.ts`
  (`collectTekHatchFillLines`) → αποδόμηση σε `<line>` μέσω του SSoT `buildHatchEntitySegments`
  (ίδιες γραμμές με canvas + DXF lines-mode· μηδέν νέα pattern math). **Απόκλιση από AutoCAD ~0,1%**
  (15.346 vs 15.318). Native `<hatch>` = fallback (solid/gradient/dense) μέσω `skipIds`.
  Pre-flight dense guard (`estimateHatchFillLines`, 40k/120k) — ο post-hoc έλεγχος έσκαγε με OOM.
  🐛 FIX στο SSoT: `hatchMinWorldSpacing` ρωτούσε catalog πριν το `inlinePattern` (§7.5) — χτυπούσε
  και τον density-LOD του `HatchRenderer`. jscpd καθαρό.
- **2026-07-13** — Στάδιο Ε **επιλογή Γ (διακόπτης)**: η «πάντα-αποδόμηση» έβγαλε **107 MB** σε
  πραγματικό σχέδιο (Giorgio). Νέο `TekHatchMode` (`native` default = ελαφρύ/επεξεργάσιμο/κατά
  προσέγγιση· `exploded` = πλήρης ταύτιση/βαρύ), mirror του `TekSymbolMode` σε ΟΛΟ το μονοπάτι
  (types → service → adapter → dialog state → dialog UI → i18n el/en). Solid/gradient → native
  πάντα. **429 export-tests πράσινα**, jscpd καθαρό.

- **2026-07-17 — Στάδιο Δ: δύο νέες εγγραφές στον πίνακα κάλυψης (ξεχωριστή συνεδρία, UNCOMMITTED).** Το coverage test («ΚΑΘΕ renderable type έχει entry») **κοκκίνισε σωστά**: δύο τύποι είχαν μπει στο `RENDERABLE_ENTITY_TYPES` χωρίς απόφαση εξαγωγής — `leader` (`16e9f4cc`, ADR-635 Φ B) και `topo-surface` (`7f215980`, ADR-662 Φ2β). Παρέμεινε κόκκινο ~6 commits γιατί κανένα gate δεν έτρεχε τα anchors (ADR-587 §6.1).
  - `leader: { dxf: 'native', tek: 'missing' }` — native LEADER στο `dxf-ascii-entity-dispatch` (case υπάρχει, επαληθευμένο με grep)· ο TEK collector δεν το πιάνει (ίδια οικογένεια με mtext/point/dimension, §7).
  - `'topo-surface': { dxf: 'missing', tek: 'missing' }` — **ΟΧΙ `drop`**: το DXF **έχει** έννοια για TIN surface (3DFACE / POLYFACE MESH, όπως εκπέμπει το Civil 3D) → γνήσιο κενό προς κλείσιμο, όχι σκόπιμη παράλειψη (η διάκριση `drop` vs `missing` του §2 είναι ακριβώς αυτή). Ο Τέκτων μένει `missing` μέχρι να τεκμηριωθεί ότι δεν έχει terrain concept.
  - **Συνέπεια στα golden:** backlog snapshot **27 → 29**· `dxfMissing` golden = `['angle-measurement', 'opening-info-tag', 'topo-surface']` (το `topo-surface` είναι `DXF_RENDERABLE_TYPE`). Και τα δύο ενημερώθηκαν **σκόπιμα**, όπως απαιτεί το §7.
  - **Νέο gate:** το `entity-export-coverage.ts` είναι πλέον trigger του **CHECK 5C** (pre-commit + CI) → ο πίνακας δεν μπορεί να αποκλίνει ξανά σιωπηλά.
