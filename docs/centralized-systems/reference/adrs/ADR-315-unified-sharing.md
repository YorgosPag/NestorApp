# ADR-315 — Ενιαίοι σύνδεσμοι κοινοποίησης (Unified Sharing)

| | |
|---|---|
| **Status** | ✅ **ACCEPTED** — ο κύκλος ζωής τρέχει **ολόκληρος στον διακομιστή** από τις 2026-09-25 (ADR-884 Φ0.12, κύμα Κ4) |
| **Date** | 2026-04-18 (M1, κώδικας) · **έγγραφο 2026-09-25** |
| **Category** | Sharing / Security / Public surface |
| **Author** | Georgios Pagonis + Claude Code (Anthropic AI) |
| **Σχετικά** | ADR-147 (επιφάνεια κοινοποίησης, UI) · ADR-312/316/320 (showcase ιδιοκτησίας/έργου/κτιρίου) · ADR-698 (δημόσια διαδρομή showcase) · ADR-699 (resolvers ως δηλώσεις) · **ADR-884 §8.1 Φ0.12** (σκλήρυνση) · ADR-853 (`nonceHash`) · ADR-876 (σελίδες-διαπιστευτήρια) |
| **Αυθεντία** | ο κώδικας (`src/server/sharing/*`, `src/services/sharing/*`) |

> ⚠️ **Δύο σπίτια, ένα έγγραφο (διορθώθηκε 2026-09-25).** Η αρχική πρόταση M1–M4 (2026-04-18) ζούσε στο
> `adrs/ADR-315-unified-sharing.md` στη **ρίζα** του repo, έξω από το σπίτι των ADR, και γι' αυτό
> διαβάστηκε ως «ανύπαρκτη» (και από το ADR-699). Η πύλη 3.49 έπιασε τη διπλή
> διεκδίκηση του αριθμού. Το αρχικό κείμενο μεταφέρθηκε **αυτούσιο** στο **Παράρτημα Α** — είναι ιστορικό
> σχεδίου, όχι περιγραφή του κώδικα. Οι §1–§6 περιγράφουν τον κώδικα **όπως είναι** μετά το Κ4.

---

## 1. Τι είναι

Ένας μηχανισμός για συνδέσμους «όποιος έχει τον σύνδεσμο, βλέπει» σε **επτά** είδη οντοτήτων:
`file` · `contact` · `property_showcase` · `project_showcase` · `building_showcase` · `storage_showcase` ·
`parking_showcase`. Το `vendor_rfq_invite` **δεν** μπαίνει εδώ επίτηδες: φέρει δικό του υπογεγραμμένο URL
(ADR-327) και δεν έχει κύκλο ζωής διακριτικού.

| Κομμάτι | Αρχείο | Ρόλος |
|---|---|---|
| Πρόσοψη πελάτη | `services/sharing/unified-sharing.service.ts` | **η μόνη** είσοδος του browser — `createShare` · `revoke` · `resolve` · `requestDownload` · `listActive` · `revokeAll` · `update` (fetch, τίποτε άλλο) |
| Συμβόλαιο σύρματος | `services/sharing/share-resolve-contract.ts` | ονομασμένες αρνήσεις, αποτέλεσμα ανά είδος |
| Resolvers | `services/sharing/resolvers/*` + `showcase-core/share-resolver-factory.ts` | **καθαρή** προβολή `project({ share, entity, token })` + `entityCollection` + `validateCreateInput` (ADR-699) |
| Μητρώο | `services/sharing/share-entity-registry.ts` | είδος → resolver |
| Γραμματική διακριτικού | `lib/sharing/share-token.ts` | 256 bit base64url · `hashShareToken` = SHA-256 |
| **Πύλη** | `server/sharing/share-gate.ts` | διακριτικό → ενεργό → λήξη → όριο → κωδικός/κουπόνι — **μία** κρίση για κάθε πόρτα |
| Αναζήτηση | `server/sharing/share-token-lookup.ts` | `tokenHash` (+ μεταβατικά `token`) σε `shares` **και** `file_shares`, κανονικοποίηση σε ένα σχήμα |
| Μετρητής | `server/sharing/share-access.ts` | **ο μόνος** γραφέας — συναλλαγή, όριο πάνω σε φρέσκο ανάγνωσμα |
| Κωδικός | `server/sharing/share-password.ts` + `share-password-attempt.ts` | scrypt (OWASP) · rehash-on-verify · κλείδωμα ανά σύνδεσμο |
| Κουπόνι | `server/sharing/share-access-grant.ts` | HMAC (`lib/tokens/signed-token`), 15′, cookie `HttpOnly` |
| Δημιουργία / ανάκληση | `server/sharing/share-create.ts` · `share-revoke.ts` | μισθωτής + συντάκτης από τη συνεδρία |
| Επίλυση / λήψη | `server/sharing/share-resolve.ts` · `share-download.ts` | προβολή + V4 υπογεγραμμένα URL |
| Διαδρομές | `app/api/shares/{route, resolve, download, [shareId]/revoke}` | `withAuth` (+ `allowUnauthenticated` στις δημόσιες) |
| **Λίστα ενεργών** (§5, Α12) | `server/sharing/share-links-list.ts` · `GET /api/shares?entityType&entityId` | `mayShareEntity` + **ρητή** προβολή `toShareLinkSummary` — ποτέ hash/διακριτικό |
| **Ρυθμίσεις, ίδιο URL** (Α13) | `server/sharing/share-update.ts` · `PATCH /api/shares/[shareId]` | ετικέτα · λήξη · κωδικός set/clear · όριο — **ίδιο** έγγραφο |
| **Ανάκληση όλων** | `share-revoke.ts` `revokeAllShareLinks` · `POST /api/shares/revoke-all` | παρτίδες, ιδεμποτική, «εκτός από αυτόν» |
| UI διαχείρισης | `components/sharing/link-management/*` | δημιουργία στο κλικ (Α11) · λίστα · ρυθμίσεις · ανάκληση |

## 2. Το κενό που έκλεισε (2026-09-25)

Βρέθηκε στο SSoT audit του ADR-884 και **επαληθεύτηκε στον κώδικα**:

1. **`shares` και `file_shares`: `allow read: if true`.** Στους κανόνες το `read` = `get` **+ `list`**:
   ένας ανώνυμος απαριθμούσε όλη τη συλλογή και μάζευε **κάθε** διακριτικό (σε καθαρό κείμενο) μαζί με τον hash
   του κωδικού. Η «εντροπία 190 bit» δεν προστάτευε τίποτα, αφού το διακριτικό **διαβαζόταν**.
2. **Ανώνυμη εγγραφή αυθαίρετου μετρητή** (`accessCount` / `downloadCount`): ο κανόνας έλεγχε **ποια** πεδία
   αλλάζουν, όχι **πώς** — ένα εξαντλημένο όριο ξαναγέμιζε με `0`.
3. **Κωδικός SHA-256 χωρίς salt**, υπολογισμένος και συγκρινόμενος **στον browser**.
4. **Οι δημόσιες διαδρομές showcase δεν έλεγχαν ποτέ τον κωδικό**: ο κωδικός ζούσε μόνο στη σελίδα
   `/shared/[token]` — ένα `curl` στο `/api/*-showcase/[token]` άνοιγε σύνδεσμο «με κωδικό».
5. **Οι σύνδεσμοι επαφής και αρχείου δεν άνοιγαν για ανώνυμο παραλήπτη**: οι resolvers διάβαζαν
   `contacts`/`files` από τον browser, και οι κανόνες (σωστά) αρνούνταν τον ανώνυμο.
