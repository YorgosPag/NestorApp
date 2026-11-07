# HANDOFF — ADR-929: δέσιμο από γραμμές επέκτασης → χρυσό σύνολο από CAD → δεύτερη γνώμη VLM (2026-11-07)

**Worktree:** `C:\Nestor_Worktrees\raster-plan-recognition` · **Κλαδί:** `agent/raster-plan-recognition`
(ξαναστήθηκε 2026-11-07 από το `main`· ο παλιός φάκελος είχε χαθεί). Η νέα συνεδρία συνεχίζει **εδώ**.

## 0. Κατάσταση (μετρημένη)
- Φ5.4β **επαληθεύτηκε ζωντανά** (deploy `7bd455f6`): 369/76/398 + 120 διαστάσεις + 294 κείμενο = 1257. Το «≈97» του
  παλιού handoff ήταν λάθος ανάγνωση (97 = όλοι οι ρόλοι υψηλής+μέτριας). Καταγράφηκε στο ADR-929 §6.7 + changelog.
- Κλαδί: commit `01eda2ee` (μόνο ADR-929) + αυτό το handoff. **Όχι** `wt:land`, **όχι** push — μόνο με εντολή Giorgio.
- Εκκρεμεί πρόταση (περιμένει «ναι»): γραμμή changelog για την **υλοποίηση** της Φ5.4β (λείπει· υπάρχει μόνο η επαλήθευση).

## 1. Απόφαση Giorgio: σειρά 1 → 3 → 2, ποιότητα «πέρα από τους μεγάλους», χωρίς εκπτώσεις
Αν κάτι δεν είναι σίγουρο → έρευνα στο διαδίκτυο πριν από κώδικα. Plan Mode (≥3 αρχεία). Σχέδιο στον Giorgio πριν τον κώδικα.

## 2. ΒΗΜΑ 1 — Δέσιμο διάστασης από τις γραμμές επέκτασης
**Σήμερα (επαληθευμένο με grep):** καμία αναφορά σε `extension` στα `fusion/dimension-binding.ts` και `fusion/plan-fusion.ts`.
P = `src/subapps/dxf-viewer/bim/plan-recognition`.
- `P/classify/extension-lines.ts` → `extensionMatches` βρίσκει επεκτάσεις (κάθετη ≤5°, λεπτή, ελεύθερο άκρο `isFreeEnd`).
- `P/classify/segment-role-classifier.ts` → `ROLE_WEIGHTS` (l.36), `DIMENSION_MIN 0.7`, `WALL_MAX 0.3`· τα `extensionIds`
  και τα άκρα **πετιούνται** μέσα στο `gatherEvidence`. Το `PlanSegmentRoleVerdict` (`P/plan-recognition-types.ts` ~l.110)
  δεν κρατά γεωμετρία.
- Η σύντηξη παίρνει μόνο `segmentRoles: Map<id, role>`· το δέσιμο (`dimension-binding.ts`: `pairsInFamily`, `centring`,
  `selectBinding` δύο βαθμίδων) δουλεύει **μόνο** από το ορθογώνιο κειμένου του VLM ⇒ χωρίς ανάγνωση, κανένα δέσιμο.
- Κάτω ροή αμετάβλητη: `adjustment-network.ts` (data snooping) → `fusion-results.ts` → `fusion-questions.ts` → `scale-references.ts`.

**Σχέδιο (προς επιβεβαίωση σε Plan Mode):**
1. Ο αναγνωριστής εξάγει ανά διάσταση: id γραμμής, άκρα, `extensionIds` + ελεύθερα άκρα (επέκταση του τύπου στο `plan-recognition-types.ts`, παραγωγή στο `segment-role-classifier.ts`, μεταφορά μέσω `plan-segments.ts` / `run.segmentRoles`).
2. **Ένας** δέτης: νέα πηγή υποψηφίων/όρος βαθμού στο `dimension-binding.ts` — οι παρειές όπου καταλήγουν τα ελεύθερα άκρα των επεκτάσεων. Κανένας δεύτερος δέτης.
3. Γεωμετρικό δέσιμο **και χωρίς VLM** (ποιους τοίχους μετρά η διάσταση)· η τιμή εξακολουθεί να έρχεται από το VLM.
4. Κανόνας αποδοχής (βιβλιογραφία: Dori · Lin & Ting · «dimension set syntax»): ομαδοποίηση αλυσίδων/στοιβαγμένων πρώτα· απολήξεις στα πόδια των επεκτάσεων · άθροισμα αλυσίδας = ολική · ασυμφωνία ⇒ **ερώτηση** (`PlanQuestion`), ποτέ σιωπηλή διόρθωση.
5. Πέρασμα στο `fusePlan` + `fuse()` του `systems/plan-recognition/plan-recognition-session.ts` (~l.53).
6. ADR-929 νέα υποενότητα (Φ5.5) + changelog.

