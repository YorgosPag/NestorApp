# HANDOFF — ADR-923 §5.15 Φάση 9 · Θ.1β ✅ ζωντανά επαληθευμένο · Θ.2α-1 ✅ (κλαδί) → επόμενο Θ.2α-2

**Ημερομηνία:** 2026-11-08
**Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **κλαδί:** `agent/catalog-editions` (η νέα συνεδρία συνεχίζει **στο ίδιο** worktree)
**git:** Θ.2α-1 = `9cd55c18` στο κλαδί (+ το commit αυτού του handoff). **ΟΧΙ** στο `main`, **ΟΧΙ** push. `wt:land` / push **μόνο με εντολή Giorgio**.
**ADR:** `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md` — διάβασε **§5.15, §5.15.1, §5.15.2** ολόκληρες.
**Σχέδιο Θ.2 (εγκεκριμένο από Giorgio):** `C:\Users\user\.claude\plans\crystalline-zooming-charm.md` — περιέχεται συνοπτικά και στο §5.15.2.

## 1. Ζωντανή επαλήθευση Θ.1β — ✅ ΟΛΑ ΠΕΡΑΣΑΝ (2026-11-07, nestorconstruct.gr, live `5cf4c4a`)
| Βήμα | Αποτέλεσμα |
|---|---|
| `GET /api/catalog/publications` | 200 · 5 υποψήφιες `ready`/`priced:false`/`screen` (οι 2 `priced:true` εκτός, Θ4) |
| `POST /api/catalog/editions` (`cpubx_52355e97…`, anonymous) | 201 · `cedx_0783e1b3-09b5-4af5-9254-b9638fe8aeed` |
| Ιδεμποτία writer (2ο POST με **άλλο** `Idempotency-Key`) | 201, **ίδιο** editionId, ένα μόνο στο ράφι |
| Ανώνυμο `GET /api/supplier-catalogs/comp_9c7c1a50-f370-466d-bdf7-aa7b2b2d7757/editions/<id>/file` | 200 `{url, expiresAt}` · `no-store` · `X-Robots-Tag: noindex, nofollow` · 15,0′ |
| `withdraw` | 200 · ανώνυμη πόρτα ⇒ **404** · ιδιοκτήτης ⇒ `withdrawn` · 2ο withdraw 200 (ιδεμπότητο) |
| `publishedEditions` | 0 · `dispositionDueAt` null |
| `GET /api/audit-trail/catalog_edition/<id>` | 2 γραμμές: created (`published`, anonymous) · updated (`published→withdrawn`, `endedAt`) |
Η έκδοση `cedx_0783e1b3…` είναι πλέον **αποσυρμένη** στην παραγωγή (σκόπιμα, βήμα 5).
**Ανεπαλήθευτο:** άρση κράτησης GCS (μόνο από GCS Console· το Firestore MCP δεν συνδεόταν).

## 2. Μετρήσεις στο αληθινό αρχείο (screen.pdf, 549.623 B, 3 σελ.)
- Κάδος: `Range` ⇒ **206** (αρχή και τέλος). `Content-Range` **αναγνώσιμο** στον browser· `Accept-Ranges` **null** (δεν είναι στα Expose-Headers) ⇒ το εγγενές range του pdf.js θα κατέβαζε όλο το αρχείο ⇒ **επιβεβαιώνει** το δικό μας transport. Ανανέωση άδειας ⇒ νέο URL που δουλεύει.
- Typst PDF: **ΟΧΙ γραμμικοποιημένο** · **έχει σελιδοδείκτες** (`/Outlines`, 2 εγγραφές, π.χ. «Fan coil» + ελληνική) · 1 εσωτερικό `/Link` (όχι URI) · tagged (`/StructTreeRoot`, `/Lang`).
- ⚠️ Ο εξυπηρετητής μπροστά από την εφαρμογή δίνει **403 σε κάθε `curl`** με προεπιλεγμένο User-Agent (και στην αρχική)· με UA φυλλομετρητή περνά. Για curl χρησιμοποίησε `-A "Mozilla/5.0 …"`. Όχι bug κώδικα — πρόταση μίας γραμμής στον Giorgio αν αφορά bots/έλεγχο.
- Σήμερα το PDF φαίνεται στην εφαρμογή **μόνο** ως «Λήψη · Οθόνη» (attachment) στο `/o/<comp>/catalog/publications?recipe=…`. Προβολή μέσα στην εφαρμογή = Θ.2 + Θ.3.

