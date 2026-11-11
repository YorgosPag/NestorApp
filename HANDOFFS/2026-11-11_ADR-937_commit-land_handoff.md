# HANDOFF — ADR-937 προσανατολισμός + γεωαναφορά IFC: commit στο κλαδί, εκκρεμεί land (2026-11-11)

## Πού
- **Worktree**: `C:\Nestor_Worktrees\adr-937-orientation`
- **Κλαδί**: `agent/adr-937-orientation` (βάση `main` @ `8afda425`)
- Η νέα συνεδρία **συνεχίζει στο ΙΔΙΟ worktree** (`EnterWorktree` με την παραπάνω διαδρομή).

## Κατάσταση
- Όλη η δουλειά του ADR-937 + του IFC είναι **ένα commit στο κλαδί** (δες `git log -1` στο worktree).
- **ΔΕΝ** έγινε `wt:land`, **ΔΕΝ** έγινε push — **μόνο με ρητή εντολή του Giorgio** (εντολή 2026-11-11, υπερισχύει του «commit ⇒ αμέσως land»).
- Tests που έτρεξαν πράσινα: τα 5 του handoff (36) · `ifc-georeference` + `project-geo-frame-agreement` + `ifc-roundtrip` + `ifc-authorship` + `geo-transform` (68) · `property-vocabulary-authority` + `derive-property-orientations` (95). Μετάλλαξη πρόσημου Βορρά ⇒ 7 κόκκινα, και επαναφορά.
- Κανένας οπτικός έλεγχος / dev server.

## Τι περιέχει το commit (πέρα από το αρχικό ADR-937)
1. Τύποι i18n + shell slice ξαναπαράχθηκαν. `/listing/[id]` **ξανασφραγίστηκε** 15.987 → 20.525 bytes στο `.i18n-shell-slice.json`, με μετρημένο `why` (+3.719 παλιά απόκλιση στο HEAD + 819 του ADR-937· SSR, όχι `next/dynamic`).
2. Αφαιρέθηκε το νεκρό `ORIENTATION_OPTIONS`.
3. **IFC**: `TrueNorth` ήταν καθρεφτισμένος (`−sin r`) ⇒ τώρα `(sin r, cos r)`. Νέο `src/services/ifc/ifc-georeference.ts`: `IfcProjectedCRS` (EPSG:2100) + `IfcMapConversion` (LoGeoRef 50). ΜΙΑ ανάγνωση των πεδίων: `src/lib/geo/project-geo-frame.ts` (τη χρησιμοποιεί και το `geoReferenceFromProject`). `GREEK_GRID_CRS` στο `src/lib/geo/greek-grid.ts`.
4. CHECK 3.7: `OverlayOrientationProposal.tsx` → `nowISO()`.
5. ADR-937, ADR-369, ADR-287, ADR-422 ενημερωμένα.

## ⚠️ Το κύριο αντίγραφο (`C:\Nestor_Pagonis`)
- Έχει ακόμα **τα ίδια 54 αρχεία staged** (από εκεί μεταφέρθηκαν ως patch). **Πριν το `wt:land`** πρέπει να καθαριστούν από το main, αλλιώς το land βρίσκει βρόμικο δέντρο / συγκρούσεις. Είναι ΑΚΡΙΒΩΣ το περιεχόμενο του commit — έλεγξε με `git diff --cached` στο main έναντι `git show` του κλαδιού πριν αγγίξεις κάτι. **Απόφαση Giorgio.**
- Το main **δεν έχει** εγκατεστημένο το `@formatjs/icu-messageformat-parser` (CHECK 3.115 πέφτει εκεί). Αιτία: το έργο είναι **pnpm** (`packageManager: pnpm@9.14.0`)· το `npm install` **σπάει** πάνω στους συνδέσμους `.pnpm` (`Cannot read properties of null (reading 'matches')`) — **ΜΗΝ** το ξανατρέξεις. Σωστό: `pnpm install --frozen-lockfile` στο main (το lockfile ήδη το περιέχει).

## Επόμενα (μόνο με εντολή)
1. Καθαρισμός των 54 staged αρχείων από το main → `npm run wt:land -- adr-937-orientation` → αναφορά commit + νέο `main` HEAD.
2. Push → μόνο με «push».
3. Οπτικός έλεγχος: πυξίδα 3×3 στη φόρμα ακινήτου, ηλιασμός στη δημόσια αγγελία, λωρίδα πρότασης στο DXF overlay, διάλογος χάρτη.
4. IFC: άνοιγμα δείγματος σε BIM viewer (π.χ. BlenderBIM/Bonsai ή xBIM) για επιβεβαίωση θέσης στον κάνναβο.

## ΜΗΝ
- `tsc` (N.17) · `--no-verify` · `npm install` (pnpm έργο) · push / land χωρίς εντολή · commit στο `main`.
