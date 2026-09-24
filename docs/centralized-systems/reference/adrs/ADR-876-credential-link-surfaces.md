# ADR-876 — Επιφάνειες όπου η διεύθυνση είναι διαπιστευτήριο (πύλη προμηθευτή · check-in · σύνδεσμοι token)

| | |
|---|---|
| **Status** | ACCEPTED — Βήματα 1-3 υλοποιημένα (`f545dcb7`) · Βήμα 4 (σκλήρυνση, §5) `67ed0527` · επαλήθευση στον browser + διορθώσεις Σ15-Σ21 (§5.8) `8a317580` · **Φ7 (απόσυρση παλιάς μορφής, §5.9) υλοποιήθηκε 2026-09-24, χωρίς commit** |
| **Date** | 2026-09-23 |
| **Προέλευση** | ADR-875 §10.5 *(εύρημα παραγωγής του χρησμού: η πύλη προμηθευτή → `/login`)* |
| **Σχετικά** | ADR-327 §7/§11 *(πύλη προμηθευτή)* · ADR-170 *(QR παρουσιών)* · ADR-787 §5.3 *(πρόθεμα χώρου)* · ADR-777 §8.33 *(`signed-token`)* · ADR-841 Α21.18/Α21.21 · ADR-781/875 *(χρησμός 3.51)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το πρόβλημα, μετρημένο

Το `5ff0baa2` (2026-08-22, ADR-787 §5.3, *«όλες οι σελίδες προϊόντος κάτω από `/o/[workspace]`»*) μετακίνησε
**και δύο σελίδες που δεν είναι σελίδες προϊόντος**: είναι πόρτες για ανθρώπους **χωρίς λογαριασμό**.

| # | Εύρημα | Συνέπεια |
|---|---|---|
| **Ε1** | `vendorPortalUrl()` → `/vendor/quote/<token>`· η σελίδα ζούσε **μόνο** στο `/o/[workspace]/vendor/quote/[token]` | κάθε προμηθευτής → `/login` (μετρημένο στην παραγωγή, ADR-875 §10.5). **Κανένας** δεν μπορούσε να καταθέσει προσφορά |
| **Ε2** | **Ίδιο σφάλμα, ίδιο commit**: `/api/attendance/qr/generate` → `/attendance/check-in/<token>`· η σελίδα στο `/o/[workspace]/…` | **κανένας** εργάτης δεν μπορούσε να κάνει check-in με QR. Βρέθηκε ψάχνοντας την **κλάση**, όχι το δείγμα |
| **Ε3** | `vendorDeclineUrl()` → `/vendor/quote/<token>/decline` — διαδρομή **χωρίς σελίδα** (υπάρχει μόνο `POST /api/…/decline`) | ο σύνδεσμος «δεν ενδιαφέρομαι» κάθε πρόσκλησης = 404, **σε κάθε περιβάλλον, από την πρώτη μέρα**. Θα έμενε σπασμένος και μετά τη μετακόμιση |
| **Ε4** | το token αποθηκεύεται **ωμό** στο `vendor_invites.token` (αναζήτηση με ισότητα)· οι κανόνες δίνουν ανάγνωση σε κάθε μέλος της εταιρείας | μέλος του γραφείου μπορεί να υποβάλει προσφορά **ως** ο προμηθευτής → Βήμα 4 |
| **Ε5** | η σελίδα ελέγχει υπογραφή + κατάσταση πρόσκλησης, **όχι** τη λίστα ανάκλησης (`vendor_invite_tokens.revoked`) | token ανακαλεσμένο με `revokeVendorPortalToken` δείχνει ακόμη τη φόρμα → Βήμα 4 |
| **Ε6** | **11** σελίδες με `[token]`, δηλώσεις γραμμένες με το χέρι: `no-referrer` σε **4**· **τίποτα** στις `shared/[token]` + `shared/po/[token]` (`'use client'` ⇒ δομικά ανίκανες να εξάγουν metadata, ούτε `noindex`) | ίδια ερώτηση, έντεκα απαντήσεις (σχήμα ADR-749) |
| **Ε7** | ωμά ελληνικά/αγγλικά στο `metadata.title` (vendor · attendance · showcase) | N.11 |
| **Ε8** | ωμό `decodeURIComponent` σε vendor page/API, attendance, contact — πετά σε κακό `%` | 500 αντί για «άκυρος σύνδεσμος». Υπήρχε ήδη SSoT: `decodeRouteParam` |
| **Ε9** | `card-email` + `hours-question` (ADR-841) **αδήλωτα** στο `OUTSIDE_WORKSPACE` | οι άγκυρες Ε1/Κ1 του `route-catalogue-anchor` ήταν **κόκκινες από τότε** — ίδια κλάση |
| **Ε10** | *(έβγαλε η μετακόμιση)* `VendorPortalClient` · `VendorPortalErrorState` · `CheckInClient` δήλωναν δικό τους `<main className="min-h-screen …">` — μέσα στο `(auth)` το `<main>` + ύψος τα κατέχει το layout (`ShellSurface`) | διπλό `<main>` + 48px κύλιση (μετρημένο στο `(auth)/layout`). → `<section className="w-full self-start">` / `AuthCardSection` |
| **Ε11** | `VendorPortalErrorState.MESSAGES_EL` — ωμά ελληνικά (N.11), **αντίγραφο** των κλειδιών `vendor-portal:errors.token*` που **ήδη υπήρχαν** | ο Άγγλος προμηθευτής έβλεπε ελληνικά. → client με `t()` + εξαντλητικό `Record<λόγος, κλειδιά>`· +4 κλειδιά (`serverError*` · `inviteNotFound*`) el/en |

⚠️ **Γιατί κανένα test δεν το έπιασε**: ο χρησμός 3.51 έκρινε τις δύο σελίδες **με συνεδρία μέλους** — δηλαδή
ως θεατή που ο πραγματικός παραλήπτης **δεν είναι ποτέ**. Πράσινο για τον λάθος άνθρωπο.

## 2. Έρευνα — πώς το κάνουν οι μεγάλοι (2026-09-23)

