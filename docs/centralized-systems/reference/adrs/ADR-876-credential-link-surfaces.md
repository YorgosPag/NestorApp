# ADR-876 — Επιφάνειες όπου η διεύθυνση είναι διαπιστευτήριο (πύλη προμηθευτή · check-in · σύνδεσμοι token)

| | |
|---|---|
| **Status** | ACCEPTED — Βήματα 1-3 υλοποιημένα (`f545dcb7`) · Βήμα 4 (σκλήρυνση, §5) υλοποιημένο 2026-09-24, χωρίς commit · Φ7 (απόσυρση legacy) μετά τη migration |
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

## 5. Βήμα 4 — σκλήρυνση: «ένας σύνδεσμος = ένα διαπιστευτήριο» (ΥΛΟΠΟΙΗΘΗΚΕ 2026-09-24, χωρίς commit)

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
| **Παλιά σελίδα** | `(auth)/vendor/quote/[token]/page.tsx` | **μόνο** ανακατεύθυνση σε `#t=` (καμία βάση — Α4) · διαγράφεται στη Φ7 |
| **Γραφείο** | `…/vendor-invite-links-service.ts` · `api/rfqs/[id]/invites/[inviteId]/{links, links/[credentialId]/revoke, resend, revoke}` · `invite-route.ts` | αντιγραφή = **νέος** σύνδεσμος, URL μία φορά · λίστα μεταδεδομένων (ποτέ hash) · ανάκληση ενός · επαναποστολή = νέος σύνδεσμος · ίχνος `vendor_invite` (νέα οντότητα audit) · έλεγχος **και** του RFQ της διαδρομής |
| **Κατάσταση** | `utils/vendor-invite-status.ts` | `revoked` αποθηκευμένη · **`expired` παράγωγη** του `expiresAt` · `'expired'` προ-migration ⇒ `revoked` |
| **Αυτοεξυπηρέτηση** | `…/vendor-link-renew.ts` | μόνο στο καταχωρημένο email · RFQ `draft/active` · λήξη = min(7 μέρες, προθεσμία) · `withinRecipientQuota` (3/24ω) + `withHeavyRateLimit` + ιδεμποτία · 202 ουδέτερο **πάντα** |
| **Migration** | `…/vendor-invite-credential-migration.ts` (καθαρός) + `scripts/migrations/migrate-vendor-invite-credentials.ts` · `npm run migrate:vendor-invite-credentials [-- --apply]` | ωμό `token` → διαπιστευτήριο `legacy` με **ντετερμινιστικό ID από sha256(nonce)** ⇒ ο σύνδεσμος που ήδη κρατά ο προμηθευτής **συνεχίζει να ανοίγει** (άγκυρα Μ1) · ιδεμποτικό · αναφέρει τη **μέγιστη λήξη ζωντανού παλιού συνδέσμου** |

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
   σελίδας `[token]`, του `vendor_invite_tokens` (κανόνας · collection · manifest), του `generateLegacyVendorInviteCredentialId`.

### 5.5 Άγκυρες (όλες πράσινες, μεταλλάξεις 4/4 κόκκινες)

| Σουίτα | Τι κλειδώνει |
|---|---|
| `vendor-invite-credential.test.ts` (Δ1-Δ6) | κύκλος έκδοση→ανάγνωση με **πραγματική** κρυπτογραφία · **Δ3: διαρροή μυστικού δεν αρκεί** · παλιά μορφή → ID που δεν φανερώνει το nonce |
| `vendor-invite-resolver.test.ts` (Α1-Α4) | κάθε κελί του πίνακα σκοπός × κατάσταση · άρνηση ≠ ανάκληση · φράχτης μισθωτή |
| `vendor-link-door.test.ts` (Π1-Π6) | 401 χωρίς Bearer · 400 πριν από βάση · **principal = σύνδεσμος** · token από διαδρομή αγνοείται |
| `vendor-link-renew.test.ts` (Ρ1-Ρ5) | μόνο καταχωρημένος παραλήπτης · κλειστό RFQ · ποσόστωση · λήξη ≤ προθεσμία |
| `vendor-invite-credential-migration.test.ts` (Μ1-Μ5) | **ο υπάρχων σύνδεσμος ανοίγει μετά τη migration** · ιδεμποτία · μέγιστη ζωντανή λήξη |
| `vendor-invite-status.test.ts` (Κ1-Κ4) | η λήξη είναι παράγωγη · `revoked` ≠ `expired` · άγνωστο ⇒ κλειστό |
| `credential-link-page.test.ts` (Α1-Α4 · **Κ-α..Κ-ε**) | fragment · καμία σελίδα γράφει · `VendorInvite` χωρίς `token` · κανένα fetch με token σε URL · κανένα API κάτω από `[token]` |
| `rfq-service.test.ts` | fan-out: πρόσκληση **χωρίς** token + διαπιστευτήριο στο ίδιο batch |

Μεταλλάξεις: σύγκριση σε σταθερό χρόνο → πάντα αληθής · έλεγχος `revoked` αφαιρεμένος · ποσόστωση παρακαμπτόμενη ·
principal `anon` — **4/4 κοκκίνισαν**.

### 5.6 Δηλωμένα όρια (όχι εκκρεμότητες)

- **Υποβολή προσφοράς εκτός συνόρου ιδεμποτίας**: multipart ⇒ το `runIdempotently` δεν εφαρμόζεται. Ασφαλής ως προς
  τα **δεδομένα** (η επανάληψη βρίσκει `submitted` ⇒ επεξεργασία της **ίδιας** προσφοράς)· όχι ως προς τη διπλή
  ειδοποίηση του PM.
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
