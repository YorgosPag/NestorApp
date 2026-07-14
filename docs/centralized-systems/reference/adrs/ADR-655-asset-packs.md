# ADR-655 — Asset Packs: entitlement + ασφαλής διανομή αδειοδοτημένου περιεχομένου

**Status**: Accepted · **Ημερομηνία**: 2026-07-14 · **Σχετικά**: ADR-654 (entourage), ADR-413 (textures), ADR-652 (scoped libraries)

---

## 1. Πλαίσιο

Το ADR-654 έφερε βιβλιοθήκη raster 2D επίπλων κάτοψης. Τα sprites είναι **αδειοδοτημένο
περιεχόμενο** (άδεια από τον δημιουργό, μη αναδιανεμήσιμο) και ακολουθούν **πολλά ακόμα πακέτα**.

Απαιτήσεις:
1. Τα assets στο Firebase Storage (είναι gitignored — δεν φτάνουν στο build).
2. **Ένα σημείο ελέγχου**: ακαριαία διακοπή διανομής· διάθεση μόνο σε δικαιούχους.
3. Ταυτότητα/ονοματοδοσία που σηκώνει N πακέτα χωρίς αρχιτεκτονική αλλαγή κάθε φορά.

### Latent bug που αποκαλύφθηκε
Το `storage.rules` **δεν είχε ποτέ κανόνα για `furniture-2d-library/`** ⇒ default-deny ⇒ το
production `storage` mode του ADR-654 ήταν **ήδη σπασμένο** (η παλέτα θα έβγαινε άδεια). Δεν
είχε εντοπιστεί επειδή το feature δούλευε μόνο σε dev (`public` mode). Μηδέν prod entities ⇒
καθαρό πεδίο για μετάβαση.

---

## 2. Απόφαση

### 2.1 Same-origin streaming proxy — ΟΧΙ signed URLs

Τα bytes σερβίρονται **αποκλειστικά** από `GET /api/asset-packs/{packId}/{version}/{fileName}`.
Το `storage.rules` λέει `allow read: if false` για το `asset-packs/**` — κανείς client δεν διαβάζει
απευθείας. Ο proxy διαβάζει με Admin SDK (παρακάμπτει τους rules) **αφού** περάσει η πύλη.

**Γιατί απορρίφθηκαν τα signed URLs** (η προφανής πρώτη σκέψη):

| | Signed URL | Same-origin proxy |
|---|---|---|
| `ImageEntity.url` | πρέπει να γίνει λογική αναφορά (`assetpack://…`) γιατί το signed URL λήγει | **μένει σκέτο URL** |
| **Εξαγωγή DXF** | **σπάει σιωπηλά** ⚠️ | δουλεύει αμετάβλητη |
| `HatchImageCache` | νέος resolver + expiry cache | καμία αλλαγή |
| Ανάκληση | παράθυρο διαρροής (TTL) | **ανά αίτημα** |
| Canvas taint | εξαρτάται από CORS του bucket | ποτέ (same-origin) |

Το αποφασιστικό: το `export/core/image-entity-export.ts` καλεί `decodeImageWithTimeout(entity.url)`
απευθείας και, σε αποτυχία, **παραλείπει την εικόνα χωρίς μήνυμα**. Με λογική αναφορά, ο χρήστης θα
εξήγαγε DXF και θα έλειπαν όλα τα έπιπλα, σιωπηλά. Ο proxy κρατά το `url` σκέτο same-origin URL,
οπότε το export path **δεν αγγίζεται καθόλου**.

Ο browser στέλνει μόνος του το `__session` cookie σε κάθε `<img src>` και `fetch` (το
`auth-context.ts` δέχεται cookie, όχι μόνο Bearer).

### 2.2 Ο διακόπτης ζει σε δεδομένα, όχι σε κώδικα

- **Ταυτότητα** (κώδικας, σταθερή): `src/lib/asset-packs/asset-pack-registry.ts` — id, version,
  άδεια, allowlist assets, `defaultStatus`.
- **Κατάσταση** (Firestore, μεταβλητή): `asset_pack_config/{packId}.status` ∈
  `public | entitled | disabled`.

Αν η πολιτική ζούσε στον κώδικα, το «κόψε τη διανομή» θα απαιτούσε commit + build + deploy —
**δεν θα ήταν kill switch**. Τώρα αλλάζει ένα πεδίο και κόβεται παντού σε ≤60s (TTL cache).

### 2.3 Δύο ανεξάρτητα στρώματα δικαιώματος

