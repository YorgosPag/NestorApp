# ADR-866 — Ο φάκελος του ακινήτου: **ό,τι αφορά το σπίτι μου, σε ένα μέρος — με τον ίδιο κώδικα που χρησιμοποιεί το γραφείο**

| Metadata | Value |
|---|---|
| **Status** | 🟡 **Φ0 ΣΕ ΕΞΕΛΙΞΗ** *(2026-09-17)*: βήμα 1 ✅ SSoT audit (§2.6) + κοινό `lib/workspace/custody-scope.ts` · βήμα 2α ✅ **στρώμα Storage** (ρίζα `people/{userId}` στο `storage-path.ts` + κανόνας `canonical_personal` + σουίτα emulator). **Βήμα 2β** (`FILES_PERSONAL` · `firestore.rules` · `file-custody.ts` · `EntityFilesManager` · υπηρεσίες · δείκτες) **περιμένει το κλείσιμο του ADR-862 Φ0 Β11**. Αποφάσεις Giorgio: ✅ **ΟΛΕΣ** (Ε-1…Ε-6, §9) |
| **Date** | 2026-09-17 |
| **Category** | Files / Identity / Collaboration / Private individual |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Κληρονομεί (ΔΕΝ ξαναποφασίζει)** | **ADR-787 Ε-3** *(ο προσωπικός χώρος δεν έχει `companyId`)* · **ADR-195 + ADR-864 Φ1β** *(προσωπικό βιβλίο ιστορικού — το πρότυπο αυτού του εγγράφου)* · **ADR-862** *(συμμετοχή σε υπόθεση · γενίκευση `PropertyGrant`)* · **ADR-709** *(μία διαδρομή αποθήκευσης)* · **ADR-191** *(σύστημα αρχείων)* · **ADR-777 Α14** *(η αγγελία του ιδιώτη)* · **ADR-742** *(κανόνας αποκάλυψης)* |

> 🎯 **Σε μία πρόταση**: ο ιδιώτης αποκτά για κάθε ακίνητό του **φάκελο** (σχέδια, μελέτες, ΠΕΑ,
> Ηλεκτρονική Ταυτότητα Κτιρίου, τίτλοι, παροχές, ιστορικό) με **τις ίδιες καρτέλες, τον ίδιο κατάλογο
> εγγράφων και την ίδια μηχανή αρχείων** που χρησιμοποιεί ήδη το γραφείο — και δίνει **ονομασμένη,
> ληγμένη, ανακλήσιμη** πρόσβαση σε συμβολαιογράφο, δικηγόρο ή μηχανικό. **Η ΜΟΝΗ δομική αλλαγή είναι
> ότι το σύστημα αρχείων μαθαίνει να ρωτά «ποιανού είναι;» αντί για «ποιας εταιρείας είναι;».**

---

## §0. Τι κατέχει αυτό το έγγραφο — και τι **ΔΕΝ** κατέχει

| Ερώτημα | Έγγραφο |
|---|---|
| **Τι είναι ο φάκελος ακινήτου του ιδιώτη και τι περιέχει** | **εδώ** (§5.1 · §5.3 · §5.4) |
| **Πώς το σύστημα αρχείων δέχεται κάτοχο χωρίς εταιρεία** | **εδώ** (§5.2) |
| **Γιατί οι καρτέλες του γραφείου επαναχρησιμοποιούνται — και ποιες ΟΧΙ** | **εδώ** (§3) |
| Ο μηχανισμός πρόσβασης τρίτου σε υπόθεση | **ADR-862 §5.3** — εδώ μόνο τα **πρότυπα** που λείπουν (§5.6) |
| Η αγγελία πώλησης/ενοικίασης | **ADR-777 Α14** · **ADR-864** |
| Οι καταστάσεις ISO 19650 των αρχείων | **ADR-373** · **ADR-862 Φ0** |
| Το προσωπικό βιβλίο ιστορικού | **ADR-195** · `lib/audit/audit-ledger.ts` |

⛔ **Κανένα αντίγραφο λεξιλογίου εδώ.** Τα είδη εγγράφου ζουν στο `config/upload-entry-points/`, οι
προδιαγραφές ακινήτου στο `PropertySpecificationFields` (`types/property.ts:360`), ο χώρος στο
`WorkspaceRef` (`types/workspace-membership.ts:90`).

---

## §1. Το ερώτημα, όπως τέθηκε *(Giorgio, 2026-09-17)*

> *«Ο απλός ιδιώτης έχει μια κατοικία και θέλει να την πουλήσει. Γιατί να μην μπορεί να καταχωρεί για
> κάθε ακίνητό του **όλα** τα στοιχεία — τοπογραφικό, κατόψεις, αρχιτεκτονικά, στατικά, Η/Μ, αριθμούς
> παροχής ρεύματος και αερίου, ΠΕΑ, Ηλεκτρονική Ταυτότητα Κτιρίου, τα συμβόλαια με τα οποία το απέκτησε,
> ιστορικό — ώστε όταν συμφωνήσει με αγοραστή να δίνει **αμέσως δικαιώματα** στον συμβολαιογράφο ή τον
> δικηγόρο; Ή να βρει μηχανικό για **ρύθμιση αυθαιρέτων** και να τον κατευθύνει εκεί με άδεια.»*

Και η δεύτερη, **καθοριστική** ερώτηση, με 10 στιγμιότυπα της σελίδας «Διαχείριση Ακινήτων» του γραφείου:

> *«Μπορούμε να χρησιμοποιήσουμε **τον ίδιο κώδικα** που ήδη χρησιμοποιούμε στα ακίνητα; Και είναι
> **σωστό** να χρησιμοποιήσουμε τους ίδιους κώδικες; Δηλαδή **SSoT**.»*

---

## §2. SSoT audit — **μετρημένο 2026-09-17**, πριν γραφτεί απόφαση

### 2.1 Οι έξι καρτέλες των στιγμιοτύπων → ποιος κώδικας τις αποδίδει

| Καρτέλα *(στιγμιότυπο)* | Συστατικό | Μηχανή | Δεμένο σε `companyId`; |
|---|---|---|---|
| **Πληροφορίες** — σύνδεση κτιρίου, όροφος, συνδεδεμένοι χώροι, πληρότητα, ταυτότητα μονάδας, εμβαδά | properties-sidebar | `Property` (`types/property.ts:410`) | ναι — και **`buildingId` / `floorId` υποχρεωτικά** |
| **Κάτοψη** — γκαλερί κατόψεων, DXF, «3D Προβολή» | `features/properties-sidebar/components/FloorPlanTab.tsx` | `EntityFilesManager` `displayStyle="floorplan-gallery"` | ναι (prop) |
| **Έγγραφα** — «Τι τύπο εγγράφου θα ανεβάσετε;» (Συμβόλαιο Μονάδας · Πιστοποιητικό · Άδεια · Τιμολόγιο · Συμβόλαιο Μεταβίβασης · Άλλο) | `DocumentsTab.tsx` | `EntityFilesManager` + `entries-property.ts` | ναι (prop) |
| **Φωτογραφίες** — Εσωτερικό · Εξωτερικό · Θέα · Πρόοδος, + «Σειρά φωτογραφιών στη δημόσια αγγελία» | `PhotosTab.tsx` · `ListingMediaOrderPanel.tsx` | `EntityFilesManager` `media-gallery` | ναι (prop) |
| **Βίντεο** — Περιήγηση · Virtual Tour · Drone · Πρόοδος | `VideosTab.tsx` | `EntityFilesManager` | ναι (prop) |
| **Ιστορικό** — ενημερώσεις/δημιουργίες, πεδία, χρήστες | `components/shared/audit/ActivityTab` | `EntityAuditService` | ✅ **ΟΧΙ πια** — δύο βιβλία (§2.4) |

Κοινά σε όλες τις καρτέλες αρχείων: **Αρχεία · Αρχειοθήκη · Κάδος Ανακύκλωσης**, προβολή λίστα/πλέγμα/δέντρο,
ανέβασμα / ηχητική σημείωση / σημείωση κειμένου (`AddCaptureMenu`), εκδόσεις, προεπισκόπηση. **Όλα από
ΕΝΑ συστατικό**: `EntityFilesManager` (`components/shared/files/EntityFilesManager.tsx`, 499 γρ.), με
**17 σημεία απόδοσης** *(μετρήθηκε ξανά στη Φ0, §2.6.4 — έγραφε «20»)* (ακίνητα, κτίρια, έργα, επαφές, αποθήκες, διαχείριση αρχείων). **Το γραφείο είναι
ήδη SSoT.**

### 2.2 🔴 **ΤΟ ΤΕΙΧΟΣ: το σύστημα αρχείων υποθέτει ότι κάθε αρχείο ανήκει σε εταιρεία**

Σε **πέντε** σημεία, μετρημένα:

| # | Σημείο | Τι λέει |
|---|---|---|
| 1 | `services/upload/utils/storage-path.ts` (ADR-709) | *«**companyId is REQUIRED** — System-level paths without company are NOT supported.»* Διαδρομή: `/companies/{companyId}/entities/{entityType}/{entityId}/domains/…/files/{fileId}.{ext}` |
| 2 | `storage.rules:111 · 152` | κάθε κανονική διαδρομή ξεκινά `/companies/{companyId}/` με `belongsToCompany` |
| 3 | `firestore.rules:589` `match /files/{fileId}` | `allow read`: `belongsToCompany(resource.data.companyId)` · `allow create`: `companyId == getUserCompanyId()` |
| 4 | `EntityFilesManagerProps.companyId: string` | **υποχρεωτικό** prop |
| 5 | `hooks/useEntityFiles.ts:236` | `if (!realtime || !entityId || !companyId) return;` — χωρίς εταιρεία **δεν ακούει τίποτα** |

Και ο ιδιώτης **δεν έχει και δεν επιτρέπεται να αποκτήσει** `companyId`: **ADR-787 Ε-3 §3** — ο τύπος
`PersonalWorkspaceRef` **δεν έχει το πεδίο**, *«η παράβαση δεν χτίζει»*.

### 2.3 🔴 **Η ΣΥΝΕΠΕΙΑ ΠΟΥ ΗΔΗ ΣΥΝΕΒΗ: δεύτερος αγωγός αρχείων για τον ιδιώτη**

`hooks/owner-property/useOwnerPropertyMedia.ts` — γράφει **ευθέως** στο Firebase Storage, στο
`owner_properties/{userId}/{ownerPropertyId}/{fileName}` (`storage.rules:504`), και κρατά τα αρχεία ως
**πίνακα** `media[]` **μέσα** στο έγγραφο `OwnerProperty` — **όχι** ως `FileRecord`. Το σχόλιό του το
λέει με ειλικρίνεια: *«ο υπάρχων αγωγός είναι **δομικά αδύνατος** για τον ιδιώτη… Άρα **δεν γράφτηκε
δεύτερος αγωγός — γράφτηκε άλλο σύνορο**»*.

Ήταν **σωστή απόφαση για την Α14** (μια φωτογραφία στην αγγελία). **Δεν κλιμακώνεται σε φάκελο**:
ο ιδιώτης σήμερα **δεν** έχει κατάλογο ειδών εγγράφου, αρχειοθήκη, κάδο, εκδόσεις, προεπισκόπηση DXF,
κατάσταση CDE, ίχνος ανά αρχείο, ούτε δυνατότητα να δοθεί πρόσβαση ανά αρχείο. Κάθε ένα από αυτά
**υπάρχει ήδη** στο `EntityFilesManager`. Να τα ξαναγράψουμε δίπλα στο `useOwnerPropertyMedia` θα ήταν
ακριβώς το σχήμα του **ADR-749** (τέσσερις υλοποιήσεις, τρεις αριθμοί).

⚠️ **Και υπάρχει ΤΡΙΤΗ διαδρομή, για την ίδια οντότητα**: `components/mandate/AttestationDocumentField.tsx`
ανεβάζει στο `owner_property` **μέσω του κανονικού αγωγού** — αλλά με το `companyId` **του μεσιτικού
γραφείου**. Δηλαδή το **ίδιο** ακίνητο έχει σήμερα αρχεία σε **δύο** αποθηκευτικούς χώρους, με **δύο**
μοντέλα δεδομένων, ανάλογα με το **ποιος** ανέβασε.

### 2.4 ✅ **ΤΟ ΠΡΟΗΓΟΥΜΕΝΟ ΠΟΥ ΛΥΝΕΙ ΤΟ ΤΕΙΧΟΣ — γράφτηκε πριν από μία μέρα, και δουλεύει**

Το **ίδιο ακριβώς** τείχος υπήρχε στο ιστορικό: ως τις 2026-09-16 κάθε εγγραφή του
`entity_audit_trail` έφερε **υποχρεωτικά** `companyId` ⇒ ο ιδιώτης **δεν μπορούσε να έχει ιστορικό**.
Λύθηκε στο `lib/audit/audit-ledger.ts` (ADR-195 · ADR-864 Φ1β) **χωρίς δεύτερο σύστημα**:

```ts
type AuditLedgerScope =
  | { companyId: string; userId?: never }   // βιβλίο εταιρείας — ό,τι ίσχυε πάντα
  | { userId: string;   companyId?: never } // προσωπικό βιβλίο

auditLedgerScopeOf(workspace: WorkspaceRef)  // η ΜΙΑ μετάφραση χώρου → βιβλίου
AUDIT_LEDGER_COLLECTION = { company: 'ENTITY_AUDIT_TRAIL', personal: 'ENTITY_AUDIT_TRAIL_PERSONAL' }
```

- **~88 υπάρχοντες καλούντες ανέγγιχτοι** — είναι ήδη το μέλος «εταιρεία» της ένωσης.
- **Ένας** αναγνώστης (`ActivityTab`): η **ίδια** καρτέλα «Ιστορικό» των στιγμιοτύπων αποδίδεται **ήδη**
  στη σελίδα του ιδιώτη (`components/owner-property/OwnerPropertyHistory.tsx:36`).
- **Διαμέρισμα ανά βιβλίο**, όχι διακλάδωση μέσα σε μία συλλογή — γιατί *«οι κανόνες Firestore δεν
  φιλτράρουν»*: ένα αφιλτράριστο ερώτημα του super admin θα απορριπτόταν ολόκληρο.

⇒ **Η μία από τις έξι καρτέλες είναι ΗΔΗ κοινή για γραφείο και ιδιώτη.** Αυτό το έγγραφο εφαρμόζει
το **ίδιο** σχήμα στις υπόλοιπες τέσσερις που είναι αρχεία.

### 2.5 Τι **λείπει** — μετρημένο ως απουσία

| Ικανότητα | Αναζήτηση | Αποτέλεσμα |
|---|---|---|
| Είδος εγγράφου **ΠΕΑ** ως χωριστή θέση | `entries-property.ts` | **όχι** — υπάρχει γενικό «Πιστοποιητικό» (*«Ενεργειακό πιστοποιητικό, πιστοποιητικό ιδιοκτησίας, κτλ.»*) |
| **Ηλεκτρονική Ταυτότητα Κτιρίου** (πεδίο ή θέση) | `Ηλεκτρονική Ταυτότητα` σε locales · `electronicBuilding*` | **0** |
| **Αριθμοί παροχής** ρεύματος / αερίου / νερού | `supplyNumber` · `meterNumber` · `Αριθμός Παροχής` | **0** δομημένα πεδία |
| Τοπογραφικό · τίτλος · κτηματογράφηση · στατικά · Η/Μ | `entries-studies.ts` | ✅ **υπάρχουν** — αλλά σε επίπεδο **μελετών έργου**, όχι ακινήτου |
| Στοιχεία ΠΕΑ ως πεδία | `PropertySpecificationFields.energy` (`types/property.ts:380`) | ✅ **υπάρχουν** — `class · certificateId · certificateDate · validUntil` |
| Αρχεία ιδιώτη ως `FileRecord` | — | **0** (§2.3) |
| Πρόσβαση τρίτου σε ακίνητο | `PropertyGrant` (`lib/auth/types.ts:470`) | **νεκρό** — η γενίκευσή του είναι **ADR-862 Φ1**, δεν έχει υλοποιηθεί |
| Πρότυπο συμμετοχής **νομικού** (συμβολαιογράφος/δικηγόρος) | ADR-862 §5.4 | **όχι** — τα πρότυπα είναι `consultant · crew · supplier · client` |
| **Οικοδεσπότης** υπόθεσης = προσωπικός χώρος | ADR-862 | **δεν εξετάστηκε** — το έγγραφο υποθέτει οργανισμό-οικοδεσπότη |

### 2.6 🔎 SSoT audit **Φ0** — μετρημένο 2026-09-17 με grep, **πριν** τον κώδικα *(N.0.1 Φάση 1)*

🔴 **Κατάσταση εκκίνησης**: το ADR-862 Φ0 **Β11 δεν έχει κλείσει** — ο άλλος agent αλλάζει τώρα `firestore.rules`,
`file-record-core.ts`, `file-record-ingestion.ts`, `types/file-record.ts`, `firestore-collections.ts`, `tenant-config.ts`,
`firestore-query.service.ts` και γράφει νέο **μοντέλο ανάγνωσης** αρχείων (`cdeReadReach` · `read-scope-config.ts` ·
`file-visibility-scope.ts`). ⇒ Η Φ0 ξεκίνησε **μόνο** από ό,τι δεν συγκρούεται (§12, βήμα 1).

#### 2.6.1 Το τείχος — **επτά** σημεία, όχι πέντε

| # | Σημείο | Εύρημα |
|---|---|---|
| 1-5 | §2.2 | ✅ **ισχύουν ακόμη** (επαληθεύτηκαν: `storage-path.ts:73-75,136` · `storage.rules:111,152` · `firestore.rules:589` · `EntityFilesManager.tsx:77-106` · `useEntityFiles.ts:236`) |
| **6** 🆕 | `services/file-record/file-record-core.ts:327` `buildPendingFileRecordData` | **πετά** χωρίς `companyId` — είναι το **χωνί** από το οποίο περνά **κάθε** ανέβασμα (`uploadEntityFile` · `FileRecordService.createPendingFileRecord` · `AttestationDocumentField`). Η αλλαγή **εδώ** αρκεί για όλους τους αγωγούς |
| **7** 🆕 | `services/filesystem/file-mutation-gateway.ts:47-97` `validateUploadAuth` | διαβάζει `companyId` από το **claim** ⇒ `UPLOAD_AUTH_MISSING_COMPANY` για τον ιδιώτη, **πριν** φτάσει στο σημείο 6 |

#### 2.6.2 Καλούντες που δέχονται `companyId` — η διαδρομή οντότητας

| Αρχείο | Πώς μπαίνει το `companyId` |
|---|---|
| `services/filesystem/upload-entity-file.ts:40,75` | `EntityFileUploadSpec.companyId` υποχρεωτικό |
| `services/file-record.service.ts:107,157,205,275` | παράμετρος (`CreateFileRecordInput`) |
| `services/file-record-lifecycle.ts:266,285` | παράμετρος → `where('companyId','==',…)` (κάδος · αρχειοθήκη) |
| `services/file-record-links.ts` · `file-version.service.ts` · `file-folder.service.ts` · `file-audit.service.ts` | client SDK πάνω στη συλλογή `files` |
| `api/files/archive` · `api/files/cde/*` | `_shared/file-ownership.ts:57` → `isOwnedByCompany` (claim ↔ πεδίο εγγράφου) |
| `services/iso19650/*` | πεδίο του φορτωμένου `FileRecord` — **δεν** ξαναπαράγεται |

- `COLLECTIONS.FILES` αναφέρεται σε **~120** σημεία (διακομιστής, πελάτης, AI pipeline, migrations, Telegram, email,
  floorplans, DXF). ⚠️ **Η Φ0 ΔΕΝ τα αγγίζει όλα**: μόνο τη διαδρομή οντότητας (`EntityFilesManager` → `useEntityFiles` →
  υπηρεσία → gateway → χωνί). Τα υπόλοιπα είναι εταιρικά **εξ ορισμού** (εισερχόμενα γραφείου, AI γραφείου).
- 🔴 **Διόρθωση §5.8**: `api/files/purge` = **καθολική** σάρωση `isDeleted + purgeAt` και `api/files/gdpr-delete` = φίλτρο
  `createdBy`. **Δεν** «δέχονται `FileCustody`» — πρέπει να **σαρώνουν και τα δύο διαμερίσματα**, όπως το
  `incremental-backup.service.ts` σαρώνει `AUDIT_LEDGER_KINDS`.

#### 2.6.3 Κανόνες · συλλογές · δείκτες · backup · πύλες

| Θέμα | Εύρημα | Συνέπεια για τη Φ0 |
|---|---|---|
| `firestore-collections.ts:416` | `FILES` | νέο `FILES_PERSONAL` **δίπλα**, όπως το `ENTITY_AUDIT_TRAIL_PERSONAL` (γρ. 661)· **όχι** στο `IMMUTABLE_COLLECTIONS` (τα αρχεία αλλάζουν) |
| `tenant-config.ts` | `FILES` **χωρίς** εγγραφή (κληρονομεί `companyId`)· πρότυπο `ENTITY_AUDIT_TRAIL_PERSONAL: { mode: 'userId' }` (γρ. 69) | **μία** γραμμή `FILES_PERSONAL` ενεργοποιεί την **CHECK 3.35** για κάθε ερώτημα διακομιστή |
| `firestore.rules:589-844` | `match /files` — σχόλιο 616-619: *ποτέ δεύτερο `match /files`* (το Firestore ενώνει) | ✅ επιβεβαιώνει «διαμέρισμα, όχι διακλάδωση» |
| `firestore.rules:626-633` `cdeCustodyUnchanged()` | **τοπική** μέσα στο μπλοκ `files` | 🔴 για να την **κληρονομήσει** το `files_personal` πρέπει να **ανέβει** σε καθολική συνάρτηση — **όχι** αντίγραφο (§5.2) |
| `firestore.rules:3392-3396` | `entity_audit_trail_personal`: `userId == request.auth.uid`, ούτε super admin | πρότυπο ανάγνωσης του `files_personal` |
| `storage.rules:44-46 · 504` | `isOwner(userId)` · `owner_properties/{userId}/…` (read/write/delete `isOwner` + `isValidFileSize` + `isAllowedContentType`) | ιδίωμα της ρίζας `/people/{userId}/entities/…` |
| `firestore.indexes.json` | **44** δείκτες `files` — πολλοί **ήδη σε ζεύγη** `companyId`/`createdBy`· **0** για `files_personal` | τα ίδια σχήματα με πρώτο πεδίο `userId` — **παράγονται** από τα ερωτήματα, όχι με το χέρι |
| Backup | `backup.service.ts` παράγει το σύμπαν από `COLLECTIONS`· `incremental-backup.service.ts` απαριθμεί **μόνο** τα βιβλία ιστορικού | αρκεί η εγγραφή στο `COLLECTIONS` |
| CHECK 3.16 | `tests/firestore-rules/_registry/coverage-manifest.ts` + `defineMatrix()` (35 κελιά) | νέα εγγραφή· ο `serverWrittenAuthorOwnedMatrix` **δεν** ταιριάζει (τα αρχεία γράφονται **από πελάτη**) |

#### 2.6.4 Καταναλωτές · αγωγοί · προϋπάρχουσα λύση

- **`EntityFilesManager`: 17 σημεία απόδοσης JSX** (`grep -rl "<EntityFilesManager"`), + 15 αναφορές σε σχόλια/ρυθμίσεις —
  **όχι 20** (διορθώνει §2.1 · §10).
- Δεύτερος αγωγός (`useOwnerPropertyMedia`): Storage απευθείας, **κανένα** `FileRecord` — ✅ επιβεβαιώθηκε.
  Τρίτος (`AttestationDocumentField.tsx:38-70`): `uploadEntityFile` με `companyId` **του γραφείου** — ✅ επιβεβαιώθηκε.
- `FileCustody` · `fileCustodyOf` · `files_personal` · `FILES_PERSONAL` · `personal` στο σύστημα αρχείων: **0** ευρήματα.

#### 2.6.5 🔑 Εύρημα σχεδιασμού — το «ίδιο σχήμα» θα ήταν **δίδυμο**

Το §5.2 ζητούσε `file-custody.ts` «ίδιο σχήμα με `audit-ledger.ts`». Κατά γράμμα: **ίδια** ένωση `?: never`, **ίδιο**
`…Of(WorkspaceRef)`, **ίδιο** σύνορο ανάγνωσης, **ίδιος** φρουρός γραφής, **ίδιο** λεξιλόγιο `'company' | 'personal'` σε
**δεύτερο** αρχείο ⇒ κλώνος (CHECK 3.28) και δεύτερη δήλωση λεξιλογίου (CHECK 3.73). **Λύση**: το πρωτογενές
**εξήχθη** στο `lib/workspace/custody-scope.ts`· κάθε σύστημα (ιστορικό, αρχεία) δηλώνει **μόνο** το δικό του
`CustodyPartition` (πού ζει κάθε διαμέρισμα). Τα `lib/audit/*` ήταν **καθαρά** στο git — ασφαλής αναδιάρθρωση.

#### 2.6.6 🌐 Έρευνα — πώς χωρίζουν οι μεγάλοι «προσωπικό» και «οργανισμού» *(2026-09-17)*

