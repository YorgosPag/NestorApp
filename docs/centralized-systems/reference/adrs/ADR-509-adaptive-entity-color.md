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
| `config/color-math.ts` | Low-level SSoT: `parseHex`, `rgbToHex`, `channelToHex`, `luminance601` (BT.601), `srgbRelativeLuminance` (WCAG), `contrastRatio`, `mixHex`. **De-dup:** το `print-color-policy.ts` reuse-άρει `parseHex`/`luminance601`/`channelToHex` (πρώην private copies → αφαιρέθηκαν). |
| `config/adaptive-entity-color.ts` | `adaptColorToBackground(color, bg, minContrast)` (αυτούσιο αν ≥ κατώφλι· αλλιώς binary-search ελάχιστης ανάμειξης προς άσπρο/μαύρο) + `adaptEntityColorForCanvas(color)` (reads live `resolveDxfCanvasBackgroundHex`, memoized). `MIN_ENTITY_CONTRAST = 3.0` (WCAG AA graphical). |

**Γιατί render-time, ΟΧΙ στον `resolveSubcategoryStyle`:** ο κοινός resolver μοιράζεται από **3D
edges** (ADR-446, διαφορετικό background) **και print** (ADR-454, white paper). Η προσαρμογή είναι
**ειδική του 2D καμβά** → μπαίνει στους 2D renderers, ενάντια στο 2D bg. Έτσι 3D/print μένουν άθικτα.

**Συμπεριφορά:** μόνο τα near-black/near-bg χρώματα αλλάζουν. Κορεσμένα (beam amber `#b07d1f`,
column steel-blue `#2f6690`, slab taupe `#6e6358`, wall-interior `#6b7280`) έχουν contrast ≥ 3 →
**αυτούσια** (no-op). Σε μη-hex (rgba fills) → parseHex null → **αυτούσιο** (safe pass-through).

**Wiring (2 chokepoints):**
- **BIM:** `WallRenderer` (footprint stroke + hatch stroke/fill) → `adaptEntityColorForCanvas`.
- **DXF (imported):** `DxfRenderer.resolveStyleForRender` (live screen branches μόνο· print branch
  διατηρεί `applyPlotColor`).

## Consequences

- ✅ Ο τοίχος (και κάθε near-black χρώμα) γίνεται ορατός σε μαύρο canvas· future-proof για theme
  switching (light/Blender bg → χρώματα σκουραίνουν αυτόματα).
- ✅ Μηδέν duplicate color math (color-math SSoT· print de-dup).
- ✅ 3D edges + print **άθικτα** (resolver αμετάβλητος).
- ⚠️ Οι υπόλοιποι BIM renderers (Beam/Column/Slab/Opening/Stair/Foundation) **δεν** wire-αρίστηκαν
  ακόμη — τα χρώματά τους είναι ήδη contrast-safe (no-op), οπότε μηδέν visible regression· adopt
  on-touch (pending-ratchet) για πλήρη future-proof κάλυψη.

## Changelog
- **2026-06-20** — Δημιουργία. color-math + adaptive-entity-color SSoT (de-dup print)· wire WallRenderer
  + DxfRenderer. 27 jest (14 core/adaptive + 13 print regression) + WallRenderer-wiring updated. 🔴 browser-verify + commit.
