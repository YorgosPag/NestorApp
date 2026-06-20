# ADR-508 — Unified Linear-Member Framing SSoT (δοκάρι + τοίχος, ένα ghost)

**Status:** Accepted (uncommitted) — 2026-06-20
**Owners:** DXF Viewer / BIM drawing tools
**Related:** ADR-398 (smart beam ghost — η πηγή), ADR-363 (BIM drawing mode / wall+beam FSM)

---

## Context

Το εργαλείο **Δοκάρι** (ADR-398 §3.3–§3.6) έχει «έξυπνο φάντασμα»: πριν το 1ο κλικ εμφανίζεται
φάντασμα στο σταυρόνημα· κοντά σε υφιστάμενο δοκάρι/κολώνα κουμπώνει κάθετα (T-framing), γλιστράει
στην παρειά με 3 αγκυρώσεις (γωνία/κέντρο/γωνία), γίνεται 🔴 σε ομοαξονικό (duplication), commit με
2 κλικ + auto-flush. Το εργαλείο **Τοίχος** δημιουργούνταν τελείως διαφορετικά: μόνο τελεία-marker
πριν το κλικ, 3-κλικ flow (αρχή→τέλος→πλευρά ευθυγράμμισης), καμία έξυπνη έλξη.

Ο Giorgio ζήτησε **ο τοίχος να δημιουργείται με τον ίδιο ακριβώς τρόπο** όπως το δοκάρι, με
ταυτόσημο φάντασμα, και οι δύο κώδικες **ενοποιημένοι σε μία και μοναδική πηγή αλήθειας**
(full enterprise, full SSoT).

**Αποφάσεις Giorgio (2026-06-20):** (1) ο τοίχος κουμπώνει σε **τοίχους + κολώνες + δοκάρια**·
(2) **κατάργηση 3ου κλικ** — ο ευθύς τοίχος γίνεται 2-κλικ σαν δοκάρι (auto-flush αντί χειροκίνητης
πλευράς)· οι ειδικές λειτουργίες (περιοχή/περίμετρος/καμπύλος/πολυγραμμή) διατηρούνται.

## Κεντρική παρατήρηση

Ο πυρήνας του framing του δοκαριού ήταν **ήδη pure & entity-agnostic** στα μαθηματικά — δούλευε
πάνω σε `{ axis, outline }` targets + column footprints και επέστρεφε centerline `{ start, end,
status }`. Η μόνη «beam» σύνδεση ήταν τα **ονόματα**. Άρα η ενοποίηση = **εξαγωγή generic
«linear-member framing» SSoT** που καταναλώνουν **και το δοκάρι και ο τοίχος**.

## Decision

Νέος ουδέτερος φάκελος **`bim/framing/`** (SSoT):

| Module | Ρόλος |
|--------|-------|
| `member-face-third.ts` | `pickThird` — 3-ζωνική αγκύρωση (zero-import leaf, cycle-proof) |
| `linear-member-face-snap.ts` | `resolveLinearMemberFaceSnap` (T-framing 🟢 / κοντή άκρη 🔴) + `isMemberCollinearOverlap` |
| `member-column-face-snap.ts` | `resolveMemberColumnFaceSnap` (12-θέσεων face snap) + `MEMBER_GHOST_LEN_MM/CAPTURE_MM` |
| `member-ghost-snap.ts` | `resolveMemberGhostSnapFromStore` — column-priority dispatcher |
| `member-snap-targets.ts` | `collectMemberSnapTargets(entities, { memberKinds })` — generic scene collector |
| `member-column-flush.ts` | `resolveMemberColumnFlushJustification` — geometric side-face flush (free placement) |

**Τα beam αρχεία έγιναν thin adapters** (διατηρούν την ιστορική ταυτότητα + προσαρμογή πεδίου
`beamWidthScene` → `memberWidthScene`) ώστε οι browser-verified beam consumers/tests να μένουν
**byte-for-byte** αμετάβλητοι: `beam-beam-face-snap.ts`, `beam-column-face-snap.ts`,
`beam-face-third.ts`, `beam-column-flush.ts`. Ο `collectBeamSnapTargets` → delegate στον generic
collector με `memberKinds: ['beam']` (συμπεριφορά δοκαριού αμετάβλητη — ΟΧΙ τοίχοι στους στόχους).

**Τοίχος (mirror δοκαριού):**
- `wall-preview-store` → `startAnchored` + `columnFootprints` + `memberTargets` + `setColumns`/`setMembers`.
- `wall-preview-helpers` → `makeWallGhostBeforeClick` (smart ghost στο σταυρόνημα) + `makeWallWysiwygGhost`
  (awaitingEnd, με `ghostStatusColor` overlap). Wall outline για snap = `outerEdge` + αντεστραμμένο
  `innerEdge` (κλειστός δακτύλιος).
- `wall-completion` → `buildAnchoredWallParams` (free auto-flush σε κολόνα μέσω `resolveMemberColumnFlushJustification`).
- `useWallTool` → `syncSceneTargetsToStore` (walls+beams+columns) on activate + on `drawing:entity-created`
  (rAF defer)· `resolveWallStartAnchor` στο 1ο κλικ· **straight 2-κλικ** (`awaitingStart → awaitingEnd → commit`).
- `use-wall-commit` → `commitStraightFromState`: overlap block (`isMemberCollinearOverlap`) + anchored/centerline/auto-flush params.

**Rendering:** ο `PreviewRenderer` ΔΕΝ άλλαξε — το `ghostStatusColor` branch είναι entity-agnostic
(διαβάζει `geometry.outline.vertices`). **Κανένα νέο store** — το status ζει inline στο preview entity.

## Consequences

- ✅ Μία πηγή αλήθειας για το linear-member framing· δοκάρι + τοίχος μοιράζονται τον ίδιο πυρήνα.
- ✅ Beam tests byte-for-byte πράσινα (aliases)· νέα generic suite `bim/framing/__tests__` (ανεξάρτητη κάλυψη).
- ⚠️ Ο ευθύς τοίχος είναι πλέον 2-κλικ — το χειροκίνητο 3ο κλικ ευθυγράμμισης καταργήθηκε (το auto-flush
  το αντικαθιστά). Το `awaitingAlignment` παραμένει μόνο για το dynamic-input precision path.
- Beam targets παραμένουν beams+columns (ΟΧΙ τοίχοι) — εσκεμμένο, αποφυγή scope creep/regression στο
  browser-verified δοκάρι.

## Changelog

- **2026-06-20** — Δημιουργία. Εξαγωγή `bim/framing/` SSoT· beam files → aliases· wall ghost + 2-κλικ FSM.
  99 jest πράσινα (framing core + beam aliases + wall-preview-store + wall-completion). 🔴 browser-verify + commit.
