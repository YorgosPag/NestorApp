# ADR-509 — Background-Adaptive Entity Color (contrast-safe σε κάθε φόντο)

**Status:** Accepted (uncommitted) — 2026-06-20
**Owners:** DXF Viewer / 2D rendering + color
**Related:** ADR-375 (Object Styles / BIM line colors), ADR-454 (print plot-style), ADR-446 (3D «σαν 2Δ» dark background)

---

## Context

Ο 2D καμβάς είναι **καθαρό μαύρο** `#000000` (by design, «like AutoCAD model-space για maximum
contrast» — `color-config.ts`). Όμως το χρώμα του **εξωτερικού τοίχου** στο Object Styles SSoT
(`BIM_CATEGORY_LINE_COLORS.wallExterior`) είναι `#2b2f36` — το ίδιο το σχόλιο λέει «σχεδόν μαύρο,
ουδέτερο φόντο». WCAG contrast με το μαύρο ≈ **1.6** → ο τοίχος **εξαφανίζεται** (Giorgio report).

Η αρχική επιλογή χρώματος υπέθετε **λευκό χαρτί** (paper-space, όπου ο τοίχος-φόντο είναι σκούρος-
ουδέτερος). Σε **μαύρο model-space** αυτό αντιστρέφεται. Επαγγελματικό πρότυπο (AutoCAD): το «χρώμα 7»
είναι **background-adaptive** (άσπρο σε μαύρο, μαύρο σε λευκό) — ποτέ near-black γραμμή σε μαύρο.

**Απόφαση Giorgio:** full adaptive σε **ΟΛΑ** τα entity χρώματα (όχι band-aid recolor).

## Decision

Νέο **2D-render-time** SSoT που εγγυάται ελάχιστο contrast κάθε χρώματος ενάντια στο **ζωντανό**
2D canvas background:

| Module | Ρόλος |
|--------|-------|
| `config/color-math.ts` | Low-level SSoT: `parseHex`, `rgbToHex`, `channelToHex`, `luminance601` (BT.601), `srgbRelativeLuminance` (WCAG), `contrastRatio`, `mixHex`, `saturation`. **+ fill SSoT:** `RgbaColor`, `parseColor` (hex/rgb/rgba → {r,g,b,a}), `rgbaString`, `compositeOverHex` (alpha-over reuse `mixHex`). **De-dup:** το `print-color-policy.ts` reuse-άρει `parseHex`/`luminance601`/`channelToHex` (πρώην private copies → αφαιρέθηκαν). NB υπάρχει `rgbToHsl`/`hslToRgb` στο **ui layer** (`ui/color/utils.ts`) — ΔΕΝ reuse (config→ui = αντίστροφη εξάρτηση)· το `saturation` (3 γρ.) δεν είναι meaningful duplicate του HSL converter. |
| `config/adaptive-entity-color.ts` | `adaptColorToBackground(color, bg, minContrast)` (αυτούσιο αν ≥ κατώφλι· αλλιώς binary-search ελάχιστης ανάμειξης προς άσπρο/μαύρο) + `adaptEntityColorForCanvas(color)` (reads live `resolveDxfCanvasBackgroundHex`, memoized). `MIN_ENTITY_CONTRAST = 3.0` (WCAG AA graphical). **+ fill poché:** `adaptFillTintForCanvas(fill, bg?)` — composit-άρει το translucent tint πάνω στο bg, και αν το effective είναι αόρατο boost-άρει base→αντίθετο άκρο **ΚΑΙ** alpha→`FILL_BOOST_MAX_ALPHA=0.6` (binary-search), επιστρέφοντας `rgba` (διατηρεί translucency+hue). `MIN_FILL_CONTRAST = 2.0` (χαμηλότερο από γραμμές — background fill). |

**Γιατί render-time, ΟΧΙ στον `resolveSubcategoryStyle`:** ο κοινός resolver μοιράζεται από **3D
edges** (ADR-446, διαφορετικό background) **και print** (ADR-454, white paper). Η προσαρμογή είναι
**ειδική του 2D καμβά** → μπαίνει στους 2D renderers, ενάντια στο 2D bg. Έτσι 3D/print μένουν άθικτα.

