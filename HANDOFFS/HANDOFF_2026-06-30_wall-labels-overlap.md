# HANDOFF — Τα labels του τοίχου ΕΠΙΚΑΛΥΠΤΟΝΤΑΙ (όνομα/ταυτότητα + διάσταση πέφτουν στο ίδιο σημείο)

**Ημερομηνία:** 2026-06-30
**Subapp:** `src/subapps/dxf-viewer`
**Κατάσταση working tree:** ⚠️ **ΜΟΙΡΑΖΕΤΑΙ με άλλον agent.** COMMIT τον κάνει **ΜΟΝΟ ο Giorgio**. `git add -A` **ΑΠΑΓΟΡΕΥΕΤΑΙ** — stage μόνο specific files.
**Μοντέλο:** Opus (rendering + label layout).
**Σχετικά ADR:** ADR-508 §wall-hud (Live wall identity HUD), και ό,τι ADR καλύπτει τα entity dimension labels (να επιβεβαιωθεί στο audit).

---

## 🎯 ΤΟ ΠΡΟΒΛΗΜΑ (browser-verified από Giorgio, 2 screenshots)

Δύο labels του τοίχου ζωγραφίζονται στην **ίδια θέση** και **πατάει το ένα πάνω στο άλλο**. Συμβαίνει σε δύο σημεία, ίδιο root pattern:

**Περίπτωση A — COMMITTED τοίχος (screenshot 223557):**
- **Όνομα/ταυτότητα τοίχου** («Επιπλέον τοίχου», κίτρινο) επικαλύπτεται με
- **διαστασιολογικό label** («L=… m  t=…» / «270 · t…»).

**Περίπτωση B — ΦΑΝΤΑΣΜΑ τοίχου (preview) όταν είναι ΚΑΘΕΤΟ (screenshot 223915):**
- **HUD ταυτότητας** («πάχος 0,210 m · ύψος 3,000 m») επικαλύπτεται με
- **μήκος** (aligned dimension, «2,600 m»).
- Όταν ο τοίχος είναι **οριζόντιος** δεν φαίνεται το πρόβλημα· όταν είναι **κάθετος** το perpendicular offset «καταρρέει» και τα δύο labels πέφτουν μαζί.

**Κοινό root:** δύο **ανεξάρτητοι** label producers αγκυρώνονται ~στο ίδιο σημείο, **χωρίς κοινό anti-overlap / stacking layout**. Η απόσταση/offset δεν λαμβάνει υπόψη το άλλο label ούτε τη γωνία του τοίχου.

**Ζητούμενο (Giorgio):** τα labels να **στοιβάζονται με σταθερό offset** ώστε να **ΜΗΝ επικαλύπτονται ΠΟΤΕ**, ανεξάρτητα από τη γωνία του τοίχου (κάθετος/οριζόντιος/λοξός). Big-player practice (Revit/AutoCAD: το dimension text κάθεται με offset από τη dimension line· identity vs dimension σε **ξεχωριστές baselines**).

---

## 🔬 ΣΗΜΕΙΑ-ΑΦΕΤΗΡΙΑΣ ΓΙΑ SSoT AUDIT (grep ΠΡΩΤΑ — ΜΗΝ γράψεις κώδικα χωρίς να επιβεβαιώσεις)

Από προκαταρκτικό grep (να επαληθευτούν/ιχνευθούν ΟΛΑ):
- **Wall live HUD (ταυτότητα «πάχος·ύψος»):** `canvas-v2/preview-canvas/wall-hud-paint.ts` (ADR-508 §wall-hud). Reuse `paintAlignedOverlayDimension` + `renderPreviewDimension` / `drawOverlayLabel` / `formatLengthForDisplay` (βλ. memory `reference_wall_live_hud`).
- **Aligned length dimension («2,600 m»):** `paintAlignedOverlayDimension` (εξήχθη ως SSoT — grep όπου ορίζεται/καλείται).
- **Preview orchestration:** `canvas-v2/preview-canvas/PreviewRenderer.ts`, `PreviewCanvas.tsx`, `hooks/drawing/drawing-hover-handler.ts`.
- **Dimension labels (L=/t=):** `bim/labels/bim-dim-labels.ts` (+ test). `bim/columns/column-dim-labels.ts` (parallel — πιθανό κοινό SSoT για offset).
- **Committed wall όνομα label («Επιπλέον τοίχου»):** grep τον producer (π.χ. wall entity label renderer / default wall name). ΔΕΝ εντοπίστηκε ακόμη — **ίχνευσέ το** (grep `Επιπλέον`, wall name label, entity label renderer στους `rendering/entities/*` ή `bim/labels/*`).

