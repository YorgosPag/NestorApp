# HANDOFF — ADR-923 §5.15 Φάση 9 «Δημοσιευμένες εκδόσεις καταλόγου» · Θ.1α ✅ → επόμενο Θ.1β (διακομιστής)

**Ημερομηνία:** 2026-11-07
**Worktree:** `C:\Nestor_Worktrees\catalog-editions` · **κλαδί:** `agent/catalog-editions`
**Commits:** `18c9e4ce` (Θ.1α) + το commit αυτού του handoff. Εντάχθηκαν στο `main` και έγινε push με εντολή Giorgio (2026-11-07).
**ADR:** `docs/centralized-systems/reference/adrs/ADR-923-supplier-product-catalog-pim.md` **§5.15** (διάβασέ το ΟΛΟ πρώτα: έλεγχος ADR↔κώδικα, Θ1–Θ4, Η1–Η6, βήματα).

## 1. Ο στόχος (Giorgio)
Ο κατάλογος που φτιάχνει ο προμηθευτής (εκδότης Typst, προφίλ `screen`) να **προβάλλεται σαν PDF** μέσα στην εφαρμογή:
στη δημόσια βιτρίνα (ανώνυμο κοινό) και στον αγοραστή (ομάδα πελατών), όπως το έντυπο της Aries. Ποιότητα «μεγάλων παικτών»,
full enterprise + full SSoT, χωρίς εκπτώσεις. Αν κάτι είναι αβέβαιο → έρευνα στο διαδίκτυο.

## 2. Αποφάσεις Giorgio (κλειδωμένες)
- **Θ1** δημοσίευση και **δικού του PDF** (υλοποιείται στη Θ.5) · **Θ2** μόνο PDF, όχι Word (LibreOffice = MPL-2.0, εκτός N.5)
- **Θ3** τα PDF **δεν** ευρετηριάζονται · **Θ4** πρώτα εκδόσεις **χωρίς τιμές**· με τιμές μόνο μετά από ανεξάρτητη ανασκόπηση ασφαλείας

## 3. Τι έγινε (Θ.1α — καθαρός πυρήνας)
- `src/subapps/catalog/types/catalog-edition.ts` — οντότητα· `CatalogEditionAudience = Extract<PriceAudience, …>` δεμένο στη ρίζα `AudienceKind` (CHECK 3.73)· `CatalogEditionView` κλειστό σχήμα θεατή
- `src/subapps/catalog/publishing/catalog-edition-policy.ts` — ο ΕΝΑΣ κριτής: `publishabilityOf` (ready · όχι disposed · **όχι priced (Θ4)** · μόνο `screen`), `supersededBy` (ίδιο ράφι+κοινό), `editionVisibleTo(edition, PricingViewer)`, `catalogEditionViewOf` (το «αντικαταστάθηκε από» σιωπά αν ο διάδοχος δεν φαίνεται), `isCatalogEditionAudience`, `editionAudienceKey` (= `audienceIdentity` των τιμών, ΟΧΙ δεύτερη σειριοποίηση)
- `src/subapps/catalog/schema/zod/catalog-edition.schema.ts` — `publishCatalogEditionBodySchema { runId, audience }` (στενεμένο `priceAudienceSchema`), `withdrawCatalogEditionBodySchema`
- `PublicationRetention.publishedEditions: number` (`types/publication.ts`, `EMPTY_PUBLICATION_RETENTION`)· `isPublished` στο `publication-retention.ts` → κανένα ρολόι στο `publicationDispositionDueAt`, όχι διαγραφή στο `canDeletePublicationByHand`. Locale `catalog.audit.values.retentionParts.publishedEditions` el+en· `src/types/i18n.ts` ξαναπαράχθηκε.
- Άγκυρες: `publishing/__tests__/catalog-edition-policy.test.ts` (νέο) + 2 περιπτώσεις στο `publication-retention.test.ts`. ⚠️ **ΔΕΝ έτρεξαν** (κανόνας Giorgio: κανένα test χωρίς έγκριση). Πρώτη κίνηση: **ζήτα έγκριση** για
  `npx jest src/subapps/catalog/publishing/__tests__/catalog-edition-policy.test.ts src/subapps/catalog/publishing/__tests__/publication-retention.test.ts`

## 4. Επόμενο: Θ.1β — διακομιστής (~12 αρχεία, Plan Mode)
**ΠΡΙΝ από κώδικα: πραγματικό SSoT audit με grep** για ό,τι υπάρχει ήδη (εντολή Giorgio). Χαρτογραφημένα σημεία:

