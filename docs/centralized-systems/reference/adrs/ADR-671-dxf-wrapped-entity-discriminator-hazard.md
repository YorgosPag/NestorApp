# ADR-671 — `type:'slab'` ≠ ένα σχήμα: η παγίδα του κοινού discriminator (5 wrapped τύποι)

**Status:** **ΕΝΕΡΓΟΣ ΚΑΝΟΝΑΣ** — τεκμηρίωση κλάσης bug + κανόνας κατανάλωσης· 1 fix εφαρμοσμένο (§7), 2 follow-up εκκρεμούν επιβεβαίωση (§6)
**Ημερομηνία:** 2026-07-17
**Σχετικά:** ADR-363 (BIM drawing mode — εισήγαγε τα wrappers, **σιωπηλό** στο γιατί ίδιο discriminator),
ADR-587 (entity-type descriptor registry — απορρόφησε το `DXF_WRAPPED_SUBENTITY_FIELD`),
ADR-659 (popover — η αφορμή), CLAUDE.md N.0.2 / N.18

---

## 1. Το ερώτημα

> «Υπάρχει δεύτερο slab shape στο DxfEntityUnion, ξεχωριστό από το BIM SlabEntity — τι εννοείς;
> Υπάρχει διπλοτυπία;» — Giorgio, 2026-07-17

Προέκυψε από ένα live crash (`Cannot destructure property 'kind' of 'entity.params' as it is
undefined`) όταν το popover του ADR-659 προσπάθησε να διαβάσει `entity.params` σε render-shape slab.

## 2. Η απάντηση: ΟΧΙ διπλοτυπία δεδομένων — render projection με ασάφεια discriminator

Το `DxfEntityUnion` (`canvas-v2/dxf-canvas/dxf-types.ts`) **είναι η render-προβολή** του BIM `Entity`
(`types/entities.ts`). Κάθε `type` string έχει ζεύγος `XxxEntity` (BIM, SSoT) + `DxfXxx` (render view).
Ο μετασχηματισμός είναι **ένας** SSoT converter προς κάθε κατεύθυνση:

- **scene → render**: `convertEntity()` (`hooks/canvas/dxf-scene-entity-converter.ts`), registry
  `TO_DXF_HANDLERS` — τυλίγει το flat entity μέσω `dxfSubEntityPayload()`.
- **render → paint-only**: `buildEntityModelFromDxf()` (`dxf-renderer-entity-model.ts`) — ξετυλίγει
  για τους leaf renderers, **ποτέ** δεν γράφεται πίσω στο scene.

**Άρα καμία δεύτερη πηγή αλήθειας.** Τα δεδομένα της πλάκας ζουν σε ένα `SlabEntity`. Το `DxfSlab`
**περιέχει** αυτό το ίδιο αντικείμενο by reference (`{ type:'slab'; slabEntity: SlabEntity }`), δεν το
αντιγράφει. Το πρόβλημα δεν είναι διπλά δεδομένα — είναι ότι **δύο ασύμβατα σχήματα μοιράζονται τον
ίδιο `type` discriminator**, οπότε ο discriminator δεν αρκεί για να τα ξεχωρίσεις.

## 3. Το εύρος: 5 επικίνδυνοι από ~41 τύπους

SSoT: `DXF_WRAPPED_SUBENTITY_FIELD` (`dxf-types.ts:701`).

| Κατηγορία | Τύποι | Σχήμα | Ρίσκο |
|---|---|---|---|
| **WRAPPED** | `slab`→`.slabEntity`, `slab-opening`→`.slabOpeningEntity`, `opening`→`.openingEntity`, `stair`→`.stairEntity`, `dimension`→`.dimensionEntity` | δεδομένα σε **nested** field· top-level `.params`/`.geometry` = `undefined` | **ΥΨΗΛΟ** — `entity.params` σκάει/επιστρέφει κενό |
| **DIRECT** | ~30 (wall, beam, column, foundation, railing, MEP*, roof, floor-finish, …) | `kind`/`params`/`geometry` **flat**, ίδιο σχήμα με το BIM entity | Καμία — τα guards τους ΔΕΝ σκάνε |

Μόνο οι **5 wrapped** είναι επικίνδυνοι. Οι ~30 direct είναι δομικά άτρωτοι.

## 4. Γιατί τα type guards ΔΕΝ φτάνουν

Τα guards στο `types/entities.ts` (`isSlabEntity`, `isStairEntity`, …) ελέγχουν **ΜΟΝΟ** `type === 'xxx'`.
Άρα narrow-άρουν **και** τον wrapper σε `XxxEntity` — ενώ σε runtime το `.params` του wrapper είναι
`undefined`. Ο compiler δεν το πιάνει επειδή το scene συχνά περνά με `as unknown as Entity[]` cast
(cursor/mouse-handler pipeline). Δύο άξονες («τι είναι» = discriminator, «ποιο σχήμα» = wrapped/flat)
συγχέονται σε έναν.

