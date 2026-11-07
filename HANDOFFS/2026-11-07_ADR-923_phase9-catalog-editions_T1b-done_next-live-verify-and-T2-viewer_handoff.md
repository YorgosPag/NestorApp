# HANDOFF — ADR-923 §5.15 Φάση 9 · Θ.1β ✅ (pushed) → ζωντανή επαλήθευση + Θ.2 προβολέας

**Ημερομηνία:** 2026-11-07
**Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **κλαδί:** `agent/catalog-editions`
**Κατάσταση git:** Θ.1β = `8ce13693` στο `main`, **push έγινε** (`404a62ea..5cf4c4a4`, μαζί με 3 commits ADR-929 άλλων agents).
**Firebase:** `firebase deploy --only firestore:rules,firestore:indexes --project pagonis-87766` **έγινε** (εντολή Giorgio), από δέντρο = `main` `8ce13693`. Οι 3 δείκτες του `catalog_editions` υπάρχουν στην παραγωγή· το αν έχουν τελειώσει το χτίσιμο **δεν** ελέγχθηκε.
**ADR:** `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md` **§5.15 + §5.15.1** (διάβασέ τα ΟΛΑ πρώτα).

## 1. Τι υπάρχει (Θ.1α + Θ.1β)
- Καθαρός κριτής: `src/subapps/catalog/publishing/catalog-edition-policy.ts` (`publishabilityOf(run, now)` με Θ4 + `disposalDue` · `supersededBy` · `restoredOnWithdrawal` · `latestVisibleEdition` · `editionVisibleTo` · `catalogEditionViewOf`) · `publication-retention.ts` (`publicationHeldByPlatform` = ο ΕΝΑΣ κριτής κράτησης GCS).
- Διακομιστής `src/server/catalog/editions/`: `catalog-edition-store.server.ts` (μόνος κάτοχος της συλλογής) · `…-writer.server.ts` (δημοσίευση/αντικατάσταση/απόσυρση, μία συναλλαγή με τον μετρητή `publishedEditions` μέσω `stagePublicationRunChange`) · `…-reads.server.ts` (θεατής μέσα στη συναλλαγή, πύλη βιτρίνας, υπογεγραμμένη άδεια 15′ inline).
- Διαδρομές: `GET/POST /api/catalog/editions` · `POST /api/catalog/editions/[id]/withdraw` · `GET /api/catalog/suppliers/[id]/editions[/[editionId]/file]` (αγοραστής, `id` = σχέση `srel_…`) · `GET /api/supplier-catalogs/[supplier]/editions/[editionId]/file` (ανώνυμος· `supplier` = ψευδώνυμο ή `comp_…`).
- Jest (με έγκριση): 5 αρχεία 90/90 + μετάλλαξη 3 κόκκινα. Σουίτα κανόνων `catalog-editions.rules.test.ts` **δεν** έτρεξε (emulator/CI).

## 2. Πρώτη κίνηση: ζωντανή επαλήθευση (μόνο αφού έρθει «Deploy completato … live 5cf4c4a»)
⚠️ Γράφει στην παραγωγή ⇒ **ρώτα τον Giorgio πριν από κάθε βήμα που γράφει**. Δεν υπάρχει ακόμη UI (Θ.3), άρα από τον φυλλομετρητή του Giorgio, συνδεδεμένος στο `/o/comp_9c7c1a50…`, με `fetch` στην κονσόλα (ίδια προέλευση, cookie συνεδρίας):
1. `GET /api/catalog/publications` → βρες έκδοση `ready`, `priced: false`, με artifact `screen` (αν δεν υπάρχει: συνταγή χωρίς τιμές με προφίλ «Οθόνη» → «Έκδοση»).
2. `POST /api/catalog/editions` `{ runId, audience: { kind: 'anonymous' } }` (+ κεφαλίδα `Idempotency-Key`, CHECK 3.92) → `editionId`.
3. Ανώνυμα (curl, χωρίς cookie): `GET /api/supplier-catalogs/comp_9c7c1a50…/editions/<editionId>/file` ⇒ **200** `{ url, expiresAt }`, `Cache-Control: no-store`, `X-Robots-Tag: noindex`· το `url` ανοίγει PDF στον φυλλομετρητή.
4. Δεύτερο ίδιο POST ⇒ **ίδιο** `editionId` (ιδεμποτία).
5. `POST /api/catalog/editions/<editionId>/withdraw` `{}` ⇒ το βήμα 3 δίνει **404**.
6. Firebase Console: `catalog_publication_runs/<runId>.retention.publishedEditions` 1 → 0· `entity_audit_trail` γραμμές `catalog_edition`.
Αν ο δείκτης δεν είναι έτοιμος ⇒ `FAILED_PRECONDITION` (5xx) — περίμενε, όχι bug.

## 3. Μετά: Θ.2 — επέκταση του ΕΝΟΣ `PdfCanvasViewer` (Plan Mode, ΠΡΩΤΑ SSoT audit με grep)
Η5: κείμενο + αναζήτηση (text layer), περιεχόμενα από σελιδοδείκτες (`getOutline`), μικρογραφίες, ενεργοί σύνδεσμοι (annotation layer), `#page=N`, λήψη. **Κανένας δεύτερος προβολέας.**
Μετρημένα κενά (§5.15.1):
- Ο viewer φέρνει **όλα** τα bytes (`getDocument({ data })`, `src/components/file-manager/PdfCanvasViewer.tsx:132`, `pdf-fetch-target.ts`) ⇒ για 835 σελίδες χρειάζεται `getDocument({ url, rangeChunkSize })` στην παράδοση `direct`.
- `infrastructure/firebase-storage/cors.json` δεν εκθέτει `Accept-Ranges` (ούτε `Content-Encoding`) ⇒ το pdf.js δεν θα κάνει range requests από άλλη προέλευση. Η εφαρμογή του CORS στον κάδο (`gsutil cors set`) είναι **εξωτερική πράξη ⇒ εντολή Giorgio**. pdfjs-dist 4.5.136.
- Ανεπαλήθευτο: αν το Typst γράφει σελιδοδείκτες· αν τα PDF είναι γραμμικοποιημένα (μέτρησε με αληθινό αρχείο).
Έπειτα: Θ.3 οθόνες («Δημοσίευση σε…» · `/suppliers/<ψευδώνυμο>/catalogs` με `readPublicCatalogEditions` ISR · «Κατάλογοι» στη σελίδα προμηθευτή του αγοραστή) · Θ.4 χάρτης σελίδων + QR προς `resolveLatestCatalogEdition` · Θ.5 δικό του PDF.

## 4. ΜΗΝ
- ΜΗΝ commit στο `main` · `wt:land` / push **μόνο με εντολή Giorgio** · ΜΗΝ tsc (N.17) · ΜΗΝ tests χωρίς έγκριση
- ΜΗΝ δεύτερος προβολέας PDF · ΜΗΝ δημόσιος μόνιμος σύνδεσμος GCS / `attachment` · ΜΗΝ μέτρηση λήψης στην προβολή
- ΜΗΝ έκδοση με τιμές (Θ4) · ΜΗΝ γράψιμο στην παραγωγή χωρίς έγκριση
