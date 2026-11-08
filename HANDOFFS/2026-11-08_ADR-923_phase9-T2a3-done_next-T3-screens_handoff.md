# HANDOFF — ADR-923 §5.15 Φάση 9 · Θ.2α-3 ✅ (κλαδί) → επόμενο Θ.3 (οθόνες εκδόσεων)

**Ημερομηνία:** 2026-11-08
**Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **κλαδί:** `agent/catalog-editions` (η νέα συνεδρία συνεχίζει **στο ίδιο** worktree)
**git:** `main` = `8c976edd` (Θ.2α-1 + Θ.2α-2, push έγινε, deploy Netcup ✅ live). Στο κλαδί πάνω από το `main`: handoff `a1c3553e` + **Θ.2α-3 `0d209104`** + αυτό το handoff. **ΔΕΝ** έγινε `wt:land` / push του Θ.2α-3 — μόνο με εντολή Giorgio. **Ποτέ** commit στο `main`.
**ADR:** `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md` — διάβασε **§5.15** (αποφάσεις Θ1–Θ4, Η1–Η6, βήματα), **§5.15.1** (ο διακομιστής του Θ.1β: διαδρομές, σύνορο, κριτής) και **§5.15.2** (ο viewer, γραμμές Θ.2α-1/2/3).

## 1. Κατάσταση
| Τι | Κατάσταση |
|---|---|
| Θ.1α/Θ.1β (πυρήνας + διακομιστής εκδόσεων) | ✅ στο `main` — άγκυρες γραμμένες, **δεν έτρεξαν** |
| Θ.2α-1/2 (range με άδεια, κείμενο, σύνδεσμοι, `#page=N`, λήψη) | ✅ στο `main`, live |
| Θ.2α-3 (πλευρικό πάνελ: μικρογραφίες + περιεχόμενα) | ✅ `0d209104` **μόνο στο κλαδί** — άγκυρα `src/components/file-manager/__tests__/pdf-sidebar.test.ts` γραμμένη, **δεν έτρεξε** |
| Ζωντανός έλεγχος (2026-11-08) | Ο viewer δείχνει τον κατάλογο Aries (434 σελ.) **μόνο** στην εισαγωγή: `/o/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/catalog/imports?batch=cibat_bd061d40-5cf2-44fe-82a6-683e52401d9b` — χωρίς `features`, ολόκληρο αρχείο (~15″). **Καμία οθόνη** δεν δείχνει δημοσιευμένη έκδοση ⇒ αυτό είναι το Θ.3 |
| Αναβαθμίσεις Θ.2β/Θ.2α-4 (ευρετήριο κειμένου + αναζήτηση) | ⏳ μετά το Θ.3 ή παράλληλα — απόφαση Giorgio |

## 2. Ο viewer σήμερα (στο κλαδί)
`src/components/file-manager/PdfCanvasViewer.tsx` + `pdf-canvas-config.ts` (`PdfViewerFeatures`: `textSelection` · `links` · `pageInUrl` · `download{fileName}` · **`sidebar`**, όλα opt-in · πηγή `license: { key, issue }` για έντυπο με άδεια ή `url`/`fileId`/`urlDelivery`).
Θ.2α-3: `pdf-thumbnail-store.ts` (μνήμη + ουρά 2 + ακύρωση + συγκομιδή από τον κύριο καμβά, pub/sub μέσω `createExternalStore`) · `usePdfThumbnails` · `PdfThumbnailList` (`@tanstack/react-virtual`) · `pdf-outline.ts` · `usePdfOutline` · `PdfOutlineTree` · `usePdfSidebar` (`/PageMode` → `STORAGE_KEYS.PDF_VIEWER_SIDEBAR`) · `PdfSidebar` (`Tabs`, κινητό `Sheet`) · `src/lib/a11y/tree-navigation.ts` (γενικός πυρήνας APG tree).

