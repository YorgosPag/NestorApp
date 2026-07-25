# ADR-698 — Public Showcase Token Surface SSoT (`/api/{entity}-showcase/[token]`)

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-312 (Property showcase share), ADR-315 (Unified Sharing), ADR-316 (Project showcase), ADR-320 (Building showcase), ADR-321 (Showcase Core), ADR-294 (SSoT Ratchet), ADR-584 (jscpd Anti-Duplication), ADR-696 / ADR-697 (προηγούμενοι κύκλοι της εκστρατείας)

---

## 1. Context

### 1.1 Το εύρημα — και γιατί είναι διαφορετικό από τους κύκλους #1-#3

Στους προηγούμενους κύκλους το SSoT **έλειπε**. Εδώ **υπήρχε** και **το καλούσαν όλοι**:

```
src/services/showcase-core/  (ADR-321, Απρ 2026)
  ├─ api/create-public-payload-route.ts   170 γρ.  ← το καλούν 5 routes
  ├─ api/create-public-pdf-route.ts       180 γρ.  ← το καλούν 3 routes
  ├─ snapshot-builder-factory.ts                   ← το καλούν 5 builders
  └─ …
```

Κι όμως το jscpd μέτρησε:

```
446t x5   api/building-showcase/[token]/pdf  ↔  api/project-showcase/[token]/pdf
322t x4   api/building-showcase/[token]      ↔  api/project-showcase/[token]
320t x4   api/building-showcase/[token]      ↔  api/parking-showcase/[token]
233t x3   api/building-showcase/[token]      ↔  api/storage-showcase/[token]
 94t x1   api/parking-showcase/[token]       ↔  api/storage-showcase/[token]
```

**446 tokens διπλότυπα ανάμεσα σε δύο αρχεία 85 γραμμών** — το μεγαλύτερο cross-file
cluster σε όλο το `src/` τη στιγμή της μέτρησης. Τα δύο αρχεία διέφεραν σε **έξι tokens**:
`building`↔`project`, `BUILDINGS`↔`PROJECTS`, `building_showcase`↔`project_showcase`,
`Building`↔`Project`, `'building-showcase'`↔`'project-showcase'`.

### 1.2 Η αιτία: **over-parameterised factory**

Τα factories του ADR-321 δέχονται **hooks**, όχι δεδομένα. Και οι πέντε/τέσσερις
υλοποιήσεις των hooks ήταν ο **ίδιος κώδικας με άλλο ουσιαστικό**:

| hook | τι διέφερε |
|---|---|
| `resolveShare` | **μία** συμβολοσειρά `entityType` (20 γρ. query + parse ίδιες) |
| `loadEntityHeader` | **μία** collection |
| `checkTenant` | **τίποτα** — byte-identical |
| `buildFilename` | **ένα** fallback slug (ο sanitizer ίδιος) |
| `incrementCounter` | **τίποτα** — byte-identical |
| `loadXMedia` | **τίποτα** εκτός του ονόματος του return type |
| `buildPayload` | snapshot fn + payload key |
| `GET` export | **τίποτα** — byte-identical |

> **Το pipeline εξήχθη· οι μηχανισμοί σπρώχτηκαν πίσω σε κάθε καλούντα.**
> Ένα factory που ζητά 5 callbacks και τις παίρνει ίδιες 3 φορές δεν έχει
> κεντρικοποιήσει — έχει μετακομίσει το boilerplate ένα επίπεδο κάτω.

Αυτό είναι **νέο μοτίβο** για την εκστρατεία και αξίζει όνομα, γιατί το static tooling
δεν το πιάνει: το `ssot:discover` (CHECK 3.18) βλέπει «όλοι καλούν το SSoT → ✅».
**Μόνο** το token-based jscpd το βλέπει.

### 1.3 Type-level διπλότυπο

Το `{ id, url, displayName?, contentType? }` ήταν δηλωμένο **τέσσερις φορές** —
`BuildingShowcaseMedia`, `ProjectShowcaseMedia`, `ParkingShowcaseMedia`,
`StorageShowcaseMedia` — byte-identical. Και τα τρία από τα τέσσερα type files
**αυτο-δηλώνουν** την παράβαση: *«Mirrors the building showcase type pattern»*
(ίδιο σχήμα με τον κύκλο #1, όπου τρία αρχεία έγραφαν «Mirrors the math used by
`renderDxfToCanvas`»).