**Συμπεριφορά:** μόνο τα near-black/near-bg χρώματα αλλάζουν. Κορεσμένα (beam amber `#b07d1f`,
column steel-blue `#2f6690`, slab taupe `#6e6358`, wall-interior `#6b7280`) έχουν contrast ≥ 3 →
**αυτούσια** (no-op). Σε μη-hex (rgba fills) → parseHex null → **αυτούσιο** (safe pass-through).

**Wiring (chokepoints):**
- **BIM lines:** `WallRenderer` (footprint stroke + hatch stroke/fill) → `adaptEntityColorForCanvas`.
- **BIM fill (poché):** `WallRenderer` body fill (γρ. 254) → `adaptFillTintForCanvas`. Η ρίζα του «σκούρου
  τοίχου» ήταν το **γέμισμα** (`rgba(120,144,156,0.18)` πάνω σε μαύρο → composited ≈ `rgb(22,26,28)`
  σχεδόν-μαύρο), ΟΧΙ το περίγραμμα (που ήδη διορθώθηκε). Το `adaptColorToBackground` δεν το έπιανε γιατί
  τα rgba (translucent) δεν είναι hex → επέστρεφαν αυτούσια· χρειάστηκε dedicated fill resolver.
- **DXF (imported):** `DxfRenderer.resolveStyleForRender` (live screen branches μόνο· print branch
  διατηρεί `applyPlotColor`).

## Consequences

- ✅ Ο τοίχος (και κάθε near-black χρώμα) γίνεται ορατός σε μαύρο canvas· future-proof για theme
  switching (light/Blender bg → χρώματα σκουραίνουν αυτόματα).
- ✅ Μηδέν duplicate color math (color-math SSoT· print de-dup).
- ✅ 3D edges + print **άθικτα** (resolver αμετάβλητος).
- ⚠️ Οι υπόλοιποι BIM renderers (Beam/Column/Slab/Opening/Stair/Foundation/MEP) **δεν** wire-αρίστηκαν
  ακόμη — και οι **lines** (`adaptEntityColorForCanvas`) και τα **fills** (`adaptFillTintForCanvas`). Τα
  fills τους είναι translucent category tints (ίδιο μοτίβο με τον τοίχο), οπότε **πιθανώς** δείχνουν
  σκούρα σε μαύρο φόντο όπως ο τοίχος → adopt on-touch (pending-ratchet) για πλήρες adaptive όλων.

## Consequences (fill / poché — 2026-06-20)
- ✅ Το **σώμα** του τοίχου διαβάζεται ως ανοιχτό-γκρι σε μαύρο canvas (όχι σχεδόν-μαύρο), διατηρώντας
  το CAD translucent feel (alpha ≤ 0.6, ποτέ opaque)· σε λευκό φόντο σκουραίνει σωστά (symmetric).
- ✅ Μηδέν duplicate: `parseColor`/`compositeOverHex`/`rgbaString` στο color-math SSoT (το compositing
  reuse-άρει `mixHex`)· **δεν** προστέθηκε 3ο `hexToRgba` (τα υπάρχοντα κάνουν την αντίστροφη φορά).