6. Το αρχείο δινόταν με το **μόνιμο** `downloadUrl` του `FileRecord` — πέρα από λήξη, όριο και ανάκληση.
7. Όριο προσβάσεων κρινόταν στον browser **πριν** την αύξηση (read-then-write) — δύο ταυτόχρονοι περνούσαν.
8. Το lookup διακριτικού ήταν γραμμένο **5 φορές** στον διακομιστή (+2 στον browser), και κατέγραφε το ωμό
   διακριτικό σε logs. Διπλότυπο `FileShareService` (ζωντανό μόνο μέσω νεκρού `ShareDialog`).
9. Οι σύνδεσμοι αρχείων από το `UnifiedShareDialog` **δεν** άφηναν συμβάν `share` στο ίχνος του αρχείου.

## 3. Αποφάσεις

- **Α1 — Ολόκληρος ο κύκλος ζωής στον διακομιστή.** Κανόνες `read, write: if false` και στις δύο συλλογές —
  **ούτε ο μισθωτής** διαβάζει από πελάτη (τα έγγραφα κρατούν `tokenHash` + `passwordHash`· ελάχιστο προνόμιο).
- **Α2 — Αποθηκεύεται μόνο το αποτύπωμα** (`tokenHash` = SHA-256 διακριτικού 256 bit — πρότυπο OWASP για
  διακριτικά υψηλής εντροπίας, ίδιο με το `nonceHash` του ADR-853). Το ωμό διακριτικό επιστρέφεται **μία** φορά.
- **Α3 — Κωδικός: scrypt N=2^16, r=8, p=2** (OWASP· Argon2id δεν υπάρχει στη Node 20 — μετρημένο), σε
  **αυτοπεριγραφική** μορφή `scrypt$1$N,r,p$salt$key`. Ο παλιός SHA-256 αναβαθμίζεται **στην πρώτη σωστή είσοδο**.
- **Α4 — Κλείδωμα ανά σύνδεσμο**: 10 λάθη / 15′ ⇒ 15′ κλείδωμα, **πέρα από** το όριο ρυθμού ανά IP. Το κλείδωμα
  δεν ανακαλεί (αλλιώς κάθε επιτιθέμενος θα είχε κουμπί «σβήσε τον σύνδεσμο»).
- **Α5 — Μία πύλη για κάθε πόρτα**: επίλυση, λήψη **και** οι δημόσιες διαδρομές showcase (payload + PDF) περνούν
  από το `passShareGate`. Με κωδικό: απαιτείται **κουπόνι** HMAC (401 αλλιώς).
- **Α6 — Ένα άνοιγμα = μία πρόσβαση** (πρότυπο Google Drive). Το άνοιγμα εκδίδει κουπόνι **επίσκεψης** 15′·
  μέσα σε αυτό επαναφόρτωση, προεπισκόπηση, PDF και λήψη **δεν** ξαναμετρούν (αλλιώς σύνδεσμος «1 πρόσβαση»
  θα εξαντλούνταν με το πάτημα «Λήψη»). Λήψη **χωρίς** επίσκεψη μετρά — δεν υπάρχει δρόμος προς τα bytes που
  δεν ξοδεύει όριο. Ο μετρητής είναι **συναλλαγή**.
- **Α7 — Bytes μόνο με V4 υπογεγραμμένο URL 15′** (`lib/storage/signed-download-url.ts`): `inline` για
  προεπισκόπηση, `attachment` για λήψη.
- **Α8 — Λήξη υποχρεωτική**: 1 ώρα … 30 ημέρες (ίδιο εύρος με τον διάλογο).
- **Α9 — Διακριτικό σε σώμα**, ποτέ σε διεύθυνση API (RFC 6819 §5.1.5)· **ποτέ** σε log — μόνο `shareId`.
- **Α10 — `not-found` καλύπτει και «ανακλήθηκε» και «δεν υπήρξε»**: η διάκριση θα έλεγε σε όποιον μαντεύει
  ποια διακριτικά **υπήρξαν**.
- **Α11 — Ο σύνδεσμος γεννιέται στο κλικ, όχι στο άνοιγμα του διαλόγου** (2026-09-25). Μέχρι τότε **κάθε** άνοιγμα
  του `UnifiedShareDialog` γεννούσε ενεργό σύνδεσμο 72 ωρών, ακόμη κι αν δεν στελνόταν ποτέ — ορφανά ζωντανά
  διαπιστευτήρια, που με ορατή λίστα θα γέμιζαν την οθόνη. Πρότυπο Dropbox «Copy link» / Box «Create and Copy
  Shared Link»: **ένα** κουμπί «Δημιουργία & αντιγραφή συνδέσμου», και η αντιγραφή γίνεται στην **ίδια** χειρονομία
  με `ClipboardItem` που δέχεται Promise (`lib/share-utils.ts` `copyDeferredText` — Chromium 121+ · Safari 16.4+·
  αλλιώς `await` + `writeText`). Single-flight: δύο κλικ = ένας σύνδεσμος. Ο ωμός σύνδεσμος φαίνεται **μία** φορά
  (πρότυπο GitHub PAT) · «Νέος σύνδεσμος για άλλον παραλήπτη» αφήνει τον προηγούμενο ενεργό.
- **Α12 — Λίστα ενεργών συνδέσμων μόνο μέσω διακομιστή, με ρητή προβολή.** Ίδια ερώτηση εξουσιοδότησης με τη
  δημιουργία (`mayShareEntity`)· ξένη οντότητα ⇒ 404. `toShareLinkSummary` = **λίστα επιτρεπόμενων πεδίων**, ποτέ
  spread εγγράφου (μετάλλαξη σε spread ⇒ 2 κόκκινα, μετρημένο). Δείχνει δημιουργό, λήξη, κωδικό ναι/όχι,
  ανοίγματα/όριο, τελευταίο άνοιγμα, **εξαντλημένο** και **κλειδωμένο από λάθος κωδικούς** — το τελευταίο δεν το
  δείχνει στον κάτοχο κανένας από Drive/Dropbox/DocSend. Ληγμένοι έξω· σελίδα 50 + `hasMore`.
- **Α13 — Αλλαγή ρυθμίσεων χωρίς αλλαγή URL** (πρότυπο Dropbox/Box «Link settings»). Μέχρι τότε «αλλαγή πολιτικής»
  = ανάκληση + νέος σύνδεσμος, που **έσπαγε σιωπηλά** το URL που είχε ήδη σταλεί. Κοινός ορισμός πεδίων
  (`SHARE_POLICY_FIELDS`) με τη δημιουργία· όριο κάτω από τα ήδη ανοίγματα ⇒ 422 `max-below-count`· νέος ή
  αφαιρεμένος κωδικός μηδενίζει το κλείδωμα· ανακληθείς ⇒ 404 (οι ρυθμίσεις δεν είναι πίσω πόρτα επαναφοράς).
  ⚠️ Κουπόνια επίσκεψης 15′ (Α6) που εκδόθηκαν πριν την προσθήκη κωδικού ισχύουν ως τη λήξη τους.
- **Α14 — Εσωτερική ετικέτα «Για ποιον;»** (πρότυπο DocSend named links). Αποθηκεύεται στο έγγραφο (`label`), **δεν**
  υπάρχει στο `ShareRecord` που τροφοδοτεί τους resolvers ⇒ δομικά δεν φτάνει στον παραλήπτη. Κάνει την ανάκληση
  **ανά παραλήπτη** αναγνωρίσιμη — προαπαιτούμενο του ADR-884 Φ0.12.