### 1.4 SSoT audit ΠΡΙΝ τον κώδικα

| Ψάχτηκε | Βρέθηκε | Απόφαση |
|---|---|---|
| Route shells | ✅ `create-public-{payload,pdf}-route` (ADR-321) | **δεν αγγίχθηκαν** — χτίζω πάνω τους |
| Snapshot factory | ✅ `createShowcaseSnapshotBuilder` | δεν αγγίχθηκε |
| Share resolver | ✅ `share-resolver-factory.ts` | **client-SDK** για το sharing registry — **άλλη ανησυχία**, δεν εφαρμόζει στο Admin-SDK public lookup |
| Shared PDF helpers | ✅ `showcase/shared-pdf-proxy-helpers.ts` | χρησιμοποιείται ήδη μέσα από το factory |
| Κοινός τύπος media | ❌ δεν υπήρχε | **νέος** |
| Admin-SDK share lookup | ❌ δεν υπήρχε | **νέος** |

---

## 2. Decision

### 2.1 Τα τρία κοινά μηχανικά κομμάτια

| Νέο module | Αντικαθιστά |
|---|---|
| `showcase-core/api/public-share-lookup.ts` | το `shares` token query + parse, γραμμένο **6×** |
| `showcase-core/public-media.ts` | το `listEntityMedia → filter → map`, γραμμένο **4×**, + τον ΕΝΑ τύπο `ShowcaseMediaItem` |
| `showcase-core/api/create-token-route-export.ts` | το Next `[token]` `GET` boilerplate, γραμμένο **6×** |

### 2.2 Τα δύο second-order factories

`createUnifiedPublicShowcasePayloadRoute` και `createUnifiedPublicShowcasePdfRoute`
δέχονται **δεδομένα** όπου τα πρώτα δέχονταν **κώδικα**:

```ts
// src/app/api/parking-showcase/[token]/route.ts — ΟΛΟΚΛΗΡΟ
const route = createUnifiedPublicShowcasePayloadRoute<ParkingShowcaseSnapshot, 'parking'>({
  shareEntityType: 'parking_showcase',
  entityKey: 'parking',
  mediaEntityType: ENTITY_TYPES.PARKING_SPOT,
  loggerName: 'ParkingShowcasePublicApi',
  shareNotFoundMessage: 'Parking showcase link not found or deactivated',
  pdfUrlPath: () => null,
  buildSnapshot: buildParkingShowcaseSnapshot,
});

export const GET = createPublicTokenRouteExport(route, 'none');
```

### 2.3 Το payload κάνει **whitelist**, δεν κάνει spread

Η προφανής κεντρικοποίηση είναι `{ ...snapshot, ...media, pdfUrl, expiresAt }`: και τα
τέσσερα snapshots είναι ακριβώς `{ <entityKey>, company }`, άρα αναπαράγει κάθε original
byte-for-byte **σήμερα**.

**Το απέρριψα.** Τα χειρόγραφα routes έγραφαν `building:` / `company:` ρητά — δηλαδή ήταν
**whitelist κλειδιών**. Ένα πεδίο που θα προστεθεί αύριο στο `BuildingShowcaseSnapshot`
δεν μπορούσε να φτάσει σε **ανώνυμη public απόκριση** χωρίς να το γράψει άνθρωπος.
Το spread θα καταργούσε σιωπηλά αυτή την ιδιότητα.

```ts
// unified-showcase-payload.ts — αντιγράφει ΜΟΝΟ δύο κλειδιά
return {
  [entityKey]: snapshot[entityKey],
  company: snapshot.company,
  photos: media.photos,
  floorplans: media.floorplans,
  pdfUrl: share.pdfUrl,
  expiresAt: share.expiresAt,
};
```

**Η κεντρικοποίηση δεν επιτρέπεται να κοστίσει άμυνα.** Το test
`'DOES NOT LEAK an extra snapshot field into the anonymous response'` το κλειδώνει.

### 2.4 Το share lookup διορθώνει δύο πράγματα

**(α) Query shape — index safety.** Υπήρχαν **δύο** σχήματα:

