# ADR-923 · Κύμα 4 · Handoff #3 (2026-11-06) — K4(γ) → Λ7

Αντικαθιστά το `HANDOFFS/2026-11-06_ADR-923_wave4_L3-L7_handoff.md` (τα «Μαθήματα» εκείνου ισχύουν).

- **Worktree:** `C:\Nestor_Worktrees\adr-923-wave4` · **Κλαδί:** `agent/adr-923-wave4`. Συνέχεια **στο ίδιο worktree**.
- Στο `main` **δεν** γίνεται commit. Commit στο κλαδί με ρητή λίστα αρχείων, πλήρες hook (~10′, στο παρασκήνιο).
- `wt:land`, push, Firebase: **μόνο** με ρητή εντολή Giorgio. **Κανένα test χωρίς έγκρισή του** (N.(-2)).
- **Οδηγία Giorgio:** ποιότητα Revit / ArchiCAD / Figma / Zillow / Idealista, χωρίς εκπτώσεις· όπου δεν είσαι σίγουρος, **έρευνα** και η πρακτική των μεγάλων (ή καλύτερη). Μην του δίνεις επιλογές «απλό vs σωστό» — ερεύνα και πρότεινε το σωστό.

## Έγινε σε αυτή τη συνεδρία (στο κλαδί, κανένα στο main)
| Commit | Τι |
|---|---|
| — | Βήμα 1: τα 6 tests του handoff #2 έτρεξαν, 622/622 πράσινα |
| `2b9685f2` | K3 ως κλάση: σελίδες-ρίζες `construction`/`dxf`/`listings`/`parking`/`storage` (σταθερές διαδρομών, το μενού διαβάζει τις ίδιες) · νεκρός `geo/` σβήστηκε · άγκυρα Ε5–Ε7 στο `company-switcher-target.test.ts` (μετάλλαξη ⇒ 1 κόκκινο) |
| (K4β, βλ. `git log`) | NA/UN της εισαγωγής xChange ⇒ στόχος `noValueReason` · `mergeFieldsIntoHolder` (ένας δρόμος κριτή + έγκρισης, σημασιολογία `holder-edit`) · `reasonFieldOf` (NA πάνω σε τιμή ⇒ conflict· UN πάνω σε τιμή ⇒ η τιμή μένει) · `cellPathOf` στον κριτή · `NO_VALUE_REASON_KEYS` στο `catalog-labels`. 133/133, μεταλλάξεις 3/3 κόκκινες |

## Επόμενο: K4(γ) — εισαγωγή `Pricing` από xChange (θέλει Plan Mode, ~8 αρχεία)
**Έρευνα ΕΓΙΝΕ** — επίσημη οδηγία ETIM xChange V2.0 (2025-11-27). Το PDF εξάγεται με `pdftotext -layout` (υπάρχει στο `/mingw64/bin`)· URL: https://etim.org.pl/wp-content/uploads/2026/05/ETIM-xChange_Guideline_V2.0-2025-11-27.pdf. Ευρήματα (γραμμένα και στο changelog του ADR, 2026-11-06 «K4(β)»):
- `TradeItem.Pricing` = **πίνακας**· οι εγγραφές ξεχωρίζουν με **περίοδο ισχύος** (`PriceValidityDate` EX000211 / `PriceExpiryDate` EX000212), **όχι** κλιμάκιο ποσότητας. Κλιμάκια = `AllowanceSurcharge` (`AllowanceSurchargeMinimumQuantity` EX000220).
- `PriceUnit` (EX000203, υποχρεωτικό, UNECE) · `PriceUnitFactor` (EX000204, PriceUnit ↔ OrderUnit) · `PriceQuantity` (EX000205, υποχρεωτικό) · `PriceOnRequest` (EX000206) · `GrossListPrice` (EX000207, γενική τιμή χωρίς ΦΠΑ) · `NetPrice` (EX000208, τιμή πελάτη χωρίς ΦΠΑ) · `CurrencyCode` (EX000219, ISO 4217, **προαιρετικό**, επίπεδο 1).

**Προτεινόμενο σχέδιο (να το επιβεβαιώσεις με grep πριν από κώδικα):**
1. Ο σκοπός `priceLines` δέχεται πηγή `etimXchange` (σήμερα `buildXChangeProposals` πετά `NOT_XCHANGE` αν ο σκοπός δεν είναι `attributes`). Η έκδοση-στόχος ήδη δίνεται από την παρτίδα.
2. Ποσό = από τον **τύπο της λίστας** (αντίστροφο του Ζ13 §5.14.1): `net_list` ⇒ `GrossListPrice`· `net_customer` ⇒ `NetPrice`. Λείπει το σωστό ⇒ η γραμμή δεν μπαίνει, μετριέται.
3. Πολλές εγγραφές ⇒ αυτή που **καλύπτει την έναρξη ισχύος της έκδοσης-στόχου**· καμία ή >1 ⇒ εύρημα (απόφαση ανθρώπου). `AllowanceSurcharge` ⇒ μετριέται στην αναφορά (δεν το μοντελοποιεί η γραμμή).
4. `PriceOnRequest` ⇒ καμία γραμμή, μετρημένο. `CurrencyCode` διαφορετικό από της λίστας ⇒ άρνηση· απόν ⇒ η νόμισμα της λίστας, δηλωμένο στην αναφορά.
5. Μονάδα: `resolveUom` (`src/lib/uom/uom-registry.ts`) δέχεται ήδη UNECE· για συσκευασίες (`C62`/`BG`/`BX`/`RO`/`PK`) το **αντίστροφο** του `ETIM_UNECE_EQUIVALENTS` (`vocabulary/etim.ts`), **παραγόμενο** από το ίδιο αντικείμενο. Χωρίς αντιστοίχιση ⇒ εύρημα στο πεδίο.
6. Κελιά `price` (`netPrice`/`priceQuantity`/`unitCode`) + `skuIdentifier` ⇒ ο υπάρχων `buildPriceRows` (`import/build-price-proposal.ts`) και η υπάρχουσα έγκριση (`applyPrices`). Κανένας δεύτερος δρόμος.

## Μετά: Λ7 (Ν10, Ν11) — ADR-923 §23.5. Ν7 (ODC-BY): δεν ενεργοποιήθηκε — καμία οθόνη δεν δείχνει ονόματα ETIM.
## ΟΧΙ χωρίς απόφαση Giorgio: Α1, Ν6, Ν8, Ν9β, Ν12 (§23.7).

## Ζωντανός έλεγχος μετά το deploy (προστέθηκαν)
K3 ως κλάση (εναλλαγή εταιρείας σε `/parking/<id>`, `/dxf/viewer`, `/construction/portfolio`, `/listings/mandates/requests`) · K4(β) (εισαγωγή xChange με NA/UN πάνω σε προϊόν με τιμές).

## Μαθήματα αυτής της συνεδρίας
- Ο κανόνας «τιμή και λόγος απουσίας δεν συνυπάρχουν» ζει στο `values/holder-edit.ts`· κάθε γραφέας φορέα τιμών περνά από εκεί (το `writeNoValueReason` δέχεται πλέον `Pick<…,'values'|'noValueReasons'>`).
- Τα δύο πρώτα πράσινα (K3, K4β) δοκιμάστηκαν με μετάλλαξη πριν το commit — κάνε το ίδιο.
- `WebFetch` σε PDF δεν διαβάζει κείμενο· σώζει το αρχείο και `pdftotext` το λύνει.