## 3. ΒΗΜΑ 3 — Χρυσό σύνολο με ετικέτες ΑΠΟ ΤΟ CAD (εγκρίθηκε από Giorgio 2026-11-07)
**Ιδέα:** όχι χειρωνακτικές ετικέτες. Ζευγάρια εικόνα/PDF + διανυσματικό σχέδιο (DXF/TEK): ευθυγράμμιση του διανύσματος πάνω
στην εικόνα (υπάρχων επιλυτής βαθμονόμησης) → κάθε τμήμα του αναγνωριστή ταιριάζεται με το στοιχείο CAD από κάτω →
ρόλος από το ίδιο το CAD (`DIMENSION` ⇒ διάσταση/επέκταση με **σωστή τιμή και σημεία μέτρησης** · `TEXT`/`MTEXT` ⇒ σημείωση ·
στρώση τοίχων ⇒ παρειά). Ο Giorgio ελέγχει **μόνο** τα αταίριαστα (πρώτα τα πιο αβέβαια). Πρακτική: FloorPlanCAD (σύνολο από
CAD) + model-assisted labeling (Labelbox/Label Studio). Βαθμονόμηση: L2 logistic, leave-one-plan-out, Platt (όχι isotonic, λίγα δεδομένα).
- **Πρώτη μέτρηση (ανοιχτό ρίσκο):** πόσο καλά ευθυγραμμίζεται **σάρωση** με το DXF της (κάμψη, κλίμακα) — στην Παλαιολόγου.
- Υπάρχον: `F:\Shared\_Nestor_Plan_Golden\` (2 περιπτώσεις με `truth.kind: vector`: Παλαιολόγου PDF+DXF · Smyrnis JPG+TEK),
  `P/testing/golden-set-loader.ts`, `golden-manifest-schema.ts`, scripts στο `C:\Nestor_Worktrees\_adr929-measure\`
  (`golden_texts.py` διαβάζει DXF με ezdxf · `read_score.py` · `binding_overlay.py`). **Κανένα** script αξιολόγησης ρόλων.
- **Απογραφή `6. erga` (μόνο ανάγνωση, 2026-11-07):** 35 DXF (όλα με PDF/εικόνα στον ίδιο φάκελο — ΔΕΝ επαληθεύτηκε ότι είναι
  το ίδιο σχέδιο) · 252 TEK σε 140 φακέλους (25 με PDF/εικόνα κοντά) · 51 DWG (θέλουν μετατροπέα· ⚠️ έλεγχος άδειας N.5 πριν).
  Μόνο 1 ζευγάρι με ίδιο όνομα αρχείου ⇒ το ταίριασμα θέλει έλεγχο περιεχομένου, όχι ονόματος. Στόχος: 20–40 ζευγάρια.
- ⚠️ **Προσωπικά δεδομένα:** διαδρομές/ονόματα από `F:\Shared` **δεν** μπαίνουν σε repo, cloud ή AI (README του golden).
  Ξανατρέξε την απογραφή τοπικά (`find "/f/Shared/6. erga" -iname '*.dxf'` κ.λπ.)· νέες περιπτώσεις μόνο στο μανιφέστο, με sha256.

## 4. ΒΗΜΑ 2 — Δεύτερη γνώμη VLM
- Το VLM διαβάζει **μόνο αριθμούς** (ποτέ συντεταγμένες)· αρχή η τοπική γεωμετρία. Συμφωνία ⇒ αποδοχή · διαφωνία ⇒ νέο
  είδος `PlanQuestion` με τις δύο εκδοχές, καμία δεν εφαρμόζεται. Παρατήρηση με δική της διασπορά στο δίκτυο (robust).
- Χρειάζεται το Βήμα 1 (τοπική εκδοχή). Χωρίς νέο route: `PlanReaderOutcome` + `fuse()`.
- Ζωντανά **κλειδωμένο** (`ai-legal-disclosure-pending`) ⇒ μέχρι τότε μόνο tests.
- Benchmarks: Blueprint-Bench (2509.25229), FloorplanQA (2507.07644), FloorplanVLM (2602.06507) — κανένα δεν μετρά ανάγνωση διαστάσεων.

## 5. Κανόνες
- Όχι tsc, όχι `--no-verify`, όχι εικόνα σε AI, **κανένα test/πύλη χωρίς έγκριση Giorgio**.
- Commit μόνο στο `agent/raster-plan-recognition`, ρητή λίστα αρχείων. `wt:land` + push μόνο με εντολή Giorgio.
- Μεγάλα κείμενα με `Write` στον scratchpad· εντολές git απλές και χωριστές.