| Ερώτηση | Πού ζει |
|---|---|
| Ποια **εταιρεία** απέκτησε το πακέτο; | `companies/{companyId}.assetPackEntitlements: string[]` |
| Ποιος **χρήστης** μέσα της μπορεί να το χρησιμοποιεί; | RBAC `asset_packs:packs:use` |

**Γιατί δεν αρκεί το RBAC μόνο του**: ξεχωρίζει *ρόλους*, όχι *πελάτες*. Ένα permission δοσμένο
στον ρόλο `internal_user` το παίρνει κάθε internal user **κάθε εταιρείας** ⇒ αδύνατο να πουλήσεις
πακέτο στον πελάτη Α και όχι στον Β.

**Γιατί ΕΝΑ permission και όχι ένα-ανά-pack**: το `PermissionId` είναι `keyof typeof PERMISSIONS`
(στατικό) ⇒ permission-ανά-pack σημαίνει edit σε `types.ts` + `roles.ts` + deploy για **κάθε νέο
πακέτο**, ακυρώνοντας την απαίτηση #3. Επιπλέον, το `hasPermission` χωρίς `projectId` πέφτει στον
**global role** (`permissions.ts:360`) — άρα project-scoped ρόλοι δεν θα λειτουργούσαν καθόλου.

### 2.4 Η απόφαση είναι μία καθαρή συνάρτηση

`src/lib/asset-packs/asset-pack-access.ts` → `decideAssetPackAccess()` — μηδέν I/O, εξαντλητικά
tested. Τη χρησιμοποιούν **και** ο manifest route **και** ο asset proxy ⇒ αδύνατο να αποκλίνουν
(το κλασικό κενό «η λίστα κρύβει το pack αλλά το URL το σερβίρει»).

Σειρά: άγνωστο → `disabled` (πλην super-admin) → super-admin → `public` → entitlement → RBAC.
**Fail-closed** παντού: σφάλμα Firestore ⇒ `defaultStatus` / κενά entitlements ⇒ deny.

---

## 3. ⚠️ Τι ΔΕΝ προστατεύει αυτό το σύστημα (ρητά)

**Ένας δικαιούχος χρήστης μπορεί πάντα να εξάγει τα sprites** — από τα devtools ή από το εξαγόμενο
DXF zip. **Δεν υπάρχει DRM σε client-side rendering** και δεν προσποιούμαστε ότι υπάρχει.

Ο έλεγχος είναι **entitlement + audit**, όχι delivery:
- Ποιος **δικαιούται** ελέγχεται πριν σταλεί ένα byte.
- Κάθε **άρνηση** καταγράφεται (`asset_pack.access_denied`).
- Η **διανομή** κόβεται ακαριαία, κεντρικά.

Ό,τι υπόσχεται περισσότερα θα ήταν ψευδής ασφάλεια.

---

## 4. Αρχιτεκτονική

```
Παλέτα                    GET /api/asset-packs         ← «ποια πακέτα δικαιούμαι;» (1 κλήση)
  │                              │
  │ (κρύβει τα κλειδωμένα)       └── listAccessibleAssetPacks ─┐
  │                                                            │
  └── <img src="/api/asset-packs/{pack}/{version}/{file}.webp">│
                 │                                             │
                 ▼                                             ▼
        asset proxy (Node)                        decideAssetPackAccess()  ← ΚΑΘΑΡΗ, tested
                 │                                             ▲
                 ├── allowlist (Set.has) ─── 404               │
                 ├── resolveAssetPackAccess ───────────────────┘
                 │      ├── asset_pack_config/{packId}.status   (ο διακόπτης, TTL 60s)
                 │      ├── companies/{id}.assetPackEntitlements
                 │      └── hasPermission('asset_packs:packs:use')
                 │
                 └── getAdminBucket().download() → webp, immutable cache
                        ▲
                        └── storage.rules: allow read: if false  (κανείς client)
```

**Belt-and-suspenders** (N.7.2 §4): το UI **κρύβει**, ο proxy **επιβάλλει**. Ένας χρήστης που
μαντεύει το URL κερδίζει 403.

---

## 5. Συνέπειες

### Θετικές
- **Το URL είναι πλέον σύγχρονο** ⇒ εξαφανίστηκε όλος ο async μηχανισμός της παλέτας (per-card
  fire-and-forget resolve, `busyId`, proactive prefetch για αποφυγή race). Δεν υπάρχει race χωρίς
  αναμονή. Ο κώδικας **μίκρυνε**.
- **Μία διαδρομή σε dev και prod** ⇒ τα σχέδια είναι φορητά. Πριν, ένα σχέδιο αποθηκευμένο σε dev
  (`/furniture-2d/...`) θα έσπαγε σε prod.
