# HANDOFF — ADR-937: ζωντανή επαλήθευση της «αιτίας κενής πρότασης» + πρόταση σε όροφο ΜΕ μοντέλο BIM (2026-11-11)

## Πού
- **Worktree**: `C:\Nestor_Worktrees\adr-937-followup`
- **Κλαδί**: `agent/adr-937-followup`
- Η νέα συνεδρία **συνεχίζει στο ΙΔΙΟ worktree** (`EnterWorktree` με την παραπάνω διαδρομή).
- Το προηγούμενο handoff (`HANDOFFS/2026-11-11_ADR-937_live-verification_handoff.md`) είναι **ιστορικό** — ισχύει αυτό εδώ.

## Κατάσταση (επαληθευμένη)
- `main` HEAD = **`b340447c`** (land του κλαδιού· τα 3 commits του κλαδιού συμπιέστηκαν σε ένα). Ο Giorgio έκανε **push**·
  τη στιγμή της γραφής **το deploy στο Netcup δεν είχε επιβεβαιωθεί** — περίμενε την επιβεβαίωσή του πριν το live.
- Τι μπήκε (ADR-937 §2.2 + changelog):
  - `usePropertyOrientationProposal` επιστρέφει `status`: `no-model` (καμία οντότητα τοίχου BIM) · `no-envelope`
    (τοίχοι χωρίς εξωτερικό κέλυφος) · `derived` (υπάρχει κέλυφος· `values` μπορεί κενές).
  - `OverlayOrientationProposal`: ένα μήνυμα ανά αιτία (`noModel` / `noEnvelope` / `none`, el+en)· η σημείωση
    «ο Βορράς θεωρήθηκε πάνω» μόνο στο `derived`· στο `no-model` πλήκτρο **«Τοίχοι από το σχέδιο»** = το ΙΔΙΟ σήμα με
    το ribbon (`dxf:model-from-drawing-requested` → `ModelFromDrawingHost`) και η ΙΔΙΑ ετικέτα
    (`dxf-viewer-shell` `ribbon.commands.bim.wallsFromDrawing.label`).
  - Άγκυρα: `src/subapps/dxf-viewer/hooks/data/__tests__/usePropertyOrientationProposal.test.ts` — 4/4 πράσινα·
    μετάλλαξη του φρουρού `no-model` ⇒ 1 κόκκινο (επαναφέρθηκε).

## Διάγνωση που ΚΛΕΙΣΕ (μην την ξανακάνεις)
«Ισόγειο» `lvl_9f2c7d41-6b83-4e15-a0d7-3c58ba2e4419` → `floorId flr_5c28e0b9-71d4-4a3f-9e62-8b1f0a7d3c46`,
`sceneFileId file_967e8ccc-…` (`_AfrPolGO.dxf`): `floorplan_walls` = 0 και `floorplan_openings` = 0 (κατά `floorId`,
`floorplanId`, `layerId`). Τα «παράθυρα» είναι γραμμές DXF. Ο υπολογισμός ήταν σωστός· το μήνυμα παραπλανούσε.
⚠️ Οι BIM οντότητες φορτώνονται κατά **`floorId`** (`bim/persistence/cross-floor-bim-loader.ts`), όχι `layerId`.

## ΕΠΟΜΕΝΑ ΒΗΜΑΤΑ (μετά την επιβεβαίωση του deploy από τον Giorgio)
1. **Live, μόνο προβολή** (Chrome): DXF viewer `?bldg=bldg_3e91a5c7-…&lvl=lvl_9f2c7d41-…`, overlay `ovrl_2730ac0d-…`
   «Διαμέρισμα 95 τ.μ.» ⇒ πρέπει να λέει «Η κάτοψη δεν έχει μοντέλο BIM…», **χωρίς** τη σημείωση Βορρά, με πλήκτρο
   «Τοίχοι από το σχέδιο». Πάτημα ⇒ οπλίζεται ο βοηθός (hint στη γραμμή κατάστασης) — **Esc, ΚΑΜΙΑ έγκριση**.
   Πρώτα επιβεβαίωσε ότι το live build περιέχει `b340447c` (`git merge-base --is-ancestor`).
2. **Όροφος ΜΕ μοντέλο BIM**: υπάρχουν τοίχοι/ανοίγματα στο `floorId flr_4275c4c9-5346-446f-9177-e142e99f1160`
   (`layerId lvl_2a7ff5cc-4901-4dda-84f4-a2a243886dc2`, έργο `proj_2497601f-…`). Βρες αν έχει overlay `kind:'property'`
   συνδεδεμένο με ακίνητο· δες πραγματική πρόταση (`derived`). Αν δεν υπάρχει τέτοιο overlay → **ρώτα** πριν
   δημιουργήσεις οτιδήποτε. «Πρόταση στο ακίνητο» **μόνο με έγκριση**.
3. Αν η πρόταση σε όροφο με BIM βγει λάθος/κενή → διάγνωση (μονάδες mm, ανοχή 0,6 m, `resolveExteriorWallIds`,
   πολύγωνο στην παρειά vs άνοιγμα στον άξονα) με έρευνα Revit/ArchiCAD **πριν** από κώδικα, και πρόταση στον Giorgio.

## Ευρήματα ΕΚΤΟΣ ADR-937 (μόνο αναφορά — ΜΗΝ τα διορθώσεις χωρίς εντολή)
1. Πάνελ «Περιοχές»: εμβαδόν «62.259.216,5 m²» ενώ η «Γεωμετρία» λέει «62,259 m²» ⇒ μοιάζει mm² ως m².
2. Ωμό κλειδί i18n `navigation.entities.property.description` στις κάρτες περιοχών.
3. Fallback στη θέση του ακινήτου όταν λείπει του κτιρίου (διάλογος χάρτη) — πρόταση, όχι εγκεκριμένη.

## Κανόνες
- Πρότυπο Revit / ArchiCAD / Figma / Zillow / Idealista, full enterprise + full SSoT, χωρίς εκπτώσεις· αν δεν είσαι
  σίγουρος → έρευνα στο διαδίκτυο. Πριν από κάθε νέο κώδικα **πραγματικό SSoT audit (grep)**.
- Commit μόνο στο `agent/adr-937-followup` με ρητή λίστα αρχείων· **ποτέ** στο `main`.
- `wt:land` και push **μόνο με ρητή εντολή Giorgio**.
- Στο live **μόνο προβολή** — καμία αποθήκευση/έγκριση χωρίς έγκριση.
- Tests μόνο με έγκριση · ποτέ `tsc` (N.17) · ποτέ `--no-verify`.
- Φρένο βαριών εργασιών: αν το Bash μπλοκάρει, περίμενε το `C:\Users\user\.claude\heavy-task.lock` (απουσία ή >20′).
