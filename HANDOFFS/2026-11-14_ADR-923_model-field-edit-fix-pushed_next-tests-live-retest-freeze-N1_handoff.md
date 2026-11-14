# HANDOFF — ADR-923 · διόρθωση «κοινό πεδίο στη γραμμή μοντέλου» ΣΤΗΝ ΠΑΡΑΓΩΓΗ · επόμενα: tests · ζωντανή επανάληψη · πάγωμα · Ν1

- Worktree `C:\Nestor_Worktrees\catalog-editions` · κλαδί `agent/catalog-editions` · η νέα συνεδρία συνεχίζει **στο ίδιο worktree**.
- Κανόνες Giorgio: tests **μόνο με έγκριση** · κανένα tsc · commit μόνο στο `agent/*` (ποτέ στο `main`) · **wt:land και push μόνο με
  ρητή εντολή του** · ελληνικά · «όπως οι μεγάλοι», full enterprise + full SSoT, έρευνα όπου δεν είσαι σίγουρος · **SSoT audit με grep
  ΠΡΙΝ από κάθε γραμμή κώδικα** · πρόταση ρίζας/διόρθωσης **χωρίς κώδικα πριν το «ναι»**.
- Προηγούμενο handoff: `HANDOFFS/2026-11-14_ADR-923_Z1-Z2-done_N1-freeze-on-model-field-edit_handoff.md` (Ζ1/Ζ2, λίστα 25 πεδίων Ν1).

## ΤΙ ΕΓΙΝΕ (2026-11-14)
1. **Ρίζα αποδεδειγμένη ζωντανά**: διόρθωση σε κοινό πεδίο (Φάσεις «1Ph» → «1») στη γραμμή `model:page:85:t0` **πετιόταν σιωπηλά**
   στον server: PUT 200, αναθεώρηση +1, `edits` κενό. Αιτία: τον κανόνα «κελί γραμμής που ανεβαίνει στο μοντέλο» τον ήξερε **μόνο** ο
   σχεδιαστής (`sharedCellsOf`)· ο κατάλογος διορθώσεων (`human-edits.ts`) και η μνήμη τιμών (`value-memory.ts`) έβλεπαν στη γραμμή
   μοντέλου μόνο τα `sharedCells` της πηγής — ο προμηθευτής όμως τυπώνει το «1Ph» ανά στήλη.
2. **Διόρθωση «Α» (Giorgio «Α» → «ΝΑΙ»)** — commit `dc7a69e7` → land → `main` `554077da` → **push** (`8a6a1e1b..0d9d2d05`, μαζί και
   3 commits άλλων πρακτόρων, με εντολή Giorgio). **Στην παραγωγή μόλις τελειώσει το build του Netcup.**
   - ΝΕΟ SSoT `src/subapps/catalog/import/model-level-cells.ts`: `isHolderCell` · `cellLevelOf` · `ModelLevelTest` · `NO_MODEL_LEVEL` ·
     `modelLevelTestOf(scheme)` — τον ρωτούν σχεδιαστής, κατάλογος διορθώσεων, μνήμη τιμών.
   - `human-edits.ts`: `fieldSourceMap`/`addressedCell` (η πηγή δεν αλλάζει σχήμα, αλλάζει η **διεύθυνση**) · `missingEditTargets` ·
     `editSourceOf` · `recordEdits`/`fieldSourcesOf`/`applyHumanEdits` δέχονται `modelLevel`.
   - `value-memory.ts`: `ValueMemorySchema.modelLevel` · `unreadSource` δέχεται πολλά κελιά **με μία τιμή** (ίδιο κείμενο + μονάδα).
   - Server: `readModelLevelTest` (`import-proposal-plan.server.ts`) · `import-proposal-writer.server.ts` περνά `modelLevel` και
     **`assertEditTargetsExist` ⇒ 422 `unknownReference`** αντί για σιωπηλό πέταγμα · `import-value-memory.server.ts` `memorySchemaOf`.
   - Tests γραμμένα (**ΔΕΝ ΕΤΡΕΞΑΝ**): `human-edits.test.ts` (describe «κοινό πεδίο τυπωμένο ανά στήλη», 6 περιπτώσεις) ·
     `value-memory.test.ts` (1 περίπτωση: «1Ph»×2 ⇒ μία διόρθωση· 1Ph/3Ph ⇒ καμία).