| Παίκτης | Εύρημα | Τι παίρνουμε |
|---|---|---|
| **Google Drive** | κάθε αρχείο ζει σε **ακριβώς ένα** δίσκο — «Ο Δίσκος μου» (κάτοχος **άνθρωπος**) **ή** κοινόχρηστος δίσκος (κάτοχος **οργανισμός**), **ποτέ** και στα δύο· ο χώρος μετρά στο όριο **του κατόχου**· η μετακίνηση σε κοινόχρηστο δίσκο **αλλάζει τον κάτοχο** | ✅ `?: never` · ✅ όριο ανά κάτοχο (Ε-2) · 🔑 η **παράδοση** της §5.7 (Φ4) είναι **μετακίνηση** μεταξύ διαμερισμάτων, όχι αντιγραφή |
| **Figma** | τα **Drafts** είναι ιδιωτικά· ο admin **δεν** τα βλέπει· μόνο ο κάτοχος τα μετακινεί σε ομάδα (στα Organization plans ο οργανισμός μπορεί να τα διεκδικήσει όταν φύγει το μέλος) | ✅ «ούτε super_admin» (§5.8)· ο ιδιώτης **δεν** ανήκει σε οργανισμό, άρα καμία διεκδίκηση |

*Πηγές*: [Google Drive API — Shared drives overview](https://developers.google.com/workspace/drive/api/guides/about-shareddrives) ·
[Shared drive vs My Drive API differences](https://developers.google.com/workspace/drive/api/guides/shared-drives-diffs) ·
[Figma — Updates to how drafts work](https://help.figma.com/hc/en-us/articles/18409526530967-Updates-to-how-drafts-work) ·
[Figma — Transfer ownership of files](https://help.figma.com/hc/en-us/articles/360038512093-Transfer-ownership-of-files-or-folders).

#### 2.6.7 🔎 Ξαναμέτρηση **μετά** το ADR-862 Β11 + Β14 *(2026-09-17, βήμα 2β, πριν τον κώδικα — HEAD `dd5bf4ee`)*

Το audit §2.6.1-2.6.5 έγινε **πριν** το Β11. Ξαναμετρήθηκε με grep αφού ο Giorgio έκανε commit **και** το Β11 **και** το
Β14 (στοίβα εκδόσεων, `container-custody.ts`, CHECK 3.87 · 3.88), που επίσης άγγιζε το σύστημα αρχείων.

| # | Θέμα | Εύρημα (μετρημένο) | Συνέπεια για το βήμα 2β |
|---|---|---|---|
| 1 | **Μοντέλο ανάγνωσης `FILES`** | `firestoreQueryService` ⇒ `buildLeadingPaths` = μισθωτής × `READ_PATHS` (`read-scope-config.ts`) ⇒ **ένωση δύο δρόμων** (`cdeReadReach == 'tenant'` ∪ `createdBy == uid`, `firestore-read-paths.ts`). `READ_PATH_FIELDS` τροφοδοτεί το CHECK 3.15 | 🔑 Το `FILES_PERSONAL` **ΔΕΝ** μπαίνει στα `READ_PATHS`: η γραμμή `tenant-config` `mode: 'userId'` παράγει ήδη `where('userId','==',uid)` (`resolveTenantValue`) — **ένας** δρόμος, ακριβώς όσο ζητά ο κανόνας. Επέκταση με **δεδομένα**, μηδέν νέος κώδικας ανάγνωσης |
| 2 | **Κανόνας `files`** | `cdeCustodyUnchanged()` ακόμη **τοπική** (`firestore.rules:626`), πλέον με `cdeReadReach`· `get`/`list` χωριστά· `create` απαιτεί `cdeReadReach` **σύμφωνο** με το `cdeState` | ανεβαίνει σε καθολική (§5.2 #9)· το `files_personal` **δεν** κληρονομεί τον φράχτη `cdeReadReach` (ένας αναγνώστης = ο κάτοχος) |
| 3 | 🔴 **Τυφλό σημείο στατικών πυλών** | `check-firestore-index-coverage.js:266`: κλειδί συλλογής **μόνο** ως string literal, αλλιώς `null`. Το ιστορικό διαβάζει **ήδη** με `AUDIT_LEDGER_COLLECTION[kind]` σε 4 σημεία ⇒ **αόρατο** στην 3.15 | Αν τα ερωτήματα αρχείων γραφτούν `FILE_COLLECTION[kind]`, ελλείπων δείκτης `files_personal` = **πράσινο** στην πύλη, `FAILED_PRECONDITION` στην παραγωγή. Πρόταση: ο AST αναγνώστης λύνει αναζητήσεις `CustodyPartition` σε **και τους δύο** κλάδους (καλύπτει αρχεία **και** ιστορικό). Επαληθεύεται και για 3.35 · 3.87 (`FILES_REFERENCE` πιάνει το literal `'FILES'` μέσα στο `FILE_COLLECTION`) |
| 4 | **Γέννηση** | `file-record-core.ts:328` πετά χωρίς `companyId`· `:388` γράφει **πάντα** `cdeReadReach: BIRTH_READ_REACH` (`'tenant'`) | σε προσωπικό αρχείο το `'tenant'` είναι **ψευδές** (δεν υπάρχει μισθωτής) ⇒ απόφαση Ε-Φ0-1 |
| 5 | **Διαδρομές διακομιστή του Β14** | `iso19650/version-stack.ts` (`readOwned(companyId)`, `where('companyId')`) · `api/files/[fileId]/versions` · `…/cde` · `_shared/file-ownership.ts` `isOwnedByCompany` — **όλα** μόνο εταιρεία, μόνο `COLLECTIONS.FILES` | για προσωπικό αρχείο απαντούν ήδη **404** (fail-closed)· συνδέεται με Ε-Φ0-1 |
| 6 | **N.7.1 (500 γρ.)** | `EntityFilesManager.tsx` **499** · `file-record-core.ts` **495** · `useEntityFiles.ts` **492** | **εξαγωγή πριν** την προσθήκη, και στα τρία |
| 7 | Επαληθεύσεις §2.6 | `<EntityFilesManager`: 18 αρχεία = **17** αποδόσεις + το ίδιο το component ✅ · `purge`/`gdpr-delete` μία συλλογή ✅ · `COLLECTIONS.FILES`: **127** εκτός tests (ήταν ~120) · `files_personal`/`FILES_PERSONAL`/`FileCustody` στον κώδικα: **0** — μόνη εμφάνιση το `shouldSkip` του `pattern-proofs.js` (επιτρεπτό ψευδώνυμο ⇒ το `file-custody.ts` **δεν** μπλοκάρεται από το module `custody-scope`) | — |
| 8 | Λεξιλόγιο | `iso19650/container-custody.ts` (Β14) λέει «custody» = **σφράγιση έργου/ομάδας CDE**, όχι «κάτοχος εταιρεία/άνθρωπος» | **όχι** διπλότυπο· αμφίδρομη σημείωση στις κεφαλίδες ώστε να μη συγχέονται |

🔶 **Ε-Φ0-1 — Μπαίνει το προσωπικό αρχείο στη ροή CDE;** *(αναμένει Giorgio)* Πρόταση: **όχι στη Φ0** — ο builder **δεν** γράφει
κανένα `cde*` για προσωπικό κάτοχο, το καθολικό `cdeCustodyUnchanged()` απαγορεύει στον πελάτη να τα προσθέσει, οι διαδρομές
εκδόσεων/CDE μένουν 404 και το UI κρύβει τις ενέργειες. *Γιατί*: το ISO 19650 περιγράφει ροή **ομάδων έργου** με appointing
party· το «Ο Δίσκος μου» του Google Drive δεν έχει ροή έγκρισης. Επανεξετάζεται στη Φ4 (παράδοση = μετακίνηση διαμερίσματος).

#### 2.6.8 🔎 SSoT audit **βήματος 2β.2** — γέννηση · λίστα · κάδος *(2026-09-17, πριν τον κώδικα — HEAD `9bd6229f`, 2β.1 ακόμη χωρίς commit)*

Ξαναμετρήθηκε με grep ο χάρτης του handoff 2β.2. **Ο κώδικας κερδίζει** — οι διορθώσεις σημειώνονται.

**Α. Επαληθεύσεις**

| Μέτρηση | Αποτέλεσμα |
|---|---|
| `FILE_COLLECTION` · `FileCustody` · `fileCollectionOf` στο `src` | **0** κώδικας — μόνο σχόλιο (`firestore-collections.ts:438`), πύλες 3.87/3.15 (2β.1) και `pattern-proofs.js` ✅ |
| `<EntityFilesManager` | 18 αρχεία = **17** αποδόσεις + το component ✅ — όλες εταιρικές |
| `COLLECTIONS.FILES` / `'FILES'` εκτός tests | **128** (ήταν 127) — η Φ0 αγγίζει **μόνο** τη διαδρομή οντότητας |
| Μεγέθη (N.7.1) | `EntityFilesManager.tsx` **499** · `file-record-core.ts` **495** · `useEntityFiles.ts` **492** · `TrashView.tsx` **475** 🆕 · `firestore-query.service.ts` 488 (**`services/firestore/`**, όχι `services/`) · `file-mutation-gateway.ts` 436 · `file-record-lifecycle.ts` **336** 🔁 (ήταν 395) |
| Αρχεία του άλλου agent **ακόμη `M`** | `purge` · `gdpr-delete` (⛔ δεν αγγίζονται) · `file-record-lifecycle.ts` · `file-record.service.ts` · `types/file-record.ts` · `file-purge-helpers.ts` · νέο `lib/files/file-hold.ts` — ADR-864 §21 **αφαίρεσε** `placeHold`/`releaseHold` από τον πελάτη (δέσμευση = μόνο διακομιστής). Στα τρία πρώτα **μόνο δικές μας γραμμές** ⇒ το commit τους θα είναι μικτό (απόφαση Giorgio) |

**Β. 🆕 Ευρήματα που αλλάζουν τον σχεδιασμό**

| # | Εύρημα (μετρημένο) | Συνέπεια |
|---|---|---|
| Β1 | 🔑 Το `firestoreQueryService` (`buildTenantConstraints`) **ήδη** βάζει το φίλτρο κατόχου: `companyId` μέσω `resolveEffectiveCompanyId`, `userId` μέσω `resolveTenantValue` για `FILES_PERSONAL` | Για προσωπικό κάτοχο **κανένα** χειρόγραφο `where('userId')` — το βάζει η υπηρεσία. Τα χειρόγραφα `where('companyId')` (realtime `useEntityFiles:245`, `getFilesByEntity:146`, κάδος/αρχειοθήκη) **μένουν** μόνο στον εταιρικό κλάδο: καλύπτουν τον super admin χωρίς επιλεγμένη εταιρεία (η υπηρεσία τότε **δεν** φιλτράρει) |
| Β2 | `buildPendingFileRecordData`: **5** καλούντες παραγωγής — πελάτης (`FileRecordService`) **και** 4 διακομιστή μόνο-εταιρικοί (`floorplan-backgrounds.handlers` · `model-file-record` · `version-promotion(-policy)`)· το `FileRecordBase` διαβάζεται από `properties/[id]/model` | **Overloads** (όχι διεύρυνση): είσοδος `CustodyScope & συντεταγμένες` (ίδιο ιδίωμα με το `StoragePathParams` του 2α)· εταιρική είσοδος ⇒ εταιρικό αποτέλεσμα με `companyId: string` + `cdeReadReach`, οι 4 καλούντες **ανέγγιχτοι** · προσωπική ⇒ `userId`, **κανένα** πεδίο του `cdeCustodyKeys()` |
| Β3 | `validateUploadAuth`: **6** καλούντες, επιστρέφει `companyId: string` (το `useCrmAttachmentUpload` το διαβάζει) | **Δεν** αλλάζει υπογραφή. Νέο `validateCustodyUploadAuth(custody)` **στο ίδιο αρχείο**: εταιρεία ⇒ **καλεί** το `validateUploadAuth` (μηδέν δεύτερη λογική) · άνθρωπος ⇒ `custody.userId === auth.uid`, κανένα claim, **ούτε** παράκαμψη super admin |
| Β4 | Πράξεις που παίρνουν **μόνο `fileId`** (κάδος · επαναφορά · μετονομασία · περιγραφή · σύνδεση/αποσύνδεση · οριστικοποίηση · αποτυχία): **~32** σημεία κλήσης | Ο καλών δίνει **υποχρεωτικό** `CustodyKind` ⇒ ο μεταγλωττιστής βρίσκει κάθε καλούντα. **Πηγή** του είδους σε λίστα = **το ίδιο το έγγραφο** (`custodyScopeFromData(file)` — `null` ⇒ άρνηση, ποτέ μαντεψιά), όχι το prop της οθόνης: το αρχείο **αποδεικνύει** το διαμέρισμά του |
| Β5 | `getFilesByEntity`: **14** καλούντες. 🔁 *Διόρθωση στην υλοποίηση*: **12** δίνουν `companyId`, όχι 4 (το πρώτο grep κοίταξε 3 γραμμές μετά την κλήση· 7 σημεία στις υπηρεσίες κατόψεων έχουν το όρισμα πιο κάτω) | Η επιλογή `companyId?` γίνεται `custody?: FileCustody` (12 καλούντες, `companyReadCustodyOf` όπου το id μπορεί να λείπει). **Απουσία ⇒ εταιρεία** — ίδιο δόγμα με το `custodyKindFromParam` για **αναγνώστες**· οι 10 υπόλοιποι ανέγγιχτοι. Λάθος διαμέρισμα σε ανάγνωση = κενό/άρνηση (fail-closed) |
| Β6 | Διαδρομές **διακομιστή** μόνο-`FILES` που φτάνει το `EntityFilesManager`: **λήψη** (`api/download` → `loadOwnedFileBytes` → `fileResource`) · batch-download · αρχειοθέτηση · AI ταξινόμηση · διάδοση μετονομασίας · εκδόσεις | Προσωπικό ⇒ το UI **κρύβει** AI/ταξινόμηση/αρχειοθέτηση/ISO 19650/έγκριση/κοινοποίηση/σχόλια (έννοιες γραφείου). 🔶 **Λήψη**: η προεπισκόπηση δουλεύει (`downloadUrl` + κανόνας Storage `people/`), το κουμπί λήψης όμως θα έπαιρνε **404** ⇒ μπαίνει στο **2β.3** μαζί με το `fileResource` ανά διαμέρισμα (ίδια αλλαγή) — **δηλωμένο κενό**, όχι παράκαμψη |
| Β7 | `FileAuditService.log` ψάχνει `companyId` στο έγγραφο **`files`** — ο κάδος/η επαναφορά το καλούν fire-and-forget | Για προσωπικό αρχείο θα διάβαζε **λάθος συλλογή** και θα έγραφε γραμμή χωρίς κάτοχο ⇒ **δεν** καλείται για προσωπικό κάτοχο ως το **2β.4** (δηλωμένο) |
| Β8 | Δραστηριότητα (`useFileAudit`): μόνο `property`/`contact` — ένα προσωπικό είδος οντότητας **δεν** γράφει τίποτα | Καμία αλλαγή· 2β.4 |
| Β9 | Δέσμευση (ADR-864 §21, άλλος agent): `file-hold.service` = διακομιστής, μόνο `FILES` | Η νομική δέσμευση είναι έννοια **οργανισμού** (Google Vault δεσμεύει μόνο λογαριασμούς που διαχειρίζεται ο οργανισμός) ⇒ **δεν εφαρμόζεται** σε προσωπικό αρχείο — δηλωμένο όριο. Η εκκαθάριση προσωπικών περιμένει το commit των `purge`/`gdpr-delete` |
| Β10 | `file-folder.service` (`FILE_FOLDERS`, μόνο εταιρεία): το `FolderManager` **δεν αποδίδεται πουθενά** | **Εκτός** διαδρομής προσωπικού — καμία αλλαγή |
| Β11 | 🧹 `updateFileClassificationWithPolicy` γράφει ωμό `doc(db, 'files', …)` | Boy Scout → `COLLECTIONS.FILES` (η δημοσιοποίηση ADR-845 είναι πράξη **γραφείου**· κρυμμένη για προσωπικό) |
| Β12 | Άγκυρα `useEntityFiles-realtime.test.tsx` περνά `companyId` | Ενημερώνεται στο `custody`, + περίπτωση προσωπικού (καμία χειρόγραφη `where('companyId')`, συλλογή `FILES_PERSONAL`) |

**Γ. Απορριφθείσες εναλλακτικές για το Β4** — (α) **είδος μέσα στο `fileId`** (π.χ. πρόθεμα): η θεματοφυλακή **αλλάζει** στη Φ4 (παράδοση = μετακίνηση) ενώ η ταυτότητα και η διαδρομή Storage είναι **αμετάβλητες** — το Google Drive κρατά το ίδιο id όταν αρχείο μετακινείται σε κοινόχρηστο δίσκο· (β) **«δοκίμασε και τις δύο συλλογές»**: διπλή ανάγνωση, αγώνας δρόμου, και ο κανόνας `files` σε ανύπαρκτο έγγραφο απαντά **άρνηση**, όχι «δεν υπάρχει» — θα έκρυβε αληθινά σφάλματα· (γ) **προεπιλογή `company`** σε πράξη εγγραφής: ο ξεχασμένος προσωπικός καλών θα αποτύγχανε **σιωπηλά** πίσω από fire-and-forget, αντί να μη μεταγλωττίζεται. *Αντίστοιχο στους μεγάλους*: στο Drive API ο καλών **δηλώνει** ότι υποστηρίζει κοινόχρηστους δίσκους (`supportsAllDrives`) — δεν το μαντεύει ο διακομιστής.

#### 2.6.9 🔎 SSoT audit **βήματος 2β.3** — λήψη · εκκαθάριση · ΓΚΠΔ *(2026-09-17, πριν τον κώδικα — HEAD `ceadd529`)*

⚠️ **Εμβέλεια σπασμένη σε δύο, με λόγο.** Στο `git status` της αρχής, άλλος agent είχε **χωρίς commit** το ADR-862 §5.3.7
(«καθεστώς δοχείου»: νέα `container-regime-policy.ts` + `container-transition-vocabulary.ts`, και `writeSuccession()` στο
`container-transitions.ts`, που γράφει **μόνο** διαδοχή). Είναι ακριβώς το σημείο 1 του 2β.3, στα **ίδια** αρχεία και με ρητή
σημείωση *«όταν ο γραφέας διαβάσει και το `files_personal` (ADR-866 2β.3), ο λόγος προστίθεται εδώ»*. Δύο agents στις ίδιες
συναρτήσεις **δεν** λύνεται με «μόνο δικές σου γραμμές» ⇒ **Giorgio (επιλογή 2)**: τώρα γίνονται **λήψη + εκκαθάριση/ΓΚΠΔ**.
Εκδόσεις · γραφέας · πολιτική · προβιβασμός μένουν για **μετά το commit** του §5.3.7 (**2β.3β**).

**Α. Επαληθεύσεις (μετρημένες)**

| Μέτρηση | Αποτέλεσμα |
|---|---|
| Καλούντες `fileResource` | **8** σημεία παραγωγής: `owned-file-bytes` (→ 3 διαδρομές bytes) · `archive` · `excel-preview` · `container-route-responses` (→ `versions` · `cde`) · `floorplans/process` · `floorplans/scene`. Μόνο η **αλυσίδα bytes** είναι στη διαδρομή του προσωπικού αρχείου σε αυτό το βήμα |
| Καλούντες `loadOwnedFileBytes` | **3** διαδρομές: `api/download?fileId` · `files/[fileId]/download` · `files/batch-download` — όλες `withAuth({ permissions: 'dxf:files:view' })` |
| Καλούντες `purgeFileRecord` | **3** (όχι 1): `api/files/purge` · `lib/cron/jobs/file-purge.job` · AI `file-lifecycle-handler` (`discard_pending_file`) |
| Καλούντες `isFileHeld` | purge · job · AI · `gdpr-delete` · `deletion-guard` — ✅ ασφαλές σε προσωπικό έγγραφο (χωρίς πεδία ⇒ `false`)· επιπλέον ο άλλος agent **έκλεισε** τα πεδία δέσμευσης και στο `files_personal` (ADR-864 §21.8), άρα ο κριτής **ισχύει** και εκεί — δεν αφαιρείται |
| Client λήψης | `downloadFileByIdWithPolicy` (1 καλών: `useFileDownload`, με 7 καταναλωτές) · `batchDownloadFilesWithPolicy` (1: `downloadFilesAsZip`, με 2 καλούντες: `useBatchFileOperations` · `file-manager-handlers`) |
| Μεγέθη (N.7.1) | `owned-file-bytes.ts` 166 · `api/download` 263 · `[fileId]/download` 138 · `batch-download` 183 · `purge` 117 · `gdpr-delete` 167 · `gdpr-export` 154 · `file-purge-helpers.ts` 137 · `file-purge.job.ts` 185 · `file-mutation-gateway.ts` **482** · `EntityFilesManager.tsx` **486** · `FilePreviewPanel.tsx` 403 · `useBatchFileOperations.ts` 306 |

**Β. 🆕 Ευρήματα που αλλάζουν τον σχεδιασμό**

| # | Εύρημα (μετρημένο) | Συνέπεια |
|---|---|---|
| Β1 | 🔴 **Ο πολίτης δεν περνά καν την πόρτα**: οι 3 διαδρομές bytes είναι `withAuth` + ικανότητα εταιρείας ⇒ δρων χωρίς οργανισμό παίρνει άρνηση **πριν** φτάσει στο `fileResource`. Το ίδιο και τα `gdpr-delete`/`gdpr-export` (`withAuth` χωρίς ικανότητα) | Η λύση **υπάρχει**: `withPersonalOrOrgAuth` (ADR-817) + `?ledger=` του ιστορικού (ADR-864 Φ1β) — **ένα** σύνορο, ο κάτοχος στο σύρμα **μόνο ως είδος**, η τιμή του φίλτρου από την ταυτότητα. Νέο λεπτό σύνορο διαδρομών αρχείων: εταιρεία ⇒ **το ίδιο** `withAuth` με την **ίδια** ικανότητα (μηδέν αλλαγή)· άνθρωπος ⇒ `withPersonalOrOrgAuth`, **μόνο** `uid` |
| Β2 | Ο κριτής ιδιοκτησίας (`createOwnershipDecision`) έχει **παράκαμψη super admin** και ρωτά `companyId` | Για προσωπικό αρχείο **ΔΕΝ** επαναχρησιμοποιείται: ο κανόνας `files_personal` αποκλείει ρητά και τον super admin (Α3), και το `judgeStorageCustody` το λέει ήδη *«bypass εδώ θα έδινε μέσω proxy ό,τι οι κανόνες αρνούνται»*. Ο προσωπικός κριτής = `custodyScopeFromData(doc).userId === uid`, πάνω στην **ίδια** αλυσίδα `loadOwnedDocOrRefusal` (φόρτωσε→υπάρχει;→δικό μου;) |
| Β3 | 🔴 **Κόκκινη άγκυρα στο main**: το `storage-path-custody.test.ts` Κ1.1/Κ1.2 **αποτυγχάνει** — η ρίζα `people/` (βήμα 2α) μπήκε στο `storage.rules` χωρίς γραμμή στο `STORAGE_ROOT_CUSTODY` ⇒ ο κριτής τη λέει `undeclared-root` | Διορθώνεται (`people: 'user'`) — και γίνεται **δεύτερος φρουρός** της προσωπικής λήψης: το έγγραφο **και** η διαδρομή του πρέπει να ανήκουν στον ίδιο `uid` (έγγραφο που δείχνει σε ξένα bytes ⇒ άρνηση) |
| Β4 | 🧹 **Διπλότυπο (N.0.2)**: `api/files/purge` = αντίγραφο της Φάσης Α του `file-purge.job` (ίδιο ερώτημα, ίδιος βρόχος). Ο χρονοπρογραμματιστής τρέχει **μόνο** το job (`cron-schedule.ts` → `cron/file-purge`)· το `api/files/purge` δεν καλείται από πουθενά (μόνο στη baseline 3.78 ως `undeclared`) | Σάρωση «και των δύο διαμερισμάτων» σε δύο σημεία = το ίδιο λάθος που το job γράφει ότι υπάρχει για να αποφύγει. Η διαδρομή γίνεται **λεπτός προσαρμογέας** της Φάσης Α — **ένας** βρόχος `CUSTODY_KINDS` |
| Β5 | `purgeFileRecord` γράφει πάντα `COLLECTIONS.FILES` + γραμμή `FILE_AUDIT_LOG` **χωρίς** `companyId` (αόρατη — γνωστό χρέος, `pending-ratchet-work.md:129`) | Παίρνει **υποχρεωτικό** `CustodyKind` (ο μεταγλωττιστής βρίσκει τους 3). Προσωπικό ⇒ **καμία** γραμμή στο εταιρικό βιβλίο (ίδιο με το `logForCustody` του 2β.2) — **2β.4** |
| Β6 | **ΓΚΠΔ, δύο διαδρομές, όχι μία**: και το `gdpr-export` (άρθρο 15/20) σαρώνει μόνο `FILES`. Διαγραφή που καλύπτει ό,τι η εξαγωγή δεν δείχνει = ο άνθρωπος **δεν μπορεί να δει** τι θα σβηστεί | Κοινός σαρωτής υποκειμένου για **τις δύο** διαδρομές. Πεδίο υποκειμένου **ανά διαμέρισμα**: εταιρεία ⇒ `createdBy` (ό,τι ίσχυε — ο υπεύθυνος επεξεργασίας είναι η εταιρεία)· άνθρωπος ⇒ `userId` (ο **κάτοχος**, όχι ο συντάκτης: στη Φ3 ο μεσίτης θα ανεβάζει στον φάκελο του ιδιοκτήτη, και η διαγραφή του μεσίτη **δεν** πρέπει να σβήνει τον φάκελο του ιδιοκτήτη) |
| Β7 | Δείκτες: `file-purge.job` = 2 σύνθετα ερωτήματα (`isDeleted ==`+`purgeAt <=` · `status in`+`createdAt <`)· ο σαρωτής υποκειμένου = **μία** ισότητα. 🔴 **Μετρημένο στην υλοποίηση**: η CHECK 3.15 κρίνει **μόνο** ερωτήματα του `firestoreQueryService` (`check-firestore-index-coverage.js:39`) ⇒ τα ερωτήματα **Admin SDK** είναι **αόρατα** σε αυτή (`--all` ⇒ exit 0, σιωπηλό). Και το εταιρικό `files` **δεν είχε** δείκτη `(isDeleted, purgeAt)` στο `firestore.indexes.json` — ισότητα + εύρος σε άλλο πεδίο **απαιτεί** σύνθετο δείκτη ⇒ η Φάση Α ήταν πιθανότατα ήδη `FAILED_PRECONDITION` (ή ο δείκτης υπάρχει μόνο ζωντανά, εκτός αρχείου) | Δείκτες **με το χέρι, με λόγο** (η πύλη δεν μπορεί να τους προτείνει): `files (isDeleted, purgeAt)` · `files_personal (isDeleted, purgeAt)` · `files_personal (status, createdAt)`· η ισότητα εξυπηρετείται από μονο-πεδιακό δείκτη. 🔶 Το τυφλό σημείο της 3.15 σε Admin SDK μένει **δηλωμένο** (εκτός εμβέλειας) |
| Β8 | Πύλη 3.35: job/`gdpr-*`/`purge` σαρώνουν **εκ σχεδιασμού** κάθε μισθωτή (baseline 2 · 4 · 4 · 1) | `tenant-scope-exempt` **με λόγο** στα σημεία που αγγίζονται (πρότυπο `queryChangesAfter`, §12 2β.1) — η baseline **δεν** ξαναγράφεται (κοινό δέντρο, ο Giorgio) |
| Β9 | Πολλαπλή λήψη: οι δύο καλούντες του `downloadFilesAsZip` περνούν ήδη **αρχεία** φιλτραρισμένα σε ids· το `trashFilesInBatch` (2β.2) παράγει το είδος **από κάθε αρχείο** | Ίδιο ιδίωμα: `downloadFilesAsZip(files, selectedIds)` — το είδος από τα **έγγραφα**· μικτή επιλογή (αδύνατη σε μία λίστα) ⇒ **άρνηση**, ποτέ μαντεψιά. Ένα αίτημα = ένα διαμέρισμα |

**Γ. 🌐 Οι μεγάλοι** — Google Drive API: ο καλών **δηλώνει** τον χώρο (`supportsAllDrives`), ο διακομιστής κρίνει με τη δική του
ταυτότητα, και η λήψη (`alt=media`) περνά από τον **ίδιο** έλεγχο πρόσβασης με τα μεταδεδομένα — καμία «ανοιχτή» διαδρομή bytes.
Κάδος: αυτόματη οριστική διαγραφή μετά την προθεσμία **και** στον «Ο Δίσκος μου» **και** στους κοινόχρηστους δίσκους — ένας
μηχανισμός, όχι ένας ανά χώρο. Google Takeout / διαγραφή λογαριασμού: **όλοι** οι χώροι του ανθρώπου, όχι μόνο ο οργανισμός.
🏆 **Πού ξεπερνάμε**: η προσωπική λήψη ελέγχει **δύο ανεξάρτητα τεκμήρια** (κάτοχος εγγράφου **και** ρίζα Storage) — έγγραφο με
αλλοιωμένο `storagePath` δεν μπορεί να σερβίρει ξένα bytes.

**Δ. Απορριφθείσες εναλλακτικές** — (α) **`userId` στο σύρμα** (`?owner=uid`): ο αιτών θα διάλεγε **ποιανού** τα bytes — ο
διακομιστής φιλτράρει με το **δικό του** `uid`· (β) **προσωπικός κλάδος μέσα στο `createOwnershipDecision`**: θα κληρονομούσε
την παράκαμψη super admin και θα έκανε τον κριτή εταιρείας να «ξέρει» ανθρώπους — δύο έννοιες σε έναν κριτή· (γ) **όλες οι
διαδρομές σε `withPersonalOrOrgAuth`**: θα έχανε τον έλεγχο ικανότητας `dxf:files:view` για την εταιρεία (αλλαγή συμπεριφοράς
χωρίς λόγο)· (δ) **σάρωση και στις δύο συλλογές χωρίς δήλωση είδους στη λήψη**: διπλή ανάγνωση και μαντείο ύπαρξης (§2.6.8 Γ-β).

#### 2.6.10 🔎 SSoT audit **βήματος 2β.3β** — ΕΚΔΟΣΕΙΣ για προσωπικά αρχεία *(2026-09-17, πριν τον κώδικα — HEAD `ceadd529`)*

⚠️ **Το δέντρο έχει ΔΥΟ ακομμίτιστες εργασίες** (μετρημένο στην αρχή): το ADR-862 §5.3.7 άλλου agent
(`container-regime-policy.ts` · `container-transition-vocabulary.ts` · `container-regime-anchor.test.ts` **untracked**·
`container-transitions.ts` · `container-transition-policy.ts` · `container-custody.ts` · `container-succession-policy.ts` ·
`version-promotion.ts` **`M`**, σύνολο +141/−147 σε 8 tracked + 486 γραμμές σε 3 νέα) **και** το δικό μας 2β.3α. Η προϋπόθεση
του handoff («έγινε commit;») **απέτυχε** και αναφέρθηκε· **Giorgio: «προχώρα παρ' όλα αυτά»**. Συνέπεια που δηλώνεται:
στα 8 κοινά αρχεία γράφονται **μόνο** δικές μας γραμμές (`Edit`), ποτέ ξαναγράψιμο/`checkout`.

**Α. Επαληθεύσεις (μετρημένες)**

| Μέτρηση | Αποτέλεσμα |
|---|---|
| `COLLECTIONS.FILES` στη διαδρομή εκδόσεων | **5** σημεία, **όλα Admin SDK**: `container-transitions.ts:286` (`runTransition`) · `:348` (`successionBlock`, ο διάδοχος) · `version-stack.ts:61` (`readOwned`) · `:90` (`collectPredecessors`) · `container-custody.ts:129` (`sealContainerProject` — **backfill**, εκτός εμβέλειας: σφραγίζει έργο, και ο ιδιώτης δεν έχει) |
| Ποιοι απαιτούν `companyId` | `ContainerActor.companyId: string` (**υποχρεωτικό**) · `judgeTransition` βήμα (2) μέσω `isPayloadOwnedByCompany` · `judgeSuccession` (`actorCompanyId` **+** `successor.companyId` **+** ο έλεγχος «γεννήθηκε;») · `custodyOnEntry` (`projectMembersCollection(db, actor.companyId, …)`) · `readVersionStack(companyId, …)` **+** φίλτρο `where('companyId','==',…)` · `promotionSeed(companyId, …)` · `successorBuilderInput({ companyId })` · `recordTrace` (`companyId` στο ημερολόγιο) |
| Πώς βρίσκει τον δράστη | `containerActorOf(ctx: AuthContext)` — **ένα** σημείο κατασκευής, **2** καλούντες (`cde` · `versions/promote`) |
| CHECK 3.87 | ✅ **έτοιμη χωρίς αλλαγή**: το `FILES_REFERENCE` καλύπτει ήδη `FILES_PERSONAL` **και** `FILE_COLLECTION` (§2.6.7), και ο `STATE_WRITER` είναι ο **ίδιος** `container-transitions.ts` ⇒ γραφή προσωπικής διαδοχής **δεν** είναι «δεύτερος γραφέας». Επαληθεύτηκε ότι τα `supersededByFileId` · `supersededAt` **είναι** στο `cdeCustodyKeys()` (`firestore.rules:5689`), άρα το `writeSuccession` τα γράφει **ως ο δηλωμένος γραφέας** |
| Κανόνας `files_personal` | `get`/`list` = `userId == uid` (καμία φάση να κριθεί) · `update` καλεί `cdeCustodyUnchanged()` ⇒ ο **πελάτης δεν μπορεί** να γράψει `supersededByFileId`/`supersededAt` — μόνο ο γραφέας (Admin SDK). **Καμία αλλαγή κανόνα δεν χρειάζεται** |
| Δείκτες | `files_personal` έχει **3** δείκτες, **κανένας** με `supersededByFileId`· το εταιρικό `files` έχει `(companyId, supersededByFileId)`. Το ερώτημα προκατόχων στο προσωπικό διαμέρισμα θα έσκαγε `FAILED_PRECONDITION`. Admin SDK ⇒ **αόρατο** στη 3.15 (§2.6.9 Β7) ⇒ **με το χέρι, με λόγο** |
| Μεγέθη (N.7.1) | γραφέας **441/500** (ο άλλος agent +107 — στενό περιθώριο) · policy 397 · vocabulary 169 · regime 102 · custody 141 · succession 161 · `version-stack` 121 · `version-promotion` 146 · `-policy` 149 · `versions/route` 104 · `promote/route` 84 · `cde/route` 179 · `container-route-responses` 55 · `VersionHistory` 168 · `useVersionStack` 71 · `FilePreviewPanel` 403 |

**Β. 🆕 Ευρήματα που αλλάζουν τον σχεδιασμό**

| # | Εύρημα (μετρημένο) | Συνέπεια |
|---|---|---|
| Β1 | 🔑 **Ο διαχωρισμός διαδοχής/φάσης ΥΠΑΡΧΕΙ ΗΔΗ** (ADR-862 §5.3.7): `ACT_REGIMES` δίνει `supersede: ['cde','versions-only']` και **μόνο** `['cde']` στις άλλες τέσσερις· το `regimeRefusal` γυρίζει **ονομασμένο** `no-project`· το `writeSuccession` γράφει **μόνο** `archivalFieldsOf` — κανένα `cde*` | Το 2β.3β **δεν** χτίζει νέο διαχωρισμό. Προσθέτει **έναν λόγο** στην ίδια ένωση και **ένα διαμέρισμα** στον ίδιο γραφέα — ακριβώς ό,τι γράφει το σχόλιο του `container-regime-policy.ts` |
| Β2 | 🔴 **Το `why` του `versions-only` θα ήταν ΨΕΥΔΕΣ για τον ιδιώτη.** Το `resolveContainerProject` διαβάζει `text(raw.companyId)` και, όταν λείπει, γυρίζει `{ outcome:'none', why:'no-entity' }` (`container-project.ts:79-83`) ⇒ ο ιδιώτης **ήδη** πέφτει σε `versions-only`, αλλά με λόγο *«δεν δηλώνει οντότητα»* ενώ **δηλώνει** | Ο λόγος ταξιδεύει ως τα ίχνη (*«ώστε “εκτός έργου” και “σπασμένη αλυσίδα” να μη μοιάζουν»*) ⇒ **νέος λόγος `personal-custody`**, κριμένος **πριν** την ανάλυση έργου: ο ιδιώτης δεν ρωτά **καν** για έργο (μία ανάγνωση λιγότερη, και καμία ψευδής αιτία) |
| Β3 | 🔴 **`ContainerActor.companyId: string` είναι ΑΔΥΝΑΤΟ για τον πολίτη.** Η πόρτα του (`withPersonalOrOrgAuth` μέσω `withFileCustodyAuth`) δίνει στον χειριστή **μόνο** `uid` (`FileCustodyCaller`) — ο πολίτης δεν **έχει** οργανισμό (ADR-787 Ε-3) | Ο δράστης αποκτά **κάτοχο**, όχι `companyId`: `readonly custody: CustodyScope` (`{ companyId }` **ή** `{ userId }`). Τα `globalRole`/`permissions` μένουν — ο `decideCapability` τα ζητά και κρίνει **πριν** τον δίσκο, αμετάβλητος |
| Β4 | 🔑 **Δεν υπάρχει «ανήκει σε ΑΥΤΟΝ τον κάτοχο;» — υπάρχει μόνο «ανήκει σε αυτή την εταιρεία;»**: `isPayloadOwnedByCompany` σε **3** σημεία της διαδρομής (`judgeTransition` · `judgeSuccession` · `version-stack.readOwned`). Ο προσωπικός κριτής (`createPersonalOwnershipDecision`) απαντά **άλλη** ερώτηση (πόρος HTTP: verdict + logging + label) | **Ένα** νέο πρωτογενές εκεί όπου ζει ήδη το σύνορο — `custody-scope.ts` → `isOwnedByCustody(data, owner)`: γενίκευση του `isPayloadOwnedByCompany` σε **δύο** διαμερίσματα, με **την ίδια** παγίδα του κενού (`custodyScopeFromData` ⇒ «ακριβώς ένας», κενό = **απουσία**). ⛔ Ποτέ τέταρτο χειρόγραφο `===` |
| Β5 | 🔴 **Ο έλεγχος «γεννήθηκε ο διάδοχος;» ρωτά `typeof stored.companyId === 'string'`** (`successionBlock`: *«claim του Storage = ύπαρξη χωρίς μισθωτή»*). Σε προσωπικό διάδοχο είναι **πάντα false** | Ο γραφέας θα θεωρούσε **αγέννητο** έναν υπαρκτό διάδοχο και θα τον **ξαναέγραφε πάνω του** (απώλεια πεδίων). ⇒ «Γεννημένο» = **έχει κάτοχο**, με το **ίδιο** σύνορο: `custodyScopeFromData(stored) !== null` |
| Β6 | `custodyOnEntry` ζητά `projectMembersCollection(db, actor.companyId, projectId)` — **μόνο** εταιρεία· και η σφράγιση ομάδας (`cdeTeamId`) δεν έχει νόημα χωρίς ομάδα | Ο ιδιώτης κόβεται **πριν** (Β2), στην **πρώτη** γραμμή της `custodyOnEntry`: προσωπικός κάτοχος ⇒ `versions-only` **ανεξαρτήτως φάσης**, καμία ανάγνωση. Πιο αληθές από «προσωπικό **και** `pre-cde`»: προσωπικό αρχείο **ποτέ** δεν αποκτά φάση |
| Β7 | 🔴 **Ο διάδοχος του προβιβασμού γεννιέται εταιρικός**: `successorBuilderInput({ companyId })` χτυπά το overload **εταιρείας** ⇒ `birthCustodyFields` γράφει `companyId` **+** `cdeReadReach`. Σε προσωπικό αυτό είναι **ταυτόχρονα** παραβίαση κανόνα (`!keys().hasAny(['companyId'])`) **και** πεδίο CDE (`cdeCustodyKeys()`) σε αρχείο χωρίς φάσεις | Η είσοδος του builder παίρνει **`CustodyScope`** αντί `companyId` ⇒ **ο ίδιος** builder, το overload **του ανθρώπου**, και η ρίζα `people/` **δωρεάν** (το `buildStoragePath({ ...custody })` την παράγει ήδη — βήμα 2α). Και ο `promotionSeed` κλειδώνει σε **κλειδί κατόχου** (`fileCustodyKey` ⇒ `company:<id>` / `personal:<uid>`), ποτέ σκέτο id: δύο διαμερίσματα με ίδια ids δεν επιτρέπεται να παράγουν **τον ίδιο** διάδοχο |
| Β8 | Ο πελάτης στέλνει ήδη το είδος για **λήψη** (`downloadFileByIdWithPolicy(fileId, kind)`), αλλά **όχι** για εκδόσεις: `fetchVersionStack(fileId)` · `requestVersionPromotion(src, head)` · `requestSupersession(prev, next)` δεν έχουν παράμετρο | **Υποχρεωτικό** `CustodyKind` στον τύπο και των τριών ⇒ ο μεταγλωττιστής βρίσκει τους καλούντες (`useVersionStack` · `supersedeFileRecord` → **4** καλούντες: `StepUpload` · `useSceneState` · `publish-model-to-property` · `properties/[id]/model`). Στο σύρμα **μόνο** `?custody=` (`FILE_CUSTODY_PARAM`) |
| Β9 | 🔴 **Το `VersionHistory` κατεβάζει με `downloadUrl`, και το σχόλιο που το δικαιολογεί είναι ΜΠΑΓΙΑΤΙΚΟ**: το `useFileDownload` γράφει *«οι εκδόσεις ζουν σε υποσυλλογή, χωρίς δικό τους έγγραφο στη `files`»* — **ίσχυε πριν** την ADR-862 Φ0, που κατάργησε την υποσυλλογή | Σήμερα **κάθε** έκδοση είναι `FileRecord` με δικό της id ⇒ η λήψη έκδοσης περνά από `downloadFileByIdWithPolicy` (μισθωτής **και** δοχείο/ρίζα Storage), όχι από την εφεδρεία που φυλάει μόνο μισθωτή. ⚠️ Το είδος **δεν** μπαίνει στο `FileVersionEntry`: ο `userId` **δεν ταξιδεύει στο σύρμα** (§2.6.9 Δ-α) — το δίνει ο **γονιός**, που κρατά το `FileRecord` |
| Β10 | Το `personal-scope-consumers.test.ts` κλείνει το σύνολο των καταναλωτών του `withFileCustodyAuth` (**3** σήμερα) **και** του `withPersonalOrOrgAuth` (`DECLARED`) — Κ4 και Κ2 | +3 γραμμές σε **κάθε** λίστα (`versions` · `versions/promote` · `cde`), με λόγο **≥40 χαρακτήρων** (Κ1). ⚠️ Οι 3 γνωστές κόκκινες γραμμές του ADR-864 (άλλος agent) **δεν** αγγίζονται |
| Β11 | ⛔ **Το `cde` route ΔΕΝ ανοίγει διάπλατα στον ιδιώτη**: οι άλλες τέσσερις πράξεις παίρνουν `no-project` από τον **ίδιο** `regimeRefusal`, μέσα στον γραφέα | Η άρνηση είναι του **καθεστώτος**, όχι δεύτερος φρουρός στη διαδρομή — ένα σημείο κρίσης, ένα όνομα. Η διαδρομή απλώς **δεν** καλεί `containerVisibilityRefusal` για άνθρωπο (δεν υπάρχει φάση να κριθεί· ίδιο δόγμα με §2.6.9 Β2) |

**Γ. 🌐 Οι μεγάλοι — εκδόσεις στον ΠΡΟΣΩΠΙΚΟ χώρο** *(έρευνα 2026-09-17)*

| Πάροχος | Πόσες κρατά στον προσωπικό χώρο | Ποιος προβιβάζει παλιά έκδοση |
|---|---|---|
| **Google Drive** (Ο Δίσκος μου) | η **κεφαλή ποτέ** δεν αυτο-εκκαθαρίζεται· μη-`keepForever` αναθεωρήσεις εκκαθαρίζονται **30 ημέρες** μετά από νεότερο περιεχόμενο — **ή νωρίτερα** αν το αρχείο έχει **100**· `keepForever` σε **≤200**, και **μετρούν στον χώρο** | ο κάτοχος, ανεβάζοντας/επαναφέροντας αναθεώρηση (`revisions`) |
| **Dropbox** | Basic/Plus/Family **30 ημέρες** (add-on ⇒ 1 έτος)· Professional/Business **180**· Advanced/Enterprise **365** | ο κάτοχος: *«Roll back to this version»* |
| **Box** | Personal Free: **καμία** έκδοση· Personal Pro: **10**· επιχειρησιακά ρυθμιζόμενο 1–100.000 από **admin** | `POST /files/{id}/versions/current` — *«creates a new copy of the old version and puts it at the top of the versions history»* |

⇒ **Κανείς δεν κρατά απεριόριστες εκδόσεις στον προσωπικό χώρο, και κανείς δεν σβήνει την κεφαλή.** Ο προβιβασμός είναι
παντού **νέα έκδοση στην κορυφή**, ποτέ ανάσταση — δηλαδή **ακριβώς** το `promoteVersion` που ήδη έχουμε (ADR-862 Φ0 Β10).

🏆 **Πού ξεπερνάμε**: Google και Dropbox εκκαθαρίζουν με **ρολόι που ο άνθρωπος δεν βλέπει**· το Box με **μετρητή που
ορίζει ο admin** — τον οποίο ο ιδιώτης **δεν έχει**. Εδώ κάθε έκδοση είναι `FileRecord` με **ορατά** `purgeAt`/`hold`
(ADR-864 §21) ⇒ όταν αποφασιστεί όριο, η λήξη γίνεται **γραμμένο πεδίο πάνω στο έγγραφο**, αναγνώσιμο από τον κάτοχο,
όχι αόρατο χρονόμετρο.

🔶 **Φ0 ΔΕΝ υλοποιεί όριο και ΔΕΝ υπόσχεται όριο** — το `MAX_STACK_DEPTH = 200` του `version-stack.ts` είναι φρένο
**ανάγνωσης** (κύκλοι/αλλοιωμένα δεδομένα), **ποτέ** πολιτική διατήρησης. ⇒ **Ε-Φ0-2 για τον Giorgio** (§9, σχέση με
§5.9 όριο χώρου): *πόσες εκδόσεις και για πόσο στον προσωπικό χώρο — και μετρούν στο όριο χώρου;*

**Δ. Απορριφθείσες εναλλακτικές**

- **(α) Δεύτερος γραφέας για τα προσωπικά** — θα κοκκίνιζε η CHECK 3.87 (`second-writer`), και **σωστά**: δύο γραφείς της
  ίδιας κατάστασης αποκλίνουν, και η πύλη υπάρχει ακριβώς για αυτό.
- **(β) Περιτύλιγμα `fileCollectionOf(kind)`** αντί για `COLLECTIONS[FILE_COLLECTION[kind]]` στο σημείο κλήσης — τυφλώνει
  τις 3.15/3.35/3.87 (ρητή προειδοποίηση στο `file-custody.ts`): ελλείπων δείκτης = **πράσινη πύλη**, `FAILED_PRECONDITION`
  στην παραγωγή.
- **(γ) `ContainerActor` με `companyId: string | null`** — το `null` θα «ταίριαζε» με κενό `companyId` εγγράφου (η παγίδα
  του κενού, ADR-742 §4, ήδη μετρημένη ως ζωντανό σφάλμα). Ο κάτοχος είναι **ένωση**, όχι προαιρετικό πεδίο.
- **(δ) Δοκιμή και στις δύο συλλογές** όταν λείπει το `?custody=` — μαντείο ύπαρξης + διπλή ανάγνωση (§2.6.8 Γ).
- **(ε) Πεδία κατόχου στο `FileVersionEntry`** — ο `userId` δεν ταξιδεύει στο σύρμα (§2.6.9 Δ-α).
- **(στ) Φάσεις CDE «μόνο για τον εαυτό του»** στον ιδιώτη — ο κριτής (`decideContainerAccess`) ζητά **μέλος έργου** σε
  κάθε φάση ⇒ το αρχείο θα γινόταν **αόρατο στον ίδιο του τον κάτοχο**: ακριβώς το σφάλμα που ονομάζει το ADR-862 §5.3.7.
- **(ζ) Νέο πεδίο «είδος» πάνω στο `FileRecord`** για να ξέρει ο γραφέας το διαμέρισμα — το είδος **προκύπτει** από τον
  κάτοχο (`fileCustodyKindOf`)· αποθηκευμένο αντίγραφο θα μπορούσε να **διαφωνήσει** με τα πεδία κατόχου.

---

## §3. 🔑 **Η ΑΠΑΝΤΗΣΗ ΣΤΟ ΕΡΩΤΗΜΑ: «ίδιος κώδικας;» — ΝΑΙ, και είναι το ΜΟΝΟ σωστό**

### 3.1 Τι επαναχρησιμοποιείται **αυτούσιο**

| Κομμάτι | Γιατί είναι το ίδιο ερώτημα |
|---|---|
| `EntityFilesManager` + `AddCaptureMenu` + Αρχειοθήκη/Κάδος/Εκδόσεις/Προεπισκόπηση | «ποια αρχεία έχει **αυτή** η οντότητα και τι κάνω με αυτά» — δεν εξαρτάται από το **ποιος** είναι ο κάτοχος |
| Καρτέλες **Κάτοψη · Έγγραφα · Φωτογραφίες · Βίντεο** | είναι **ρυθμίσεις** του ίδιου συστατικού (`displayStyle`, φίλτρα κατηγορίας) |
| Κατάλογος ειδών εγγράφου (`config/upload-entry-points/`) | «Συμβόλαιο Μεταβίβασης» είναι **το ίδιο έγγραφο** είτε το ανεβάζει ιδιώτης είτε κατασκευαστής |
| Ονοματοδοσία (`file-display-name*`) · επικύρωση (`FILE_TYPE_CONFIG`) | ανεξάρτητα κατόχου |
| Προεπισκόπηση DXF / «3D Προβολή» | ανεξάρτητα κατόχου |
| **Ιστορικό** (`ActivityTab`) | ✅ **ήδη κοινό** (§2.4) |
| Προδιαγραφές (`PropertySpecificationFields` — ΠΕΑ, θέρμανση, κουφώματα…) | «τι **είναι** το σπίτι» δεν αλλάζει με τον κάτοχο |

### 3.2 Τι **ΔΕΝ** επαναχρησιμοποιείται — και γιατί αυτό **δεν** είναι παραβίαση SSoT

| Κομμάτι | Γιατί είναι **άλλο** ερώτημα |
|---|---|
| Καρτέλα **Πληροφορίες**: «Σύνδεση κτιρίου», «Όροφος» ως επιλογή από λίστα, «Συνδεδεμένοι χώροι», **Κωδικός Μονάδας ADR-233** | κωδικοποιούν την **ιεραρχία του γραφείου** (έργο → κτίριο → όροφος → μονάδα). Ο ιδιώτης **δεν** έχει έργο· το σπίτι του **είναι** το σύμπαν του |
| «Εμπορική κατάσταση», «Νέο Ακίνητο» στη λίστα έργου, «Μεταφορά στον κάδο» ως πράξη αποθέματος | **απόθεμα πωλήσεων** κατασκευαστή, όχι περιουσία ανθρώπου |
| Το έγγραφο `Property` (`types/property.ts:410`) ως αποθήκευση | `buildingId: string` · `floorId: string` **υποχρεωτικά** — ένας ιδιώτης θα έπρεπε να επινοήσει κτίριο και όροφο (**ψέμα στα δεδομένα**) |

> 🔑 **Κανόνας διάκρισης**: *ίδιος κώδικας όταν η **ερώτηση** είναι ίδια· άλλος κώδικας όταν μόνο η
> **οθόνη** μοιάζει.* Η καρτέλα «Έγγραφα» ρωτά το ίδιο πράγμα σε γραφείο και ιδιώτη. Η «Σύνδεση κτιρίου»
> ρωτά κάτι που **δεν υπάρχει** για τον ιδιώτη.

### 3.3 Γιατί είναι **σωστό** — όχι απλώς εφικτό

1. **Κάθε βελτίωση πληρώνεται μία φορά.** Το ADR-862 Φ0 έβαλε σήμερα φρουρό `cdeState` στα αρχεία.
   Με δεύτερο αγωγό, ο ιδιώτης **δεν θα τον είχε ποτέ** — και κανείς δεν θα το πρόσεχε.
2. **Η μεταβίβαση γίνεται φυσική.** Ο συμβολαιογράφος που καλείται (§5.6) βλέπει **την ίδια** οθόνη
   αρχείων που βλέπει και σε κατασκευαστική εταιρεία — μία οθόνη να μάθει, μία να φρουρηθεί.
3. **Το ίδιο ακίνητο παύει να ζει σε δύο αποθήκες** (§2.3 ⚠️).
4. **Αυτό κάνουν οι μεγάλοι**: το Google Drive έχει **ένα** πρόγραμμα για «Ο Δίσκος μου» και «Κοινόχρηστους
   δίσκους» — αλλάζει **ο κάτοχος**, όχι ο κώδικας. Το Figma: Drafts μέλους και αρχεία ομάδας, ίδιος
   επεξεργαστής. Και **το δικό μας ιστορικό από χθες** (§2.4).

---

## §4. Η αρχή

> 🧭 **Οδηγία Giorgio (2026-09-17), ισχύει για ΚΑΘΕ ανοιχτή απόφαση αυτού του εγγράφου**: *«πλήρες
> enterprise + πλήρες SSoT· όπου οι μεγάλοι (Revit · ArchiCAD · Cinema 4D · Figma · Zillow · Idealista)
> κάνουν κάτι διαφορετικό, ακολουθούμε **τους μεγάλους**· καμία έκπτωση ποιότητας, ο χρόνος δεν μετρά·
> όπου υπάρχει αβεβαιότητα, **έρευνα στο διαδίκτυο**· και όπου μπορούμε, **ξεπερνάμε** τους μεγάλους.»*

> **Το σύστημα αρχείων δεν ρωτά «ποιας εταιρείας;». Ρωτά «ποιανού είναι;» — και η απάντηση είναι
> `WorkspaceRef`, που το έργο ήδη έχει.** Ο φάκελος του ιδιώτη είναι **ρύθμιση** του υπάρχοντος
> συστήματος, όχι νέο σύστημα.

---

## §5. Η απόφαση

### 5.1 Ο **φάκελος ακινήτου** — οντότητα που ζει **πέρα** από την αγγελία

Η αγγελία (`OwnerProperty`, ADR-777 Α14) απαντά *«τι προσφέρω στην αγορά;»* — γεννιέται `listed`,
αποσύρεται, πουλιέται. Ο φάκελος απαντά *«τι ξέρω για το σπίτι μου;»* — υπάρχει **πριν** την αγγελία
(ο ιδιώτης που απλώς θέλει τάξη), **κατά** (μεσίτης, αγοραστής) και **μετά** (παραδίδεται — §5.7).

✅ **Ε-1 (Giorgio, 2026-09-17): ο φάκελος είναι ΝΕΑ, ΧΩΡΙΣΤΗ οντότητα** (`ENTITY_TYPES` + πρόθεμα
enterprise ID, N.6). Η αγγελία **δείχνει** σε αυτήν — δεν την περιέχει.

| Κανόνας | Συνέπεια |
|---|---|
| Ο φάκελος **γεννιέται χωρίς αγγελία** | ο ιδιώτης που απλώς θέλει τάξη στα χαρτιά του **δεν** φτιάχνει «κρυφή αγγελία» |
| Η αγγελία **αναφέρεται** στον φάκελο (π.χ. `dossierId`) και **αντλεί** από αυτόν φωτογραφίες/στοιχεία | καμία δεύτερη αποθήκευση των ίδιων αρχείων |
| Απόσυρση / πώληση / λήξη αγγελίας **δεν αγγίζει** τον φάκελο | ο φάκελος ζει όσο το **σπίτι**, η αγγελία όσο η **πώληση** |
| **Πολλές αγγελίες στον χρόνο** πάνω στον **ίδιο** φάκελο (πώληση που απέτυχε → ενοικίαση → ξανά πώληση) | το ιστορικό του σπιτιού δεν κόβεται ανά αγγελία |
| Μόνο ο **φάκελος** παραδίδεται στον αγοραστή (§5.7)· η αγγελία μένει στον πωλητή ως ιστορικό του | — |

*Παράδειγμα που κρίθηκε*: η κυρία Μαρία κρατά φάκελο για το διαμέρισμά της δύο χρόνια χωρίς να πουλά·
ανεβάζει αγγελία, πουλά σε τρεις μήνες, η αγγελία κατεβαίνει — **ο φάκελος μένει και περνά στον αγοραστή**.

⚠️ **Ανοιχτό για τη Φ1 (όχι απόφαση Giorgio, τεχνικό)**: οι **υπάρχουσες** αγγελίες ιδιώτη δεν έχουν
φάκελο. Η Φ1 μετρά πόσες είναι (Firestore MCP) και αποφασίζει αν ο φάκελος γεννιέται **αυτόματα** για
καθεμία ή **κατά την πρώτη επίσκεψη** του κατόχου.

### 5.2 🔑 **Θεματοφυλακή αρχείων** — η ΜΙΑ δομική αλλαγή

Το σχήμα του §2.4 — **όχι αντιγραμμένο, κοινό** (§2.6.5):

```ts
// lib/workspace/custody-scope.ts — ✅ ΥΛΟΠΟΙΗΘΗΚΕ 2026-09-17 · leaf · ΚΟΙΝΟ για ιστορικό ΚΑΙ αρχεία
type CustodyScope =
  | { companyId: string; userId?: never }   // ό,τι ίσχυε πάντα
  | { userId: string;   companyId?: never } // προσωπικός κάτοχος
custodyScopeOf(workspace: WorkspaceRef)     // η ΜΙΑ μετάφραση
custodyScopeFromData(data) · isWritableCustodyScope(scope) · custodyKindFromParam(v)   // σύνορο · φρουρός · σύρμα
type CustodyPartition = Record<'company' | 'personal', CollectionKey>

// lib/audit/audit-ledger.ts — ✅ πλέον ψευδώνυμα + AUDIT_LEDGER_COLLECTION satisfies CustodyPartition

// lib/files/file-custody.ts — ⏳ επόμενο βήμα, ΜΑΖΙ με τον πρώτο καταναλωτή (§12)
type FileCustody = CustodyScope
FILE_COLLECTION = { company: 'FILES', personal: 'FILES_PERSONAL' } satisfies CustodyPartition
```

⚠️ **Γιατί το `file-custody.ts` ΔΕΝ γράφτηκε στο βήμα 1**: (α) το `FILE_COLLECTION` χρειάζεται το κλειδί
`FILES_PERSONAL` στο `firestore-collections.ts`, που είναι WIP του Β11· (β) αρχείο χωρίς εισαγωγέα παραγωγής
**μπλοκάρει** το commit στη **CHECK 3.22** (knip εξαιρεί τα tests από το `project`) — και σωστά: κώδικας χωρίς
καταναλωτή είναι νεκρός κώδικας, όχι «προετοιμασία».

| # | Σημείο (§2.2) | Αλλαγή |
|---|---|---|
| 1 ✅ | `storage-path.ts` | δεύτερη **ρίζα**, ίδιο υπόλοιπο σχήμα: `/people/{userId}/entities/{entityType}/{entityId}/domains/…/files/{fileId}.{ext}`. Η ADR-709 «μία διαδρομή» **διατηρείται**: η ρίζα είναι αμετάβλητη ταυτότητα κατόχου, όπως το `companyId`. **Υλοποίηση (βήμα 2α)**: `StoragePathParams = CustodyScope & συντεταγμένες`· **μία** ρίζα (`buildCustodyStorageRoot`) για builder **και** προθέματα σάρωσης· ο ανεκτικός αναγνώστης δέχεται **δύο ρίζες**, ποτέ άγνωστη, και legacy `projects/` **μόνο** κάτω από `companies/`· επικύρωση «ακριβώς ένας κάτοχος». Οι ~12 καλούντες με `companyId` **ανέγγιχτοι** |
| 2 ✅ | `storage.rules` | **ένα** νέο `match /people/{userId}/entities/…` με `isOwner(userId)` — ίδιο ιδίωμα με `owner_property_media`. **Υλοποίηση**: `@pathId: canonical_personal` (read/delete `isOwner` · write + μέγεθος + τύπος · **ούτε** super_admin) |
| 3 ✅ | `firestore.rules` | **νέο** `match /files_personal/{fileId}` — `userId == request.auth.uid`. Το `match /files/{fileId}` **ανέγγιχτο** (γιατί διαμέρισμα και όχι διακλάδωση: §2.4) |
| 4 ✅ | `EntityFilesManagerProps` | `companyId: string` → `custody: FileCustody`. Τα **17** σημεία απόδοσης περνούν `{ companyId }` — μηχανική αλλαγή, ο μεταγλωττιστής τα βρίσκει όλα |
| 5 ✅ | `useEntityFiles` · `FileRecordService` · `file-mutation-gateway` | διαβάζουν τη συλλογή από `FILE_COLLECTION[kind]` **γραμμένο στο σημείο κλήσης** (ποτέ συνάρτηση-περιτύλιγμα: οι πύλες 3.15/3.35/3.87 διαβάζουν το `X[kind]`) |
| 6 ✅ | `file-record-core.ts` `buildPendingFileRecordData` (§2.6.1) | δέχεται `FileCustody` — **overloads**: εταιρεία ⇒ `companyId` + `cdeReadReach`· άνθρωπος ⇒ `userId`, κανένα πεδίο CDE — **ένα** χωνί για όλους τους αγωγούς |
| 7 ✅ | `validateCustodyUploadAuth` (§2.6.8 Β3) | ο προσωπικός κάτοχος επαληθεύεται με `uid`, **όχι** claim εταιρείας· η εταιρεία **καλεί** το `validateUploadAuth` |
| 8 ✅ | `api/files/purge` · `api/files/gdpr-delete` (§2.6.2) | σαρώνουν **και τα δύο** διαμερίσματα (`CUSTODY_KINDS`). **Υλοποίηση (2β.3α, §2.6.9)**: η σάρωση κάδου/ορφανών ζει **μόνο** στο `file-purge.job` (βρόχος `CUSTODY_KINDS` × `FILE_COLLECTION`)· το `api/files/purge` έγινε προσαρμογέας του (ήταν αντίγραφο)· `purgeFileRecord` με **υποχρεωτικό** `custody` · ΓΚΠΔ διαγραφή **και εξαγωγή** από τον **ίδιο** σαρωτή υποκειμένου (`file-subject-scan.ts`: εταιρεία `createdBy`, άνθρωπος `userId`) πίσω από **μία** πόρτα (`gdpr-subject-route.ts`, δέχεται πολίτη) |
| 9 ✅ | `firestore.rules` `cdeCustodyUnchanged()` (§2.6.3) | ανεβαίνει από τοπική σε **καθολική** συνάρτηση, ώστε να την καλούν `files` **και** `files_personal` |
| 10 ✅ | **Εκδόσεις** — ο ΕΝΑΣ γραφέας CDE · η στοίβα · ο προβιβασμός (§2.6.10) | **Υλοποίηση (2β.3β)**: ο **δράστης** κουβαλά `custody: CustodyScope` αντί `companyId`, και το διαμέρισμα του αιτήματος **παράγεται** από αυτόν (`COLLECTIONS[FILE_COLLECTION[kind]]` στο σημείο κλήσης) — **μία** πηγή, ποτέ δεύτερη δήλωση που θα μπορούσε να διαφωνήσει. Ο ιδιώτης μπαίνει σε καθεστώς `versions-only` με **δικό του** λόγο (`personal-custody`) στην **ίδια** ένωση του ADR-862 §5.3.7 ⇒ `supersede` περνά, `share`/`seal`/`release`/`withdraw` παίρνουν **ονομασμένη** άρνηση `no-project`. Η στοίβα ζητά **κάτοχο** και **δεν διασχίζει** διαμερίσματα· ο διάδοχος γεννιέται από τον **ίδιο** builder, με το overload **του ανθρώπου** (κανένα `companyId`, κανένα πεδίο CDE, ρίζα `people/`). Οι 3 διαδρομές (`versions` · `versions/promote` · `cde`) περνούν από `withFileCustodyAuth` — η ικανότητα στο σύνορο έγινε **προαιρετική**, ώστε η `cde` να κρατήσει την απόφασή της «καμία ικανότητα εδώ, κρίση ανά πράξη στον γραφέα» |

⛔ **ΜΗΝ** δώσεις στον ιδιώτη «ψευδο-εταιρεία» για να περάσει από τους υπάρχοντες φρουρούς. Το
**ADR-787 Ε-3 §3** το απαγορεύει ρητά και είχε προβλέψει *«εδώ θα γεννηθεί ο πειρασμός»*.

⚠️ **Σύγκρουση με εργασία σε εξέλιξη**: το `match /files/{fileId}` αλλάζει **σήμερα** από το ADR-862 Φ0
(Β10 · Β11). Η Φ0 **αυτού** του εγγράφου ξεκινά **μετά** το κλείσιμο του Β11, και ο νέος κανόνας
`files_personal` **κληρονομεί** το `cdeCustodyUnchanged()` — όχι αντίγραφό του.

### 5.3 **Ένας** κατάλογος ειδών εγγράφου — ο ιδιώτης βλέπει **όψη**, όχι αντίγραφο

- Τα είδη που λείπουν (§2.5) προστίθενται **μία φορά** στο `config/upload-entry-points/` και
  εμφανίζονται **και** στο γραφείο: **ΠΕΑ** (χωριστά από το γενικό «Πιστοποιητικό») · **Ηλεκτρονική
  Ταυτότητα Κτιρίου** · **Βεβαίωση νομιμότητας / ρύθμιση αυθαιρέτων** · **Λογαριασμοί παροχών**.
- Τα είδη **μελετών** που ήδη υπάρχουν (τοπογραφικό, τίτλος, κτηματογράφηση, στατικά, Η/Μ,
  αρχιτεκτονικά — `entries-studies.ts`) **δεν αντιγράφονται**: ο φάκελος τα ζητά με το υπάρχον
  `allowedEntryPointIds` του `EntityFilesManager`.
- Η «απλότητα για τον ιδιώτη» (ADR-777 Α14: *«δεν θα επιβάλουμε στον χρήστη να γίνει ειδικός»*) είναι
  **ομαδοποίηση και σειρά** στην όψη — όχι δεύτερη λίστα με άλλα ονόματα.

### 5.4 Δομημένα πεδία — στον **κοινό** τύπο, όχι στον τύπο του ιδιώτη

| Στοιχείο | Πού |
|---|---|
| ΠΕΑ (κλάση · αριθμός · ημερομηνία · λήξη) | ✅ **υπάρχει**: `PropertySpecificationFields.energy` — ο φάκελος το **εισάγει** |
| Αριθμός Ηλεκτρονικής Ταυτότητας Κτιρίου | **νέο** πεδίο στο `PropertySpecificationFields` |
| Αριθμοί παροχής (ρεύμα · αέριο · νερό) | **νέο** πεδίο στο `PropertySpecificationFields` |
| ΚΑΕΚ | ✅ λέξη υπάρχει στα locales — **επαλήθευση** στη Φ2 πριν γραφτεί δεύτερο πεδίο |

🔑 **Γιατί στον κοινό τύπο**: ο κατασκευαστής χρειάζεται **επίσης** τον αριθμό παροχής της μονάδας που
παραδίδει. Αν το πεδίο γεννηθεί στον τύπο του ιδιώτη, το γραφείο θα το ξαναγράψει αργότερα — δεύτερη
αλήθεια.

✅ **Ε-4 (Giorgio, 2026-09-17) — Ορατότητα αριθμών παροχής: προεπιλογή ανά ρόλο, αλλάξιμη ανά καλεσμένο.**

| Ρόλος καλεσμένου (ADR-862) | Προεπιλογή | Μπορεί ο κάτοχος να το αλλάξει; |
|---|---|---|
| `legal` (συμβολαιογράφος · δικηγόρος) | ✅ βλέπει | ναι |
| `consultant` (μηχανικός) | ✅ βλέπει | ναι |
| μεσίτης με εντολή | ❌ δεν βλέπει | ναι |
| υποψήφιος αγοραστής (Ε-6) | ❌ δεν βλέπει | ναι |
| `supplier` (προμηθευτής) | ⛔ **ποτέ** | **όχι** |
| δημόσια αγγελία / κοινό | ⛔ **ποτέ** | **όχι** |

- Οι αριθμοί παροχής είναι **προσωπικά δεδομένα νοικοκυριού** (με αυτούς γίνονται ενέργειες όπως αλλαγή
  παρόχου). Γι' αυτό η απαγόρευση προς `supplier` και κοινό είναι **δομική** — ο τύπος της προβολής δεν
  έχει το πεδίο (ίδιο ιδίωμα με ADR-862 §5.4.1.α «ποσότητες ναι, τιμές όχι»), **όχι** ρύθμιση που ξεχνιέται.
- Η επιλογή εμφανίζεται **στην πρόσκληση** ως κουτάκι με την προεπιλογή του ρόλου ήδη συμπληρωμένη,
  και αλλάζει αργότερα από τη λίστα καλεσμένων.
- Κάθε **προβολή** των αριθμών από καλεσμένο γράφεται στο **προσωπικό βιβλίο** του κατόχου (§5.8).
- 🔑 **Γενίκευση**: ο κανόνας δεν γράφεται «για τις παροχές» — γράφεται ως **κατηγορία ευαισθησίας πεδίου**
  στον κοινό τύπο, ώστε κάθε μελλοντικό ευαίσθητο πεδίο (π.χ. ΑΦΜ σε τίτλο) να κληρονομεί **τον ίδιο**
  πίνακα, όχι δικό του.

### 5.5 **Ιστορικό τίτλων** (πώς περιήλθε το ακίνητο)

Όχι νέο σύστημα: **έγγραφα** είδους «Συμβόλαιο Μεταβίβασης» (υπάρχει: `unit-deed`) με **ημερομηνία
πράξης** και **είδος** (αγορά · γονική παροχή · κληρονομιά · διανομή · αντιπαροχή), ταξινομημένα
χρονικά. Το «Ιστορικό» (`ActivityTab`) απαντά *«τι άλλαξε στην πλατφόρμα»* — **άλλη** ερώτηση, δεν
συγχωνεύονται.

✅ **Ε-5 (Giorgio, 2026-09-17): επιλογή «Β+» — πλήρης αλυσίδα κυριότητας, χτισμένη ΠΑΝΩ σε ό,τι υπάρχει** (έρευνα §5.5.1).
Αναθεωρεί την αρχική σύσταση της παραγράφου αυτής («μεταδεδομένο αρχείου»): ο **κρίκος** είναι οντότητα.

| # | Κανόνας | SSoT / πρότυπο |
|---|---|---|
| 1 | **Κρίκος αλυσίδας** = ο κοινός τύπος τίτλου: αριθμός · ημερομηνία · **είδος πράξης** · συμβολαιογράφος (όπως γράφτηκε + επαφή) · τόμος · α.α. · υποθηκοφυλακείο/Κτηματολόγιο · **από ποιον → σε ποιον** · **ποσοστό** · σύνδεση με το PDF του συμβολαίου | ⛔ **ΟΧΙ** δεύτερος τύπος: το `SurveyTitleDeed` (ADR-759) **εξάγεται** σε κοινό τύπο τίτλου που χρησιμοποιούν **και** το τοπογραφικό **και** ο φάκελος· πρόσωπα/ποσοστά με το σχήμα του `PropertyOwnerEntry` (ADR-244)· τιμές `Sourced<>` |
| 2 | **Είδος πράξης = κλειστό λεξιλόγιο** (αγορά · γονική παροχή · δωρεά · κληρονομιά/αποδοχή · διανομή · αντιπαροχή · χρησικτησία · άλλο με κείμενο) — **ένα** αρχείο λεξιλογίου, που ο κανόνας ανάγνωσης τοπογραφικού **αντιστοιχίζει** σε αυτό | διορθώνει το ελεύθερο κείμενο του `SurveyTitleDeed.kind` και για το ADR-759 |
| 3 | **Έλεγχος κενών**: κάθε κρίκος «από» πρέπει να ταυτίζεται με «σε» προηγούμενου κρίκου → *«Το 2005 το πήρε η μητέρα — από ποιον; Λείπει τίτλος»* | title companies (chain of title gaps) |
| 4 | **Έλεγχος ποσοστών**: σε κάθε χρονική στιγμή τα ποσοστά αθροίζουν **100%** | ADR-235/244 validation |
| 5 | **Ένδειξη 20ετίας**: *«✅ καλύπτει 1985–σήμερα»* / *«⚠️ λείπουν 2003–2005»* — το βάθος (20) είναι **σταθερά με όνομα και λόγο** (έκτακτη χρησικτησία), όχι μαγικός αριθμός | ελληνική πρακτική ελέγχου τίτλων |
| 6 | **Βάρη** (υποθήκη · προσημείωση · κατάσχεση · αγωγή/διεκδίκηση · δουλεία) ως **χωριστή λίστα** με κατάσταση **ενεργό / εξαλείφθηκε** + έγγραφο εξάλειψης | Schedule B-II |
| 7 | 🏆 **Συμφιλίωση με το κτηματολογικό φύλλο**: ο κάτοχος ανεβάζει το PDF· η οθόνη δείχνει **διαφορές** (ιδιοκτήτης · ποσοστό · βάρη) με **«αποδοχή διαφοράς»** | ⛔ **ΟΧΙ** νέα μηχανή: ο μηχανισμός συμφιλίωσης του ADR-759 §4.1 (πρότυπο Revit Coordination Review) |
| 8 | 🏆 **Πρόταση από τοπογραφικό**: αν υπάρχει τοπογραφικό με διαβασμένους τίτλους, οι κρίκοι **προτείνονται** — ο κάτοχος **επιβεβαιώνει**, δεν ξαναπληκτρολογεί | ADR-759 · ADR-745 §8 *«ανάγνωση δεν είναι ταυτοποίηση»* |
| 9 | ⚠️ Κάθε ένδειξη φέρει ρητά **«βοήθημα — όχι νομικός έλεγχος τίτλων»** | η ευθύνη μένει στον δικηγόρο/συμβολαιογράφο |
| 10 | Ο καλεσμένος **`legal`** (§5.6) βλέπει αλυσίδα **και** βάρη **και** αποτέλεσμα συμφιλίωσης — αυτό **είναι** η δουλειά του | — |

⚠️ **Δηλωμένο όριο**: η **ανάγνωση** του PDF του Κτηματολογίου (δομή, πεδία) **δεν** μελετήθηκε· η Φ2
ξεκινά με δείγμα πραγματικού φύλλου. Αυτόματη άντληση από Κτηματολόγιο: **δεν** βρέθηκε δημόσιο API.

#### 5.5.1 🌐 Έρευνα + SSoT audit *(2026-09-17, πριν την απόφαση)*

**Τι κάνουν οι μεγάλοι / η αγορά:**

| Πηγή | Εύρημα |
|---|---|
| **Εταιρείες τίτλων ΗΠΑ** (title companies) | ο έλεγχος παράγει **αλυσίδα κυριότητας** (*«αδιάσπαστη σειρά μεταβιβάσεων — εντοπίζει κενά, διακοπές, ανωμαλίες»*) και **Title Commitment**: Schedule B-I = **τι πρέπει να λυθεί πριν το κλείσιμο**, B-II = **εξαιρέσεις** (βάρη, δουλείες, υποθήκες). Ελέγχεται ότι **ο πωλητής ταυτίζεται** με τον τελευταίο τίτλο |
| **Ελλάδα — έλεγχος τίτλων** (δικηγόρος) | τρόπος κτήσης + **βάρη** (υποθήκες, προσημειώσεις, κατασχέσεις, αγωγές, διεκδικήσεις), **χρονολογικά σε βάθος 20ετίας** — που αντιστοιχεί στην **έκτακτη χρησικτησία** (20 έτη· τακτική 10) |
| **Κτηματολόγιο** | εκδίδει ηλεκτρονικά (PDF, με taxisnet): **αντίγραφο κτηματολογικού φύλλου** — *«κατάσταση ακινήτου με **ποσοστά ιδιοκτησίας** και **βάρη**»* —, πιστοποιητικό κτηματολογικών εγγραφών, αντίγραφο εγγραπτέας πράξης. Δημόσιο API για αυτόματη άντληση **δεν** εντοπίστηκε |

**Τι υπάρχει ΗΔΗ στον κώδικα — και ΔΕΝ πρέπει να ξαναγραφτεί:**

| Υπάρχον | Πού | Τι καλύπτει |
|---|---|---|
| `SurveyTitleDeed` | `types/project-survey-record.ts:263` (ADR-759) | **ο κρίκος σχεδόν ολόκληρος**: αριθμός συμβολαίου · ημερομηνία · **είδος πράξης** (*«Κληρονομιάς / Γονικής Παροχής / Διανομής»*) · όνομα συμβολαιογράφου **όπως γράφτηκε** + σύνδεση με επαφή · τόμος · α.α. · υποθηκοφυλακείο. Κάθε τιμή είναι `Sourced<>` (**από πού ήρθε**) |
| Κανόνας ανάγνωσης τίτλων από τοπογραφικό | `config/document-body-vocabulary.ts:359` | διαβάζει τους τίτλους **από το ίδιο το τοπογραφικό** του μηχανικού |
| `PropertyOwnerEntry` | `types/ownership-table.ts:189` (ADR-244) | συνιδιοκτήτες με **ποσοστό** (0-100) και ρόλο |
| Πίνακας χιλιοστών | ADR-235 | ποσοστό **επί οικοπέδου** (‰) — άλλο ερώτημα, σχετικό |
| **Συμφιλίωση** «δήλωση ↔ επίσημη πηγή» με *«αποδοχή διαφοράς»* | ADR-759 §4.1 (πρότυπο Revit Coordination Review) | το **ίδιο** σχήμα για «αλυσίδα δηλωμένη ↔ κτηματολογικό φύλλο» |
| `kaek` | `services/building-code/types/site.types.ts:106` | ΚΑΕΚ — ήδη πεδίο |

⚠️ **Εύρημα**: το `SurveyTitleDeed.kind` είναι **ελεύθερο κείμενο**. Για έλεγχο αλυσίδας χρειάζεται **κλειστό
λεξιλόγιο** — και θα ωφελήσει **και** το τοπογραφικό (ADR-759), όχι μόνο τον φάκελο.

*Πηγές*: [Title commitment — Schedule B](https://barneswalker.com/legal-glossary/t/title-commitment-schedule-b-exceptions/) ·
[How to read a title commitment](https://www.ftic.net/how-to-read-a-title-commitment/) ·
[Preliminary title report](https://www.ustitlerecords.com/preliminary-title-report/) ·
[LEX.GR — Έλεγχος τίτλων](https://www.lex.gr/law/akinhta/elegxos-titlwn/) ·
[Έρευνα στο υποθηκοφυλακείο/κτηματολόγιο](https://dikigoros.com.gr/dikeo-akiniton/erevna-ypothikofylakio-ktimatologio/) ·
[Κτηματολόγιο — πιστοποιητικά](https://www.ktimatologio.gr/pliroforiako-yliko/ktimatologio-se-leitourgia/21).

### 5.6 **Πρόσβαση τρίτων** — **μόνο** μέσω ADR-862, με δύο προσθήκες

| Ανάγκη του ιδιώτη | Μηχανισμός |
|---|---|
| Μηχανικός για ρύθμιση αυθαιρέτων | πρότυπο **`consultant`** του ADR-862 — **υπάρχει** στην απόφαση |
| Συμβολαιογράφος / δικηγόρος για τη μεταβίβαση | 🆕 πρότυπο **`legal`**: **μόνο ανάγνωση** · **επιλεγμένες** κατηγορίες (τίτλοι, ΠΕΑ, ΗΤΚ, βεβαιώσεις — **όχι** φωτογραφίες εσωτερικού) · λήξη **παράγεται** από την ολοκλήρωση της πράξης, με ανώτατο όριο (ADR-862 §5.3.3) |
| Υποψήφιος αγοραστής | ✅ **Ε-6** — σκάλα 3 σκαλιών (§5.6.3) |

🆕 **Οικοδεσπότης = προσωπικός χώρος**. Το ADR-862 υποθέτει οργανισμό-οικοδεσπότη. Η γενίκευση του
`PropertyGrant` (ADR-862 §5.3.1) πρέπει να δέχεται **`WorkspaceRef`** ως οικοδεσπότη. ⇒ **Αναφέρεται
ως απαίτηση προς το ADR-862 Φ1** (αμφίδρομη παραπομπή, §11), **όχι** δεύτερος μηχανισμός εδώ.

#### 5.6.1 ✅ Ε-3 — **Σε ποιον ανήκει ό,τι ανεβάζει ο μεσίτης** *(Giorgio 2026-09-17: επιλογή Γ + έρευνα)*

**Έρευνα (2026-09-17):**

| Εύρημα | Πηγή |
|---|---|
| Τα πνευματικά δικαιώματα φωτογραφίας ανήκουν **στον φωτογράφο** — όχι στον ιδιοκτήτη του σπιτιού, όχι σε όποιον πλήρωσε — εκτός αν υπάρχει **γραπτή** μεταβίβαση/άδεια | NAR · νομική πρακτική ΗΠΑ |
| Στην Ελλάδα η φωτογραφία προστατεύεται (ζωή δημιουργού + 70 έτη), εφόσον έχει πρωτοτυπία· αντιγραφή από άλλο γραφείο χωρίς άδεια = παραβίαση | ελληνική βιβλιογραφία πνευματικής ιδιοκτησίας |
| Οι άδειες φωτογράφων είναι συνήθως **περιορισμένες**: *«μόνο για μάρκετινγκ της ενεργής αγγελίας»*, **αφαίρεση όταν πουληθεί ή αποσυρθεί** | VHT v. Zillow |
| Ο πωλητής **δεν** αποκτά αυτόματα δικαίωμα επαναχρησιμοποίησης όταν λήξει η εντολή· ο **νέος** μεσίτης κάνει **νέα** φωτογράφιση, εκτός αν δοθεί **γραπτή** άδεια | πρακτική MLS |
| Η χρήση φωτογραφιών **πουλημένων** ακινήτων χωρίς άδεια οδήγησε σε **δικαστική διαμάχη** (VHT v. Zillow) | 9th Circuit |
| Η Idealista απαιτεί σεβασμό δικαιωμάτων εικόνας και βάζει **υδατογράφημα** κατά της αντιγραφής | Όροι Idealista |
| Η NAR συστήνει: **καταγραφή** κάθε συμφωνίας φωτογράφισης, **έλεγχος** χρήσης έναντι άδειας | NAR |

**Απόφαση:**

| Είδος | Θεματοφυλακή | Όταν λήξει/λυθεί η εντολή |
|---|---|---|
| **Έγγραφα του σπιτιού** (κάτοψη, έντυπο εντολής, πιστοποιητικά, μελέτες) που ανεβάζει ο μεσίτης | **ο φάκελος του ιδιοκτήτη** — ο μεσίτης ανεβάζει **ως καλεσμένος** (ADR-862), καταγράφεται «ανέβηκε από» | **μένουν** στον ιδιοκτήτη· ο μεσίτης χάνει πρόσβαση |
| **Φωτογραφίες/βίντεο του μεσίτη** | **ο χώρος του γραφείου** (όπως σήμερα)· ο ιδιοκτήτης τα **βλέπει** στον φάκελο **όσο ισχύει η εντολή** | **εξαφανίζονται αυτόματα** από τον φάκελο **και** τη δημόσια αγγελία — εκτός αν έχει δοθεί άδεια (παρακάτω) |
| **Φωτογραφίες του ιδιοκτήτη** | ο φάκελος του ιδιοκτήτη | μένουν |
| Χώρος (§5.9) | τα έγγραφα μετρούν στο όριο **του ιδιοκτήτη**· τα μέσα του μεσίτη στο όριο **του γραφείου** | — |

🔑 **Κάθε φωτογραφία/βίντεο φέρει ΔΗΛΩΜΕΝΑ δικαιώματα** (όχι ελεύθερο κείμενο): **δημιουργός** ·
**δικαιούχος** · **άδεια χρήσης** (σκοπός + λήξη). Προεπιλογή για μέσα μεσίτη: *«μάρκετινγκ αυτού του
ακινήτου, όσο ισχύει η εντολή»*. Τα πεδία ακολουθούν το διεθνές πρότυπο **IPTC Photo Metadata** (Creator ·
Copyright Notice · Licensor) ώστε να ταξιδεύουν και μέσα στο αρχείο κατά την εξαγωγή.

🏆 **Πέρα από τους μεγάλους:**

| # | Δυνατότητα | Τι λύνει |
|---|---|---|
| Δ1 | **Αυτόματη απόσυρση** των μέσων του μεσίτη με τη λήξη της άδειας — **κανείς** δεν χρειάζεται να θυμηθεί | το πρόβλημα VHT v. Zillow δεν μπορεί να συμβεί |
| Δ2 | Στην υπογραφή της εντολής, ο μεσίτης **μπορεί** να δώσει με ένα κλικ **γραπτή άδεια επαναχρησιμοποίησης** στον ιδιοκτήτη — καταγράφεται με ημερομηνία στο ίχνος | η «γραπτή άδεια» που ζητά η NAR, **χωρίς χαρτί** |
| Δ3 | Μετά τη λήξη, ο ιδιοκτήτης βλέπει **θέση** *«20 φωτογραφίες του γραφείου Χ έληξαν με την εντολή»* + κουμπί **«Ζητήστε άδεια»** → αίτημα προς το γραφείο | ο ιδιοκτήτης **ξέρει** τι έγινε — όχι σιωπηλή εξαφάνιση |
| Δ4 | Το **αποτύπωμα** (§5.10.1 Γ3) κάθε φωτογραφίας επιτρέπει να αναγνωριστεί **η ίδια** φωτογραφία αν ανέβει από **άλλο** γραφείο → προειδοποίηση πριν δημοσιευτεί | αντιγραφή φωτογραφιών μεταξύ γραφείων |

*Πηγές*: [NAR — Who owns your property photos](https://www.nar.realtor/copyright/who-owns-your-property-photos) ·
[NAR — Copyright considerations for MLS photographs](https://www.nar.realtor/ae/manage-your-association/association-policy/copyright-considerations-for-mls-photographs) ·
[VHT v. Zillow (9th Cir. 2019)](https://us9thcircuitcourtofappealsopinions.justia.com/2019/03/15/vht-inc-v-zillow-group-inc) ·
[Inman — sold listing photos](https://www.inman.com/2015/07/16/zillow-copyright-suit-challenges-fate-of-sold-listing-photos/) ·
[NJ Broker Desk — photo rules after closing](https://www.njbrokerdesk.com/real-estate-photo-copyright-rules/) ·
[Όροι Idealista](https://st1.idealista.com/ayuda/wp-content/uploads/2021/11/2021-Hasta-11-11-2021-Terminos-y-condiciones.pdf) ·
[Photologio — φωτογραφία και πνευματικά δικαιώματα](https://www.photologio.gr/photo%CE%B8%CE%AD%CF%83%CE%B5%CE%B9%CF%82/intellectual-property-on-photos/).
⚠️ **Δηλωμένο όριο**: η ελληνική θέση καταγράφηκε από δευτερογενείς πηγές, **όχι** από νομικό· η
προεπιλεγμένη διατύπωση άδειας ελέγχεται από δικηγόρο πριν τη Φ3.

#### 5.6.2 🌐 Έρευνα για Ε-6 — πρόσβαση υποψήφιου αγοραστή *(2026-09-17, πριν την απόφαση)*

| Πηγή | Εύρημα |
|---|---|
| **Ηνωμένο Βασίλειο — National Trading Standards, «Material Information»** | οι αγγελίες **υποχρεούνται** να δείχνουν **πριν** την προσφορά: **Μέρος Α** (φόροι/τέλη, είδος κυριότητας, τιμή — στην **πρώτη** σελίδα), **Μέρος Β** (είδος, υλικά, δωμάτια, **παροχές**, στάθμευση), **Μέρος Γ** μόνο αν ισχύει (πλημμύρα, περιοριστικοί όροι). Νομική βάση: απαγόρευση **παράλειψης** ουσιώδους πληροφορίας |
| **Εικονικές αίθουσες δεδομένων** (Datasite · Intralinks · Papermark · Digify) — πώληση ακινήτων/επιχειρήσεων | **σταδιακή** πρόσβαση: πρώτα γενικό υλικό, το **πλήρες** μόνο στον επικρατέστερο αγοραστή· **υπογραφή εμπιστευτικότητας πριν** ανοίξει· **μόνο προβολή**, **χωρίς λήψη**· **υδατογράφημα με το όνομα του θεατή**· **πλήρες ίχνος** ποιος είδε τι |
| Στον κώδικά μας | το **δυναμικό υδατογράφημα** είναι ήδη προγραμματισμένο (ADR-862 **Φ6**)· η **προβολή χωρίς λήψη** δεν υπάρχει ακόμη |

*Πηγές*: [NTS — Part A guidance](https://www.nationaltradingstandards.uk/news/national-trading-standards-publishes-guidance-on-part-a-material-information-for-property-listings/) ·
[NTS — full material information guidance](https://www.nationaltradingstandards.uk/news/full-material-information-guidance-published/) ·
[RICS — material information](https://www.rics.org/news-insights/material-information-what-to-know-and-what-happens-next) ·
[Papermark — real estate data room](https://www.papermark.com/blog/how-to-set-up-real-estate-data-room) ·
[Digify — data room for due diligence](https://digify.com/blog/virtual-data-room-setup-for-due-diligence-a-7-step-guide/).

#### 5.6.3 ✅ Ε-6 — **Η σκάλα των τριών σκαλιών** *(Giorgio, 2026-09-17)*

| Σκαλί | Ποιος | Τι βλέπει | Πώς | Ποιος το ανοίγει |
|---|---|---|---|---|
| **0 — Αγγελία** | κοινό | ενεργειακή κλάση · ύπαρξη ΗΤΚ · **σύνοψη** («✅ αλυσίδα 20ετίας πλήρης», «✅ χωρίς ενεργά βάρη») | **κανένα έγγραφο** | αυτόματα, όταν ο κάτοχος το επιτρέψει στην αγγελία |
| **1 — Ενδιαφερόμενος** | υποψήφιος αγοραστής **που το ζήτησε** | ΠΕΑ · ΗΤΚ / βεβαίωση νομιμότητας · κατόψεις · λίστα βαρών | **μόνο προβολή, χωρίς λήψη** · **υδατογράφημα με το όνομα του θεατή** · **λήξη** (προεπιλογή 14 ημέρες, σταθερά με όνομα) · αποδοχή **όρων εμπιστευτικότητας** πριν ανοίξει | **ο κάτοχος εγκρίνει** κάθε αίτημα |
| **2 — Συμφωνία** | ο αγοραστής **και** ο δικηγόρος του (πρότυπο `legal`) | πλήρης αλυσίδα · συμβόλαια · κτηματολογικό φύλλο | **με** λήψη · λήξη = υπογραφή οριστικού συμβολαίου (ανώτατο όριο κατά ADR-862 §5.3.3) | ο κάτοχος, μετά από προσύμφωνο/αρραβώνα |

**Κανόνες σε όλα τα σκαλιά:**
1. **Αριθμοί παροχής ποτέ**, εκτός αν αλλάξει ρητά (Ε-4, §5.4).
2. **Τα σκαλιά είναι αύξουσα ένωση** — ό,τι βλέπει το σκαλί 1 το βλέπει και το 2· **κανένα** άλμα από 0 σε 2 χωρίς πράξη κατόχου.
3. Το **περιεχόμενο** κάθε σκαλιού δηλώνεται **μία φορά** στον κατάλογο ειδών εγγράφου (§5.3) ως ελάχιστο σκαλί ορατότητας — **όχι** λίστα ανά οθόνη.
4. Τα σκαλιά είναι **πρότυπο συμμετοχής** του ADR-862 (ρόλος · περιοχή · λήξη · ανάκληση · ίχνος) — **όχι** δεύτερος μηχανισμός πρόσβασης.
5. **Υδατογράφημα**: επιταχύνει το ADR-862 **Φ6** (δυναμικό υδατογράφημα) — **ένα** υλοποίημα και για τις δύο χρήσεις. **Προβολή χωρίς λήψη**: νέα, **κοινή** ικανότητα του προβολέα αρχείων.

🏆 **Πέρα από τους μεγάλους:**

| # | Δυνατότητα | Γιατί |
|---|---|---|
| Σ1 | Ο κάτοχος βλέπει **τι κοίταξε ο καθένας** (*«ο κ. Κώστας άνοιξε το ΠΕΑ 3 φορές, τις κατόψεις 5»*) — από το **προσωπικό βιβλίο** (§5.8), όχι νέα καταγραφή | ξέρει **πόσο σοβαρό** είναι το ενδιαφέρον — ό,τι δίνουν οι αίθουσες δεδομένων σε επιχειρήσεις, εδώ σε **ιδιώτη** |
| Σ2 | Η **σύνοψη του σκαλιού 0** **παράγεται** από τους ελέγχους της αλυσίδας (§5.5 κανόνες 3-6) — **ποτέ** δηλωμένη με το χέρι | δεν μπορεί να πει ψέματα· αν προστεθεί ενεργό βάρος, η σύνοψη αλλάζει **μόνη της** |
| Σ3 | Η σύνοψη φέρει την ένδειξη **«βοήθημα — όχι νομικός έλεγχος»** και **ημερομηνία** του τελευταίου ελέγχου | ο αγοραστής ξέρει **πόσο φρέσκια** είναι |

⚠️ **Δηλωμένο όριο**: αν η ελληνική νομοθεσία (ή μελλοντική) **υποχρεώνει** δημοσιοποίηση στοιχείων όπως στο
UK «Material Information», το σκαλί 0 **δεν** ελέγχθηκε έναντι αυτής — έλεγχος από νομικό πριν τη Φ3.

⛔ **Ανώνυμος σύνδεσμος ανά αρχείο** (ADR-191 `file-share.service.ts`) **δεν** είναι ο δρόμος — ίδιο
σκεπτικό με ADR-787 Α5 / ADR-862 §3.2 (OWASP A01): δεν ξέρεις **ποιος** άνοιξε τον τίτλο του σπιτιού σου.

### 5.7 **Παράδοση του φακέλου** στον νέο ιδιοκτήτη

Με την ολοκλήρωση της πώλησης, ο πωλητής **παραδίδει** τον φάκελο στον αγοραστή (αλλαγή θεματοφυλακής,
όχι αντιγραφή): τα **τεχνικά** (κατόψεις, μελέτες, ΠΕΑ, ΗΤΚ, παροχές) μεταφέρονται, τα **προσωπικά**
(τιμολόγια, λογαριασμοί με στοιχεία του πωλητή) **μένουν**. Αυτό είναι το κομμάτι που **κανένα**
ελληνικό εργαλείο δεν έχει — και αντιστοιχεί στο *«ψηφιακό βιβλίο κτιρίου»* της αναθεωρημένης EPBD.
**Τελευταία φάση** — προϋποθέτει §5.2 και §5.6.

### 5.8 Ιδιωτικότητα (ΓΚΠΔ)

- **Ιδιωτικό εξ ορισμού**, ούτε `super_admin` — ίδιο δόγμα με `storage.rules:506`.
- **Κάθε** ανάγνωση από καλεσμένο γράφεται στο **προσωπικό βιβλίο** του κατόχου (ADR-862 §5.7 · ADR-195).
- Δικαίωμα διαγραφής: ο **κάδος** του `EntityFilesManager` + τελική εκκαθάριση — **υπάρχει**
  (`api/files/purge` · `api/files/gdpr-delete`) και πρέπει να σαρώνει **και τα δύο** διαμερίσματα *(διορθώθηκε
  2026-09-17, §2.6.2: έγραφε «να δέχεται `FileCustody`» — αλλά το `purge` είναι καθολική σάρωση και το `gdpr-delete`
  φιλτράρει με `createdBy`, κανένα δεν παίρνει κάτοχο)*.

### 5.9 Όριο χώρου *(✅ Ε-2, Giorgio 2026-09-17 — αναθεωρήθηκε την ίδια μέρα)*

🔑 **Ένα κοινό όριο ανά άνθρωπο, που μεγαλώνει με τα σπίτια του, με ταβάνι.**

```
όριο_λογαριασμού = 1 GB × min(πλήθος_φακέλων, 3)      // 1 φάκελος → 1 GB · 2 → 2 GB · 3+ → 3 GB
```

| Κανόνας | Τιμή |
|---|---|
| Όριο | **ανά ΑΝΘΡΩΠΟ**, κοινό για όλους τους φακέλους του (ο χώρος **μοιράζεται** ελεύθερα) |
| Αύξηση | **+1 GB για κάθε φάκελο**, έως **3 φακέλους** ⇒ ταβάνι **3 GB** |
| Πλήθος φακέλων | **δεν** περιορίζεται — ο 4ος, 5ος φάκελος **υπάρχει**, αλλά **δεν** προσθέτει χώρο |
| Βίντεο ανά φάκελο | **έως 3** |

*Παραδείγματα που κρίθηκαν*: η κυρία Μαρία (1 διαμέρισμα) → **1 GB**· ο κύριος Γιάννης (5 κληρονομημένα,
ενοικιαζόμενα) → **3 GB** για τα πέντε· στο ταβάνι βλέπει μήνυμα ότι **πολλά ακίνητα καλύπτει ο λογαριασμός
επαγγελματία**.

**Γιατί ΟΧΙ «1 GB ανά φάκελο» (η πρώτη εκδοχή της ίδιας μέρας)**: **παρακάμπτεται** — 50 άδειοι φάκελοι =
50 GB δωρεάν. Οι μεγάλοι (Google 15 GB · iCloud 5 GB · Dropbox 2 GB) βάζουν όριο **ανά λογαριασμό** ακριβώς
γι' αυτό.
**Γιατί ΟΧΙ σταθερό όριο ανά άνθρωπο**: τιμωρεί όποιον έχει περισσότερα σπίτια (5 σπίτια → 200 MB το καθένα).
**Γιατί ταβάνι στο 3**: συμφωνεί με το ADR-787 (*«αγγελίες ιδιώτη = 1-2»*) — πέρα από λίγα ακίνητα ο
άνθρωπος **είναι** ήδη επαγγελματίας· και το χειρότερο κόστος ανά ιδιώτη είναι **γνωστό** (3 GB).
| Μέγεθος ανά αρχείο | ό,τι ισχύει ήδη στο γραφείο (`FILE_TYPE_CONFIG` — π.χ. 50 MB) — **καμία δεύτερη τιμή** |
| Κοντά στο όριο | **ονομασμένο** μήνυμα με αριθμούς (*«950 MB από 1 GB — διαγράψτε κάτι για να ανεβάσετε νέο»*), **ποτέ** γενικό «απέτυχε» |

🔑 Οι αριθμοί ζουν σε **μία** σταθερά ρυθμίσεων· η Φ1 τους επιβάλλει **και** στον διακομιστή (ο πελάτης μόνο
προειδοποιεί).

#### 5.9.1 🌐 Έρευνα — τι κάνουν οι μεγάλοι *(εκτελεσμένη 2026-09-17)*

| Παίκτης | Όριο | Συμπίεση | Πληρωμή |
|---|---|---|---|
| **Google Photos / Drive** | **ανά λογαριασμό** (15 GB) | **επιλογή χρήστη**: «Αρχική ποιότητα» ή «Εξοικονόμηση χώρου» (φωτογραφία → 16 MP, βίντεο → 1080p)· **και οι δύο μετρούν** στο όριο από 06/2021 | συνδρομή Google One |
| **Google Drive / Dropbox (έγγραφα)** | ανά λογαριασμό | **ΠΟΤΕ** — το αρχείο φυλάσσεται όπως ανέβηκε | συνδρομή |
| **Zillow** (ιδιώτης FSBO) | ανά αγγελία, όριο **πλήθους** φωτογραφιών | κρατά το ανέβασμα, **σερβίρει** σμικρυμένες εκδοχές· έως 50 MB/φωτογραφία | δωρεάν |
| **Idealista** (ιδιώτης) | **2 δωρεάν αγγελίες** | — | πέρα από τις 2 **πληρωμένες**· και πληρωμένη προβολή |
| **Autodesk Construction Cloud** | **χωρίς** όριο χώρου | ποτέ | ανά θέση χρήστη |
| **Figma** (Starter) | **χωρίς** όριο χώρου — όριο **πλήθους αρχείων** | — | ανά θέση |
| **Adobe Scan · Microsoft Lens · Google Drive Scan** | — | η φωτογραφία χαρτιού **μετατρέπεται σε PDF** με ανίχνευση άκρων, διόρθωση προοπτικής, πολλές σελίδες, OCR | — |
| **Ψηφιακά υπογεγραμμένο PDF** (PAdES) | — | **οποιαδήποτε** επανασυμπίεση αλλάζει τα bytes ⇒ **ακυρώνει την υπογραφή** | — |
| **Ελληνικό δημόσιο** (Κτηματολόγιο κ.ά.) | — | τα ηλεκτρονικά πιστοποιητικά εκδίδονται **PDF με εγκεκριμένη ηλεκτρονική σφραγίδα/υπογραφή και χρονοσήμανση** | — |

**Συμπέρασμα**: οι καταναλωτικές αποθήκες μετρούν **bytes ανά λογαριασμό** (✅ συμφωνεί με το Ε-2)· τα
επαγγελματικά εργαλεία μετρούν **θέσεις/πλήθος**, όχι bytes. **Κανείς** δεν συμπιέζει έγγραφα· **όλοι** οι
σαρωτές παράγουν **PDF**.

*Πηγές*: [Google Photos — backup quality](https://support.google.com/photos/answer/6220791) ·
[Google Drive — scan documents](https://support.google.com/drive/answer/3145835) ·
[Zillow — photo uploading tips](https://zillow.zendesk.com/hc/en-us/articles/204023310-Photo-uploading-tips) ·
[Idealista — publicar anuncio](https://www.idealista.com/en/info/publicar-anuncio) ·
[Autodesk ACC — storage capacity](https://www.cadforum.cz/en/what-is-the-maximum-storage-capacity-of-your-account-in-bim360-tip12263) ·
[Adobe Scan — scan](https://www.adobe.com/devnet-docs/adobescan/android/en/scan.html) ·
[Microsoft — Office Lens to PDF](https://www.microsoft.com/en-us/microsoft-365/blog/2015/02/05/office-lens-now-converts-pictures-paper-documents-pdf-files-auto-classifies/) ·
[PDF Association — signature validation](https://pdfa.org/wp-content/uploads/2020/07/2020-10-07_PDF-Signature-Validation_comp.pdf) ·
[Κτηματολόγιο — πιστοποιητικά](https://www.ktimatologio.gr/e-services/12) ·
[LTAS — αποδεικτική δύναμη ηλεκτρονικών εγγράφων](https://ltas.gr/en/article/907). ⚠️ Τα όρια
Zillow/Idealista προέρχονται εν μέρει από δευτερογενείς πηγές — επανέλεγχος πριν χρησιμοποιηθούν ως αριθμοί.

#### 5.9.2 ✅ Ε-2α — Φωτογραφίες και βίντεο *(Giorgio 2026-09-17: «πρακτική των μεγάλων, χωρίς εκπτώσεις»)*

| Κανόνας | Πρότυπο |
|---|---|
| Κατά το ανέβασμα ο χρήστης **επιλέγει**: **«Αρχική ποιότητα»** ή **«Εξοικονόμηση χώρου»** (φωτογραφία ≤ 16 MP, βίντεο ≤ 1080p) — **και οι δύο μετρούν** στο όριο | Google Photos |
| Η οθόνη δείχνει **πριν** το ανέβασμα πόσο χώρο θα πιάσει κάθε επιλογή (*«Αρχική: 48 MB · Εξοικονόμηση: 9 MB»*) | 🏆 **πέρα από Google** — εκείνο δεν το δείχνει ανά ανέβασμα |
| Οι **σμικρυμένες εκδοχές προβολής** (μικρογραφίες, αγγελία) παράγονται από το σύστημα και **ΔΕΝ** μετρούν στο όριο | Zillow · Google |
| **Πανομοιότυπο** αρχείο που ξαναανεβαίνει (ίδιο αποτύπωμα) **δεν** ξαναμετρά — ο χρήστης βλέπει *«υπάρχει ήδη στον φάκελο»* | Google Photos (παράλειψη διπλότυπων) |
| **SSoT**: η συμπίεση εικόνας **υπάρχει ήδη** (`FileUploadZone.tsx` → `config/photo-compression-config.ts`) — **επεκτείνεται** με την επιλογή, **δεν** ξαναγράφεται. Η συμπίεση **βίντεο δεν υπάρχει** πουθενά ⇒ νέα, **κοινή** και για το γραφείο | N.0 |

⛔ **ΠΟΤΕ** συμπίεση σε νομικά ή τεχνικά **έγγραφα** — §5.10.

#### 5.9.3 ✅ Ε-2β — Συνδρομή πέρα από το όριο *(ΕΓΚΡΙΘΗΚΕ, Giorgio 2026-09-17)*

> ✅ **Απόφαση**: **εξαίρεση από το ADR-787 ΜΟΝΟ για αποθηκευτικό χώρο.** Πέρα από το όριο (§5.9) ο ιδιώτης
> μπορεί **προαιρετικά** να αγοράσει επιπλέον χώρο. **Η πληρωμένη προβολή/σειρά μένει ΑΠΑΓΟΡΕΥΜΕΝΗ για
> πάντα.** Ενεργοποιείται **όταν** υπάρξει σύστημα πληρωμών· ως τότε, στο όριο **ονομασμένο μήνυμα** χωρίς
> τιμή.
>
> ⛔ **Φρουρός της εξαίρεσης**: τίποτα που αγοράζεται **δεν** επιτρέπεται να αγγίζει **ταίριασμα, σειρά,
> ορατότητα ή σήμανση** αγγελίας ή φακέλου. Ο χώρος είναι **ποσότητα**, όχι **θέση**.

*Το σκεπτικό που κρίθηκε:*

Οι μεγάλοι **όλοι** πουλούν επιπλέον χώρο (Google One · iCloud+ · Dropbox) και η Idealista χρεώνει ιδιώτη
πέρα από 2 αγγελίες. ⚠️ Συγκρούεται **κατά γράμμα** με ADR-787 *«ο ιδιώτης δεν βλέπει ποτέ τιμή — ούτε
συνδρομή»*· ο **λόγος** εκείνης της απόφασης (η **σειρά** των αποτελεσμάτων να μην αγοράζεται — δηλαδή
ακριβώς η πληρωμένη προβολή της Idealista) **δεν** αφορά τον χώρο. Μετρημένο: **καμία** υποδομή πληρωμών
στο έργο. **Πρόταση**: εξαίρεση **μόνο** για χώρο, ενεργή **όταν** υπάρξει σύστημα πληρωμών· ως τότε
καθαρό μήνυμα στο όριο. Η πληρωμένη **προβολή** μένει **απαγορευμένη**.

### 5.10 📄 Πρόσληψη εγγράφων — **πύλες ανά είδος**, PDF για τα έγγραφα *(✅ Giorgio 2026-09-17)*

Η ιδέα του Giorgio: *«να υποχρεώνουμε τους χρήστες να ακολουθούν συγκεκριμένες **πύλες** (τις κάρτες
«Τι τύπο εγγράφου θα ανεβάσετε;») και για τα νομικά έγγραφα να απαιτούμε **PDF** και να τους εξηγούμε»*.
Η έρευνα (§5.9.1) την **επιβεβαιώνει** και τη **συμπληρώνει** σε ένα σημείο: οι μεγάλοι **δεν απορρίπτουν**
τη φωτογραφία χαρτιού — τη **μετατρέπουν** σε PDF με σαρωτή. Ένας άνθρωπος με χάρτινο συμβόλαιο και χωρίς
σαρωτή **δεν** πρέπει να μένει έξω.

| # | Κανόνας | Πρότυπο |
|---|---|---|
| 1 | **Πρώτα είδος, μετά αρχείο** — καμία «ελεύθερη» μεταφόρτωση σε νομικές κατηγορίες. Η οθόνη **υπάρχει ήδη** (*«Επιλέξτε πρώτα τον τύπο του εγγράφου»*) | υπάρχον `UploadEntryPointSelector` |
| 2 | Κάθε είδος εγγράφου δηλώνει **τι δέχεται** (π.χ. `acceptedIntake: ['pdf', 'scan']`) στον **ένα** κατάλογο (§5.3) — ισχύει **και** για το γραφείο | SSoT |
| 3 | **Νομικά/επίσημα** (συμβόλαια, τίτλοι, ΠΕΑ, ΗΤΚ, βεβαιώσεις, άδειες): **μόνο PDF** — είτε **πρωτότυπο PDF** είτε **σάρωση μέσα στην εφαρμογή** που **παράγει PDF**. Χαλαρή φωτογραφία από τη συλλογή **δεν** γίνεται δεκτή απευθείας — ο χρήστης οδηγείται στον σαρωτή | Adobe Scan · Lens · Drive Scan |
| 4 | **Σαρωτής**: ανίχνευση άκρων, διόρθωση προοπτικής, **πολλές σελίδες σε ένα PDF**, **OCR** (αναζητήσιμο) | ίδιοι |
| 5 | **Έλεγχος ποιότητας πριν την αποδοχή**: θολό, σκοτεινό, κομμένη σελίδα, αντανάκλαση ⇒ *«ξαναβγάλτε τη σελίδα 2 — δεν διαβάζεται η σφραγίδα»* | τραπεζικές εφαρμογές κατάθεσης επιταγής |
| 6 | **Πρωτότυπο PDF φυλάσσεται byte-προς-byte** — **καμία** επανασυμπίεση, ούτε μετονομασία μέσα στο αρχείο | PAdES — αλλιώς **ακυρώνεται η ψηφιακή υπογραφή** |
| 7 | **Εξήγηση σε απλά λόγια**, στην ίδια την πύλη: *«Για τα νομικά έγγραφα κρατάμε PDF, ώστε ο συμβολαιογράφος να διαβάζει κάθε σελίδα και σφραγίδα. Έχετε το χαρτί; Πατήστε "Σάρωση" και το φτιάχνουμε εμείς.»* | — |
| 8 | **SSoT**: ο σαρωτής **επεκτείνει** το υπάρχον `CameraCaptureDialog` + `usePhotoCapture` + προεπιλογή `DOCUMENT_SCAN` — **όχι** δεύτερη κάμερα. Βιβλιοθήκη ανίχνευσης άκρων/OCR: **έλεγχος άδειας N.5** πριν την εγκατάσταση | N.0 · N.5 |

#### 5.10.1 🏆 Πέρα από τους μεγάλους — **απόδειξη γνησιότητας**

Κανένα εργαλείο αποθήκευσης δεν λέει στον αναγνώστη **τι αξία έχει** το έγγραφο που βλέπει. Εμείς:

| # | Δυνατότητα | Τι κερδίζει ο συμβολαιογράφος |
|---|---|---|
| Γ1 | **Ανίχνευση ψηφιακής υπογραφής** κατά το ανέβασμα· σήμα **«Ψηφιακά υπογεγραμμένο — αναλλοίωτο»** (π.χ. πιστοποιητικό Κτηματολογίου) ή ⚠️ **«η υπογραφή δεν επαληθεύεται»** | ξέρει **αμέσως** αν κρατά πρωτότυπο ηλεκτρονικό έγγραφο |
| Γ2 | **Ετικέτα προέλευσης** παραγόμενη, όχι δηλωμένη: **«Πρωτότυπο ηλεκτρονικό»** · **«Σάρωση χαρτιού»** · **«Αρχείο PDF χωρίς υπογραφή»** | διαφορετική αποδεικτική βαρύτητα, **ορατή** |
| Γ3 | **Αποτύπωμα αρχείου** (SHA-256) τη στιγμή του ανεβάσματος, καταγεγραμμένο στο ιστορικό | αποδεικνύεται ότι βλέπει **ακριβώς** ό,τι ανέβηκε — καμία σιωπηλή αντικατάσταση |
| Γ4 | **Λήξη εγγράφων** με υπενθύμιση (π.χ. ΠΕΑ με ημερομηνία λήξης — πεδίο `energy.validUntil` **υπάρχει**) | *«το ΠΕΑ σας λήγει σε 2 μήνες — θα το ζητήσει ο συμβολαιογράφος»* |

⚠️ **Δηλωμένο όριο**: η **νομική** ισχύς κάθε είδους ελληνικού εγγράφου (ποια εκδίδονται με ηλεκτρονική
υπογραφή, ποια όχι) **δεν** επαληθεύτηκε ανά είδος — επαληθεύεται στη Φ2, είδος προς είδος, πριν γραφτούν
οι ετικέτες του Γ2.

---

## §6. 🏆 Πού ξεπερνάμε — μετρήσιμα

| # | Ισχυρισμός | Πώς μετριέται |
|---|---|---|
| 1 | Ο ιδιώτης έχει **όλες** τις δυνατότητες αρχείων του γραφείου | οι 4 καρτέλες αρχείων αποδίδονται από **το ίδιο** `EntityFilesManager` — grep: **0** δεύτερα συστατικά αρχείων |
| 2 | Κανένα αρχείο ιδιώτη εκτός `FileRecord` | μετά τη Φ1: `useOwnerPropertyMedia` **διαγραμμένο**, `owner_properties/` storage **άδειο** |
| 3 | Ο συμβολαιογράφος δεν βλέπει **τίποτα** πέρα από όσα του δόθηκαν | σουίτα κανόνων emulator (CHECK 3.16) |
| 4 | Ο φάκελος **επιβιώνει** της πώλησης και **αλλάζει χέρια** | Φ4 |

---

## §7. Άγκυρες — **κάθε μία πρέπει να κοκκινίζει σε μετάλλαξη**

| # | Τι φρουρεί | Μετάλλαξη που πρέπει να πιάσει |
|---|---|---|
| Α1 | `FileCustody` **και** με τα δύο πεδία δεν μεταγλωττίζεται | αφαίρεση του `?: never` |
| Α2 | `fileCustodyOf` → σωστή συλλογή/ρίζα για `org` και `personal` | ανταλλαγή κλάδων |
| Α3 | Κανόνας `files_personal`: άλλος χρήστης **δεν** διαβάζει · `super_admin` **δεν** διαβάζει | `userId == request.auth.uid` → `isAuthenticated()` |
| Α4 | Κανόνας `files` **ανέγγιχτος** — η υπάρχουσα σουίτα πράσινη χωρίς αλλαγή | οποιαδήποτε διακλάδωση `userId` μέσα στο `match /files` |
| Α5 | Ο κατάλογος ειδών εγγράφου είναι **ένας** | δεύτερο `entries-*` για ιδιώτη (CHECK 3.28 jscpd) |
| Α6 | Καλεσμένος `legal` διαβάζει **μόνο** τις παραχωρημένες κατηγορίες | παραχώρηση χωρίς φίλτρο κατηγορίας |

✅ **Α1 · Α2 (βήμα 1, 2026-09-17)** — `src/lib/workspace/__tests__/custody-scope.test.ts` (19 tests), πάνω στο **κοινό**
πρωτογενές. **Μετάλλαξη εκτελέστηκε**: ανταλλαγή κλάδων στο `custodyKindOf` ⇒ **4 κόκκινα** (2 εδώ + 2 στο υπάρχον
`audit-ledger.test.ts` — απόδειξη ότι το ιστορικό διαβάζει **την ίδια** υλοποίηση)· ψευδής κλάδος στο `custodyScopeOf` ⇒
**2 κόκκινα**· επαναφορά ⇒ 73/73 πράσινα. ⚠️ Το Α1 (`@ts-expect-error`) το επικυρώνει **μόνο** ο έλεγχος τύπων
(hook/CI, N.17). Το σκέλος «σωστή **συλλογή**» του Α2 μπαίνει με το `FILE_COLLECTION` στο βήμα 2β.2.

✅ **Α3 · Α4 (βήμα 2β.1, 2026-09-17)** — `tests/firestore-rules/suites/files-personal.rules.test.ts` (35 κελιά
`personalFileMatrix` + Π1 πολίτης χωρίς εταιρεία · Π2 rules-are-not-filters · Π3 admin/super_admin · Π4 ψευδο-εταιρεία
και θεματοφυλακή CDE από πελάτη) — **emulator 48/48**, και η υπάρχουσα `files.rules.test.ts` **πράσινη χωρίς αλλαγή**
(Α4) μαζί με την `entity-audit-trail-personal` (129/129 συνολικά). **Μεταλλάξεις σε αντίγραφο κανόνων**
(`FIRESTORE_RULES_FILE`, ποτέ το κοινό αρχείο): ανάγνωση `userId==uid`→`isAuthenticated()` ⇒ **14 κόκκινα** ·
χωρίς `cdeCustodyUnchanged()` στο update ⇒ **2** · γέννηση με πεδία CDE ⇒ **1**.

✅ **Α2 σκέλος συλλογής + κώδικας↔κανόνας (βήμα 2β.2, 2026-09-17)** — `src/lib/files/__tests__/file-custody.test.ts`
(διαμέρισμα ανά κάτοχο · `fileCustodyKindOf` fail-closed) · `services/file-record/__tests__/file-record-core-custody.test.ts`
(η λίστα πεδίων CDE διαβάζεται από το **ίδιο** `firestore.rules` μέσω του αναγνώστη της 3.87) ·
`services/filesystem/__tests__/validate-custody-upload-auth.test.ts` · `useEntityFiles-realtime.test.tsx` (διαμέρισμα ακροατή,
κανένα χειρόγραφο φίλτρο κατόχου για άνθρωπο, **σταθερή** συνδρομή σε νέο αντικείμενο `custody`, διαμέρισμα πράξης από το
**ίδιο** το αρχείο) · **Π5** στη σουίτα emulator: το φορτίο του **πραγματικού** builder + `buildFinalizeFileRecordUpdate` +
σχήματα κάδου/επαναφοράς περνούν τον κανόνα `files_personal`, και το ίδιο φορτίο στο `files` **αρνείται**.
**Μεταλλάξεις** (επαναφορά στην ίδια εντολή): ανταλλαγή κλάδων `FILE_COLLECTION` ⇒ **3 κόκκινα** · γέννηση ανθρώπου με
`cdeReadReach` ⇒ **1 κόκκινο** (jest) **και** Π5 κόκκινο στον emulator · έλεγχος ανεβάσματος χωρίς ταύτιση `uid` ⇒ **2 κόκκινα**.

✅ **Λήψη · εκκαθάριση · ΓΚΠΔ (βήμα 2β.3α, 2026-09-17)** — πέντε σουίτες, **9 μεταλλάξεις, 9 κόκκινες** (επαναφορά
byte-προς-byte στην ίδια εντολή):

| Σουίτα | Άγκυρα | Μετάλλαξη ⇒ αποτέλεσμα |
|---|---|---|
| `api/files/_shared/__tests__/owned-file-bytes.test.ts` **Ι0-Ι6** | ξένος άνθρωπος ⇒ κανένα byte · έγγραφο δικό μου με **ξένη** ρίζα Storage ⇒ άρνηση · δύο κάτοχοι ⇒ κανενός · εταιρικός καλών (και super admin) **δεν** βρίσκει προσωπικό αρχείο | προσωπικός κριτής πάντα `owned` ⇒ **1** · χωρίς έλεγχο ρίζας ⇒ **2** |
| `api/files/_shared/__tests__/file-custody-route.test.ts` **Π1-Π4** | άγνωστο `?custody=` ⇒ **400** χωρίς να ανοίξει πόρτα · απουσία ⇒ εταιρική πόρτα με **ίδια** ικανότητα · `personal` ⇒ **μόνο** `uid` · `?userId=` αγνοείται | «άγνωστο ⇒ εταιρεία» ⇒ **1** |
| `lib/cron/jobs/__tests__/file-purge.job.test.ts` **Δ1-Δ3** | κάδος **και** ορφανά σε `files` **και** `files_personal` · το διαμέρισμα ταξιδεύει από το ερώτημα στον γραφέα | μόνο `company` ⇒ **3** |
| `services/file-record/__tests__/file-purge-custody.test.ts` **Γ1-Γ3 · Υ1-Υ3** | `purged` στη συλλογή του αρχείου · **καμία** γραμμή προσωπικού στο εταιρικό βιβλίο · λάθος διαμέρισμα ⇒ αποτυχία (ποτέ γραφή αλλού) · ΓΚΠΔ και στα δύο · ο μεσίτης-συντάκτης **δεν** βρίσκει τον φάκελο του ιδιοκτήτη | γραφή πάντα `files` ⇒ **1** · γραμμή ίχνους για προσωπικό ⇒ **1** · σαρωτής μόνο `company` ⇒ **2** · υποκείμενο `createdBy` ⇒ **1** |
| `lib/files/__tests__/file-custody.test.ts` | `sharedFileCustodyKindOf`: κενό · μικτό · χωρίς κάτοχο ⇒ `null` | «το είδος του πρώτου» ⇒ **2** |
| `lib/auth/__tests__/personal-scope-consumers.test.ts` **Κ4** | οι δύο νέες πόρτες πολίτη (`file-custody-route` · `gdpr-subject-route`) δηλωμένες **με λόγο** · οι καταναλωτές κάθε πόρτας = κλειστό σύνολο | — |

⚠️ **Διορθώθηκε εδώ (όχι δικό μας ελάττωμα, αλλά στη διαδρομή μας)**: το `storage-path-custody.test.ts` Κ1.1/Κ1.2 ήταν
**κόκκινο στο main** από το βήμα 2α (ρίζα `people/` χωρίς γραμμή στον κριτή) ⇒ `people: 'user'`.

✅ **Α34 — ΕΚΔΟΣΕΙΣ ΠΡΟΣΩΠΙΚΟΥ ΑΡΧΕΙΟΥ (βήμα 2β.3β, 2026-09-17)** —
`src/services/iso19650/__tests__/container-personal-custody-anchor.test.ts` (15 tests) ·
`src/lib/workspace/__tests__/custody-scope.test.ts` **Α2.ε** (11 νέα) ·
`src/app/api/files/[fileId]/versions/__tests__/versions-routes.test.ts` (16, ξαναγράφτηκε για τις **δύο** πόρτες) ·
emulator **Π6** στο `tests/firestore-rules/suites/files-personal.rules.test.ts`.

**Μεταλλάξεις: 9/9 ΚΟΚΚΙΝΕΣ, bytes επαναφερμένα στην ίδια εκτέλεση** (Μ1-Μ9):

| # | Μετάλλαξη | Ποια κοκκίνισε |
|---|---|---|
| Μ1 | το `writeSuccession` γράφει **και** `cdeState: 'SUPERSEDED'` | Α34.1 |
| Μ2 | `ACT_REGIMES.share` δέχεται `versions-only` | Α33.3 (**και** του άλλου agent) |
| Μ3 | αφαίρεση του προσωπικού κλάδου της `custodyOnEntry` | Α34.10β |
| Μ4 | ο διάδοχος γεννιέται με `companyId` αντί `...custody` | Α34.6 |
| Μ5 | ο σπόρος χρησιμοποιεί σκέτο id αντί `fileCustodyKey` | Α34.7 |
| Μ6 | ο γραφέας γράφει **πάντα** στο εταιρικό διαμέρισμα | Α34.1/Α34.3 |
| Μ7 | το `isOwnedByCustody` συγκρίνει **μόνο ids**, αγνοώντας διαμέρισμα | Α2.ε |
| Μ8 | αφαίρεση του φρουρού ημερολογίου ⇒ προσωπική πράξη στο εταιρικό βιβλίο | Α34.9 |
| Μ9 | η στοίβα ρωτά **πάντα** το εταιρικό διαμέρισμα | Α34.8 |

🔴 **ΔΥΟ ΜΕΤΑΛΛΑΞΕΙΣ ΒΓΗΚΑΝ ΠΡΩΤΑ ΠΡΑΣΙΝΕΣ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΙΟ ΧΡΗΣΙΜΟ ΕΥΡΗΜΑ ΤΟΥ ΒΗΜΑΤΟΣ:**

- **Μ3**: αφαιρώντας τον προσωπικό κλάδο, η **συμπεριφορά μένει ίδια** — το `resolveContainerProject`
  διαβάζει `raw.companyId`, δεν το βρίσκει, και απαντά `'no-entity'` ⇒ πάλι `versions-only` ⇒ πάλι
  `no-project`. Κάθε έλεγχος πάνω στην **έκβαση** ήταν τυφλός, και ο κλάδος **φαινόταν περιττός**.
  Δεν είναι: κρατά τον **αληθινό λόγο** (το αρχείο *δηλώνει* οντότητα — απλώς δεν έχει εταιρεία) και
  **μηδέν αναγνώσεις** αλυσίδας έργου ανά πράξη. ⇒ Νέα άγκυρα **Α34.10β**, που ρωτά τον **ίδιο τον
  απαντητή** (`custodyOnEntry`), όχι την έκβαση.
- **Μ7**: μια υλοποίηση `(doc.userId ?? doc.companyId) === (owner.userId ?? owner.companyId)` περνούσε
  **κάθε** υπάρχον test, επειδή στα σενάριά τους τα δύο αναγνωριστικά **τυχαίνει** να διαφέρουν. ⇒ Νέα
  γραμμή **Α2.ε** με **ταυτόσημα ids σε διαφορετικά διαμερίσματα**: το διαμέρισμα κρίνεται **πρώτο**,
  αλλιώς η απόδειξη είναι σύμπτωση.

⚠️ **Καμία αλλαγή στο `firestore.rules`** σε αυτό το βήμα: τα `supersededByFileId`/`supersededAt`
ήταν **ήδη** στο `cdeCustodyKeys()`, και το `match /files_personal` **ήδη** καλεί το
`cdeCustodyUnchanged()` — άρα ο πελάτης ήταν ήδη κλειστός και ο γραφέας (Admin SDK) ήδη ανοιχτός.
Το Π6 **επαληθεύει από τη μεριά του πελάτη** ό,τι γράφει ο γραφέας εκτός κανόνων.

---

## §8. Φάσεις

⚠️ **Η σειρά είναι αιτιακή.** Χωρίς θεματοφυλακή (Φ0) κάθε οθόνη ιδιώτη θα χρειαζόταν δεύτερο αγωγό.

| Φ | Περιεχόμενο | Προϋπόθεση |
|---|---|---|
| **Φ0** | 🔑 `FileCustody` (§5.2): τύπος · διαδρομή · κανόνες Storage + Firestore (σουίτα, CHECK 3.16) · `EntityFilesManager` `custody` prop στα 17 σημεία απόδοσης · `useEntityFiles` · gateway · purge/gdpr-delete · ευρετήρια | ADR-862 Φ0 **Β11 κλειστό** |
| **Φ1** | Οντότητα φακέλου (Ε-1) · σελίδα στον προσωπικό χώρο με καρτέλες **Κάτοψη · Έγγραφα · Φωτογραφίες · Βίντεο · Ιστορικό** (ίδια συστατικά) · **απορρόφηση** `useOwnerPropertyMedia` + μετανάστευση `owner_properties/` → `FileRecord` *(μέτρηση αριθμού αρχείων **πριν** — Firestore MCP)* · το `AttestationDocumentField` ακολουθεί τη θεματοφυλακή της αγγελίας (§2.3 ⚠️) | Φ0 |
| **Φ1β** | **Όριο χώρου** ανά άνθρωπο (§5.9 — επιβολή στον διακομιστή) · **επιλογή ποιότητας** φωτογραφίας/βίντεο + εκδοχές προβολής εκτός ορίου + παράλειψη διπλοτύπων (§5.9.2) · συμπίεση **βίντεο** ως κοινή ικανότητα | Φ1 |
| **Φ2** | Είδη εγγράφου που λείπουν (§5.3) **και στο γραφείο** · δήλωση `acceptedIntake` ανά είδος + **σαρωτής εγγράφων → PDF** με έλεγχο ποιότητας (§5.10, επέκταση `CameraCaptureDialog` · N.5 για βιβλιοθήκη) · **απόδειξη γνησιότητας** Γ1-Γ4 (§5.10.1) · πεδία ΗΤΚ / παροχών + **κατηγορία ευαισθησίας πεδίου** (§5.4) · **αλυσίδα κυριότητας Β+** (§5.5: εξαγωγή κοινού τύπου τίτλου από `SurveyTitleDeed` · κλειστό λεξιλόγιο πράξης · κενά/ποσοστά/20ετία · βάρη · συμφιλίωση με κτηματολογικό φύλλο · πρόταση από τοπογραφικό) · i18n el+en (N.11) | Φ1 |
| **Φ3** | Πρότυπο **`legal`** + οικοδεσπότης **προσωπικός χώρος** — ως επέκταση του ADR-862 Φ1/Φ2 · **μέσα μεσίτη με δηλωμένη άδεια** (IPTC) + αυτόματη απόσυρση + «Ζητήστε άδεια» (§5.6.1) · **σκάλα αγοραστή** 0/1/2 + προβολή χωρίς λήψη + υδατογράφημα (από ADR-862 Φ6) + «τι κοίταξε ο καθένας» (§5.6.3) · **νομικός έλεγχος** των διατυπώσεων (άδεια φωτογραφιών · σκαλί 0) | ADR-862 Φ1 · Φ2 · Φ6 (υδατογράφημα) |
| **Φ3β** | **Αγορά επιπλέον χώρου** (§5.9.3) | ύπαρξη συστήματος πληρωμών |
| **Φ4** | Παράδοση φακέλου στον αγοραστή (§5.7) | Φ3 |

**Πύλες που θα ακουμπήσουμε**: 3.10 / 3.35 *(tenant scope — η `files_personal` με γραμμένο λόγο `mode:'userId'`)* ·
3.16 *(κάλυψη κανόνων)* · 3.17 *(ίχνος)* · 3.8 / 3.33 *(i18n)* · 3.28 *(jscpd)* · 3.62 *(δημόσια επιφάνεια
`dxf-viewer`, αν η Κάτοψη εισάγει)* · 3.86 *(απόδειξη ανάπτυξης κανόνων/ευρετηρίων)* · N.6.

---

## §9. 🔶 Αποφάσεις που ανήκουν στον Giorgio

| # | Ερώτηση | Σύσταση | Γιατί |
|---|---|---|---|
| **Ε-1** ✅ | Φάκελος = **νέα οντότητα** ή επέκταση `OwnerProperty`; | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-17: νέα, χωριστή οντότητα**· η αγγελία **δείχνει** σε αυτήν (§5.1) | άλλος κύκλος ζωής· φάκελος **χωρίς** αγγελία· πολλές αγγελίες ανά φάκελο στον χρόνο· ο φάκελος **αλλάζει χέρια**, η αγγελία όχι |
| **Ε-2** ✅ | Ανώτατο όριο αποθηκευτικού χώρου για τον ιδιώτη; | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-17: κοινό όριο ανά άνθρωπο = 1 GB × φάκελοι, ταβάνι 3 φάκελοι (3 GB) · έως 3 βίντεο ανά φάκελο** (§5.9) | δίκαιο για όποιον έχει πολλά σπίτια **και** μη παρακάμψιμο· ταβάνι σύμφωνο με ADR-787 |
| **Ε-2α** ✅ | **Συμπίεση** φωτογραφιών/βίντεο; | ✅ **2026-09-17: επιλογή χρήστη «Αρχική / Εξοικονόμηση» όπως Google, και οι δύο μετρούν· εκδοχές προβολής δεν μετρούν· ΠΟΤΕ συμπίεση εγγράφων** (§5.9.2) | πρακτική μεγάλων (§5.9.1) |
| **Ε-2β** ✅ | **Συνδρομή** πέρα από το όριο του λογαριασμού; | ✅ **ΕΓΚΡΙΘΗΚΕ 2026-09-17: εξαίρεση από ADR-787 ΜΟΝΟ για χώρο· πληρωμένη προβολή για πάντα απαγορευμένη· ενεργή όταν υπάρξει σύστημα πληρωμών** (§5.9.3) | όλοι οι μεγάλοι πουλούν χώρο· ADR-787 απαγορεύει κατά γράμμα |
| **Ε-2γ** ✅ | Πύλες ανά είδος και **PDF** για νομικά έγγραφα; | ✅ **2026-09-17: ναι — PDF πρωτότυπο ή σάρωση εντός εφαρμογής που παράγει PDF, με έλεγχο ποιότητας, εξήγηση, και απόδειξη γνησιότητας** (§5.10) | ιδέα Giorgio + Adobe Scan/Lens/Drive + PAdES |
| **Ε-3** ✅ | Σε ποιον ανήκει ό,τι ανεβάζει ο **μεσίτης**; | ✅ **2026-09-17: χωριστά ανά είδος** — έγγραφα του σπιτιού στον **ιδιοκτήτη** (μεσίτης ως καλεσμένος)· φωτογραφίες/βίντεο στο **γραφείο** με δηλωμένη άδεια που **λήγει με την εντολή** (§5.6.1) | πνευματικά δικαιώματα φωτογράφου · VHT v. Zillow · NAR |
| **Ε-4** ✅ | Αριθμοί παροχής: ποιος τους βλέπει; | ✅ **2026-09-17: προεπιλογή ανά ρόλο (`legal`/`consultant` ναι · μεσίτης/αγοραστής όχι), αλλάξιμη ανά καλεσμένο· `supplier` και κοινό ΠΟΤΕ, δομικά** (§5.4) | προσωπικά δεδομένα νοικοκυριού |
| **Ε-5** ✅ | Ιστορικό τίτλων: πόσο πλήρες; | ✅ **2026-09-17: «Β+» — πλήρης αλυσίδα (κρίκοι · κλειστό λεξιλόγιο · έλεγχος κενών/ποσοστών/20ετίας · βάρη · συμφιλίωση με κτηματολογικό φύλλο · πρόταση από τοπογραφικό), πάνω σε `SurveyTitleDeed` + `PropertyOwnerEntry` + συμφιλίωση ADR-759** (§5.5) | title companies · ελληνικός έλεγχος τίτλων · υπάρχων κώδικας |
| **Ε-6** ✅ | Πρόσβαση **υποψήφιου αγοραστή**; | ✅ **2026-09-17: σκάλα 3 σκαλιών** — 0 αγγελία (σύνοψη, χωρίς έγγραφα) · 1 ενδιαφερόμενος (έγκριση κατόχου, μόνο προβολή, υδατογράφημα, λήξη 14 ημ.) · 2 συμφωνία (πλήρη, με δικηγόρο) (§5.6.3) | UK Material Information · εικονικές αίθουσες δεδομένων |
| **Ε-Φ0-2** 🔶 | **Όριο / λήξη εκδόσεων** στον προσωπικό χώρο — και μετρούν στο όριο χώρου (§5.9); | 🔶 **ΑΝΟΙΧΤΟ (νέο 2026-09-17, §2.6.10 Γ)**. Σύσταση: **όριο πλήθους ανά αρχείο** (πρότυπο Box: 10 στο Personal Pro), **ποτέ** ρολόι — και η λήξη **γραμμένη** στο έγγραφο (`purgeAt`, ADR-864 §21), όχι αόρατη. | **Κανείς από τους μεγάλους δεν κρατά απεριόριστες εκδόσεις στον προσωπικό χώρο**: Google Drive εκκαθαρίζει στις **30 ημέρες** ή όταν το αρχείο έχει **100** μη-`keepForever` αναθεωρήσεις (`keepForever` ≤ **200**, και **μετρούν στον χώρο**)· Dropbox Basic/Plus **30 ημέρες**· Box Personal Free **καμία** έκδοση, Personal Pro **10**. Και **κανείς δεν σβήνει την κεφαλή**. 🏆 Google και Dropbox εκκαθαρίζουν με **ρολόι που ο άνθρωπος δεν βλέπει**· το Box με μετρητή που ορίζει **admin** — τον οποίο ο ιδιώτης δεν έχει. Εδώ κάθε έκδοση είναι `FileRecord` με **ορατά** `purgeAt`/`hold`, άρα μπορούμε να κάνουμε τη λήξη **αναγνώσιμη από τον κάτοχο**. ⚠️ Η Φ0 **δεν υλοποιεί και δεν υπόσχεται** όριο· το `MAX_STACK_DEPTH = 200` είναι φρένο **ανάγνωσης** (κύκλοι · αλλοιωμένα δεδομένα), **ποτέ** πολιτική διατήρησης. |

---

## §10. Δηλωμένα όρια αυτού του εγγράφου

- **Δεν** διαβάστηκε ο κώδικας της καρτέλας «Πληροφορίες» γραμμή-γραμμή· η κρίση του §3.2 στηρίζεται
  στα στιγμιότυπα και στον τύπο `Property` (`buildingId`/`floorId` υποχρεωτικά).
- **Δεν** μετρήθηκε ο αριθμός αρχείων στο `owner_properties/` του ζωντανού bucket — μετράται **πριν** τη Φ1.
- **Δεν** ελέγχθηκε αν οι σελίδες **κτιρίων/έργων** (`building-management/tabs/*`, `projects/*Tab`)
  έχουν κάτι που ο φάκελος χρειάζεται πέρα από το `EntityFilesManager` — είναι καταναλωτές του ίδιου
  συστατικού, άρα η Φ0 τους αγγίζει μόνο μηχανικά.
- ✅ **Επαληθεύτηκε στη Φ0 (§2.6.4)**: **17** σημεία απόδοσης JSX, όχι 20. Οι 20 είχαν μετρηθεί με `grep -rln EntityFilesManager` (εκτός `shared/files`)· ο ακριβής
  αριθμός επαληθεύεται στη Φ0.
- Η αναφορά στην EPBD («ψηφιακό βιβλίο κτιρίου») είναι **πλαίσιο**, όχι νομική υποχρέωση που
  ελέγχθηκε για την Ελλάδα.

---

## §11. 🔗 Αμφίδρομες παραπομπές

| Έγγραφο | Τι του ζητείται |
|---|---|
| **ADR-862** | §5.3.1: οικοδεσπότης `WorkspaceRef` (όχι μόνο οργανισμός) · §5.4: πρότυπο `legal` |
| **ADR-759** | το `SurveyTitleDeed` εξάγεται σε **κοινό τύπο τίτλου** · το `kind` γίνεται **κλειστό λεξιλόγιο** · ο μηχανισμός συμφιλίωσης επαναχρησιμοποιείται για το κτηματολογικό φύλλο (Ε-5) |
| **ADR-244** | `PropertyOwnerEntry` ως σχήμα «σε ποιον + ποσοστό» των κρίκων |
| **ADR-709** | δεύτερη **ρίζα** κατόχου (`/people/{userId}`), ίδιο σχήμα |
| **ADR-191** | `FileCustody` στο σύστημα αρχείων |
| **ADR-195** | το πρότυπο του §2.4 εφαρμόζεται και στα αρχεία |
| **ADR-777 Α14** | το `useOwnerPropertyMedia` απορροφάται στη Φ1 |
| **ADR-787 Ε-3** | επιβεβαίωση: καμία ψευδο-εταιρεία |
| **ADR-787** «ο ιδιώτης δεν πληρώνει ποτέ» | ✅ **σημειώθηκε εκεί** η εξαίρεση **μόνο για χώρο** (Ε-2β, §5.9.3) |

---

## §12. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-17 | Δημιουργία. SSoT audit των 6 καρτελών «Διαχείριση Ακινήτων» (10 στιγμιότυπα Giorgio) · εντοπισμός του τείχους `companyId` σε 5 σημεία · του δεύτερου αγωγού `useOwnerPropertyMedia` · της τρίτης διαδρομής `AttestationDocumentField` · του προηγούμενου `audit-ledger.ts` ως λύσης. Απόφαση: **ίδιος κώδικας, νέα θεματοφυλακή**. 6 ανοιχτές αποφάσεις. |
| 2026-09-17 | ✅ **Ε-1 αποφασίστηκε (Giorgio)**: ο φάκελος είναι **νέα, χωριστή οντότητα** και η αγγελία δείχνει σε αυτήν. §5.1 εμπλουτίστηκε με τους πέντε κανόνες που απορρέουν + ανοιχτό τεχνικό σημείο Φ1 (φάκελοι για υπάρχουσες αγγελίες). |
| 2026-09-17 | ✅ **Ε-2 αποφασίστηκε (Giorgio)**: 1 GB ανά φάκελο + έως 3 βίντεο (§5.9). Άνοιξαν **Ε-2α** (συμπίεση — το γραφείο ήδη συμπιέζει εικόνες) και **Ε-2β** (συνδρομή — σύγκρουση με ADR-787). |
| 2026-09-17 | 🔁 **Ε-2 αναθεωρήθηκε (Giorgio)**: το «1 GB ανά φάκελο» παρακάμπτεται με άδειους φακέλους ⇒ **κοινό όριο ανά άνθρωπο = 1 GB × φάκελοι, ταβάνι 3 (3 GB)**. Το όριο βίντεο (3/φάκελο) μένει. §5.9 ξαναγράφτηκε με τα απορριφθέντα και τον λόγο. |
| 2026-09-17 | 🌐 **Έρευνα μεγάλων** (§5.9.1: Google Photos/Drive, Dropbox, Zillow, Idealista, Autodesk ACC, Figma, Adobe Scan, Lens, PAdES, Κτηματολόγιο). ✅ **Ε-2α** (επιλογή ποιότητας όπως Google) · ✅ **Ε-2γ** νέο (πύλες ανά είδος + PDF/σαρωτής για νομικά, §5.10) · 🏆 §5.10.1 απόδειξη γνησιότητας (υπογραφή · προέλευση · αποτύπωμα · λήξη) · 🔶 **Ε-2β** πρόταση, αναμένει επιβεβαίωση. §4: καταγράφηκε η οδηγία Giorgio «πρακτική μεγάλων, χωρίς εκπτώσεις». |
| 2026-09-17 | ✅ **Ε-2β εγκρίθηκε (Giorgio)**: εξαίρεση από ADR-787 **μόνο για αποθηκευτικό χώρο** + φρουρός «ό,τι αγοράζεται δεν αγγίζει σειρά/ορατότητα/σήμανση». Αμφίδρομη σημείωση στο ADR-787. |
| 2026-09-17 | ✅ **Ε-3 αποφασίστηκε (Giorgio, επιλογή Γ + έρευνα)**: έγγραφα σπιτιού → ιδιοκτήτης· μέσα μεσίτη → γραφείο με δηλωμένη άδεια (IPTC) που λήγει με την εντολή. 🌐 Έρευνα: NAR · VHT v. Zillow · όροι Idealista · ελληνική πνευματική ιδιοκτησία. 🏆 Δ1-Δ4 (αυτόματη απόσυρση · άδεια με ένα κλικ · «Ζητήστε άδεια» · ανίχνευση αντιγραφής). Νέα §5.6.1. |
| 2026-09-17 | ✅ **Ε-4 αποφασίστηκε (Giorgio, επιλογή Γ)**: αριθμοί παροχής — προεπιλογή ανά ρόλο, αλλάξιμη ανά καλεσμένο· `supplier`/κοινό ποτέ (δομικά). Γενικεύτηκε ως **κατηγορία ευαισθησίας πεδίου** (§5.4). |
| 2026-09-17 | 🌐 **Έρευνα για Ε-5** (§5.5.1): title companies (αλυσίδα + Schedule B) · ελληνικός έλεγχος τίτλων 20ετίας + βάρη · κτηματολογικό φύλλο. 🔎 SSoT: **`SurveyTitleDeed` (ADR-759) υπάρχει ήδη** ως κρίκος, με `Sourced<>`· `PropertyOwnerEntry` (ADR-244) για ποσοστά· πρότυπο συμφιλίωσης ADR-759. Η απόφαση Ε-5 εκκρεμεί. |
| 2026-09-17 | ✅ **Ε-5 αποφασίστηκε (Giorgio, «Β+»)**: πλήρης αλυσίδα κυριότητας — 10 κανόνες στην §5.5. Απαίτηση SSoT: εξαγωγή κοινού τύπου τίτλου από `SurveyTitleDeed` + κλειστό λεξιλόγιο είδους πράξης (ωφελεί και ADR-759). |
| 2026-09-17 | 🌐 **Έρευνα για Ε-6** (§5.6.2): UK Material Information Α/Β/Γ · εικονικές αίθουσες δεδομένων (σταδιακή πρόσβαση, εμπιστευτικότητα, μόνο προβολή, υδατογράφημα, ίχνος). Η απόφαση Ε-6 εκκρεμεί. |
| 2026-09-17 | ✅ **Ε-6 αποφασίστηκε (Giorgio)**: σκάλα 3 σκαλιών (§5.6.3) + 🏆 Σ1-Σ3. **Όλες οι αποφάσεις του §9 πάρθηκαν.** |
| 2026-09-17 | 🟡 **Φ0 βήμα 1 — ΥΛΟΠΟΙΗΣΗ** *(μόνο ό,τι δεν συγκρούεται με το ADR-862 Φ0 Β11, που δεν έχει κλείσει)*. 🔎 **§2.6 SSoT audit με grep**: το τείχος έχει **7** σημεία, όχι 5 (+ χωνί `buildPendingFileRecordData` · + `validateUploadAuth`)· **17** σημεία απόδοσης `EntityFilesManager`, όχι 20· `purge`/`gdpr-delete` **δεν** παίρνουν κάτοχο — πρέπει να σαρώνουν και τα δύο διαμερίσματα (διόρθωση §5.8)· `cdeCustodyUnchanged()` είναι **τοπική** και πρέπει να ανέβει σε καθολική· CHECK 3.35 ενεργοποιείται με μία γραμμή `tenant-config`. 🌐 **§2.6.6 έρευνα** Google Drive (ένα αρχείο σε ακριβώς ένα δίσκο· μετακίνηση = αλλαγή κατόχου ⇒ Φ4 παράδοση = μετακίνηση) + Figma Drafts. 🔑 **Εύρημα σχεδιασμού (§2.6.5)**: το «ίδιο σχήμα με το `audit-ledger`» θα ήταν **δίδυμο** ⇒ **εξήχθη** το κοινό `src/lib/workspace/custody-scope.ts`· το `src/lib/audit/audit-ledger.ts` έγινε ψευδώνυμα + `AUDIT_LEDGER_COLLECTION satisfies CustodyPartition` (οι 11 εισαγωγείς ανέγγιχτοι). Άγκυρες Α1/Α2 (§7) με μετάλλαξη· `jscpd:diff` καθαρό. 🛡️ **N.12**: νέο module `custody-scope` στο `.ssot-registry.json` (απαγορεύει δεύτερο φρουρό `userId?: never`/`companyId?: never` και δεύτερο ορισμό των συναρτήσεων) **με την απόδειξή του** στο `scripts/lib/ssot/pattern-proofs.js` (2/2 patterns αποδεδειγμένα· 0 ευρήματα εκτός allowlist ⇒ καμία αλλαγή baseline). ⚠️ Εκτός εμβέλειας, προϋπάρχον: το ταβάνι «patterns χωρίς απόδειξη» του `registry-golden-regex.test.js` είναι **ήδη** 602 > 600 στο HEAD — δεν το ανέβασε αυτό το βήμα, δεν το «διόρθωσε» σιωπηλά. ⏳ Το `file-custody.ts` **αναβλήθηκε** στο βήμα 2 (θέλει `FILES_PERSONAL` — WIP Β11 — και καταναλωτή, αλλιώς CHECK 3.22). §5.2 πίνακας +σημεία 6-9. ⚠️ Εκτός εμβέλειας, προϋπάρχον: το `personal-scope-consumers.test.ts` (Κ2 · Π) είναι **κόκκινο** από δύο διαδρομές του ADR-864 (`mandate-evidence` · `private-marketing`) — δεν το άγγιξε αυτό το βήμα. |
| 2026-09-17 | 🟡 **Φ0 βήμα 2α — ΣΤΡΩΜΑ STORAGE** *(Giorgio: «μόνο τα καθαρά αρχεία τώρα» — το Β11 ακόμη ανοιχτό· κανένα αρχείο παρακάτω δεν ήταν WIP του άλλου agent)*. **(1) `storage-path.ts`**: `StoragePathParams = CustodyScope & συντεταγμένες` · **μία** ρίζα `buildCustodyStorageRoot` (`companies/{companyId}` \| `people/{userId}`) για builder **και** προθέματα σάρωσης · `parseStoragePath` δέχεται **δύο** ρίζες (άγνωστη ⇒ `null`), legacy `projects/` **μόνο** κάτω από `companies/` · νέο `STORAGE_PATH_SEGMENTS.PEOPLE`. **(2) `storage-path-validation.ts`**: «ακριβώς ένας κάτοχος» μέσω `isWritableCustodyScope` — απουσία/διπλός ⇒ σφάλμα στο `companyId` (ό,τι ίσχυε), άκυρο τμήμα ⇒ σφάλμα στο πεδίο του κλάδου. **(3) Αναγνώστες**: migration normalize-storage-paths (προσωπικό ⇒ ήδη κανονικό) · `file-path-tree` (τμήμα `people`). Οι ~12 εταιρικοί καλούντες **ανέγγιχτοι** (επαληθεύτηκε: όλοι περνούν literal μόνο με `companyId`). **(4) `storage.rules`**: `@pathId: canonical_personal` — `isOwner(userId)` σε read/write/delete, write + μέγεθος + τύπος, **ούτε** super_admin. **(5) Κάλυψη (CHECK 3.19)**: εγγραφή `canonical_personal` + 🧹 Boy Scout: οι **πανομοιότυποι** χειρόγραφοι πίνακες `temp` και `owner_property_media` → **ένα** `ownerOnlyMatrix()` (αλλιώς θα γινόταν τρίτο αντίγραφο) · νέα σουίτα `canonical-path-personal.storage.test.ts` (πίνακας + Π1 ξένο uid στη ρίζα + Π2 τύπος αρχείου). **Επαλήθευση**: jest 110/110 · **emulator 42/42** (νέα σουίτα + `temp` + `owner_property_media` με τον κοινό πίνακα) · CHECK 3.19 `--all` exit 0 · `jscpd:diff` καθαρό · **μεταλλάξεις**: ρίζα builder `people`→`companies` ⇒ 2 κόκκινα · αναγνώστης `people`⇒`companyId` ⇒ 2 κόκκινα · κανόνας read `isOwner`→`isAuthenticated` ⇒ **3 κόκκινα στον emulator** · όλες επανήλθαν (`storage.rules` byte-προς-byte). ⚠️ **Εντοπίστηκε, ΔΕΝ αγγίχθηκε**: ο proxy `api/storage/file/[...path]` ελέγχει χειρόγραφα `segments[0] !== 'companies'` πίσω από `withAuth` (μόνο οργανισμός) — σωστό για τον writer του (`public-upload.service`)· αν ποτέ σερβίρει προσωπικά αρχεία θέλει δική του απόφαση. ⏳ **Βήμα 2β περιμένει το Β11**: `FILES_PERSONAL` + `tenant-config` · `firestore.rules` `files_personal` (με `cdeCustodyUnchanged` καθολική) · δείκτες · `file-custody.ts` + `FILE_COLLECTION` · χωνί `buildPendingFileRecordData` · `validateUploadAuth` · `EntityFilesManager` `custody` (17 σημεία) · `useEntityFiles` · purge/gdpr-delete και στα δύο διαμερίσματα · σουίτα κανόνων Firestore (CHECK 3.16). |
| 2026-09-17 | 🔎 **Φ0 βήμα 2β — SSoT audit (πριν τον κώδικα)**, μετά το commit των ADR-862 Β11 + Β14 (HEAD `dd5bf4ee`). Νέα **§2.6.7**: το `FILES_PERSONAL` **δεν** χρειάζεται δρόμους ανάγνωσης (αρκεί `tenant-config` `mode: 'userId'`) · 🔴 τυφλό σημείο CHECK 3.15 σε κλειδί συλλογής μέσω `CustodyPartition` (ήδη υπαρκτό στο ιστορικό) · γέννηση γράφει πάντα `cdeReadReach: 'tenant'` · διαδρομές Β14 μόνο εταιρεία · τρία αρχεία στο όριο 500 γρ. · 🔶 ανοιχτή **Ε-Φ0-1** (CDE για προσωπικά αρχεία). Καμία αλλαγή κώδικα. |
| 2026-09-17 | ✅ **Ε-Φ0-1 αποφασίστηκε (Giorgio: «ό,τι κάνουν οι μεγάλοι»)**: προσωπικό αρχείο = **εκδόσεις ΝΑΙ, φάσεις CDE ΟΧΙ** — Google Drive «Ο Δίσκος μου» έχει Manage versions χωρίς ροή έγκρισης· οι καταστάσεις ISO 19650 οργανώνουν ροή **μεταξύ ομάδων εργασίας**. Εύρημα σχεδιασμού: το `supersede` είναι πράξη του **ενός** γραφέα CDE και γράφει πάντα `cdeState`/`cdeReadReach` ⇒ στο 2β.3 ο γραφέας **χωρίζει** διαδοχή από φάση (παραμένει ένας). Το 2β σπάει σε 4 υπο-βήματα (θεμέλιο · γέννηση/λίστα/κάδος · εκδόσεις · δραστηριότητα). |
| 2026-09-17 | 🟡 **Φ0 βήμα 2β.1 — ΘΕΜΕΛΙΟ**. **(1) Πύλες τυφλές σε διαμερίσματα κατόχου** (§2.6.7 #3): ο κοινός αναγνώστης `scripts/_shared/firestore-ast-loaders.js` ανακαλύπτει κάθε `satisfies CustodyPartition` (από τον **τύπο**) και οι CHECK **3.15** / **3.35** διπλασιάζουν το σημείο σε **έναν κλάδο ανά κάτοχο**, με ψευδώνυμα εισαγωγής και `const c = COLLECTIONS[X[kind]]`· **3.87**: σχετικότητα και για `FILES_PERSONAL`/`FILE_COLLECTION` (το `\b` δεν έπιανε το `_PERSONAL`), Κ5 και μέσω διαμερίσματος. 🔴 **Τι αποκάλυψε αμέσως**: (α) ψευδώς θετικό της 3.15 — παραλλαγή «super_admin χωρίς φίλτρο» για `mode:'userId'`, όπου η υπηρεσία **ποτέ** δεν αφήνει το φίλτρο ⇒ διορθώθηκε η πύλη ώστε να ακολουθεί την υπηρεσία· (β) το `EntityAuditService.queryChangesAfter` (CDC backup, σαρώνει κάθε μισθωτή εκ σχεδιασμού) **δεν είχε κριθεί ποτέ** ⇒ `tenant-scope-exempt` **με λόγο** (η 3.35 δείχνει πλέον 1 αρχείο βελτιωμένο· η baseline **δεν** ξαναγράφτηκε — κοινό δέντρο). 🧹 Boy Scout: τρεις loaders με ίδια διάσχιση object literal → **ένα** `recordPropertiesOf` (έξοδος byte-προς-byte ίδια). **(2)** `COLLECTIONS.FILES_PERSONAL` · `tenant-config` `FILES_PERSONAL: mode 'userId'` (**κανένα** `READ_PATHS`). **(3) `firestore.rules`**: λίστα θεματοφυλακής σε **καθολικό** `cdeCustodyKeys()` + καθολικό `cdeCustodyUnchanged()` (το `match /files` τα καλεί χωρίς αλλαγή συμπεριφοράς)· **νέο** `match /files_personal` — get/list μόνο κάτοχος (ούτε super_admin), create χωρίς `companyId` και χωρίς πεδίο CDE, update με αμετάβλητα `id/userId/createdBy/storagePath` + `cdeCustodyUnchanged()`, delete κάτοχος. **(4)** Σουίτα + `personalFileMatrix` + `seedPersonalFile` (άγκυρες Α3 · Α4, §7). **Επαλήθευση**: jest πυλών 79/79 · emulator 129/129 · 3.15 `--all` exit 0 · 3.35 `--all` exit 0 · 3.87 exit 0 · 3.16 18/18 · γεννήτορας πίνακα πυλών φρέσκος · μεταλλάξεις: πύλες 2/2, κανόνες 3/3. ⏳ Το `file-custody.ts` γεννιέται στο **2β.2** μαζί με τους καταναλωτές του (CHECK 3.22)· δείκτες `files_personal` **παράγονται** από τα ερωτήματα του 2β.2· `purge`/`gdpr-delete` περιμένουν commit του άλλου agent (ADR-864 §21 τα αλλάζει τώρα). |
| 2026-09-17 | 🟡 **Φ0 βήμα 2β.2 — ΓΕΝΝΗΣΗ · ΛΙΣΤΑ · ΚΑΔΟΣ για προσωπικά αρχεία.** 🔎 **§2.6.8 SSoT audit πριν τον κώδικα** (Β1-Β12). **(1) `lib/files/file-custody.ts`**: `FileCustody` (ψευδώνυμο του κοινού πρωτογενούς) · `FILE_COLLECTION satisfies CustodyPartition` · `requireFileCustody` (φρουρός γραφέα) · `fileCustodyKindOf` (το **έγγραφο** αποδεικνύει το διαμέρισμά του, `null` ⇒ άρνηση) · `companyReadCustodyOf` · `fileCustodyKey`. 🔑 **Απόκλιση από το handoff, με λόγο**: **κανένα** `fileCollectionOf()` — οι πύλες 3.15/3.35/3.87 διαβάζουν `FILE_COLLECTION[kind]` στο σημείο κλήσης· μια συνάρτηση-περιτύλιγμα θα τις ξανάκανε τυφλές. **(2) Χωνί γέννησης**: τύποι σε `file-record-core-types.ts` (N.7.1· επανεξάγονται — κανένας εισαγωγέας δεν άλλαξε) · **overloads** `buildPendingFileRecordData`: εταιρεία ⇒ `companyId` + `cdeReadReach`, άνθρωπος ⇒ `userId` χωρίς κανένα κλειδί του `cdeCustodyKeys()` · οι 4 εταιρικοί καλούντες διακομιστή ανέγγιχτοι. **(3) Έλεγχος ανεβάσματος**: νέο `validateCustodyUploadAuth` (άνθρωπος ⇒ `uid`, κανένα claim, **ούτε** super admin· εταιρεία ⇒ **καλεί** το `validateUploadAuth`). **(4) Πράξεις μόνο-`fileId`** (οριστικοποίηση · αποτυχία · κάδος · επαναφορά · μετονομασία · περιγραφή · σύνδεση/αποσύνδεση): **υποχρεωτικό** `CustodyKind` — ο μεταγλωττιστής βρήκε κάθε καλούντα· οι εταιρικοί δηλώνουν ρητά `'company'`, οι λίστες δίνουν το είδος **του ίδιου του αρχείου**. **(5) Αναγνώστες**: `fileOwnerConstraints` / `fileReadKindOf` στο `file-record-queries` — ΕΝΑ σημείο για λίστα, realtime, κάδο, αρχειοθήκη, συνδεδεμένα· για άνθρωπο **κανένα** χειρόγραφο φίλτρο (το `userId == uid` το βάζει η υπηρεσία από το `tenant-config`). `getFilesByEntity`: `companyId?` → `custody?` (12 καλούντες). **(6) UI**: `EntityFilesManager` `custody` (17 σημεία απόδοσης) · `useStableFileCustody` (σταθερή ταυτότητα — αλλιώς ο ακροατής Firestore ξαναστηνόταν σε κάθε render) · `useEntityFilesRealtime` + `useEntityFilesSearch` εξήχθησαν (N.7.1) · ενέργειες **γραφείου** κρυμμένες για προσωπικό κάτοχο (AI · διαβάθμιση · αρχειοθέτηση · ZIP · λήψη μέσω διακομιστή · εκδόσεις · κοινοποίηση · σχόλια · έγκριση · ιστορικό · ISO 19650) — το `FilePreviewPanel` το ρωτά **από το αρχείο**. Ιστορικό αρχείου (`FileAuditService.logForCustody`) **μόνο** εταιρικό ως το 2β.4. **(7) Δείκτης** `files_personal` από την πρόταση της 3.15. **(8) Emulator**: `jest.config.firestore-rules.js` απέκτησε το ψευδώνυμο `@/` ώστε η σουίτα να στέλνει το φορτίο του **πραγματικού** builder (Π5). 🧹 **Boy Scout που ζήτησε η CHECK 3.28** (αρχεία στο ίδιο commit): `TrashView`/`ArchiveView` → `useLifecycleFileList` + `LifecycleListFrame` (σκελετός · σφάλμα · κενό · κεφαλίδα · στατιστικά · γραμμή · ημερομηνία) · τριπλό resumable ανέβασμα → `services/upload/utils/resumable-upload.ts` (`photo-upload` · `PDFProcessor` · `upload-orchestrator-gateway`) · υπηρεσίες κατόψεων ορόφου/ακινήτου → μία αναζήτηση + μία ταυτότητα αποθήκευσης · ωμό `'files'` → `COLLECTIONS.FILES` · νεκρό `softDeleteFileRecord` αφαιρέθηκε. **Επαλήθευση**: jest 22 σουίτες / 242 · emulator 89/89 (`files-personal` + `files`) · 3.15 · 3.35 · 3.87 · 3.16 (18/18) · 3.28 καθαρό σε 40 αρχεία · μεγέθη OK · μεταλλάξεις 4/4 (§7). ⚠️ **Δηλωμένα κενά** (όχι παραλείψεις): **λήψη** προσωπικού αρχείου μέσω διακομιστή + εκδόσεις ⇒ **2β.3** (ίδια αλλαγή `fileResource` ανά διαμέρισμα· η προβολή λειτουργεί ήδη από `downloadUrl`) · ιστορικό αρχείου ⇒ **2β.4** · `purge`/`gdpr-delete` και στα δύο διαμερίσματα ⇒ **μετά το commit του άλλου agent** (ADR-864 §21) · νομική δέσμευση = έννοια οργανισμού, **δεν** εφαρμόζεται σε προσωπικό αρχείο · η 3.15 βλέπει μόνο το στατικό σχήμα των ερωτημάτων (τα υπό συνθήκη `constraints.push` ήταν τυφλό σημείο και για το `files`)· τα υπόλοιπα σχήματα `files_personal` είναι **μόνο ισότητες** ⇒ εξυπηρετούνται από συγχώνευση μονο-πεδιακών δεικτών. 🚀 Μετά το commit: `npm run firestore:deploy` (νέος δείκτης, CHECK 3.86). |
| 2026-09-17 | 🔒 **Δέσμευση αρχείου και στο `files_personal` (ADR-864 §21.8)**. Ίδιο δόγμα με το `cdeCustodyKeys()` (§5.2 «μία λίστα, δύο διαμερίσματα»): το `match /files_personal` καλεί τα **καθολικά** `holdBornAbsent()` (create) · `holdCustodyUnchanged()` (update) · `holdAllowsHardDelete()` (delete). 🔴 Χωρίς αυτό, ο κάτοχος έγραφε `retentionUntil` σε δικό του αρχείο και ο κριτής `isHoldActive` το έβγαζε **από κάθε καθαρισμό**. Κάδος ανοιχτός (σιωπηλή δέσμευση). Σουίτα `files-personal.rules.test.ts` +2 κελιά εκτός μήτρας· emulator ✅. ΟΧΙ commit, ΟΧΙ deploy. |
| 2026-09-17 | 🟡 **Φ0 βήμα 2β.3α — ΛΗΨΗ · ΕΚΚΑΘΑΡΙΣΗ · ΓΚΠΔ για προσωπικά αρχεία** (σημείο 8 §5.2 ✅). 🔎 **§2.6.9 SSoT audit πριν τον κώδικα** (Β1-Β9). ⚠️ **Εμβέλεια σπασμένη (Giorgio, επιλογή 2)**: εκδόσεις/γραφέας/πολιτική/προβιβασμός ⇒ **2β.3β**, μετά το commit του ADR-862 §5.3.7 που άλλος agent γράφει στα **ίδια** αρχεία. **(1) Πόρτα αρχείων** `api/files/_shared/file-custody-route.ts` (`withFileCustodyAuth`): `?custody=` μέσω `custodyKindFromParam` — απουσία ⇒ **το ίδιο** `withAuth` + `dxf:files:view` (μηδέν αλλαγή)· `personal` ⇒ `withPersonalOrOrgAuth`, ο χειριστής παίρνει **μόνο** `uid`· άγνωστο ⇒ 400. Ταξιδεύει **μόνο το είδος** (`FILE_CUSTODY_PARAM`, ιδίωμα `?ledger=`). **(2) Κριτής ανθρώπου**: `createPersonalOwnershipDecision` (**χωριστή** συνάρτηση — ο εταιρικός κληρονομεί bypass super admin) + `definePersonalOwnedResource` πάνω στην **ίδια** αλυσίδα `loadOwnedDocOrRefusal` (κοινό `loadWithDecision`, N.18) · `personalFileResource` με **ίδιο** κείμενο «δεν βρέθηκε». **(3) `loadOwnedFileBytes`**: πρώτο βήμα ανά διαμέρισμα, **κοινή** ουρά· ο άνθρωπος περνά **δύο** τεκμήρια — κάτοχος εγγράφου **και** ρίζα Storage `people/{uid}` (`storagePathCustody`), αντί για κριτή δοχείου CDE. Οι 3 διαδρομές bytes στην πόρτα· η κληρονομιά `?url=` μένει **μόνο εταιρική**. **(4) Πελάτης**: `downloadFileByIdWithPolicy`/`batchDownloadFilesWithPolicy` με **υποχρεωτικό** `CustodyKind` · `useFileDownload` το παίρνει **από το αρχείο** · `downloadFilesAsZip(files, selectedIds)` με `sharedFileCustodyKindOf` (μικτό ⇒ άρνηση) · λήψη **ξεκλειδωμένη** για προσωπικό στο `FilePreviewPanel` + `EntityFilesManager`. **(5) Εκκαθάριση**: `file-purge.job` ανά `CUSTODY_KINDS` × `FILE_COLLECTION` (κάδος **και** ορφανά) · `purgeFileRecord` **υποχρεωτικό** `custody`, γραμμή `FILE_AUDIT_LOG` **μόνο** εταιρική (προσωπικό ίχνος ⇒ 2β.4) · 🧹 `api/files/purge` = **αντίγραφο** της Φάσης Α ⇒ προσαρμογέας (`errors[]` πλέον κενό — δηλωμένο). **(6) ΓΚΠΔ**: `file-subject-scan.ts` (`FILE_SUBJECT_FIELD`: εταιρεία `createdBy`, άνθρωπος `userId` — ο μεσίτης-συντάκτης **δεν** σβήνει τον φάκελο του ιδιοκτήτη) για **διαγραφή ΚΑΙ εξαγωγή** · 🧹 δίδυμη είσοδος των δύο (CHECK 3.28) ⇒ `gdpr-subject-route.ts`, που δέχεται **πολίτη**. **(7) Δείκτες με το χέρι, με λόγο**: η 3.15 **δεν** βλέπει Admin SDK ⇒ `files (isDeleted,purgeAt)` 🔴 **έλειπε ήδη** για την εταιρεία · `files_personal (isDeleted,purgeAt)` · `(status,createdAt)`. 🧹 **Boy Scout**: ρίζα `people` στον κριτή Storage (άγκυρα Κ1 **κόκκινη στο main** από το 2α) · `as any` → `AuthContext` στη σουίτα bytes · αχρησιμοποίητο `EntityType`. **Επαλήθευση**: jest σχετικών σουιτών ✅ (bytes 22 · πόρτα 4 · job 3 · εκκαθάριση/ΓΚΠΔ 6 · custody · storage · archive · owned-resource · file-hold · QuoteOriginalDocumentPanel · cron contract) · `test:ai-pipeline:all` 78/1235 ✅ · 3.15 exit 0 · 3.35 καθαρό (+5 βελτιωμένα, baseline ⇒ Giorgio) · 3.87 ✅ · μεγέθη ✅ · eslint ✅ · **μεταλλάξεις 9/9**. ⚠️ **Προϋπάρχοντα κόκκινα, όχι δικά μας**: `personal-scope-consumers` Κ2 (3 διαδρομές `owner-properties/[id]/…` χωρίς δήλωση) · `ownership-callsite-coverage-anchor` (3 αταξινόμητα αρχεία άλλων). Οι νέες πόρτες μετρούν στην άγκυρα **από το `git add`**. 🚀 Μετά το commit: `npm run firestore:deploy` (3 νέοι δείκτες, CHECK 3.86). |
| 2026-09-17 | 🟡 **Φ0 βήμα 2β.3β — ΕΚΔΟΣΕΙΣ για προσωπικά αρχεία** (Ε-Φ0-1 ✅ · §5.2 σημείο 10 ✅). 🔎 **§2.6.10 SSoT audit πριν τον κώδικα** (Β1-Β11 + έρευνα Google Drive/Dropbox/Box). ⚠️ **Η προϋπόθεση του handoff ΑΠΕΤΥΧΕ και αναφέρθηκε**: το ADR-862 §5.3.7 άλλου agent ήταν **ακομμίτιστο** στα ίδια αρχεία (3 untracked + 5 `M`)· **Giorgio: «προχώρα παρ' όλα αυτά»** ⇒ στα κοινά αρχεία **μόνο** δικές μας γραμμές. **(1) Ο δράστης απέκτησε ΧΩΡΟ, όχι εταιρεία**: `ContainerActor.companyId: string` → `custody: CustodyScope`, και το **διαμέρισμα του αιτήματος παράγεται από αυτόν** (`COLLECTIONS[FILE_COLLECTION[kind]]` στο σημείο κλήσης, ποτέ περιτύλιγμα) — **μία** πηγή, ώστε να είναι **δομικά αδύνατο** να κριθεί το ένα διαμέρισμα και να γραφτεί το άλλο. Νέος κατασκευαστής `personalContainerActorOf` **χωρίς ρόλο/ικανότητες**, γιατί στον προσωπικό χώρο η **εξουσία ΕΙΝΑΙ η ιδιοκτησία** (Google Drive: ο κάτοχος διαχειρίζεται τις εκδόσεις του χωρίς ρόλο) ⇒ ο γραφέας **δεν** ρωτά τον κριτή ικανότητας εκεί, και το `actsForOthers` (εξαίρεση συντονιστή) είναι **πάντα false** — σε φάκελο ενός ανθρώπου δεν υπάρχει συντονιστής. **(2) ΕΝΑ νέο πρωτογενές αντί για τέταρτο χειρόγραφο `===`**: `isOwnedByCustody(data, owner)` στο `custody-scope.ts` — η γενίκευση του `isPayloadOwnedByCompany` (ADR-742) στα **δύο** διαμερίσματα, με **διαμέρισμα πρώτα, ταυτότητα μετά** και την παγίδα του κενού κλειστή **και στις δύο** πλευρές· αντικατέστησε 3 σημεία (`judgeTransition` · `judgeSuccession` · `version-stack.readOwned`). **(3) Καθεστώς με ΔΙΚΟ του όνομα**: `PERSONAL_REGIME = { versions-only, why: 'personal-custody' }` μπαίνει στην **ίδια** ένωση του ADR-862 §5.3.7 (όπως ζητούσε το σχόλιό του) και κρίνεται **πριν** από κάθε ανάγνωση αλυσίδας έργου ⇒ `supersede` ✅ · `share`/`seal`/`withdraw` ⇒ **ονομασμένη** `no-project` · `release` ⇒ `wrong-phase` (κόβεται **νωρίτερα**, από τη φάση — μετρημένο, και σωστό). 🔴 **Χωρίς αυτό ο λόγος θα ήταν ΨΕΥΔΗΣ**: το `resolveContainerProject` έλεγε `'no-entity'` για αρχείο που **δηλώνει** οντότητα, απλώς δεν έχει εταιρεία. **(4) Β5 — σφάλμα που θα έτρωγε δεδομένα**: ο έλεγχος «γεννήθηκε ο διάδοχος;» ρωτούσε `typeof stored.companyId === 'string'`, που σε προσωπικό διάδοχο είναι **πάντα false** ⇒ ο γραφέας θα τον θεωρούσε αγέννητο και θα τον **ξανάγραφε πάνω του**· πλέον «γεννημένο» = **έχει κάτοχο**. **(5) Στοίβα + προβιβασμός με κάτοχο**: `readVersionStack(owner)` **δεν διασχίζει** διαμερίσματα (ένας κλάδος ανά κάτοχο, **κυριολεκτικό** `where`, ώστε οι 3.15/3.35 να μη τυφλωθούν)· ο διάδοχος γεννιέται από τον **ίδιο** builder με το overload **ανθρώπου** (`...custody` αντί `companyId`) ⇒ κανένα `companyId`, κανένα πεδίο CDE, ρίζα `people/` **δωρεάν**· ο σπόρος κλειδώνει σε **κλειδί κατόχου** (`fileCustodyKey`), ώστε εταιρεία και άνθρωπος με ίδια ids να μην παράγουν ποτέ τον **ίδιο** διάδοχο. **(6) Τρεις διαδρομές** (`versions` · `versions/promote` · `cde`) σε `withFileCustodyAuth` + δήλωση στην **Κ4**· κοινός PEP `resolveContainerFile` (αντικατέστησε τα `loadOwnedFile`/`resolveOwnedFile` — **μία** αλυσίδα, δύο αποφάσεις)· **καμία** κλήση `containerVisibilityRefusal` για άνθρωπο (δεν υπάρχει φάση να κριθεί). ⚠️ Η ικανότητα στο σύνορο έγινε **προαιρετική** ώστε η `cde` να **κρατήσει** τη γραπτή της απόφαση «καμία ικανότητα εδώ — πέντε πράξεις, πέντε ικανότητες, κρίση ανά πράξη στον γραφέα». **(7) Πελάτης + UI**: `CustodyKind` **υποχρεωτικό** σε `fetchVersionStack` · `requestVersionPromotion` · `requestSupersession` · `supersedeFileRecord` (ο μεταγλωττιστής βρήκε τους καλούντες)· στο σύρμα **μόνο** `?custody=`, **ποτέ** `userId`· το κουμπί εκδόσεων ξεκλείδωσε για προσωπικό αρχείο. **Β9 — μπαγιάτικο σχόλιο που έκρυβε χαμένο φρουρό**: το `VersionHistory` κατέβαζε με `downloadUrl` επειδή *«οι εκδόσεις ζουν σε υποσυλλογή»* — **η ADR-862 Φ0 την κατάργησε**· πλέον κατεβάζει με `id` ⇒ περνά από ολόκληρη την αλυσίδα bytes (μισθωτής **και** δοχείο/ρίζα Storage). **(8) Δείκτης με το χέρι, με λόγο** (η 3.15 είναι **τυφλή** σε Admin SDK, §2.6.9 Β7): `files_personal (supersededByFileId, userId)` — χωρίς αυτόν το ερώτημα προκατόχων θα έσκαγε `FAILED_PRECONDITION`. **Καμία αλλαγή στο `firestore.rules`**: τα `supersededByFileId`/`supersededAt` ήταν **ήδη** στο `cdeCustodyKeys()` και το `match /files_personal` **ήδη** καλεί το `cdeCustodyUnchanged()`. **Επαλήθευση**: jest **στοχευμένα 11 σουίτες πράσινες** · **μεταλλάξεις 9/9 κόκκινες** με byte-επαναφορά στην ίδια εντολή — και **δύο** βγήκαν **πρώτα πράσινες** (Μ3 · Μ7), γεννώντας τις άγκυρες **Α34.10β** και **Α2.ε** (δες §7: το «ίδια συμπεριφορά, ψεύτικος λόγος» και τα «ταυτόσημα ids σε άλλο διαμέρισμα») · emulator **104/104** (`files-personal` + `files` **ανέγγιχτη**, Α4) με νέο **Π6**: μετά τη διαδοχή του γραφέα ο κάτοχος **διαβάζει ακόμη** προκάτοχο **και** διάδοχο, το ερώτημα της στοίβας περνά, και ο δεσμός διαδοχής **δεν ξηλώνεται** από τον πελάτη · CHECK **3.87** ✅ (3 writer · 0 second-writer) · **3.35** ✅ (και 5 αρχεία βελτιώθηκαν) · **3.15** ✅ · `jscpd:diff` **0 κλώνοι** σε 22 αρχεία · `check-file-sizes` ✅ (ο γραφέας 494/500 ⇒ **εξαγωγή** των κατασκευαστών δράστη στο λεξιλόγιο, 461) · eslint καθαρό. 🔶 **ΝΕΟ Ε-Φ0-2 για τον Giorgio** (§2.6.10 Γ): **όριο/λήξη εκδόσεων** στον προσωπικό χώρο — Google Drive εκκαθαρίζει στις 30 ημέρες ή στις 100 αναθεωρήσεις (`keepForever` ≤200)· Dropbox 30 ημέρες· Box Personal Pro **10** εκδόσεις. **Κανείς δεν κρατά απεριόριστες, κανείς δεν σβήνει την κεφαλή.** Η Φ0 **δεν υλοποιεί και δεν υπόσχεται** όριο (το `MAX_STACK_DEPTH = 200` είναι φρένο **ανάγνωσης**, όχι πολιτική). |
