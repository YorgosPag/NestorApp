# ADR-748 — Χώροι εργασίας ανά ειδικότητα: «τι βλέπω» ξεχωριστά από «τι δικαιούμαι»

| | |
|---|---|
| **Κατάσταση** | 🟡 DRAFT — Φάση 0 (ευρήματα + διευκρινίσεις). Καμία γραμμή κώδικα δεν έχει γραφτεί. |
| **Ημερομηνία** | 2026-08-02 |
| **Συγγραφείς** | Claude Opus 5 + Γιώργος Παγώνης |
| **Σχετικά** | ADR-180 (dashboard tiles), ADR-244 (role management console), ADR-283 (project roles SSoT), ADR-345 (ribbon), ADR-443/444 (discipline tabs), ADR-662 (topography tab), ADR-657 (BIM authoring/presentation RBAC), ADR-703 (role-predicate SSoT), ADR-702 (tenant query scope) |
| **Κατηγορία** | UX Architecture / Authorization |

---

## 0. ΤΟ ΟΡΑΜΑ — διατυπώθηκε 2026-08-02, αλλάζει το πλαίσιο ΚΑΘΕ απόφασης εδώ

> ⚠️ **Διάβασε αυτή την ενότητα πριν από οτιδήποτε άλλο.** Το ADR ξεκίνησε ως «κρύψε
> κουμπιά ανά ρόλο». Στην πορεία ο Γιώργος αποκάλυψε ότι ο προορισμός είναι πολύ
> μεγαλύτερος, και κάθε επόμενη απόφαση κρίνεται **ως προς αυτόν**.

Ο Γιώργος (2026-08-02, αυτούσια η ουσία):

> Θέλω σταδιακά η εφαρμογή να συγκεντρώσει **πολλά επαγγέλματα σχετικά με την κατασκευή**.
> Ένας μηχανικός έχει έναν ρόλο σε μια εταιρεία και **άλλα δικαιώματα σε έργο άλλης
> εταιρείας**. Ο ίδιος μηχανικός μπορεί να είναι και **αγοραστής ακινήτου** της εταιρείας,
> αλλά να θέλει ταυτόχρονα και **το δικό του λογιστικό**. Θέλω να συγκεντρώσω σε ενιαία
> πλατφόρμα πολλές ειδικότητες — αντί καθένας να δουλεύει αυτόνομα και **ασύγχρονα**, να
> τους συγχρονίσω. **Η ανταλλαγή πληροφοριών να μη γίνεται με email, αλλά μέσα από τον
> Νέστορα.** Ο αρχιτέκτονας σήμερα έχει μία εφαρμογή για τα λογιστικά, μία για τα γραμμικά
> (AutoCAD), άλλη για τα τρισδιάστατα. Σκοπός: **να μη χρειάζεται κανένας επαγγελματίας να
> πηγαίνει σε πολλές εφαρμογές.** Δεν είναι μόνο για την κατασκευαστική όπως ξεκίνησε — θέλω
> να συγκεντρώσω **όλον τον τεχνικό κόσμο**. Το CRM του αρχιτέκτονα να μπορεί να το
> χειρίζεται **ανάμεσα στις διάφορες εταιρείες**, με τους πελάτες του, τα κοινωνικά δίκτυα,
> τις αναρτήσεις του — αργότερα ίσως και δικές του ιστοσελίδες.

### 0.1 Τι σημαίνει αυτό αρχιτεκτονικά

Είναι μετάβαση από **εργαλείο μιας εταιρείας** (μία κατασκευαστική + οι γύρω της) σε
**πολυ-οργανισμική επαγγελματική πλατφόρμα** (ο τεχνικός κόσμος· ο καθένας με δικό του
χώρο· συνδεδεμένοι μεταξύ τους).

Το μοντέλο έχει όνομα και το έχουν λύσει: **Slack · Figma · Notion · GitHub · Vercel ·
Xero**. Ένας λογαριασμός → πολλοί οργανισμοί → διαφορετικός ρόλος σε καθέναν.

### 0.2 Τα τρία σενάρια που ΠΡΕΠΕΙ να δουλεύουν

| # | Σενάριο | Σημερινή δυνατότητα |
|---|---|---|
| Σ-1 | Ο μηχανικός Νίκος: αρχιτέκτονας στην εταιρεία Α, επιβλέπων στην εταιρεία Β | ❌ **αδύνατο** |
| Σ-2 | Ο ίδιος Νίκος αγοράζει διαμέρισμα από την εταιρεία Γ — είναι *πελάτης* της | ❌ **αδύνατο** |
| Σ-3 | Ο ίδιος Νίκος έχει **δικό του** γραφείο: δικό του CRM, λογιστικά, πελάτες, ιστοσελίδα | ❌ **αδύνατο** |

---

## 1. Πλαίσιο — το αίτημα

Ο Γιώργος διατύπωσε (2026-08-02) το εξής:

> Η εφαρμογή έχει γίνει πολύ μεγάλη. Εμπλέκονται διαφορετικοί ρόλοι και είναι όλα τα
> στοιχεία συγκεντρωμένα — γίνεται κουραστική για κάποιον με λιγότερα δικαιώματα.
> Σκέφτομαι μια σελίδα **πριν το login** με μεγάλα εικονίδια, ένα ανά ρόλο. Ο αρχιτέκτονας
> πατάει «Αρχιτέκτονας», μπαίνει, και βλέπει μενού μόνο για τον αρχιτέκτονα. Στον DXF viewer
> έχουν μαζευτεί όλες οι ιδιότητες μαζί — και του αρχιτέκτονα και του τοπογράφου και του
> μηχανολόγου. Ο λογιστής δεν χρειάζεται να βλέπει τον DXF viewer. Ο μεσίτης ή ο απλός
> χρήστης του διαδικτύου δεν χρειάζεται να βλέπει όλα αυτά.

Ρόλοι που ανέφερε ρητά: **super admin, αρχιτέκτονας, πολιτικός μηχανικός, μηχανολόγος
μηχανικός, τοπογράφος, designer, απλός χρήστης διαδικτύου, μεσίτης, δικηγόρος,
συμβολαιογράφος, λογιστής, εργοταξιάρχης, εργάτης, προμηθευτής.** (14)

---

## 2. Τα ευρήματα — μετρημένα στον κώδικα, 2026-08-02

> ⚠️ Κάθε αριθμός παρακάτω μετρήθηκε με `grep`/`ls` τη μέρα που γράφτηκε το ADR.
> **Μην τον αντιγράψεις σε άλλο έγγραφο** — ξαναμέτρησέ τον (κανόνας N.12, «το 0 σημαίνει
> ότι κανείς δεν κοίταξε»).

### 2.1 Ο μηχανισμός φιλτραρίσματος υπάρχει — τα δεδομένα λείπουν

`src/config/smart-navigation-factory.ts` έχει ήδη `filterItemsByPermissions()` που
φιλτράρει αναδρομικά items + subItems με βάση `smartConfig.permissions`.

**Όμως**: από ~40 στοιχεία μενού (main + tools + settings), **μόνο 8 δηλώνουν permission**,
και **όλα το ίδιο** — `admin_access`:

`/admin/ai-inbox` · `/admin/operator-inbox` · `/admin/setup` · `/admin/role-management` ·
`/admin/audit-log` · `/admin/backup` · `/debug` · `/settings/company`

Όλα τα υπόλοιπα — Ευρετήριο, Επαφές, Έργα, Κτίρια, Χώροι, Πωλήσεις, CRM, Αναφορές,
Λογιστικό, DXF Viewer, Geo-Canvas, Αρχεία, Νομικά — **εμφανίζονται σε κάθε συνδεδεμένο
χρήστη**, ανεξαρτήτως ρόλου.

**Συνέπεια**: δεν χρειάζεται νέα αρχιτεκτονική φιλτραρίσματος. Χρειάζεται **συμπλήρωση
δεδομένων** σε config που ήδη τρέχει.

### 2.2 Νεκρό config: τα `featureFlag` δεν ελέγχονται πουθενά

Ο τύπος `SmartNavigationItem.smartConfig.featureFlag` δηλώνεται, και δύο items το
χρησιμοποιούν (`crm_enabled` στο `/crm`, `geo_canvas_enabled` στο `/geo/canvas`) — αλλά η
`filterItemsByPermissions()` **ελέγχει μόνο `permissions`**. Καμία συνάρτηση δεν διαβάζει
ποτέ το `featureFlag`. Είναι διακοσμητικό.

### 2.3 Το dashboard είναι εντελώς hardcoded

`src/components/dashboard/DashboardHome.tsx` (ADR-180): **12 πλακίδια** σε δύο ομάδες
(8 «Κύρια Πλοήγηση» + 4 «Εργαλεία»), γραμμένα ως κυριολεκτικοί πίνακες μέσα σε δύο
συναρτήσεις. **Μηδέν** αναφορά σε permissions. Ο `useAuth()` καλείται μόνο για το
`displayName` στον χαιρετισμό.

### 2.4 Ο DXF viewer είναι τυφλός στα δικαιώματα

```
grep -rl "useAuth|globalRole|hasPermission" src/subapps/dxf-viewer/  →  0 αρχεία
```

**Μηδέν** αναφορές auth/permission σε ολόκληρο το subapp.

### 2.5 …αλλά ο DXF viewer είναι ΗΔΗ οργανωμένος ανά ειδικότητα

Αυτό ανατρέπει την υπόθεση «έχουν μαζευτεί όλες οι ιδιότητες μαζί».

`src/subapps/dxf-viewer/ui/ribbon/data/ribbon-default-tabs.ts` →
`DEFAULT_RIBBON_TAB_ORDER` = **16 μόνιμα tabs**, ήδη χωρισμένα ανά μελέτη:

| Tab | Ειδικότητα |
|---|---|
| `home` | κοινό |
| `structural` | πολιτικός / στατικός (ADR-443/444) |
| `architecture` | αρχιτέκτονας (ADR-443/444) |
| `electrical`, `water`, `drainage`, `heating`, `hvac`, `fire-gas` | 6 ΗΛΜ μελέτες (ADR-444) |
| `topography` | τοπογράφος (ADR-662) |
| `insert`, `analyze`, `view`, `annotate`, `settings` | κοινά |

Επιπλέον ~57 **contextual** tabs (εμφανίζονται μόνο όταν επιλεγεί αντίστοιχη οντότητα) και
**~1.070 ids κουμπιών** συνολικά στα 96 αρχεία του `data/`.

**Συνέπεια**: η αναδιοργάνωση δεν χρειάζεται — έχει γίνει. Το ζητούμενο είναι **ένα φίλτρο
πάνω σε μια λίστα 16 αλφαριθμητικών**. Είναι το φθηνότερο μεγάλο κέρδος όλου του σχεδίου.

### 2.6 Η προστασία διαδρομών είναι σχεδόν ανύπαρκτη στο UI

- **140** αρχεία `src/app/**/page.tsx`
- **2** χρησιμοποιούν `ProtectedRoute` (`/contacts`, `/buildings`)

Η ασφάλεια στηρίζεται σωστά στο API middleware + Firestore rules (3.490 γραμμές). Το UI
όμως δεν εμποδίζει την πλοήγηση — απλώς η σελίδα δεν φέρνει δεδομένα.

### 2.7 🔴 Ο διακόπτης του **άξονα 1** υπάρχει ΗΔΗ — και είναι **νεκρός** *(μετρημένο 2026-08-02, για το Ε-6)*

Το ερώτημα του Ε-6 (*πώς εμφανίζεται η εναλλαγή*) υποθέτει ότι δεν υπάρχει τίποτα. **Υπάρχει
ολόκληρος μηχανισμός** — και μάλιστα **δύο**, που δεν γνωρίζονται μεταξύ τους.

**(α) `WorkspaceContext` (ADR-032) — πλήρης λογική, μηδέν κουμπί**

| Τι | Πού | Κατάσταση |
|---|---|---|
| Provider **προσαρτημένος** στο κέλυφος | `ConditionalAppShell.tsx:154` | ✅ ζωντανός |
| `switchWorkspace(id)` — εναλλαγή + persistence + `workspace-changed` event | `contexts/WorkspaceContext.tsx:195` | 🔴 **0 καλούντες σε ΟΛΟ το `src/`** |
| Επιμονή επιλογής | `localStorage` (`STORAGE_KEYS.ACTIVE_WORKSPACE`) | ✅ υπάρχει |
| Καταναλωτές του `activeWorkspace` | `useFileManagerState.ts:147` · `EntityFilesManager.tsx:142` · `FileManagerPageContent.tsx` | ⚠️ **μόνο για αρχεία** |

🔴 **Ο μόνος τρόπος που αλλάζει σήμερα ο ενεργός οργανισμός είναι το fallback
«διάλεξε τον πρώτο της λίστας»** (`WorkspaceContext.tsx:118-121`). Κανένα κουμπί δεν καλεί
ποτέ το `switchWorkspace`. Είναι **διακόπτης χωρίς κουμπί** *(⇒ Π-8)*.

**(β) `WorkspaceType` περιέχει ΗΔΗ το `personal`**

```ts
// src/types/workspace.ts:40
export type WorkspaceType = 'company' | 'office_directory' | 'personal';
```

Το `'personal'` είναι **κατά λέξη η απόφαση Ε-2′** *(προσωπικός οργανισμός από την εγγραφή)* —
γραμμένο στον κώδικα από το ADR-032, **πριν** καν τεθεί το ερώτημα. **Ο άξονας 1 του Ε-4.1
δεν χρειάζεται εφεύρεση: χρειάζεται προαγωγή** *(τέταρτο «το σωστό μοτίβο υπάρχει ήδη»,
δίπλα στα `PropertyGrant` / `resolveEffectiveCompanyId()` / `decideAssetPackAccess()`)*.

**(γ) Δεύτερος, ανταγωνιστικός μηχανισμός για τον ΙΔΙΟ άξονα**

`components/header/CompanySwitcher.tsx` (ADR-340), προσαρτημένος στο `app-header.tsx:99`:
έχει **UI** αλλά `if (!isSuperAdmin) return null` και οδηγεί **άλλο** context
(`SuperAdminCompanyContext`). Δηλαδή στον άξονα 1 υπάρχουν **δύο** υλοποιήσεις:
**η μία με κουμπί χωρίς γενικότητα, η άλλη με γενικότητα χωρίς κουμπί** — και **καμία**
δεν συνδέεται με το `claims.companyId` (§11.1) *(⇒ Π-10)*.

**(δ) Ο άξονας 2 (έργο) δεν έχει καθόλου καθολικό επιλογέα**

Το `ProjectHierarchyContext` ζει **μόνο** μέσα στο `subapps/dxf-viewer/`. Στο κυρίως κέλυφος
το έργο επιλέγεται **με πλοήγηση σε σελίδα** (`/projects?projectId=…`), όχι με διακόπτη.

**(ε) 🔴 ΣΥΓΚΡΟΥΣΗ ΟΝΟΜΑΤΟΛΟΓΙΑΣ — πρέπει να λυθεί ΠΡΙΝ γραφτεί γραμμή κώδικα**

Ο όρος **`Workspace` / «χώρος εργασίας» είναι ΗΔΗ ΠΙΑΣΜΕΝΟΣ** και σημαίνει **οργανισμό**
(άξονας 1). Ο τίτλος αυτού του ADR χρησιμοποιεί τον ίδιο όρο για τη **δουλειά** (άξονας 3).
Αν ονομάσουμε τη δουλειά `Workspace`, φτιάχνουμε **πέμπτο λεξιλόγιο** — ακριβώς η παθολογία
του §3, σε νέα διάσταση. Το Ε-4 ήδη τις λέει σωστά **«δουλειές»**· ο κώδικας πρέπει να
ακολουθήσει *(⇒ Π-9)*.

### 2.8 🔴 Η «πρώτη μέρα» σήμερα είναι **κατά γράμμα το ελάττωμα του ACC** *(μετρημένο 2026-08-02, για το Ε-7)*

`src/app/api/auth/complete-registration/route.ts` (**ADR-660 — self-registration hardening**):

> *«ΔΕΝ χορηγεί πλέον αυτόματα tenant + ρόλο `external_user`. Αντ' αυτού δημιουργεί εγγραφή
> σε κατάσταση **pending** (χωρίς claims / companyId / member doc) και ειδοποιεί τους
> διαχειριστές. Η πρόσβαση δίνεται ΜΟΝΟ μετά από ρητή έγκριση admin.»*

Αν εφαρμοστεί ο ζωντανός υπολογισμός του Ε-5 πάνω σε αυτόν τον χρήστη:

| Πηγή δικαιώματος | Τι δίνει | Δουλειές |
|---|---|---|
| `GlobalRole` (custom claims) | **δεν υπάρχει** — pending | **0** |
| `companyId` | **δεν υπάρχει** | **0** |
| `ProjectRole` (member doc) | **δεν υπάρχει** | **0** |
| **ΕΝΩΣΗ** | | 🔴 **ΜΗΔΕΝ** |

🔴 **Ο νέος χρήστης βλέπει κενό και περιμένει άνθρωπο.** Είναι **ακριβώς** το σενάριο για το
οποίο η Autodesk συντηρεί ολόκληρο γένος άρθρων υποστήριξης *(«member status stuck on Not
Invited»)* — §6.11.1. Δεν το κληρονομήσαμε: το **γράψαμε μόνοι μας**, για σωστό λόγο
(ασφάλεια), χωρίς να δούμε τη συνέπεια στην εμπειρία.

⚠️ **Και υπάρχει ρητή ένταση με το Ε-2′**, που λέει *«προσωπικός οργανισμός από την
εγγραφή»*. Το ADR-660 λέει *«τίποτα μέχρι έγκριση»*. **Δεν συμβιβάζονται σιωπηλά** — το Ε-7
πρέπει να το λύσει ονομαστικά *(⇒ Π-11)*.

Δευτερεύον: ακόμη κι όταν εγκριθεί, ο `external_user` έχει **2 permissions**
(`projects:view`, `properties:view`) ⇒ **πάλι μηδέν δουλειές**, γιατί καμία από τις έξι δεν
γεννιέται από permission που έχουν σχεδόν όλοι (Ε-4.2). **Η έγκριση δεν λύνει μόνη της το
κενό.**

---

## 3. Το πραγματικό εμπόδιο — **τέσσερα** λεξιλόγια ρόλων

| # | Πού ζει | Τιμές | Απαντά στο ερώτημα |
|---|---|---|---|
| 1 | `GlobalRole` — Firebase custom claims (`src/lib/auth/types.ts`) | 4: `super_admin`, `company_admin`, `internal_user`, `external_user` | Τι δικαιούμαι σε όλη την εταιρεία |
| 2 | `ProjectRole` — `/projects/{pid}/members/{uid}` | 9: `project_manager`, `architect`, `engineer`, `site_manager`, `accountant`, `sales_agent`, `data_entry`, `viewer`, `vendor` | Τι δικαιούμαι **σε αυτό το έργο** |
| 3 | `UserRole` — `src/auth/components/ProtectedRoute.tsx` | 3: `admin`, `authenticated`, `public` | **Legacy** — τρίτο, περιττό λεξιλόγιο |
| 4 | `entity-associations` (ADR-283) | 7: `architect`, `structural_engineer`, `electrical_engineer`, `mechanical_engineer`, `surveyor`, `energy_inspector`, `supervising_engineer` | **Ποιος είναι ο αρχιτέκτονας του έργου** — επαγγελματική ιδιότητα, **όχι δικαίωμα** |