| οικογένεια | query |
|---|---|
| payload | `token ==` + `isActive ==`, μετά έλεγχος `entityType` στον κώδικα |
| PDF | `token ==` + `entityType ==` + `isActive ==` |

Το `firestore.indexes.json` δηλώνει **`[token + isActive]`** και **ΟΧΙ**
`[token + entityType + isActive]`. Άρα το PDF variant επιβίωνε **μόνο** χάρη στο
Firestore zigzag merge join για equality-only conjunctions — optimisation, όχι
εγγύηση. Ενοποίηση στο **ρητά indexed** ζεύγος → κανένα public link δεν μπορεί να
αρχίσει να απαντά `FAILED_PRECONDITION` γιατί δεν επιλέχθηκε merge join.

**(β) `limit(2)` αντί `limit(1)`.** Και τα δύο originals έπαιρναν `docs[0]`. Με
`limit(1)` **χωρίς** φίλτρο entityType, τα payload routes θα επέστρεφαν **λάθος** share
αν ένα token ανέλυε σε δύο ενεργά shares — data bug που θα εμφανιζόταν ως *showcase
ενός tenant κάτω από link άλλου*. Με δύο έγγραφα διαλέγουμε κατά `entityType` **και**
καταγράφουμε την ανωμαλία. Κόστος: ένα document read σε path που ήδη διαβάζει πολλά.

Το counter increment γίνεται πλέον `FieldValue.increment(1)` (atomic) αντί
read-then-write — ήταν ήδη έτσι στα building/project, τώρα είναι το μόνο μονοπάτι.

---

## 3. Wire contract — ΠΑΓΩΜΕΝΟ

| | Πριν | Μετά |
|---|---|---|
| payload envelope | `{ <entityKey>, company, photos, floorplans, pdfUrl, expiresAt }` | **ίδιο** (whitelist από config) |
| 404 / 410 / 403 / 500 μηνύματα | ανά surface | **ίδια** (verbatim από config) |
| PDF headers + `Content-Disposition` filename | sanitizer + fallback slug | **ίδια** |
| `pdfUrl` σε parking/storage | απών (`pdfUrlPath: () => null`) | **ίδιο** |

**Αλλαγές μόνο σε logs**: το `'Building showcase media loaded'` γίνεται
`'Showcase media loaded'` (το `loggerName` παραμένει ανά surface, άρα η γραμμή είναι
εξίσου αποδοτέα). Το log field `${entityKey}Id` **παράγεται** αντί να ρυθμίζεται — και
στα τέσσερα surfaces ήταν ήδη `buildingId`/`projectId`/`parkingId`/`storageId`.

---

## 4. Τι ΔΕΝ μετανάστευσε — και γιατί (γνήσια απόκλιση)

Το **property** surface (`app/api/showcase/[token]` + `.../pdf`) μένει με δικά του hooks:

| | unified surfaces | property surface |
|---|---|---|
| share lookup | unified `shares` μόνο | **dual-read**: unified `shares` **και** legacy `FILE_SHARES` |
| filename | `name` → strip → hyphenate | **`code` + `name`**, NFKD normalisation, cap 80 χαρακτήρων |
| counter | `accessCount` atomic increment | **dual-write** `accessCount` ή legacy `downloadCount`, read-then-write |

Το jscpd συμφωνεί: το 446t cluster είναι **building↔project μόνο** — το property δεν
ζευγαρώνει μαζί τους. Δεν είναι αμέλεια· είναι διαφορετικό συμβόλαιο δεδομένων.
**Δεν το «ενοποίησα»** — θα σήμαινε αλλαγή στο τι `Content-Disposition` λαμβάνουν
πραγματικοί χρήστες και στο ποια legacy shares εξακολουθούν να ανοίγουν.

---

## 5. Ισοδυναμίες που αποδείχθηκαν

1. **`{ ...snapshot }` ≡ `{ entityKey, company }`** — επαληθεύτηκε σε **και τα τέσσερα**
   `*ShowcaseSnapshot` interfaces πριν σχεδιαστεί το payload (§2.3 προτίμησε παρ' όλα
   αυτά το whitelist).
