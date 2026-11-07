# HANDOFF — ADR-929 Βήμα 3 (πυρήνας καταγραφής + αλήθεια CAD) στο main και pushed · επόμενο: ζωντανή μέτρηση ρόλων + κώδικας που δεν περιμένει το build (2026-11-07)

**Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`. Η νέα συνεδρία
συνεχίζει **εδώ**. Commit μόνο στο κλαδί, με ρητή λίστα αρχείων. `wt:land` + push **μόνο με εντολή Giorgio**. Στο `main` κανένα commit.

## 0. Κατάσταση (μετρημένη)
- `main` = `origin/main` (push από Giorgio). Περιέχει: Φ5.5 (`a271b519` + `c10e9b4e`) και **Βήμα 3** (`5cf4c4a4`).
- Το build στο Netcup **τρέχει / μόλις έτρεξε** ⇒ η ζωντανή επαλήθευση γίνεται όταν ανέβει.
- Tests Βήματος 3 (με έγκριση): **3/3 σουίτες, 33/33** (`src/lib/geometry/__tests__/registration.test.ts`,
  `P/__tests__/cad-truth.test.ts`, `P/__tests__/golden-set.test.ts`). ⚠️ **Δεν** έχουν γραφτεί ακόμη στο ADR §6.9, και **δεν** έχουν γίνει μεταλλάξεις.
- P = `src/subapps/dxf-viewer/bim/plan-recognition`. Πλήρης περιγραφή: ADR-929 **§6.9** (και §6.8 για τη Φ5.5).

## 1. Τι ξέρουμε (μην το ξαναμετρήσεις)
- **Η Παλαιολόγου ΔΕΝ έχει διανυσματική αλήθεια.** `.dxf` = 1 MTEXT · `_Image.dxf` = 23.585 3D-polylines `PFV` (διανυσματοποίηση
  σάρωσης) · `.rar` = μόνο PDF. Στο μανιφέστο είναι **βαθμίδα Β** (αντίγραφο `plan-golden-manifest.json.2026-11-07.bak`).
- Μανιφέστο: υποχρεωτικό `truth.relation` ∈ `printed-from | scanned-from | unverified`. Σμύρνη (JPG + TEK) = `unverified`
  (ο Giorgio δεν ξέρει)· το κρίνει η μέτρηση καταγραφής.
- Νέο SSoT `src/lib/geometry/registration/` (`registration-types` · `fit-transform` · `chamfer-register`): σημείο-προς-γραμμή,
  Baarda (ίδιος επιλυτής με τη Φ4), Hartley, chamfer για την επιλογή της αρχής **ανάμεσα σε δηλωμένους υποψηφίους**, ICP 24→12→6→3 px,
  κέντρο πινελιάς, `not-converged` με λόγο.
- Αλήθεια CAD `P/testing/cad-truth/` (`tek-truth` μέσω `parseTekScene` · `dxf-truth` μέσω `runDxfParse`, τοίχος μόνο από δηλωμένη στρώση).
- Python: ezdxf 1.4.4 · numpy · cv2 · PIL · PyMuPDF (`fitz`, **AGPL** ⇒ μόνο τοπικά, εκτός repo) · rarfile. **Όχι** scipy/skimage.
  Scripts στο `C:\Nestor_Worktrees\_adr929-measure\` (υπάρχουν `golden_render.py`, `golden_texts.py`, `read_score.py`, `binding_overlay.py`).

## 2. Όταν ανέβει το build — ζωντανή μέτρηση ρόλων Φ5.5 (ADR §6.8)
Ίδιο σχέδιο με την επαλήθευση της Φ5.4β (§6.7). Πριν: επίπεδα **369/76/398** + `data-role=dimension` **120** + `annotation` **294** = **1257**.
Αναμένεται ότι οι ενδιάμεσες επεκτάσεις αλυσίδων θα περάσουν από τοίχο/αβέβαιο σε `extension-line`, ενώ το **άθροισμα 1257 μένει ίδιο**.
Γράψε τα νούμερα και το ισοζύγιο στο §6.8 + changelog. Τα `dimensionSpans` **δεν** φαίνονται στην οθόνη (καμία οπτική απόδειξη).

## 3. Κώδικας που ΔΕΝ περιμένει το build (προτάσεις — όλα με «ναι» Giorgio, πρώτα Plan Mode + SSoT grep)
1. **ADR §6.9:** γράψε τα 33/33 + μεταλλάξεις στον πυρήνα καταγραφής (στο worktree, με επαναφορά στην ίδια εντολή).
   Υποψήφιες μεταλλάξεις: κέντρο → άκρη πινελιάς · χωρίς κανονικοποίηση Hartley · χωρίς snooping στον τελευταίο γύρο.
2. **Εύρεση ζευγών** στο `F:\Shared\6. erga` (script εκτός repo): για κάθε TEK/DXF με PDF/εικόνα κοντά, απόδοση εικόνας,
   δοκιμαστική καταγραφή, βαθμός chamfer. Έξοδος με sha256 στον ιδιωτικό φάκελο, **χωρίς ονόματα** στην οθόνη. Ο Giorgio επιβεβαιώνει τη λίστα.
   ⚠️ Χρειάζεται τρόπος να τρέξει TS (`registerToInk`, `tekTruth`) από Node: υπάρχει `swc-register.js` στο `_adr929-measure`.
   ⚠️ Αρχικοί υποψήφιοι: κλίμακα εκτύπωσης (1:50/1:100 × DPI) + κέντρο ορίων. Το Y του Τέκτονα δείχνει πάνω ⇒ αναστροφή.
3. **Πρώτη μέτρηση καταγραφής:** Σμύρνη + 1–2 ζεύγη. Κριτήριο p95 ≤ 2 px ⇒ το affine αρκεί, αλλιώς μετριέται η ανάγκη για τοπικό μοντέλο.
   Ραστεροποίηση PDF με τον renderer της παραγωγής (`pdfjs-dist` 4.5.136 + `@napi-rs/canvas`). Αποτελέσματα στο §6.9.
4. **Βαθμολογητής ρόλων** (`P/testing/`): τμήματα αναγνωριστή ↔ τμήματα CAD (μετά την καταγραφή, ανοχή γωνίας/απόστασης) ⇒
   πίνακας σύγχυσης ρόλων · έλεγχος `dimensionSpans` έναντι `CadTruthDimension.measured` · ουρά «μόνο τα αταίριαστα, πρώτα τα πιο αβέβαια».
5. Καταχώριση `lib/geometry/registration` στο `docs/centralized-systems` + `.ssot-registry.json` · μετάπτωση του affine του
   `geo-canvas/.../transformation-calculator.ts` στο νέο SSoT (ξεχωριστή εργασία).
6. Μετά: βαθμονόμηση (L2 logistic, leave-one-plan-out, Platt) · Βήμα 2 VLM δεύτερη γνώμη (μόνο tests, ζωντανά κλειδωμένο `ai-legal-disclosure-pending`).

## 4. Κανόνες
- Plan Mode + σχέδιο στον Giorgio πριν από κώδικα · SSoT audit (grep) πρώτα · έρευνα στο διαδίκτυο όπου δεν είναι σίγουρο.
- Όχι tsc, όχι `--no-verify`, **κανένα test/πύλη χωρίς έγκριση**, **καμία εικόνα σε AI**, κανένα όνομα/διαδρομή από `F:\Shared` σε repo/AI.
- Jest: `npx jest <αρχεία>` από `C:\Nestor_Pagonis`. Οι προειδοποιήσεις «duplicate manual mock» από `.claude/worktrees/` είναι θόρυβος άλλων πρακτόρων.
- Μεγάλα κείμενα με `Write` στον scratchpad· git: `"C:\Program Files\Git\cmd\git.exe"`.