## Changelog
- **2026-07-01 (§axis-clip — άξονας τοίχου σταματά στην παρειά κολώνας, UNCOMMITTED)** — Giorgio (screenshot 212412): οι **διακεκομμένες γραμμές-άξονες** (location line) των τοίχων **διαπερνούσαν** το σώμα της κολώνας (φαινόταν σαν να «περνά μέσα» ο τοίχος) αντί να σταματούν στις παρειές. **Απόφαση Giorgio (locked, Επιλογή A):** ο άξονας κόβεται στην **παρειά** της κολώνας (όχι μέχρι το κέντρο), Revit/AutoCAD location-line behaviour. **FIX (FULL SSoT, μηδέν νέα geometry):** NEW pure `bim/walls/wall-axis-clip.ts` (`clipPolylineOutsidePolygons(points, polygons)`) — κρατά ΜΟΝΟ τα τμήματα του άξονα **ΕΞΩ** από τα column footprints, μέσω του ΕΝΟΣ `coveredIntervals`+`exposedComplement` SSoT (`geometry/shared/segment-polygon-coverage`, το ίδιο που τροφοδοτεί σοβά ADR-449 + wall host-plan ADR-401)· αλυσιδώνει συνεχή εκτεθειμένα κομμάτια → dash continuity όταν δεν υπάρχει κολώνα (μηδέν regression). **Wiring (per-frame, ADR-040 micro-leaf):** NEW `buildColumnFootprints(scene.entities)` (`dxf-renderer-frame-builders.ts`) → `DxfRenderer` → `EntityRendererComposite.setColumnFootprints` → `WallRenderer.setColumnFootprints` (setter, renderer never subscribes)· `WallRenderer.drawAxis` κόβει τον άξονα σε runs πριν το stroke. Parity και στο readonly media thumbnail (`bim-readonly-render.ts`). Default (χωρίς footprints) → ένα run = ο άξονας αυτούσιος. 8/8 NEW jest + 527/527 wall/renderer regression GREEN. ⚠️ ADR-040 critical (WallRenderer + DxfRenderer + EntityRendererComposite) → CHECK 6B/6D: stage ADR-040+509. 🔴 browser-verify (L-τοίχοι+κολώνα: διακεκομμένες σταματούν στις παρειές) + commit.
- **2026-06-22 (FULL SSoT body-fill — Giorgio order, UNCOMMITTED)** — Ο Giorgio παρατήρησε ότι το φόντο του **τοίχου** είχε διαφορετική διαφάνεια από της **κολώνας** + απαίτησε «ΟΛΑ τα BIM να χρησιμοποιούν τον ΙΔΙΟ κώδικα, FULL SSoT». **ΡΙΖΑ:** μόνο ο `WallRenderer` εφάρμοζε το `adaptFillTintForCanvas` (ADR-509)· οι υπόλοιποι 30+ BIM renderers (κολώνα/δοκάρι/πλάκα/…) ζωγράφιζαν body fill **raw** → σε μαύρο φόντο ο τοίχος boost-αριζόταν (0.18→~0.6) ενώ η κολώνα έμενε 0.22 → ασύμβατη διαφάνεια. **FIX:** NEW `bim/utils/bim-body-fill.ts` (`resolveBimBodyFill(category, cutState, objectStyles, fallbackFill, bgHex?)`) ενοποιεί σε ΕΝΑ κώδικα: `resolveVgFillTint` (ADR-375 V/G) → palette fallback → `adaptFillTintForCanvas` (ADR-509). **Έκταση (Giorgio SSoT audit, 3 γύροι «είσαι ικανοποιημένος;» → ΠΛΗΡΕΣ FULL SSoT):** ΟΛΑ τα translucent BIM body fills (~21 renderers/helpers) περνούν πλέον από το `bim-body-fill` module — το pattern ΔΕΝ υπάρχει inline πουθενά. (α) `resolveBimBodyFill(category, cut, styles, fallback)` (NEW σύνθεση `resolveVgFillTint ?? fallback → adaptFillTintForCanvas`) για όσους έχουν V/G category-tint + single palette fallback: Wall/Column/Beam/Slab/SlabOpening. (β) Όσοι το V/G+fallback λύνεται upstream/per-variant (Stair per-tread, Foundation, Roof, ThermalSpace, FloorFinish, WallCovering, ElectricalPanel, MepBoiler/Manifold/Radiator/Underfloor/WaterHeater/Fitting/Fixture/Segment, Furniture, mesh-silhouette-draw, beam-section-profile-draw, column-renderer-overlays) καλούν **ΑΠΕΥΘΕΙΑΣ** το ΥΠΑΡΧΟΝ adaptive SSoT `adaptFillTintForCanvas(resolvedFill)` — **ΟΧΙ** wrapper. (Giorgio SSoT audit: το αρχικό `adaptBimBodyFill` ήταν περιττό 1:1 wrapper του `adaptFillTintForCanvas` → **αφαιρέθηκε**· μηδέν περιττό indirection.) + `WALL_CATEGORY_FILL` base alpha → 0.22 (= `KIND_FILL` κολώνας). ⇒ ΟΛΑ τα BIM body fills == ίδια διαφάνεια σε κάθε φόντο, ΕΝΑΣ κώδικας. ΜΑΘΗΜΑ (Giorgio): το αρχικό «6 renderers» ήταν μερικό — 3 γύροι audit αποκάλυψαν +5 (palette) +10 (MEP/equipment) +5 (railing/silhouette/section)· το χειροκίνητο κυνήγι call-site ΔΕΝ κλιμακώνεται → χρειάζεται ratchet (κάτω). ⚠️ ADR-040 critical → CHECK 6D: stage ADR-040+375+509. ΟΛΑ τα BIM renderer jest 138/138 GREEN (stair-render-structure-style test ενημερώθηκε: ελέγχει `adaptBimBodyFill(...)` self-consistent αντί boosted literal)· tsc clean. 🔴 ratchet (SSoT registry module «raw translucent fillStyle σε bim/renderers απαγορευμένο» — εγγύηση πληρότητας για νέους renderers· βλ. pending-ratchet) + browser-verify + commit.
- **2026-06-20** — Δημιουργία. color-math + adaptive-entity-color SSoT (de-dup print)· wire WallRenderer
  (lines) + DxfRenderer. 27 jest + WallRenderer-wiring updated. 🔴 browser-verify + commit.