### 3.1 Δύο συνέπειες που καθορίζουν τον σχεδιασμό

**(α) Ο «αρχιτέκτονας» είναι σήμερα ρόλος *ανά έργο*, όχι ιδιότητα του ανθρώπου.**
Ο ίδιος άνθρωπος μπορεί να είναι `architect` στο έργο Α και `viewer` στο έργο Β. Άρα
«μπαίνω ως αρχιτέκτονας» **δεν υπάρχει** στο μοντέλο δεδομένων πριν επιλεγεί έργο.

**(γ) Τα λεξιλόγια ανακατεύουν ΤΡΙΑ διαφορετικά πράγματα** *(εύρημα Ε-4, μετρημένο στα
permission sets)*. Αυτό εξηγεί γιατί κανένα από τα τέσσερα δεν είναι χρησιμοποιήσιμο ως
βάση για χώρους εργασίας:

| Τι είναι στην πραγματικότητα | Ρόλοι |
|---|---|
| **Δουλειά** *(τι κάνω)* | `architect`, `engineer`, `site_manager`, `accountant`, `sales_agent`, `vendor` |
| **Στάθμη** *(πόσο βαθιά)* | `viewer`, `data_entry`, `internal_user`, `external_user` |
| **Εύρος** *(πόσα μαζί)* | `project_manager`, `company_admin`, `super_admin` |

Μόνο η πρώτη στήλη γεννά χώρους εργασίας. Η δεύτερη είναι το **Ε1.δ** (*ανενεργό με
εξήγηση*)· η τρίτη είναι **πόσες δουλειές** βλέπει ταυτόχρονα ο ίδιος άνθρωπος.

**(β) Από τους 14 ρόλους του αιτήματος, λείπουν 6** από το `PREDEFINED_ROLES`:
μηχανολόγος, τοπογράφος, δικηγόρος, συμβολαιογράφος, εργάτης, designer.
Και το **ADR-283 έχει ήδη αποφασίσει** ότι δικηγόρος/συμβολαιογράφος ανήκουν στο επίπεδο
**πώλησης**, ο λογιστής στο επίπεδο **εταιρείας** — όχι στο έργο. Ο γενικός `engineer`
είχε ήδη κριθεί ανεπαρκής για την ελληνική πραγματικότητα.

---

## 4. Το επικίνδυνο σημείο του αρχικού αιτήματος

Το αίτημα τοποθετεί την οθόνη επιλογής **πριν** το login. Αυτό δεν μπορεί να γίνει όπως
διατυπώθηκε:

- Αν το κουμπί «Αρχιτέκτονας» **δίνει** πρόσβαση πριν την ταυτοποίηση, τότε **ο ρόλος
  επιλέγεται από τον επισκέπτη** — τρύπα που ακυρώνει και τους 3.490 στίχους των rules.
- Αν **δεν δίνει** τίποτα, τότε είναι 13 κουμπιά που όλα καταλήγουν στην ίδια φόρμα
  σύνδεσης: ένα κλικ παραπάνω, μηδέν όφελος.

> **Ο ρόλος δεν δηλώνεται — διαπιστώνεται.** Έρχεται από το claim του χρήστη.

Η σωστή μορφή είναι **δύο διαφορετικές σελίδες**:

| Σελίδα | Πότε | Τι είναι |
|---|---|---|
| **Public landing** | Ανώνυμος επισκέπτης | Κάρτες «τι προσφέρει η πλατφόρμα σε κάθε ειδικότητα». **Παρουσίαση**, όχι πύλη. Όλες καταλήγουν στο ίδιο login |
| **Επιλογέας χώρου εργασίας** | Μετά το login | Δείχνει **μόνο** τους χώρους που επιτρέπει ο ρόλος. Ένας διαθέσιμος → μπαίνει κατευθείαν χωρίς κλικ. Πολλοί → διαλέγει |

Πρότυπο: Autodesk Construction Cloud, Google Cloud Console.

---

## 5. Η θεμελιώδης αρχή: **χώρος εργασίας ≠ ρόλος**

Η πρόταση **δεν** προσθέτει 6 νέους ρόλους στο `PREDEFINED_ROLES`. Κάθε νέος ρόλος σέρνει
permission list + Firestore rules + tests + migration, και μπερδεύει δύο διαφορετικά
ερωτήματα. Αντ' αυτού εισάγεται **νέος, ανεξάρτητος άξονας**:

```
Permission  =  τι ΕΠΙΤΡΕΠΕΤΑΙ   → server· υπάρχει ήδη· ΔΕΝ το αγγίζουμε
Workspace   =  τι ΔΕΙΧΝΕΤΑΙ     → client· καθαρό φίλτρο· νέο
```

Ένας χώρος εργασίας ορίζει **τρία** πράγματα: ποια στοιχεία μενού, ποια πλακίδια
dashboard, ποια ribbon tabs. Και διέπεται από τον κανόνα που κάνει το σχέδιο ασφαλές
εξ ορισμού:

> ### 🔒 Ο ΧΩΡΟΣ ΕΡΓΑΣΙΑΣ ΠΟΤΕ ΔΕΝ ΠΡΟΣΘΕΤΕΙ ΔΙΚΑΙΩΜΑ — ΜΟΝΟ ΑΦΑΙΡΕΙ ΘΟΡΥΒΟ.

Ο χρήστης βλέπει μόνο χώρους που τα permissions του **ήδη** επιτρέπουν· κι αν με
οποιονδήποτε τρόπο φτάσει σε άλλον, ο server τον κόβει όπως και σήμερα. **Καμία νέα
επιφάνεια επίθεσης.**

### 5.1 Το μετρημένο κέρδος στον DXF viewer

> ⚠️ **ΑΝΑΘΕΩΡΗΘΗΚΕ μετά το Ε-4.** Η πρώτη εκδοχή αυτού του πίνακα ονόμαζε τις γραμμές με
> **επαγγέλματα** («Αρχιτέκτονας», «Τοπογράφος»…). Αυτό παραβίαζε την **Α-5** που είχε ήδη
> κλειδώσει: *ο χώρος είναι τρόπος εργασίας, όχι ταυτότητα*. Κανένας από τους έξι μεγάλους
> δεν ονομάζει χώρο με όνομα επαγγέλματος (§6). Οι γραμμές είναι πλέον **θέσεις του
> διακόπτη ειδικότητας** μέσα στη **μία** δουλειά «Σχέδιο» (Ε-4).

Ο DXF viewer ανήκει σε **μία** δουλειά — το **«Σχέδιο»**. Μέσα της, ένας **διακόπτης
ειδικότητας** (πρότυπο: *View Discipline* του Revit, §6.4) ορίζει ποια ribbon tabs είναι
ενεργά:

| Θέση διακόπτη | Ribbon tabs | Από 16 → |
|---|---|---|
| Αρχιτεκτονικά | home, architecture, insert, analyze, view, annotate, settings | **7** |
| Στατικά | home, structural, insert, analyze, view, annotate, settings | **7** |
| ΗΛΜ | home, +6 ΗΛΜ, insert, analyze, view, annotate, settings | **12** |
| Τοπογραφικά | home, topography, insert, analyze, view, annotate, settings | **7** |
| Παρουσίαση | home, architecture, insert, view, annotate | **5** |
| Όλα *(προεπιλογή σήμερα)* | όλα, ακριβώς όπως σήμερα | **16** |

Στις **άλλες πέντε** δουλειές (Εργοτάξιο, Πελάτες, Οικονομικά, Προμήθειες, Διαχείριση) ο
DXF viewer **δεν εμφανίζεται καθόλου** — εκτός αν ο χρήστης αλλάξει δουλειά, πράγμα που
κάνει ελεύθερα (Α-1, Α-4).

*(Η κατανομή των tabs στις θέσεις οριστικοποιείται στη Φάση 1.)*

---

## 6. Έρευνα αγοράς — τι κάνουν πραγματικά οι μεγάλοι παίκτες

Εντολή Γιώργου (2026-08-02): *«Θέλω να το κάνεις όπως το κάνουν οι μεγάλοι παίκτες — Revit,
ArchiCAD, Maxon Cinema 4D, Figma-level. Αν οι μεγάλοι δεν το προτείνουν, θα ακολουθήσουμε
την πρακτική τους. Και αν μπορείς, βρες λύσεις ακόμη πιο έξυπνες από αυτές που
χρησιμοποιούν.»*

Έγινε έρευνα σε 6 προϊόντα + 1 ιστορική αποτυχία. Πηγές στο §6.8.

### 6.1 AutoCAD — «Workspaces»

Ονομασμένες διατάξεις διεπαφής: **2D Drafting & Annotation**, **3D Modeling**, **Classic**.
Κάθε workspace δένει μαζί ribbon tabs + toolbars + palettes + status bar + display options.

🔑 **Η εναλλαγή γίνεται από τον ΧΡΗΣΤΗ**, από ένα σταθερό γρανάζι κάτω δεξιά στη status bar.
Κανένα workspace δεν είναι κλειδωμένο σε ρόλο ή σε άδεια χρήσης.

### 6.2 ArchiCAD — «Work Environment Profiles»

Προκαθορισμένα προφίλ (**Standard** = τυπική αρχιτεκτονική ροή· **Layouting** = εντολές
σχεδίασης τευχών, με το Toolbox συρρικνωμένο μόνο στα Documenting tools).

Οι ρυθμίσεις χωρίζονται σε **έξι Schemes**: User Preferences, **Company Standards**,
Shortcut, Tool, Workspace, Command Layout. Τα προφίλ **εξάγονται και εισάγονται** — ο
διαχειριστής του γραφείου φτιάχνει εταιρικά προφίλ και τα διανέμει.

Σε custom προφίλ, τα Ductwork / Piping / Cabling / Structural Tools προστίθενται κάτω από
τα αντίστοιχα Tool Groups — δηλαδή **διάκριση ανά ειδικότητα, αλλά συνθετική, όχι
απαγορευτική**.

### 6.3 Cinema 4D — «Layouts»

Modeling / Animation / UV Edit / Sculpting. `Window > Customization > Save Layout As…` για
δικά σου· `Save as Default Layout` για το layout εκκίνησης· `Shift+C` (Commander) για
εναλλαγή χωρίς μενού.

🔑 Η επίσημη σύσταση της Maxon: *«φτιάξε ξεχωριστά layouts — η εναλλαγή είναι ταχύτερη από
τη διαρκή αναδιάταξη».* Δηλαδή **πολλαπλοί χώροι ανά άτομο**, όχι ένας.

### 6.4 Revit — «View Discipline» — **το πιο διδακτικό εύρημα**

Η πειθαρχία στο Revit είναι ιδιότητα **της όψης (view)**, όχι του χρήστη. Τιμές:
Architectural, Structural, Mechanical, Electrical, Plumbing, Coordination.

Και το κρίσιμο — **τι κάνει όταν η όψη είναι «Mechanical»**:

> *«Displays architectural and structural elements in **half-tone**, and displays mechanical
> elements on top for easier selection.»*

🔑 **ΔΕΝ εξαφανίζει το ξένο περιεχόμενο — το ΥΠΟΒΑΘΜΙΖΕΙ.** Ο μηχανολόγος εξακολουθεί να
βλέπει τους τοίχους, ξεθωριασμένους, ώστε να ξέρει πού βρίσκεται. Χάνει την προσοχή, όχι
το πλαίσιο.

*(Η γνωστή αδυναμία: όταν κάτι δεν φαίνεται, ο χρήστης δεν ξέρει γιατί — το «Don't forget
about the Discipline of the View» είναι από τα πιο επαναλαμβανόμενα άρθρα της κοινότητας.
Βλ. §7.2.)*

### 6.5 Figma — «Dev Mode»

Ένας **διακόπτης** που αναδιατάσσει ολόκληρο το UI σε τρεις περιοχές (layers αριστερά,
**μη-επεξεργάσιμος** καμβάς στο κέντρο, inspect panel δεξιά με Code / List views).

🔑 Είναι **τρόπος εργασίας, όχι ρόλος**: ο ίδιος άνθρωπος με Full seat τον ανοίγει και τον
κλείνει ελεύθερα. Οι ρόλοι (seats) καθορίζουν **τι επιτρέπεται να αλλάξει**, όχι ποιο UI
βλέπει.

### 6.6 Autodesk Construction Cloud / BIM 360 — role-based default access

Ο διαχειριστής λογαριασμού ορίζει ρόλους και **default module access** ανά ρόλο. Ανάθεση
του ρόλου «Architect» δίνει αυτόματα Document Management + Project Management + Model
Coordination + Field Management.

🔑 Αλλά η τεκμηρίωση είναι ρητή: *«Permissions granted by project administrators **succeed**
those specified by role.»* — **ο ρόλος είναι αφετηρία, όχι φυλακή.** Και οι ρόλοι είναι
**παραμετροποιήσιμοι ανά εταιρεία** (αρχιτεκτονικό γραφείο vs κατασκευαστική → άλλο
default για τον ίδιο ρόλο «Architect»).

### 6.7 Η αντι-περίπτωση: Microsoft Office 2000 «Adaptive / Personalized Menus»

Τα μενού έκρυβαν **αυτόματα** εντολές με βάση τη συχνότητα χρήσης. Απέτυχε παταγωδώς και
καταργήθηκε στο Word 2007 (αντικαταστάθηκε από το Ribbon). Οι δύο λόγοι:

1. **Κατέστρεψε την προβλεψιμότητα** — ο χρήστης δεν μπορούσε να χτίσει μυϊκή μνήμη· η ίδια
   εντολή άλλαζε θέση.
2. **Σκότωσε την ανακάλυψη** — δεν μάθαινες ποτέ ό,τι δεν χρησιμοποιούσες ήδη.

🔑 **Το μάθημα: απόκρυψη ΝΑΙ — αυτόματη/σιωπηλή απόκρυψη ΟΧΙ.** Ο χρήστης πρέπει να ξέρει
ανά πάσα στιγμή ότι κάτι είναι κρυμμένο και πώς να το φέρει πίσω.

### 6.8 Πηγές

