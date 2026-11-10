# Handoff — ADR-929 · Ζωντανή επαλήθευση «εικόνα → τοίχοι BIM» ΕΓΙΝΕ · Εύρημα: πάγωμα >30″ στη «Δημιουργία τοίχων» · Επόμενο: μέτρηση (LoAF) + έλεγχος 3D

**Ημερομηνία:** 2026-11-10 · **Worktree αυτού του αρχείου:** `C:\Nestor_Worktrees\product-portal` · **Κλαδί:** `agent/product-portal`
⚠️ Η εργασία αφορά το **ADR-929**. Ο κώδικας και το ADR ζουν στο worktree `C:\Nestor_Worktrees\raster-plan-recognition`
(κλαδί `agent/raster-plan-recognition`). Αυτή η συνεδρία ήταν κλειδωμένη στο `product-portal` (το `EnterWorktree` αρνείται
worktree εκτός `.claude/worktrees/`). Γι' αυτό το handoff μπήκε εδώ. **Καμία αλλαγή κώδικα σε αυτή τη συνεδρία.**

## Κανόνες (Giorgio) — αμετάβλητοι
Κάθε βήμα με «ναι» · κανένα test χωρίς έγκριση · όχι tsc · SSoT grep πριν από κώδικα · έρευνα όπου δεν είσαι σίγουρος ·
ποιότητα «μεγάλων παικτών» · commit μόνο σε `agent/*` με ρητή λίστα · **wt:land και push ΜΟΝΟ με ρητή εντολή Giorgio, χωριστά** ·
ποτέ `--no-verify` / `SKIP_*` · ελληνικά.

## 1. Κατάσταση του worktree `raster-plan-recognition` (ΔΕΝ αγγίχτηκε)
- HEAD `d367f897` (handoff 0.2/0.3a)· 1 μπροστά / 6 πίσω από `main`.
- Staged (όχι commit), όπως λέει το handoff 0.3: `src/lib/geometry/min-area-rect.ts`, `src/lib/geometry/raster/raster-warp.ts`, 7 × `bim/plan-recognition/ocr/ocr-*.ts`.
- ⚠️ **ΕΠΙΠΛΕΟΝ, που το handoff 0.3 δεν αναφέρει** (δουλειά 0.4, αδέσμευτη): τροποποιημένα `.gitattributes`, `.model-assets.json`,
  `src/lib/workers/worker-rpc-{client,host,protocol}.ts` (+239/−46)· untracked `public/ort/` (14 MB) + 7 αρχεία
  `ocr/{ocr-asset-loader,ocr-model-assets,ocr-onnx-runtime,plan-ocr-client,plan-ocr-host,plan-ocr-worker-spawn,plan-ocr.worker}.ts`.
  Άγνωστο ποιος τα έγραψε — ρώτα τον Giorgio πριν τα αγγίξεις.
- Handoff εκεί: `C:\Nestor_Worktrees\raster-plan-recognition\HANDOFFS\2026-11-10_ADR-929_phase0-step0.3-DONE-measured-staged_next-0.4-worker_handoff.md`.

## 2. Ζωντανή επαλήθευση (nestorconstruct.gr, `/api/build-info` = `0876de77` = `main` = `origin/main`)
Όροφος: ΕΡΓΟ Α → Κτίριο Α → «3ος Όροφος» (8 στοιχεία), υπόβαθρο PDF «ΚΑΤΟΨΗ ΙΣΟΓΕΙΟΥ». URL:
`https://nestorconstruct.gr/o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/dxf/viewer?bldg=bldg_8acc7e34-59bd-4dfb-8a56-e2568686250f&lvl=lvl_7184c4f0-f414-487a-a754-64da65c5190e`
(⚠️ στη λίστα επιπέδων υπάρχουν πολλές κάρτες «3ος Όροφος» σε άλλα κτίρια — χρησιμοποίησε το URL.)

**Α. Αναγνώριση (τοπικά, Worker, χωρίς AI)** — «Τοίχοι από το σχέδιο» → «Αναγνώριση από την εικόνα του υποβάθρου»:
| | 10/11 | 08/11 (§6.8) |
|---|---|---|
| υψηλή / μέτρια / χαμηλή | **306 / 65 / 337** | 364 / 74 / 388 |
| διάσταση (`data-role=dimension`) | **137** | 137 |
| μέσα σε κείμενο (`annotation`) | **150** | 294 |
Χρόνος 8–33″ (άνω όριο με την αναμονή μου). Πρόταση: θα δημιουργηθούν 0 · περιμένουν πάχος 73 · απόφαση 5 · δεν θα 76.
Ομάδες πάχους: 50 (12) · 105 (31) · 205 (10) · 250 (19) · 340 (9) mm. **Ανοιχτό:** γιατί άλλαξαν οι αριθμοί από 08/11
(πιθανώς §6.11–6.15 — ΔΕΝ επαληθεύτηκε).