| Πλατφόρμα | Τι κάνει | Πηγή |
|---|---|---|
| **DocuSign** | σύνδεσμος λήγει μετά από 5 κλικ/48 ώρες· σελίδα λήξης με **«στείλε μου νέο σύνδεσμο»**· προαιρετικό access code / SMS· Certificate of Completion (προβολή · υπογραφή · IP) | support.docusign.com |
| **BuildingConnected** | πρόσκληση δεμένη με το **email** του παραλήπτη· προωθημένη = υποβαθμισμένη πρόσβαση | support.buildingconnected.com |
| **Procore Bidding** | διόρθωση προσφοράς μέχρι την προθεσμία· εναλλακτικά απάντηση στο email με συνημμένο | v2.support.procore.com |
| **SAP Ariba Light** | καμία συνεδρία — φόρμα μέσα στο email | learning.sap.com |
| **Figma / Google** | λήξη συνδέσμου μόνο Enterprise (Figma)· «anyone with the link» **χωρίς** λήξη (Google) | help.figma.com · workspaceupdates.googleblog.com |
| **OWASP / πράξη** | token σε URL διαρρέει σε Referer · ιστορικό · logs → `no-referrer` · `no-store` · `noindex` · token **hashed** στη βάση · **GET χωρίς παρενέργειες** (Safe Links / Mimecast / Proofpoint **πατούν κάθε σύνδεσμο πριν τον άνθρωπο** — γι' αυτό το Slack πέρασε σε OTP) | owasp.org · learn.microsoft.com/defender-office-365/safe-links-about |

**Πού τους ξεπερνάμε**: (α) **άγκυρα που αποδεικνύει** ότι η δημόσια πόρτα είναι δημόσια (§4 Π1) και ο χρησμός την
κρίνει **ανώνυμα** με πραγματικό token (§3.4) — κανείς από τους παραπάνω δεν δημοσιεύει κάτι τέτοιο· (β) άρνηση
**ασφαλής απέναντι στα scanners** (GET = διάλογος, POST = πράξη) αντί για «ένα κλικ» που θα το πατούσε το Safe Links·
(γ) ανάκληση ελεγμένη **σε κάθε** πόρτα, όχι μόνο στο API (Βήμα 4).

## 3. Η απόφαση

### 3.1 Βήμα 1 — η ρίζα (Ε1 · Ε2 · Ε9)
- `vendor/quote/[token]` και `attendance/check-in/[token]` → **`src/app/(auth)/`**, ίδια απάντηση με
  `contact`/`mandate`/`invite`: *η άδεια είναι το token, όχι η ιδιότητα μέλους*. Και τα δύο τμήματα ήταν
  **μόνοι ένοικοι** του κορυφαίου τους τμήματος μέσα στον χώρο ⇒ καθαρή μετακόμιση.
- `OUTSIDE_WORKSPACE` += `vendor` · `attendance` · `card-email` · `hours-question`, **με λόγο** (CHECK 3.60).
  Το catch-all του χώρου ρωτά το `isInsideWorkspace` ⇒ δεν στέλνει πια το `/vendor/…` στο login.
- ❌ **Απορρίφθηκε** «πρόθεμα χώρου στον σύνδεσμο»: ο ανώνυμος θα έπεφτε πάλι στον φρουρό ταυτότητας.
- Baselines με κλειδί διαδρομής αρχείου (`.catalog-columns` · `.zindex-scale` · `.shell-surface`):
  **μετονομασία κλειδιών**, ίδιος αριθμός παραβιάσεων — ίδια παραβίαση, άλλη θέση.

### 3.2 Βήμα 2 — ο σύνδεσμος άρνησης (Ε3)
`vendorDeclineUrl()` → `/vendor/quote/<token>?intent=decline`: η **ίδια** σελίδα, με τον διάλογο άρνησης ανοιχτό.
Κατασκευαστής και αναγνώστης (`readVendorPortalIntent`) στο **ίδιο** module (`vendor-portal-links.ts`) — η λέξη δεν
μπορεί να αποκλίνει ανάμεσα σε email και σελίδα. Πρότυπο: `hours-question/[token]` (`?answer=` = προσυμπλήρωση).
⚠️ Η πρόθεση τιμάται **μόνο** σε πρόσκληση που δεν έχει υποβληθεί.

### 3.3 Βήμα 3 — ένα SSoT για τις σελίδες-διαπιστευτήρια (Ε6 · Ε7 · Ε8)
- **`src/lib/tokens/credential-link-page.ts`** → `CREDENTIAL_LINK_PAGE_METADATA` (`noindex, nofollow` · `no-referrer`).
  Το χρησιμοποιούν **όλες** οι 11 σελίδες· τα `shared/*` μέσω νέου server `shared/layout.tsx` (μηδέν DOM).
- `force-dynamic` **ανά σελίδα** (το Next το διαβάζει με στατική ανάλυση — επανεξαγωγή θα αγνοούνταν σιωπηλά)·
  φέρνει το `Cache-Control: private, no-cache, no-store` της δυναμικής απόδοσης. Νέο σε attendance · showcase · shared.
- Τίτλοι: αφαιρέθηκαν τα ωμά κείμενα (N.11)· ο τίτλος καρτέλας = όνομα προϊόντος (`title.template`, ADR-857 Φ8α),
  όπως σε **κάθε** άλλη σελίδα-διαπιστευτήριο. Δηλωμένο κενό: μεταφρασμένος τίτλος θέλει server-side `t` για
  metadata, που το έργο δεν έχει.
- `decodeURIComponent` → `decodeRouteParam` (vendor page · `open-invite` · decline API · attendance · contact).
  ⚠️ Το `workspace-invitations/preview` **μένει** — τυλίγει ήδη ρητά το σφάλμα.

### 3.4 Ο χρησμός 3.51 κρίνει τις δημόσιες πόρτες ΑΝΩΝΥΜΑ
- `golden-catalog.js`: τα πρότυπα `/vendor/quote/[token]` · `/attendance/check-in/[token]` (χωρίς `/o`).
  `GOLDEN_PUBLIC_TEMPLATES` **παράγεται** (κλειδιά εκτός `/o/`) — όχι δεύτερη χειρόγραφη λίστα.
- `golden-bindings.js`: `bindWorkspaceRoute` → **`bindRoute(route, persona|null, golden)`** — μία μηχανή· `[workspace]`
  χωρίς persona = άρνηση (fail-closed).
- `identity.js` `expandForPersonas`: δημόσια πόρτα ⇒ **μία** διαδρομή, **χωρίς persona**, με πραγματικό token.
- ⚠️ **Ο δίδυμος (ADR-875 §14) παύει να κρίνει τις δύο διαδρομές**: 110 → **108** `/o/**`. Οι δημόσιες πόρτες
  κρίνονται πλέον από τον Χ ανώνυμα — ο **σωστός** θεατής.
- ⚠️ **Ξανασπορά = απόφαση Giorgio**: οι 4 δηλώσεις `/o/alpha-techniki/{vendor,attendance}/…@<persona>` της baseline
  εξαφανίζονται (μειώνονται) και εμφανίζονται 2 νέες ταυτότητες (`/vendor/quote/golden-vendorToken` ·
  `/attendance/check-in/golden-attendanceToken`). **Δεν** αγγίχθηκε η baseline.

## 4. Άγκυρες

`src/lib/tokens/__tests__/credential-link-page.test.ts` — κατάλογος διαδρομών = `enumerateRoutes` του χρησμού (ο **ίδιος**
με το `route-catalogue-anchor`, όχι δεύτερος walker):

| # | Ερώτηση |
|---|---|
| Π0 | ο ανιχνευτής βρίσκει τις γνωστές σελίδες (≥ 11) — δεν είναι τυφλός |
| **Π1** | 🔴 **καμία** σελίδα με `[token]` μέσα στον χώρο (η άγκυρα του Ε1/Ε2) |
| Π2 | κάθε σελίδα με `[token]` παίρνει metadata από το SSoT **και** `force-dynamic` (σελίδα ή layout-πρόγονος server) |
| Π3 | κανένα χειρόγραφο `no-referrer` σε σελίδα/layout — μόνο στο SSoT |
| Π4 | το SSoT λέει ό,τι υπόσχεται |
| Α1-Α2 | η άρνηση οδηγεί στη **διαδρομή της πύλης**, που **υπάρχει** στον δίσκο εκτός χώρου· δεν υπάρχει `…/decline` σελίδα |
| Α3 | πίνακας / σκουπίδι / απουσία ⇒ καμία πρόθεση |
| Α4 | η σελίδα **δεν γράφει** (GET ασφαλές απέναντι σε Safe Links) |

`scripts/__tests__/i18n-ssr-golden.test.ts`: Γ1 (κατάλογος = πρότυπα `/o` + δημόσιες πόρτες) · **Γ1γ** (δημόσιες πόρτες
δένονται ανώνυμα, με πραγματικό token στο `fetchUrl`) · **Γ1δ** (`[workspace]` χωρίς persona ⇒ άρνηση) · Γ6β (νέα θέση).

### 3.5 Μάθημα υλοποίησης — ο ανιχνευτής που τυφλώθηκε
Η πρώτη εκδοχή της σελίδας έγραψε `const [{ token }, { intent }] = await Promise.all([params, searchParams])`. Η άγκυρα
**Γ6β** (ADR-875 §10: «ό,τι διαβάζει ο server σπέρνεται από το API») **κοκκίνισε**: ο ανιχνευτής της αναγνωρίζει μόνο
`const { … } = await params`. Η σελίδα γράφτηκε ξανά με δύο αποδομήσεις — **δεν** χαλαρώθηκε ο ανιχνευτής. Και η Π3
έπιασε αρχικά `no-referrer` μέσα σε **σχόλιο** (ψευδώς θετικό) ⇒ κρίνει πλέον μόνο γραμμές κώδικα.

## 5. Βήμα 4 — σκλήρυνση: «ένας σύνδεσμος = ένα διαπιστευτήριο» (ΥΛΟΠΟΙΗΘΗΚΕ 2026-09-24 · commit `67ed0527` · διορθώσεις επαλήθευσης §5.8 `8a317580` · Φ7 §5.9)

### 5.1 Τι μέτρησε το SSoT audit (2026-09-23/24) — πέρα από τα Ε4/Ε5

| # | Εύρημα | Πού |
|---|---|---|
| **Σ2** | 🔴 το ωμό token δεν διέρρεε μόνο στη βάση: **ο browser του γραφείου το διάβαζε** (συνδρομή Firestore) και **ξανάχτιζε το URL μόνος του** — δεύτερο αντίγραφο του `vendorPortalUrl` | `VendorInviteSection.tsx:79` · `useVendorInvites` |
| **Σ3** | **δύο γραφείς** έχτιζαν το έγγραφο πρόσκλησης με το χέρι, με ωμό `token` και οι δύο | `vendor-invite-service.createVendorInvite` · `rfq-service.createRfq` (fan-out) |
| **Σ4** | η αλυσίδα «άνοιξε την πρόσκληση» **τρεις** φορές (`open-invite.ts` · σελίδα · `decline/route.ts`) — το decline **δεχόταν ληγμένη** πρόσκληση, η σελίδα **δεν κοιτούσε ανάκληση** | — |
| **Σ5** | η ανάκληση έγραφε `status: 'expired'` (ανάκληση ≡ λήξη), **χωρίς φύλαξη** (ανακαλούσε και `submitted`)· η σελίδα έδειχνε «ανακλήθηκε» όταν ο **ίδιος ο προμηθευτής** είχε αρνηθεί | `revokeVendorInvite` |
| **Σ8** | το token ζούσε **και** στη διαδρομή της σελίδας — το `no-referrer` δεν σώζει τα access logs | `/vendor/quote/<token>` |
| **Σ9** | `resend`/`revoke` χωρίς ίχνος (μόνο `logger.info`)· τα routes **αγνοούσαν το `[id]`** (πρόσκληση άλλου RFQ της ίδιας εταιρείας περνούσε) · το `resend` δεν το καλούσε κανένα UI | `api/rfqs/[id]/invites/[inviteId]/*` |
| **Σ10** | το email πρόσκλησης με ωμά ελληνικά/αγγλικά σε τριαδικούς (N.11)· `declineUrl` ανεscaped σε `href` | `channels/email-channel.ts` |
| **Σ11** | `vendor_invite_tokens` (λίστα ανάκλησης κατά nonce) + κλάδος `usedAt`: το `markUsed: true` **δεν καλούνταν πουθενά** | `vendor-portal-token-service.ts` |
| **Σ12** | hash IP **δύο φορές, με διαφορετική συνταγή**: με αλάτι (`with-rate-limit`, ιδιωτικό) και **χωρίς** (πύλη — αντιστρέψιμο με πίνακα IPv4) | → `clientIpFingerprint` |
| **Σ13** | `extractBearerToken` **δύο φορές** με **διαφορετική** συμπεριφορά: το SSoT επέστρεφε `''` για `Bearer `, το αντίγραφο του MCP `null` | → SSoT διορθώθηκε, MCP το εισάγει |
| **Σ14** | `jsonError` (πύλη) ≡ `vendorPortalError` — ίδιο σχήμα απάντησης δύο φορές | → ένα |

### 5.2 Έρευνα — και πού τους ξεπερνάμε

W3C TAG, *Good Practices for Capability URLs*: πολλοί σύνδεσμοι για την ίδια δυνατότητα, **στοχευμένη ανάκληση**
ανά σύνδεσμο · αποθήκευση `token_hash`, ποτέ του μυστικού · το **fragment** δεν φεύγει ποτέ προς τον server.
DocuSign: η επαναποστολή βγάζει **νέο** σύνδεσμο· κατάσταση **Voided** ≠ λήξη. BuildingConnected: η πρόσκληση
δένεται με το **email** του παραλήπτη. GitHub: το διαπιστευτήριο **δεν αποκαλύπτεται ξανά**.

**Πού τους ξεπερνάμε**: (α) κάθε σύνδεσμος (email · αντιγραφή · επαναποστολή · αίτημα προμηθευτή) είναι **χωριστό,
ιχνηλατήσιμο και χωριστά ανακλήσιμο** διαπιστευτήριο — η DocuSign ανακαλεί ολικά· (β) **διπλός φραγμός**: υπογραφή
HMAC **και** `nonceHash` της έκδοσης — διαρροή του `VENDOR_PORTAL_SECRET` **δεν αρκεί** (άγκυρα Δ3)· (γ) ο σύνδεσμος
**στο fragment** (`/vendor/quote#t=…`) και σβήνεται αμέσως από γραμμή διευθύνσεων + ιστορικό — ούτε access log, ούτε
`Referer`, ούτε Safe Links· (δ) αυτοεξυπηρέτηση λήξης με **ουδέτερη** απάντηση (καμία απαρίθμηση).

### 5.3 Η απόφαση (υλοποιημένη)

| Κομμάτι | Αρχείο | Τι κάνει |
|---|---|---|
| **Διαπιστευτήριο** | `services/vendor-portal/vendor-invite-credential.ts` | σύνδεσμος = `encodeSignedToken([credentialId, nonce, expiryMs])` — **ίδια γραμματική με τις προσκλήσεις χώρου** · `parseVendorLink` (χωρίς βάση) · `credentialMatches` (`equalsInConstantTime`) · `VENDOR_LINK_LIFETIME_DAYS` (ήταν γραμμένο 3 φορές) |
| **Βάση** | `…/vendor-invite-credential-store.ts` | ο ΜΟΝΟΣ αναγνώστης/γραφέας του `vendor_invite_credentials` (**server-only**, κανόνας `if false`) · `get` με ID — **κανένα ερώτημα, κανένας δείκτης** |
| **Κατασκευαστής** | `subapps/procurement/services/vendor-invite-issue.ts` | ΕΝΑΣ για τους δύο γραφείς (Σ3): πρόσκληση + πρώτο διαπιστευτήριο στο **ίδιο** batch · επιπλέον σύνδεσμοι |
| **Αναλυτής** | `…/vendor-invite-resolver.ts` | πίνακας «σκοπός (`read`·`submit`·`decline`·`renew`) × κατάσταση» — ΕΝΑ λεξιλόγιο αρνήσεων (`VENDOR_INVITE_REFUSALS`) για API **και** οθόνη |
| **Πόρτα** | `server/vendor-portal/vendor-link-door.ts` | Bearer (SSoT) → υπογραφή → **σύνορο ιδεμποτίας** (principal = `vendor-link:<credentialId>`, **όχι** `anon`: το αποτύπωμα δεν περιέχει την κεφαλίδα) → αναλυτής |
| **Δημόσιο API** | `api/vendor/quote/{route,decline,renew}` | token **μόνο** σε `Authorization: Bearer` |
| **Σελίδα** | `(auth)/vendor/quote/page.tsx` + `VendorPortalGate` + `useVendorPortalLink` | κέλυφος· ο client διαβάζει `#t=`, το σβήνει (`replaceState`), το κρατά σε `sessionStorage` της καρτέλας, φορτώνει με Bearer |
| ~~**Παλιά σελίδα**~~ | ~~`(auth)/vendor/quote/[token]/page.tsx`~~ | **ΔΙΑΓΡΑΦΗΚΕ στη Φ7 (§5.9)** — ΜΙΑ διεύθυνση: `/vendor/quote#t=…` |
| **Γραφείο** | `…/vendor-invite-links-service.ts` · `api/rfqs/[id]/invites/[inviteId]/{links, links/[credentialId]/revoke, resend, revoke}` · `invite-route.ts` | αντιγραφή = **νέος** σύνδεσμος, URL μία φορά · λίστα μεταδεδομένων (ποτέ hash) · ανάκληση ενός · επαναποστολή = νέος σύνδεσμος · ίχνος `vendor_invite` (νέα οντότητα audit) · έλεγχος **και** του RFQ της διαδρομής |
| **Κατάσταση** | `utils/vendor-invite-status.ts` | `revoked` αποθηκευμένη · **`expired` παράγωγη** του `expiresAt` (ΠΟΤΕ αποθηκευμένη) · άγνωστη τιμή ⇒ `revoked` (κλειστό εξ ορισμού) |
| **Αυτοεξυπηρέτηση** | `…/vendor-link-renew.ts` | μόνο στο καταχωρημένο email · RFQ `draft/active` · λήξη = min(7 μέρες, προθεσμία) · `withinRecipientQuota` (3/24ω) + `withHeavyRateLimit` + ιδεμποτία · 202 ουδέτερο **πάντα** |
| ~~**Migration**~~ | ~~`…/vendor-invite-credential-migration.ts` + `scripts/migrations/migrate-vendor-invite-credentials.ts`~~ | **ΔΙΑΓΡΑΦΗΚΕ στη Φ7 (§5.9)** χωρίς να τρέξει ποτέ: η παραγωγή είχε **0** προσκλήσεις. Ο κώδικάς της ζει στο git (`67ed0527`) |

**Διαγράφηκαν**: `vendor-portal-token-service.ts` (τα timestamps → `admin-client-timestamp.ts`) · `api/vendor/quote/[token]/*` ·
`open-invite.ts` · `readVendorPortalIntent` · `getVendorInviteByToken` · `VendorInvite.token`.

### 5.4 Σειρά ανάπτυξης — EXPAND/CONTRACT, μηδέν διακοπή (⚠️ ΑΠΟΦΑΣΗ GIORGIO)

🔴 **Εύρημα της ίδιας της υλοποίησης**: η πρώτη εκδοχή έλεγε «push → migration». Μέχρι να τρέξει η migration, **κάθε
παλιός σύνδεσμος θα απαντούσε «δεν βρέθηκε»** — διακοπή για κάθε προμηθευτή με ζωντανή πρόσκληση. Ένα μεταβατικό
`where('token','==')` θα ξανάνοιγε την παραβίαση μισθωτή που μόλις έκλεισε (CHECK 3.35: η παλιά αναζήτηση ήταν
γραμμή baseline). Λύση: το πρότυπο **expand/contract** των zero-downtime migrations.

1. **EXPAND, πριν το push**: `npm run migrate:vendor-invite-credentials -- --apply` — γράφει τα διαπιστευτήρια `legacy`,
   το `token` **μένει** (ο παλιός κώδικας συνεχίζει να δουλεύει). Τύπωσε τη μέγιστη λήξη (ημερομηνία Φ7).
2. **push** + `firebase deploy --only firestore:rules` (νέος κανόνας `vendor_invite_credentials`· CHECK 3.86).
   Από την πρώτη στιγμή ο νέος κώδικας ανοίγει και τους παλιούς συνδέσμους.
3. **EXPAND + CONTRACT, μετά το push**: `… -- --apply --contract` — πιάνει ό,τι γέννησε ο παλιός κώδικας στο
   μεταξύ, σβήνει τα `token`, `'expired'` → `'revoked'`. **Όχι πριν το push**: ο παλιός κώδικας δεν ξέρει το
   `'revoked'` και θα άνοιγε ανακλημένη πρόσκληση.
   ⚠️ Το expand γράφει **μόνο** διαπιστευτήρια που λείπουν — ξαναγραφή θα **ξεανακαλούσε** σύνδεσμο που ο PM ανακάλεσε στο μεταξύ.
4. **Φ7** (χωριστό commit, μετά τη μέγιστη λήξη του βήματος 1): διαγραφή κλάδου 4 πεδίων στο `parseVendorLink`, της
   σελίδας `[token]`, του `vendor_invite_tokens` (κανόνας · collection · manifest), του `generateLegacyVendorInviteCredentialId`
   **και** του κλάδου `findLegacyPortalQuote` (Σ19 — προσκλήσεις υποβεβλημένες πριν αποκτήσουν `quoteId`).

**Κατάσταση 2026-09-24 (μετρημένη από το git, όχι από μνήμη)**: `67ed0527` + `a5eb786f` (ledger κανόνων) είναι στο
`origin/main` ⇒ τα βήματα **2** έγιναν. Το αν έτρεξε το βήμα **1** (expand) **πριν** το push **δεν** φαίνεται από το git —
το επιβεβαιώνει μόνο ο Giorgio. Οι διορθώσεις της §5.8 είναι **νέο** commit· δεν αλλάζουν σχήμα που χρειάζεται migration
(το `VendorInvite.quoteId` είναι προαιρετικό, με εφεδρεία για τα παλιά έγγραφα).

**Κατάσταση Φ7 (2026-09-24)**: η παραγωγή μετρήθηκε με **0** προσκλήσεις ⇒ τα βήματα 1 και 3 δεν είχαν αντικείμενο και η Φ7 έγινε **αμέσως** (§5.9).

### 5.5 Άγκυρες (όλες πράσινες, μεταλλάξεις 4/4 κόκκινες)

| Σουίτα | Τι κλειδώνει |
|---|---|
| `vendor-invite-credential.test.ts` (Δ1-Δ6) | κύκλος έκδοση→ανάγνωση με **πραγματική** κρυπτογραφία · **Δ3: διαρροή μυστικού δεν αρκεί** · **Δ4 (Φ7): παλιά μορφή ⇒ `invalid_link`, ακριβώς 3 πεδία** |
| `vendor-invite-resolver.test.ts` (Α1-Α4) | κάθε κελί του πίνακα σκοπός × κατάσταση · άρνηση ≠ ανάκληση · φράχτης μισθωτή |
| `vendor-link-door.test.ts` (Π1-Π6) | 401 χωρίς Bearer · 400 πριν από βάση · **principal = σύνδεσμος** · token από διαδρομή αγνοείται |
| `vendor-link-renew.test.ts` (Ρ1-Ρ5) | μόνο καταχωρημένος παραλήπτης · κλειστό RFQ · ποσόστωση · λήξη ≤ προθεσμία |
| ~~`vendor-invite-credential-migration.test.ts` (Μ1-Μ5)~~ | **διαγράφηκε με το migration στη Φ7 (§5.9)** |
| `vendor-invite-status.test.ts` (Κ1-Κ4) | η λήξη είναι παράγωγη · `revoked` ≠ `expired` · άγνωστο ⇒ κλειστό |
| `credential-link-page.test.ts` (Α1-Α4 · **Κ-α..Κ-ε**) | fragment · καμία σελίδα γράφει · `VendorInvite` χωρίς `token` · κανένα fetch με token σε URL · κανένα API κάτω από `[token]` |
| `rfq-service.test.ts` | fan-out: πρόσκληση **χωρίς** token + διαπιστευτήριο στο ίδιο batch |
| `vendor-invite-resolver.test.ts` (**Α2′ · Α3′ · Α5**, §5.8) | ανακλημένος σύνδεσμος ρωτά την πρόσκληση «γιατί» (Σ21) · φράχτης payload (Σ15) · `permits` ≡ κριτής αιτημάτων (Σ16) |
| `vendor-invite-service.test.ts` (Τ1-Τ3, §5.8) | επαφή/πρόσκληση χωρίς ή με κενό `companyId` ⇒ καμία (Σ15) · ανάκληση πρόσκλησης ιδεμποτική, `'expired'` ποτέ σιωπηλή επιτυχία (Σ20) |
| `vendor-portal-quote-owner.test.ts` (Ο1-Ο4, §5.8) | **μία πρόσκληση = μία απάντηση**: ανάγνωση με `quoteId` · ποτέ ερώτημα με `vendorContactId` — ούτε κενό (Σ19) ούτε πραγματικό (Φ7) |
| `vendor-invite-status.test.ts` (**Κ5**, §5.8) | ΕΝΑ παράθυρο επεξεργασίας, από τη δοσμένη στιγμή (Σ17) |

Μεταλλάξεις: σύγκριση σε σταθερό χρόνο → πάντα αληθής · έλεγχος `revoked` αφαιρεμένος · ποσόστωση παρακαμπτόμενη ·
principal `anon` — **4/4 κοκκίνισαν**. §5.8: επιστροφή στο `data.companyId && …` (3 κόκκινα) · ερώτημα με κενό κλειδί
(1 κόκκινο) — **2/2 κοκκίνισαν**.

### 5.6 Δηλωμένα όρια (όχι εκκρεμότητες)

- **Υποβολή προσφοράς εκτός συνόρου ιδεμποτίας**: multipart ⇒ το `runIdempotently` δεν εφαρμόζεται. Ασφαλής ως προς
  τα **δεδομένα** (η επανάληψη βρίσκει `submitted` ⇒ επεξεργασία της **ίδιας** προσφοράς)· όχι ως προς τη διπλή
  ειδοποίηση του PM. ⚠️ Δύο **ταυτόχρονες πρώτες** υποβολές της ίδιας πρόσκλησης (δύο καρτέλες, ίδιο δευτερόλεπτο)
  γεννούν δύο προσφορές· το `quoteId` της πρόσκλησης κρατά την τελευταία (Σ19 — ίδια συμπεριφορά με πριν, πλέον **ορατή**).
- **Δικαίωμα procurement στα routes του γραφείου**: κανένα route του `api/rfqs`/`api/procurement` δεν δηλώνει
  `permissions` (μόνο φράχτη μισθωτή). Δεν εισήχθη εδώ για δύο μόνο routes — θα ήταν ασυνέπεια· ζητά δικό του ADR RBAC.
- **Ειδοποίηση PM για αίτημα νέου συνδέσμου**: δεν προστέθηκε γεγονός· ίχνος = το διαπιστευτήριο `self_service` (ορατό στη λίστα συνδέσμων).
- **Τίτλοι ειδοποιήσεων PM** (`route.ts` · `decline/route.ts`): ο `dispatchProcurementNotification` απαιτεί `title` —
  ωμά ελληνικά ως εφεδρεία δίπλα στο `titleKey` (προϋπήρχαν, N.11 · ίδιο σχήμα σε όλο το `notification-orchestrator`).

### 5.7 Χρησμός 3.51 (ADR-875) — ⚠️ ΑΠΟΦΑΣΗ GIORGIO

Η δημόσια πόρτα του `GOLDEN_PUBLIC_TEMPLATES` `/vendor/quote/[token]` είναι πλέον **ανακατεύθυνση**· η πύλη είναι το
στατικό `/vendor/quote`, με δεδομένα από client fetch (ο server **δεν** βλέπει ποτέ το διαπιστευτήριο — άρα και ο
χρησμός δεν μπορεί να την αποδώσει με δεδομένα στο SSR). Η σπορά (`emulator-seed-golden.ts`) διαβάζει πλέον το token
από το fragment. Το `golden-catalog.js` και το `.i18n-ssr-oracle-baseline.json` **δεν αγγίχτηκαν** — η αναπροσαρμογή
της πόρτας στον κατάλογο και η ξανασπορά είναι απόφαση Giorgio, **μετά** το push Φ2.2+Φ2.4 (§7).

✅ **Αποφασίστηκε στη Φ7 (§5.9)**: η πόρτα βγαίνει από τον κατάλογο (δεν αντικαθίσταται — το `/vendor/quote` είναι στατικό)· η baseline μένει για το επόμενο τρέξιμο του χρησμού.

### 5.8 Επαλήθευση στον browser (2026-09-24, emulator) — και ό,τι βρήκε

**Διάταξη**: `npm run emulator` · `emulator:seed-personas` · `dev:emulator` στη **3100** (`NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`,
`NEXT_PUBLIC_APP_URL=http://localhost:3100` — η 3000 ήταν κανονικός `next dev`, **δεν** αγγίχτηκε) · `emulator:seed-golden`
με `I18N_SSR_ORACLE_BASE_URL=…:3100`. Γραφείο = τα **πραγματικά** routes με ID token του emulator από custom token
(κανένας κωδικός)· πύλη = Chrome. Τα jest **δεν** έβλεπαν τίποτα από όσα ακολουθούν: όλα είναι ροή client ↔ server.

| # | Σενάριο | Αποτέλεσμα |
|---|---|---|
| 1 | `copy_link` → URL | ✅ `/vendor/quote#t=…` — ποτέ `/vendor/quote/<token>` |
| 2 | άνοιγμα · Network | ✅ το `#t=` σβήνει · μόνο `GET /api/vendor/quote` · χωρίς κεφαλίδα 401 `missing_link` · token σε query 401 · Bearer 200 · `no-referrer` · `no-store` |
| 3 | reload · νέα καρτέλα | ✅ reload ανοίγει (sessionStorage) · νέα καρτέλα ⇒ «Ανοίξτε τον σύνδεσμο από το email σας» |
| 4 | υποβολή (με PDF) · επεξεργασία | ✅ μετά τις διορθώσεις **Σ16 · Σ17 · Σ19** (πριν: βλ. πίνακα ευρημάτων) |
| 5 | `&intent=decline` | ✅ ανοίγει **μόνο** ο διάλογος (καμία κλήση) · μετά: «Έχετε αρνηθεί» (όχι «ανακλήθηκε») |
| 6 | σύνδεσμοι · ανάκληση ενός / όλης | ✅ λίστα (προέλευση · εκδότης · λήξη · τελευταία χρήση) · ανακλημένος 410, ο άλλος 200 · μετά τα **Σ20 · Σ21** |
| 7 | ληγμένος → «Στείλτε μου νέο σύνδεσμο» | ✅ «Ελέγξτε το email σας» (ουδέτερο) · νέο `self_service` χωρίς εκδότη-μέλος, με `requesterIpHash` · 202 · ⚠️ **Σ22** |
| 8 | `/vendor/quote/<token>[?intent=…]` | ✅ 307 · `no-store` · `#t=` · `intent` μόνο από λευκή λίστα (`decline` ναι, `hack` όχι) |
| 9 | el/en | ✅ 0 ωμά κλειδιά · 0 ελληνικά σε EN · 80/80 κλειδιά της πύλης υπάρχουν, el ≡ en |

| # | Εύρημα (επαληθευμένο στον browser) | Διόρθωση στην κλάση |
|---|---|---|
| **Σ15** | φράχτες μισθωτή πάνω σε **ωμό** `snap.data()` με `isOwnedByCompany` / `data.companyId && …`: επαφή **χωρίς** `companyId` περνούσε (`fetchVendorContact` — το δίδυμό του στο `rfq-service` είχε ήδη διορθωθεί) · παγίδα `'' === ''` σε 4 ακόμη σημεία (τρίτου, μετά το Βήμα 4) | `isPayloadOwnedByCompany` (το SSoT **το ορίζει** για δεδομένα βάσης) σε 5 σημεία: `fetchVendorContact` · `getVendorInvite` · `revokeVendorInvite` · `loadInvite` · `revokeVendorCredential` |
| **Σ16** | ο client **ξανάγραφε την πολιτική**: «Άρνηση» σε υποβεβλημένη (ο server: 409 `already_submitted`) · «Προβολή» σε κλειστό παράθυρο · μετά την **πρώτη** υποβολή η «Προβολή» άνοιγε **άδεια** φόρμα (`initialQuote` = `null`) · το route ξανάγραφε το `isEditWindowOpen` ως `editWindowOpen` | `vendorInvitePermits()` = ο **ίδιος** `judgeVendorInvite` → `invite.permits` στο GET · ο client μόνο διαβάζει · μετά την υποβολή ο Gate **ξαναδιαβάζει** την όψη (`revalidate`, σιωπηλά) · `success.bodyClosed` |
| **Σ17** | `72` ωρών γραμμένο **3 φορές** (route · `vendor-invite-service` · `vendor-portal-submit-service`) με **3 χωριστά** `Date.now()` για την ίδια υποβολή· η απάντηση ξαναϋπολόγιζε αντί να επιστρέφει ό,τι γράφτηκε | `VENDOR_QUOTE_EDIT_WINDOW_HOURS` + `vendorQuoteEditWindowEnd(nowMs)` στο `vendor-invite-status` · **μία** στιγμή ανά υποβολή σε προσφορά + πρόσκληση + απάντηση (μετρήθηκε: ίδια ως το ms) |
| **Σ18** | δεύτερος σύνδεσμος στην **ίδια** καρτέλα = πλοήγηση στο ίδιο έγγραφο: η σελίδα έδειχνε την **προηγούμενη** πρόσκληση και το νέο `#t=` **έμενε ορατό** | `hashchange` στο `useVendorPortalLink` · η όψη σημαδεύεται με το token που τη φόρτωσε (ποτέ ξένη όψη) · `key={token}` στον client |
| **Σ19** | 🔴 **δύο προμηθευτές με χειροκίνητο email στο ίδιο RFQ = μία προσφορά**: `findExistingPortalQuote(rfqId, vendorContactId='')` βρήκε την προσφορά του Α όταν υπέβαλε ο Β ⇒ ο Β **έγραψε πάνω** της (μετρήθηκε: 1178 € → 620 €, `auditTrail` με δύο `portal_submitted`) και ο Α θα έβλεπε τις **τιμές του Β** | **μία πρόσκληση = μία απάντηση**: `VendorInvite.quoteId` γράφεται στην πρώτη υποβολή· ανάγνωση **με ταυτότητα** + φράχτης εταιρείας/RFQ, κανένα ερώτημα, κανένας δείκτης· εφεδρεία ερωτήματος **μόνο** με πραγματική επαφή (⏳ Φ7) |
| **Σ20** | 2η ανάκληση πρόσκλησης ⇒ 409 `not_live` (η ανάκληση συνδέσμου ήταν ήδη ιδεμποτική) — δεύτερο μέλος έβλεπε σφάλμα ενώ ίσχυε ό,τι ζήτησε | ήδη `revoked` (**αποθηκευμένη** τιμή) ⇒ επιτυχία χωρίς εγγραφή/audit· `'expired'` προ-migration ⇒ 409, ποτέ σιωπηλή επιτυχία |
| **Σ21** | ανάκληση **πρόσκλησης** ⇒ ο προμηθευτής διάβαζε «Ο σύνδεσμος ανακλήθηκε» — ο αναλυτής σταματούσε στο διαπιστευτήριο | ανακλημένος **αυθεντικός** σύνδεσμος ⇒ ο αναλυτής ρωτά την πρόσκληση (πηγή αλήθειας, καμία δεύτερη σημαία) ⇒ «Η πρόσκληση αποσύρθηκε» |
| **Σ22** | ⚠️ **ΑΠΟΦΑΣΗ GIORGIO**: ο server πάνω στον **emulator** στέλνει **πραγματικό** email μέσω Mailgun («Email sent successfully via Mailgun» — στο ανύπαρκτο `vendor+…@golden.local`). Κανένας φραγμός emulator στις ~δεκάδες διαδρομές Mailgun | ✅ **ΛΥΘΗΚΕ στο ADR-877** (2026-09-24): 4 δρόμοι → 2 πόρτες εξόδου· σε emulator (γεγονός του Firebase SDK, όχι διακόπτης) το email γράφεται `.eml` στο `/.emulator-outbox/`, **ποτέ** στο δίκτυο. Βρέθηκε και σιωπηλή απόρριψη Resend στο κανάλι πρόσκλησης |
| — | boy-scout: οι ετικέτες των γραμμών προσφοράς + το πεδίο αρχείων **χωρίς** προσβάσιμο όνομα (0 `htmlFor`) · διπλή τελεία «π.μ..» στο `success.body` | `<label>` που περιέχει το πεδίο (ίδιο σχήμα με το `Field`) — μετρήθηκε: 11/11 πεδία με όνομα · κείμενο χωρίς τελική τελεία |

**Όχι στον browser**: το πάνελ «Σύνδεσμοι» του γραφείου (απαιτεί σύνδεση με κωδικό — δεν πληκτρολογείται από πράκτορα)·
ελέγχθηκαν τα routes που καλεί. Οπτικός έλεγχος: Giorgio.

### 5.9 Φ7 — απόσυρση της παλιάς μορφής: ΜΙΑ μορφή συνδέσμου (ΥΛΟΠΟΙΗΘΗΚΕ 2026-09-24, χωρίς commit)

**Προϋπόθεση, μετρημένη** (Firestore παραγωγής μέσω MCP, 2026-09-24, με πραγματικά δεδομένα σε 73 συλλογές):
`vendor_invites` **0** · `vendor_invite_credentials` **0** · `vendor_invite_tokens` **0** · `rfqs` **0**. Άρα το
expand/contract της §5.4 **δεν είχε αντικείμενο**. Δεν κυκλοφορεί **κανένας** σύνδεσμος παλιάς μορφής, οπότε η Φ7 δεν
περιμένει «μέγιστη λήξη».

**SSoT audit (grep)**: `vendor_invite_tokens` · `VENDOR_INVITE_TOKENS` · `generateLegacyVendorInviteCredentialId` ·
`findLegacyPortalQuote` · `vendor/quote/[token]` · `'legacy'` · `'expired'` · `migrate:vendor-invite-credentials`. Τι βρέθηκε
και τι έγινε:

| Σημείο | Πράξη |
|---|---|
| `parseVendorLink` — κλάδος 4 πεδίων | **σβήστηκε**. Εύρημα: το `decodeSignedToken(…, N)` κρίνει «**τουλάχιστον** N» (`minFields`) — η γραμματική εδώ είναι «**ακριβώς** 3» ⇒ ρητός έλεγχος `LINK_FIELD_COUNT`. Χωρίς αυτόν, ένας έγκυρος σύνδεσμος με **παραπανίσιο** πεδίο θα γινόταν δεκτός (μετάλλαξη Μ1) |
| `generateLegacyVendorInviteCredentialId` (class · convenience · barrel) | **σβήστηκε** — καταναλωτές μόνο ο αναλυτής + η migration |
| `(auth)/vendor/quote/[token]/page.tsx` | **σβήστηκε** · `vendorPortalLocation` **και** `asVendorPortalIntent` έμειναν **εσωτερικά** του `vendor-portal-links` (μοναδικός εξωτερικός καταναλωτής ήταν η σελίδα· τα tests είναι εκτός γραφήματος knip ⇒ αλλιώς νέο νεκρό export για το 3.22). Η άγκυρα Α3 περνά πια από τη **μόνη** είσοδο πρόθεσης, το fragment |
| `vendor_invite_tokens` | κανόνας (`firestore.rules`) · `COLLECTIONS` · `coverage-manifest` · pattern του μητρώου `vendor-portal` + η απόδειξή του (`pattern-proofs.js`) — **σβήστηκαν**. Φρουρός για συλλογή που δεν υπάρχει = αδρανής φρουρός |
| `findLegacyPortalQuote` + εφεδρεία | **σβήστηκε** · `PortalQuoteOwner` χωρίς `vendorContactId` · `VendorInvite.quoteId` **υποχρεωτικό** `string \| null` (ο ΜΟΝΟΣ κατασκευαστής, `vendor-invite-issue`, το γράφει ήδη `null`) |
| προέλευση `'legacy'` (`VENDOR_CREDENTIAL_ORIGINS` · `Exclude<…>` · `quotes.json` el/en · `src/types/i18n.ts` ξαναπαραγμένο) | **σβήστηκε** |
| migration (script · καθαρός σχεδιαστής · test Μ1-Μ5 · `npm run migrate:…`) | **σβήστηκε** — βλ. «Απόφαση» |
| `normalizeInviteStatus` · Σ20 (`'expired'` ⇒ 409) | **ΚΡΑΤΗΘΗΚΑΝ, με νέο λόγο**: δεν είναι κώδικας μετάβασης αλλά **fail-closed**. Το `'expired'` είναι τιμή **μόνο οθόνης** (παράγωγη)· αν βρεθεί αποθηκευμένο, είναι άγνωστη τιμή ⇒ κλειστό |
| χρησμός 3.51: `GOLDEN_TEMPLATES['/vendor/quote/[token]']` · οντότητα `vendorToken` · `createVendorToken` στη σπορά · εφήμερο `VENDOR_PORTAL_SECRET` (κατάλογος + workflow) | **σβήστηκαν** — βλ. «Απόφαση» |
| σχόλια που περιέγραφαν την **τωρινή** κατάσταση (`rfq-service` πίνακας καλούντων · `first-contacts/guest` · `vendor-portal-submit-service`) | διορθώθηκαν. Τα σχόλια **ιστορικής** αφήγησης («ήταν γραμμένη τρεις φορές…») μένουν |

**Απόφαση — το migration σβήνεται (όχι «μένει ως ιστορικό»)**. Έρευνα: ο κανόνας «μη σβήνεις ό,τι εφαρμόστηκε»
(Flyway: checksum στο history table) αφορά **αλυσίδες σχήματος**. Αυτό εδώ ήταν **data backfill** μίας χρήσης. Το πρότυπο των
μεγάλων για τέτοια είναι το Shopify [`maintenance_tasks`](https://github.com/Shopify/maintenance_tasks) (*«delete the Task code
if you no longer need it»*) και το Strangler Fig της [Microsoft](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig):
μετά τη μετάβαση ο παλιός δρόμος **αφαιρείται**, αλλιώς μένει zombie code. **Πού πάμε παραπέρα**: το migration **ΔΕΝ ΜΠΟΡΟΥΣΕ** να
μείνει χωρίς να κρατήσει ζωντανή τη γραμματική που σβήνει η Φ7 (`generateLegacy…` · ανάγνωση 4 πεδίων · `VENDOR_INVITE_TOKENS`).
Ένα «ιστορικό» που χρειάζεται τον παλιό κώδικα για να μεταγλωττιστεί **δεν είναι** ιστορικό. Ιστορικό = το git (`67ed0527`) + αυτό το ADR.

**Απόφαση — χρησμός 3.51**: η πόρτα `/vendor/quote/[token]` **βγαίνει** από τον κατάλογο golden (και η άγκυρα Γ1 δεν το αφήνει
προαιρετικό: ο κατάλογος πρέπει να ταιριάζει ΑΚΡΙΒΩΣ με τις διαδρομές). **Δεν** αντικαθίσταται με `/vendor/quote`: είναι
**στατική**, και το διαπιστευτήριο ζει στο fragment ⇒ ο server δεν το βλέπει ποτέ ⇒ δεν υπάρχει τίποτα να δεθεί με golden.
⚠️ Η `.i18n-ssr-oracle-baseline.json` **δεν** αγγίχτηκε: είναι **παραγόμενο** artifact (`i18n-ssr-oracle:baseline`, με crawl) και
χειρόγραφη επεξεργασία του θα ήταν «πράσινο που δεν μετρήθηκε». Οι 2 μπαγιάτικες γραμμές `/o/alpha-techniki/vendor/quote/golden-vendorToken@…`
(ήδη μπαγιάτικες από το Βήμα 1) φεύγουν στο επόμενο τρέξιμο του χρησμού, με τη σειρά της §7.

**Άγκυρες (πράσινες) + μεταλλάξεις 3/3 κόκκινες**:

| Άγκυρα | Κλειδώνει |
|---|---|
| `vendor-invite-credential.test.ts` **Δ4** (ξαναγράφτηκε) | 🔴 παλιά μορφή 4 πεδίων, **σωστά υπογεγραμμένη** ⇒ `invalid_link` · νέα μορφή + παραπανίσιο πεδίο ⇒ `invalid_link` |
| `vendor-portal-quote-owner.test.ts` **Ο3 · Ο4** (ξαναγράφτηκαν) | χωρίς `quoteId` ⇒ καμία ανάγνωση · ολόκληρη πρόσκληση με `''` **ή** με πραγματική επαφή ⇒ `null`, **κανένα** ερώτημα |
| `credential-link-page.test.ts` **Κ-ζ** (νέα) · Π0 · Α4 | καμία σελίδα κάτω από `/vendor/quote/<δυναμικό>` · σελίδες με token 11 → 10 |
| `i18n-ssr-golden.test.ts` Γ1γ · Γ6β | δημόσιες πόρτες = μόνο `/attendance/check-in/[token]` |

Μεταλλάξεις: Μ1 χωρίς έλεγχο ακριβούς πλήθους (1 κόκκινο) · Μ2 επιστροφή της παλιάς μορφής (2 κόκκινα) · Μ3 επιστροφή της
εφεδρείας ερωτήματος (3 κόκκινα). Επαναφορά στην ίδια εκτέλεση, αρχεία επαληθευμένα ακέραια (`cmp`).

**Ανάπτυξη**: άλλαξε το `firestore.rules` (σβήστηκε ο κανόνας `vendor_invite_tokens`) ⇒ μετά το push ο Giorgio τρέχει
`firebase deploy --only firestore:rules` + καταγραφή στο ledger (CHECK 3.86).

## 6. Ανοιχτά ερωτήματα (μετρώνται, δεν μαντεύονται)

- **i18n στο `(auth)`**: οι δύο σελίδες έφυγαν από το `/o` layout. Αν το SSR βγάζει ωμά κλειδιά (`vendor-portal` ·
  `attendance`), θα το δείξει ο Χ **ανώνυμα** στο πρώτο run· θεραπεία = δήλωση `routeSlices` (ADR-744), όπως τα
  `contact__token` · `card-email__token`.
- **Διπλό κουμπί γλώσσας**: η πύλη έχει δικό της `languageToggle` (EN/EL) ενώ το `(auth)` προσφέρει ήδη `AuthToolbar`
  (CHECK 3.72). Το τοπικό `locale` τροφοδοτεί και μορφοποίηση ημερομηνιών/επαναφόρτωση — αφαίρεση = αναδιάρθρωση του
  `VendorPortalClient` (221 γρ.), όχι μικρή διόρθωση. Ανοιχτό, με όνομα.
- **`bg-white` στο `VendorPortalClient`/`VendorPortalForm`/`SuccessState`** — μη θεματικό (CHECK 3.39 οικογένεια).
  Προϋπήρχε μέσα στο `/o`· δεν αγγίχθηκε εδώ.
- **Κ10 του `workspace-segment.test.ts`** κόκκινο — **όχι** από αυτό το ADR: η άγκυρα ψάχνει `workspaceSegmentFor` /
  `unaddressable` σε catch-all που πλέον χρησιμοποιεί `workspaceDestinationFor`. Προϋπάρχον (handoff ADR-875 §4).

## 7. Σειρά push

Το Βήμα 1 αλλάζει τον παρονομαστή του δίδυμου (110 → 108). **Πρώτα** push της Φ2.2 + Φ2.4 (ADR-875 §14/§12) και
έλεγχος του run με τα κριτήρια του ADR-875 §14 (110 guard-honored)· **μετά** αυτό το ADR. Αλλιώς το κριτήριο «110»
δεν μπορεί να αποδειχθεί.

## Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-23 | Δημιουργία. Έρευνα (§2) · Ε1-Ε11 · Βήματα 1-3 υλοποιημένα · ο Χ κρίνει δημόσιες πόρτες ανώνυμα (§3.4) · άγκυρες Π0-Π4 + Α1-Α4 + Γ1γ/Γ1δ · Βήμα 4 εγκεκριμένο, εκκρεμεί |
| 2026-09-23 | CHECK 3.28: οι σελίδες `card-email` · `hours-question` είχαν δίδυμη ανάγνωση `params`+`searchParams` → ΕΝΑΣ αναγνώστης `readCredentialLinkAnswerPage` (+ τύπος `CredentialLinkAnswerPageProps`) στο `lib/tokens/credential-link-page.ts`. |
| 2026-09-24 | **Βήμα 4 υλοποιήθηκε (§5)**: «ένας σύνδεσμος = ένα διαπιστευτήριο» (`vendor_invite_credentials`, μόνο `nonceHash`) · token στο **fragment** + `Authorization: Bearer` · ΕΝΑΣ αναλυτής (σκοπός × κατάσταση) πίσω από ΜΙΑ πόρτα-σύνορο ιδεμποτίας · κατάσταση `revoked` (λήξη = παράγωγη) · αντιγραφή/επαναποστολή = νέος σύνδεσμος, ανάκληση ανά σύνδεσμο, ίχνος `vendor_invite` · «στείλε μου νέο σύνδεσμο» (ουδέτερο 202, ποσόστωση παραλήπτη) · migration με ντετερμινιστικό ID (ο υπάρχων σύνδεσμος ανοίγει) · boy-scout Σ10 (email → πίνακας λόγων) · Σ12 (`clientIpFingerprint`) · Σ13 (`extractBearerToken` ένα) · Σ14. Άγκυρες §5.5, μεταλλάξεις 4/4. Εκκρεμούν αποφάσεις Giorgio §5.4 (σειρά ανάπτυξης) · §5.7 (χρησμός). |
| 2026-09-24 | **§5.8 επαλήθευση στον browser** (emulator, 9 σενάρια): ευρήματα **Σ15-Σ22**. 🔴 Σ19: δύο προμηθευτές με χειροκίνητο email στο ίδιο RFQ μοιράζονταν **μία** προσφορά (ο Β έγραφε πάνω στον Α) → `VendorInvite.quoteId`, ανάγνωση με ταυτότητα · Σ15 φύλακας payload (5 σημεία) · Σ16 `permits` από τον ΕΝΑ κριτή + revalidate μετά την υποβολή · Σ17 ΕΝΑ παράθυρο επεξεργασίας (ήταν ×3) · Σ18 `hashchange` · Σ20 ιδεμποτική ανάκληση πρόσκλησης · Σ21 «αποσύρθηκε» ≠ «ανακλήθηκε» · Σ22 (Mailgun υπό emulator) → απόφαση Giorgio. Άγκυρες Α2′/Α3′/Α5 · Τ1-Τ3 · Ο1-Ο4 · Κ5, μεταλλάξεις 2/2. |
| 2026-09-24 | **Φ7 (§5.9)**: απόσυρση της παλιάς μορφής — παραγωγή μετρημένη με 0 προσκλήσεις. Σβήστηκαν: κλάδος 4 πεδίων (+ έλεγχος **ακριβούς** πλήθους, το `decodeSignedToken` κρίνει «τουλάχιστον») · `generateLegacyVendorInviteCredentialId` · σελίδα `[token]` · `vendor_invite_tokens` (κανόνας · COLLECTIONS · manifest · pattern μητρώου) · `findLegacyPortalQuote` (`quoteId` υποχρεωτικό) · προέλευση `legacy` · migration (data backfill — πρότυπο Shopify maintenance_tasks / Strangler Fig) · πόρτα χρησμού + `vendorToken` + εφήμερο `VENDOR_PORTAL_SECRET`. Άγκυρες Δ4 · Ο3/Ο4 · Κ-ζ · Γ1γ/Γ6β, μεταλλάξεις 3/3. |
| 2026-09-24 | **Σ22 → ADR-877**: μία πόρτα εξόδου email, το email ακολουθεί το επίπεδο δεδομένων (emulator ⇒ outbox). |
| 2026-09-24 | **Επαλήθευση ADR-877 (§6 εκεί)** — η πύλη `/vendor/quote` απέκτησε **route slice** (ήταν η μόνη σελίδα διαπιστευτηρίου με ψυχρή είσοδο χωρίς slice ⇒ ωμό `vendor-portal:page.loading` στο SSR): `errorKey: string` → κλειστός τύπος `VendorPortalActionError` (στατική `t()`), δήλωση στο `.i18n-shell-slice.json` (5671 bytes), `registerRouteSlice` στο `VendorPortalGate`. Το email πρόσκλησης γράφει ώρα **Αθήνας** (όχι του διακομιστή σε UTC) και δηλώνει `lang`. ⚠️ Ανοιχτό: η αποτυχία **άρνησης** δείχνει «Η υποβολή απέτυχε» (ADR-877 §6.4). |