## 3. Επόμενο: Θ.3 — οι οθόνες (§5.15 «Βήματα»)
**ΠΡΩΤΑ πραγματικό SSoT audit με grep**, έρευνα στο διαδίκτυο (Publitas «Group URL» / ArchiExpo «Archived catalogs» / Grohe Specifiers — ήδη στο §5.15.1, επέκτεινε για UX ραφιού/ιστορικού εκδόσεων), μετά Plan Mode (N.8: πιθανώς 5+ αρχεία σε 2+ τομείς ⇒ ρώτα Giorgio Plan Mode ή Orchestrator).
Τρεις επιφάνειες (σημεία εκκίνησης — **επαλήθευσε**, δεν είναι συμπέρασμα):
1. **«Δημοσίευση σε…» στις εκδόσεις του εκδότη** — `app/(app)/o/[workspace]/catalog/publications` + `components/catalog/.../PublicationRunList.tsx`: δημοσίευση έτοιμου `screen` σε κοινό (`anonymous` ή ομάδα πελατών), λίστα δημοσιευμένων/αντικατεστημένων/αποσυρμένων, απόσυρση. Διαδρομές: `GET/POST /api/catalog/editions`, `POST …/editions/[id]/withdraw`. ⛔ **Θ4**: καμία έκδοση **με τιμές** — το φράγμα το κάνει ήδη `publishabilityOf`· η UI δεν προσφέρει καν την επιλογή.
2. **Βιτρίνα `/suppliers/<ψευδώνυμο>/catalogs`** — υπάρχει `app/(light)/suppliers/[alias]` · ανώνυμη πόρτα αρχείου `GET /api/supplier-catalogs/[supplier]/editions/[editionId]/file` (άδεια 15′). Viewer με `license` + `features` (όλα) · σταθερός σύνδεσμος ραφιού → ισχύουσα (`resolveLatestCatalogEdition`) · παλαιότερες εκδόσεις ορατές · Θ3: `noindex` για τα PDF· οι σελίδες ακολουθούν το Ε2. ⚠️ `useNotifications` **πετά** έξω από `(app)`/`(me)` — στη βιτρίνα σφάλματα μέσα στο component.
3. **«Κατάλογοι» στη σελίδα προμηθευτή του αγοραστή** — `GET /api/catalog/suppliers/[id]/editions[/[editionId]/file]` (`id` = σχέση, `pricingView`).
- Ο `issue` της άδειας ζει **στον καλούντα** (ο viewer δεν μαντεύει). Ένας κοινός πελάτης άδειας για τις δύο πόρτες, όχι δύο αντίγραφα.
- i18n σε el **και** en· μετά `npm run generate:i18n-types` **και, ΑΦΟΥ σταδιοποιήσεις**, `npm run generate:i18n-shell-slice:index` (διαβάζει από το index — αλλιώς μπλοκάρει το CHECK 3.34).
- ADR-923 §5.15 γραμμή Θ.3 + changelog **στο ίδιο commit**.
- ⚠️ **Πριν από ζωντανή δοκιμή**: `firebase deploy --only firestore:rules,firestore:indexes` (CHECK 3.86 — το push πάει στο Netcup, όχι στο Firebase) — **μόνο με ρητή έγκριση Giorgio** (γράψιμο στην παραγωγή).
- Κριτήριο εξόδου Φάσης 9 (§9): ανώνυμος ανοίγει στη βιτρίνα τη σελ. 85 χωρίς λήψη όλου του αρχείου · αγοραστής ομάδας Χ βλέπει μόνο την έκδοση της Χ · αποσυρμένη ≡ ανύπαρκτη.

## 4. Μαθήματα της συνεδρίας
- **CHECK 3.7** μπλοκάρει κάθε χειρόγραφο `Set<Listener>` σε νέο αρχείο ⇒ pub/sub **μόνο** με `src/lib/state/createExternalStore.ts` (σήμα έκδοσης + `useSyncExternalStore`).
- **CHECK 3.34**: ο γεννήτορας `:index` διαβάζει το **index** — τρέξ' τον **μετά** το `git add`, σταδιοποίησε μόνο τα αρχεία του `src/i18n/generated/` που άλλαξαν.
- **Python σε Windows γράφει CRLF** σε text mode ⇒ `open(..., newline='')` ή μετατροπή σε LF πριν το `git add` (το αποθετήριο είναι LF).
- Το έξοδο του hook κόβεται με `tail` ⇒ γράψε το σε αρχείο του scratchpad και ψάξε `FAIL|ΜΠΛΟΚ|❌`. Το Bash αρνείται σύνθετες εντολές με `git` μέσα σε βρόχους/`$VAR` — απλές, χωριστές εντολές.
- Το store μικρογραφιών χρειάστηκε **ταυτότητα εκτέλεσης** ανά κλειδί: ακυρωμένη απόδοση που τελειώνει αργά δεν πρέπει να σβήσει τη νεότερη.

## 5. Προτάσεις εκτός εντολής (ΔΕΝ γίνονται χωρίς «ναι» Giorgio)
- Θ.2β: μικρογραφίες-σπράιτ από τον διακομιστή στη δημοσίευση (Publitas/Issuu) ⇒ η λίστα κοστίζει ένα αίτημα.
- Οι επισημάνσεις του `PdfHighlights` δεν ακολουθούν τη στροφή.
- 5 client loaders του pdf.js με σκληρό `'/pdf.worker.min.mjs'` ⇒ ένας loader.
- `ImportBatchWorkspace` περνά `url=""` ⇒ «Πλήρης οθόνη» ανοίγει κενή καρτέλα.
- Η εισαγωγή θα μπορούσε να ενεργοποιήσει `features.sidebar` (434 σελίδες χωρίς περιεχόμενα/μικρογραφίες).

## 6. ΜΗΝ
- ΜΗΝ commit στο `main` · `wt:land`/push μόνο με εντολή · ΜΗΝ tsc (N.17) · ΜΗΝ tests χωρίς έγκριση
- ΜΗΝ δεύτερος προβολέας PDF · ΜΗΝ δεύτερο `getDocument` · ΜΗΝ δημόσιος μόνιμος σύνδεσμος GCS / `attachment` · ΜΗΝ μέτρηση λήψης στην προβολή
- ΜΗΝ έκδοση με τιμές (Θ4) · ΜΗΝ γράψιμο στην παραγωγή (και `firebase deploy`) χωρίς ρητή έγκριση ανά βήμα