## 3. Τι έγινε στο Θ.2α-1 (`9cd55c18`)
- `src/components/file-manager/pdf-range-transport.ts` — υποκλάση `PDFDataRangeTransport` της **ίδιας** βιβλιοθήκης (`instanceof`), `PdfLicenseLease` (ανανέωση 60″ πριν τη λήξη, single-flight, 403 ⇒ 1 ανανέωση + 1 επανάληψη), 206 υποχρεωτικό, `onFailure` (το pdf.js δεν έχει δρόμο σφάλματος κομματιού), 256KB + `disableAutoFetch` + `disableStream`.
- `usePdfDocument.ts` — ο ένας κάτοχος της φόρτωσης· επαναφόρτωση μόνο σε αλλαγή ταυτότητας αρχείου.
- `pdf-canvas-config.ts` — `PdfDocumentSource` (`file` | `licensed`), αμοιβαία αποκλειόμενα props, `pdfDocumentSourceOf`, `PdfjsLib` με range options.
- `PdfCanvasViewer.tsx` — χρησιμοποιεί το hook· «Πλήρης οθόνη» κρυφή για `licensed`.
- Άγκυρα `__tests__/pdf-range-transport.test.ts` — **γραμμένη, ΔΕΝ έτρεξε** (θέλει έγκριση Giorgio).
- Μάθημα hook: CHECK 10 (secret scan) μπλοκάρει σταθερές με όνομα `SECRET = '…'` σε tests ⇒ ονόματα fixture χωρίς «secret».

## 4. Επόμενο: Θ.2α-2 (μετά Θ.2α-3, Θ.2β + Θ.2α-4) — βλ. πίνακα §5.15.2
**ΠΡΩΤΑ πραγματικό SSoT audit με grep**, μετά Plan Mode:
- **Text layer** (`PdfTextLayer.tsx`): pdf.js `TextLayer` (υπάρχει στο 4.5.136) πάνω από το canvas, ακολουθεί ζουμ/στροφή του `usePdfViewport`. CSS `.textLayer`: ελάχιστοι κανόνες μέσα από το design system — έλεγξε CHECK 3.43 (css token authority) και N.3 (όχι inline styles στο JSX) πριν.
- **Link layer** (`PdfLinkLayer.tsx`): `getAnnotations()` → Link· εξωτερικά μόνο http/https/mailto με `rel="noopener noreferrer nofollow"`· εσωτερικά `getDestination`/`getPageIndex` ⇒ σελίδα. Τεχνική του `PdfHighlights.tsx` (κλάσματα σελίδας).
- **`#page=N`** (`usePdfPageHash.ts`): ανάγνωση στο άνοιγμα, `history.replaceState` στην αλλαγή.
- **Λήψη**: `doc.getData()` → Blob (grep για υπάρχον SSoT λήψης blob πρώτα). Ποτέ άδεια `attachment` (Η4).
- **`features` prop**: ρητή ενεργοποίηση ανά καλούντα· προεπιλογή = σημερινή συμπεριφορά (file manager / εισαγωγή αμετάβλητα).
- i18n: νέα κλειδιά `files.pdf.*` σε `el` **και** `en`.
- `PdfCanvasViewer.tsx` < 500 γρ., συναρτήσεις ≤ 40 γρ.
- ADR-923 §5.15.2: ενημέρωση γραμμής βήματος + changelog στο ίδιο commit.
Θ.2β (ευρετήριο κειμένου στον διακομιστή στη δημοσίευση, server loader του `src/services/pdf/`, ίδια πόρτα κρίσης) **αγγίζει τον writer του Θ.1β** — ξεχωριστό βήμα.

## 5. Προτάσεις εκτός εντολής (ΔΕΝ γίνονται χωρίς «ναι» Giorgio)
- 5 client loaders του pdf.js με σκληρό `'/pdf.worker.min.mjs'` (`pdf-canvas-config`, `usePdfThumbnail`, `generate-upload-thumbnail`, `thumbnail-generator`, dxf `PdfRenderer`) ⇒ ένας loader.
- `ImportBatchWorkspace` περνά `url=""` ⇒ η «Πλήρης οθόνη» ανοίγει κενή καρτέλα.
- Το ιστορικό γράφει το `audience` ως JSON με αλλαγές γραμμής (κοσμητικό).
- Καταγραφή των αποτελεσμάτων §1–§2 στο ADR-923 §5.15.1/§5.15.2 (ζητά εντολή).

## 6. ΜΗΝ
- ΜΗΝ commit στο `main` · `wt:land`/push μόνο με εντολή · ΜΗΝ tsc (N.17) · ΜΗΝ tests χωρίς έγκριση
- ΜΗΝ δεύτερος προβολέας PDF · ΜΗΝ δημόσιος μόνιμος σύνδεσμος GCS / `attachment` · ΜΗΝ μέτρηση λήψης στην προβολή
- ΜΗΝ έκδοση με τιμές (Θ4) · ΜΗΝ γράψιμο στην παραγωγή χωρίς ρητή έγκριση ανά βήμα
