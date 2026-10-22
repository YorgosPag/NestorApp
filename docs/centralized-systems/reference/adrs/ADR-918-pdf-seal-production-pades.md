# ADR-918 — Σφράγιση PDF από την πλατφόρμα: **PAdES B-T** μέσω **CSC API v2**, με υποχρεωτικό αυτοέλεγχο

| | |
|---|---|
| **Status** | 🟡 **ΣΕ ΕΞΕΛΙΞΗ** — **Σ1 μηχανή ✅ σε κώδικα** *(2026-10-21, uncommitted)*: θύρα `SealSigner` · προσαρμογέας CSC v2 · πελάτης RFC 3161 · κενό υπογραφής (pdf-lib) · CAdES (pkijs) · υποχρεωτικός `verifyPdfSeal` · ένα σήμα «περιμένει ρύθμιση» · άγκυρες Α1–Α10 (30 tests) · μεταλλάξεις **11/11**. ⏳ **κανένας πάροχος ρυθμισμένος** (μυστικά: μόνο ο Giorgio, Coolify) · ⏳ Σ7 B-LT |
| **Date** | 2026-10-21 |
| **Category** | Security / Backend Systems / Documents |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |
| **Προέλευση** | ADR-916 Φ-Γ2 (Πρωτόκολλο Παράδοσης Ψηφιακού Φακέλου, Π1) · δεύτερος καταναλωτής: ADR-901 §5.7.1 (Φάκελος ολοκλήρωσης) |
| **Κληρονομεί (ΔΕΝ ξαναποφασίζει)** | **ADR-902** *(ο ελεγκτής: γνήσιο ≠ εμπιστευτό ≠ αναμενόμενος εκδότης)* · **ADR-777 §8.35** *(συμβόλαιο περιβάλλοντος, `readConfiguredValue`)* · **ADR-861** *(φορέας της πλατφόρμας — ποιος «είναι» ο εκδότης)* |
| **Αυθεντία** | ο κώδικας (`src/server/pdf-seal/`). Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

> 🎯 **Σε μία πρόταση**: η πλατφόρμα σφραγίζει τα PDF που **εκδίδει** με εγκεκριμένη ηλεκτρονική σφραγίδα ενός QTSP,
> χωρίς ποτέ να δει το κλειδί (CSC v2 `signHash`), με χρονοσήμανση τρίτου (RFC 3161), και **κανένα** σφραγισμένο PDF
> δεν φεύγει πριν περάσει από τον **ίδιο** ελεγκτή (ADR-902) που θα το κρίνει αύριο.

---

## §0. Τι κατέχει — και τι **ΔΕΝ** κατέχει

| Κατέχει | ΔΕΝ κατέχει |
|---|---|
| Παραγωγή σφραγίδας PAdES B-T σε PDF που **εμείς** εκδίδουμε | Επαλήθευση (ADR-902 — αυτό το ADR την **καταναλώνει**) |
| Θύρα υπογράφοντα + προσαρμογέα CSC v2 · πελάτη TSA | Ποιο έγγραφο σφραγίζεται και πότε (ADR-916 Σ4 · ADR-901) |
| Ρύθμιση παρόχου (ονόματα) + «περιμένει ρύθμιση» | Το κείμενο του εγγράφου, η διάταξη (renderer jsPDF — Σ4) |
| | Μητρώο εμπιστοσύνης (ADR-902 §2.2 — μένει κενό ως τον πρώτο πάροχο) |

## §1. Το πρόβλημα

Η παράδοση φακέλου (ADR-916 Φ-Γ1) αντιγράφει αρχεία και κρατά καθολικό — **εσωτερική** αλήθεια. Δικαστήριο,
συμβολαιογράφος, επόμενος αγοραστής δεν διαβάζουν το Firestore μας: χρειάζονται έγγραφο που **αποδεικνύει μόνο του**
τι παραδόθηκε, πότε, από ποιον. Ως τώρα ο κώδικας μπορούσε μόνο να **ελέγξει** σφραγίδα (ADR-902), όχι να **φτιάξει**.
Μετρημένο με grep 2026-10-21: κανένα `TimeStampReq`, `signHash`, CAdES, κενό υπογραφής στο repo.

## §2. 🌐 Έρευνα *(2026-10-21)*

- **DocuSign / Adobe Sign**: το *Certificate of Completion* το παράγει **η πλατφόρμα** από το ίχνος και το σφραγίζει
  **η πλατφόρμα** (όχι τα μέρη), κλειδί σε HSM, ρίζα AATL/EUTL, χρονοσήμανση RFC 3161, LTV.
