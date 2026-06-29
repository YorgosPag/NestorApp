# HANDOFF — ADR-550 Φ-Ghost: Ghost/Preview capability στο Entity Render Contract

**Ημερομηνία:** 2026-06-29
**Subapp:** `src/subapps/dxf-viewer`
**Σχετικά ADR:** ADR-550 (Unified Entity Render Contract — Φ0/Φ2/Φ3/Φ4 ΟΛΟΚΛΗΡΩΜΕΝΑ+COMMITTED), ADR-537 (κεντρικοποίηση ghosts), ADR-549 (census), ADR-040 (2D perf), ADR-366 (3D)

---

## 🎯 ΣΤΟΧΟΣ — Φ-Ghost

Ένταξη της **ghost/preview** αναπαράστασης ως **δηλωτικό capability** στο `ENTITY_RENDER_CONTRACTS`
(`rendering/contract/entity-render-contract.ts`), με coverage-test binding προς τον ζωντανό ghost
dispatcher — **ακριβώς όπως το Φ2 έκανε για το 3D** (`d3Builder: 'point'|'bespoke'|'none'` + binding
στο `POINT_ENTITY_CONTRACTS`). Νέα οντότητα → δηλώνεις ΜΙΑ φορά ότι έχει ghost, και το test
εγγυάται ότι όντως καλωδιώνεται.

**Γιατί (big-player practice — επιβεβαιωμένο):** το preview/ghost είναι μέρος του drawing contract
της οντότητας σε ΟΛΟΥΣ: **Revit** element → preview/drag representation· **AutoCAD** `worldDraw`/jig
(η ΙΔΙΑ οντότητα ζωγραφίζει committed ΚΑΙ jig)· **Maxon C4D** object draw method (editor preview).
Δεν είναι ξεχωριστός μηχανισμός — ανήκει στο contract.

---

## ⚠️⚠️ ΑΠΑΡΑΒΑΤΕΣ ΟΔΗΓΙΕΣ ΓΙΟΡΓΟΥ (ΔΙΑΒΑΣΕ ΠΡΩΤΑ)

1. **ΠΡΙΝ ΚΩΔΙΚΑ → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep).** Το ghost system είναι **ήδη μερικώς
   κεντρικοποιημένο** (ADR-537). Ψάξε ΑΝ υπάρχει ήδη introspectable ghost dispatch (σαν το
   `EntityRendererComposite.getSupportedEntityTypes()` για το 2D draw). Αν ναι → **ΕΠΕΚΤΕΙΝΕ** το.
   ΜΗΝ φτιάξεις παράλληλο μητρώο. (Στο παρελθόν η υπόθεση «διπλό geometry» ΔΙΑΨΕΥΣΤΗΚΕ από audit.)
2. **🚫 ΚΡΙΣΙΜΟ — μη προσθέσεις μη-ελεγχόμενο πεδίο.** Το Φ2 ΣΚΟΠΙΜΑ ΑΦΗΣΕ το ghost ΕΞΩ ακριβώς
   επειδή δεν υπήρχε bindable live dispatcher· ένα πεδίο `ghost` χωρίς coverage-test binding **σαπίζει**.
   Πρόσθεσέ το ΜΟΝΟ αν υπάρχει (ή φτιάξεις πρώτα) introspectable seam που το test μπορεί να δέσει.
3. **FULL ENTERPRISE + FULL SSoT** — αλλά αν Revit/AutoCAD/Maxon δεν προτείνουν κάποια προσέγγιση,
   ακολούθησε τη ΔΙΚΗ ΤΟΥΣ πρακτική. **Επιβεβαίωσε το pattern ΠΡΙΝ το χτίσεις** (ρώτα τον Giorgio).
4. **ADAPTER, ΟΧΙ REWRITE.** Οι υπάρχοντες ghost renderers γίνονται adapters πίσω από το contract.
   ΜΗΝ ξαναγράψεις ghost geometry. ΜΗΝ ενοποιήσεις Canvas2D + Three (2 backends μένουν).
5. **⚠️ SHARED WORKING TREE με 1-2 άλλους agents.** Άγγιξε ΜΟΝΟ αρχεία του Φ-Ghost. ΠΟΤΕ `git add -A`.
   Δες `git status` πριν/μετά· υπάρχουν ενεργές αλλαγές άλλων (π.χ. ADR-553/554, BimCrosshairOverlay3D,
   ADR-549-cursor-swim) — ΜΗΝ τις αγγίξεις.
6. **COMMIT ΤΟΝ ΚΑΝΕΙ Ο ΓΙΟΡΓΟΣ — ΟΧΙ ΕΣΥ** (N.(-1)). Ετοίμασε, σταμάτα, ανέφερε.
7. **Plan Mode πρώτα** (N.8 — αγγίζει render-critical). CHECK 6B/6D: stage ADR-040/366 + ADR-550 + ADR-537.
8. **N.17 single-tsc** πριν τρέξεις tsc. Shared αδύναμο PC.

---

## ✅ ΤΙ ΕΧΕΙ ΗΔΗ ΓΙΝΕΙ (ADR-550 πλήρες, COMMITTED)