## 5. Ιστορικό: επαναλαμβανόμενη κλάση, όχι μεμονωμένο

| # | Σημείο | Συμπεριφορά |
|---|---|---|
| 1 | `candidate-label.ts::buildCandidateSemantics` (ADR-659) | **CRASH** — διορθωμένο (§7) |
| 2 | `rendering/ghost/draw-real-entity-preview.ts` | Παλιό **CRASH** (moving slab ghost → `undefined.kind` → κατέρρεε το RAF draw)· ήδη μπαλωμένο με ad-hoc «re-wrap» γέφυρα (`toWrappedPreviewEntity`) |
| 3 | `bim/stairs/stair-sub-element-hover-2d.ts`, `stair-click-into-2d.ts` | **ΣΙΩΠΗΛΟ** — `.geometry` optional-chained σε wrapper → πάντα `undefined` → tread hover + click-into στη 2D κάτοψη μάλλον ΔΕΝ δουλεύουν (§6) |

## 6. Follow-up (ΕΚΚΡΕΜΕΙ επιβεβαίωση Giorgio στην οθόνη)

Τα 2 stair sites (#3) διαβάζουν `isStairEntity(hit)` πάνω σε `hit` από `DxfScene.entities` και μετά
`hit.geometry?.treadsBelowCut` — που είναι πάντα `undefined` στο `DxfStair` wrapper. **Ένδειξη από
κώδικα, ΟΧΙ runtime-επιβεβαιωμένο.** Ο Giorgio θα ελέγξει live αν το hover σκαλοπατιού + το «click-into
tread» στην 2D κάτοψη δουλεύουν. Αν όχι → fix: πέρασμα από `unwrapDxfSubEntity<StairEntity>()` πριν την
ανάγνωση geometry (ίδιο pattern με το §7).

## 7. Ο κανόνας (SSoT κατανάλωσης)

**Υπάρχει ΗΔΗ γενικός SSoT reader** — `unwrapDxfSubEntity<T>(entity)` (`dxf-types.ts:731`): επιστρέφει
το nested sub-entity για wrapper, ή το ίδιο το entity για flat. **ΑΛΛΑ υπο-χρησιμοποιείται** (μόνο
`bim-bounds.ts` τον καλούσε· ακόμα και το πρώτο fix του ADR-659 έγραψε 4ο ad-hoc reader — διορθώθηκε
2026-07-17 να καλεί το SSoT: `extractSlabParams` = `unwrapDxfSubEntity<SlabEntity>(entity).params`).

> **ΚΑΝΟΝΑΣ:** Όταν παίρνεις entity από **`DxfScene`-typed** context (cursor/mouse-handler/render, συχνά
> `as unknown as Entity`) και μπορεί να είναι ένας από τους 5 wrapped τύπους → **ΜΗΝ** γράψεις νέο
> tolerant reader και **ΜΗΝ** διαβάσεις ωμά `.params`/`.geometry` μετά από guard. Πέρνα από
> **`unwrapDxfSubEntity<T>()`**.
>
> **Ασφαλής εξαίρεση:** ό,τι έρχεται από `SceneModel` / `getLevelScene` / `useResolvedSelectedEntity`
> (React panels/ribbon) είναι **πάντα** flat BIM `Entity` → δεν χρειάζεται unwrap.

## 8. Γιατί ΟΧΙ ξεχωριστός discriminator

Το «καθαρό» θα ήταν `type:'dxf-slab'` για τα render shapes. **Απορρίπτεται**: αγγίζει 41 τύπους + το
registry του ADR-587, τεράστιο cross-cutting ρίσκο, για μηδέν λειτουργικό όφελος — το πρόβλημα είναι
ήδη μηχανικά περιορισμένο (5 τύποι, 2 render seams, 1 SSoT reader). Η θεραπεία είναι **καθολική
υιοθέτηση του `unwrapDxfSubEntity()`** (§7), όχι re-architecture των τύπων.

## 9. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-17 | Δημιουργία. Απάντηση σε ερώτημα Giorgio (§1). Εύρος μετρημένο: 5 wrapped / ~30 direct (§3). 3 ιστορικά περιστατικά (§5). Κανόνας κατανάλωσης `unwrapDxfSubEntity` (§7). `extractSlabParams` refactored σε SSoT helper. 2 stair follow-up sites εκκρεμούν live επιβεβαίωση (§6). Discriminator-rename απορρίφθηκε (§8). |