| Ανάγκη | Υπάρχον SSoT (επαλήθευσε) |
|---|---|
| Συλλογή | `src/config/firestore-collections.ts` (~1120, δίπλα στο `CATALOG_PUBLICATION_RUNS`) · `firestore.rules` ~6460 deny-all |
| Id | `src/services/enterprise-id-prefixes-catalog.ts` (`CATALOG_PUBLICATION_RUN: 'cpubx'`) + `enterprise-id-catalog-generators.ts` (μοναδικότητα: `enterprise-id-prefix-uniqueness.test.ts`) |
| Ιστορικό | `recordTrackedEntityWrite` (`src/services/entity-audit-tracked-write.ts:84`) όπως το `recordRunChange` στο `publication-run.server.ts` · `audit-entity-registry.ts:279` · `audit-tracked-fields-catalog.ts:151` + switch `audit-tracked-fields.ts:~1834` |
| Αλλαγή έκδοσης | `changePublicationRun` (`publication-run.server.ts:127`, ο ένας γραφέας) + `retentionPatch` (ίδια συναλλαγή με το `publishedEditions`) |
| Κράτηση GCS | `setArtifactHolds` (`publication-retention.server.ts:54`, **όχι exported**) |
| 🐞 Κενό | `releasePublicationLegalHold` (~106) λύνει την κράτηση όταν `downloadCount===0` χωρίς να ρωτά αν είναι δημοσιευμένη → να ρωτά και `isPublished` |
| Θεατής αγοραστή | `viewerOfRelationship` (`server/catalog/pricing-viewer.server.ts:49`) · μοτίβο `showcaseViewerOf` στο `server/catalog/public/public-price-reader.server.ts:52` (`runForeignCatalogRead`, `readActiveSupplyRelationshipInTx`) |
| Πύλη βιτρίνας | `readPublicSupplier` / `requirePublicSupplier` (`services/public-catalog/public-catalog.reader.ts`, `public-supplier-route.ts`)· tags `server/catalog/public/public-catalog-cache-tag.ts` |
| Υπογεγραμμένη άδεια | `signedDownloadUrl` (`src/lib/storage/signed-download-url.ts`, 15′ default, **μόνο ΜΕΤΑ την κρίση**) · `publicationBucket()` |
| Διαδρομές | `api/catalog/_shared/catalog-route.ts` (μόνο εσωτερικοί χρήστες· για ανώνυμο/αγοραστή `defineRoute` απευθείας, προηγούμενο: `api/catalog/showcase-prices`, `(light)/q/[id]/route.ts`) |
| Πύλες | CHECK 3.112 (`.public-catalog-authority.json`) αν προστεθεί φρουρούμενη συλλογή/σύμβολο · 3.78 (rate tier) · 3.90 · 3.10/3.35 (companyId σε queries) |

**Παγίδες:** (α) το `recordPublicationDownload` είναι μόνο για τον ιδιοκτήτη — η προβολή από κοινό **δεν** μετρά λήψη (θα ξεκινούσε ρολόι τεκμηρίου). (β) Run ids ντετερμινιστικά από `inputHash`· disposed run δεν ξαναχρησιμοποιείται (`isPublicationRunReusable`). (γ) Το `audienceKey` της έκδοσης εκδότη είναι `none` για χωρίς τιμές — το κοινό του εντύπου είναι **ξεχωριστή** επιλογή.

## 5. Μετά: Θ.2 προβολέας (`PdfCanvasViewer`: κείμενο+αναζήτηση, περιεχόμενα, μικρογραφίες, σύνδεσμοι, `#page=N`) · Θ.3 οθόνες · Θ.4 χάρτης σελίδων · Θ.5 δικό του PDF + qpdf αν χρειαστεί.

## 6. ΜΗΝ
- ΜΗΝ commit στο `main` · `wt:land` / push **μόνο με εντολή Giorgio** · ΜΗΝ tsc (N.17) · ΜΗΝ tests χωρίς έγκριση
- ΜΗΝ δεύτερος προβολέας PDF · ΜΗΝ δεύτερο σχήμα κοινού · ΜΗΝ δημόσιος μόνιμος σύνδεσμος GCS / `attachment`
- ΜΗΝ δημοσίευση έκδοσης με τιμές (Θ4)
