# HANDOFF — ADR-937: ζωντανή επαλήθευση μετά το push (open-envelope + WizardProgress)

**Ημερομηνία:** 2026-11-12
**Worktree:** `C:\Nestor_Worktrees\adr-937-followup`
**Κλαδί:** `agent/adr-937-followup`
**Τοπικό main (μετά το land):** `700c4584` — ο Giorgio έχει ξεκινήσει push· η νέα συνεδρία **περιμένει** το μήνυμά του ότι ολοκληρώθηκε.

---

## 1. Τι έγινε (ADR + git = αλήθεια)

Commit `700c4584` (8 αρχεία) — `feat(adr-937): open-envelope status`:

1. **4η κατάσταση `open-envelope`** στο `usePropertyOrientationProposal.ts`:
   υπάρχουν εξωτερικοί τοίχοι, αλλά **καμία** αλυσίδα κελύφους δεν κλείνει ⇒ δεν ορίζεται όριο (Revit «Not Enclosed»).
   Πριν: έλεγε ψευδώς «δεν βρέθηκαν ανοίγματα».
   - `src/subapps/dxf-viewer/hooks/data/usePropertyOrientationProposal.ts` (γρ. 90-91)
   - `src/subapps/dxf-viewer/ui/components/OverlayOrientationProposal.tsx` (`EMPTY_MESSAGE_KEY`)
   - `src/i18n/locales/{el,en}/dxf-viewer-panels.json` → `overlayProperties.orientationProposal.openEnvelope`
   - `src/types/i18n.ts` (παραγόμενο)
   - test: `hooks/data/__tests__/usePropertyOrientationProposal.test.ts` (Κ5 + νέα περίπτωση T-junction)
   - ADR-937 §2.2 + changelog 2026-11-12
2. **WizardProgress** — τα κυκλάκια βημάτων του οδηγού ADR-914 ήταν λευκό σε λευκό στο light mode.
   Τώρα `bg[infoSolid]` + `text[SOLID_FILL_INK.infoSolid]` (ADR-854 §3).
   - `src/subapps/dxf-viewer/ui/components/WizardProgress.tsx`

Hook κατά το land: jest «Type Safety» 12/12 πράσινο. **Δεν** έτρεξε tsc (N.17).

## 2. Επόμενο βήμα — ΖΩΝΤΑΝΗ ΕΠΑΛΗΘΕΥΣΗ (μόνο αφού ο Giorgio πει ότι το push τελείωσε)

Δεδομένα δοκιμής (εγκεκριμένα, δοκιμαστικός χώρος):
- Εταιρεία **ALFA ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ** (`comp_9c7c1a50…`) → έργο «ΣΥΓΚΡΟΤΗΜΑ ΚΑΤΟΙΚΙΩΝ ΑΙΓΑΙΟΝ ΙΙ» (`proj_2497601f`) → Κτήριο Α (`bldg_3e91…`) → Ισόγειο (`flr_5c28e0b9…`)
- Ακίνητο «Διαμέρισμα 95 τ.μ.» (`prop_48a7caf6…`)
- Επίπεδο κάτοψης ακινήτου `lvl_6aab879a-97f6-455b-8c3f-65058d556473` (`unit`), σκηνή `file_82b474c1`, DXF «Ισόγειο 1.dxf» (`file_227cec18`)
- Στη σκηνή: 38 τοίχοι από «Τοίχοι από το σχέδιο» + 5 πόρτες + 6 παράθυρα (3 κενά αναποφάσιστα) + ο παλιός `wall_50ce6e14` με την πόρτα του.

Έλεγχοι:
1. **Οδηγός ADR-914** (Άνοιγμα/Δημιουργία): τα κυκλάκια βημάτων διαβάζονται σε **light και dark** mode (ενεργό = γεμάτο info με αντίθετο μελάνι).
2. **Λωρίδα «Πρόταση προσανατολισμού»** στο πάνελ επιπέδων για το παραπάνω επίπεδο: πρέπει να γράφει το νέο μήνυμα
   «Το εξωτερικό κέλυφος δεν κλείνει: …» (όχι «δεν βρέθηκαν ανοίγματα»). Το κουμπί αποστολής **απενεργοποιημένο**.
3. ⛔ **ΜΗΝ πατήσεις «Πρόταση στο ακίνητο»** χωρίς ρητό «ναι» του Giorgio.

## 3. Ανοιχτή απόφαση (του Giorgio — μην την πάρεις μόνος)

Το κέλυφος δεν κλείνει γιατί οι γωνίες των εξωτερικών τοίχων από το ADR-929 μένουν **ανένωτες** (κενά 0,1–1,45 m).
Επιλογές: (α) ένωση γωνιών ζωντανά με «Ένωση Τοίχων» για να δούμε την κατάσταση `derived`·
(β) νέο αντικείμενο στο ADR-929 (ο βοηθός να ενώνει γωνίες μόνος του, όπως Revit «Join» στο Wall by Pick Lines).
Ρώτα πρώτα.

## 4. Ευρήματα εκτός εμβέλειας — ΜΟΝΟ αναφορά, όχι διόρθωση

- Ίδιο λάθος ζευγάρωμα `bg.info` + `text.inverted`: `StatusBar.tsx:96,141`, `BaseButton.tsx:54,59`, `FloorPlanToolbar.tsx:123`, `DebugToolbar.tsx`.
- Η γραμμή σύνδεσης του οδηγού χρησιμοποιεί το αχνό `bg.info`.
- Στο changelog του ADR-937 η εγγραφή 2026-11-12 μπήκε πριν την τελευταία της 2026-11-11 (μικρή αταξία σειράς).

## 5. Κανόνες

- Ελληνικά πάντα. Κανένα test/tsc χωρίς έγκριση. Μόνο ό,τι ζητηθεί.
- Commit μόνο στο `agent/adr-937-followup` με ρητή λίστα αρχείων· **ποτέ** στο main.
- `wt:land` και push **μόνο** με ρητή εντολή του Giorgio. Ποτέ `--no-verify`.