- **2026-06-20 (fill/poché)** — Background-adaptive **body fill**: color-math += `RgbaColor`/`parseColor`/
  `rgbaString`/`compositeOverHex`· adaptive-entity-color += `adaptFillTintForCanvas` (`MIN_FILL_CONTRAST=2.0`,
  `FILL_BOOST_MAX_ALPHA=0.6`)· wire `WallRenderer:254` body fill. 23 jest (14 prev + 9 fill/color-math) +
  8 WallRenderer-wiring πράσινα. 🔴 browser-verify + commit.
- **2026-06-20 (brighter wall lines)** — Giorgio: «περιγράμματα + γραμμή άξονα πιο φωτεινά». (α)
  `adaptEntityColorForCanvas(color, minContrast?)` δέχεται προαιρετικό κατώφλι (default `MIN_ENTITY_CONTRAST`,
  cache key += κατώφλι). (β) NEW `WALL_LINE_CONTRAST=9.0` στο `wall-render-palette.ts` (wall domain owns tuning).
  (γ) NEW `saturation()` στο color-math + NEW `adaptStructuralLineColorForCanvas(color, brightContrast)`:
  **hue-safe brighten** — δομικά γκρι (κορεσμός < `SATURATED_LINE_THRESHOLD=0.4`: #2b2f36→`#a8aaac`, #6b7280→
  ανοιχτό) ανοίγουν δυνατά· **ζωηρά** V/G overrides (κόκκινο #FF0000, κορεσμός 1.0) ΔΕΝ ξεπλένονται προς λευκό →
  μένουν στο standard 3.0. (δ) `WallRenderer` outline (γρ.279) + `drawAxis` → `adaptStructuralLineColorForCanvas`.
  (ε) `drawAxis` η γραμμή άξονα **δεν είχε explicit χρώμα** (κληρονομούσε το τελευταίο stroke) → τώρα
  `drawFootprint` επιστρέφει το raw edge color (μηδέν διπλό resolveSubcategoryStyle) και ο άξονας παίρνει το **ίδιο**
  φωτεινό χρώμα. ΜΑΘΗΜΑ: 4.5 (πρώτη απόπειρα) = +28/κανάλι, ανεπαίσθητο («καμία διαφορά»)· υψηλό uniform contrast
  ξεπλένει ζωηρά χρώματα → saturation-gating. 38 jest πράσινα. 🔴 browser-verify + commit.
