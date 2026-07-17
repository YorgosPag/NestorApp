# ADR-673 — Κατώφλι ανοίγματος (bottom frame member) + βύθιση στο γκρο μπετό

**Status:** **ΥΛΟΠΟΙΗΜΕΝΟ** — code + tests + UI + i18n (§5)· εκκρεμεί commit από τον Giorgio
**Ημερομηνία:** 2026-07-17
**Σχετικά:** ADR-421 (opening types, §A6 3D mesh), ADR-611 (frame profile — διατομή κάσας constant),
ADR-448 / ADR-369 (FFL datum, finishThickness), ADR-615 (self-hosted openings), ADR-672 (frame-bar index stability),
CLAUDE.md N.7.2 / N.11 / N.18

---

## 1. Η αφορμή

> «Δεν φαίνεται το κάτω μέρος του πλαισίου του κουφώματος — φαίνεται μόνο το αριστερά, δεξιά και επάνω,
> αλλά όχι το κάτω. Επίσης πρέπει να μπορούμε να ρυθμίζουμε το οριζόντιο κομμάτι που πατάει στην πλάκα:
> να πατάει στην πλάκα, ή όταν πέφτει το μπετό να θάβεται μέσα στο γκρο μπετό ώστε το επάνω του να είναι
> πρόσωπο με τα πλακίδια — να γίνεται ομαλή μετάβαση εσωτερικό↔εξώστη χωρίς σκαλί.» — Giorgio, 2026-07-17

Στην 3D όψη μιας μπαλκονόπορτας το πλαίσιο έδειχνε **μόνο 3 πλευρές** (2 ορθοστάτες + πρέκι), χωρίς κάτω μέλος.

## 2. Το εύρημα (grep, κώδικας = SSoT — όχι εικασία)

`bim-3d/converters/opening-mesh.ts` → `frameBars()`: το κάτω μέλος έμπαινε **μόνο** υπό όρο `hasSill = sillHeight > 0`.

`bim/types/opening-types.ts` → `OPENING_KIND_DEFAULTS`: **όλες οι πόρτες** (door, double/sliding/pocket/bifold/
overhead/revolving-door, **και french-door/μπαλκονόπορτα**) έχουν `sillHeight: 0`. Άρα `hasSill=false` → **καμία
γεωμετρία κάτω μέλους δεν παραγόταν καν** (ΟΧΙ occlusion/z-fight — απούσα γεωμετρία). Ήταν σχεδιαστική απόφαση
(τεκμηριωμένη στα tests: «door → 2 jambs + head»), σωστή για εσωτερική πόρτα, **ημιτελής για μπαλκονόπορτα**
που στην πράξη έχει πραγματικό χαμηλό αλουμινένιο κατώφλι.

## 3. Απόφαση

1. **Κατώφλι σε ΟΛΟΥΣ τους door τύπους** (Giorgio 2026-07-17): default `hasThreshold = isDoorKind(kind)`
   (= `!isWindowKind`), με per-opening **toggle** να το σβήνει. Τα παράθυρα (`sillHeight > 0`) κρατούν το
   υπάρχον sill path — ο resolver επιστρέφει `render:false` για αυτά ώστε **να μη διπλο-σχεδιάζεται** κάτω bar.
2. **Ρυθμιζόμενη κατακόρυφη θέση** (βύθιση) με 4 λειτουργίες (§4).
3. **SSoT resolver** `resolveOpeningThreshold(params, ctx)` στο `opening-types.ts` — μία πηγή αλήθειας για
   «εμφανίζεται;» + «πού κάθεται;», καταναλωμένη από τη geometry (και επαληθεύσιμη μεμονωμένα σε jest).

## 4. Το κατακόρυφο μοντέλο

Datum του κουφώματος: **Y = 0 = FFL** (τελειωμένο δάπεδο = πάνω πλακιδίου). Υπάρχον SSoT:
**`ToS (γκρο μπετό) = FFL − Floor.finishThickness`** (per-όροφο, default `DEFAULT_FLOOR_FINISH_THICKNESS_MM = 80mm`).

Το κάτω προφίλ έχει ύψος = `frameProfile.faceWidth` (ADR-611, reuse — ίδια σύμβαση με την ποδιά παραθύρου).
Η κατακόρυφη θέση καθορίζεται από `OpeningThresholdEmbed`:

| Λειτουργία (`thresholdEmbed`) | `bottomOffsetMm` (κάτω προφίλ vs FFL) | Αποτέλεσμα |
|---|---|---|
| `'none'` (default) | `0` | πατάει στο τελειωμένο δάπεδο (ορατό σκαλί) |
| `'flush-top'` | `−profileHeight` | **top πρόσωπο με πλακίδια** → ομαλή μετάβαση, χωρίς σκαλί |
| `'on-slab'` | `−finishThickness` | bottom στο γκρο μπετό (reuse `Floor.finishThickness`) |
| `'custom'` | `−thresholdEmbedMm` | χειροκίνητο βάθος βύθισης |