3. **Πάγωμα σελίδας — ρίζα ΑΓΝΩΣΤΗ**: μέτρηση LoAF ζωντανά = ~14″ render React μετά το settle/reload, με **5,7″ χωρίς yield**. Δεν
   είναι βρόχος δικτύου. Μία φορά στο πρώτο κρύο φόρτωμα 9–18″, **δεν αναπαράχθηκε** στο δεύτερο.
4. Το ADR-923 **ΔΕΝ ενημερώθηκε** (το hook προειδοποίησε «0 ADR staged») — εκκρεμεί με έγκριση.

## ΕΠΟΜΕΝΟ (σειρά — κάθε βήμα με «ναι» του Giorgio)
1. **Tests**: `npx jest src/subapps/catalog/import/__tests__/human-edits.test.ts src/subapps/catalog/import/__tests__/value-memory.test.ts src/subapps/catalog/import/__tests__/label-memory.test.ts`
   (περιλαμβάνουν και του Ζ2, που ούτε αυτά έτρεξαν). Κόκκινο ⇒ αναφορά, όχι «διόρθωση» χωρίς έγκριση.
2. **ADR-923** §5.5.2 Β6 + Β10 + changelog για τη διόρθωση (κανόνας «επίπεδο μοντέλου» σε ένα SSoT · 422 `unknownReference`).
3. **Ζωντανή επανάληψη στο nestorconstruct.gr** (αφού βγει το build): παρτίδα `cibat_7a8f19ab-def5-43e7-89a1-8cbccec3ba5e`, πρόταση
   `cipsl_03bc10c6…` (τώρα rev **6**), Φάσεις «1» με blur. **Στοχευμένο GET**: `fetch('/api/catalog/imports/<batch>')` φιλτραρισμένο σε
   `proposals.find(id startsWith 'cipsl_03bc').{revision, edits}` — **ΠΟΤΕ ολόκληρη η απάντηση (~195 KB)**.
4. **Πάγωμα**: πρόταση = React Profiler σε **τοπικό dev server** (χρειάζεται έγκριση). Υποψήφιοι προς μέτρηση, όχι συμπεράσματα:
   `ProposalReview`/`ProposalFieldRow` re-render όλων των πεδίων σε αλλαγή αναθεώρησης · ξαναχτίσιμο σελίδας (`pageDecisionsDigest`).
5. **Ν1** (απόφαση Giorgio «Αποδοχή όλων» όσων επαληθεύονται στο PDF σελ. 85): αποδοχή των 21 πεδίων παραλλαγών **ένα-ένα** (ΟΧΙ
   «Αποδοχή γραμμής»: το `acceptAll` στο `ProposalReview.tsx` αποδέχεται και αμετάβλητα) · **Απόρριψη πρότασης** σελ. 84
   (`cipsl_d6bad781…`, GIACOMINI) · **Έγκριση και εφαρμογή**. Μετά Ν2 «3» / Ν3 «1» / Ν4 έλεγχος (νέες παρτίδες· το PDF το επιλέγει ο Giorgio).

## ΑΝΟΙΧΤΑ (μόνο αναφορά — ΚΑΜΙΑ ενέργεια χωρίς «ναι»)
- Η προέλευση της διόρθωσης δείχνει τώρα «1Ph · 1Ph · …» για επαναλαμβανόμενα ίδια κελιά — πρόταση μίας γραμμής: μοναδικά κείμενα.
- Το Enter στο πεδίο διόρθωσης δεν δεσμεύει (μόνο το blur)· Figma/Sheets/Akeneo: Enter δεσμεύει, Esc ακυρώνει.
- 5 προϋπάρχοντα κόκκινα tests (`proposal-review.render` ×2 · `unmapped-lines.render` ×2 · `catalog-import-pipeline` ×1).
- `build-price-proposal.ts:43` κρατά `as ImportIssue` χωρίς λόγο · `api/notifications` «Missing or insufficient permissions».

## ΜΗΝ
- Μην αγγίξεις τις παλιές παρτίδες (93ba9ce0 · 57a458df · 273d5443 · 85-86 ×4). Μην «Ξέχνα»/«Άδειασμα μνήμης».
- Μην τυπώνεις ολόκληρο το GET της παρτίδας.
- Bash σε worktree: απλές εντολές (μεταβλητές/σύνθετα με powershell/sed αρνούνται)· grep σε όλο το `src` κάνει timeout — στένεψε.
