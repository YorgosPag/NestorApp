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

## 7. Επόμενα (TEK coverage gaps — §6 backlog)

Μετά τη διόρθωση του hang, τα εναπομείναντα TEK `missing` (coverage guard §6):
mtext→`<text>`, point, ellipse/spline→tessellated `<line>`/`<arc>`, dimension, block-expand,
BIM column/beam/opening/foundation/… (reuse decompose SSoTs). Καθένα κλείνει το αντίστοιχο
`missing` στο `entity-export-coverage.ts` + changelog εδώ.

**Σχετικό DXF-for-Tekton finding (2026-07-13):** ο minimal DXF importer του Τέκτονα δεν διαβάζει
old-style POLYLINE / native HATCH / INSERT-blocks — γι' αυτό ένα AutoCAD-mode (`polyline`) DXF χάνει
οντότητες στον Τέκτονα. Ο σωστός Tekton target είναι το `.tek` (τώρα που δεν κολλάει). Follow-up αν
χρειαστεί DXF-for-Tekton: `lines` mode + in-place explode των blocks.

## 8. Changelog

- **2026-07-13** — Στάδιο Α (golden lock) + Στάδιο Β (DXF ellipse/spline/xline/ray native +
  tessellated, ezdxf-verified, μηδέν regression) + Στάδιο Δ (coverage guard).
- **2026-07-13** — Στάδιο Γ (TEK hang) **ROOT-CAUSED & FIXED**: controlled Tekton isolation →
  ένοχος τα `<text>` records με XML entities (`&apos;`/`&amp;`) που ο parser του Τέκτονα δεν
  αποκωδικοποιεί. Νέος `escapeTektonText` (tek-content-escape.ts) + 5 call-sites στο tek-xml-writer.
  Confirm στον πραγματικό Τέκτονα (Giorgio). 128 tek-tests πράσινα, jscpd καθαρό.