### Τι να ΨΑΞΕΙΣ ρητά στο audit (για να ΜΗΝ φτιάξεις διπλότυπο):
1. Υπάρχει **ήδη** SSoT για **label offset / anti-collision / stacking** (π.χ. perpendicular offset helper, label-layout util, `OVERLAY_DIMENSIONS` tokens, dimension text placement); Αν ναι → **reuse**, μην φτιάξεις δεύτερο.
2. Ίχνευσε **ΟΛΟ** το pipeline και των δύο labels (anchor point → offset → paint) — μην κρίνεις από ένα isolated helper (βλ. memory feedback «trace full pipeline»).
3. Είναι το offset υπολογισμένο με βάση τη **γωνία** του τοίχου (perpendicular); Γιατί καταρρέει στο κάθετο; (πιθανόν offset μόνο σε ένα άξονα ή κοινή baseline).
4. Μοιράζονται οι δύο περιπτώσεις (committed + ghost) **κοινό** label-paint SSoT ώστε μία διόρθωση να τις λύνει και τις δύο;

---

## 🛠️ ΚΑΤΕΥΘΥΝΣΗ (enterprise + FULL SSoT — διάλεξε βάσει του audit)

- Κεντρικό **stacking/offset SSoT**: μία πηγή που τοποθετεί N labels κατά μήκος μιας **κάθετης-στη-baseline** στοίβας με σταθερό gap (ανεξάρτητα γωνίας), ώστε identity + dimension να μην πέφτουν ποτέ μαζί.
- Reuse το υπάρχον (αν υπάρχει offset/label helper) — **ΜΗΝ** δημιουργήσεις δεύτερο μηχανισμό.
- Αν βρεις **προϋπάρχοντα διπλότυπα** (π.χ. column-dim-labels vs bim-dim-labels με ίδιο offset math) → **κεντρικοποίησέ τα κι αυτά** (ΔΙΑΤΑΓΗ Giorgio).
- Big-player: αν Revit/AutoCAD/Figma έχουν συγκεκριμένη σύμβαση (dim text offset, leader, separate baselines) → ακολούθησέ την.

---

## 🚨 ΕΝΤΟΛΕΣ GIORGIO (απαράβατες)
1. **FULL ENTERPRISE + FULL SSoT**, όπως **Revit / Maxon (Cinema 4D) / Figma**. Αν οι μεγάλοι δεν προτείνουν κάτι → ακολούθησε την πρακτική τους.
2. **ΠΡΙΝ κώδικα → ΠΡΑΓΜΑΤΙΚΟ SSoT AUDIT (grep).** Reuse υπάρχοντα κώδικα. **ΜΗΝ** φτιάξεις διπλότυπο label/offset μηχανισμό.
3. Αν βρεις προϋπάρχοντα διπλότυπα → **κεντρικοποίησέ τα κι αυτά**.
4. **ΟΧΙ commit / ΟΧΙ push** από agent. Shared working tree → stage μόνο specific files, **ΟΧΙ `git add -A`**.
5. **ΟΧΙ `tsc`** (N.17). jest επιτρέπεται.
6. Απαντάς **ΣΤΑ ΕΛΛΗΝΙΚΑ**.
7. Πλάνο **ΠΡΙΝ** υλοποίηση. Στο τέλος: ✅/⚠️/❌ Google-level + ενημέρωση ADR (ADR-508 §wall-hud + όποιο ADR καλύπτει τα dim labels).

## Pointers
- ADR-508: `docs/centralized-systems/reference/adrs/ADR-508-*.md` (§wall-hud)
- DXF render architecture rules: `CLAUDE.md` §«DXF VIEWER ARCHITECTURE» (CHECK 6B/6D — αν αγγίξεις canvas drawing files, stage ADR).
- Screenshots: `C:\Nestor_Pagonis\Στιγμιότυπο οθόνης 2026-06-30 223557.jpg` (committed) + `...223915.jpg` (vertical ghost).