- Νέο pack = **μία εγγραφή** στο registry + upload + entitlement doc. Μηδέν αλλαγή στο RBAC.

### Τιμήματα (συνειδητά)
- **Το dev απαιτεί ανεβασμένα assets** (`node scripts/upload-asset-pack.js furniture-plan-2d`).
  Χάθηκε το offline dev· κερδήθηκε dev == prod.
- **Νέα κλάση rate limit** `ASSET: 600/min`. Ένα cap 100/min σε στατικές εικόνες θα ήταν αυτο-DoS
  (μια παλέτα με 450 sprites κάνει 450 αιτήματα σε cold cache). Τα responses είναι `immutable` +
  versioned ⇒ κάθε asset κατεβαίνει **μία φορά ανά browser**, ποτέ ξανά. Οι κάρτες είναι
  `loading="lazy"` ⇒ μόνο οι ορατές χτυπούν τον proxy.
- **Το dev auth bypass** (`auth-context.ts`) σημαίνει ότι το gating **δεν επαληθεύεται τρέχοντας
  τοπικά** — κάθε τοπικός χρήστης περνά. Γι' αυτό η απόφαση είναι καθαρή συνάρτηση με εξαντλητικά
  unit tests: είναι η **μόνη αυτόματη απόδειξη** ότι η πύλη κλείνει.

### Εκκρεμότητα — δημόσιο showcase
Το `src/app/api/floorplans/scene/route.ts` επιτρέπει **ανώνυμη** πρόσβαση σε σκηνή όταν το project
είναι public. Απόφαση Φ1: **τα gated packs δεν σερβίρονται ανώνυμα** — το δημόσιο showcase δείχνει
την κάτοψη χωρίς entourage. Ποτέ δεν διαρρέει πληρωμένο περιεχόμενο στο ανοιχτό internet. Αν
αργότερα χρειαστεί showcase *με* έπιπλα, ο σωστός δρόμος είναι **flattened server-side render**
(raster/PDF), όχι έκθεση των atomic sprites.

---

## 6. Αρχεία

| Αρχείο | Ρόλος |
|---|---|
| `src/lib/asset-packs/asset-pack-registry.ts` | **SSoT ταυτότητας** — id, version, άδεια, allowlist, URLs |
| `src/lib/asset-packs/asset-pack-access.ts` | **Καθαρή απόφαση** — μηδέν I/O, εξαντλητικά tested |
| `src/lib/asset-packs/asset-pack-guard.server.ts` | Server πύλη — Firestore status + entitlements + RBAC, TTL cache |
| `src/app/api/asset-packs/route.ts` | Manifest — «ποια πακέτα δικαιούμαι» (1 κλήση) |
| `src/app/api/asset-packs/[packId]/[version]/[fileName]/route.ts` | Asset proxy — ο μόνος δρόμος προς τα bytes |
| `src/subapps/dxf-viewer/systems/asset-packs/use-asset-pack-access.ts` | Client hook — session cache, fail-closed |
| `scripts/upload-asset-pack.js` | Upload (η έκδοση διαβάζεται από το registry ⇒ μηδέν drift) |
| `scripts/_shared/storage-uploader.js` | Κοινός uploader (N.18 — το `upload-bim-textures.js` τον χρησιμοποιεί) |
| `storage.rules` | `asset-packs/**` → `allow read: if false` |
| `firestore.rules` | `asset_pack_config/**` → καμία client πρόσβαση |

---

## 7. Επαλήθευση

1. `node scripts/upload-asset-pack.js furniture-plan-2d` → ανεβάζει σε `asset-packs/furniture-plan-2d/v1/`.
2. Παλέτα «Έπιπλα» → τα thumbnails φορτώνουν μέσω `/api/asset-packs/...` (Network tab).
3. Εξαγωγή DXF με έπιπλα → τα rasters στο zip (κανένα σιωπηλό `image-entity:decode-failed`).
4. Kill switch: `asset_pack_config/furniture-plan-2d.status = 'disabled'` → η παλέτα κλειδώνει σε ≤60s, **χωρίς deploy**.
5. `npx jest src/lib/asset-packs` → 23 tests.

---

## 8. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-07-14 | **Αρχική έκδοση.** Asset pack registry + καθαρή απόφαση πρόσβασης + server πύλη (kill switch + per-company entitlement + RBAC `asset_packs:packs:use`) + same-origin proxy + manifest + upload script. Η βιβλιοθήκη ADR-654 μετακόμισε από `furniture-2d-library/` (που ποτέ δεν είχε storage rule) στο `asset-packs/furniture-plan-2d/v1/`. Νέα rate-limit κλάση `ASSET`. Audit `asset_pack.access_denied`. 23 tests. |