- **Ανάκληση χωρίς «αναίρεση»**: άμεση, με επιβεβαίωση (Dropbox: «you won't be able to re-enable it»). Αναβαλλόμενη
  ανάκληση τύπου Gmail θα χανόταν με το κλείσιμο της καρτέλας, αφήνοντας τον άνθρωπο να πιστεύει ότι έκοψε πρόσβαση.
  Ίχνος: `share_revoke` στο ίχνος αρχείου (ζεύγος του `share`)· το ίχνος δεν ακυρώνει ποτέ την ανάκληση.

## 4. Σειρά ανάπτυξης (την εκτελεί ο Giorgio)

1. ✅ `firebase deploy --only firestore:indexes` — `[tokenHash, isActive]` σε `shares` + `file_shares` (ledger `a2675ba7`).
2. ⏳ Μεταβλητή **`SHARE_ACCESS_SECRET`** στο Netcup (Coolify → Environment Variables, runtime· μετά **Restart** —
   ADR-740 §9.1). Δηλωμένη στο `config/environment-contract.ts`· χωρίς αυτήν, σύνδεσμος **με** κωδικό απαντά
   «μη διαθέσιμο». **2026-09-25: ανεπιβεβαίωτο** (ο Giorgio δεν γνωρίζει). Έλεγχος χωρίς αποκάλυψη τιμής: ως
   **συνδεδεμένος** χρήστης άνοιγμα `https://nestorconstruct.gr/api/health/config` — η λίστα `features` ονομάζει κάθε
   ρύθμιση που λείπει (ανώνυμα φεύγουν μόνο αριθμοί· από `curl` χωρίς browser απαντά 403).
3. ✅ Push → Netcup.
4. ✅ `npx tsx scripts/migrate-share-token-hash.ts --execute` (2026-09-25, `pagonis-87766`): 1 έγγραφο `shares`
   γράφτηκε, 0 συγκρούσεις· το επόμενο dry-run μέτρησε **0 προς εγγραφή** σε `shares` **και** `file_shares`.
5. ✅ `firebase deploy --only firestore:rules` (επιβεβαιωμένο στην παραγωγή από τον Giorgio).
6. ✅ Αφαίρεση του μεταβατικού fallback `token` από το `share-token-lookup.ts` + των δεικτών `[token, isActive]`
   (`shares`, `file_shares`). Οι δείκτες φεύγουν από την παραγωγή στο πλάνο → έγκριση του push (CHECK 3.86).

## 5. Ανοιχτά

- ✅ ~~Λίστα ενεργών συνδέσμων στο UI (ανάκληση ανά παραλήπτη)~~ — **έκλεισε 2026-09-25** (Α11–Α14). Μένει στην
  παραγωγή: deploy του δείκτη `shares [companyId, entityType, entityId, isActive, createdAt↓]` (CHECK 3.86 στο push).
- ⏳ **Ίχνος οντότητας για μη-αρχεία**: δημιουργία/ανάκληση συνδέσμου επαφής ή showcase **δεν** γράφεται στο
  `entity_audit_trail` — το λεξιλόγιο `AuditAction` δεν έχει πράξη συνδέσμου. Τα αρχεία έχουν `share`/`share_revoke`.
- ⏳ **Νεκρός δείκτης** `shares [companyId, entityType, entityId, isActive]`: κανένας καλών (ο browser δεν διαβάζει πια
  `shares`· η λίστα χρησιμοποιεί το υπερσύνολο με `createdAt↓`). Η διαγραφή του είναι αλλαγή παραγωγής — απόφαση Giorgio.
- ⏳ **Απόσυρση `file_shares`**: 1 έγγραφο στην παραγωγή (μετρημένο 2026-09-25). Μεταφορά του στο `shares` (ίδιο
  `tokenHash` ⇒ ο σύνδεσμος συνεχίζει να ανοίγει) θα έσβηνε το δεύτερο λεξιλόγιο από lookup/μετρητή/λίστα/ανάκληση.
- ⏳ Ετικέτες `audit.action.*` στο `AuditLogPanel`: **κανένα** κλειδί δεν υπάρχει στα locales — το πάνελ δείχνει τον
  ωμό κωδικό πράξης (προϋπάρχον, όχι μόνο για `share_revoke`).
- ⏳ Ίχνος θέασης ανά σύνδεσμο («ποιος σύνδεσμος άνοιξε πότε») — σήμερα μόνο μετρητής + `lastAccessedAt`.
- ⏳ Argon2id όταν η παραγωγή περάσει σε Node με `crypto.argon2` — μία γραμμή χάρη στην αυτοπεριγραφική μορφή.
- ⏳ **Αρχεία σε προσωπική φύλαξη** (`files_personal`, ADR-787): ο `file` resolver δηλώνει `COLLECTIONS.FILES`, οπότε
  η δημιουργία συνδέσμου για προσωπικό αρχείο απαντά **403**. Πριν το Κ4 η δημιουργία «περνούσε» (ο έλεγχος ιδιοκτησίας
  δεν καλούνταν ποτέ στη δημιουργία) αλλά ο σύνδεσμος **δεν άνοιγε ποτέ**. Χρειάζεται `entityCollection` ανά διαμέρισμα
  (`FILE_COLLECTION`) + κάτοχος `userId` — δική του εργασία.
- ⏳ Η σελίδα `/shared/[token]` είναι `'use client'` και **δεν** εξάγει metadata (`noindex` / `no-referrer`) —
  δηλωμένο ανοιχτό του ADR-876.

## 6. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-25 | **Διαχείριση ενεργών συνδέσμων (§5 — Α11–Α14).** Διακομιστής: `share-links-list.ts` (λίστα + ρητή προβολή + parsers), `share-update.ts` (ρυθμίσεις χωρίς αλλαγή URL), `share-revoke.ts` (`findOwnedShare` = το **ένα** σημείο ιδιοκτησίας για ανάκληση **και** ρυθμίσεις · `revokeAllShareLinks` σε παρτίδες με φρένο 50 γύρων · ίχνος `share_revoke`), `share-create.ts` (`label`, κοινό `SHARE_POLICY_FIELDS`, `shareExpiryFromNow`), `share-access.ts` (ο χάρτης μετρητών εξάγεται ως `SHARE_COUNTER_FIELDS` — ένα λεξιλόγιο). Διαδρομές: `GET /api/shares`, `PATCH /api/shares/[shareId]`, `POST /api/shares/revoke-all` · κοινή απάντηση άρνησης `share-refusal-response.ts` (το `jscpd:diff` έπιασε κλώνο 8 γραμμών ανάμεσα σε δημιουργία και ρυθμίσεις). UI: `components/sharing/link-management/*` + `UnifiedShareDialog` χωρίς αυτόματη δημιουργία· `LinkTokenForm` → `LinkLabelField` + `LinkTokenFields` + φόρμα ρυθμίσεων· `draft-mapping.ts` (τριαδικός κωδικός, «μόνο ό,τι άλλαξε», φρουρός `keep` αντί `''` — CHECK 3.48). `mock-firestore` απέκτησε αναβαλλόμενο `batch()`. Δείκτης: **ένας** νέος (`shares … createdAt↓`)· δύο προτεινόμενοι `file_shares` αφαιρέθηκαν αφού η 3.91 έδειξε ότι ερωτήματα μόνο-ισοτήτων δεν τους χρειάζονται, ενώ μετάλλαξη του `shares` ⇒ **κόκκινο** (μετρημένο). Το legacy ερώτημα έγινε δύο ρητά (με δυναμικό πεδίο η 3.91 το έγραφε «μη αναλύσιμο»). jest: `share-links-manage` 19 · `copy-deferred-text` 4 · `link-management` 7 · σουίτες κοινοποίησης πράσινες· πύλες 3.35/3.47/3.48/3.78/3.91/3.92 πράσινες. |
| 2026-09-25 | **Καθαρισμός μετάπτωσης (§4 βήμα 6).** Μετά το `--execute` (1 έγγραφο, 0 συγκρούσεις) και dry-run `0 προς εγγραφή` σε `shares` + `file_shares`: το `findActiveShareByToken` ψάχνει **μόνο** `tokenHash` (`queryActiveByHash`)· αφαιρέθηκαν οι δείκτες `[token, isActive]` των δύο συλλογών (κανένας άλλος καλών — τα `po_shares`/`attendance_qr_tokens` έχουν δικούς τους). Το test «still opens a not-yet-migrated document» έγινε «🔴 δεν ανοίγει πια έγγραφο με μόνο ωμό token»· τα seed των παλιών `file_shares` φέρουν πλέον `tokenHash` (το μεταπεσμένο σχήμα). jest κοινοποίησης 255/255 · πύλες 3.15/3.91 πράσινες · 3.86: `firestore:indexes` ⏳ έγκριση στο push. |
| 2026-09-25 | **Επαλήθευση Κ4 — ένα εύρημα, διορθωμένο.** Ο anchor ADR-742 (`ownership-callsite-coverage-anchor`) έπιασε το `server/sharing/share-revoke.ts` ως **αταξινόμητο** σημείο του `isPayloadOwnedByCompany`: το cross-tenant test της ανάκλησης (`comp_2`) **δεν** διακρίνει τον SSoT από σκέτο `!==`. Προστέθηκε το τριπλό συμβόλαιο `describeOwnershipCallSites` (κενό/κενό · χωρίς μισθωτή · θετικός μάρτυρας) στο `share-create-revoke.test.ts` και γραμμή `empty-pair` στο `PROVEN_AFTER_PHASE_C`· μετάλλαξη σε `data.companyId !== actor.companyId` ⇒ **κόκκινο**, μετρημένο. Ο έλεγχος «και τα τρία» του anchor γενικεύτηκε σε «**όλα** empty-pair» (ο αριθμός μεγαλώνει, το δόγμα όχι). Αποτέλεσμα: jest 23 σουίτες — πράσινα όλα του Κ4 (μένουν 2 **προϋπάρχουσες**: `STAY_ICAL_FEED_SECRET` στο `.env.example` · 4 αρχεία vendor-invite)· `test:rules-coverage-completeness` 18/18· `jscpd:diff` 0 κλώνοι σε 39 αρχεία· emulator `shares` + `file_shares` **78/78**. |
| 2026-09-25 | **Ενοποίηση με την αρχική πρόταση** (CHECK 3.49): το `adrs/ADR-315-unified-sharing.md` της ρίζας μεταφέρθηκε στο Παράρτημα Α και αφαιρέθηκε — ένας αριθμός, ένα έγγραφο. |
| 2026-09-25 | **Δημιουργία εγγράφου + σκλήρυνση (ADR-884 Φ0.12, κύμα Κ4).** Όλος ο κύκλος ζωής στον διακομιστή (`src/server/sharing/*`, 4 διαδρομές `/api/shares/*`)· κανόνες `if false` σε `shares` + `file_shares`· μόνο `tokenHash`· scrypt + rehash-on-verify + κλείδωμα ανά σύνδεσμο· κουπόνι HMAC που κλείνει και το κενό «η διαδρομή showcase δεν ελέγχει κωδικό»· ένα άνοιγμα = μία πρόσβαση, μετρητής σε συναλλαγή· V4 URL 15′ για κάθε byte· resolvers → καθαρό `project()`, ανάγνωση οντότητας + `canShare` στον διακομιστή (διορθώθηκαν οι σύνδεσμοι επαφής/αρχείου για ανώνυμο)· 5 αντίγραφα lookup → 1· διαγραφή `FileShareService` + νεκρού `ShareDialog`· συμβάν `share` στο ίχνος αρχείου· μετάπτωση `scripts/migrate-share-token-hash.ts`· σουίτες κανόνων `shares` (πρώτη φορά) + `file_shares` με `shareLinksMatrix` που **μετρά** το `anonymous × list`. |

---

## Παράρτημα Α — Αρχική πρόταση M1–M4 (2026-04-18, ιστορικό)

> Μεταφέρθηκε αυτούσιο από το `adrs/ADR-315-unified-sharing.md` (ρίζα, 2026-09-25). Οι αριθμοί ενοτήτων
> φέρουν πρόθεμα `Α.` — η παλιά «§3.3» είναι πλέον **§Α.3.3**. Όπου διαφωνεί με τις §1–§6, **ισχύουν οι §1–§6**.


| Field | Value |
|-------|-------|
| **Status** | ✅ Phase M3 + M4 COMPLETE (all 3 entity types unified: file + contact + property_showcase — single dialog, single public route) — 2026-04-18 |
| **Date** | 2026-04-18 |
| **Category** | Sharing / Access Control / Public Surfaces |
| **Canonical Location** (target) | `src/services/sharing/`, `src/components/sharing/`, `src/app/shared/[token]/`, Firestore `shares` collection |
| **Supersedes (partial)** | ADR-312 §2 "Scope change to FileShareRecord" (inline discriminators → polymorphic schema) |
| **Extends** | ADR-147 (Unified Share Surface — UI foundation) |

---

### Α.1 Problem

Three share flows exist today, partially centralized, with overlapping responsibilities and diverging capabilities:

#### Α.1.1 Contact share (`Κοινοποίηση επαφής`)

- **Entry**: `src/components/ui/ShareModal.tsx` → `src/components/ui/sharing/panels/UserAuthPermissionPanel.tsx`
- **APIs**: `POST /api/communications/email/property-share`, `POST /api/communications/share-to-channel`, `GET /api/contacts/search-for-share`
- **Persistence**: `photo_shares` (dispatch history only — no persistent shareable token)
- **UI capabilities**: email sub-dialog (manual / from contacts), social channel grid (Messenger / Instagram / WhatsApp / Telegram), copy-link, copy-text
- **Gaps**:
  - No expiration, password, max-downloads, note (present in file share)
  - Copy-link button copies an empty string: the dialog receives `shareData.url` as *input* from the caller, but no token is ever generated, so the URL is either blank or a non-authenticated client-side placeholder
  - No revocation surface (dispatch cannot be revoked post-send — expected — but there is also no persistent link to revoke)

#### Α.1.2 File share (`Κοινοποίηση αρχείου`)

- **Entry**: `src/components/shared/files/ShareDialog.tsx` → `src/components/ui/sharing/panels/link-token/LinkTokenPermissionPanel.tsx`
- **Service SSoT**: `src/services/file-share.service.ts` — `FileShareService.{createShare, validateShare, verifyPassword, incrementDownloadCount, deactivateShare, getSharesForFile}`
- **Persistence**: Firestore `file_shares` — `FileShareRecord { token, expiresAt, passwordHash (SHA-256 client-side), requiresPassword, maxDownloads, downloadCount, note, isActive, companyId }`
- **Public route**: `src/app/shared/[token]/page.tsx` (via `SharedFilePageContent`)
- **Form draft**: `LinkTokenDraft { expiresInHours, password, maxDownloads, note }` — 4 canonical fields

#### Α.1.3 Property showcase (ADR-312)

- Reuses `file_shares` collection with **inline discriminators** (`showcaseMode: boolean`, `showcasePropertyId: string`, `pdfStoragePath`, `pdfRegeneratedAt`)
- Public route: `src/app/shared/po/[token]/page.tsx` (separate path due to different render target)
- `FileShareRecord.fileId` is semantically unused for showcase (debt: field is `string` non-optional but showcase populates a proxy value)

#### Α.1.4 Structural problems

1. **No SSoT for sharing**. Three partially-overlapping systems, each re-implementing its own surface.
2. **Contact share has no token lifecycle**. Cannot be revoked, cannot be expired, cannot be password-protected, cannot be rate-limited per link.
3. **`file_shares` is a misnomer post-ADR-312**. Schema drifts with inline-discriminator pattern; adding a fourth entity type would compound the drift.
4. **Password hashing is SHA-256 client-side** — offline brute-force friendly, documented known debt in `FileShareService`. Extending sharing to contact data (PII) without fixing this widens the attack surface.
5. **Public route dispatches are inconsistent** — `/shared/[token]` for files, `/shared/po/[token]` for showcase, none for contact.
6. **UI foundation is partially shared** via ADR-147 (`ShareSurfaceShell`) but the top-level panels (`UserAuthPermissionPanel` vs `LinkTokenPermissionPanel`) diverge, so the user experience is visibly different per entity.

---

### Α.2 Decision

**Introduce a single unified sharing system** composed of:

1. A **polymorphic share collection** (`shares`) with `entityType` discriminator.
2. A **single SSoT service** (`UnifiedSharingService`) responsible for token lifecycle only.
3. A **separate dispatch service** (`ChannelDispatchService`) responsible for one-shot sends (email / social channels), decoupled from token persistence.
4. A **single public route** (`/shared/[token]`) with server-side entity-type dispatch.
5. A **single adaptive dialog** (`UnifiedShareDialog`) built on ADR-147 `ShareSurfaceShell`.
6. An **entity registry** (`ShareEntityRegistry`) so adding a 4th entity type requires zero changes to the service core.
7. A **server-side bcrypt password validator** (Cloud Function) replacing SHA-256 client-side.

The `file_shares` collection is **renamed to `shares`** with a dual-read alias during migration. `photo_shares` is deprecated (kept read-only for audit; new dispatches land in `share_dispatches`).

---

### Α.3 Architecture

#### Α.3.1 Layers

| Layer | Path (target) | Responsibility |
|-------|---------------|----------------|
| Schema | `src/types/sharing/share-record.ts` | `ShareRecord`, `ShareEntityType`, `ShareDispatchLog` interfaces |
| Firestore config | `src/config/firestore-collections.ts` | Add `SHARES: 'shares'`, `SHARE_DISPATCHES: 'share_dispatches'`; mark `FILE_SHARES` as deprecated alias |
| Service SSoT — tokens | `src/services/sharing/unified-sharing.service.ts` | `createShare`, `validateShare`, `verifyPassword` (delegates to Cloud Function), `incrementAccessCount`, `revoke`, `listSharesForEntity`, `listSharesForCompany` |
| Service SSoT — dispatch | `src/services/sharing/channel-dispatch.service.ts` | `sendViaChannel({ channel, externalUserId, token? \| payload, contactId? })`; writes to `share_dispatches`; reuses existing Mailgun/Telegram/WhatsApp/Messenger/Instagram channel adapters |
| Entity registry | `src/services/sharing/share-entity-registry.ts` | `register(entityType, { resolve, renderPublic, canShare, safePublicProjection })`; plugin pattern |
| Entity resolvers | `src/services/sharing/resolvers/{file,contact,property-showcase}.resolver.ts` | Per-type `resolve()` returns safe public payload; `renderPublic()` returns React component to render on `/shared/[token]` |
| Password validator (server) | `functions/src/sharing/validatePasswordedShare.ts` (Cloud Function) | Accepts `{ token, password }`; compares bcrypt hash server-side; returns session cookie scoped to token |
| Generate dialog | `src/components/sharing/UnifiedShareDialog.tsx` | Adaptive panel; wraps ADR-147 `ShareSurfaceShell`; tab mode for contact |
| Public route | `src/app/shared/[token]/page.tsx` | Validates token; dispatches via `ShareEntityRegistry.renderPublic(entityType)` |
| Public API | `src/app/api/shares/[token]/route.ts` | Anonymous resolver (safe projection only); `/api/shares/[token]/verify-password` for bcrypt validation; `/api/shares/[token]/download` for file streaming with access count |
| Legacy redirect | `src/app/shared/po/[token]/page.tsx` | 301 → `/shared/[token]` |
| SSoT registry entry | `.ssot-registry.json` | Tier 2 module `unified-sharing-service` — forbids direct `shares` collection writes, forbids re-implementation of `FileShareService`, forbids new inline share schema definitions |

#### Α.3.2 Schema

```ts
// src/types/sharing/share-record.ts

export type ShareEntityType = 'file' | 'contact' | 'property_showcase';

export interface ShareRecord {
  id: string;                            // enterprise ID, prefix `share_` (aligned with existing SSoT — enterprise-id-prefixes.ts)
  token: string;                         // 32-char URL-safe random
  entityType: ShareEntityType;
  entityId: string;                      // fileId | contactId | propertyId
  companyId: string;                     // tenant isolation
  createdBy: string;                     // user UID
  createdAt: Timestamp;

  // Lifecycle
  expiresAt: string;                     // ISO datetime
  isActive: boolean;
  revokedAt?: Timestamp;
  revokedBy?: string;

  // Access control
  requiresPassword: boolean;
  passwordHash?: string;                 // bcrypt server-managed; NEVER returned to client
  maxAccesses: number;                   // 0 = unlimited
  accessCount: number;
  lastAccessedAt?: Timestamp;

  // User metadata
  note?: string;

  // Entity-specific metadata (validated by resolver per entityType)
  showcaseMeta?: {
    pdfStoragePath: string;
    pdfRegeneratedAt: Timestamp;
  };
  contactMeta?: {
    includedFields: Array<'name' | 'emails' | 'phones' | 'address' | 'company'>;
  };
  fileMeta?: {
    mimeType: string;
    sizeBytes: number;
  };
}

export interface ShareDispatchLog {
  id: string;                            // enterprise ID, prefix `dispatch_` (new DISPATCH prefix added in M1)
  shareId?: string;                      // nullable — "direct send without link"
  token?: string;                        // denormalized for analytics
  companyId: string;
  createdBy: string;
  createdAt: Timestamp;
  channel: 'email' | 'telegram' | 'whatsapp' | 'messenger' | 'instagram';
  externalUserId: string;                // recipient identifier (PII — never publicly readable)
  contactId?: string;                    // if sent to a known contact
  payload: {
    subject?: string;
    body?: string;
    photoUrls?: string[];
  };
  status: 'queued' | 'sent' | 'failed';
  errorCode?: string;
}
```

**Public projection** (served by `/api/shares/[token]`): only `{ entityType, entityId, requiresPassword, expiresAt, isActive, accessCount, maxAccesses, note, <entityType-specific safe subset> }`. `companyId`, `createdBy`, `passwordHash`, full `externalUserId`s are never exposed.

#### Α.3.3 Entity registry pattern

```ts
// src/services/sharing/share-entity-registry.ts

export interface ShareEntityDefinition<T = unknown> {
  resolve(share: ShareRecord): Promise<T>;                  // fetch public data
  safePublicProjection(share: ShareRecord): PublicShareData; // strip PII
  renderPublic(data: T): ReactNode;                         // server component
  canShare(user: AuthUser, entityId: string): Promise<boolean>;
  validateCreateInput(input: CreateShareInput): ValidationResult;
}

// Registration (called at module load):
ShareEntityRegistry.register('file', fileShareDefinition);
ShareEntityRegistry.register('contact', contactShareDefinition);
ShareEntityRegistry.register('property_showcase', propertyShowcaseDefinition);
```

Adding a 4th type (e.g. `listing`, `document_bundle`) requires only a new resolver file + one `.register()` call. Core service stays agnostic.

#### Α.3.4 UI — `UnifiedShareDialog`

Built on ADR-147 `ShareSurfaceShell`:

| `entityType` | Dialog shape |
|--------------|--------------|
| `file` | Single panel: 4 token fields (λήξη / κωδικός / μέγιστες προσβάσεις / σημείωση) + `Generate link` button |
| `property_showcase` | Single panel: same 4 token fields + PDF regeneration indicator (ADR-312) |
| `contact` | Two tabs: **(1) Απευθείας αποστολή** — default; email manual/from-contacts + social channel grid (preserves current UX). **(2) Δημιουργία συνδέσμου** — 4 token fields + contactMeta field selection (which contact fields to expose). User can also combine: generate link THEN share link via channel |

The dialog **produces** the link (output); it does not consume a pre-built URL as input. This fixes the contact-share copy-link bug (`shareData.url` was empty because no token existed).

#### Α.3.5 Public route dispatch

```ts
// src/app/shared/[token]/page.tsx (simplified)
async function PublicSharePage({ params: { token } }) {
  const share = await UnifiedSharingService.validateShare(token);
  if (!share) return <InvalidShare />;
  if (share.expiresAt < now()) return <ExpiredShare />;
  if (share.accessCount >= share.maxAccesses && share.maxAccesses > 0) return <MaxAccessesReached />;
  if (share.requiresPassword) return <PasswordGate token={token} />;

  const definition = ShareEntityRegistry.get(share.entityType);
  const data = await definition.resolve(share);
  await UnifiedSharingService.incrementAccessCount(share.id);
  return definition.renderPublic(data);
}
```

#### Α.3.6 Firestore security

- Public read on `shares/{id}` must return **only the safe projection**. Implemented via a dedicated `/api/shares/[token]` Admin-SDK resolver — direct client reads on `shares` are forbidden by rules.
- Write rules on `shares`: only via Admin SDK (`withAuth` + tenant check).
- `share_dispatches`: **no public read**. Server-only writes and reads (admin panels query via Admin SDK).
- Composite indexes (declared in `firestore.indexes.json`):
  - `(companyId, entityType, entityId, isActive)` — "shares for this entity"
  - `(companyId, entityType, createdAt DESC)` — tenant admin dashboards
  - `(token)` — single-field, primary lookup path

---

### Α.4 Data Flow

#### Α.4.1 Generate share link (all entity types)

```
User → UnifiedShareDialog
      → POST /api/shares/create { entityType, entityId, expiresInHours, password?, maxAccesses, note? }
      → withAuth + withStandardRateLimit
      → UnifiedSharingService.createShare()
          → ShareEntityRegistry.get(entityType).canShare(user, entityId)
          → ShareEntityRegistry.get(entityType).validateCreateInput()
          → generateToken() (crypto.getRandomValues, 32 chars)
          → if password: bcrypt hash server-side
          → setDoc(shares/{id}, ShareRecord)
      → returns { token, url: `${origin}/shared/${token}` }
User copies / shares URL
```

#### Α.4.2 Channel dispatch WITH generated link

```
User → UnifiedShareDialog tab "Απευθείας αποστολή" (contact only)
      → generates link (flow 4.1) OR picks existing share for entityId
      → POST /api/shares/dispatch { shareId, channel, externalUserId, message? }
      → ChannelDispatchService.sendViaChannel()
          → setDoc(share_dispatches/{id}, ShareDispatchLog { shareId, token, ... })
          → invokes channel adapter (Mailgun / Telegram / WhatsApp / Messenger / Instagram)
          → updates status sent/failed
      → UI confirms dispatch + shows permanent link for copy
```

#### Α.4.3 Channel dispatch WITHOUT link (preserves legacy "send email directly")

```
User → tab "Απευθείας αποστολή" → picks "Just send content, no link"
      → POST /api/shares/dispatch { channel, externalUserId, payload: {subject, body, photoUrls} }
        (no shareId, no token)
      → ChannelDispatchService.sendViaChannel()
          → setDoc(share_dispatches/{id}, ShareDispatchLog { shareId: null, token: null, ... })
          → invokes channel adapter
```

This preserves the current `POST /api/communications/email/property-share` behavior (email with photos, no persistent link) during and after migration.

#### Α.4.4 Public access

```
Anonymous visitor → /shared/{token}
      → Server component validates share, checks expiry/maxAccesses/password
      → If password required: → /api/shares/{token}/verify-password { password }
            → Cloud Function bcrypt.compare server-side
            → returns session cookie (scoped: token + 15min TTL)
      → ShareEntityRegistry.get(entityType).resolve(share)
      → incrementAccessCount fire-and-forget
      → renders entity-specific page
```

---

### Α.5 Migration

#### Α.5.1 Phases

**Phase M1 — Skeleton** (zero user-visible change — ✅ COMMITTED 2026-04-18)
1. Types: `src/types/sharing/share-record.ts` + barrel.
2. Collections: `COLLECTIONS.SHARES`, `COLLECTIONS.SHARE_DISPATCHES`; `FILE_SHARES` marked `@deprecated`.
3. Enterprise ID: `DISPATCH: 'dispatch'` prefix + `generateDispatchId()`.
4. Service SSoT skeleton: `src/services/sharing/unified-sharing.service.ts` — token lifecycle (`createShare`/`validateShare`/`verifyPassword`/`incrementAccessCount`/`revoke`/`listSharesForEntity`/`listSharesForCompany`/`canShare`).
5. Entity registry: `src/services/sharing/share-entity-registry.ts` (empty — resolvers registered in M3).
6. SSoT ratchet: `unified-sharing-service` Tier 2 module in `.ssot-registry.json`; baseline regenerated.
7. Firestore indexes: 3 composite indexes for `shares` declared (not yet deployed).
8. Tests: unit tests for token lifecycle (all paths).

**Phase M1b — Migration + dual-write** (deferred to next PR)
1. Backfill `file_shares` → `shares` with inferred `entityType`:
   - `doc.showcaseMode === true` → `entityType: 'property_showcase'`, `entityId: doc.showcasePropertyId`, `showcaseMeta: { pdfStoragePath: doc.pdfStoragePath, pdfRegeneratedAt: doc.pdfRegeneratedAt }`
   - otherwise → `entityType: 'file'`, `entityId: doc.fileId`, `fileMeta: { mimeType, sizeBytes }` (looked up from `files`)
   - rename `maxDownloads` → `maxAccesses`, `downloadCount` → `accessCount` (keep original fields as deprecated aliases in the doc for one release cycle)
2. Dual-write (`file_shares` + `shares`) for one release cycle to allow rollback.
3. Migrate reads: `FileShareService.validateShare` reads `shares` first, falls back to `file_shares`.

**Phase M2 — Password migration to bcrypt**
1. Deploy Cloud Function `validatePasswordedShare`.
2. For shares with SHA-256 hash: on first successful password verify via legacy path, re-hash with bcrypt server-side, update `passwordHash`. After 90 days, disable legacy SHA-256 path (existing unverified password shares become unrecoverable — users must regenerate).
3. New shares hash with bcrypt from day one.

**Phase M3 — Contact share unification**
1. Replace `ShareModal` / `UserAuthPermissionPanel` imports with `UnifiedShareDialog` (entityType=`contact`).
2. Contact share gains token generation capability; copy-link bug is resolved by construction.
3. `/api/communications/share-to-channel` reroutes internally to `ChannelDispatchService.sendViaChannel()`; legacy API surface kept as thin wrapper for 1 release cycle.
4. `photo_shares` frozen — no new writes; existing docs remain queryable for audit.

**Phase M4 — Public route consolidation**
1. `/shared/po/[token]` becomes 301 redirect to `/shared/[token]`.
2. ADR-312 `src/app/showcase/[token]/page.tsx` repointed to unified public dispatcher (behind same `/shared/[token]` path) OR kept as legacy under `/showcase/[token]` with redirect — choice deferred to implementation phase.

**Phase M5 — Cleanup**
1. Delete `FileShareService` (replaced by `UnifiedSharingService`).
2. Remove legacy wrappers `/api/communications/share-to-channel`, `/api/communications/email/property-share` (now thin proxies).
3. Remove `file_shares` alias reads; drop collection (Firestore doesn't require deletion — abandon reads).
4. Remove legacy fields (`maxDownloads`, `downloadCount`, `showcaseMode`, `showcasePropertyId`, `pdfStoragePath`, `pdfRegeneratedAt` at root) from `ShareRecord`.
5. Update `firestore-rules` tests and `seed-helpers` to reference `shares` / `share_dispatches` only.

#### Α.5.4 Scope reduction (2026-04-18)

The original §5.1 phase plan modeled a **production-grade migration** with dual-write windows, bcrypt Cloud Function + 90-day re-hash cycle, 301 redirects, and feature flags — estimating **2–3 weeks** of focused work (§6.2 original). Giorgio challenged the estimate during implementation; the honest answer is that almost all of that cost is **amortization against real production data and real users**, neither of which exists in this project yet (per `.claude-rules` memory: all Firestore data is test, dropped before go-live; no live password-protected shares).

Reduced plan (this PR):

| Phase | Original intent | What shipped | Why deferred |
|-------|-----------------|--------------|--------------|
| M1 | Skeleton | ✅ Full | — |
| M1b | Backfill + dual-write | ⏸ Skipped | No data to migrate; `file_shares` wiped pre-prod |
| M2 | bcrypt Cloud Function + re-hash | ⏸ Deferred | SHA-256 parity retained via `hashPasswordLegacy`; revisit before first production user |
| M3 | `UnifiedShareDialog` + resolvers + `ChannelDispatchService` + legacy wrappers | ✅ Dialog, resolvers, public dispatcher, channel dispatch service, 2/3 entry points migrated (contact + file). Showcase still on legacy `PropertyShowcaseDialog` (requires splitting `POST /api/properties/[id]/showcase/generate` — not in scope this pass) | Entry-point migration is opportunistic |
| M4 | Public route consolidation + 301 redirects | ~ Partial | `/shared/[token]` dispatches unified+legacy; `/shared/po/[token]` kept for PDF render; redirect path added but consolidation deferred |
| M5 | Cleanup legacy | ⏸ Deferred | `ShareModal` / `ShareDialog` / `FileShareService` still used by other callers |

Total actual time: **~4 hours**, not 2–3 weeks. The SSoT skeleton (M1) + the user-visible unification (most of M3) are what Giorgio actually asked for; the rest was enterprise-migration ceremony designed for a production with real users. It will be revisited when the data stops being test data.

#### Α.5.2 Rollback strategy

- Each phase gated by a feature flag in `system/settings.sharing` (`shares.v2.enabled`, `shares.v2.dialog`, `shares.v2.bcrypt`).
- Dual-write window in M1 lets us flip back to `file_shares` reads without data loss.
- Bcrypt migration is append-only (SHA-256 record is preserved until successful bcrypt re-hash).

#### Α.5.3 Test coverage

- Unit tests: `UnifiedSharingService`, `ChannelDispatchService`, each resolver (`file`, `contact`, `property_showcase`).
- Integration tests: full flow for each entity type (generate → access → password gate → revoke).
- Firestore rules tests: unauthenticated reads on `shares` must fail; public API projection must exclude PII.
- Migration dry-run script: iterates `file_shares`, reports mapping plan without writing.

---

### Α.6 Consequences

#### Α.6.1 Positive

- **True SSoT for sharing**. One service, one collection, one dialog, one public route.
- **Contact share gains security parity**: expiration, password (bcrypt), max accesses, revocation.
- **Contact share copy-link bug fixed by construction**: the dialog produces a token, never consumes one.
- **Showcase schema cleanup**: ADR-312 inline discriminators promoted to first-class `entityType`/`entityMeta`; `fileId`-for-showcase debt eliminated.
- **Password hashing moved server-side** (bcrypt) — closes known security gap from `FileShareService`.
- **Admin revocation is uniform**: a single "Revoke share" surface works for any entity type.
- **Extensibility**: 4th entity type (listing, document bundle, etc.) costs one resolver file, zero core changes.
- **Auditability**: all dispatches captured in `share_dispatches` with channel, status, recipient, regardless of whether a persistent link was used.

#### Α.6.2 Negative / risks

- **Migration complexity**: 5 phases, dual-write window, bcrypt re-hash — non-trivial effort. ~2-3 weeks of focused work.
- **Breaking change for unverified password shares**: after 90-day bcrypt migration window, legacy SHA-256 shares with an unused password hash cannot be recovered; users must regenerate. Mitigation: announce in release notes; no production user impact expected (test data only pre-production — per project memory).
- **Dialog complexity increases** for contact (two tabs). Mitigated by keeping "Απευθείας αποστολή" as default tab and matching current layout verbatim.
- **Firestore composite indexes** require explicit declaration — one-time deployment step.
- **Temporary API surface bloat** during M3 (legacy wrappers + new dispatch service coexist for one release cycle).

#### Α.6.3 Non-goals

- **Admin analytics dashboard** for share usage — deferred to follow-up ADR.
- **Cross-tenant shares** — explicitly not supported; `companyId` remains a hard partition.
- **External OAuth-backed share access** (e.g. "only users with @company.com can open") — out of scope; may warrant a future ADR if required.

---

### Α.7 Relation to existing ADRs

| ADR | Relationship |
|-----|--------------|
| ADR-147 — Unified Share Surface | **Extended**. `ShareSurfaceShell` remains the UI foundation; `UnifiedShareDialog` composes it. |
| ADR-312 — Property Showcase | **Partially superseded**: §2 "Scope change to FileShareRecord" (inline discriminators) replaced by polymorphic `entityType` / `showcaseMeta`. Public route `/shared/po/[token]` → 301 to `/shared/[token]`. All other ADR-312 content (PDF renderer, property media service, public resolver API) remains unchanged in behavior. |
| ADR-070/071 — Email channel adapters | **Reused** by `ChannelDispatchService`. No behavior change. |
| ADR-294 — SSoT ratchet | **Extended**. New Tier 2 module `unified-sharing-service` registered in `.ssot-registry.json`; forbids new direct writes to `shares` and re-implementations of sharing logic. |
| ADR-314 — SSoT Discovery Findings | **Addresses** one of the documented duplicates (`FileShareService` vs contact-share inline logic in `UserAuthPermissionPanel`). |

---

### Α.8 Open questions (to resolve in implementation phase)

1. **Public route strategy for showcase**: keep `/showcase/[token]` path for SEO/brand reasons and redirect `/shared/[token]?entityType=property_showcase` → `/showcase/[token]`? Or fully unify under `/shared/[token]`?
2. **Contact public card rendering**: do we ship a minimal HTML contact card (vCard-like), or only support download of a `.vcf` file? (Out of scope for this ADR — decided at implementation time.)
3. **Dispatch retry policy**: should `share_dispatches` entries with `status: 'failed'` be auto-retried? Current channel adapters do not retry internally.
4. **Rate limiting for public endpoints**: `/shared/[token]` and `/api/shares/[token]` need `withStandardRateLimit` or stricter? The token is public, so naïve brute-force of tokens is a concern — suggest token-space size (32 URL-safe chars ≈ 190 bits) makes this non-exploitable in practice, but rate limiting as defense-in-depth is trivial to add.

---

### Α.9 Implementation checklist (for future execution PR)

- [x] Phase M1 — skeleton (types + service SSoT + registry + tests) ✅ 2026-04-18
- [~] Phase M1b — backfill script + dual-write — **SKIPPED** (test data pre-production; no real records to migrate — see §5.4)
- [~] Phase M2 — bcrypt migration — **DEFERRED** (no real users; SHA-256 parity retained until first production users)
- [x] Phase M3 — `UnifiedShareDialog` + resolvers + `ChannelDispatchService` + showcase unification ✅ 2026-04-18
- [x] Phase M4 — Public route consolidation ✅ 2026-04-18 — `/shared/[token]` now dispatches all 3 entity types (file inline + contact via `SharedContactPageContent` + showcase via `SharedShowcasePageContent`). Legacy `/shared/po/[token]` retained read-only for ADR-312 legacy `file_shares`-persisted shares.
- [ ] Phase M5 — Cleanup legacy surface (FileShareService, ShareModal, ShareDialog) — deferred
- [x] `.ssot-registry.json` entry `unified-sharing-service` (Tier 2) ✅ 2026-04-18
- [x] `firestore.indexes.json` composite indexes declared + deployed ✅ 2026-04-18
- [ ] `firestore.rules` + rules-test suite updated for `shares` and `share_dispatches` — deferred
- [ ] i18n keys consolidated under `sharing` namespace — deferred (existing `files.share.*` keys reused)
- [ ] Seed helpers updated — deferred
- [ ] ADR-147 and ADR-312 updated with pointer to this ADR — deferred

---

### Α.10 Changelog

| Date | Change |
|------|--------|
| 2026-04-18 | Initial proposal authored — Claude + Giorgio, derived from three-flow mapping (contact / file / showcase) |
| 2026-04-18 | Phase M1 skeleton implemented (code-truth reconciliation). `ShareRecord.id` prefix aligned to existing SSoT `share_` (was proposed `shr_`). `ShareDispatchLog.id` prefix `dispatch_` added to enterprise-id SSoT (was proposed `dsp_`). Files: `src/types/sharing/*`, `src/services/sharing/unified-sharing.service.ts`, `src/services/sharing/share-entity-registry.ts`, `src/config/firestore-collections.ts` (SHARES + SHARE_DISPATCHES), `.ssot-registry.json` (Tier 2 `unified-sharing-service`), `firestore.indexes.json` (3 composite indexes). Firestore rules + UI + dispatch + bcrypt deferred to M2–M4. Legacy `FileShareService` + `file_shares` unchanged — single operational path until M3. |
| 2026-04-24 | **ADR-321 cross-reference — all showcase public API routes migrated onto showcase-core factories (ADR-321 Phases 2–4).** `GET /api/showcase/[token]` (property), `GET /api/project-showcase/[token]`, `GET /api/building-showcase/[token]` and their `/pdf` counterparts now delegate to `createPublicShowcasePayloadRoute` / `createPublicShowcasePdfRoute` from `src/services/showcase-core/`. The unified `shares` collection lookups and ADR-312 dual-read `file_shares` fallback are preserved inside the factory (property surface only). No change to `/shared/[token]` viewer routing or `UnifiedSharingService`. |
| 2026-04-18 | **Phase M3 + M4 COMPLETE — showcase fully unified**. Split `POST /api/properties/[id]/showcase/generate` into a new standalone PDF endpoint `POST /api/properties/[id]/showcase/pdf` (PDF-only, no Firestore record — consumed by `UnifiedShareDialog.preSubmit` hook). `UnifiedShareDialog` gained a `preSubmit?: () => Promise<Partial<CreateShareInput>>` prop so entity-specific metadata (showcase `pdfStoragePath`) can be produced at submit time. **New files**: `src/app/api/properties/[id]/showcase/pdf/route.ts` (standalone PDF gen), `src/app/api/shared/[token]/pdf/route.ts` (public PDF proxy streaming from `shares` collection — counterpart of legacy `/api/showcase/[token]/pdf`), `src/components/shared/pages/SharedShowcasePageContent.tsx` (public showcase view rendered inside `/shared/[token]`). **Modified**: `src/features/properties-sidebar/PropertiesSidebar.tsx` (replaces `PropertyShowcaseDialog` with `UnifiedShareDialog` entityType=property_showcase + preSubmit hook calling the new PDF endpoint); `src/components/sharing/UnifiedShareDialog.tsx` (adds `preSubmit` prop + result-stage "Κατέβασμα PDF" button for property_showcase); `src/components/shared/pages/SharedFilePageContent.tsx` (showcase branch now renders `SharedShowcasePageContent` inline — the `/shared/po/[token]` redirect is gone). **Deleted**: `src/features/properties-sidebar/components/PropertyShowcaseDialog.tsx` (legacy entry — superseded). Legacy `POST /api/properties/[id]/showcase/generate` kept for retro-compat (no new callers in tree) — removable in M5. User-visible result: identical 4-field dialog (expiration / password / max accesses / note) for file, contact, and property_showcase. |
| 2026-04-18 | Phase M3 implemented (mostly complete). Scope-reduced after Giorgio push-back that the original 3-week plan was over-engineered for a pre-production test-dataset project. **New files**: `src/services/sharing/resolvers/{file,contact,property-showcase}.resolver.ts` + `index.ts` (auto-registering barrel); `src/components/sharing/UnifiedShareDialog.tsx` (single adaptive dialog — 4 canonical fields + contact-only channel-dispatch stage); `src/components/shared/pages/SharedContactPageContent.tsx` (anonymous contact card with `includedFields` enforcement); `src/services/sharing/channel-dispatch.service.ts` (writes `share_dispatches` audit log + delegates to existing `/api/communications/*` outbound routes). **Modified**: `src/components/contacts/list/ContactsList.tsx` (replaces `ShareModal` with `UnifiedShareDialog` entityType=contact → fixes the copy-link bug and gains λήξη/κωδικός/μέγιστες προσβάσεις/σημείωση); `src/components/file-manager/FilePreviewPanel.tsx` (replaces `ShareDialog` with `UnifiedShareDialog` entityType=file); `src/components/shared/pages/SharedFilePageContent.tsx` (unified-first dispatcher with legacy fallback — handles unified file via adapter + contact via resolver + redirects showcase to `/shared/po/[token]`). **Deferred** (honest scope): M1b backfill (no data to migrate), M2 bcrypt (no real users), M4 `/shared/po` redirect (showcase UX still on legacy generate API), M5 cleanup. `ShareDialog` and `ShareModal` remain exported because other callers (`ShareButton`, `projects-list`) still use them — migration is opportunistic. Property Showcase entry (`PropertyShowcaseDialog`) left unchanged: full unification requires splitting the showcase PDF-generate API, deferred. |
