# ADR-699 — Share Resolvers ως δηλώσεις (`sharing/resolver-core` + data-driven showcase factory)

**Status**: Accepted
**Date**: 2026-07-25
**Σχετικά**: ADR-315 (Unified Sharing), ADR-312/316/320 (property/project/building showcase), ADR-321 (Showcase Core — **φάντασμα**, βλ. §8.2), ADR-255 (tenant isolation), ADR-294 (SSoT Ratchet), ADR-584 (jscpd), ADR-698 (κύκλος #4 — από όπου προέρχεται το μοτίβο)

**Εκστρατεία SSoT Duplicate Sweep — κύκλος #5.**

---

## 1. Context

### 1.1 Το εύρημα

`npx jscpd src` (2026-07-25, μετά τον κύκλο #4):

```
338t x3   sharing/resolvers/project-showcase.resolver.ts ↔ property-showcase.resolver.ts
128t x2   sharing/resolvers/contact.resolver.ts          ↔ project-showcase.resolver.ts
119t x1   sharing/resolvers/project-showcase.resolver.ts ↔ showcase-core/share-resolver-factory.ts
 91t x1   sharing/resolvers/contact.resolver.ts          ↔ showcase-core/share-resolver-factory.ts
```

Οι τελευταίες δύο γραμμές είναι η διάγνωση: τα αρχεία κλωνοποιούνταν **με το ίδιο το factory
που υποτίθεται ότι τα αντικατέστησε**.

### 1.2 Η κατάσταση πριν — τρεις διαφορετικές γενιές στον ίδιο φάκελο

| αρχείο | κατάσταση |
|---|---|
| `property-showcase.resolver.ts` (128 γρ.) | **χειρόγραφο** — το factory γράφτηκε πάνω του και **ποτέ δεν το κατανάλωσε** |
| `project-showcase.resolver.ts` (127 γρ.) | **χειρόγραφο** αντίγραφο του παραπάνω· διαφορά: 2 collections, 2 ονόματα πεδίων, σειρά `name`/`title` |
| `building-showcase.resolver.ts` (47 γρ.) | καλεί το factory |
| `storage-showcase.resolver.ts` (62 γρ.) | καλεί το factory **+ ξαναγράφει `validateCreateInput`** για να πέσει ένας έλεγχος |
| `parking-showcase.resolver.ts` (62 γρ.) | ίδιο με το storage |
| `file.resolver.ts` (109 γρ.) | χειρόγραφο — αλλά **3 από τις 4 μεθόδους του** ήταν οι ίδιες με των showcase |
| `contact.resolver.ts` (163 γρ.) | ίδιο· γι' αυτό το 128t clone με το project |

### 1.3 Η αιτία: **over-parameterised factory** (ίδιο μοτίβο με ADR-698 §1.2)

Το `createShowcaseShareResolver` (ADR-321, Απρίλιος) ζητούσε ένα `buildResolvedData`
callback. Και οι πέντε επιφάνειες του έδιναν **το ίδιο object literal με μετονομασμένα
κλειδιά**:

```ts
buildResolvedData: ({ share, data, pdfStoragePath, pdfRegeneratedAt }) => ({
  shareId: share.id,
  token: share.token,
  buildingId: share.entityId,                       // ← μόνο το όνομα αλλάζει
  buildingTitle: (data?.name ?? data?.title) ?? null, // ← μόνο η σειρά αλλάζει
  pdfStoragePath, pdfRegeneratedAt,
  note: share.note ?? null,
}),
```

Το ίδιο και το `validateCreateInput`: parking/storage το ξανάγραφαν ολόκληρο επειδή
**δεν** απαιτούν `pdfStoragePath` — μία boolean διαφορά, εκφρασμένη ως 9 γραμμές κώδικα.

> **Factory που ζητά κώδικα εκεί που θα μπορούσε να ζητήσει δεδομένα δεν κεντρικοποίησε —
> μετακόμισε το boilerplate ένα επίπεδο κάτω.**

Το CHECK 3.18 (`ssot:discover`) το βλέπει ως ✅ («όλοι εισάγουν το SSoT»). Μόνο το
**jscpd** βλέπει το clone που ζει μέσα στο config object.

### 1.4 SSoT audit ΠΡΙΝ τον κώδικα

Πριν γραφτεί οτιδήποτε, ελέγχθηκε αν υπάρχει ήδη κεντρικό:

| ψάχτηκε | βρέθηκε | απόφαση |
|---|---|---|
| `createShowcaseShareResolver` | ✅ υπάρχει, 3/5 το καλούν | **επεκτάθηκε**, δεν ξαναγράφτηκε |
| `lib/auth/tenant-isolation.ts` (ADR-255) | ✅ per-doc ownership | **ΔΕΝ ενοποιήθηκε** — βλ. §4.1 |
| `lib/auth/tenant-scope.ts` (ADR-697) | ✅ query scoping | άλλο ερώτημα — δεν εφαρμόζεται |
| «άλλο `safePublicProjection`» | μόνο μέσα στους 4 resolvers | κεντρικοποιήθηκε |

---

## 2. Decision

### 2.1 Νέο SSoT: `src/services/sharing/resolver-core/`

Τα κοινά κομμάτια **όλων** των resolvers (όχι μόνο των showcase), χωρισμένα σε
**pure** και **I/O** — το μοτίβο που οι κύκλοι #2/#3/#4 έφτασαν τρεις φορές, ώστε η
πολιτική να δοκιμάζεται χωρίς mock βάσης:

| module | περιεχόμενο | I/O |
|---|---|---|
| `share-resolver-primitives.ts` (158 γρ.) | `buildSafePublicProjection`, `validateShareBaseInput`, `pickFirstStringField`, `normalizeRegenTimestamp` | **καθαρό** |
| `share-entity-access.ts` (80 γρ.) | `loadSharedEntityDoc`, `createTenantOwnershipGuard` | Firestore client SDK |

### 2.2 Το factory δέχεται **δεδομένα**, όχι callbacks

`showcase-core/share-resolver-factory.ts` — το `buildResolvedData` hook **καταργήθηκε**:

```ts
export interface ShowcaseShareResolverConfig<TIdKey extends string, TTitleKey extends string> {
  entityType: ShareEntityType;
  collection: string;
  idField: TIdKey;                     // 'buildingId' — και label μηνυμάτων
  titleField: TTitleKey;               // 'buildingTitle'
  titleSourceFields: readonly string[];// ['name', 'title'] — σειρά = δεδομένο
  requiresPdfPath: boolean;            // η μόνη διαφορά parking/storage
}
```

Ο τύπος του αποτελέσματος παράγεται από τα ίδια δύο κλειδιά:

```ts
export type ShowcaseResolvedData<TIdKey extends string, TTitleKey extends string> =
  { shareId; token; pdfStoragePath; pdfRegeneratedAt; note }
  & { [K in TIdKey]: string }
  & { [K in TTitleKey]: string | null };
```

Το `loggerName` **δεν** είναι πλέον πεδίο — παράγεται από το `entityType`
(`building_showcase` → `BuildingShowcaseShareResolver`).

### 2.3 Οι πέντε επιφάνειες = ένα αρχείο δηλώσεων

Τα 5 αρχεία `*-showcase.resolver.ts` (426 γρ. συνολικά) **διαγράφηκαν** και
αντικαταστάθηκαν από `sharing/resolvers/showcase-surfaces.resolvers.ts` (119 γρ.):

```ts
export const parkingShowcaseShareResolver: ShareEntityDefinition<ParkingShowcaseResolvedData> =
  createShowcaseShareResolver({
    entityType: 'parking_showcase',
    collection: COLLECTIONS.PARKING_SPACES,
    idField: 'parkingId',
    titleField: 'parkingTitle',
    titleSourceFields: ['number', 'code'],
    requiresPdfPath: false,
  });
```

**Γιατί ένα αρχείο και όχι πέντε των 20 γραμμών**: πέντε σχεδόν όμοιες δηλώσεις σε
ξεχωριστά αρχεία είναι ακριβώς το σχήμα που ξαναγεννά sibling clones (μάθημα κύκλων
#1-#4). Μαζί, η προσθήκη έκτης επιφάνειας είναι **μία καταχώριση**, και το anchor
μετράει `createShowcaseShareResolver(` έναντι των `*_showcase` τύπων.

### 2.4 `file` και `contact` καταναλώνουν τα ίδια primitives

Δεν είναι showcase, αλλά έκαναν τις **ίδιες τρεις** δουλειές. Τώρα:

```ts
safePublicProjection: share => buildSafePublicProjection(share, 'fileMeta'),
validateCreateInput: input => validateShareBaseInput(input, { entityType: 'file', entityIdLabel: 'fileId' }),
canShare: createTenantOwnershipGuard(COLLECTIONS.FILES),
```

Ό,τι απομένει χειρόγραφο είναι **γνήσια** πολιτική (§4.2).

---

## 3. Το meta bag είναι **παράμετρος**, όχι spread — άμυνα που δεν χάθηκε

Το `ShareRecord` κουβαλά τρεις προαιρετικές θήκες: `showcaseMeta`, `contactMeta`,
`fileMeta`. Κάθε χειρόγραφος resolver δημοσίευε **ακριβώς μία** και παρέλειπε τις άλλες
γράφοντάς τες με το χέρι.

Ένα `{ ...share }` στο κεντρικό θα δημοσίευε **και τις τρεις** — τα `includedFields` μιας
επαφής θα εμφανίζονταν σε share αρχείου. Γι' αυτό ο καλών **ονομάζει** τη θήκη του και το
primitive αντιγράφει **μόνο** αυτή (`switch` με exhaustive κλάδους, όχι computed spread).

Πινέζα: `buildSafePublicProjection` — 3 tests, ένα ανά θήκη, που επαληθεύουν ότι οι άλλες
δύο **δεν υπάρχουν καν ως κλειδιά**.

Ίδιο σκεπτικό με ADR-698 §2.3 (whitelist αντί spread). Ερώτηση που τέθηκε ρητά:
*«τι έλεγχο έκανε το χειρόγραφο που χάνω;»*

---

## 4. Τι ΔΕΝ ενοποιήθηκε — και γιατί

### 4.1 🔒 `canShare` **δεν** χρησιμοποιεί το `lib/auth/tenant-isolation` (ADR-255)

Απαντούν το ίδιο ερώτημα («ανήκει το έγγραφο στον tenant του καλούντος;») σε **δύο
διαφορετικές πλευρές του καλωδίου**:

| | `tenant-isolation` (ADR-255) | `createTenantOwnershipGuard` (εδώ) |
|---|---|---|
| SDK | `firebase-admin` (server) | `firebase/firestore` (client) |
| ταυτότητα | `AuthContext` | `AuthorizedUser` |
| αποτυχία | **throws** + audit event | `false` |
| καταναλωτής | API route | κουμπί «Κοινοποίηση» στο UI |

Ενοποίηση θα σήμαινε είτε `firebase-admin` σε client bundle, είτε αποδυνάμωση του server
guard σε boolean. **Δύο δόγματα επίτηδες** — η ίδια διάκριση που κάνει το `tenant-scope.ts`
απέναντι στο `super-admin-scope.ts`. Τεκμηριωμένο στο docblock του module.

### 4.2 Γνήσια ανά-entity πολιτική που έμεινε χειρόγραφη

| resolver | τι κρατήθηκε | γιατί |
|---|---|---|
| `contact` | `pickIfIncluded` ανά πεδίο | **συναίνεση**: τίποτα δεν δημοσιεύεται αν ο κοινοποιών δεν το έβαλε στο `includedFields`. Εφαρμόζεται ανά πεδίο (όχι φιλτράρισμα εκ των υστέρων) ώστε νέο πεδίο να **παραλείπεται by default** |
| `contact` | `asStringArray`, `readFullName` | ιδιαίτερα σχήματα εγγράφου επαφής |
| `contact` | έλεγχος `includedFields.length` | επιπλέον του base validator |
| `file` | `fileName: data?.name ?? share.entityId` | fallback στο id — σελίδα λήψης πρέπει να αποδίδεται και για διαγραμμένο αρχείο |
| `file` | `mimeType`/`sizeBytes` από `fileMeta` **πριν** το έγγραφο | το share κουβαλά snapshot |

---

## 5. Δηλωμένες αλλαγές συμπεριφοράς (μικρές, σκόπιμες)

Ο κανόνας «μη ξαναγράφεις σιωπηλά» απαιτεί να απαριθμηθούν:

| # | αλλαγή | κρίση |
|---|---|---|
| 1 | `pickFirstStringField` προσπερνά **κενό/whitespace** string και πάει στο επόμενο πεδίο. Πριν: `data?.title ?? data?.name` επέστρεφε `''`. | **Διόρθωση**. Κενός τίτλος δεν είναι τίτλος· το UI ήδη χειριζόταν `null`. |
| 2 | Warning για χαμένη οντότητα: ενιαίο `'Showcase share points to missing entity'` με context `{ shareId, entityType, entityId }`. Πριν property/project έγραφαν `'…missing property'` / `'…missing project'` με key `propertyId`/`projectId`. | **Αποδεκτό** — log, όχι wire contract· 3/5 επιφάνειες ήδη το χρησιμοποιούσαν. `file`/`contact` κρατούν τα δικά τους μηνύματα (παράμετρος `missingMessage`). |
| 3 | `contact.resolve` δεν έχει πλέον ξεχωριστό early-return για χαμένη επαφή. | **Ισοδύναμο** — με `data === null` όλα τα picks δίνουν ήδη `null`· αποδεικνύεται από test. |

**Wire contract αμετάβλητο**: κλειδιά `PublicShareData`, κλειδιά κάθε `*ResolvedData`,
και **κάθε** reason string του `validateCreateInput` παραμένουν byte-identical (πινεζωμένα).

---

## 6. Tests

`src/services/sharing/resolver-core/__tests__/share-resolver-declarations.test.ts` —
**59 tests**, ~3,5s.

| ομάδα | τι πινεζώνει |
|---|---|
| `buildSafePublicProjection` (4) | δημοσιεύει **μία** θήκη· οι άλλες δύο απούσες ως κλειδιά· καθόλου `companyId`/`createdBy`/`passwordHash`/`token`/`id`· ακριβές key set |
| `validateShareBaseInput` (5) | κάθε reason string verbatim· **πρώτη** αποτυχία κερδίζει |
| `pickFirstStringField` (4) | σειρά δήλωσης· blank → επόμενο· non-string αγνοείται |
| `normalizeRegenTimestamp` (3) | Timestamp / ISO / `toDate` που πετάει |
| **ανά επιφάνεια** (5 × 7 = 35) | key set του resolved (⇽ **αυτό αποδεικνύει το type assertion**)· σειρά `titleSourceFields`· χαμένη οντότητα + warn· μόνο `showcaseMeta`· λάθος entityType· **posture `requiresPdfPath`**· cross-tenant `canShare` = false |
| **anchor** (5) | κάθε `ShareEntityType` έχει resolver **εκτός** `vendor_rfq_invite` (ρητή δήλωση)· κανένα αρχείο resolver δεν ξαναγράφει primitive (4 forbidden patterns)· κάθε `*_showcase` περνά από το factory· μη-κενό union (anti-vacuous) |

Το anchor διαβάζει το `ShareEntityType` union **από το `src/types/sharing.ts`**: νέος
τύπος share χωρίς resolver → κόκκινο, με ρητή λίστα εξαιρέσεων ως μόνη διέξοδο.

**Το type assertion καλύπτεται από συμπεριφορά.** Το `withDeclaredKeys` κάνει ένα
`as ShowcaseResolvedData<…>` (η TS δεν συνάγει mapped type από computed key με generic
όνομα). Είναι απομονωμένο σε **μία** συνάρτηση και τα 5 × «key set» tests εκτελούν τον
πραγματικό resolver και ελέγχουν τα αληθινά κλειδιά.

---

## 7. Επαλήθευση

```
npx jest src/services/sharing            → 76/76 ✅  (59 νέα + 17 unified-sharing)
npx jest src/services/showcase-core      → 31/31 ✅  (anchor ADR-698, αμετάβλητο)
npm run jscpd:diff -- <7 αρχεία>         → ✅ no new clones (1ος γύρος)
npx jscpd src/services/sharing src/services/showcase-core → 338t & 128t **εξαφανίστηκαν**
```

Το `jscpd:diff` πέρασε με τον **πρώτο** γύρο — ασυνήθιστο για την εκστρατεία. Ελέγχθηκε
με στοχευμένο full scan στα δύο δέντρα ότι δεν είναι ψευδώς πράσινο: απομένουν **3**
clones, **κανένα** σε αρχείο αυτού του κύκλου (§8.3).

### 7.1 Μεγέθη (N.7.1 — όλα ≤500 γρ., συναρτήσεις ≤40)

| αρχείο | πριν | μετά |
|---|---|---|
| 5 × `*-showcase.resolver.ts` | **426** | **0** (διαγράφηκαν) |
| `showcase-surfaces.resolvers.ts` | — | 119 |
| `share-resolver-factory.ts` | 149 | 184 |
| `file.resolver.ts` | 109 | 68 |
| `contact.resolver.ts` | 163 | 137 |
| `resolver-core/` (νέο SSoT) | — | 238 |
| **σύνολο κώδικα** | **847** | **746** |

Η καθαρή μείωση (−101 γρ.) υποτιμά την αλλαγή: **εκτελέσιμος** κώδικας ανά επιφάνεια
πέφτει από ~85 σε **8 γραμμές δήλωσης**· τα υπόλοιπα είναι μία υλοποίηση.

---

## 8. Εκκρεμότητες

### 8.1 🔴 Rate limit σε 4 ανώνυμα public endpoints — **ανοιχτό από ADR-698 §8.2**
Αμετάβλητο· δεν το αγγίζει αυτός ο κύκλος.

### 8.2 🔴 **ΤΡΙΑ** ADR-φαντάσματα, όχι ένα — επέκταση του ADR-698 §8.3

Ο κύκλος #4 βρήκε ότι το **ADR-321** επικαλείται από 20+ αρχεία ενώ δεν υπάρχει. Ο #5
βρήκε ότι το ίδιο ισχύει για **ολόκληρη την οικογένεια sharing**:

```
docs/centralized-systems/reference/adrs/
  ADR-312-*.md   ← ΔΕΝ ΥΠΑΡΧΕΙ  (property showcase share — επικαλείται στους resolvers)
  ADR-315-*.md   ← ΔΕΝ ΥΠΑΡΧΕΙ  (Unified Sharing — το θεμέλιο ΟΛΟΥ του domain:
                                  ShareEntityRegistry, ShareEntityDefinition, 7 resolvers)
  ADR-321-*.md   ← ΔΕΝ ΥΠΑΡΧΕΙ  (Showcase Core)
  ADR-316 ✅  ADR-320 ✅  (τα μόνα υπαρκτά της οικογένειας)
```

Το `share-entity-registry.ts` παραπέμπει σε «ADR-315 §3.3». Το ADR-364 εξηγεί το πώς:
13 scaffolding αρχεία / 2.338 γρ. σβήστηκαν από μαζικό batch.

**Συνέπεια**: ο N.0.1 Φάση 1 («διάβασε το ADR, σύγκρινε με τον κώδικα») είναι **αδύνατος**
για το sharing domain — η αλήθεια ανακτήθηκε αποκλειστικά από τον κώδικα, και τα docblocks
αυτού του κύκλου δείχνουν πλέον **εδώ**. **Χρειάζεται απόφαση Giorgio**: ανασύνθεση των
τριών, ή ρητή απόσυρση με redirect στα 698/699.

### 8.3 🟡 Τρία clones που **απομένουν** στο δέντρο (προϋπάρχοντα, εκτός εύρους)
```
88t  showcase-core/api/create-pdf-route.ts:102 ↔ create-public-payload-route.ts:94
50t  showcase-core/api/create-public-payload-route.ts:125 ↔ create-public-pdf-route.ts:139
54t  showcase-core/pdf-renderer-base.ts:312 ↔ :330  (self-clone)
```
Αρχεία του κύκλου #4 — δεν αγγίχθηκαν εδώ.

### 8.4 🟡 Smoke test πριν production
Ένα «Κοινοποίηση» ανά επιφάνεια (property / project / building / storage / parking) +
ένα άνοιγμα public link. Ο κώδικας άλλαξε σε **ζωντανό** μονοπάτι δημιουργίας share.

---

## 9. Google-level δήλωση (N.7.2)

| # | ερώτημα | απάντηση |
|---|---|---|
| 1 | Proactive/reactive | **Proactive** — η επιφάνεια δηλώνεται μία φορά· δεν υπάρχει «ξέχασα να μεταναστεύσω» |
| 2 | Race condition | **Όχι** — καθαρές συναρτήσεις + ένα `getDoc` |
| 3 | Idempotent | **Ναι** — `registerShareResolvers()` έχει ήδη guard· οι resolvers είναι stateless |
| 4 | Belt-and-suspenders | **Ναι** — τύποι (mapped keys) + anchor tests + CHECK 3.28 |
| 5 | SSoT | **Ναι** — μία υλοποίηση projection/validation/ownership/read για **7** resolvers |
| 6 | Await ή fire-and-forget | **Await** — `resolve`/`canShare` καθορίζουν την απόκριση |
| 7 | Ιδιοκτησία lifecycle | **Ρητή** — `resolver-core` κατέχει το κοινό, το factory τη showcase οικογένεια, ο κάθε resolver **μόνο** τη δική του πολιτική |

✅ **Google-level: ΝΑΙ** — το factory δέχεται πλέον δεδομένα αντί για κώδικα, η άμυνα του
meta-bag διατηρήθηκε ρητά αντί να χαθεί σε spread, και η εξαντλητικότητα είναι
πινεζωμένη σε anchor που διαβάζει το type union.

---

## 10. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-07-25 | **Δημιουργία (κύκλος #5).** Νέο `sharing/resolver-core/` (primitives + entity access). `createShowcaseShareResolver` → data-driven (κατάργηση `buildResolvedData`, `loggerName`· προσθήκη `idField`/`titleField`/`titleSourceFields`/`requiresPdfPath`). 5 × `*-showcase.resolver.ts` → ένα `showcase-surfaces.resolvers.ts`. `file`/`contact` σε primitives. 59 tests. Registry: `share-resolver-core`. Clones 338t + 128t εξαλείφθηκαν. |