2. **`entityIdLogKey` ≡ `${entityKey}Id`** — ταιριάζει σε 4/4 surfaces, άρα παράγεται.
3. **Τα 4 `*ShowcaseMedia` ≡ ένα type** — byte-identical σώματα· τα ονόματα σώζονται ως
   aliases, **κανένας καταναλωτής δεν άλλαξε** (4 viewer clients).
4. **`loadEntityHeader` `companyId ?? ''`** — και τα δύο originals έβαζαν `''` αντί
   `null`, που κάνει τον tenant check να **αποτυγχάνει κλειστά** (403). Διατηρήθηκε:
   fail-closed είναι σωστό, και μια αλλαγή σε 404 θα άλλαζε public απόκριση.

---

## 6. Tests

`src/services/showcase-core/__tests__/public-showcase-surface.test.ts` — **31 tests**
σε κώδικα που είχε **μηδέν**:

| ομάδα | τι κλειδώνει |
|---|---|
| payload key set (6) | ακριβές σύνολο κλειδιών· **δεν διαρρέει** επιπλέον snapshot πεδίο· keying ανά surface· `pdfUrl` present-but-undefined |
| query shape (2) | χρησιμοποιεί το **indexed** `token+isActive`· **ποτέ** unindexed triple· `limit(2)` |
| resolution (11) | live share· κανένα match· **αρνείται share άλλου surface**· διπλό token → σωστό + warn· missing `entityId`/`companyId`/`expiresAt`· `requirePdfPath`· απών `showcaseMeta`· **δεν** κρίνει expiry |
| counter (1) | atomic increment, όχι read-then-write |
| filename (6) | incl. `'Κτίριο Άλφα'` → `''` (τεκμηριωμένη αδυναμία, όχι bug που «φτιάχτηκε») |
| anchor (5) | βρίσκει **6** routes (μη κενό)· όλα μέσω unified factory· **κανένα** share query / media loader / sanitizer σε route file· κάθε route **δηλώνει** rate-limit posture· pin της τρέχουσας posture |

---

## 7. Επαλήθευση

| Έλεγχος | Αποτέλεσμα |
|---|---|
| `npx jest src/services/showcase-core/__tests__` | ✅ **31/31** |
| `npm run jscpd:diff` (13 αρχεία) | ✅ καθαρό — **3ος γύρος** (βλ. §7.1) |
| `npm run test:registry-golden` | ✅ **96/96** |
| false positives μετρημένα με grep πριν την καταχώρηση | ✅ 4 + 4 + 6 matches, **όλα** allowlisted |
| `tsc` | ❌ **ΔΕΝ έτρεξε** — απαγορεύεται σε πράκτορες (N.17) |

### 7.1 Τρεις γύροι jscpd — τι έπιασε κάθε ένας

| γύρος | εύρημα |
|---|---|
| 1 | 5 clones: το `GET` export boilerplate (×4 payload, ×2 pdf) + το imports/`dynamic` block |
| 2 | ίδια — τα factories είχαν λύσει το *σώμα*, όχι το *export* |
| 3 | ✅ καθαρό, μετά το `createPublicTokenRouteExport` |

Ο 1ος γύρος ήταν αυτός που **αποκάλυψε το κενό rate-limit** (§8.2): για να
κεντρικοποιήσω το `GET` έπρεπε να απαντήσω «με ή χωρίς rate limit;» — και η απάντηση
ήταν «εξαρτάται, και κανείς δεν το είχε γράψει πουθενά».

### 7.2 Μεγέθη (N.7.1)

| αρχείο | γραμμές |
|---|---|
| `api/building-showcase/[token]/route.ts` | **42** (από 104) |
| `api/project-showcase/[token]/route.ts` | **42** (από 104) |
| `api/parking-showcase/[token]/route.ts` | **43** (από 100) |
| `api/storage-showcase/[token]/route.ts` | **43** (από 100) |
| `api/building-showcase/[token]/pdf/route.ts` | **37** (από 85) |
| `api/project-showcase/[token]/pdf/route.ts` | **37** (από 85) |
| νέα SSoT modules (7) | 34-146 έκαστο |

**578 γραμμές routes → 244 γραμμές δηλώσεων** — και από αυτές, ~60% είναι σχόλια:
ο εκτελέσιμος κώδικας ανά route είναι **9-14 γραμμές**.