| Αρχείο | Ρόλος |
|---|---|
| `rendering/contract/entity-render-contract.ts` | **Φ2** — `ENTITY_RENDER_CONTRACTS` `{d2,d3,d3Builder}`, invariant `d3Builder≠'none'⟺d3`. **ΕΔΩ μπαίνει το ghost capability.** |
| `rendering/contract/entity-render-surfaces.ts` | derived view (από το contract) |
| `bim-3d/scene/bim-scene-point-contracts.ts` | **Φ2** — executable point registry (πρότυπο για το ghost binding) |
| `rendering/contract/__tests__/entity-render-coverage.test.ts` | **Φ3** — δένει δηλωτικό ↔ ζωντανά dispatchers (πρότυπο για ghost asserts) |
| `app/test-harness/bim-3d/` + `bim-3d/__fixtures__/point-entities-scene-fixture.ts` + `e2e/bim-3d-visual-regression.spec.ts` | **golden-image 3D harness** (reusable — επέκτεινέ το για ghost visual-verify) |

Commits: `f15395aa` (Φ2 core), `6ddfa137` (golden harness) + follow-up patches.

---

## 🗺️ GHOST SEAMS (από grep — επικύρωσε/συμπλήρωσε στο audit)

- **3D SSoT:** `bim-3d/placement/placement-ghost-overlay.ts` (ADR-537, 11 ghosts migrated, unlit+post-fx).
- **2D shared primitives:** `rendering/utils/ghost-entity-renderer.ts`, `bim/ghosts/{ghost-status-color,ghost-status-outline,ghost-status-polygon-draw}.ts`, `bim/placement/placement-ghost-assembly.ts`.
- **2D per-family:** `bim/walls/opening-ghost-renderer.ts`, `bim/slab-openings/slab-opening-ghost-renderer.ts`, `bim/foundations/foundation-grid-ghost.ts`.
- **Preview pipeline:** `hooks/drawing/drawing-preview-generator.ts`.

> ❓ **ΤΟ ΚΡΙΣΙΜΟ ΕΡΩΤΗΜΑ ΤΟΥ AUDIT:** υπάρχει ήδη ΕΝΑ introspectable σημείο που λέει «ποια entity
> types έχουν ghost»; (π.χ. ένα map/registry στο placement-ghost-overlay ή assembly). Αν ΝΑΙ → δέσε το
> contract σε αυτό. Αν ΟΧΙ → το capability γίνεται «soft» (μόνο δηλωτικό, χωρίς enforcement) =
> **ΑΠΟΦΥΓΕ** το· αντ' αυτού πρότεινε στον Giorgio να φτιαχτεί πρώτα ο introspectable ghost dispatcher.

---

## 🧭 ΠΡΟΤΕΙΝΟΜΕΝΗ ΠΡΟΣΕΓΓΙΣΗ (προς επικύρωση στο Plan Mode μετά το audit)

Mirror του Φ2:
```ts
// entity-render-contract.ts
export type GhostKind = 'unified' | 'per-family' | 'none';
interface EntityRenderContract {
  …; readonly ghost: GhostKind;  // invariant: π.χ. ghost!=='none' ⟹ έχει 2D ή 3D ghost seam
}
```
- Coverage test: `{ghost:'unified'}` set === τύποι του 3D `placement-ghost-overlay` registry· `{ghost:'per-family'}` === τα per-family ghost renderers· no drift (όπως το point↔executable binding του Φ2).
- **Visual-verify (reuse!):** επέκτεινε το `bim-3d-visual-regression.spec.ts` με ένα 2ο test που βάζει το harness σε «placement/ghost» κατάσταση και κάνει golden GL-capture του φαντάσματος (το harness + `window.__bim3dTest` υπάρχουν ήδη).

---

## 🚫 ΜΗ-ΣΤΟΧΟΙ
- ❌ Νέο παράλληλο ghost μητρώο (επέκτεινε το υπάρχον). ❌ Rewrite ghost renderers. ❌ Merge backends.
- ❌ Μη-ελεγχόμενο `ghost` πεδίο χωρίς coverage binding. ❌ Big-bang.

## ✅ VERIFICATION
- `npx jest "src/subapps/dxf-viewer/rendering/contract"` → GREEN + νέα ghost asserts (μη σπάσεις Φ2/Φ3).
- Single tsc (N.17) στα αλλαγμένα αρχεία.
- Browser-verify ghost μέσω του υπάρχοντος golden harness (port 3000 = δικό του Giorgio τώρα· τρέξε με `PLAYWRIGHT_BASE_URL` στο port που σηκώνει ο δικός σου dev server· `reuseExistingServer:true`).

---

## 🟡 ΔΕΥΤΕΡΕΥΟΝ (ανεξάρτητο, 1 grep)
**ADR-549 εκκρεμές:** επιβεβαίωσε αν ο `FloorplanSymbolRenderer` έχει ενεργό call-site· αν όχι →
dead-code υποψήφιος (CHECK 3.22, `.deadcode-baseline.json`). Τεκμηρίωσε στο ADR-549 §4.2.

---

## 🤔 ΕΙΛΙΚΡΙΝΗΣ ΕΚΤΙΜΗΣΗ
Το ghost-in-contract **είναι** big-player-σωστό, αλλά η αξία του εξαρτάται 100% από το αν υπάρχει
bindable seam. Αν το audit δείξει ότι ΔΕΝ υπάρχει introspectable ghost dispatch, η σωστή κίνηση
είναι **πρώτα** να κεντρικοποιηθεί ο ghost dispatch (ίσως μεγαλύτερη δουλειά) και ΜΕΤΑ το binding —
αυτό να το αποφασίσει ο Giorgio πριν ξεκινήσεις. Μη βιαστείς να προσθέσεις πεδίο που σαπίζει.
