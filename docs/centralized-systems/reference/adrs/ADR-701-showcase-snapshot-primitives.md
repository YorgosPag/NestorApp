# ADR-701 — Showcase snapshot primitives + label catalog (`showcase-core`)

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-321 (Showcase Core — **φάντασμα**, βλ. §8.1), ADR-312/316/320 (property/project/building showcase), ADR-315 (Unified Sharing — **φάντασμα**), ADR-294 (SSoT Ratchet), ADR-584 (jscpd / CHECK 3.28), ADR-698 (κύκλος #4), ADR-699 (κύκλος #5 — από όπου προέρχεται το μοτίβο)

**Εκστρατεία SSoT Duplicate Sweep — κύκλος #6.**

---

## 1. Context

### 1.1 Το εύρημα

`npx jscpd src/services src/lib src/app` (2026-07-25, μετά τον κύκλο #5) — κορυφαίο
μη-test clone ολόκληρου του σαρωμένου δέντρου:

```
259t / 34L   services/parking-showcase/snapshot-builder.ts ↔ services/storage-showcase/snapshot-builder.ts
221t         services/parking-showcase/labels.ts           ↔ services/storage-showcase/labels.ts
```

Το `showcase-core/snapshot-builder-factory.ts` (`createShowcaseSnapshotBuilder`) **υπήρχε**
και το καλούσαν **και τα δύο** αρχεία — κι όμως ήταν σχεδόν πανομοιότυπα. Ίδια διάγνωση με
τον #4 και τον #5: **το clone ζούσε μέσα στο config object.**

### 1.2 Τι πραγματικά ήταν διπλό

Το jscpd μέτρησε το ζευγάρι· ο κώδικας έδειξε ότι το εύρος ήταν μεγαλύτερο.

| τι | πόσες κόπιες | πού |
|---|---|---|
| `pickString` + `pickNumber` (null-returning) | **4** verbatim | building · parking · project · storage |
| `formatFloor` (18 γρ. με ωμά ελληνικά) | **2** verbatim | parking · storage |
| related-name loader (`fk → doc.get() → pick name`) | **3** | parking/storage → `buildingName`· building → `projectName` |
| error υποκλάσεις-ψευδώνυμα | 4 | όλες οι επιφάνειες |
| catalog preamble (`typeof elShowcase` + `CATALOGS` + 5 section casts) | **5** | και τα 5 labels αρχεία |
| `translateXxx` (3γραμμο σώμα πάνω από enum map) | **10** | 5 αρχεία |
| spec-label σκάλα (`specs.X ?? fb('…','…')`) | **5** | 11 κοινές γραμμές ανά αρχείο |
| email block (`subjectPrefix`/`introText`/`ctaLabel`) | **4** | building · parking · project · storage |
| pdf chrome block | **2** | building · project |

### 1.3 🔴 Το σοβαρότερο εύρημα — και **δεν** ήταν clone

Το `project-showcase/snapshot-builder.ts` **δεν καλούσε καθόλου** το factory. Ξανάγραφε
χειρόγραφα και τα πέντε βήματα της ενορχήστρωσης (doc fetch → not-found → tenant check →
mapping → branding → wrap) και δήλωνε **δικές του** `ProjectNotFoundError` /
`TenantMismatchError` που **δεν κληρονομούσαν** από τις πυρηνικές — άρα το
`instanceof ShowcaseEntityNotFoundError` ήταν `false` για **ακριβώς μία** από τις πέντε
επιφάνειες.

Ήταν αόρατο **και στα δύο** εργαλεία:

- **CHECK 3.18** (name/regex-based): βλέπει «ποιος εισάγει το SSoT». Το project δεν το
  εισήγαγε καν, άρα δεν υπήρχε καν ως ερώτημα.
- **jscpd** (token-based): το χειρόγραφο χρησιμοποιούσε άλλα ονόματα μεταβλητών
  (`projectSnap` αντί `entitySnap`), άρα **δεν** έβγαινε ως clone.

> **Το βρήκε μόνο `diff` των τεσσάρων αδελφών αρχείων + grep των καταναλωτών.**
> Ένα αρχείο που ξαναγράφει το SSoT με άλλα ονόματα είναι αόρατο στο στατικό tooling.
> Ο κανόνας του ADR-699 §3 («μη συμπεράνεις "κεντρικοποιημένο" επειδή εισάγουν το factory»)
> χρειάζεται συμπλήρωμα: **ούτε "μη-κεντρικοποιημένο" δεν προκύπτει από το ότι δεν εισάγουν.**

---

## 2. Decision

Δύο νέα modules στο `showcase-core`, και τα δύο **data-driven**:

### 2.1 `snapshot-field-primitives.ts`

```ts
pickShowcaseString(v)            → string | null
pickShowcaseNumber(v)            → number | null
pickShowcaseStringOrUndefined(v) → string | undefined
pickShowcaseNumberOrUndefined(v) → number | undefined
formatShowcaseFloorLabel(raw, locale)
buildShowcaseIdentityFields(entityId, raw)   // { id, code, name, description }
buildShowcaseMetricFields(raw, locale)       // { area, price, floor }
createShowcaseRelationLoader({ foreignKeyField, collection, resultKey, nameFields })
```

Ο relation loader είναι το §3-μοτίβο σε καθαρή μορφή: εκεί που το factory ζητούσε **async
closure**, τώρα δέχεται **τέσσερα πεδία δεδομένων**.

### 2.2 `labels-catalog.ts`

```ts
createEnumLabelTranslator(map)                        // αντικαθιστά 10 συναρτήσεις
readShowcaseCatalogSections(namespaceKey, locale)     // αντικαθιστά 5 preambles
getShowcaseCatalog(locale)                            // για το property (βλ. §5.2)
resolveShowcaseSpecLabels(sections, locale, { title, keys })
resolveShowcaseEmailLabels(sections, locale, { subjectPrefix, introText })
resolveShowcaseChromeLabels(sections, locale, { title, footerNote })
resolveShowcaseDescriptionLabels(sections, locale)
resolveShowcaseMediaTitles(sections, locale)
resolveShowcaseHeaderLabels(sections, locale, subtitleFallback)
```

Το `SHOWCASE_SPEC_FALLBACKS` κρατά **μία φορά** τα 23 ζεύγη `[el, en]` που ήταν σκορπισμένα σε
πέντε σκάλες. Κάθε επιφάνεια δηλώνει πλέον **ποιες γραμμές δείχνει**:

```ts
const STORAGE_SPEC_ROWS = ['code','type','status','area','price','floor','building'] as const;
export type StorageShowcaseSpecLabels =
  Record<(typeof STORAGE_SPEC_ROWS)[number] | 'title' | 'areaUnit', string>;
```

Ο τύπος **παράγεται** από τη λίστα — δεν μπορεί να ξεσυγχρονιστεί από αυτήν.

### 2.3 Μετάβαση του `project-showcase` στο factory

Με **ρητό `resolveBranding` override** (βλ. §4.1). Οι κλάσεις σφάλματος έγιναν υποκλάσεις
των πυρηνικών, με byte-identical μηνύματα και `name`.

### 2.4 Προσθήκη `entityId` στο `BrandingResolutionParams`

Το `BrandingResolutionParams` δεν μετέφερε το id της οντότητας. Προστέθηκε — μη-σπαστική,
προσθετική αλλαγή.

---

## 3. Το μοτίβο, τρίτη συνεχόμενη φορά

> **Factory που ζητά κώδικα εκεί που θα μπορούσε να ζητήσει δεδομένα δεν κεντρικοποίησε —
> μετακόμισε το boilerplate ένα επίπεδο κάτω.**

- #4 (ADR-698): 6 routes **578 → 244** γρ.
- #5 (ADR-699): `buildResolvedData` hook → 4 πεδία δεδομένων· 5 resolvers **426 → 119** γρ.
- #6 (εδώ): `loadRelations` closure → 4 πεδία· spec σκάλα → λίστα κλειδιών.

---

## 4. 🔴 Δύο παγίδες που παραλίγο να αλλάξουν παραγωγή

### 4.1 Το branding του project

Το χειρόγραφο έκανε branding από το **δικό του** id:

```ts
propertyData: { projectId }          // ← το id της ίδιας της οντότητας
```

Ο default branding resolver του factory διαβάζει `raw.projectId` — **foreign key** που ένα
project document **δεν φέρει**. Σκέτη μετάβαση στο factory θα έδινε σιωπηλά
`propertyData: {}` → χαμένο branding σε **κάθε PDF έργου**.

→ Λύθηκε με ρητό override + το `entityId` στο `BrandingResolutionParams`. Καρφωμένο με test
που ελέγχει τα ίδια τα ορίσματα της κλήσης.

### 4.2 `null` vs `undefined` — δύο συμβόλαια, ίδιο όνομα

Το `pickString` του **property** επέστρεφε `undefined`· των άλλων τεσσάρων `null`.

```
JSON.stringify({ code: null })       → {"code":null}
JSON.stringify({ code: undefined })  → {}
```

Ενοποίηση θα άλλαζε **κάθε payload** που φέρει το πεδίο. Και οι δύο εκδοχές ζουν πλέον στο
ίδιο αρχείο, με ρητά ονόματα (`…OrUndefined`) και test που καρφώνει **τη διαφορά τους**:

```ts
expect(JSON.stringify({ code: pickShowcaseString(undefined) })).toBe('{"code":null}');
expect(JSON.stringify({ code: pickShowcaseStringOrUndefined(undefined) })).toBe('{}');
```

Αυτό είναι το μάθημα #12 του κύκλου #5 σε νέα μορφή: **πριν κεντρικοποιήσεις, ρώτα τι ΔΕΝ
έγραφε το χειρόγραφο.**

---

## 5. Τι **δεν** ενοποιήθηκε — και γιατί

### 5.1 `intl-domain.formatFloorLabel` (μάθημα #13)

Το `src/lib/intl-domain.ts` έχει **ήδη** formatter ορόφων με τις ίδιες ελληνικές
συμβολοσειρές. Δεν ενοποιήθηκε — και δεν πρέπει, χωρίς απόφαση:

| | `intl-domain.formatFloorLabel` | `formatShowcaseFloorLabel` |
|---|---|---|
| locale | **ambient** (`getCurrentLocale()`, client i18n state) | **ρητή παράμετρος** |
| πλευρά | client | server (`server-only` snapshot builders) |
| EN έξοδος | `3 Floor`, `2 Basement` | `3rd Floor`, `2nd Basement` |

Ίδιο σχήμα με το `canShare` vs `lib/auth/tenant-isolation` του ADR-699 §4: **δύο modules που
απαντούν το ίδιο ερώτημα δεν ενοποιούνται αν ζουν σε διαφορετικές πλευρές του καλωδίου** —
εδώ με τη ρητή προσθήκη ότι **και οι έξοδοί τους διαφέρουν**. Ενοποίηση = αλλαγή είτε του
client UI είτε των PDF. Βλ. §8.2.

### 5.2 Το property δεν χρησιμοποιεί `readShowcaseCatalogSections`

Οι τέσσερις επιφάνειες έχουν namespace (`buildingShowcase`, `parkingShowcase`, …). Το
property προηγείται του namespacing και κρατά τις ενότητές του στη **ρίζα** του catalog
(`specs`, `pdf`, `views`, …). Χρησιμοποιεί το `getShowcaseCatalog(locale)`, ώστε να φύγει η
τελευταία κόπια του preamble χωρίς να επιβληθεί σχήμα που δεν ισχύει.

### 5.3 Οι πίνακες ετικετών (`*_TYPE_LABELS` κ.λπ.)

Μένουν στα αρχεία των επιφανειών: είναι **δεδομένα**, και η επανάληψη δεδομένων δεν είναι
διπλασιασμός. Μόνο ο κώδικας γύρω τους μετακόμισε.

### 5.4 Το `parking` δεν καλεί το `buildShowcaseIdentityFields`

Η ταυτότητά του ξεκινά με `number`, όχι `name`. Χωριστό literal — σκόπιμα.

---

## 6. Consequences

**Θετικά**

- 5 επιφάνειες μοιράζονται ένα SSoT για pickers / floor / relations, ένα για catalog+labels.
- Το project απέκτησε επιτέλους την ενορχήστρωση των αδελφών του· `instanceof` πια συνεπές.
- Νέα spec γραμμή = **μία λέξη** στη λίστα κλειδιών· η διατύπωση υπάρχει ήδη κεντρικά.
- 20 + 15 νέα tests καρφώνουν τα δύο picker συμβόλαια, τη μορφοποίηση ορόφων, τον relation
  loader, το branding του project και την ταυτότητα των σφαλμάτων.

**Αρνητικά / ρίσκα**

- Το `resolveShowcaseSpecLabels` πετά σε άγνωστο κλειδί (fail-fast) — σκόπιμο, αλλά σημαίνει
  ότι νέα spec γραμμή απαιτεί εγγραφή στο `SHOWCASE_SPEC_FALLBACKS`. Το μήνυμα σφάλματος
  λέει ακριβώς πού.
- Η σειρά κλειδιών στα `specs` objects άλλαξε (`areaUnit` πάει τελευταίο παντού). Τα objects
  διαβάζονται **με κλειδί** από τους renderers — καμία θεσιακή εξάρτηση.

---

## 7. Επαλήθευση

```
npx jest src/services/showcase-core/          → 66/66 ✅
npx jest showcase sharing                     → 142/142 ✅ (1 προϋπάρχουσα αποτυχία, §8.3)
npm run jscpd:diff -- <14 αρχεία>             → ✅ καθαρό (2ος γύρος)
npx jscpd src/services/*-showcase src/services/showcase-core
                                              → 3 clones, **και οι 3 προϋπάρχουσες** του #4
```

Οι 3 που απομένουν στο δέντρο είναι ακριβώς οι καταγεγραμμένες του ADR-699 §8.3
(`create-pdf-route ↔ create-public-payload-route` 88t · `create-public-payload ↔
create-public-pdf` 50t · `pdf-renderer-base` self-clone 54t). **Μηδέν** στα αρχεία που
άγγιξε αυτός ο κύκλος.

---

## 8. 🔴 Ανοιχτά — θέλουν απόφαση

### 8.1 ADR-φαντάσματα (κληρονομιά, αμετάβλητο)

`ADR-312`, `ADR-315`, `ADR-320`, `ADR-321` παραπέμπονται από τα headers όλων αυτών των
αρχείων· **δεν υπάρχουν ως αρχεία** (ADR-364: 13 scaffolding αρχεία / 2.338 γρ. σβήστηκαν σε
μαζικό batch). Ο N.0.1 Φάση 1 έγινε **αποκλειστικά από τον κώδικα**. Ανασύνθεση ή ρητή
απόσυρση με redirect στα 698/699/700;

### 8.2 «3nd Basement» + οι δύο formatters ορόφων

Το EN κλαδί γράφει `3nd Basement` για βάθη πέρα από 2 — λάθος τακτικό, κληρονομημένο
verbatim. **Διατηρήθηκε** ώστε το refactor να μείνει output-identical, με σχόλιο στον κώδικα
και test που το καρφώνει ως γνωστό.

Η διόρθωση συνδέεται με το §5.1: αν τα δύο formatters πρόκειται να συγκλίνουν, η ώρα να
αποφασιστεί η **μία** σωστή EN μορφή είναι τότε — όχι σιωπηλά τώρα.

### 8.3 `PropertyShowcaseRenderer.test.ts` σπασμένο στο main

`ReferenceError: Request is not defined` — το suite εισάγει τον renderer, που εισάγει το
`showcase-core/index.ts`, που εισάγει το `create-pdf-route.ts` → `next/server`, σε jest
node environment. **Προϋπάρχον** (ADR-698 §8.1), αμετάβλητο από αυτόν τον κύκλο· η αλυσίδα
import υπήρχε ήδη.

### 8.4 Rate-limit σε 4 ανώνυμα public endpoints (ADR-698 §8.2) — αμετάβλητο

---

## 9. Registry

Δύο νέα modules στο `.ssot-registry.json`:

| module | ssotFile |
|---|---|
| `showcase-snapshot-primitives` | `src/services/showcase-core/snapshot-field-primitives.ts` |
| `showcase-labels-catalog` | `src/services/showcase-core/labels-catalog.ts` |

Σύνολο: **374 modules**.

---

## 10. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-25 | Δημιουργία. Κύκλος #6: `snapshot-field-primitives` + `labels-catalog`· μετάβαση `project-showcase` στο factory· `entityId` στο `BrandingResolutionParams`· 5 labels + 4 snapshot builders μεταφέρθηκαν· 35 νέα tests· 2 registry modules. |
| 2026-07-27 | **Το §5.2 ήταν ισχυρισμός, όχι κατάσταση.** Ο κύκλος #6 διέγραψε το τοπικό `CATALOGS` από το `property-showcase/labels.ts` και πρόσθεσε το `import { getShowcaseCatalog }`, αλλά **ξέχασε το μοναδικό call site** (γρ. 172) → `CATALOGS[locale]` έμεινε να δείχνει σε ανύπαρκτο σύμβολο, με το `getShowcaseCatalog` εισηγμένο-και-αχρησιμοποίητο από πάνω. TS2304 στο καθαρό `main`. Διορθώθηκε: `getShowcaseCatalog(locale)`. Το §5.2 περιγράφει πλέον τον πραγματικό κώδικα. **Μάθημα (N.0.1):** ημιτελής μετανάστευση που αφήνει ορφανό import περνά αόρατη από τα tests — το `loadShowcasePdfLabels` καλύπτεται μόνο από το `PropertyShowcaseRenderer.test.ts`, που είναι κόκκινο για άσχετο λόγο (§8.3) και δεν έφτασε ποτέ στη γραμμή. |
