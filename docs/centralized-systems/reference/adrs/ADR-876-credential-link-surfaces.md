# ADR-876 — Επιφάνειες όπου η διεύθυνση είναι διαπιστευτήριο (πύλη προμηθευτή · check-in · σύνδεσμοι token)

| | |
|---|---|
| **Status** | ACCEPTED — Βήματα 1-3 υλοποιημένα (2026-09-23, χωρίς commit) · Βήμα 4 (σκλήρυνση) εγκρίθηκε, εκκρεμεί |
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

## 5. Βήμα 4 — σκλήρυνση (εγκρίθηκε, εκκρεμεί)

1. **`tokenHash`** (sha256) αντί για ωμό `token` στο `vendor_invites` + αναζήτηση με hash (Ε4). Migration υπαρχόντων
   εγγράφων · δείκτης (CHECK 3.91).
2. **Ανάκληση παντού** (Ε5): σελίδα + API μέσω του **ενός** `open-invite.ts`.
3. **«Στείλε μου νέο σύνδεσμο»** στη σελίδα λήξης (POST· μόνο στο καταχωρημένο email της πρόσκλησης· όριο HEAVY).
4. Token **εκτός διαδρομής του API** (σώμα/κεφαλίδα): σήμερα το `/api/vendor/quote/<token>` γράφεται σε access log —
   το `no-referrer` της σελίδας **δεν** το λύνει.

**Δηλωμένα εκτός (επιλογές, όχι εκκρεμότητες)**: ανταλλαγή token → HttpOnly cookie + καθαρό URL (ο κύκλος ζωής
cookie με πολλά RFQ ανά προμηθευτή κοστίζει περισσότερο από όσο προστατεύει, με `no-referrer` + καθολικό
`strict-origin-when-cross-origin` ήδη ενεργά) · OTP ως δεύτερος παράγοντας για RFQ υψηλής αξίας.

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