- **ETSI EN 319 142-1 (PAdES baseline)**: `/SubFilter /ETSI.CAdES.detached` · υποχρεωτικά signed attributes
  `content-type`, `message-digest`, **ένα** από `signing-certificate`/`-v2` (με τα δύο ⇒ άκυρο baseline) ·
  **απαγορεύεται** το `signing-time` — η δηλωμένη ώρα πάει στο `/M` του λεξικού · B-T = `signature-time-stamp`
  ως **unsigned** attribute πάνω στην τιμή της υπογραφής.
- **CSC API v2.0.0.2** (ETSI TS 119 432) — επαληθευμένο στο OpenAPI του v2.0.0.2 (BankID): `signatures/signHash`
  απαιτεί `credentialID, SAD, hashes[], hashAlgorithmOID, signAlgo` → `{ signatures[] }` · `credentials/authorize`
  `credentialID, numSignatures, hashes, hashAlgorithmOID` → `{ SAD }` · `credentials/info` με `certificates: 'chain'`
  → `cert.certificates[]` (base64 DER). ⚠️ Πάροχοι «v2» κρατούν τα ονόματα του v1 (`hash`, `hashAlgo` — Aloaha) και
  επιστρέφουν ECDSA ως ωμό `r‖s` (BankID, Aloaha) αντί για DER.
- **RFC 3161** + pkijs 3.4.1 (`TimeStampReq`/`TimeStampResp`/`TSTInfo` υπάρχουν — καμία νέα εξάρτηση).