---

## 8. Εκκρεμότητες που **αποκαλύφθηκαν** (δεν αγγίχθηκαν)

### 8.1 🔴 Το `PropertyShowcaseRenderer.test.ts` είναι **σπασμένο στο main**

Δεν φορτώνει καθόλου: `ReferenceError: Request is not defined`. Αιτία: το barrel
`showcase-core/index.ts` εξάγει τα route factories, που εισάγουν `next/server`, και ο
renderer εισάγει από το barrel.

**Επαληθεύτηκε ότι ΔΕΝ το προκάλεσα**: αντικατέστησα προσωρινά το barrel με την έκδοση
του `HEAD` και το test αποτυγχάνει **ταυτόσημα**. Είναι προϋπάρχον.

Η σωστή διόρθωση είναι το ίδιο μοτίβο που εφάρμοσε αυτός ο κύκλος (§ pure modules:
`unified-showcase-payload.ts`, `showcase-filename.ts`): τα pure κομμάτια δεν πρέπει να
κρέμονται από ένα barrel που σέρνει το `next/server`. **Άλλο layer, ξεχωριστός κύκλος.**

### 8.2 🔴 Τα 4 payload routes είναι **ανώνυμα ΚΑΙ χωρίς rate limit**

Τα 2 PDF proxies τυλίγονται σε `withStandardRateLimit`. Τα 4 payload routes — εξίσου
ανώνυμα, και αυτά που εκτελούν **snapshot build + δύο media queries** ανά κλήση —
**σε τίποτα**. Το `create-public-payload-route.ts` μάλιστα τεκμηριώνει το αντίθετο
(*«rate limiting sits on the `withStandardRateLimit` wrapper at the route file»*).

**Δεν το έκλεισα**: προσθήκη limiter σε ζωντανό public endpoint είναι αλλαγή
συμπεριφοράς και ανήκει σε **απόφαση**, όχι σε commit de-duplication. Αντ' αυτού το
έκανα **ορατό**: το `rateLimit` όρισμα του `createPublicTokenRouteExport` είναι
**υποχρεωτικό**, άρα κάθε route file *δηλώνει* σε ποια πλευρά είναι, και ένα test
καρφώνει την τρέχουσα κατάσταση ώστε να μη διευρυνθεί σιωπηλά.

**→ Χρειάζεται απόφαση Giorgio.**

### 8.3 🔴 Το **ADR-321 δεν υπάρχει** — φάντασμα που επικαλούνται 20+ αρχεία

`grep -rn "ADR-321" docs/` → **κανένα** `ADR-321-*.md`. Το επικαλούνται:

- **20+ αρχεία κώδικα** (`@enterprise ADR-321`, `@see ADR-321`, κάθε showcase-core module)
- **δύο άλλα ADR** ως προαπαιτούμενο (ADR-590 §Context, ADR-364)

Το ίδιο το **ADR-364** εξηγεί γιατί: *«13 scaffolding αρχεία / 2.338 γρ. του ADR-321
σβήστηκαν από μαζικό batch που εμπιστεύτηκε το εργαλείο»*. Το αρχείο του ADR προφανώς
χάθηκε στην ίδια εκκαθάριση.

**Συνέπεια**: ο κανόνας N.0.1 Φάση 1 («βρες τα σχετικά ADR, σύγκρινε με τον κώδικα»)
είναι **αδύνατος** για το showcase-core — δεν υπάρχει τι να διαβάσεις. Ό,τι ξέρουμε για
τις αποφάσεις του ADR-321 ζει **μόνο** στα docblocks των modules.

**Δεν το ανακατασκεύασα** — η ανασύνθεση ενός ADR από τον κώδικα είναι δουλειά ενός
κύκλου, όχι υποσημείωση σε άλλον. Το changelog αυτού του κύκλου μπήκε γι' αυτό στα
**υπαρκτά** ADR-320 και ADR-316.

**→ Χρειάζεται απόφαση Giorgio**: ανασύνθεση ADR-321 από τον κώδικα, ή ρητή σήμανση ως
«αποσυρμένο» ώστε να σταματήσουν οι 20+ αναφορές να δείχνουν στο κενό;