**Β. Ανάγνωση με AI:** ο προέλεγχος λέει «δεν έχει ενεργοποιηθεί ακόμα: περιμένει την ενημέρωση της πολιτικής απορρήτου».
Αποστολή ανενεργή — **δεν στάλθηκε τίποτα**. Δεν επαληθεύεται ζωντανά πριν ανοίξει (σχέση με ΓΚΠΔ / ADR-936).
Η όψη ελέγχου δείχνει 4006×3374 px, 1,95 MB, sha256, αυτόματη απόκρυψη πινακίδας.

**Γ. Εικόνα → τοίχοι BIM: ✅** Επιβεβαίωση μόνο της ομάδας 205 mm ⇒ «Θα δημιουργηθούν 9» ⇒ «Δημιουργία τοίχων (9)» ⇒
«Δημιουργήθηκαν 9 τοίχοι». Οπτικά ακριβώς πάνω στους τοίχους 20 cm (ΚΑΤΑΣΤΗΜΑ, διάδρος, σκάλα, Ε.Υ.Α.Θ.).
Αναίρεση ⇒ εξαφανίστηκαν· **επαναφόρτωση ⇒ 8 στοιχεία, κανένας τοίχος** (καθαρό). 3D **δεν** ελέγχθηκε.

## 3. 🔴 Εύρημα: πάγωμα >30″ στο «Δημιουργία τοίχων (9)»
Το CDP έληξε στα 30.000 ms. Μετά εμφανίστηκαν: «Κανένα μέλος δεν φορτίστηκε…» και «Κανένα μέλος δεν χρειαζόταν οπλισμό» (×2).
Ανάγνωση κώδικα (υπο-πράκτορας, **όχι μέτρηση**):
- Όλα στον κύριο νήμα· κανένας Worker σε walls / structural / model-from-drawing.
- Μέσα στο κλικ ο πλήρης υπολογισμός από raster τρέχει ≥3 φορές: `model-from-drawing-session.ts:203-243` (approve → `compute`
  έλεγχος φρεσκάδας · `writeApproved` → `recompute`) + `ModelFromDrawingHost.tsx:239-240` (openings `refresh`).
- `addWallsToScene` (`bim/walls/add-wall-to-scene.ts:~150-175`) → `CreateWallsCommand` → `drawing:entity-created` ανά τοίχο (`origin:'bulk'`).
- `useStructuralRelevanceRouter.ts:~55` μετατρέπει κάθε δημιουργία τοίχου σε `bim:structural-geometry-changed` **χωρίς** φίλτρο `bulk`
  ⇒ load takedown (`structural-load-takedown-core.ts:68/81`) → auto-reinforce (`structural-auto-reinforce-core.ts:84/120`, εκπέμπει 2 φορές)
  + sizing/foundation/organism/tie-beam (`app/DxfViewerContent.tsx:~320-345`). Συνένωση ανά microtask (μία φορά, όχι 9).
- Κάθε βήμα κάνει νέο αντικείμενο σκηνής· ο βοηθός πρότασης ελέγχει φρεσκάδα **κατά ταυτότητα** (`model-from-drawing-live.ts:43`,
  `model-from-drawing-scene-sync.ts:69-83`) ⇒ πιθανοί επιπλέον πλήρεις υπολογισμοί raster ανά αντικατάσταση. Και retrim 200 ms ⇒ 2ος γύρος.
- **Υπόθεση (μη μετρημένη):** κυριαρχούν οι επαναλαμβανόμενοι `computeWallProposal` / `resolveProposalLines` / `buildAssistantPreview` από raster.

## 4. ΕΠΟΜΕΝΟ (κάθε βήμα με «ναι» Giorgio)
1. **Μέτρηση:** ίδιος όροφος, `PerformanceObserver({type:'long-animation-frame', buffered:true})` με `scripts[]` (sourceURL/functionName/duration)
   πριν το κλικ · «205 mm → Επιβεβαίωση» · «Δημιουργία τοίχων (9)» · συλλογή LoAF · **έλεγχος σε 3D** όσο υπάρχουν οι τοίχοι ·
   αναίρεση · επαναφόρτωση ⇒ 8 στοιχεία. (Γράφει προσωρινά στην παραγωγή — έχει «ναι» μόνο αν το ξαναπεί.)
2. Μετά τη μέτρηση: σχέδιο διόρθωσης (SSoT audit + έρευνα + ADR-911/ADR-929 + ADR της στατικής αυτοματοποίησης). Κατευθύνσεις
   (προτάσεις, όχι αποφάσεις): ένας υπολογισμός ανά κλικ με επαναχρήση · αποκοπή φρεσκάδας με γεωμετρικό κλειδί αντί για ταυτότητα σκηνής ·
   η αυτόματη στατική ανάλυση να μη τρέχει (ή να αναβάλλεται/σε Worker) σε `origin:'bulk'`.
3. Σε αναμονή: ίδια ροή με PNG/JPG (ανέβασμα σε δοκιμαστικό όροφο) · βαθμολογία απέναντι στο CAD (test) · καταγραφή στο ADR-929
   (στο worktree `raster-plan-recognition`).