Πηγές: [Adobe/ETSI EN 319 142-1](https://community.adobe.com/questions-9/advanced-signature-properties-pades-signature-level-1270876) ·
[CSC v2 OpenAPI (BankID)](https://developer.bankid.no/bankid-esign-provider/apis/csc/CSC/) ·
[Aloaha CSC v2](https://www.aloaha.com/csc-v2-api.html) · [PAdES επίπεδα](https://www.criipto.com/blog/pades-signature-levels-explained).

## §3. Η απόφαση στον κώδικα — `src/server/pdf-seal/`

```
openSealSession(env)  ── ρύθμιση; ── όχι ─► awaiting-seal-configuration (καμία κλήση) ─► finish(): ΕΝΑ σήμα
        │ ναι
        ▼
sealPdf ─► assemblePadesSeal ─► αλυσίδα (θύρα) ─► prepareSealPdf ─► signedAttrs ─► SHA-256 ─► signDigest
                                                                      ─► TSA(υπογραφή) ─► CMS ─► embedCms
        └─► verifyPdfSeal (ADR-902) ── valid ∧ timestamped ∧ υπογράφων = φύλλο ──► sealed | self-check-failed
```

| Αρχείο | Ρόλος |
|---|---|
| `seal-signer.types.ts` | θύρες `SealSigner` · `TimestampAuthority` · κλειστό `SEAL_FAILURES` · `SealOutcome` |
| `cms-primitives.ts` | **κοινά** με τον ελεγκτή: μηχανή, OID, αναλυτές, σύνοψεις (εξαγωγή από `verify-pdf-seal.ts` — Boy Scout) |
| `pdf-byte-range.ts` | `joinSignedRanges` — **ένας** ορισμός «τι υπογράφεται» για παραγωγό **και** ελεγκτή |
| `pdf-seal-placeholder.ts` | κενό υπογραφής (pdf-lib) · `/ByteRange` σταθερού πλάτους · `embedCms` |
| `cades-signed-data.ts` | signed attributes B-B · σύνοψη · ECDSA `r‖s`→DER · τελικό `ContentInfo` |
| `rfc3161-timestamp.server.ts` | πελάτης TSA με nonce και πέντε ελέγχους δέσμευσης |
| `csc-seal-signer.server.ts` | προσαρμογέας CSC v2 (μία συνεδρία = ένα token) |
| `seal-config.server.ts` | ονόματα μεταβλητών · `sealConfigurationOf` πάνω στο `readConfiguredValue` |
| `seal-transport.server.ts` | ένας δρόμος HTTP (εγχεόμενα `fetchImpl`/`env`/`now`, προθεσμία, όριο σώματος, `redirect: 'error'`) |
| `seal-pdf.server.ts` | ορχήστρα: `openSealSession` · `sealPdf` · `assemblePadesSeal` (ιδιωτικό στην πράξη — Α7) |

### 3.1 Το κενό υπογραφής
`/Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /M /Reason /Location /ByteRange /Contents` ·
αόρατο widget στην 1η σελίδα (`/F 132` = Print|Locked) · `/AcroForm /SigFlags 3`. `save({ useObjectStreams: false })`
ώστε το λεξικό να είναι **κείμενο**. Το `/ByteRange` γράφεται πρώτα ως `[0 /********** …]` και μετά με τις τελικές
τιμές **στο ίδιο πλάτος** — κανένα byte δεν μετακινείται. Το `/Reason`/`/Location` τα δίνει ο **καλών** (i18n).

### 3.2 Μέγεθος `/Contents` — **32.768 bytes** (65.536 hex)
αλυσίδα 3 × ~1,9 KB ≈ 5,7 KB · token TSA με τη δική του αλυσίδα 6–8 KB · RSA-4096 0,5 KB · ιδιότητες < 1 KB ⇒ ~16 KB,
×2 περιθώριο. Μεγαλύτερο CMS ⇒ `contents-overflow` (άγκυρα Α6), **ποτέ** κομμένο.

### 3.3 Signed attributes (B-B) — **ταξινομημένο SET OF**
`contentType = id-data` · `messageDigest = SHA-256(signedBytes)` · `signingCertificateV2 = { SHA-256(φύλλο), issuerSerial }`.
**Όχι** `signingTime`, **όχι** v1. Το SET OF ταξινομείται κατά DER (X.690 §11.6): η σύνοψη που υπογράφεται είναι η σύνοψη
αυτών των bytes, και αυστηρός ελεγκτής (EU DSS) που ξανακωδικοποιεί θα έβρισκε άλλη.

### 3.4 Χρονοσήμανση — πέντε έλεγχοι πριν μπει το token
`status ∈ {granted, grantedWithMods}` · `messageImprint = SHA-256(υπογραφή)` · `nonce` = ό,τι στάλθηκε (64 bit, θετικό,
κανονική κωδικοποίηση) · υπογραφή TSA επαληθεύεται · `genTime` εντός ±5′. Οποιοδήποτε όχι ⇒ `timestamp-mismatch`/`-rejected`
και **κανένα** PDF. Η **εμπιστοσύνη** στην TSA (αλυσίδα EUTL) **δεν** κρίνεται εδώ — μητρώο ADR-902 / B-LT.

## §4. Ο προσαρμογέας CSC v2
`/info` (ανακάλυψη `oauth2`, αλλιώς η βάση) → `oauth2/token` `client_credentials` (RFC 6749 §4.4, `client_secret_post`)
→ `credentials/info` (`certificates: 'chain'`) → ανά σφράγιση `credentials/authorize` (SAD δεμένο με **αυτή** τη σύνοψη)
→ `signatures/signHash`. `signAlgo`: σύνθετο OID (sha256WithRSA / ecdsa-with-SHA256) αν το δηλώνει το `key.algo`, αλλιώς το
OID του κλειδιού + `hashAlgorithmOID`. ECDSA: δεχόμαστε DER **ή** `r‖s`, βγάζουμε πάντα DER (RFC 5753). RSA-PSS/Ed25519 ⇒
`unsupported-key-algorithm`. 401/403/4xx ⇒ `signer-rejected` · 408/429/5xx/δίκτυο ⇒ `signer-unavailable` (παροδικό).

## §5. Ρύθμιση — **κανένα κλειδί στο περιβάλλον**
`NESTOR_SEAL_CSC_BASE_URL` · `_CLIENT_ID` · `_CLIENT_SECRET` · `_CREDENTIAL_ID` · `NESTOR_SEAL_TSA_URL` (+ προαιρετικά
`NESTOR_SEAL_TSA_USERNAME`/`_PASSWORD`). Δηλωμένα στο `config/environment-contract.ts` (βαθμίδα `feature`) και στο
`.env.example`. Είναι **διαπιστευτήρια πρόσβασης** στην υπηρεσία — το κλειδί μένει στο HSM/QSCD του QTSP. URL που δεν είναι
`https:` μετρά ως **απούσα**. Λείπει έστω ένα ⇒ `awaiting-seal-configuration` με τα **ονόματα**, **καμία** κλήση δικτύου,
**ένα** σήμα ανά εκτέλεση (`SealSession.finish()`, πρότυπο ADR-916 Β27) — και **ποτέ** ασφράγιστο έγγραφο στη θέση του.

## §6. Ο αυτοέλεγχος — γιατί υποχρεωτικός
Η θύρα είναι **τρίτος**: μπορεί να υπογράψει άλλη σύνοψη, με άλλο κλειδί, σε άλλη μορφή. Ό,τι σφραγίζουμε ξαναδιαβάζεται
από τον `verifyPdfSeal` και απαιτείται `valid` **∧** `timestamped` **∧** `certificateSha256` = φύλλο της θύρας. Το
`assemblePadesSeal` (χωρίς έλεγχο) εξάγεται **μόνο** για το fixture του ελεγκτή, που χρειάζεται **άκυρες** σφραγίδες· η Α7
μπλοκάρει κάθε άλλο εισαγωγέα.

🔴 **Εύρημα του αυτοελέγχου, την πρώτη μέρα**: ο ελεγκτής ADR-902 καλούσε `tokenData.verify` **χωρίς** `data`. Για token
TSTInfo το pkijs **απαιτεί** τα χρονοσημασμένα bytes και αλλιώς ρίχνει «Missed detached data» ⇒ το `catch` έδινε `null` ⇒
**κάθε γνήσια χρονοσήμανση διαβαζόταν «χωρίς χρονοσήμανση»** (`timestamped: false`, ώρα = δηλωμένο `signingTime`).
Αόρατο επί 19 μέρες γιατί το συνθετικό fixture δεν είχε TSA. Διορθώθηκε (ADR-902 changelog)· μετάλλαξη M4 ⇒ 7 κόκκινα.

## §7. Άγκυρες — `__tests__/seal-pdf.test.ts` (+ `verify-pdf-seal.test.ts` πάνω στον παραγωγό)

Πάροχος **συνθετικός σε επίπεδο HTTP** (`synthetic-seal-provider.ts`: κλειδί WebCrypto, υπηρεσία CSC που δένει SAD με
σύνοψη, TSA RFC 3161) ⇒ οι **πραγματικοί** πελάτες CSC και TSA τρέχουν από άκρη σε άκρη.

| # | Ισχυρισμός | Μετάλλαξη που την κοκκινίζει |
|---|---|---|
| Α1 | σφράγιση ⇒ `valid` + `timestamped` + υπογράφων = φύλλο · `/SubFilter` · `/M` · ένα `/ByteRange` · ένα token/συνεδρία | M4 (ελεγκτής χωρίς `data`) · M8 (ByteRange όχι ως το τέλος) |
| Α2 | 1 byte ⇒ `digest-mismatch` | M8 |
| Α3 | λάθος imprint · nonce · χωρίς nonce · ρολόι · rejection ⇒ άρνηση, κανένα PDF | M2 · M11 |
| Α3β | ο **δικός** μας έλεγχος imprint απαντά πρώτος (το pkijs είναι δεύτερη ζώνη) | M3 |
| Α4 / Α4β | λάθος υπογραφή ⇒ `self-check-failed`/`signature-invalid` · «valid» άλλου υπογράφοντα / χωρίς B-T ⇒ άρνηση | M1 · M10 |
| Α5 | χωρίς ρύθμιση ⇒ κανένα PDF, καμία κλήση, **ένα** σήμα για 3 σφραγίσεις | M7 |
| Α6 | ήδη υπογεγραμμένο · υπερχείλιση · σκουπίδια ⇒ ονομασμένη άρνηση | M9 |
| Α7 | `assemblePadesSeal` μόνο από `sealPdf` + fixture | (δομική) |
| Α8 | `signingCertificateV2` = SHA-256 φύλλου · **χωρίς** `signingTime` · SET OF ταξινομημένο · token παρόν | M5 · M6 |
| Α9 | ECDSA `r‖s` → DER επαληθεύεται από τον Node | (καθαρή) |
| Α10 | κενό / μόνο κενά / `http:` ⇒ απούσα, με όνομα | (καθαρή) |

**Μεταλλάξεις 11/11 κόκκινες** (επαναφορά σε `finally`, script στο scratchpad). Πρώτο πέρασμα: 9/11 — M3 και M10 επέζησαν·
προστέθηκαν Α3β και Α4β, ξανατρέχτηκαν, κόκκινες. `jscpd:diff` 14 αρχεία: 0 κλώνοι. knip: κανένα νέο αρχείο «νεκρό».

## §8. Απορριφθείσες εναλλακτικές
- **Κλειδί σε env / PKCS#12 στο repo ή στον δίσκο** — διαρροή = πλαστογραφία με το όνομα της εταιρείας· καμία ανάκληση
  χωρίς επανέκδοση. ❌
- **Cloud KMS** — δεν είναι QSCD, άρα **όχι** εγκεκριμένη σφραγίδα (eIDAS άρθ. 35§2 τεκμήριο γνησιότητας χάνεται). ❌
- **`@signpdf/*`, `node-forge`, iText** — νέα εξάρτηση (iText = AGPL, N.5 ❌)· pdf-lib + pkijs αρκούν.
- **Δωρεάν TSA (FreeTSA)** στην παραγωγή — χωρίς τεκμήριο ακρίβειας (eIDAS άρθ. 41§2). ❌
- **PAdES B-B** (χωρίς χρονοσήμανση) — η ώρα θα ήταν δήλωση **δική μας**· σε διαφορά για «πότε παραδόθηκε» δεν αποδεικνύει τίποτα. ❌
- **Υπογραφή πιστοποίησης (DocMDP P=1)** — ελκυστικό («Certified by»), αλλά η Σ7 (B-LT) προσθέτει DSS με incremental update
  και η αντιμετώπιση από αναγνώστες διαφέρει. Αναβάλλεται **ρητά** ως απόφαση της Σ7, με δοκιμή σε Adobe Reader.

## §9. Ανοιχτά — δηλωμένα
1. **Πάροχος** (Giorgio): HARICA απομακρυσμένη εγκεκριμένη σφραγίδα + εγκεκριμένη χρονοσήμανση· ερώτηση «CSC v2 με
   `client_credentials`, χωρίς OTP ανά έγγραφο;». Εναλλακτική SSL.com eSigner (AATL). Αν ο πάροχος θέλει PIN/OTP στο
   `authorize`, σήμερα ⇒ `signer-rejected` «χωρίς SAD» — **σωστή** άρνηση, όχι λύση.
2. **Ονόματα πεδίων του πραγματικού παρόχου**: αν απαντήσει 400 στα `hashes`/`hashAlgorithmOID` (v1 διάλεκτος), η
   διόρθωση ζει **μόνο** στο `csc-seal-signer.server.ts`, με απόδειξη από την τεκμηρίωσή του.
3. **Πρώτη ζωντανή σφράγιση**: μόνο με έγκριση Giorgio, έλεγχος σε Adobe Reader (πάνελ υπογραφών) + EU DSS validator.
4. **Σ7 B-LT**: DSS με αλυσίδα + OCSP/CRL, διεύρυνση ADR-902 «μόνο DSS/VRI μετά το ByteRange» (ADR-902 §3), απόφαση DocMDP.
5. Μητρώο εμπιστοσύνης ADR-902: η ρίζα του παρόχου + `organizationIdentifier` της εταιρείας, όταν υπάρξει πάροχος.

## §10. 🔗 Αμφίδρομες παραπομπές

| ADR | Σχέση |
|---|---|
| ADR-902 | ο ελεγκτής — **καταναλώνεται** ως αυτοέλεγχος · κοινά `cms-primitives.ts` + `joinSignedRanges` · το fixture του χτίζεται πάνω σε αυτή τη μηχανή · διόρθωση `data` στη χρονοσήμανση |
| ADR-916 | Φ-Γ2 / Σ4 — το Πρωτόκολλο Παράδοσης είναι ο πρώτος καταναλωτής (`openSealSession` στον εκτελεστή + δίχτυ) |
| ADR-901 | §5.7.1 — Φάκελος ολοκλήρωσης, δεύτερος καταναλωτής |
| ADR-861 | ο φορέας της πλατφόρμας = ο εκδότης της σφραγίδας · Σ3 νομικό κείμενο του Πρωτοκόλλου |
| ADR-777 §8.35 | 5 νέες εγγραφές `feature` στο συμβόλαιο περιβάλλοντος |

## §11. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-10-21 | **Δημιουργία — Σ1 μηχανή σφράγισης.** Έρευνα (ETSI EN 319 142-1, CSC v2.0.0.2 OpenAPI, RFC 3161). SSoT audit με grep (κανένα `TimeStampReq`/`signHash`/CAdES/κενό). 10 αρχεία στο `server/pdf-seal/` (§3). **Boy Scout**: `cms-primitives.ts` + `joinSignedRanges` εξήχθησαν από τον ελεγκτή (αλλιώς δίδυμα)· το fixture του ελεγκτή ξαναγράφτηκε **πάνω** στον παραγωγό (όχι δεύτερη κατασκευή CMS). **Εύρημα**: ο ελεγκτής ADR-902 δεν αναγνώριζε ποτέ χρονοσήμανση (§6) — διορθώθηκε. Συμβόλαιο περιβάλλοντος + `.env.example`. Άγκυρες Α1–Α10 (30 tests), μεταλλάξεις 11/11. Καμία νέα εξάρτηση. |