### 8.4 🟡 Υπόλοιπα showcase clusters (μετρημένα, για επόμενους κύκλους)

| tokens | ζεύγος |
|---|---|
| 418t / 3 | `parking-showcase/snapshot-builder.ts` ↔ `storage-showcase/snapshot-builder.ts` |
| 338t / 3 | `sharing/resolvers/project-showcase.resolver.ts` ↔ `property-showcase.resolver.ts` |
| 242t / 4 | `buildings/[buildingId]/showcase/pdf` ↔ `projects/[projectId]/showcase/pdf` |
| 221t / 3 | `parking-showcase/labels.ts` ↔ `storage-showcase/labels.ts` |
| 205t / 1 | `pdf/renderers/PropertyShowcaseRenderer.ts` ↔ `showcase-core/pdf-renderer-base.ts` |
| 172t / 2 | `properties/[id]/showcase/generate` ↔ `regenerate` (τα **μόνα** χειρόγραφα) |
| 161t ×3 | `BuildingShowcaseClient.tsx` ↔ parking / project / storage clients |
| 138t / 2 | `buildings/.../showcase/email` ↔ `projects/.../showcase/email` |

**Και τα 8 είναι το ίδιο μοτίβο του §1.2**: το factory υπάρχει, το καλούν, και το config
είναι το clone. Το `sharing/resolvers` ζεύγος είναι ιδιαίτερα καθαρό — το
`share-resolver-factory.ts` (ADR-321) υπάρχει και οι resolvers **δεν** μετανάστευσαν
(κλωνοποιούνται ακόμη και **με το factory**, 119t).

---

## 9. Google-level δήλωση (N.7.2)

| # | Ερώτημα | Απάντηση |
|---|---|---|
| 1 | Proactive ή reactive? | **Proactive** — τα συμβόλαια είναι δεδομένα· anchor απαιτεί ότι κάθε route είναι δήλωση |
| 2 | Race condition? | **Όχι** — pure reads· ο counter είναι πλέον atomic `FieldValue.increment` |
| 3 | Idempotent? | **Ναι** — GET |
| 4 | Belt-and-suspenders? | **Ναι** — indexed query **και** entityType έλεγχος στον κώδικα· `limit(2)` + warn· whitelist payload + test |
| 5 | SSoT? | **Ναι** — ένα share lookup, ένα media loader, ένας τύπος media, ένα route export, δύο factories |
| 6 | Await ή fire-and-forget? | **Await** για το σώμα· fire-and-forget **μόνο** ο counter (ήταν ήδη, μέσω `safeFireAndForget`) |
| 7 | Ποιος κατέχει τον κύκλο ζωής? | **Ρητά**: `public-share-lookup` το token, `public-media` τα media, τα unified factories το HTTP |

✅ **Google-level: ΝΑΙ** — το μεγαλύτερο clone cluster του `src/` εξαλείφθηκε χωρίς
αλλαγή wire contract, με **ενισχυμένη** (όχι αποδυναμωμένη) άμυνα στο public payload,
index-safe query, atomic counter, 31 tests όπου υπήρχαν μηδέν, και δύο πραγματικά
προβλήματα ασφαλείας/ποιότητας **αναφερμένα** αντί να «διορθωθούν» σιωπηλά.

---

## 10. Changelog

| Ημ/νία | Αλλαγή |
|---|---|
| 2026-07-25 | **Δημιουργία.** Κύκλος #4 της εκστρατείας (μετά ADR-695/696/697). Νέο μοτίβο: **over-parameterised factory** — το SSoT υπήρχε και το καλούσαν όλοι, αλλά δεχόταν hooks και όλες οι υλοποιήσεις ήταν ίδιες. 6 routes 578→250 γρ. Νέα: `public-share-lookup`, `public-media` (+ ΕΝΑΣ `ShowcaseMediaItem` αντί 4), `create-token-route-export`, `create-unified-public-{payload,pdf}-route`, `unified-showcase-payload` (whitelist), `showcase-filename`. Registry module `public-showcase-token-surface` (371 modules). 31 tests. Αποκάλυψε: σπασμένο test στο main (§8.1) + κενό rate-limit σε 4 ανώνυμα endpoints (§8.2). |