- AutoCAD Workspaces — [help.autodesk.com](https://help.autodesk.com/view/ACD/2025/ENU/?guid=GUID-1D87D5C3-21BC-499E-A560-79592348D47E) · [About Workspaces](https://help.autodesk.com/cloudhelp/2020/ENU/Plant3D-UserGuide/files/GUID-4958C4C5-CCDD-4DE4-B394-69423BB29124.htm)
- ArchiCAD Work Environment — [Graphisoft Help Center](https://helpcenter.graphisoft.com/user-guide-chapter/85467/) · [WE Profiles](https://help.graphisoft.com/AC/22/INT/_AC22_Help/130_UserInterfaceDialogBoxes/130_UserInterfaceDialogBoxes-5.htm) · [Default WE Profiles](https://help.graphisoft.com/AC/25/INT/_AC25_Help/020_Configuration/020_Configuration-16.htm)
- Cinema 4D Layouts — [Maxon GUI docs](https://help.maxon.net/c4d/s24/en-us/Content/html/5220.html) · [Task-based layouts](https://novedge.com/blogs/design-news/cinema-4d-tip-cinema-4d-custom-layouts-for-task-based-workflows)
- Revit View Discipline — [About the View Discipline](https://knowledge.autodesk.com/support/revit/learn-explore/caas/CloudHelp/cloudhelp/2021/ENU/Revit-DocumentPresent/files/GUID-5D8831F6-6F15-4BF3-ACEB-06FBC14A5491-htm.html) · [Autodesk support](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/View-by-discipline-in-Revit.html) · [What Revit Wants](https://wrw.is/don-forget-about-discipline-of-view-in/)
- Figma Dev Mode — [Guide to Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode) · [How we built Dev Mode](https://www.figma.com/blog/how-we-built-dev-mode/)
- ACC / BIM 360 roles — [Role-based Default Permissions](https://help.autodesk.com/view/BIM360D/ENU/?guid=GUID-7E2C374B-DADC-4E13-AEA7-C8DCF6838A31) · [Custom Roles on ACC](https://forums.autodesk.com/t5/community-blog-aec-english/custom-roles-on-the-autodesk-construction-cloud-platform/ba-p/10987457)
- Adaptive Menus — [Progressive Disclosure Controls (Microsoft)](https://learn.microsoft.com/en-us/windows/win32/uxguide/ctrl-progressive-disclosure-controls) · [Progressive Disclosure (IxDF)](https://ixdf.org/literature/book/the-glossary-of-human-computer-interaction/progressive-disclosure)

### 6.9 ΔΕΥΤΕΡΗ ΕΡΕΥΝΑ *(2026-08-02, για το Ε-5)* — **άλλο ερώτημα**

> Η έρευνα §6.1–§6.7 ρωτούσε **«πώς οργανώνουν το UI»**. Η Ε-5 ρωτά κάτι διαφορετικό:
> **«πώς αποφασίζουν ποιος βλέπει τι, όταν τα δικαιώματα ζουν σε πολλά επίπεδα ταυτόχρονα»**
> (οργανισμός + έργο, Ε1.ζ). Εντολή Γιώργου: *«όπως οι μεγάλοι — και αν μπορείς, βρες κάτι
> πιο έξυπνο.»*

#### 6.9.1 ACC — υβρίδιο, με **σοβαρό δομικό ελάττωμα**

Ο διαχειριστής **λογαριασμού** ορίζει default access ανά ρόλο· ο διαχειριστής **έργου** το
παρακάμπτει. Δηλαδή **(Γ)**, όχι (Α). Αλλά:

> *«Changing the Default access level for a role **will not affect access to existing
> projects**. The access level will take effect when the role is added to **new** projects.»*

🔴 **Το default ΑΝΤΙΓΡΑΦΕΤΑΙ τη στιγμή της ένταξης στο έργο** — είναι **στιγμιότυπο, όχι
ζωντανός υπολογισμός**. Αλλάζεις τι σημαίνει «Αρχιτέκτονας» ⇒ τα υπάρχοντα έργα μένουν με
τα παλιά δικαιώματα. **Σιωπηλή απόκλιση εξ ορισμού**, που μεγαλώνει κάθε μέρα. *(⇒ Υ-5)*

#### 6.9.2 Figma — **το κάνει σωστά**: ζωντανή κληρονομιά, όχι αντιγραφή

> *«A file will inherit the permissions set on the project level, and a project will inherit
> permissions set on the team level. You can **override** someone's inherited permissions.»*

Κληρονομιά **ζωντανή** προς τα κάτω + **ρητή εξαίρεση** όπου χρειάζεται. Αλλαγή στο πάνω
επίπεδο διαχέεται αμέσως παντού, **εκτός** από τις ρητές εξαιρέσεις.

🔑 Και δεύτερο: **«Seats are separate from permissions»** — το seat λέει *ποια εργαλεία*
έχεις, το permission *τι κάνεις μ' αυτά*. **Δύο ανεξάρτητοι άξονες** — ακριβώς το
`decideAssetPackAccess()` που **ήδη υπάρχει** (ADR-655, §Ε-3.α).

#### 6.9.3 Το state of the art που **κανένα CAD δεν έχει**: ReBAC / Google Zanzibar

Zanzibar (USENIX ATC 2019) — τρέχει πίσω από Drive, Docs, YouTube:

> *«ReBAC shifts the focus from **what a user IS** to **how a user RELATES to a resource**,
> solving the problem of **role explosion**.»*

🔑 **Το «role explosion» είναι με ακρίβεια η παθολογία του §3**: τέσσερα λεξιλόγια, 14
επαγγέλματα, και διαφορετικός ρόλος σε **κάθε έργο κάθε εταιρείας**. Το σωστό ερώτημα δεν
είναι *«τι είναι ο Νίκος»* αλλά *«πώς σχετίζεται με αυτό εδώ το έργο»*.

Υλοποιήσεις, **όλες Apache 2.0** (συμβατές με N.5): **SpiceDB** *(5ms p95 σε δισεκατομμύρια
σχέσεις)* · **OpenFGA** · **Permify**.

#### 6.9.4 Derived roles (Cerbos) — η πρακτική μορφή της ίδιας ιδέας

> Ρόλος `manager` + συμφραζόμενα ⇒ `manager_of_scranton_branch` **στον χρόνο εκτέλεσης**.
> *«Policies are code that live in your repo, are version controlled and testable.»*

Είναι η αρχική πρόταση (Α) **με όνομα, βιβλιογραφία και υλοποιήσεις** — και το «policy as
code στο repo» είναι κυριολεκτικά το **SSoT** που απαιτεί ο κανόνας N.12.

#### 6.9.5 Ο κανόνας για το UI — **ομόφωνος**

> *«Hiding a button with frontend techniques will not prevent anybody from discovering API
> endpoints. This mechanism is **a UX improvement**, not a security measure.»*

Επιβεβαιώνει απόλυτα τον χρυσό κανόνα του §5: **ο χώρος εργασίας ΠΟΤΕ δεν προσθέτει
δικαίωμα — μόνο αφαιρεί θόρυβο.**

#### 6.9.6 Πηγές δεύτερης έρευνας

- ACC — [Roles (Autodesk Help)](https://help.autodesk.com/cloudhelp/ENU/Docs-Admin/files/account-administration/Account_Admin_Roles.html) · [Role Management in ACC Admin Console](https://resources.imaginit.com/building-solutions-blog/role-management-in-autodesk-construction-clouds-admin-console)
- Figma — [File and project permissions](https://help.figma.com/hc/en-us/articles/35361119554711-File-and-project-permissions) · [Guide to sharing and permissions](https://help.figma.com/hc/en-us/articles/1500007609322-Guide-to-sharing-and-permissions)
- ReBAC — [Google Zanzibar authorization model](https://inferadb.com/dispatch/google-zanzibar-authorization/) · [SpiceDB (GitHub)](https://github.com/authzed/spicedb) · [OpenFGA vs Permify vs SpiceDB (2026)](https://www.pkgpulse.com/guides/openfga-vs-permify-vs-spicedb-zanzibar-authorization-2026)
- Cerbos — [Derived roles](https://docs.cerbos.dev/cerbos/latest/policies/derived_roles.html) · [Context-aware authorization](https://www.cerbos.dev/blog/making-application-authorization-context-aware-cerbos-outputs)
- UI — [Conditionally rendering React UI based on permissions](https://dev.to/worldlinetech/how-to-conditionally-render-react-ui-based-on-user-permissions-2amg)

---

### 6.10 ΤΡΙΤΗ ΕΡΕΥΝΑ *(2026-08-02, για το Ε-6)* — **πώς εμφανίζεται η εναλλαγή**

> Τρίτο διαφορετικό ερώτημα: όχι «πώς οργανώνουν το UI» (§6.1–6.7), ούτε «πώς αποφασίζουν
> ποιος βλέπει τι» (§6.9), αλλά **«πώς μετακινείσαι ανάμεσα σε συντεταγμένες»**.

| Ποιος | Πώς | Δίδαγμα |
|---|---|---|
| **Vercel · Supabase · GitHub** | **Ένα μονοπάτι** πάνω-αριστερά· **κάθε τμήμα** του ανοίγει λίστα με αναζήτηση. Οργανισμός και έργο **μαζί** | Ό,τι είναι **ιεραρχικό** μπαίνει σε **ένα** στοιχείο — το ένα περιέχει το άλλο |
| **Google Cloud** | Ένας επιλογέας έργου με **αναζήτηση + πρόσφατα** | Σε δεκάδες έργα, η **αναζήτηση** είναι ο μηχανισμός· η λίστα είναι διακόσμηση |
| 🔴 **AWS** | **Δύο ανεξάρτητα κουτιά** (λογαριασμός · περιοχή) δίπλα-δίπλα | Το κλασικό «δούλεψα σε **λάθος λογαριασμό**». Δύο ανεξάρτητοι επιλογείς **δεν δείχνουν ποτέ τη σχέση τους**. Η AWS πρόσθεσε **χρώμα ανά λογαριασμό το 2026** — παραδοχή του λάθους *(⇒ Υ-9)* |
| **Figma** | Το **Dev Mode** είναι **διακόπτης**, **έξω** από το μονοπάτι του αρχείου | Ο **τρόπος** δεν μπαίνει ποτέ στην πλοήγηση — δεν είναι τόπος |
| **AutoCAD · Cinema 4D** | Χώρος εργασίας = **γρανάζι στη γραμμή κατάστασης** / λίστα πάνω-δεξιά | Ίδιο δίδαγμα, από τον κόσμο του CAD: ο τρόπος εργασίας **δεν ζει στην πλοήγηση** |
| **VS Code · Linear** | **Παλέτα εντολών** — γράφεις πού θες να πας | Ο δρόμος του έμπειρου χρήστη. **Κανένα CAD δεν τον έχει** *(⇒ Υ-8)* |

🔑 **Ο κανόνας που προκύπτει**: *ό,τι είναι **ιεραρχικό** ⇒ **ένα** μονοπάτι· ό,τι είναι
**κάθετο** σε αυτό ⇒ **δικό του** χειριστήριο, οπτικά διαφορετικό.* Η αποτυχία της AWS δεν
είναι ότι έχει δύο κουτιά — είναι ότι τα δύο κουτιά **δεν είναι ιεραρχικά** και παρ' όλα
αυτά εμφανίζονται σαν να είναι.

#### 6.10.1 Πηγές τρίτης έρευνας

- [Supabase Design System — Breadcrumb](https://supabase.com/design-system/docs/components/breadcrumb) · [Supabase — Navigation patterns](https://supabase-design-system.vercel.app/design-system/docs/ui-patterns/navigation)
- [Vercel — New dashboard navigation (scope switchers)](https://vercel.com/changelog/new-dashboard-navigation-available)
- [AWS — Customize console: account color, region & service visibility](https://aws.amazon.com/blogs/aws/customize-your-aws-management-console-experience-with-visual-settings-including-account-color-region-and-service-visibility) · [AWS — Choosing your Region](https://docs.aws.amazon.com/awsconsolehelpdocs/latest/gsg/select-region.html)
- [Google Cloud — Project selector](https://console.cloud.google.com/projectselector2/home/dashboard)
- [SaaS navigation UX patterns — top bar = global context, workspace switcher](https://www.saasui.design/blog/saas-navigation-ux-patterns)
- [VS Code — Command Palette & quick workspace switching](https://code.visualstudio.com/docs/getstarted/tips-and-tricks) · [VS Code issue #262349 — Quick Workspace Switcher](https://github.com/microsoft/vscode/issues/262349)

---

### 6.11 ΤΕΤΑΡΤΗ ΕΡΕΥΝΑ *(2026-08-02, για το Ε-7)* — **η πρώτη μέρα**

> Τέταρτο ερώτημα: **τι βλέπει κάποιος που δεν έχει ακόμη τίποτα.**

#### 6.11.1 🔴 ACC — **το αντι-παράδειγμα, τεκμηριωμένο από την ίδια την Autodesk**

Μέλος προστίθεται στον λογαριασμό αλλά **σε κανένα έργο** ⇒ κατάσταση **«Not Invited»** και
**κενή** οθόνη. Η Autodesk συντηρεί **σειρά άρθρων υποστήριξης** για ανθρώπους που δεν
καταλαβαίνουν γιατί δεν βλέπουν τίποτα *(«Project or account is not available»· «status stuck
on Not Invited»· «Hub and associated projects are missing»)*.

🔑 **Όταν το ίδιο το προϊόν χρειάζεται άρθρα υποστήριξης για να εξηγήσει μια κενή οθόνη, η
κενή οθόνη είναι το σφάλμα** — όχι ο χρήστης.

#### 6.11.2 Revit — **ποτέ δεν μπλοκάρει· πάντα υπάρχει προεπιλογή**

> *«You can install Revit to provide tools and analyses for a particular discipline, and
> **if you do not select a discipline, an appropriate default is used**.»*

Και η επιλογή ειδικότητας γίνεται μέσω **προτύπων, τη στιγμή που φτιάχνεις έργο** — όχι ως
πύλη πριν μπεις. Το πιο ώριμο εργαλείο του κλάδου **δεν ρωτά ποτέ κλειδώνοντας**.

#### 6.11.3 Notion · Linear · Figma — **ο νέος είναι παραγωγικός ΜΟΝΟΣ, πριν εμπλακεί ομάδα**

> *«The best B2B flows (Notion, Linear, Figma) start individuals in a **template workspace**
> and **defer team setup**, letting the user experience the product before turning it into a
> team setup chore.»*

🔑 Είναι **κατά λέξη το Ε-2′ + Ε-3**: προσωπικός χώρος από την αρχή, με πλήρη δύναμη μέσα
του. Η απόφαση που πήραμε για το **όραμα** αποδεικνύεται και **η σωστή απάντηση στην πρώτη
μέρα** — δύο ανεξάρτητοι δρόμοι στο ίδιο σημείο.

#### 6.11.4 Η έρευνα onboarding — **μία ερώτηση, προαιρετική, με προεπιλογή**

| Εύρημα | Τιμή |
|---|---|
| Εξατομίκευση βάσει ρόλου | **+30–50% ενεργοποίηση**, **+35%** διατήρηση 7 ημερών |
| Αριθμός ερωτήσεων | **2–3 το πολύ** — κάθε επιπλέον ⇒ **−10–15%** ολοκλήρωση |
| Το μοτίβο των κορυφαίων | **ΜΙΑ** ερώτηση δρομολόγησης που **αλλάζει τα πάντα** κάτω από αυτήν |
| ⚠️ Η παγίδα | *«Users abandon at those questions **without realizing what the product will show them** once they answer»* ⇒ **πάντα προσπελάσιμη με παράλειψη, πάντα με λογική προεπιλογή** |

#### 6.11.5 Το κενό δοχείο — **δεν είναι ουδέτερο** *(Nielsen Norman Group)*

> *«A blank container is not neutral. It **reduces confidence, damages discoverability, and
> slows task completion**.»* — και είναι **«a teachable moment»**.

Η κενή οθόνη πρώτης χρήσης οφείλει να κάνει **τρία** πράγματα: **προσανατολίζει**
*(«είσαι στο σωστό μέρος»)*, **εξηγεί την αξία** *(«αυτό κάνει εδώ»)*, **προτείνει μία
κίνηση** *(«φτιάξε το πρώτο σου έργο»)*.

#### 6.11.6 Πηγές τέταρτης έρευνας

- ACC — [Project or account is not available](https://www.autodesk.com/support/technical/article/caas/sfdcarticles/sfdcarticles/Project-or-account-is-not-available-error-message-when-trying-to-access-an-ACC-project.html) · [Member status stuck on «Not Invited»](https://resources.imaginit.com/support-blog/acc-new-member-status-stuck-on-not-invited) · [Manage Project Members](https://help.autodesk.com/cloudhelp/ENU/Docs-Admin/files/project-administration/Manage_Project_Members.html)
- Revit — [How do I select a discipline?](https://s3-us-west-1.amazonaws.com/help-dev.autodesk.com/v/Revit/enu/2013/Help/00005-More_Inf0/0138-Installa138/0140-Revit_In140/0157-Revit_In157/0158-How_do_I158) · [Revit project templates](https://www.autodesk.com/learn/ondemand/tutorial/revit-project-templates)
- Onboarding — [SaaS onboarding flows that convert (2026)](https://www.saasui.design/blog/saas-onboarding-flows-that-actually-convert-2026) · [Notion's lightweight onboarding](https://goodux.appcues.com/blog/notions-lightweight-onboarding) · [User onboarding best practices](https://www.appcues.com/blog/user-onboarding-best-practices)
- Empty states — [Empty state UI design](https://www.setproduct.com/blog/empty-state-ui-design) · [Empty State UX examples & best practices](https://www.pencilandpaper.io/articles/empty-states) · [Onboarding UX patterns — empty states](https://www.useronboard.com/onboarding-ux-patterns/empty-states/)

---

## 7. Οι πέντε αρχές που προκύπτουν από την έρευνα

> **Το καθοριστικό εύρημα: κανένας από τους έξι μεγάλους δεν κλειδώνει το UI στον ρόλο του
> χρήστη.** Όλοι, χωρίς εξαίρεση, κάνουν το ίδιο: ο ρόλος ορίζει τα **δικαιώματα** και
> **προτείνει** έναν χώρο· ο χρήστης τον **αλλάζει ελεύθερα**.

### Α-1 — Ο ρόλος **προτείνει**, δεν **φυλακίζει** *(ACC, ArchiCAD, AutoCAD)*
Η επαγγελματική ιδιότητα ορίζει τον **προεπιλεγμένο** χώρο εργασίας. Ο χρήστης μπορεί
πάντα να μεταβεί σε οποιονδήποτε άλλο χώρο τα **δικαιώματά** του επιτρέπουν. Η μόνη
απαραβίαστη γραμμή είναι το permission — και αυτό ελέγχεται στον server, όπως σήμερα.

### Α-2 — Υποβάθμιση πριν από εξαφάνιση *(Revit half-tone)*
Ό,τι δεν ανήκει στην ειδικότητά σου **δεν εξαφανίζεται** αυτόματα. Πρώτο επίπεδο:
υποβαθμίζεται (δευτερεύουσα θέση, ξεθωριασμένο, πίσω από ένα «Περισσότερα»). Εξαφάνιση
μόνο εκεί που το περιεχόμενο είναι **παντελώς άσχετο** με την ειδικότητα (ο λογιστής δεν
χρειάζεται ribbon σχεδίασης).

### Α-3 — Ποτέ σιωπηλή απόκρυψη *(μάθημα Office 2000)*
Κάθε φορά που ο χώρος εργασίας κρύβει κάτι, υπάρχει **ένα σταθερό, ορατό σημείο** που το
δηλώνει και το επαναφέρει με ένα κλικ. Ποτέ αυτόματη, «έξυπνη», βασισμένη σε συχνότητα
απόκρυψη. **Η προβλεψιμότητα υπερισχύει της καθαρότητας.**

### Α-4 — Πολλαπλοί χώροι ανά άτομο *(Cinema 4D)*
Ένας άνθρωπος **δεν** έχει έναν χώρο. Έχει όσους του επιτρέπουν τα δικαιώματά του, με έναν
**ενεργό**, εναλλάξιμο από σταθερό σημείο (πρότυπο: γρανάζι status bar AutoCAD, `Shift+C`
Cinema 4D).

### Α-5 — Ο χώρος είναι **τρόπος εργασίας**, όχι ταυτότητα *(Figma Dev Mode)*
Ο ίδιος άνθρωπος αλλάζει χώρο μέσα στην ίδια μέρα ανάλογα με το τι κάνει — όχι με το τι
είναι. Ο αρχιτέκτονας που τιμολογεί περνά στον χώρο «Λογιστικά» χωρίς να πάψει να είναι
αρχιτέκτονας και **χωρίς να ξανασυνδεθεί**.

---

## 8. Πού μπορούμε να ξεπεράσουμε τους μεγάλους

Η έρευνα εντόπισε **τέσσερις τεκμηριωμένες αδυναμίες** στα υπάρχοντα προϊόντα:

| # | Αδυναμία των μεγάλων | Τι κάνει ο Νέστωρ |
|---|---|---|
| **Υ-1** | **Το κενό της πρώτης μέρας.** AutoCAD/C4D: ο νεοεισερχόμενος παίρνει το ίδιο default με τον βετεράνο 20 ετών· κανείς δεν του λέει «εσύ είσαι τοπογράφος, αυτός είναι ο χώρος σου». Ο ACC το κάνει σε επίπεδο *modules*, ποτέ σε επίπεδο *εργαλείων* | Ο χώρος **προτείνεται από την ιδιότητα** την πρώτη σύνδεση — με ρητή δήλωση «σου προτείναμε αυτόν επειδή είσαι τοπογράφος· άλλαξέ τον όποτε θες» |
| **Υ-2** | **Η αδιαφάνεια.** Στο Revit, όταν κάτι λείπει ο χρήστης δεν ξέρει γιατί — είναι από τα πιο συχνά παράπονα της κοινότητας | **Ένας μόνιμος δείκτης**: «Ενεργός χώρος: Αρχιτέκτονας — 9 εργαλεία κρυμμένα». Ένα κλικ τα δείχνει όλα. Καμία κρυφή κατάσταση ποτέ |
| **Υ-3** | **Το προφίλ δεν ταξιδεύει.** ArchiCAD: εξαγωγή σε αρχείο και διανομή με το χέρι. C4D: τοπικό στο μηχάνημα | Ο χώρος ζει **στον λογαριασμό, στο cloud**. Αλλάζεις υπολογιστή → ίδια οθόνη. Και ο υπερδιαχειριστής ορίζει **εταιρικούς χώρους** που κληρονομούνται ζωντανά — το «Company Standards» του ArchiCAD, χωρίς αρχεία |
| **Υ-4** | **Ο χώρος είναι ρύθμιση, όχι συμβόλαιο.** Σε όλους: σκορπισμένη λογική UI, κανένα gate δεν φυλάει τη συνέπεια | Ο χώρος = **δεδομένα σε ένα SSoT αρχείο** + tests που ελέγχουν ότι κάθε εργαλείο ανήκει κάπου. Νέο ribbon tab χωρίς ανάθεση σε χώρο ⇒ **το gate μπλοκάρει** (πρότυπο: ADR-587 capability anchors) |

### Υ-5 … Υ-7 — από τη **δεύτερη** έρευνα (§6.9), εγκεκριμένα 2026-08-02

| # | Αδυναμία των μεγάλων | Τι κάνει ο Νέστωρ |
|---|---|---|
| **Υ-5** | 🔴 **ACC: η παράκαμψη είναι ΑΝΤΙΓΡΑΦΗ** (§6.9.1) ⇒ σιωπηλή απόκλιση που μεγαλώνει για πάντα. Κανένας από τους τέσσερις δεν βάζει **ημερομηνία λήξης** σε παράκαμψη δικαιώματος | **Καμία αντιγραφή, ποτέ.** Ζωντανός υπολογισμός· κάθε εξαίρεση φέρει **υποχρεωτικά** `expiresAt` + `reason` + ποιος τη χορήγησε, και **λήγει μόνη της**. Το μοτίβο **υπάρχει ήδη** στο `PropertyGrant` (§11.5) — **γενίκευση, όχι εφεύρεση** |
| **Υ-6** | **Κανείς δεν εξηγεί ΓΙΑΤΙ.** Figma/ACC/Revit δείχνουν το αποτέλεσμα, ποτέ την αιτία | *«Βλέπεις το **Εργοτάξιο** επειδή είσαι **επιβλέπων** στο **Βίλα Σούνιο**»* — ολόκληρη η **αλυσίδα αιτίασης ορατή** με ένα κλικ. Επέκταση του Υ-2 από «τι κρύφτηκε» σε «γιατί το έχεις» |
| **Υ-7** | Η συνέπεια δεν φυλάγεται από **τίποτα** — σκορπισμένη λογική σε UI + backend | **Policy as code** (§6.9.4) στο repo, version-controlled, **testable** + **gate**: νέο permission χωρίς ανάθεση σε δουλειά ⇒ **το pre-commit μπλοκάρει** (πρότυπο ADR-587) |

### Υ-8 · Υ-9 — από την **τρίτη** έρευνα (§6.10), εγκεκριμένα 2026-08-02

| # | Αδυναμία των μεγάλων | Τι κάνει ο Νέστωρ |
|---|---|---|
| **Υ-8** | **Καμία ενιαία εναλλαγή.** Revit/ArchiCAD/C4D/ACC: ο οργανισμός, το έργο και ο τρόπος εργασίας αλλάζουν από **τρία διαφορετικά σημεία** της οθόνης, με 3–4 κλικ. Ούτε ένας από τους τέσσερις δεν επιτρέπει να **γράψεις** πού θες να πας | **Ctrl+K**: *«σούνιο εργοτάξιο»* ⇒ και οι **τρεις** συντεταγμένες αλλάζουν με μία κίνηση. Το μονοπάτι μένει για όποιον προτιμά το ποντίκι· η πληκτρολόγηση για όποιον ξέρει πού πάει |
| **Υ-10** | 🔴 **Κενή οθόνη ως κανονική κατάσταση.** Ο ACC έχει **γένος άρθρων υποστήριξης** για ανθρώπους που δεν βλέπουν τίποτα (§6.11.1)· ο νέος χρήστης **περιμένει άνθρωπο** για να αρχίσει | **Καμία οθόνη αναμονής, πουθενά.** Το «μηδέν δουλειές» **παύει να υπάρχει ως κατάσταση**: ο άξονας 1 έχει **πάντα** τουλάχιστον μία τιμή — τον προσωπικό οργανισμό (Ε-2′). Κανείς δεν περιμένει ποτέ κανέναν για να ξεκινήσει |
| **Υ-9** | **Τίποτα δεν σε προειδοποιεί ότι είσαι σε λάθος οργανισμό.** Το ακριβότερο λάθος του πολυ-οργανισμικού μοντέλου· η **AWS** πρόσθεσε **χρώμα ανά λογαριασμό μόλις το 2026**, μετά από χρόνια λαθών | Η αλλαγή οργανισμού αλλάζει **ορατά την όψη του κελύφους** (χρώμα + σήμα), **από την πρώτη μέρα**. Δεν είναι διακόσμηση: είναι το «fail-loud» του άξονα 1 |

---

## 9. Διευκρινιστικά ερωτήματα και απαντήσεις

> Συμπληρώνεται σταδιακά. Κάθε απάντηση καταχωρίζεται εδώ **πριν** τεθεί το επόμενο ερώτημα.

### Ε-1 — Η ιδιότητα κολλάει στον άνθρωπο ή αλλάζει από έργο σε έργο;

**Παράδειγμα**: ο Νίκος είναι αρχιτέκτονας. Στο έργο «Πολυκατοικία Κηφισιάς» σχεδιάζει·
στο έργο «Βίλα Σούνιο» μόνο κοιτάζει. Τι βλέπει το πρωί, πριν διαλέξει έργο;

**Πρόταση Claude, βάσει έρευνας §6 — ούτε (Α) ούτε (Β), αλλά (Γ):**

> **(Γ) Ο χώρος ανήκει στον ΑΝΘΡΩΠΟ, είναι ΕΝΑΣ ΑΠΟ ΠΟΛΛΟΥΣ, και η αλλαγή έργου ΔΕΝ τον
> αλλάζει — αλλάζει μόνο ποια κουμπιά είναι ενεργά.**

Ανάλυση:
- Το (Β) «το έργο ορίζει την οθόνη» **δεν το κάνει κανείς από τους έξι**. Στο Revit το
  αρχείο δεν αλλάζει το ribbon του χρήστη· αλλάζει τι φαίνεται *στην όψη*. Στο ACC ο ρόλος
  είναι ανά έργο αλλά καθορίζει **modules**, όχι διάταξη εργαλείων.
- Το (Α) «μία σταθερή οθόνη ανά άτομο» είναι πιο κοντά, αλλά **αντιβαίνει στην Α-4**: ο ίδιος
  άνθρωπος θέλει ξεχωριστούς χώρους για ξεχωριστές δουλειές μέσα στην ίδια μέρα.
- Άρα (Γ): **ιδιότητα → προτείνει χώρο (Α-1)· ο χρήστης έχει πολλούς (Α-4)· το έργο ελέγχει
  δικαιώματα, όχι διάταξη.**

Στο «Σούνιο» ο Νίκος βλέπει **τον ίδιο** χώρο «Αρχιτέκτονας», αλλά τα εργαλεία σχεδίασης
είναι **ανενεργά με εξήγηση** («δεν έχεις δικαίωμα επεξεργασίας σε αυτό το έργο») — δεν
εξαφανίζονται (Α-2, Α-3). Έτσι δεν μπερδεύεται νομίζοντας ότι χάλασε η εφαρμογή.

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): ΣΥΜΦΩΝΕΙ ΜΕ ΤΟ (Γ).**

**Κλειδωμένες συνέπειες** — δεσμευτικές για κάθε επόμενη φάση:

| # | Συνέπεια |
|---|---|
| Ε1.α | Ο χώρος εργασίας είναι ιδιότητα **του χρήστη**, όχι του έργου. Δεν αποθηκεύεται ανά έργο. |
| Ε1.β | Ένας χρήστης έχει **πολλούς διαθέσιμους** χώρους, **έναν ενεργό**. Εναλλαγή από σταθερό σημείο, **χωρίς επανασύνδεση**. |
| ~~Ε1.γ~~ | ~~Η αλλαγή έργου **ΔΕΝ αλλάζει** τον ενεργό χώρο. Αλλάζει μόνο ποια κουμπιά είναι **ενεργά**.~~ **⚠️ ΑΝΑΘΕΩΡΗΘΗΚΕ ⇒ Ε1.γ′** |
| ~~Ε1.δ~~ | ~~Εργαλείο χωρίς δικαίωμα στο τρέχον έργο ⇒ **ανενεργό με ρητή εξήγηση**, ΠΟΤΕ εξαφανισμένο.~~ **⚠️ ΠΕΡΙΟΡΙΣΤΗΚΕ ⇒ Ε1.δ′** |
| Ε1.ε | Η επαγγελματική ιδιότητα **προτείνει** τον αρχικό χώρο· δεν τον επιβάλλει (Α-1). |

#### ⚠️ Ε-1.ΑΝΑΘ — Αναθεώρηση των Ε1.γ / Ε1.δ *(2026-08-02, μετά το Ε-4)*

Ο Γιώργος έθεσε το σενάριο που **σπάει** το αρχικό Ε1.γ:

> *«Ο αρχιτέκτονας συνεργάζεται με δεύτερη εταιρεία, στην οποία **στο ένα έργο είναι ο
> μελετητής και στο άλλο ο επιβλέπων**. Άρα διαφορετικά πράγματα και διαφορετικά
> δικαιώματα.»*

**Η δοκιμή**: ο Νίκος έχει ανοιχτό το **«Σχέδιο»** και αλλάζει από το «Πολυκατοικία»
*(μελετητής)* στο «Βίλα Σούνιο» *(επιβλέπων)*.

| | Αποτέλεσμα |
|---|---|
| **Με το αρχικό Ε1.γ** | Μένει στο «Σχέδιο» με τα εργαλεία γκρίζα ⇒ κοιτάζει **άδειο σχεδιαστήριο** |
| **Τι χρειάζεται πραγματικά** | Το **«Εργοτάξιο»** — φωτογραφίες, πρόοδος, αναφορές |

🔑 **Η ρίζα**: το Ε1.γ γράφτηκε **πριν** το Ε-4 ανακαλύψει τη διάκριση **δουλειά / στάθμη /
εύρος** (§3.1γ). Ισχύει για διαφορά **στάθμης** (μελετητής ↔ θεατής: ίδια δουλειά, λιγότερη
δύναμη) και είναι **λάθος** για διαφορά **δουλειάς** (μελετητής ↔ επιβλέπων = Σχέδιο ↔
Εργοτάξιο, δύο **διαφορετικές** από τις έξι). Η διάκριση **δεν είχε εφαρμοστεί αναδρομικά**.

**✅ ΕΓΚΡΙΘΗΚΕ ΑΠΟ ΤΟΝ ΓΙΩΡΓΟ (2026-08-02).** Αντικαθιστούν τα Ε1.γ/Ε1.δ:

| # | Συνέπεια |
|---|---|
| **Ε1.γ′** | Η αλλαγή έργου **δεν αλλάζει ΠΟΤΕ σιωπηλά** την ενεργή δουλειά (Α-3). Αλλά αν στο νέο έργο η ενεργή δουλειά **δεν έχει νόημα**, το σύστημα **ΠΡΟΤΕΙΝΕΙ**: *«Στο Βίλα Σούνιο είσαι επιβλέπων — να ανοίξω το Εργοτάξιο;»* Ένα κλικ· **ποτέ αυτόματα** (Α-1) |
| **Ε1.δ′** | Το «**ανενεργό με εξήγηση**» ισχύει για διαφορά **στάθμης** *(ίδια δουλειά, λιγότερη δύναμη)*. Για διαφορά **δουλειάς** ισχύει το Ε1.γ′ — **πρόταση αλλαγής**, όχι γκρίζα κουμπιά |
| **Ε1.ζ** | 🔴 **Τα δικαιώματα έρχονται από ΔΥΟ πηγές**: ο ρόλος στον **οργανισμό** (`GlobalRole`, custom claims) **+** ο ρόλος **σε αυτό το έργο** (`ProjectRole`, `/projects/{pid}/members/{uid}`). Η λίστα δουλειών του Ε-5 υπολογίζεται από την **ΕΝΩΣΗ**. Η υποδομή **υπάρχει ήδη** — η πρώτη διατύπωση του Ε-5 την αγνοούσε |
| **Ε1.η** | Ο Νίκος στη Β έχει **συνολικά** Σχέδιο + Εργοτάξιο· σε **κάθε έργο** ενεργή είναι η αντίστοιχη. Το σύνολο ανήκει στη **συμμετοχή**, η επιλογή στο **έργο** |

---

### Ε-2 *(ΑΠΟΣΥΡΘΗΚΕ — αντικαταστάθηκε από το Ε-2′ μετά την αποκάλυψη του οράματος §0)*

Η αρχική Ε-2 ρωτούσε «πόσοι χώροι εργασίας υπάρχουν;» με κριτήριο τη *δοκιμή της πρώτης
οθόνης* (δύο επαγγέλματα = ξεχωριστοί χώροι μόνο αν ανοίγουν διαφορετική πρώτη οθόνη).
**Παραμένει έγκυρο κριτήριο** και θα χρησιμοποιηθεί — αλλά **όχι τώρα**: το όραμα του §0
έθεσε ερώτημα που προηγείται λογικά. Δεν μπορείς να μετρήσεις χώρους εργασίας πριν
αποφασίσεις **ποιος κατέχει τον χρήστη**.

### Ε-2′ — Ποιος «κατέχει» τον λογαριασμό του επαγγελματία;

**Το ερώτημα**: όταν ο αρχιτέκτονας Νίκος αποκτά λογαριασμό στον Νέστορα — **πώς γίνεται;**

- **(Α) Τον προσκαλεί μια εταιρεία** → ο λογαριασμός *ανήκει* σε εκείνη. Αν φύγει, χάνει τα
  πάντα. *(σημερινό μοντέλο)*
- **(Β) Γράφεται μόνος του**, αποκτά **δικό του χώρο** από την πρώτη στιγμή, και μετά τον
  προσκαλούν εταιρείες. Ο λογαριασμός *ανήκει στον εαυτό του*. *(μοντέλο Slack/Figma/GitHub)*

**Γιατί προηγείται όλων**: το (Β) είναι **προϋπόθεση** και για τα τρία σενάρια Σ-1/Σ-2/Σ-3
του §0.2. Το (Α) τα καθιστά **δομικά αδύνατα** — όχι δύσκολα, αδύνατα.

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): (Β) — ο λογαριασμός ανήκει στον άνθρωπο.**

**Κλειδωμένες συνέπειες** — δεσμευτικές:

| # | Συνέπεια |
|---|---|
| Ε2.α | **Κάθε άνθρωπος αποκτά προσωπικό οργανισμό στην εγγραφή**, πριν τον προσκαλέσει οποιοσδήποτε. Δεν είναι ειδική περίπτωση — είναι tenant σαν όλους. |
| Ε2.β | Η αποχώρηση από εταιρεία **δεν καταστρέφει** τον λογαριασμό. Ο προσωπικός χώρος επιβιώνει ανέπαφος. |
| Ε2.γ | Η εγγραφή γίνεται **ανοιχτή στο διαδίκτυο** ⇒ απαιτείται επαλήθευση ταυτότητας, αντι-spam, όρια αποθήκευσης. **Αναγνωρισμένο κόστος**, όχι παράβλεψη. |
| Ε2.δ | Η πρόσκληση από εταιρεία γίνεται **δεύτερη πράξη** πάνω σε υπάρχοντα λογαριασμό — όχι γενέτειρα του λογαριασμού. |
| Ε2.ε | ⚠️ **Το σημερινό `complete-registration`** (που δίνει `external_user` + έναν `companyId`) πρέπει να αναθεωρηθεί: σήμερα ο λογαριασμός **γεννιέται μέσα** σε εταιρεία. |

---

### Ε-3 — Τι μπορεί να κάνει ο επαγγελματίας **μόνος του**, στον δικό του χώρο;

**Το ερώτημα**: ο Νίκος γράφτηκε (Ε-2′/Β), έχει προσωπικό οργανισμό, **καμία εταιρεία δεν
τον έχει προσκαλέσει ακόμη**. Ανοίγει την εφαρμογή. Τι βλέπει και τι μπορεί να κάνει;

Καθορίζει **τι ΕΙΝΑΙ ο Νέστωρ**: πλήρες επαγγελματικό εργαλείο ή εργαλείο συνεργασίας.

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): (Α) — πλήρης προσωπικός χώρος.**

| # | Συνέπεια |
|---|---|
| Ε3.α | Ο προσωπικός χώρος έχει **ίδιες λειτουργίες** με εταιρικό: DXF, έργα, κτίρια, πελάτες, τιμολόγια. **Κανένα κουτσουρεμένο χαρακτηριστικό.** |
| Ε3.β | «Ίδια δύναμη, **όρια στην κλίμακα**»: όρια σε μέγεθος/πλήθος, ΠΟΤΕ σε δυνατότητα. |
| Ε3.γ | Λόγος: αν ο Νίκος δεν ανοίγει σχέδιο στον χώρο του, **κρατά το AutoCAD** ⇒ ο Νέστωρ γίνεται μία ακόμη εφαρμογή στη λίστα αντί να τις αντικαταστήσει. |
| Ε3.δ | Ο ατομικός επαγγελματίας είναι **κανάλι απόκτησης**, όχι πηγή εσόδων. |

#### Ε-3.α — Παρέκβαση: το οικονομικό μοντέλο *(ερώτημα Γιώργου, 2026-08-02)*

Ο Γιώργος ρώτησε πώς λύνεται το κόστος αποθήκευσης — «συνδρομή που τα περιλαμβάνει όλα, ή
άλλος τρόπος;». **Δεν είναι παρέκβαση: είναι η ίδια απόφαση με το Ε-3.**

**Το μέγεθος του «προβλήματος», μετρημένο** (Firebase Storage ~$0,026/GB/μήνα):

| Χρήστης | Όγκος | Κόστος/μήνα |
|---|---|---|
| Αρχιτέκτονας, 20 έργα × 200 MB | 4 GB | **~0,10 $** |
| Συνδρομητής στα ~30 €/μήνα | καλύπτει | **~1.150 GB** |

🔑 **Η αποθήκευση ΔΕΝ είναι ο κίνδυνος για τον πληρωμένο χρήστη.** Είναι κίνδυνος **μόνο**
για τον δωρεάν που δεν θα μετατραπεί ποτέ.

**Τι κάνει ο κλάδος**: Figma/Notion/GitHub = δωρεάν ατομικό + **χρέωση ανά θέση** για ομάδες.
Κανείς δεν χρεώνει αποθήκευση, γιατί αυτό τιμωρεί ακριβώς τη συμπεριφορά που θέλεις (να
ανεβάσουν τη δουλειά τους μέσα). Ο ατομικός επαγγελματίας είναι **κανάλι απόκτησης**, όχι
πηγή εσόδων. Εξαίρεση: το Autodesk μετρά **βαριά επεξεργασία** (cloud credits) — όχι χώρο.

**Πρόταση Claude — τρία σκέλη:**

| Σκέλος | Μοντέλο | Γιατί |
|---|---|---|
| **Θέσεις χρηστών** | συνδρομή ανά θέση· η **εταιρεία** πληρώνει | Προβλέψιμο έσοδο· ευθυγραμμισμένο με την αξία |
| **Αποθήκευση** | **περιλαμβάνεται**, με γενναιόδωρα όρια ανά επίπεδο | Το κόστος είναι αμελητέο· η χρέωση θα σαμποτάριζε την υιοθέτηση |
| **Βαριά επεξεργασία** (AI pipeline, renders, μεγάλες τοπογραφικές) | **μετρημένη** σε μονάδες | ⚠️ **Πραγματικό μεταβλητό κόστος** (AI tokens). ΔΕΝ αντέχει flat συνδρομή |

🔑 **ΔΕΝ χρειάζεται απόφαση τιμών τώρα.** Χρειάζεται μόνο η επίγνωση ότι υπάρχει **στρώμα
δικαιωμάτων απόκτησης** — και αυτό **ΥΠΑΡΧΕΙ ΗΔΗ**:

> `src/lib/asset-packs/asset-pack-access.ts` (ADR-655) υλοποιεί ήδη τον **ακριβώς σωστό**
> διαχωρισμό: **(1)** τι απέκτησε η ΕΤΑΙΡΕΙΑ → `companies/{id}.assetPackEntitlements`
> *(εμπορική απόφαση)* · **(2)** ποιος ΧΡΗΣΤΗΣ μπορεί να το χρησιμοποιήσει → RBAC
> *(οργανωτική απόφαση)*. Καθαρή συνάρτηση, μηδέν I/O, **fail-closed**, διακριτοί λόγοι
> άρνησης. Χρειάζεται **γενίκευση** από «πακέτα περιεχομένου» σε «δικαιώματα πλατφόρμας»,
> **όχι εφεύρεση**.

**Η μόνη ενέργεια που πρέπει να γίνει ΤΩΡΑ**: όριο μεγέθους στον δωρεάν προσωπικό χώρο από
την **πρώτη** μέρα. Όριο που προστίθεται εκ των υστέρων σε υπάρχοντες χρήστες είναι
**διπλωματικό** πρόβλημα, όχι τεχνικό.

#### ⚠️ ΔΙΟΡΘΩΣΗ της πρότασης «χρέωση ανά θέση» — θα σκότωνε το όραμα

Η αρχική διατύπωση «θέσεις = κύριο έσοδο» έχει **σοβαρό ελάττωμα** και διορθώνεται:

Ο Γιώργος θέλει μέσα δικηγόρο, συμβολαιογράφο, αγοραστή, προμηθευτή, εργάτη — που μπαίνουν
**δύο φορές τον χρόνο**. Αν η εταιρεία πληρώνει θέση για τον καθένα, **δεν θα τους
προσκαλέσει ποτέ** ⇒ επιστροφή στο email ⇒ **κατάρρευση του «όχι με email»** (§0).

Λύση του κλάδου, **ομόφωνη**: Figma → πληρώνουν μόνο οι *editors* (viewers/σχολιαστές
δωρεάν)· Slack Connect → οι **εξωτερικοί δεν μετρούν** ως θέσεις· ACC → υπάρχουν ρόλοι
χωρίς κόστος θέσης.

> ### 🔑 ΔΙΟΡΘΩΜΕΝΗ ΑΡΧΗ: **πληρώνει όποιος ΔΗΜΙΟΥΡΓΕΙ. Όποιος βλέπει, σχολιάζει ή υπογράφει — δωρεάν.**

Και εμπορικά σωστό: κάθε δωρεάν συμμετέχων είναι επαγγελματίας που **μπήκε μέσα** και έμαθε
την πλατφόρμα. Αύριο θέλει δικό του χώρο.

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): εγκρίθηκαν και τα 4 σημεία της τελικής πρότασης.**

| # | Απόφαση | Δεσμευτικό |
|---|---|---|
| **1** | (Α) + τρία σκέλη **ως αρχιτεκτονική** | Πλήρης προσωπικός χώρος· θέσεις/αποθήκευση/μετρημένη επεξεργασία |
| **2** | ⚠️ **Η εγγραφή ξεκινά ΜΕ ΠΡΟΣΚΛΗΣΗ, όχι ανοιχτή** | Απόκλιση από το Ε2.γ. Δομή **πανομοιότυπη** — αλλάζει μόνο *ποιος μπαίνει*· ένας διακόπτης. Λύνει: κόστος, spam, υποστήριξη, GDPR. **Ο Γιώργος είναι ένας άνθρωπος** — χιλιάδες άγνωστοι χρήστες = κατάρρευση, όχι επιτυχία. Προηγούμενο: Figma **4 χρόνια** κλειστή beta· Superhuman λίστα αναμονής· Notion χούφτα χρήστες |
| **3** | **Μέτρα από μέρα 1, επίβαλε τίποτα** | Καταγραφή χώρου/AI/έργων **χωρίς φράγμα** ⇒ όταν έρθει η τιμή, υπάρχουν **πραγματικά** νούμερα αντί εικασιών |
| **4** | **Ένα σκληρό όριο από μέρα 1: το μέγεθος** | Όλα τα άλλα μπαίνουν αργότερα ανώδυνα· το όριο χώρου **όχι** — χρήστης με 40 GB που ακούει «όριο 5» γίνεται εχθρός |

**Τι ΔΕΝ μπαίνει σε κώδικα σήμερα**: πλάνα, τιμές, πύλες πληρωμής. Ό,τι χρειάζεται
υπάρχει ήδη σε μικρογραφία (ADR-655).

---

### Ε-4 — Πόσες διαφορετικές «δουλειές» υπάρχουν μέσα σε έναν οργανισμό;

#### Ε-4.0 Πρώτη, λανθασμένη απόπειρα — καταγράφεται γιατί το λάθος είναι διδακτικό

Η πρώτη απάντηση ήταν **έξι χώροι**: Μελέτη · Εργοτάξιο · Πωλήσεις · Οικονομικά ·
Συνεργασία · Διαχείριση. Ο Γιώργος ρώτησε *«διάβασες το όραμα;»* — και η απάντηση ήταν
**όχι στην πράξη**: αυτοί οι έξι είναι **τα τμήματα μιας κατασκευαστικής εταιρείας**,
δηλαδή απάντηση στο §1, όχι στο §0.

Τι είχε σπάσει:

| Σενάριο §0.2 | Τι του συνέβη |
|---|---|
| **Σ-3** *(δικό του γραφείο)* | **Έλειπε τελείως.** Το «Οικονομικά» ήταν ο λογιστής *της εταιρείας*, όχι τα δικά του βιβλία |
| **Σ-1** *(δύο εταιρείες)* | Καμία έννοια «σε ποιον οργανισμό βρίσκομαι» |
| **Σ-2** *(ο ίδιος ως πελάτης)* | Θάφτηκε σε έναν χώρο «Συνεργασία» δίπλα στον προμηθευτή |

🔑 **Η ρίζα**: το §11.3 είχε ήδη διαχωρίσει **τέσσερα** επίπεδα (Άνθρωπος · Οργανισμός ·
Συμμετοχή · Χώρος). Η απάντηση **ξανασυγχώνευσε τη Συμμετοχή με τον Χώρο** σε μία λίστα.
Γι' αυτό όλα μύριζαν «μία εταιρεία».

#### Ε-4.1 Η διόρθωση: **δύο άξονες, όχι ένας**

Το πλήρες «πού βρίσκομαι» είναι πάντα **ζευγάρι**:

| Άξονας | Ερώτημα | Τιμές (παράδειγμα Νίκου) | Απαντήθηκε |
|---|---|---|---|
| **1. Οργανισμός** | *Πού είμαι;* | **Το γραφείο μου** · Εταιρεία Α · Εταιρεία Β · ως πελάτης της Γ | **Ε-2′** |
| **2. Χώρος εργασίας** | *Τι δουλειά κάνω;* | οι έξι του Ε-4.3 | **εδώ** |

Ο Νίκος το πρωί: *«Το γραφείο μου → Σχέδιο»*. Το μεσημέρι: *«Εταιρεία Α → Σχέδιο»* — **ίδια
δουλειά, άλλα δεδομένα, άλλα δικαιώματα**. Το βράδυ: *«Το γραφείο μου → Οικονομικά»*.

Δύο διορθώσεις προκύπτουν αμέσως:

- ❌ Η **«Συνεργασία» ΔΕΝ είναι δουλειά.** Είναι **θέση στον άξονα 1** — το τι βλέπεις όταν η
  συμμετοχή σου σε **ξένο** οργανισμό είναι περιορισμένη. Ο δικηγόρος στη Β κάνει τη
  δουλειά «Πελάτες/Νομικά», απλώς μόνο για τον έναν φάκελο.
- ✅ Το **«γραφείο μου» ΔΕΝ είναι δουλειά** — είναι **οργανισμός** (ο προσωπικός tenant του
  Ε-2′). Μέσα του ο Νίκος έχει **πάλι τις ίδιες** δουλειές, απλώς δικές του. Αυτό ακριβώς
  εγκρίνει το Ε-3: *ίδια δύναμη, όρια στην κλίμακα*.

#### Ε-4.2 Η μέθοδος: **μετρημένη, όχι θεωρητική**

Ο Γιώργος έθεσε το σωστό κριτήριο: *«με βάση τους ρόλους και τα δικαιώματα που έχουμε
μέχρι στιγμής ορίσει»*. Μετρήθηκαν τα permission sets των **13 ρόλων** του
`src/lib/auth/roles.ts` (⚠️ **13, όχι 10** — το CLAUDE.md είναι ανακριβές, βλ. Π-5), αφού
αφαιρέθηκαν όσα έχουν σχεδόν όλοι (`notifications:view`, `projects:view`,
`properties:view`, `units:view`).

#### Ε-4.3 Το αποτέλεσμα: **ΕΞΙ δουλειές**

| # | Δουλειά | Αποκλειστικά permissions | Ρόλοι | Ωριμότητα |
|---|---|---|---|---|
| 1 | **Σχέδιο** | `dxf:*` · `bim_dimensions_3d` · `bim_comments` · `bim_animations` | architect, engineer | ✅ πλήρες |
| 2 | **Εργοτάξιο** | `photos:upload` · `progress:update` · `reports:create` | site_manager | ✅ πλήρες |
| 3 | **Πελάτες** | `crm:contacts:*` · `comm:conversations` · `comm:messages` | sales_agent, data_entry | ✅ πλήρες |
| 4 | **Οικονομικά** | `finance:invoices:view/update` | accountant *(μόνος)* | ⚠️ 2 permissions |
| 5 | **Προμήθειες** | `orders:orders` · `deliveries:deliveries` · `specs` | vendor *(μόνος)* | ⚠️ 3 permissions |
| 6 | **Διαχείριση** | `admin_access` · `users:*` · `settings:*` | company_admin, super_admin | ✅ πλήρες |

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): ΣΥΜΦΩΝΕΙ — έξι σήμερα, επτά με το όραμα.**

#### Ε-4.4 🔑 Τα τρία ευρήματα που **ο κώδικας δίδαξε**, όχι το αντίστροφο

**(1) Ο κώδικας συμφωνεί ήδη ότι «Σχέδιο = μία δουλειά με διακόπτη ειδικότητας».**

```
architect : 22 permissions
engineer  : 23 permissions   →  τα ΙΔΙΑ 22 + specs:specs:view
```

**Ένα permission διαφορά στα 23.** Ο αρχιτέκτονας και ο μηχανικός **είναι ήδη η ίδια
δουλειά** στο σύστημα εδώ και μήνες. Η αρχή «ένας χώρος Σχέδιο + διακόπτης ειδικότητας»
(§5.1) **δεν προτάθηκε — επιβεβαιώθηκε εμπειρικά**.

**(2) Οι Προμήθειες υπήρχαν και είχαν παραλειφθεί.** Ο `vendor` έχει **δύο domains που
κανείς άλλος δεν αγγίζει** (`orders`, `deliveries`) — η καθαρότερα απομονωμένη δουλειά
όλου του συστήματος. Στην πρώτη απόπειρα είχε χωθεί στη «Συνεργασία», χώρο που την ίδια
στιγμή απορριπτόταν ως ανύπαρκτος.

**(3) Τέσσερις ρόλοι δεν είναι δουλειές** — είναι **στάθμη** ή **εύρος** (βλ. §3.1(γ)).

#### Ε-4.5 ⚠️ Η **έβδομη** δουλειά — υπάρχει στο όραμα, όχι στον κώδικα

Το **«Το κοινό μου»** του Σ-3 (CRM δικών του πελατών, κοινωνικά δίκτυα, αναρτήσεις,
ιστοσελίδα) έχει **μηδέν permissions** στον κώδικα. Δεν υπάρχει ούτε ως ιδέα. Δεν μπορούσε
να μετρηθεί — γι' αυτό δεν είναι μία από τις έξι.

⚠️ Δεν είναι απλή προσθήκη: συγκρούεται ευθέως με το **§11.4 (GDPR)**. Οι πελάτες που ο
Νίκος γνώρισε *μέσω* της εταιρείας Α ανήκουν **στην Α** — δεν μεταναστεύουν στο «κοινό
του». Απαιτεί δική της απόφαση, όχι επέκταση αυτής.

**Κλειδωμένες συνέπειες:**

| # | Συνέπεια |
|---|---|
| Ε4.α | **Έξι** δουλειές: Σχέδιο · Εργοτάξιο · Πελάτες · Οικονομικά · Προμήθειες · Διαχείριση. Το μητρώο της Φάσης 1 έχει **έξι** εγγραφές, όχι 14 |
| Ε4.β | Τα ονόματα είναι **δουλειές**, ποτέ επαγγέλματα (Α-5). Ούτε ένας χώρος δεν λέγεται «Αρχιτέκτονας» |
| Ε4.γ | Οι πέντε ειδικότητες μελέτης = **διακόπτης μέσα στο «Σχέδιο»**, όχι πέντε χώροι. Επιβεβαιωμένο από τα permissions (Ε-4.4/1) |
| Ε4.δ | `viewer`/`data_entry`/`internal_user`/`external_user` ⇒ **στάθμη**, όχι δουλειά ⇒ υλοποιούνται ως **Ε1.δ** (ανενεργό με εξήγηση), όχι ως χώροι |
| Ε4.ε | `project_manager`/`company_admin`/`super_admin` ⇒ **εύρος** ⇒ βλέπουν **πολλές** δουλειές ταυτόχρονα, με μία **ενεργή** (Ε1.β) |
| Ε4.στ | «Οικονομικά» και «Προμήθειες» είναι **αληθινές αλλά ανώριμες** (2 και 3 permissions). Ο χώρος τους δηλώνεται τώρα· γεμίζει αργότερα |
| Ε4.ζ | Το **«Το κοινό μου»** είναι **έβδομη, μελλοντική** δουλειά — **δεν** μπαίνει στο μητρώο της Φάσης 1 και **δεν** αποφασίζεται εδώ (GDPR, §11.4) |
| Ε4.η′ | ⚠️ **ΑΝΑΘΕΩΡΗΘΗΚΕ** *(Ε-1.ΑΝΑΘ)*: ο πλήρης προσδιορισμός θέσης είναι **ΤΡΙΑΔΑ** — *(οργανισμός, **έργο**, δουλειά)*, όχι ζεύγος. Η πρώτη διατύπωση παρέλειπε το έργο, όπου όμως ζει το μισό των δικαιωμάτων (`ProjectRole`, Ε1.ζ). Καμία οθόνη δεν δείχνει τη δουλειά χωρίς το πλαίσιό της |

---

### Ε-5 — Ποιος γεμίζει τη λίστα των δουλειών του κάθε ανθρώπου;

**Το ερώτημα**: ο Νίκος μπαίνει. Ποιες από τις έξι δουλειές βλέπει, και **ποιος το αποφάσισε;**

| | Επιλογή |
|---|---|
| **(Α)** | Το **σύστημα**, υπολογισμένο από τα δικαιώματα. Ο χρήστης μόνο κρύβει, ποτέ προσθέτει |
| **(Β)** | Ο **διαχειριστής**, ρητά ανά άνθρωπο |
| **(Γ)** | **Υπολογισμός + δυνατότητα παράκαμψης** από τον διαχειριστή |

#### Ε-5.1 Η έρευνα ανέτρεψε την αρχική πρόταση

Η πρώτη πρόταση ήταν **(Α)**. Η έρευνα §6.9 έδειξε ότι **οι μεγάλοι κάνουν (Γ)**: ο ACC έχει
default ανά ρόλο **και** παράκαμψη ανά έργο· η Figma έχει κληρονομιά **και** ρητή εξαίρεση.
Κατά την εντολή του Γιώργου *(«αν οι μεγάλοι δεν το προτείνουν, ακολουθούμε την πρακτική
τους»)*, το **(Α) αποσύρεται**.

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): (Γ) «με τον τρόπο της Figma» + Υ-5/Υ-6/Υ-7.**

> ### 🔑 **(Γ) ΜΕ ΤΟΝ ΤΡΟΠΟ ΤΗΣ FIGMA, ΟΧΙ ΤΟΥ AUTODESK**
>
> Ζωντανός υπολογισμός από την **ένωση** των πηγών (Ε1.ζ) — **ΠΟΤΕ αντιγραφή**.
> Η παράκαμψη είναι **ρητή, αιτιολογημένη, χρονικά περιορισμένη εξαίρεση ΠΑΝΩ** στον
> υπολογισμό — όχι στιγμιότυπο που τον αντικαθιστά.

Το σενάριο που το επιβάλλει (Ε-1.ΑΝΑΘ): ο Νίκος στην εταιρεία Β είναι `external_user` ⇒
**μηδέν** δουλειές σε επίπεδο εταιρείας. Όλη του η δύναμη ζει **στα έργα**:

| Πηγή | Δουλειές |
|---|---|
| Ρόλος στην εταιρεία Β (`external_user`) | **καμία** |
| Ρόλος στο έργο «Πολυκατοικία» (μελετητής) | **Σχέδιο** |
| Ρόλος στο έργο «Βίλα Σούνιο» (επιβλέπων) | **Εργοτάξιο** |
| **ΕΝΩΣΗ** | **Σχέδιο + Εργοτάξιο** |

⚠️ **Χωρίς την ένωση, ο Νίκος βλέπει ΑΔΕΙΑ ΟΘΟΝΗ στη Β.** Και χειρόγραφη λίστα (Β) είναι
μη ρεαλιστική: διαφορετικά δικαιώματα σε **κάθε έργο κάθε εταιρείας** ⇒ ενημέρωση σε κάθε
νέο έργο, από άνθρωπο που θα το ξεχάσει.

#### Ε-5.2 Τι ΔΕΝ κάνουμε — ρητά, με τον λόγο

**Δεν εγκαθιστούμε SpiceDB / OpenFGA / Permify τώρα.** Είναι ξεχωριστή υπηρεσία + βάση, για
συστήματα εκατομμυρίων χρηστών· ο Νέστωρ είναι **pre-production, ένας χρήστης**.

Υιοθετούμε όμως το **μοντέλο σκέψης** χωρίς τη βιβλιοθήκη: αποθηκεύουμε **σχέσεις**
*(ο Νίκος → επιβλέπων → Βίλα Σούνιο)* αντί για ρόλους σε πίνακα. Αν αύριο χρειαστεί
πραγματικό ReBAC, **τα δεδομένα είναι ήδη στο σωστό σχήμα**. Αν όχι, δεν πληρώσαμε τίποτα.

**Κλειδωμένες συνέπειες:**

| # | Συνέπεια |
|---|---|
| Ε5.α | Η λίστα δουλειών **υπολογίζεται ζωντανά** από την ένωση εταιρικού + ανά-έργο ρόλου (Ε1.ζ). **Δεν αποθηκεύεται λίστα.** |
| Ε5.β | Αποθηκεύονται **μόνο δύο** πράγματα: ποια δουλειά ήταν **ενεργή** τελευταία, και ποιες ο χρήστης **έκρυψε** ο ίδιος |
| Ε5.γ | 🔴 **ΚΑΜΙΑ ΑΝΤΙΓΡΑΦΗ ΔΙΚΑΙΩΜΑΤΩΝ, ΠΟΤΕ** (Υ-5). Το ελάττωμα του ACC (§6.9.1) είναι **ρητά απαγορευμένο** |
| Ε5.δ | Κάθε παράκαμψη διαχειριστή = **ρητή εξαίρεση** με **υποχρεωτικά** `expiresAt` + `reason` + χορηγό. Σχήμα: `PropertyGrant` (§11.5) |
| Ε5.ε | Το κρύψιμο από τον χρήστη **ΠΟΤΕ σιωπηλά** — μόνιμος δείκτης «*Χ δουλειές κρυμμένες*», επαναφορά με ένα κλικ (Α-3, Υ-2) |
| Ε5.στ | **Η αλυσίδα αιτίασης είναι ορατή** (Υ-6): γιατί βλέπεις κάθε δουλειά, με ένα κλικ |
| Ε5.ζ | Ο υπολογισμός είναι **καθαρή συνάρτηση, fail-closed**, κατά το πρότυπο `decideAssetPackAccess()` (ADR-655). **Policy as code** στο repo, testable (Υ-7) |
| Ε5.η | Το φιλτράρισμα UI είναι **UX, ΟΧΙ ασφάλεια** (§6.9.5). Ο server ελέγχει πάντα, όπως σήμερα |
| Ε5.θ | ⚠️ **Πρώτο εύρημα του υπολογισμού**: ο `company_admin` **δεν έχει** `finance:invoices` ⇒ δεν βλέπει «Οικονομικά», ούτε «Εργοτάξιο», ούτε «Προμήθειες». Πιθανό **κενό στα σημερινά δικαιώματα** — βλ. Π-7 |

---

### Ε-6 — Πώς εμφανίζεται η **εναλλαγή** της τριάδας *(οργανισμός, έργο, δουλειά)*;

**Το ερώτημα**: ο Νίκος θέλει να πάει στην **Εταιρεία Β** → έργο **Βίλα Σούνιο** →
**Εργοτάξιο**. Ένα κουμπί, δύο ή τρία;

#### Ε-6.1 ⚠️ Η ερώτηση τέθηκε **μετά** τη μέτρηση, όχι πριν

Η προφανής υπόθεση — *«δεν υπάρχει μηχανισμός εναλλαγής, πρέπει να τον φτιάξουμε»* — είναι
**λάθος**. Το **§2.7** το μέτρησε: υπάρχουν **δύο** μηχανισμοί για τον άξονα 1, δεν
γνωρίζονται μεταξύ τους, και ο πληρέστερος από τους δύο **δεν έχει κανένα κουμπί**
(`switchWorkspace()` ⇒ **0 καλούντες**, Π-8). **Το παραδοτέο δεν είναι ο μηχανισμός — είναι
το κουμπί που λείπει και η ενοποίηση των δύο δρόμων.**

#### Ε-6.2 Η πρόταση: **δύο + ένα**, όχι «ένας ή τρεις»

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): ΣΥΜΦΩΝΕΙ — (Α), μαζί με τα Υ-8/Υ-9.**

> ### 🔑 Ό,τι είναι **ιεραρχικό** ⇒ **ένα μονοπάτι**. Ό,τι είναι **κάθετο** ⇒ **δικό του χειριστήριο**.

| # | Τι | Γιατί |
|---|---|---|
| 1️⃣ | **Ένα μονοπάτι**: *Εταιρεία Β › Βίλα Σούνιο*· κάθε τμήμα ανοίγει λίστα με **αναζήτηση + πρόσφατα** | Οργανισμός και έργο απαντούν στο **ίδιο** ερώτημα («πού είμαι») και το ένα **περιέχει** το άλλο (§6.10) |
| 2️⃣ | **Η δουλειά ΕΞΩ από το μονοπάτι** — δικό της, μόνιμα ορατό χειριστήριο | Η δουλειά είναι **τρόπος**, όχι τόπος (**Α-5**). Μέσα στο μονοπάτι θα διαβαζόταν ως φάκελος· έξω, φαίνεται ότι **σε ακολουθεί παντού** (Ε1.β) |
| 3️⃣ | **Ctrl+K** — γράφεις *«σούνιο εργοτάξιο»*, αλλάζουν **και οι τρεις** συντεταγμένες | **Υ-8** — κανένας από τους τέσσερις δεν το έχει |
| 4️⃣ | Αλλαγή οργανισμού ⇒ **ορατή αλλαγή όψης** του κελύφους | **Υ-9** — το «δούλεψα σε λάθος εταιρεία» είναι το ακριβότερο λάθος του μοντέλου |

#### Ε-6.3 🔴 Η ονοματολογία **κλειδώνει εδώ** — αλλιώς φτιάχνουμε **πέμπτο** λεξιλόγιο

Ο όρος **`Workspace` / «χώρος εργασίας» είναι ΗΔΗ ΠΙΑΣΜΕΝΟΣ** (ADR-032) και σημαίνει
**οργανισμό** — άξονας 1. Ο **τίτλος αυτού του ADR** τον χρησιμοποιεί για τη **δουλειά** —
άξονας 3. Αν ο κώδικας ακολουθήσει τον τίτλο, η παθολογία του §3 *(τέσσερα λεξιλόγια που
ανακατεύουν διαφορετικά πράγματα)* **αναπαράγεται σε νέα διάσταση**.

**Κλειδωμένες συνέπειες:**

| # | Συνέπεια |
|---|---|
| Ε6.α | Οι **δύο άξονες του «πού»** *(οργανισμός · έργο)* ζουν σε **ΕΝΑ** μονοπάτι· κάθε τμήμα = λίστα με **αναζήτηση + πρόσφατα**. **Ποτέ δύο ανεξάρτητα κουτιά δίπλα-δίπλα** (το λάθος της AWS, §6.10) |
| Ε6.β | Η **δουλειά ΔΕΝ μπαίνει ΠΟΤΕ** στο μονοπάτι — **δικό της**, οπτικά διαφορετικό, **μόνιμα ορατό** χειριστήριο (πρότυπο: Figma Dev Mode · γρανάζι AutoCAD) |
| Ε6.γ | **Ctrl+K**: ενιαία εναλλαγή και των **τριών** με πληκτρολόγηση (**Υ-8**). Το μονοπάτι μένει για το ποντίκι — **δεν αντικαθίσταται** |
| Ε6.δ | Αλλαγή οργανισμού ⇒ **ορατή αλλαγή όψης** του κελύφους, χρώμα + σήμα (**Υ-9**). **Fail-loud**, όχι διακριτικό |
| Ε6.ε | Το χειριστήριο της δουλειάς φέρει **δύο πράγματα ακόμη**: την **αλυσίδα αιτίασης** (*«…επειδή είσαι επιβλέπων στο Βίλα Σούνιο»*, Υ-6/Ε5.στ) και τον **δείκτη «Χ κρυμμένες»** (Ε5.ε) |
| Ε6.στ | 🔴 **ΟΝΟΜΑΤΟΛΟΓΙΑ**: `Workspace` = **οργανισμός** (ADR-032, αμετάβλητο). Η δουλειά λέγεται **«Δουλειά»** σε κώδικα και οθόνη — **ΠΟΤΕ** `Workspace`. Ο τίτλος του ADR μένει ως έχει για ιστορικούς λόγους· **η ορολογία του κώδικα είναι αυτή, όχι ο τίτλος** (Π-9) |
| Ε6.ζ | 🔴 **Ο άξονας 1 ΔΕΝ ξαναγράφεται.** Το `switchWorkspace()` **υπάρχει πλήρες** — **προάγεται**, δεν εφευρίσκεται (Π-8). Και το `WorkspaceType` περιέχει **ήδη** `'personal'` = η απόφαση Ε-2′ |
| Ε6.η | Οι **δύο** μηχανισμοί του άξονα 1 **ενοποιούνται σε έναν** (Π-10). Το `CompanySwitcher` γίνεται **ειδική περίπτωση** του ενιαίου διακόπτη *(ο super_admin βλέπει όλους τους οργανισμούς)* — **όχι δεύτερος δρόμος** |
| Ε6.θ | Ο άξονας 2 *(έργο)* αποκτά καθολικό επιλογέα — **αλλά** η αλλαγή έργου εξακολουθεί να **μην αλλάζει σιωπηλά** τη δουλειά· **προτείνει** (Ε1.γ′) |
| Ε6.ι | Το Ctrl+K **ΠΟΤΕ δεν προσθέτει δικαίωμα** — δείχνει **μόνο** ό,τι ο ζωντανός υπολογισμός του Ε-5 έχει ήδη επιτρέψει (χρυσός κανόνας §5, Ε5.η) |
| Ε6.κ | Η **φυσική θέση** των τριών στοιχείων στην οθόνη οριστικοποιείται στη **Φάση 4** — εδώ κλειδώνει η **δομή**, όχι το pixel |

---

### Ε-7 — Η **πρώτη μέρα**: τι βλέπει αυτός που δεν έχει ακόμη τίποτα;

**Το ερώτημα** *(Υ-1, «το κενό της πρώτης μέρας»)*: ποια δουλειά προεπιλέγεται, πώς το
δηλώνει ο χρήστης, και τι βλέπει όποιος έχει **μηδέν** δουλειές.

> ⚠️ Ο Γιώργος απάντησε ρητά *«δεν ξέρω — κάνε έρευνα»*. Η απάντηση προέκυψε από τη
> **§6.11** (τέταρτη έρευνα) **και** από τη **§2.8** (μέτρηση του σημερινού κώδικα).

#### Ε-7.1 Το εύρημα που καθόρισε τα πάντα: **το πρόβλημα υπάρχει ήδη, γραμμένο από εμάς**

Το §2.8 το μέτρησε: με το **ADR-660** ο νέος χρήστης είναι **pending, χωρίς τίποτα** ⇒ ο
ζωντανός υπολογισμός του Ε-5 δίνει **μηδέν δουλειές** ⇒ **κενή οθόνη και αναμονή ανθρώπου**.
Είναι **κατά γράμμα** το τεκμηριωμένο ελάττωμα του ACC (§6.11.1) — γραμμένο όμως από εμάς,
για **σωστό** λόγο (σκλήρυνση αυτο-εγγραφής), χωρίς να φανεί η συνέπεια στην εμπειρία.

#### Ε-7.2 Η σύγκλιση: η απόφαση για το **όραμα** ήταν ήδη η απάντηση για την **πρώτη μέρα**

> *«The best B2B flows (Notion, Linear, Figma) **start individuals in a template workspace
> and defer team setup**»* (§6.11.3)

Είναι **κατά λέξη το Ε-2′ + Ε-3**. Δύο ανεξάρτητοι δρόμοι — το όραμα του §0 και η έρευνα
onboarding — κατέληξαν στο **ίδιο** σημείο. Το Ε-7 δεν εφευρίσκει τίποτα: **αφαιρεί ένα
εμπόδιο** μπροστά από απόφαση που είχε ήδη ληφθεί.

**✅ ΑΠΑΝΤΗΣΗ ΓΙΩΡΓΟΥ (2026-08-02): (Α) — «κανείς δεν περιμένει ποτέ».**

> ### 🔑 Ο προσωπικός χώρος δίνεται **αμέσως**. Η έγκριση admin αφορά **ΜΟΝΟ** την είσοδο σε **ΞΕΝΟ** οργανισμό.
>
> Η ασφάλεια **δεν μειώνεται κατά τίποτα**: στον δικό του χώρο **δεν υπάρχει ξένο δεδομένο
> να προστατευθεί**. Αλλάζει **τι βλέπει όσο περιμένει** — όχι **τι δικαιούται**.

**Κλειδωμένες συνέπειες:**

| # | Συνέπεια |
|---|---|
| Ε7.α | 🔴 **Το «μηδέν δουλειές» ΠΑΥΕΙ ΝΑ ΥΠΑΡΧΕΙ ως κατάσταση.** Ο άξονας 1 έχει **πάντα** ≥1 τιμή (ο προσωπικός οργανισμός, Ε-2′), όπου ο ιδιοκτήτης παίρνει **και τις έξι** δουλειές από τον **ίδιο** υπολογισμό (Ε-3, Ε5.α). **Καμία ειδική περίπτωση στον κανόνα** |
| Ε7.β | **ΔΥΟ διαφορετικές πρώτες μέρες**: ο **προσκεκλημένος** προσγειώνεται **στο έργο της πρόσκλησης**, με ορατή την **αιτία** (Υ-6): *«σε προσκάλεσε ο Χ ως επιβλέποντα στο Βίλα Σούνιο»*· ο **αυτο-εγγεγραμμένος** στον **δικό του** χώρο |
| Ε7.γ | **ΜΙΑ ερώτηση**, **μετά** το login, **προαιρετική**: *«τι δουλειά κάνεις;»* ⇒ **προτείνει** αρχική δουλειά (Α-1, Ε1.ε). **Ποτέ πριν** το login (§4). **Ποτέ κλείδωμα** — αλλάζει από το χειριστήριο του Ε-6 |
| Ε7.δ | **Παράλειψη ⇒ πάντα υπάρχει προεπιλογή** *(κανόνας Revit, §6.11.2)*: η δουλειά με τα **περισσότερα δικαιώματα**· σε ισοβαθμία, η **σταθερή σειρά** του μητρώου της Φάσης 1. **Υπολογισμένη, όχι hardcoded** |
| Ε7.ε | **Καμία κενή οθόνη πουθενά.** Κάθε άδεια δουλειά δείχνει τα **τρία** του NN/g (§6.11.5): **πού είσαι · τι κάνει εδώ · ΜΙΑ επόμενη κίνηση** |
| Ε7.στ | **Καμία οθόνη αναμονής, πουθενά στο προϊόν** (**Υ-10**). Κανείς δεν περιμένει άνθρωπο για να ξεκινήσει |
| Ε7.ζ | 🔴 **Το ADR-660 περιορίζεται, δεν καταργείται**: η έγκριση admin ισχύει **ακέραιη** για είσοδο σε **ξένο** οργανισμό· **δεν** ισχύει για τον **προσωπικό** χώρο. Καμία πρόσβαση σε εταιρικά δεδομένα χωρίς έγκριση — όπως και σήμερα |
| Ε7.η | Η απάντηση στην ερώτηση του Ε7.γ **ΠΟΤΕ δεν δίνει δικαίωμα** — μόνο **προεπιλέγει** (χρυσός κανόνας §5, Ε5.η) |
| Ε7.θ | ⚠️ **Το ADR-660 τροποποιείται ΟΤΑΝ γραφτεί ο κώδικας**, όχι τώρα. Μέχρι τότε **ο κώδικας είναι η αλήθεια** (N.0.1) και το ADR-660 περιγράφει σωστά ό,τι τρέχει σήμερα |
| Ε7.ι | ⚠️ **Η έγκριση admin δεν αρκεί από μόνη της**: ο `external_user` έχει **2** permissions που τα έχουν σχεδόν όλοι ⇒ **πάλι μηδέν δουλειές** στην εταιρεία. Η έγκριση **πρέπει** να συνοδεύεται από ρόλο ή ένταξη σε έργο, αλλιώς το κενό επιστρέφει από την πίσω πόρτα *(⇒ Π-12)* |

---

## 10. Σταδιακή πορεία (προσχέδιο — οριστικοποιείται μετά το §9)

| Φάση | Τι | Μέγεθος | Γιατί εκεί στη σειρά |
|---|---|---|---|
| **0** ✅ | Ευρήματα + διευκρινίσεις **Ε-1…Ε-7** + **ο πίνακας «ποιος βλέπει τι» (§14)**. Καμία γραμμή κώδικα | αυτό το ADR | **ΕΚΛΕΙΣΕ 2026-08-02.** Χωρίς αυτό, ό,τι χτιστεί θα ξαναγραφτεί |
| **1** | Μητρώο **δουλειών** (SSoT· ορολογία Ε6.στ — **όχι** `Workspace`): ένα αρχείο, δεδομένα, μηδέν λογική | 1 αρχείο | Το θεμέλιο |
| **2** | Φίλτρο ribbon στον DXF viewer | ~2 αρχεία | **Μέγιστο κέρδος, ελάχιστο κόστος** — τα tabs είναι ήδη ανά ειδικότητα (§2.5) |
| **3** | Sidebar + dashboard tiles: συμπλήρωση tags σε 12+12 στοιχεία | ~3 αρχεία | Ο μηχανισμός υπάρχει (§2.1), λείπουν μόνο δεδομένα |
| **3.5** | **Η πρώτη μέρα** (Ε-7): προσωπικός χώρος από την εγγραφή · προσγείωση προσκεκλημένου στο έργο του · **μία** προαιρετική ερώτηση · κενές οθόνες κατά NN/g. ⚠️ **Εδώ τροποποιείται το ADR-660** (Ε7.ζ/Ε7.θ) και **εδώ πεθαίνει το Π-11** | ~3 αρχεία + ADR-660 | Πριν τον επιλογέα: δεν έχει νόημα επιλογέας αν ο μισός κόσμος βλέπει κενό |
| **4** | **Ο επιλογέας της τριάδας** (Ε-6): μονοπάτι *οργανισμός › έργο* + χειριστήριο δουλειάς + Ctrl+K + όψη ανά οργανισμό. ⚠️ **Προαγωγή** του υπάρχοντος `switchWorkspace()` και **ενοποίηση** με το `CompanySwitcher` (Ε6.ζ/Ε6.η) — **όχι** νέος μηχανισμός | ~4 αρχεία | Έχει νόημα μόνο αφού υπάρχουν δουλειές να διαλέξεις. Εδώ πεθαίνει το Π-8 |
| **5** | Public landing ανά ειδικότητα, **πριν** το login | ~2 αρχεία | Marketing· ανεξάρτητο· όποτε θέλει ο Γιώργος |
| **6** | Route guards στα 138 απροστάτευτα routes + κατάργηση του legacy `UserRole` | εκστρατεία | Ασφάλεια — **ξεχωριστή δουλειά**, όχι μέρος αυτού |

Οι φάσεις 1–4 είναι όλες αναστρέψιμες και **καμία δεν αγγίζει permissions ή Firestore rules**.

---

## 11. Το δομικό εμπόδιο του οράματος: **ένας άνθρωπος = μία εταιρεία**

### 11.1 Το εύρημα — επαληθευμένο στον κώδικα, 2026-08-02

`src/lib/auth/types.ts` :

```typescript
export interface CustomClaims {
  companyId: string;      // ← ΕΝΑ. Όχι πίνακας.
  globalRole: GlobalRole;
  ...
}
```

Ο **μοναδικός** τρόπος να δει κανείς άλλη εταιρεία σήμερα είναι το
`resolveEffectiveCompanyId()` (`src/lib/auth/auth-context.ts:41`): διαβάζει το header
`x-super-admin-company-id` — αλλά **μόνο** αν `isRoleBypass(claims.globalRole)`, δηλαδή
**μόνο ο υπερδιαχειριστής**. Είναι μηχανισμός break-glass (ADR-354), **όχι συμμετοχή**.

> **Συνέπεια: τα Σ-1, Σ-2, Σ-3 του §0.2 δεν είναι δύσκολα σήμερα — είναι αδύνατα.**
> Και δεν είναι θέμα διεπαφής· είναι το θεμέλιο της ταυτότητας.

### 11.2 Η καλή είδηση: τα δεδομένα είναι ήδη σωστά

Κάθε έγγραφο φέρει `companyId` και φυλάσσεται από tenant isolation (ADR-702, ADR-747,
CHECK 3.35, firestore.rules 3.490 γραμμές). **Αυτή ακριβώς είναι η σωστή βάση** για
πολλαπλούς οργανισμούς — το κυρίαρχο μοντέλο της αγοράς (*shared database με row-level
isolation, ένα `org_id` σε κάθε πίνακα*) είναι ό,τι ήδη τρέχει.

**Δεν χρειάζεται να ξαναγραφτεί ούτε ένα έγγραφο.** Αλλάζει **ποιος** `companyId` είναι
ενεργός — όχι η δομή.

### 11.3 Το μοντέλο-στόχος: τέσσερα ανεξάρτητα επίπεδα

Σήμερα τα επίπεδα 1–3 είναι **συγχωνευμένα σε ένα claim**. Ο διαχωρισμός τους είναι όλη η
δουλειά:

| # | Επίπεδο | Πληθυσμός | Τι κρατά |
|---|---|---|---|
| **1** | **Άνθρωπος** *(Person)* | ένας, για πάντα | email, όνομα, επαγγελματική ιδιότητα. **Μηδέν δικαιώματα** |
| **2** | **Οργανισμός** *(Tenant)* | πολλοί | εταιρεία **ή** γραφείο ελεύθερου επαγγελματία («εταιρεία ενός ατόμου») |
| **3** | **Συμμετοχή** *(Membership)* | **N ανά άνθρωπο** | η σχέση ανθρώπου↔οργανισμού. **ΕΔΩ ζει ο ρόλος και τα δικαιώματα** |
| **4** | **Χώρος εργασίας** *(Workspace)* | N ανά συμμετοχή | τι **βλέπει** — το αντικείμενο των §5–§8 |

Με αυτό, τα τρία σενάρια λύνονται **χωρίς καμία ειδική περίπτωση**:

- **Σ-1** → δύο συμμετοχές, δύο ρόλοι
- **Σ-2** → τρίτη συμμετοχή στον tenant του πωλητή, με ρόλο «πελάτης»
- **Σ-3** → ο **προσωπικός tenant** του Νίκου· εκεί ζουν CRM, λογιστικά, ιστοσελίδα

### 11.4 ⚠️ Το CRM «ανάμεσα στις εταιρείες» — νομικό πριν γίνει τεχνικό

Ο Γιώργος ζήτησε το CRM του αρχιτέκτονα «ανάμεσα στις διάφορες εταιρείες». Κρίσιμη
διάκριση, με συνέπειες GDPR:

| Δεδομένο | Ιδιοκτήτης | Πού ζει |
|---|---|---|
| Πελάτες που ο Νίκος γνώρισε **μέσω** της εταιρείας Α | **η εταιρεία Α** | tenant Α |
| Δικοί του πελάτες, κοινωνικά δίκτυα, αναρτήσεις, ιστοσελίδα | **ο Νίκος** | προσωπικός tenant |

**Το «ενιαίο CRM» ΔΕΝ σημαίνει κοινή δεξαμενή επαφών.** Σημαίνει **μία οθόνη που δείχνει
δίπλα-δίπλα** τα δικά του και όσα του έχουν **ρητά παραχωρηθεί** — με ορατή την προέλευση
κάθε εγγραφής. Αλλιώς είναι εξαγωγή πελατολογίου, με ό,τι αυτό συνεπάγεται νομικά.

### 11.5 ⚠️ Το επικίνδυνο σημείο: «όχι με email, μέσα από τον Νέστορα»

Ο συγχρονισμός μεταξύ επαγγελματιών απαιτεί **ελεγχόμενο σπάσιμο** της στεγανοποίησης που
φυλάνε σήμερα τα ADR-702/747. Οι μεγάλοι το λύνουν **όλοι με τον ίδιο τρόπο** — ρητή,
ανακλητή, χρονικά περιορισμένη **παραχώρηση**, ποτέ αντιγραφή:

| Πλατφόρμα | Μηχανισμός | Το κρίσιμο χαρακτηριστικό |
|---|---|---|
| **Slack Connect** | shared channels, έως 20 οργανισμοί | Έγκριση διαχειριστή· ρυθμίζεται τι βλέπουν και ποιος προσκαλεί |
| **Figma** | connected projects | Και οι δύο δημιουργούν/μετακινούν — **μόνο ο οικοδεσπότης αφαιρεί** |
| **Microsoft Entra B2B** | guest users | Ο guest αυθεντικοποιείται στον **δικό του** οργανισμό· παίρνει ελεγχόμενη πρόσβαση στον ξένο |

🔑 **Ο Νέστωρ έχει ΗΔΗ το σωστό μοτίβο** — `PropertyGrant` (`src/lib/auth/types.ts`):
`scopes[]` · `expiresAt` **υποχρεωτικό** · `reason` · `revokedAt`/`revokedBy`. Είναι
ακριβώς το σχήμα «ρητή, χρονικά περιορισμένη, ανακλητή παραχώρηση» — εφαρμοσμένο σήμερα
**μόνο στα ακίνητα**. Η επέκτασή του είναι **γενίκευση υπάρχοντος μοτίβου**, όχι νέα
εφεύρεση.

### 11.6 🔧 Η απόφαση που κοστίζει σχεδόν τίποτα σήμερα και σώζει μήνες αργότερα

> **Από σήμερα, κανένας νέος κώδικας δεν διαβάζει `claims.companyId` απευθείας.**
> Τα πάντα περνούν από **μία** συνάρτηση: `getActiveCompanyId(ctx)`.
> Σήμερα επιστρέφει το claim. Αύριο επιστρέφει την **ενεργή συμμετοχή**.
> **Ένα σημείο αλλαγής αντί για εκατοντάδες.**

Η ραφή **υπάρχει ήδη μερικώς**: το `resolveEffectiveCompanyId()` κάνει ακριβώς αυτό για τον
υπερδιαχειριστή. Χρειάζεται **προαγωγή σε καθολικό SSoT**, όχι δημιουργία.

Αυτό είναι το μοναδικό πράγμα από το όραμα που πρέπει να γίνει **τώρα**. Όλα τα υπόλοιπα
περιμένουν — αυτό όχι, γιατί κάθε νέα γραμμή που διαβάζει το claim απευθείας είναι μια
γραμμή που θα ξαναγραφτεί.

---

## 12. Παράπλευρα ευρήματα (καταγράφονται, δεν διορθώνονται εδώ)

| # | Εύρημα | Πού |
|---|---|---|
| Π-1 | `featureFlag` δηλώνεται αλλά δεν ελέγχεται ποτέ — νεκρό config | `smart-navigation-factory.ts` §2.2 |
| Π-2 | Τρίτο, περιττό λεξιλόγιο ρόλων (`admin`/`authenticated`/`public`) | `ProtectedRoute.tsx` §3 |
| Π-3 | 138/140 routes χωρίς client-side guard | §2.6 |
| Π-4 | `claims.companyId` = **ένα** string· η ραφή `resolveEffectiveCompanyId()` υπάρχει αλλά μόνο για bypass ρόλο | §11.1, §11.6 |
| Π-5 | Το **CLAUDE.md λέει «10 roles»** για το `src/lib/auth/roles.ts` — είναι **13** (μετρημένο 2026-08-02: 4 global + 9 project). Κλασικό «μπαγιάτικος αριθμός σε έγγραφο» (κανόνας N.12) | `roles.ts`, Ε-4.2 |
| Π-6 | `architect` και `engineer` διαφέρουν κατά **ένα** permission (`specs:specs:view`) στα 23. Είτε ο ένας είναι περιττός, είτε λείπουν permissions από τον έναν — **κανείς δεν το είχε παρατηρήσει** | `roles.ts`, Ε-4.4 |
| Π-12 | ⚠️ **Η έγκριση admin δεν κλείνει το κενό**: μετά την έγκριση ο χρήστης γίνεται `external_user` με **2** permissions (`projects:view`, `properties:view`) — που τα έχουν σχεδόν όλοι ⇒ **μηδέν δουλειές** στην εταιρεία. Χρειάζεται **ρόλος ή ένταξη σε έργο** μαζί με την έγκριση | `roles.ts`, Ε7.ι |
| Π-11 | 🔴 **Ρητή ένταση ADR-660 ↔ Ε-2′**: το ADR-660 δημιουργεί τον νέο χρήστη **pending, χωρίς claims/companyId/member doc** μέχρι έγκριση admin· το Ε-2′ λέει **«προσωπικός οργανισμός από την εγγραφή»**. Με τον υπολογισμό του Ε-5 ⇒ **μηδέν δουλειές** ⇒ κατά γράμμα το ελάττωμα του ACC. **Δεν συμβιβάζονται σιωπηλά** — λύνεται ονομαστικά στο Ε-7 | `complete-registration/route.ts`, §2.8 |
| Π-8 | 🔴 **`switchWorkspace()` = 0 καλούντες σε όλο το `src/`** — πλήρης μηχανισμός εναλλαγής οργανισμού (persistence, event, realtime) **χωρίς κανένα κουμπί**. Ο ενεργός οργανισμός αλλάζει **μόνο** από το fallback «πρώτος της λίστας». Κλασικό «feature σε container που κανείς δεν καλεί = νεκρό» | `WorkspaceContext.tsx:195`, §2.7α |
| Π-9 | 🔴 **Σύγκρουση ονοματολογίας**: `Workspace` στον κώδικα = **οργανισμός** (ADR-032, `'company'\|'office_directory'\|'personal'`)· «χώρος εργασίας» στον τίτλο αυτού του ADR = **δουλειά**. Ονομασία της δουλειάς ως `Workspace` ⇒ **πέμπτο λεξιλόγιο** (παθολογία §3) | `types/workspace.ts:40`, §2.7ε |
| Π-10 | Δύο ανταγωνιστικοί μηχανισμοί για τον **ίδιο** άξονα 1: `CompanySwitcher` (UI, μόνο super_admin, `SuperAdminCompanyContext`) και `WorkspaceContext` (γενικός, χωρίς UI). **Καμία** από τις δύο δεν συνδέεται με το `claims.companyId` | `CompanySwitcher.tsx`, §2.7γ |
| Π-7 | 🔴 Ο **`company_admin` δεν έχει `finance:invoices`** — ούτε `photos`/`progress`, ούτε `orders`/`deliveries`. Ο διαχειριστής της εταιρείας **δεν βλέπει τα Οικονομικά της**. Το αποκάλυψε ο υπολογισμός του Ε-5 με την πρώτη δοκιμή — απόδειξη ότι **η υπολογισμένη λίστα δείχνει αμέσως τι λείπει**, ενώ χειρόγραφος πίνακας θα το έκρυβε για χρόνια | `roles.ts`, Ε5.θ |

---

## 13. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-08-02 | **📋 Ο ΠΙΝΑΚΑΣ «ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙ» ΓΡΑΦΤΗΚΕ (νέο §14) ⇒ Η ΦΑΣΗ 0 ΕΚΛΕΙΣΕ.** Σύνθεση Ε-4×Ε-5 πάνω στις **τρεις πραγματικές λίστες**: 16 ribbon tabs · 17 sidebar πρώτου επιπέδου (+~40 υπο) · 12 πλακίδια. **Τέσσερα ευρήματα**: **(1)** το `/reports` είναι **εγκάρσιο** — τα 11 υπο-στοιχεία του ανήκουν σε **πέντε** δουλειές ⇒ δεν φιλτράρεται ως ένα· **(2)** το `/legal-documents` έχει **ρητά αφαιρεμένο** permission (*«accessible to all users»*) ⇒ **δεν μπορεί** να φιλτραριστεί από τον υπολογισμό — χρειάζεται απόφαση· **(3)** **Εργοτάξιο** και **Προμήθειες** έχουν **1 στοιχείο sidebar και 0 πλακίδια** η καθεμιά — οπτική επιβεβαίωση του Ε4.στ *(αληθινές αλλά ανώριμες)*· **(4)** και τα **8** υπάρχοντα φίλτρα είναι `admin_access` ⇒ **μόνο η Διαχείριση** φιλτράρεται σήμερα· οι άλλες πέντε θέλουν **δεδομένα, όχι μηχανισμό**. **§14.5**: οι αναθέσεις είναι **ετικέτες ορατότητας, όχι δικαιώματα** — αφαιρούν θόρυβο, **ποτέ** δεν προσθέτουν πρόσβαση. Δύο αποφάσεις μετατίθενται ρητά στη **Φάση 1** (`/reports`, `/legal-documents`). |
| 2026-08-02 | **Ε-7 ΑΠΑΝΤΗΘΗΚΕ ⇒ (Α) «κανείς δεν περιμένει ποτέ»** — **η Φάση 0 έκλεισε ως προς τα θεμελιώδη**. Ο Γιώργος απάντησε ρητά *«δεν ξέρω — κάνε έρευνα»* ⇒ **τέταρτη έρευνα** (νέο **§6.11**, 10 πηγές). 🔴 **Το καθοριστικό δεν ήταν η έρευνα αλλά η μέτρηση** (νέο **§2.8**): με το **ADR-660** ο νέος χρήστης είναι **pending χωρίς claims/companyId/member doc** ⇒ ο υπολογισμός του Ε-5 δίνει **ΜΗΔΕΝ δουλειές** ⇒ **κενή οθόνη + αναμονή ανθρώπου** = **κατά γράμμα το ελάττωμα του ACC**, γραμμένο όμως **από εμάς** (Π-11). 🔑 **Σύγκλιση**: *«Notion/Linear/Figma start individuals in a template workspace and defer team setup»* = **κατά λέξη το Ε-2′+Ε-3** — το όραμα του §0 και η έρευνα onboarding κατέληξαν **ανεξάρτητα** στο ίδιο σημείο· το Ε-7 **αφαιρεί εμπόδιο**, δεν εφευρίσκει. Κανόνας **Revit**: *«if you do not select a discipline, an appropriate default is used»* ⇒ **πάντα προεπιλογή, ποτέ μπλοκάρισμα** (Ε7.δ). Έρευνα onboarding: **ΜΙΑ** ερώτηση (+30–50% ενεργοποίηση· −10–15% ανά επιπλέον· πάντα με παράλειψη). **NN/g**: το κενό δοχείο **δεν είναι ουδέτερο** (Ε7.ε). Κλειδώθηκαν **Ε7.α–Ε7.ι**, με κρισιμότερο το **Ε7.ζ**: το **ADR-660 περιορίζεται, δεν καταργείται** — έγκριση admin **μόνο** για **ξένο** οργανισμό· ο **προσωπικός** χώρος δίνεται αμέσως, γιατί εκεί **δεν υπάρχει ξένο δεδομένο να προστατευθεί** *(η ασφάλεια δεν μειώνεται κατά τίποτα)*. Νέο **Υ-10** (καμία οθόνη αναμονής πουθενά). Νέο **Π-12**: η έγκριση **δεν αρκεί** — ο `external_user` έχει 2 permissions ⇒ πάλι μηδέν δουλειές. **§10: νέα Φάση 3.5**. |
| 2026-08-02 | **Ε-6 ΑΠΑΝΤΗΘΗΚΕ ⇒ «δύο + ένα»**, μετά από **τρίτη έρευνα αγοράς** (νέο **§6.10**, 6 πηγές, τρίτο διαφορετικό ερώτημα: *πώς μετακινείσαι ανάμεσα σε συντεταγμένες*). Κανόνας: **ό,τι είναι ιεραρχικό ⇒ ένα μονοπάτι· ό,τι είναι κάθετο ⇒ δικό του χειριστήριο**. Οργανισμός › έργο σε **ΕΝΑ** μονοπάτι (Vercel/Supabase/GitHub/GCloud)· η **δουλειά ΕΞΩ** από αυτό, γιατί είναι **τρόπος όχι τόπος** (Figma Dev Mode, γρανάζι AutoCAD, Α-5). 🔴 Το αντι-παράδειγμα είναι η **AWS**: δύο ανεξάρτητα κουτιά που **δεν δείχνουν τη σχέση τους** ⇒ «λάθος λογαριασμός»· πρόσθεσαν **χρώμα ανά λογαριασμό μόλις το 2026** ⇒ **Υ-9** (fail-loud όψη ανά οργανισμό, από την πρώτη μέρα). **Υ-8**: **Ctrl+K** — κανένα CAD δεν σε αφήνει να **γράψεις** πού πας. Κλειδώθηκαν **Ε6.α–Ε6.κ**, με σημαντικότερα: **Ε6.στ** 🔴 η **ονοματολογία** (`Workspace` = **οργανισμός**, η δουλειά = **«Δουλειά»** — αλλιώς **πέμπτο λεξιλόγιο**, Π-9)· **Ε6.ζ** ο άξονας 1 **ΔΕΝ ξαναγράφεται** (προαγωγή του νεκρού `switchWorkspace()`, Π-8)· **Ε6.η** ενοποίηση των δύο μηχανισμών (Π-10). **§10 Φάση 1 & 4 αναθεωρήθηκαν** αναλόγως. |
| 2026-08-02 | **Νέο §2.7 — μετρημένα ευρήματα για το Ε-6** *(πριν τεθεί η ερώτηση, όχι μετά)*. Η υπόθεση «δεν υπάρχει μηχανισμός εναλλαγής» είναι **λάθος**: υπάρχουν **δύο**, και δεν γνωρίζονται. 🔴 **Π-8**: το `switchWorkspace()` (ADR-032) έχει **0 καλούντες** — provider προσαρτημένος, persistence, events, realtime… και **κανένα κουμπί**· ο ενεργός οργανισμός αλλάζει μόνο από το fallback «πρώτος της λίστας». 🔴 **Π-9**: **σύγκρουση ονοματολογίας** — `Workspace` = **οργανισμός** στον κώδικα, «χώρος εργασίας» = **δουλειά** στον τίτλο του ADR ⇒ κίνδυνος **πέμπτου λεξιλογίου**. **Π-10**: `CompanySwitcher` (UI χωρίς γενικότητα) vs `WorkspaceContext` (γενικότητα χωρίς UI), καμία συνδεδεμένη με το `claims.companyId`. **Τέταρτο «το σωστό μοτίβο υπάρχει ήδη»**: το `WorkspaceType` περιέχει **ήδη** `'personal'` — κατά λέξη η απόφαση Ε-2′, γραμμένη πριν τεθεί το ερώτημα. Ο άξονας 2 (έργο) **δεν έχει** καθολικό επιλογέα· το `ProjectHierarchyContext` είναι μόνο του DXF. |
| 2026-08-02 | **Ε-5 ΑΠΑΝΤΗΘΗΚΕ ⇒ (Γ) «με τον τρόπο της Figma, όχι του Autodesk»**, μετά από **δεύτερη έρευνα αγοράς** (νέο **§6.9**, 5 πηγές) με **διαφορετικό ερώτημα** από την πρώτη: όχι «πώς οργανώνουν το UI» αλλά «πώς αποφασίζουν ποιος βλέπει τι όταν τα δικαιώματα ζουν σε πολλά επίπεδα». **Η έρευνα ανέτρεψε την αρχική πρόταση (Α)**: οι μεγάλοι κάνουν **(Γ)** — ACC default+override, Figma κληρονομιά+εξαίρεση. Καθοριστικό εύρημα: 🔴 **στον ACC η παράκαμψη είναι ΑΝΤΙΓΡΑΦΗ** (*«will not affect access to existing projects»*) ⇒ σιωπηλή απόκλιση για πάντα· η **Figma** το κάνει σωστά με ζωντανή κληρονομιά. Δεύτερο: **seat ≠ permission** (Figma) = το ήδη υπάρχον `decideAssetPackAccess()`. Τρίτο: **ReBAC/Zanzibar** λύνει το **role explosion** — ακριβώς η παθολογία του §3 — αλλά **ΔΕΝ εγκαθίσταται** (SpiceDB/OpenFGA = υπερβολή για pre-production· υιοθετείται μόνο το **σχήμα δεδομένων**, Ε-5.2). Τέταρτο: **derived roles / policy-as-code** (Cerbos) = η αρχική ιδέα με βιβλιογραφία. Πέμπτο: το φιλτράρισμα UI είναι **UX, όχι ασφάλεια** — επιβεβαιώνει τον χρυσό κανόνα §5. Νέα **Υ-5/Υ-6/Υ-7** στο §8 (καμία αντιγραφή ποτέ · ορατή αλυσίδα αιτίασης · gate συνέπειας). Κλειδώθηκαν **Ε5.α–Ε5.θ**. Νέο **Π-7**: ο υπολογισμός αποκάλυψε με την πρώτη δοκιμή ότι ο `company_admin` **δεν έχει `finance:invoices`**. |
| 2026-08-02 | **Ε-1.ΑΝΑΘ — τα Ε1.γ/Ε1.δ ΑΝΑΘΕΩΡΗΘΗΚΑΝ** μετά από σενάριο του Γιώργου: *ο ίδιος άνθρωπος, ίδια εταιρεία, **μελετητής στο ένα έργο και επιβλέπων στο άλλο***. Το αρχικό Ε1.γ («η αλλαγή έργου δεν αλλάζει τον χώρο, μόνο γκριζάρει κουμπιά») άφηνε τον Νίκο να κοιτάζει **άδειο σχεδιαστήριο** ενώ χρειαζόταν το Εργοτάξιο. Ρίζα: το Ε1.γ γράφτηκε **πριν** το Ε-4 ανακαλύψει τη διάκριση **δουλειά/στάθμη/εύρος** — και η διάκριση δεν εφαρμόστηκε αναδρομικά. Νέα: **Ε1.γ′** (πρόταση αλλαγής, ποτέ αυτόματα)· **Ε1.δ′** (το «ανενεργό με εξήγηση» ισχύει μόνο για διαφορά **στάθμης**)· **Ε1.ζ** — 🔴 τα δικαιώματα έρχονται από **ΔΥΟ πηγές** (`GlobalRole` + `ProjectRole`) και η λίστα δουλειών είναι η **ΕΝΩΣΗ** τους, κάτι που η πρώτη διατύπωση του Ε-5 αγνοούσε· **Ε1.η**. Το **Ε4.η → Ε4.η′**: ο προσδιορισμός θέσης είναι **τριάδα** *(οργανισμός, έργο, δουλειά)*, όχι ζεύγος. |
| 2026-08-02 | **Ε-4 ΑΠΑΝΤΗΘΗΚΕ — «πόσες δουλειές;» ⇒ ΕΞΙ** (Σχέδιο · Εργοτάξιο · Πελάτες · Οικονομικά · Προμήθειες · Διαχείριση), μετρημένες στα permission sets των **13** ρόλων, όχι θεωρητικά. Κλειδώθηκαν Ε4.α–Ε4.η. **Καταγράφηκε ρητά η πρώτη, λανθασμένη απόπειρα (Ε-4.0)**: έξι χώροι που ήταν τα τμήματα *μιας κατασκευαστικής* — απάντηση στο §1 αντί για το §0· ρίζα = ξανασυγχώνευση Συμμετοχής+Χώρου που το §11.3 είχε ήδη διαχωρίσει. Διόρθωση: **δύο άξονες** (οργανισμός × δουλειά), Ε4.η. Τρία ευρήματα από τον κώδικα: **(1)** `architect` vs `engineer` = **1 permission διαφορά στα 23** ⇒ ο κώδικας ήδη λέει «Σχέδιο = μία δουλειά + διακόπτης ειδικότητας» (Ε4.γ)· **(2)** οι **Προμήθειες** (`vendor`: `orders`+`deliveries`) είχαν παραλειφθεί ενώ είναι η πιο απομονωμένη δουλειά· **(3)** 4 ρόλοι δεν είναι δουλειές αλλά **στάθμη**/**εύρος** (νέο §3.1(γ)). **§5.1 ΑΝΑΘΕΩΡΗΘΗΚΕ** — οι γραμμές ήταν επαγγέλματα, παραβίαση της ήδη κλειδωμένης Α-5· τώρα είναι θέσεις διακόπτη. Η **έβδομη** δουλειά («Το κοινό μου», Σ-3) υπάρχει στο όραμα με **μηδέν** permissions — εκτός Φάσης 1, δεσμευμένη σε GDPR §11.4 (Ε4.ζ). Νέα παράπλευρα Π-5 (CLAUDE.md «10 roles» ενώ είναι 13) και Π-6. |
| 2026-08-02 | Δημιουργία. Φάση 0: ευρήματα §2–§4, αρχή «χώρος ≠ ρόλος» §5. Καμία γραμμή κώδικα. |
| 2026-08-02 | **Ε-3 + Ε-3.α ΑΠΑΝΤΗΘΗΚΑΝ** — (Α) πλήρης προσωπικός χώρος «ίδια δύναμη, όρια στην κλίμακα» (Ε3.α–Ε3.δ). Οικονομικό: τρία σκέλη, **με διόρθωση**: χρέωση **μόνο σε όποιον δημιουργεί**· θεατές/σχολιαστές/εξωτερικοί **δωρεάν** — αλλιώς καταρρέει το «όχι με email». Εγκρίθηκαν τα 4 σημεία, με σημαντικότερο το **(2): εγγραφή με πρόσκληση στην αρχή**. Τρίτο εύρημα «το σωστό μοτίβο υπάρχει ήδη»: `decideAssetPackAccess()` = entitlement ≠ permission, fail-closed (ADR-655). |
| 2026-08-02 | **Ε-2′ ΑΠΑΝΤΗΘΗΚΕ** — ο Γιώργος επέλεξε **(Β)**: ο λογαριασμός ανήκει στον άνθρωπο, προσωπικός οργανισμός από την εγγραφή. Κλειδώθηκαν Ε2.α–Ε2.ε, μαζί με το **ρητό κόστος** (ανοιχτή εγγραφή ⇒ επαλήθευση/anti-spam/όρια) και το **σημείο αναθεώρησης** `complete-registration`. Τέθηκε το Ε-3 (τι μπορεί να κάνει μόνος του). |
| 2026-08-02 | **ΤΟ ΟΡΑΜΑ ΑΠΟΚΑΛΥΦΘΗΚΕ** — ο Γιώργος περιέγραψε μετάβαση σε πολυ-οργανισμική πλατφόρμα ολόκληρου του τεχνικού κόσμου. Νέα §0 (όραμα + 3 σενάρια Σ-1/Σ-2/Σ-3) και **§11 (το δομικό εμπόδιο)**: `claims.companyId` είναι **ένα** string ⇒ και τα τρία σενάρια **αδύνατα** σήμερα· μοντέλο 4 επιπέδων· προειδοποίηση GDPR για το «CRM ανάμεσα στις εταιρείες»· cross-tenant μέσω γενίκευσης του υπάρχοντος `PropertyGrant`· **§11.6 η ραφή `getActiveCompanyId()`** — η μόνη ενέργεια που πρέπει να γίνει ΤΩΡΑ. Το Ε-2 αποσύρθηκε υπέρ του **Ε-2′ (ποιος κατέχει τον λογαριασμό)**. Αναρίθμηση §11→§12, §12→§13. |
| 2026-08-02 | **Ε-1 ΑΠΑΝΤΗΘΗΚΕ** — ο Γιώργος συμφώνησε με το (Γ). Κλειδώθηκαν οι 5 συνέπειες Ε1.α–Ε1.ε. Τέθηκε το Ε-2 (πόσοι χώροι) με το κριτήριο «δοκιμή της πρώτης οθόνης». |
| 2026-08-02 | **Έρευνα αγοράς** (εντολή Γιώργου: «όπως οι μεγάλοι παίκτες, και καλύτερα»). Νέα §6 (6 προϊόντα + 1 ιστορική αποτυχία, με πηγές), §7 (5 αρχές Α-1…Α-5), §8 (4 σημεία υπέρβασης Υ-1…Υ-4). Καθοριστικό εύρημα: **κανείς από τους έξι δεν κλειδώνει το UI στον ρόλο**. Το Ε-1 απαντήθηκε με πρόταση (Γ) — ούτε Α ούτε Β. Αναρίθμηση §7→§10, §8→§11, §9→§12. |

---

## 14. 📋 Ο ΠΙΝΑΚΑΣ «ΠΟΙΟΣ ΒΛΕΠΕΙ ΤΙ» — **το παραδοτέο της Φάσης 0**

> **Σύνθεση**, όχι νέα απόφαση: εφαρμογή των Ε-4 *(οι έξι δουλειές)* και Ε-5 *(ζωντανός
> υπολογισμός)* πάνω στις **τρεις πραγματικές λίστες** της εφαρμογής. Είναι η **είσοδος της
> Φάσης 1** — από εδώ γράφεται το μητρώο.

### 14.0 Οι τρεις λίστες — μετρημένες 2026-08-02

| Λίστα | Πηγή | Πλήθος |
|---|---|---|
| Ribbon tabs | `ui/ribbon/data/ribbon-default-tabs.ts` → `DEFAULT_RIBBON_TAB_ORDER` | **16** μόνιμα |
| Sidebar | `config/smart-navigation-factory.ts` | **17** πρώτου επιπέδου (+ ~40 υπο-στοιχεία) |
| Dashboard | `components/dashboard/DashboardHome.tsx` | **12** πλακίδια *(9 modules + 3 tools)* |
| Φίλτρα που υπάρχουν σήμερα | `smartConfig.permissions` | **8** — **όλα** `admin_access` |

### 14.1 Sidebar — 17 στοιχεία × 6 δουλειές

| # | Στοιχείο | Δουλειά(ές) | Σημείωση |
|---|---|---|---|
| 1 | `/` *(αρχική)* | **όλες** | Δείχνει τα πλακίδια **της ενεργής** δουλειάς (§14.2) |
| 2 | `/projects` | **όλες** | Είναι ο **άξονας 2** (Ε4.η′), όχι περιεχόμενο δουλειάς |
| 3 | `/properties` | **όλες** | `properties:view` = κοινό σε σχεδόν όλους (Ε-4.2) |
| 4 | `/files` | **όλες** | Αρχεία του ενεργού οργανισμού |
| 5 | `/dxf/viewer` | **Σχέδιο** | Ο διακόπτης ειδικότητας ζει **μέσα** του (§5.1) |
| 6 | `/geo/canvas` | **Σχέδιο** | Τοπογραφικό/χάρτης |
| 7 | `/buildings` | **Σχέδιο** · **Εργοτάξιο** | Το κτίριο μελετάται **και** χτίζεται |
| 8 | `/construction/portfolio` | **Εργοτάξιο** | 🔴 **Το ΜΟΝΟ** στοιχείο του Εργοταξίου |
| 9 | `/spaces` *(+4 υπο)* | **Πελάτες** · *(Σχέδιο δευτερευόντως)* | Πωλήσιμες μονάδες· μοντελοποιούνται στο BIM |
| 10 | `/sales` *(+5 υπο)* | **Πελάτες** | |
| 11 | `/crm` *(+11 υπο)* | **Πελάτες** | ⚠️ 2 υπο-στοιχεία (`ai-inbox`, `operator-inbox`) είναι **Διαχείριση** |
| 12 | `/contacts` | **Πελάτες** | ⚠️ GDPR: επαφές **του οργανισμού**, όχι κοινή δεξαμενή (§11.4) |
| 13 | `/accounting` *(+11 υπο)* | **Οικονομικά** | |
| 14 | `/procurement` | **Προμήθειες** | 🔴 **Το ΜΟΝΟ** στοιχείο των Προμηθειών |
| 15 | `/settings` *(+7 υπο)* | **όλες** *(η βάση)* · **Διαχείριση** *(τα 6 υπο με `admin_access`)* | Το μόνο σημείο όπου το φίλτρο **ήδη δουλεύει** |
| 16 | `/reports` *(+11 υπο)* | 🔴 **ΕΓΚΑΡΣΙΟ** — βλ. §14.4/(1) | Δεν ανήκει σε **καμία** μία δουλειά |
| 17 | `/legal-documents` | 🔴 **ΑΝΑΠΟΦΑΣΙΣΤΟ** — βλ. §14.4/(2) | Ρητά **χωρίς** permission στον κώδικα |

### 14.2 Dashboard — 12 πλακίδια × 6 δουλειές

| Δουλειά | Πλακίδια |
|---|---|
| **Σχέδιο** | `dxf/viewer` · `geo/canvas` · `buildings` |
| **Εργοτάξιο** | `buildings` *(κοινό με Σχέδιο)* — 🔴 **κανένα δικό του** |
| **Πελάτες** | `contacts` · `crm` · `sales` · `spaces` |
| **Οικονομικά** | `accounting` |
| **Προμήθειες** | 🔴 **κανένα** — το `/procurement` **δεν έχει πλακίδιο** |
| **Διαχείριση** | — *(οι ρυθμίσεις δεν είναι πλακίδιο)* |
| **όλες** | `properties` · `projects` · `files` · `legal-documents` |

### 14.3 Ribbon — 16 tabs: **ένας** χώρος, **επτά** θέσεις διακόπτη

Ο DXF viewer ανήκει **μόνο** στη δουλειά **«Σχέδιο»**. Στις **άλλες πέντε** δεν εμφανίζεται
καθόλου. Η κατανομή των 16 tabs στις θέσεις του διακόπτη ειδικότητας είναι **ήδη γραμμένη
στο §5.1** και δεν επαναλαμβάνεται εδώ. Περίληψη: **7 / 7 / 12 / 7 / 5 / 16** tabs ανά θέση
*(αρχιτεκτονικά · στατικά · ΗΛΜ · τοπογραφικά · παρουσίαση · όλα)*.

### 14.4 🔴 Τι αποκάλυψε ο πίνακας — **τέσσερα** ευρήματα

**(1) Το `/reports` είναι εγκάρσιο και δεν χωράει σε δουλειά.** Τα 11 υπο-στοιχεία του
ανήκουν σε **πέντε** διαφορετικές: `financial`+`cash-flow` ⇒ Οικονομικά · `construction` ⇒
Εργοτάξιο · `sales`+`crm`+`contacts` ⇒ Πελάτες · `spaces`+`projects` ⇒ κοινά ·
`compliance`+`export` ⇒ Διαχείριση. **Δεν φιλτράρεται ως ένα στοιχείο** — ή σπάει στα
υπο-στοιχεία του, ή κάθε δουλειά δείχνει **τη δική της** αναφορά. *Απόφαση Φάσης 1.*

**(2) Το `/legal-documents` έχει ρητά αφαιρεμένο permission** — σχόλιο στον κώδικα:
*«Removed permissions requirement — accessible to all users»*. Άρα σήμερα **δεν μπορεί** να
φιλτραριστεί από τον υπολογισμό του Ε-5: δεν υπάρχει δικαίωμα να διαβαστεί. Ή αποκτά
permission, ή δηλώνεται **κοινό σε όλες** τις δουλειές. *Απόφαση Φάσης 1.*

**(3) Δύο από τις έξι δουλειές έχουν σχεδόν μηδέν UI.** Το **Εργοτάξιο** έχει **1** στοιχείο
sidebar και **0** πλακίδια· οι **Προμήθειες** έχουν **1** στοιχείο και **0** πλακίδια. Είναι
η **οπτική επιβεβαίωση** του Ε4.στ *(«αληθινές αλλά ανώριμες»)*: το είχαμε μετρήσει στα
permissions (2 και 3), τώρα φαίνεται και στις οθόνες. **Ο χώρος τους δηλώνεται τώρα, γεμίζει
αργότερα** — δεν είναι λόγος να μην υπάρχουν.

**(4) Το φίλτρο δουλεύει ήδη — για μία δουλειά.** Και τα **8** υπάρχοντα `smartConfig.
permissions` είναι `admin_access`, δηλαδή **μόνο η Διαχείριση** φιλτράρεται σήμερα. Οι
άλλες πέντε δουλειές χρειάζονται **δεδομένα**, όχι μηχανισμό (§2.1).

### 14.5 Ο κανόνας που διέπει ΟΛΟΝ τον πίνακα

> 🔑 **Οι αναθέσεις αυτού του πίνακα ΔΕΝ είναι δικαιώματα.** Είναι **ετικέτες ορατότητας**.
> Ένα στοιχείο εμφανίζεται όταν *(α)* ανήκει στην **ενεργή** δουλειά **ΚΑΙ** *(β)* ο
> υπολογισμός του Ε-5 έχει ήδη δώσει το δικαίωμα. **Η ετικέτα μόνο αφαιρεί θόρυβο — ΠΟΤΕ δεν
> προσθέτει πρόσβαση** (§5, Ε5.η, §6.9.5).