`bottomOffsetMm` = signed offset του **κάτω** μέρους του προφίλ σε σχέση με το FFL (αρνητικό = βυθισμένο).
Το bar τοποθετείται στο `cy = bottomOffsetMm·0.001 + faceWidthW/2` (meters).

## 5. Υλοποίηση

**Contract (SSoT):**
- `bim/types/opening-types.ts` — `OpeningThresholdEmbed` type· params `hasThreshold?/thresholdEmbed?/thresholdEmbedMm?`
  στο `OpeningParams`· predicate `isDoorKind`· `resolveOpeningThreshold(params, {finishThicknessMm, profileHeightMm})`
  → `ResolvedOpeningThreshold {render, bottomOffsetMm}`.
- `bim/types/opening.schemas.ts` — `OpeningThresholdEmbedSchema` + 3 optional Zod πεδία (`.strict()` object).

**Geometry + plumbing:**
- `bim-3d/converters/opening-mesh.ts` — `buildOpeningMesh(...)` νέο 6ο param `finishThicknessMm`· `frameBars()`
  σχεδιάζει το κάτω bar ως **ΕΝΑ slot** (sill *ή* threshold — mutually exclusive) στην ίδια index-θέση (μετά το
  head, πριν leaves/hardware) → ADR-672 index-stability διατηρημένη.
- `bim-3d/converters/bim-three-wall-opening-attach.ts` — `attachOpeningMeshes(...)` νέο param `finishThicknessMm`.
- `bim-3d/converters/BimToThreeConverter.ts` — πηγή `finishThicknessMm` μέσω `readActiveStoreyContext()?.finishThicknessMm
  ?? DEFAULT_FLOOR_FINISH_THICKNESS_MM` (ίδιο non-React SSoT με `cut-plane-3d.ts`/`terrain-clip-plane.ts`· **καμία
  hardcoded 80**). Bonus: preview/ghost/grip paths μέσω `wallToMesh` παίρνουν αυτόματα σωστή τιμή (3D preview == commit).

**UI (contextual opening ribbon tab — υπήρχε ήδη, δεν φτιάχτηκε νέο σύστημα):**
- `ui/ribbon/data/contextual-opening-tab.ts` — νέο panel `opening-threshold` (toggle + `thresholdEmbed` combobox 4
  επιλογών + `thresholdEmbedMm` numeric combobox, ενεργό μόνο σε `'custom'`).
- `ui/ribbon/hooks/bridge/opening-command-keys.ts` + `useRibbonOpeningBridge.ts` + `useRibbonToggleCommands.ts` —
  read/write μέσω του υπάρχοντος `UpdateOpeningParamsCommand` (undoable). `hasThreshold` default `isDoorKind(kind)`.
- `ui/ribbon/components/buttons/RibbonButtonIcon.tsx` — icon `bim-opening-threshold` (reuse `ArrowDownToLine`).
- i18n: `ribbon.panels.openingThreshold`, `ribbon.commands.openingEditor.{hasThreshold,thresholdEmbed.*,thresholdEmbedMm}`
  σε `el/dxf-viewer-shell.json` + `en/dxf-viewer-shell.json` (χωρίς `defaultValue` literals, N.11).

**Tests:** `bim-3d/converters/__tests__/opening-mesh.test.ts` (+1 bar ανά door kind· 4 embed modes· toggle-off·
window-unaffected) + `__tests__/bim-three-wall-opening-attach.test.ts` (νέο arg).

## 6. Zero-regression

- Παράθυρα (`sillHeight > 0`): **ανέπαφα** — sill path αμετάβλητο, ο resolver επιστρέφει `render:false`.
- Υπάρχοντα saved openings: params absent → resolver defaults (door → κατώφλι `'none'`· window → sill). Καμία
  απαίτηση migration.
- Frame-bar indices: το κάτω bar κρατά σταθερή θέση· `stampOpeningMaterialIds` ταιριάζει με material-reference,
  όχι index → order-independent (επαληθευμένο).
- **Οπτική αλλαγή by design:** κάθε πόρτα αποκτά πλέον default κάτω μέλος (χαμηλό, `'none'`)· toggle-off το κρύβει.

## 7. Changelog

- **2026-07-17** — Δημιουργία. Root cause (§2), απόφαση «κατώφλι σε όλους τους door τύπους + 4 embed modes»,
  SSoT resolver, plumbing `finishThickness` μέσω `readActiveStoreyContext()`, UI στο contextual opening tab,
  tests. Orchestrator execution (lead + 3 agents: geometry/plumbing, UI/i18n, tests).
