# ADR-871 — Sidebar στον προσωπικό χώρο: **ΝΑΙ, αλλά μόνο στα «δικά μου»**

| Πεδίο | Τιμή |
|---|---|
| **Category** | UI Components |
| **Status** | ACCEPTED — **ΥΛΟΠΟΙΗΜΕΝΟ** (2026-09-21, όχι ακόμη committed) |
| **Φάση** | υλοποίηση κατά §10· jest πράσινα· ζωντανή επαλήθευση desktop από τον Giorgio 2026-09-21 (§11) |
| **Date** | 2026-09-21 |
| **Προηγούμενα** | ADR-820 *(η πόρτα των δύο χώρων — `MySpacesSection`)* · ADR-777 §8.12 *(CHECK 3.52, σύνορο κελύφους)* · ADR-797 *(CHECK 3.63, διάδρομος κελύφους)* · ADR-809 *(CHECK 3.72, καθολικές δυνατότητες)* · ADR-787 *(CHECK 3.60/3.61, εμβέλεια χώρου / σύνορο πλοήγησης)* · ADR-748 *(φίλτρο ενεργής δουλειάς)* |
| **Αυθεντία** | ο κώδικας. Όπου αυτό το ADR διαφωνεί με τον κώδικα, κερδίζει ο κώδικας |

---

## 1. Το ερώτημα

> *«Στον χώρο του γραφείου υπάρχει sidebar· στον προσωπικό χώρο πλήρης απουσία. Ο προσωπικός
> χώρος μεγάλωσε — είναι σωστό να αποκτήσει κι αυτός sidebar, αντί να κινούμαστε σε λαβύρινθο;
> Θα το έκαναν οι μεγάλοι παίκτες;»* — Giorgio, 2026-09-21

**Απάντηση σε μία γραμμή:** **ΝΑΙ — υβριδικά.** Sidebar στις ιδιωτικές σελίδες «τα δικά μου»
(ομάδα `(me)`), **ΟΧΙ** στις δημόσιες σελίδες ανακάλυψης (ομάδα `(light)`: αναζήτηση, αγγελίες,
επαγγελματίες). Ίδιο *οπτικό* σύστημα με το γραφείο, **άλλο** περιεχόμενο.

---

## 2. Τι κάνουν οι μεγάλοι (έρευνα 2026-09-21)

### 2.1 Προσωπικός vs ομαδικός χώρος — **ίδιο κέλυφος, άλλο περιεχόμενο**

| Προϊόν | Εύρημα | Πηγή |
|---|---|---|
| **Notion** | «Private» και «Teamspaces» = ενότητες του **ίδιου** sidebar | [notion.com/help/intro-to-workspaces](https://www.notion.com/help/intro-to-workspaces) |
| **Linear** | «My issues» (προσωπική όψη) μέσα στο **ίδιο** sidebar με τις ομάδες | [linear.app/docs/my-issues](https://linear.app/docs/my-issues) |
| **Figma** | «Drafts» (ιδιωτικά) στο ίδιο αριστερό μενού με τα έργα της ομάδας | [help.figma.com — drafts](https://help.figma.com/hc/en-us/articles/18409526530967-Updates-to-how-drafts-work) |
| **GitHub** | προσωπικό dashboard vs dashboard οργανισμού: **ίδια διάταξη** (αριστερή στήλη), άλλη εμβέλεια, αλλαγή από το μενού λογαριασμού | [docs.github.com — organization dashboard](https://docs.github.com/en/organizations/collaborating-with-groups-in-organizations/about-your-organization-dashboard) |
| **Google Drive** | «My Drive» και «Shared drives» στο **ίδιο** sidebar | [developers.google.com — shared drives](https://developers.google.com/workspace/drive/api/guides/shared-drives-diffs) |
| **Vercel / Canva** | προσωπικός λογαριασμός και ομάδες = «scopes» με διακόπτη· **ίδιο** κέλυφος | [vercel.com/docs/accounts](https://vercel.com/docs/accounts) · [canva.com/help/switch-team](https://www.canva.com/help/switch-team/) |
| **Atlassian** | η επανασχεδίαση 2020 έβαλε την πλοήγηση προϊόντος **αριστερά** και κράτησε την πάνω μπάρα για καθολικά (αναζήτηση, δημιουργία, ειδοποιήσεις, προφίλ) — **ακριβώς** η διάταξη του δικού μας `(app)` | [atlassian.com/blog — new navigation](https://www.atlassian.com/blog/design/designing-atlassians-new-navigation) |

### 2.2 Αγορά (marketplace) vs «διαχείριση των δικών μου» — **εδώ χωρίζουν**

| Προϊόν | Εύρημα | Πηγή |
|---|---|---|
| **Airbnb** | λειτουργία επισκέπτη = λιτή πάνω μπάρα· «Switch to hosting» αλλάζει **όλη** την πλοήγηση σε διαχειριστική. ⚠️ Χρήστες παραπονέθηκαν όταν η είσοδος θάφτηκε σε επανασχεδίαση | [community.withairbnb.com](https://community.withairbnb.com/t5/Support-with-your-bookings/getting-to-host-mode/m-p/1782189) |
| **Etsy** | ο αγοραστής περιηγείται με πάνω μπάρα· το «Shop Manager» (τα δικά μου) είναι dashboard **με αριστερή πλοήγηση** | [help.etsy.com — dashboard](https://help.etsy.com/hc/en-us/articles/360000343908-How-to-Use-Your-Dashboard-to-Manage-Your-Shop) |
| **Fiverr** | buyer/seller mode — κάθε λειτουργία αλλάζει τα στοιχεία του μενού | [websitebuilderinsider.com](https://www.websitebuilderinsider.com/how-do-i-switch-to-seller-mode-on-fiverr-app/) |
| **Procore / Autodesk CC** | επίπεδο εταιρείας vs επίπεδο έργου = διαφορετικό περιεχόμενο αριστερής πλοήγησης + διακόπτης «πίσω στο portfolio» | [support.procore.com](https://support.procore.com/faq/how-do-i-use-the-navigation-bar-to-go-back-to-the-company-portfolio) |
| **Zillow / Rightmove / Idealista / Spitogatos** | δημόσια αναζήτηση = πάνω μπάρα, πλήρες πλάτος. ⚠️ **Ασθενώς τεκμηριωμένο** — δεν επαληθεύτηκε με στιγμιότυπο σε αυτή τη συνεδρία | [onething.design](https://www.onething.design/post/top-website-navigation-design-patterns) |

### 2.3 Οδηγίες σχεδίασης

| Πηγή | Τι λέει |
|---|---|
| **Nielsen Norman Group** | η κάθετη (αριστερή) πλοήγηση ταιριάζει σε **ευρεία ή αναπτυσσόμενη** αρχιτεκτονική· η οριζόντια «ζορίζεται» πέρα από ~7±2 στοιχεία. Κείμενο πάντα ορατό, όχι μόνο εικονίδια — [nngroup.com/articles/vertical-nav](https://www.nngroup.com/articles/vertical-nav/) |
| **Material Design 3** | κινητό (<600dp) → μπάρα/συρτάρι· μεσαίο/μεγάλο πλάτος → navigation rail. Επιλογή κατά **μέγεθος παραθύρου** — [m3.material.io — navigation rail](https://m3.material.io/components/navigation-rail/guidelines) |
| **Apple HIG** | το sidebar «ισοπεδώνει την ιεραρχία» — ταυτόχρονη πρόσβαση σε ομότιμες κατηγορίες — [developer.apple.com — sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) |
| **Γενική πρακτική SaaS** | πάνω μπάρα κάτω από ~5 προορισμούς ή για σελίδες περιήγησης/μετατροπής· sidebar όταν οι ενότητες πληθαίνουν (dashboards, διαχείριση) — [saasui.design](https://www.saasui.design/blog/saas-navigation-ux-patterns) |

### 2.4 Σύνθεση

1. **Κανείς μεγάλος δεν αφήνει την περιοχή «τα δικά μου» χωρίς μόνιμη πλοήγηση** όταν ξεπεράσει
   τους ~5 προορισμούς.
2. **Κανείς μεγάλος δεν βάζει sidebar στη δημόσια περιήγηση αγοράς** — εκεί μετρά το πλάτος και
   η μετατροπή.
3. **Ένα οπτικό σύστημα, όχι δύο εφαρμογές** — αλλάζει το περιεχόμενο της αριστερής στήλης, όχι
   η γλώσσα σχεδίασης. (Το Etsy με ξεχωριστή εφαρμογή πωλητή είναι το αντιπαράδειγμα.)
4. **Ο διακόπτης χώρου μένει ορατός και σταθερός** (GitHub / Vercel / Canva) — εμείς τον έχουμε
   ήδη: `MySpacesSection` στο μενού λογαριασμού (ADR-820).

---

## 3. Τι υπάρχει σήμερα (κώδικας, 2026-09-21)

### 3.1 Οι κόσμοι (route groups)

| Ομάδα | Κέλυφος | Περιεχόμενο |
|---|---|---|
| `(app)` | `AppSidebar` + `AppHeader` + 9 βαριοί providers (`src/app/(app)/layout.tsx`) | χώρος γραφείου `/o/[workspace]/**` + νομικά/admin/debug που «ταξιδεύουν μαζί» |
| `(light)` | `PublicSiteHeader` + `ShellSurface` + `LegalLinksNav` footer (`src/app/(light)/layout.tsx`) | δημόσια ανακάλυψη |
| `(me)` | `PrivateSpaceShell` = `PublicSiteHeader` + `ProtectedRoute` + `ShellSurface measure="wide"` (`src/components/private-space/PrivateSpaceShell.tsx`) | **ο προσωπικός χώρος** — χωρίς sidebar |
| `(auth)` · `(bare)` | ελάχιστο | σύνδεση/token links · test harness |

### 3.2 Απογραφή του προσωπικού χώρου

**Α. Δημόσια ανακάλυψη — `(light)`** *(μένουν χωρίς sidebar)*

| Διαδρομή | Σκοπός | Είσοδος σήμερα |
|---|---|---|
| `/` | «Πού ψάχνεις;» + καρτέλες + πλέγμα αγγελιών | λογότυπο |
| `/search` | 308 → `/` (παλιοί σύνδεσμοι) | — |
| `/search/results` | χάρτης + λίστα αποτελεσμάτων | «Δες όλες τις αγγελίες» |
| `/listing/[id]` | λεπτομέρεια αγγελίας | κάρτα |
| `/pro` · `/pro/[alias]` | κατάλογος επαγγελματιών · προφίλ γραφείου | καρτέλα «Επαγγελματίες» → κουμπί |
| `/offers/new` | φόρμα «Καταχώριση αγγελίας» (δημόσια, ADR-660 §5.10) | CTA πάνω μπάρας |

**Β. Ιδιωτικά «τα δικά μου» — `(me)`** *(εδώ μπαίνει το sidebar)*

| Διαδρομή | Σκοπός | Είσοδος σήμερα |
|---|---|---|
| `/offers` | «Τα ακίνητά μου» — **και** `PRIVATE_SPACE_HOME` (προσγείωση μετά τη σύνδεση) | πάνω μπάρα «Προσφέρω» · διακόπτης χώρου |
| `/offers/[offerId]` · `/offers/[offerId]/calendar` | αγγελία · ημερολόγιο βραχυχρόνιας | κάρτα · σύνδεσμος στη λεπτομέρεια |
| `/offers/mandate/new` | αίτηση εντολής σε γραφείο | CTA σε `/pro/[alias]` |
| `/demands` · `/demands/new` · `/demands/[demandId]` | «Οι ζητήσεις μου» | πάνω μπάρα «Ζητώ» |
| `/messages` · `/messages/[threadId]` | «Τα μηνύματά μου» | **μενού avatar** |
| `/first-contacts` · `/first-contacts/inbox` | «Οι επαφές μου» · «Ποιοι με πλησίασαν» | **μενού avatar** · καρτέλα |
| `/dossiers` · `/dossiers/[dossierId]` | «Οι φάκελοί μου» | **μενού avatar** |
| `/profile` | λογαριασμός ιδιώτη (μέσω `resolveAccountRoute`, `src/lib/routes/landing.ts`) | **μενού avatar** «Λογαριασμός» |
| `/workspace/new` | «Δημιουργώ τον χώρο μου» (γραφείο) | CTA στο `/profile`, μόνο αν `companyId === null` |

### 3.3 Η διάγνωση του «λαβυρίνθου»

Οι **6 ισότιμοι** προορισμοί «τα δικά μου» είναι **σκορπισμένοι σε δύο διαφορετικά σημεία**:
δύο στην πάνω μπάρα (Ζητώ, Προσφέρω) και τέσσερις **δύο κλικ βαθιά** στο μενού του avatar
(επαφές, φάκελοι, μηνύματα, λογαριασμός). Όταν ο χρήστης μπει σε μία σελίδα, **καμία ένδειξη
δεν του λέει πού βρίσκεται** ούτε ποιες είναι οι αδελφές σελίδες. Το «Οι ζητήσεις μου» και το
«Τα μηνύματά μου» είναι ομότιμα, αλλά ο χρήστης τα βρίσκει με εντελώς διαφορετικό τρόπο. Αυτός
είναι ο λαβύρινθος.

---

## 4. Η σχέση με το ADR-820 — **δεν το ανατρέπει**

Το ADR-820 §5.1 απέρριψε το sidebar ως θέση για την **πόρτα αλλαγής χώρου**
(«Ο προσωπικός μου χώρος / Ο χώρος του γραφείου μου»). Οι τρεις λόγοι του, ένας-ένας:

| Λόγος ADR-820 | Ισχύει εδώ; |
|---|---|
| 1. Το sidebar ζει μόνο στο `(app)` → η πόρτα θα χρειαζόταν δεύτερη ένθεση = δίδυμο | **Δεν αφορά.** Η πόρτα **μένει** στο `UserMenu` (μία ένθεση, πέντε κόσμοι). Το νέο sidebar **δεν** περιέχει τον διακόπτη χώρου |
| 2. «Ο χώρος είναι ταυτότητα, όχι εργαλείο» — ζει δίπλα στο avatar | **Συμφωνούμε.** Το sidebar δείχνει τα **περιεχόμενα** του χώρου, όχι την επιλογή χώρου |
| 3. `MenuItem.href: WorkspaceHref` + φίλτρο δικαιωμάτων εταιρείας | **Ισχύει — και καθορίζει τη λύση:** ο προσωπικός κατάλογος **δεν** περνά από `smart-navigation-factory` / `filterItemsByPermissions` / `filterItemsByCapability` / `filterItemsByJob`. Δικός του κατάλογος, κοινά μόνο τα στοιχεία απόδοσης (§5.3) |

---

## 5. Απόφαση (προτεινόμενη)

### 5.1 Πού

- ✅ **`(me)`** — όλες οι ιδιωτικές σελίδες αποκτούν αριστερό sidebar, μέσα από το
  `PrivateSpaceShell` (ένα σημείο ένθεσης).
- ❌ **`(light)`** — καμία αλλαγή. Η αναζήτηση/αγγελίες μένουν πλήρους πλάτους με πάνω μπάρα.
- ❌ **`(auth)`** — καμία αλλαγή (σελίδες token/email, χωρίς πλοήγηση εκ σχεδιασμού).

### 5.2 Τι περιέχει — ο κατάλογος

| Ομάδα | Στοιχείο | Διαδρομή | Σημείωση |
|---|---|---|---|
| *(κορυφή)* | **＋ Καταχώριση αγγελίας** | `/offers/new` | κύριο κουμπί ενέργειας (όπως «New» στο Drive)· οδηγεί σε `(light)` |
| **Οι αγγελίες μου** | Τα ακίνητά μου | `/offers` | αρχική του χώρου (`PRIVATE_SPACE_HOME`) |
| | Οι ζητήσεις μου | `/demands` | |
| **Επικοινωνία** | Τα μηνύματά μου | `/messages` | badge αδιάβαστων, αν υπάρχει πηγή μετρητή |
| | Οι επαφές μου | `/first-contacts` | υπο-στοιχείο: «Ποιοι με πλησίασαν» `/first-contacts/inbox` |
| **Οργάνωση** | Οι φάκελοί μου | `/dossiers` | |
| **Ανακάλυψη** | Αναζήτηση ακινήτων | `/` | έξοδος προς `(light)` |
| | Επαγγελματίες | `/pro` | έξοδος προς `(light)` |
| *(κάτω)* | Λογαριασμός | `/profile` | μέσω `resolveAccountRoute` (ποτέ ωμό `/account`) |
| | Δημιουργώ τον χώρο γραφείου μου | `/workspace/new` | **μόνο** αν `companyId === null` |
| *(footer)* | νομικοί σύνδεσμοι | `LegalLinksNav variant="sidebar"` | όπως στο γραφείο |

**7 κύριοι προορισμοί** — πάνω από το όριο που η πάνω μπάρα αντέχει άνετα, στη ζώνη όπου η NN/g
προτείνει κάθετη πλοήγηση.

**ΔΕΝ μπαίνουν στο sidebar:** σελίδες λεπτομέρειας (`/offers/[id]`, `/demands/[id]`,
`/messages/[threadId]`, `/dossiers/[id]`), φόρμες δημιουργίας εκτός της κύριας
(`/demands/new`, `/offers/mandate/new`), το ημερολόγιο, οι σελίδες token του `(auth)`.
Ενεργό στοιχείο = το πρόθεμα διαδρομής (π.χ. `/offers/abc` φωτίζει «Τα ακίνητά μου»).

**Διακόπτης χώρου και ειδοποιήσεις:** **ΜΕΝΟΥΝ** στο `ShellUtilities` / `UserMenu`. Δεν
διπλασιάζονται στο sidebar (ADR-820).

**Πάνω μπάρα μέσα στο `(me)`:** το «Ζητώ» / «Προσφέρω» μπορούν να μείνουν (ίδια κεφαλίδα με το
`(light)` = σταθερότητα), αλλά γίνονται πλεονάζοντα. **Αποφασίστηκε (§8, Ε2):** μένουν στο `(light)`, κρύβονται στο `(me)`.

### 5.3 Πώς — SSoT στο επίπεδο απόδοσης, όχι στο επίπεδο δεδομένων

| Επίπεδο | Κοινό με το γραφείο; |
|---|---|
| Primitive `Sidebar` / `SidebarProvider` / Sheet στο κινητό (`src/components/ui/sidebar*.tsx`) | ✅ ίδιο |
| `SidebarMenuSection` · `sidebar-menu-item` · `sidebar-badge` (`src/components/sidebar/`) | ✅ ίδια |
| `useSidebarState` (ανοιχτά υπο-μενού, ενεργό στοιχείο) | ✅ ίδιο |
| Cookie κατάστασης σύμπτυξης `sidebar_state` | ✅ ίδιο — ⚠️ είναι **ένα** cookie και για τους δύο χώρους· αν θέλουμε ανεξάρτητη μνήμη, χρειάζεται παράμετρος ονόματος (§8, Ε4) |
| `AppSidebar` (`src/components/app-sidebar.tsx`) | ❌ **ΟΧΙ** — το CHECK 3.52 Κ3 επιτρέπει την εισαγωγή του **μόνο** από το `(app)/layout.tsx` |
| Κατάλογος στοιχείων | ❌ **νέος**, ξεχωριστός: π.χ. `src/config/personal-navigation.ts` — απλός πίνακας με hrefs τύπου `GlobalRoute` (`src/lib/workspace/route-worlds.ts`), **χωρίς** φίλτρα δικαιωμάτων/ικανότητας/δουλειάς. Οι σταθερές διαδρομών **από** τα υπάρχοντα SSoT (`MY_OFFERS_ROUTE`, `MY_DEMANDS_ROUTE`, `MY_MESSAGES_ROUTE`, `MY_FIRST_CONTACTS_ROUTE`, `MY_DOSSIERS_ROUTE`, `PRIVATE_PROFILE_ROUTE`, `NEW_OFFER_ROUTE`), ποτέ κυριολεκτικά strings |
| Ετικέτες | i18n — κλειδιά που **ήδη υπάρχουν** (`common-account:userMenu.*`, `property-market:*.door.*`) όπου ταιριάζουν· νέα κλειδιά σε `el` **και** `en` (N.11) |
| Σύνδεσμοι | `Link` / `usePathname` από `@/lib/workspace/navigation` (CHECK 3.61) |

Νέο component: π.χ. `src/components/private-space/PersonalSidebar.tsx`, που αποδίδεται από το
`PrivateSpaceShell`. Δεν αγγίζει το `AppSidebar`.

### 5.4 Κινητό

Το primitive ήδη αποδίδει `Sheet` όταν `isMobile`. Στο κινητό: κουμπί ☰ στην κεφαλίδα του `(me)`
ανοίγει το συρτάρι· κλείσιμο με την πλοήγηση (όπως το `AppSidebar`, `setOpenMobile(false)`).

---

## 6. Πύλες που αγγίζει η υλοποίηση (όλες blocking)

| Πύλη | Τι απαιτεί |
|---|---|
| **3.52** σύνορο κελύφους (ADR-777 §8.12) | **Δεν** εισάγεται `AppSidebar`/`AppHeader` στο `(me)`. Ενημέρωση λόγου της `(me)` στο `.shell-boundary.json` ώστε να λέει «δικό του, ελαφρύ sidebar» χωρίς να γίνει `(app)`. Να μετρηθεί αν χρειάζεται νέα τιμή `wearsShell` ή αρκεί το νέο κείμενο λόγου |
| **3.63** διάδρομος κελύφους (ADR-797) | το πλάτος του sidebar να τροφοδοτεί το `--shell-sidebar-occupied`, αλλιώς το `ShellSurface measure="wide"` του `PrivateSpaceShell` υπολογίζει σε λάθος διαθέσιμο πλάτος |
| **3.72** καθολικές δυνατότητες (ADR-809) | αμετάβλητο — γλώσσα/θέμα/ειδοποιήσεις/λογαριασμός μένουν στο `ShellUtilities` |
| **3.60 / 3.61** εμβέλεια χώρου / σύνορο πλοήγησης (ADR-787) | οι διαδρομές του `(me)` **μένουν χωρίς** πρόθεμα `/o/…` (ADR-820 §6: «θα έσπαγε τον πολίτη»)· σύνδεσμοι μόνο μέσω του συνόρου |
| **3.8 / 3.33 / 3.34** i18n | νέα κλειδιά σε `el`+`en`· αναπαραγωγή τύπων i18n· έλεγχος shell slice |
| **3.28** jscpd | ο νέος κατάλογος να **μην** είναι κλώνος της `smart-navigation-factory` |

**Κόστος SSR:** το `(me)` υπάρχει επειδή είναι **−41% έως −59%** ελαφρύτερο από το `(app)`.
Το νέο sidebar **απαγορεύεται** να φέρει κανέναν από τους 9 providers του `(app)`
(`WorkspaceProvider`, `ActiveJobProvider`, `WebSocketProvider`, …). Μόνο `SidebarProvider`.

---

## 7. Απορριφθείσες εναλλακτικές

| Εναλλακτική | Γιατί όχι |
|---|---|
| Καμία αλλαγή (μόνο μενού avatar) | 6 ομότιμοι προορισμοί κρυμμένοι σε δύο διαφορετικά σημεία = ο λαβύρινθος (§3.3). Κανείς μεγάλος δεν το κάνει |
| Sidebar **και** στο `(light)` | αντίθετο με κάθε αγορά ακινήτων/marketplace (§2.2)· τρώει πλάτος από χάρτη/πλέγμα· ο ανώνυμος επισκέπτης δεν έχει «τα δικά μου» |
| Επαναχρησιμοποίηση του `AppSidebar` με δεύτερο config | μπλοκάρεται από CHECK 3.52 Κ3· το `AppSidebar` είναι δεμένο με `useJobFilteredNavigation` και φίλτρα εταιρείας (ADR-820 λόγος 3) |
| Μεταφορά των `(me)` σελίδων στο `(app)` | +9 providers, −41/−59% SSR που κερδίσαμε· λάθος «δωμάτιο» για τον ιδιώτη (`.shell-boundary.json`) |
| Περισσότερα στοιχεία στην πάνω μπάρα | ήδη 8 στοιχεία στην κεφαλίδα (ADR-820 §5.1 λόγος 2)· δεν κλιμακώνεται |
| Bottom navigation στο κινητό | επιπλέον επιφάνεια που δεν υπάρχει στο γραφείο· το Sheet του primitive αρκεί. Επανεξέταση αν η χρήση από κινητό κυριαρχήσει |

---

## 8. Ανοιχτά ερωτήματα για τον Giorgio

| # | Ερώτημα | Πρόταση | Απάντηση Giorgio |
|---|---|---|---|
| Ε1 | Εγκρίνεται το υβριδικό μοντέλο (sidebar μόνο στο `(me)`); | ναι | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-21 — Α: στήλη ΜΟΝΟ στις σελίδες «τα δικά μου» (`(me)`).** Οι σελίδες αναζήτησης (`(light)`: `/`, `/search/results`, `/listing/[id]`, `/pro`, `/offers/new`) μένουν πλήρους πλάτους, χωρίς στήλη |
| Ε2 | Μένουν «Ζητώ» / «Προσφέρω» στην πάνω μπάρα μέσα στο `(me)`; | ναι στο `(light)` (είναι πόρτες προς τα δικά μου)· μέσα στο `(me)` να κρυφτούν όταν το sidebar είναι ορατό | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-21 — Α.** Στο `(light)` (χωρίς στήλη) τα «Ζητώ» / «Προσφέρω» **μένουν** — είναι η γρήγορη πόρτα προς τα δικά μου. Στο `(me)` (με στήλη) **κρύβονται**, για να μη δείχνεται το ίδιο δύο φορές. Το «Καταχώριση αγγελίας» **μένει παντού**. ⚠️ Υλοποίηση: η κρυφή κατάσταση κρίνεται από το **αν αποδίδεται η στήλη**, όχι από λίστα διαδρομών — ώστε στο κινητό (στήλη κλειστή σε συρτάρι) να μη χαθεί κάθε ορατή πόρτα: εκεί το ☰ είναι η πόρτα |
| Ε3 | Μπαίνουν τα στοιχεία «Ανακάλυψη» (`/`, `/pro`) στο sidebar; | ναι — αλλιώς η μόνη έξοδος είναι το λογότυπο | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-21 — Α: και τα δύο.** Ομάδα «Ανακάλυψη» στη στήλη: «Αναζήτηση ακινήτων» → `/` (`SEARCH_LANDING_ROUTE`) και «Επαγγελματίες» → `/pro`. Λόγος: το λογότυπο ως μόνη έξοδος είναι αόρατη πόρτα — ο χρήστης δεν ξέρει ότι είναι κουμπί |
| Ε4 | Ξεχωριστή μνήμη σύμπτυξης ανά χώρο (δεύτερο cookie); | ναι — παράμετρος ονόματος cookie στο `SidebarProvider` | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-21 — Α: χωριστή μνήμη ανά χώρο.** Ο χώρος γραφείου κρατά το υπάρχον `sidebar_state` (μηδενική αλλαγή για όσους το έχουν ήδη)· ο προσωπικός χώρος παίρνει **δικό του** όνομα cookie. Υλοποίηση: παράμετρος ονόματος στο `SidebarProvider` (`src/components/ui/sidebar-context.tsx`) με προεπιλογή το σημερινό — **όχι** δεύτερο αντίγραφο του provider |
| Ε5 | Μένουν «Οι επαφές / φάκελοι / μηνύματά μου» και στο μενού avatar; | ναι, ως συντόμευση από το `(light)` και από το γραφείο· η αυθεντία είναι ένας κοινός κατάλογος (§5.3) που τροφοδοτεί **και** το sidebar **και** το μενού — όχι δύο λίστες | ✅ **ΑΠΟΦΑΣΙΣΤΗΚΕ 2026-09-21 — Α: μένουν και στο μενού avatar.** Λόγος: το μενού avatar αποδίδεται **παντού** (και στο `(light)` και στον χώρο γραφείου) — ο υπάλληλος που δουλεύει στο γραφείο φτάνει στα **δικά του** μηνύματα με 2 κλικ χωρίς αλλαγή χώρου. ⚠️ **Όρος SSoT:** ΕΝΑΣ κατάλογος (`src/config/personal-navigation.ts`, §5.3) τροφοδοτεί **και** τη στήλη **και** το `UserMenu` — τα σημερινά χειρόγραφα `DropdownMenuItem` του `user-menu.tsx` για επαφές/φακέλους/μηνύματα **αντικαθίστανται** από ανάγνωση του καταλόγου· προσθήκη στοιχείου = μία γραμμή, εμφανίζεται και στα δύο |

---

## 9. Παράπλευρα ευρήματα της σάρωσης

| Εύρημα | Πού | Ενέργεια |
|---|---|---|
| Ορφανή σελίδα — καμία είσοδος, ο ίδιος ο κώδικας λέει ότι «δεν υπάρχει ουρά έγκρισης» | `src/app/(app)/pending-approval/page.tsx` (+ `AUTH_ROUTES.pendingApproval`, `authRoutes.ts:56`) | επιβεβαίωση Giorgio → διαγραφή |
| Ορφανή σελίδα admin, εκτός `AdminSidebar.NAV_GROUPS` | `src/app/(app)/admin/property-status-demo/page.tsx` | επιβεβαίωση Giorgio → διαγραφή ή ένταξη |
| Δύο σχεδόν ίδιοι τύποι στοιχείου μενού (αναγνωρισμένο στον ίδιο τον κώδικα) | `src/types/sidebar.ts` (`MenuItem`) vs `src/config/smart-navigation-factory.ts` (`SmartNavigationItem`) | να ενοποιηθούν **πριν** ο προσωπικός κατάλογος γίνει τρίτος καταναλωτής |
| ✅ Χειρόγραφος σύνδεσμος εκτός καταλόγου | `app-sidebar.tsx` — «Πλοήγηση» (`/navigation`) | **έγινε** (§10.5 Υ12): στοιχείο του καταλόγου `tools` |
| Η προσγείωση ιδιώτη είναι `/offers`, όχι `/` | `src/lib/routes/landing.ts` (`PRIVATE_SPACE_HOME`) | συνεπές με την πρόταση: `/offers` = αρχική του sidebar |
| ✅ **Έγινε — Φάση Β, §10.6/§10.7** (μετρήθηκαν **πέντε**, Γ2 → **ένα** συμβόλαιο `MenuLink \| MenuGroup`). Τέσσερις δηλώσεις «στοιχείου μενού» στο γραφείο (§10.1 Α11) — ο τοπικός `MenuItem` του factory με `href: string` δεν συμβιβάζεται με `WorkspaceHref` | `config/navigation.ts` · `config/smart-navigation-factory.ts` · `types/sidebar.ts` | ξεχωριστή δουλειά (>1h, τύποι που χρειάζονται `tsc` για επαλήθευση): ένα συμβόλαιο `types/sidebar.ts`, το factory να δίνει αυστηρά hrefs |
| ✅ Το cookie `sidebar_state` του γραφείου γράφεται, δεν διαβάζεται ποτέ (§10.1 Α3) — **έγινε** (§10.5 Υ10) | `sidebar-context.tsx` · `(app)/layout.tsx` | επιβεβαίωση Giorgio → `restoreFromCookie` και στο `(app)` (μία γραμμή), συνδυασμένο με τη λίστα `SIDEBAR_COLLAPSED_ROUTES` |
| ✅ **Π5 — badge αδιάβαστων στο «Μηνύματα» (Φάση Γ) — έγινε 2026-09-22.** Η απόφαση ζει στο **ADR-867 §4.5 (Β10)**. Εδώ μόνο η παρουσίαση: `MenuLink.countSource` (ο κατάλογος δηλώνει **πηγή**, όχι αριθμό) · `components/sidebar/menu-count-badge.tsx` (ένα component ανά πηγή) · `IconCountBadge` στη νέα θέση `inline-end` (ADR-854) σε ανοιχτή στήλη και μενού avatar, `top-end` σε συμπτυγμένη | `types/sidebar.ts` · `config/personal-navigation.ts` · `sidebar-menu-shared.tsx` · `sidebar-menu-item.tsx` · `header/user-menu.tsx` | — |
| ✅ Διπλό `<main>` στο γραφείο: `SidebarInset` (`main`) → `MainContentBridge` (`ShellSurface as="main"`) — **έγινε** (§10.5 Υ9)· οι σελίδες με δικό τους `main` → ratchet | `(app)/layout.tsx` | `SidebarInset as="div"` εκεί, αφού υπάρχει πλέον η παράμετρος |
| ✅ **Έγινε** (§10.5 Υ11). Όλα τα υπο-στοιχεία φωτίζονται όταν φωτίζεται ο γονιός (`isActive={isActive}` σε κάθε `SidebarMenuSubButton`)· το `useSidebarState` δεν ανοίγει ποτέ τον γονιό του ενεργού (κενό `useEffect`) | `components/sidebar/sidebar-menu-item.tsx` · `hooks/useSidebarState.ts` | ορατό μόνο στο γραφείο (η προσωπική στήλη δεν έχει υπο-στοιχεία) — ξεχωριστή διόρθωση |

---

## 10. Υλοποίηση — SSoT audit, έρευνα και αποφάσεις (γράφτηκαν **ΠΡΙΝ** τον κώδικα, 2026-09-21)

### 10.1 Τι έδειξε το audit (grep, όχι ο χάρτης του handoff)

| # | Εύρημα | Συνέπεια |
|---|---|---|
| Α1 | **Κανένας** προσωπικός κατάλογος δεν υπάρχει (`personal-navigation` / `PersonalSidebar` = 0 αποτελέσματα) | ο κατάλογος γεννιέται **μία** φορά, στο `src/config/personal-navigation.ts` |
| Α2 | Όλες οι διαδρομές έχουν ήδη σταθερά: `MY_OFFERS_ROUTE` · `MY_DEMANDS_ROUTE` · `MY_MESSAGES_ROUTE` · `MY_FIRST_CONTACTS_ROUTE` · `MY_DOSSIERS_ROUTE` · `NEW_OFFER_ROUTE` · `SEARCH_LANDING_ROUTE` · **`AGENCY_DIRECTORY_ROUTE`** (`/pro`, `components/mandate/agency-directory-route.ts`) · **`CREATE_WORKSPACE_ROUTE`** (`lib/workspace/workspace-routes.ts`) · `resolveAccountRoute` + **`hasOrganization`** (`lib/routes/landing.ts`) | **μηδέν** κυριολεκτικά strings. Το «μόνο αν `companyId === null`» του §5.2 γίνεται `!hasOrganization(identity)` — η **ίδια** κρίση με την προσγείωση (χειρίζεται και το `''`, ADR-749) |
| Α3 | 🔴 Το cookie `sidebar_state` **γράφεται και δεν διαβάζεται ΠΟΥΘΕΝΑ** (`sidebar-context.tsx:90` είναι η μόνη αναφορά). Το `(app)` περνά `defaultOpen` από λίστα διαδρομών, όχι από το cookie | η «μνήμη σύμπτυξης» **δεν υπάρχει σήμερα ούτε στο γραφείο**. Το Ε4 ως «μόνο παράμετρος ονόματος» θα έδινε δεύτερο cookie που επίσης δεν διαβάζει κανείς ⇒ βλ. §10.3 Υ1 |
| Α4 | Το `SidebarInset` αποδίδει **`<main>`** με σκληρό κώδικα, ενώ **9** components σελίδων του `(me)` αποδίδουν **δικό τους** `<main>` (`MyDemandsContent`, `FirstContactViewsFrame`, `NetworkThreadScreen`, …) | στο `(me)` το inset **δεν** επιτρέπεται να είναι `<main>` (δύο `main` = σπασμένα ορόσημα). Παράμετρος `as` στο `SidebarInset`, προεπιλογή `main` ⇒ `(app)` αμετάβλητο |
| Α5 | Το primitive ζωγραφίζει τη στήλη `fixed inset-y-0 h-svh` — **πλήρες ύψος**, από την κορυφή | η κεφαλίδα **μπαίνει μέσα** στο inset, δεξιά της στήλης — ακριβώς η διάταξη του `(app)` (Atlassian, §2.1). Κεφαλίδα πάνω από στήλη θα ήθελε υπερκάλυψη του `top`/`height` του primitive = hack |
| Α6 | Το `--shell-sidebar-occupied` το βγάζουν αδελφικοί επιλογείς `[data-collapsible] ~ [data-shell-inset]` (`shell-surface.css` §1) | αρκεί το `data-shell-inset` στο inset, **αδελφό** της στήλης — **μηδέν** νέο CSS (CHECK 3.63) |
| Α7 | Το `SidebarMenuItem` μεταφράζει τίτλους **μόνο** από το namespace `navigation` (`translateTitle`) | οι νέες ετικέτες ζουν στο `navigation.json` (`personal.*`) και στις δύο γλώσσες· τα `common-account:userMenu.{myContacts,myDossiers,myMessages}` μένουν νεκρά μετά το Ε5 ⇒ **διαγράφονται** |
| Α8 | **Κανένα** στοιχείο στήλης δεν δηλώνει `aria-current` — ούτε στο γραφείο (`sidebar-menu.tsx` βάζει μόνο `data-active`) | προστίθεται **στο primitive** (`SidebarMenuButton`, μόνο όταν αποδίδεται ως σύνδεσμος): το κερδίζουν **και οι δύο** στήλες |
| Α9 | «Ποιοι με πλησίασαν» είναι **ήδη** καρτέλα μέσα στη σελίδα (`FirstContactViewsFrame`, με `aria-current`) | **ΔΕΝ** μπαίνει υπο-στοιχείο στη στήλη: στήλη = ενότητες, καρτέλες = όψεις μιας ενότητας (GitHub/Linear). Το «Οι επαφές μου» φωτίζεται με πρόθεμα και στο `/first-contacts/inbox`. Διορθώνει τη σημείωση του §5.2 — δεν αγγίζει τα Ε1-Ε5 |
| Α10 | **Καμία** πηγή μετρητή αδιάβαστων μηνυμάτων: το «αδιάβαστο» υπολογίζεται **ανά νήμα** στον διακομιστή (`thread-liveness.ts`) και ο κατάλογος έρχεται **σελίδα-σελίδα** με δρομέα (`useNetworkThreadDirectory`) | **κανένα badge στο v1.** Αριθμός από την πρώτη σελίδα θα ήταν **ψέμα** όταν τα αδιάβαστα είναι πάνω από μία σελίδα. Σωστό badge = συγκεντρωτικός μετρητής στον διακομιστή (ξεχωριστή δουλειά, ADR-867) · ✅ **ΛΥΘΗΚΕ 2026-09-22 — ADR-867 §4.5 (Β10)**: γραμμή ανά αδιάβαστο νήμα, ο αριθμός = πλήθος γραμμών, ζωντανά |
| Α11 | 🔶 Τέσσερις δηλώσεις «στοιχείου μενού»: `types/sidebar.ts` (`MenuItem`) · `config/navigation.ts` (`MenuItem`, **δεύτερη**) · `smart-navigation-factory.ts` (**τοπικό** `MenuItem` με `href: string` + `SmartNavigationItem` + `NavigationConfigBase`). Η μετατροπή `href: string` → `WorkspaceHref` δεν συμβιβάζεται τυπικά (baseline `.ts-error-baseline.json` = 3005) | **εκτός εμβέλειας, με λόγο:** ο προσωπικός κατάλογος **ΔΕΝ** γίνεται τρίτος καταναλωτής του `SmartNavigationItem` — μιλά απευθείας το συμβόλαιο απόδοσης `types/sidebar.ts`, με αυστηρά τυπωμένα hrefs. Η ενοποίηση των τύπων του γραφείου αγγίζει το 1155-γραμμο factory και τυπικά λάθη που χωρίς `tsc` (N.17) δεν επαληθεύονται — καταγράφεται στο §9 |

### 10.2 Έρευνα (2026-09-21)

| Θέμα | Πηγή | Συμπέρασμα |
|---|---|---|
| Ρόλος πλοήγησης | WAI-ARIA APG, *Disclosure Navigation* — «does not use the menu role because it does not provide the complex functionality that assistive technologies expect» · `aria-current="page"` στον τρέχοντα σύνδεσμο | `<nav>` + λίστα συνδέσμων (το primitive ήδη `ul/li`), **ποτέ** `role="menu"`· `aria-current="page"` στο ενεργό — [w3.org/WAI/ARIA/apg](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/) |
| Μνήμη σύμπτυξης | shadcn/ui: cookie `sidebar_state` που **διαβάζεται** με `cookies()` στο layout και περνά ως `defaultOpen` · shadcn issue #9189: αυτό κάνει τη διαδρομή **δυναμική** (blocking route στο Next 16) | βλ. Υ1 — [v3.shadcn.com/docs/components/sidebar](https://v3.shadcn.com/docs/components/sidebar) · [github.com/shadcn-ui/ui/issues/9189](https://github.com/shadcn-ui/ui/issues/9189) |
| Κύρια πράξη | Google Drive «New» / Gmail «Compose» — **ένα** κουμπί πάνω από την πλοήγηση, οπτικά ξεχωριστό | «＋ Καταχώριση αγγελίας» στην κεφαλή της στήλης· ίδιο κλειδί με το CTA της κεφαλίδας (`property-market:offer.door.cta`) — **μία** ετικέτα |
| Command palette ⌘K | Linear / Figma | **ΟΧΙ τώρα**: 7 προορισμοί χωρούν σε μία ματιά (NN/g)· το ⌘K αξίζει όταν ο χρήστης ψάχνει **αντικείμενα** (αγγελίες/νήματα), που θέλει δείκτη αναζήτησης — άλλο έργο. Το `⌘B` (σύμπτυξη) το δίνει ήδη το primitive |

### 10.3 Αποφάσεις υλοποίησης

| # | Απόφαση | Λόγος |
|---|---|---|
| Υ1 | **Μνήμη σύμπτυξης στον πελάτη**: το `SidebarProvider` παίρνει `cookieName` (προεπιλογή `sidebar_state`) **και** `restoreFromCookie` (προεπιλογή `false` ⇒ `(app)` αμετάβλητο, όπως ζητά το Ε4). Το προσωπικό κέλυφος: `personal_sidebar_state` + επαναφορά. Η ανάγνωση γίνεται με `useSyncExternalStore` (στιγμιότυπο διακομιστή = ανοιχτό) — **όχι** `cookies()` | Το `cookies()` στο `(me)/layout.tsx` θα έκανε **κάθε** σελίδα του `(me)` δυναμική· στο Next 15.5 η router cache των δυναμικών έχει `staleTime` **0** ⇒ **κλήση στον διακομιστή σε κάθε κλικ της στήλης** — για μια προτίμηση εμφάνισης. Κόστος της λύσης μας: όποιος έχει **συμπτύξει** τη στήλη βλέπει την ανοιχτή στο **πρώτο** καρέ μιας **πλήρους** φόρτωσης· στην πλοήγηση μέσα στο `(me)` το layout μένει προσαρτημένο, άρα καθόλου. ⚠️ Το `(app)` κρατά το χρέος του Α3 — §9 |
| Υ2 | **Η κεφαλίδα ρωτά την ΠΑΡΟΥΣΙΑ της στήλης, όχι τη διαδρομή** (Ε2): νέο `useOptionalSidebar()` στο `sidebar-context.tsx` (επιστρέφει `null` έξω από provider). Με στήλη: ☰ (`SidebarTrigger`) στην αρχή, **κρύβονται** «Ζητώ»/«Προσφέρω», και το σήμα κρύβεται από `md` και πάνω (το δείχνει η στήλη). «Καταχώριση αγγελίας» μένει | ίδιο δόγμα με το §8.12: δομική απάντηση, όχι λίστα `pathname`. Στο κινητό το ☰ είναι η πόρτα |
| Υ3 | **Ο κατάλογος είναι δεδομένα + μία καθαρή συνάρτηση**: `PERSONAL_NAVIGATION` (ομάδες → στοιχεία, με `surfaces: sidebar | userMenu`) και `resolvePersonalNavigation(identity, surface)` που λύνει `href` (λογαριασμός μέσω `resolveAccountRoute`) και ορατότητα (`!hasOrganization`). Επιστρέφει το συμβόλαιο απόδοσης `MenuItem` | η στήλη και το `UserMenu` ρωτούν την **ίδια** συνάρτηση (Ε5)· jest χωρίς React |
| Υ4 | **Σειρά στο `UserMenu` = σειρά του καταλόγου**: μηνύματα · επαφές · φάκελοι · λογαριασμός (ήταν επαφές · φάκελοι · μηνύματα · λογαριασμός) | ένας κατάλογος ⇒ μία σειρά (WCAG 3.2.3 «same relative order»). **Ορατή** αλλαγή, δηλωμένη |
| Υ5 | **Στήλη έξω από τον `ProtectedRoute`**, δίπλα στην κεφαλίδα | ίδιος λόγος με την κεφαλίδα (`PrivateSpaceShell`): ο άνθρωπος που περιμένει την ταυτότητα βλέπει ιστοσελίδα. Η στήλη **δεν** κρατά δεδομένα· το μόνο στοιχείο που εξαρτάται από ταυτότητα («Δημιουργώ χώρο γραφείου») δεν αποδίδεται πριν λυθεί |
| Υ6 | `collapsible="icon"` όπως στο γραφείο· `SidebarLogo` + `LegalLinksNav variant="sidebar"` επαναχρησιμοποιούνται αυτούσια | ένα οπτικό σύστημα (§2.4.3) |
| Υ7 | *(προέκυψε στην υλοποίηση)* Το `SidebarTrigger` μετακόμισε σε **δικό του** module `ui/sidebar-trigger.tsx` (το `ui/sidebar.tsx` το ξαναεξάγει — κανένας καταναλωτής δεν άλλαξε) | η κεφαλίδα του `(light)` το χρειάζεται· αν το εισήγαγε από το `ui/sidebar.tsx`, κάθε δημόσια σελίδα θα κουβαλούσε `Sheet`/`Input`/`Separator` για κουμπί που εκεί δεν αποδίδεται ποτέ |
| Υ8 | *(προέκυψε στην υλοποίηση)* Το `defaultOpen` του `SidebarProvider` διαβάζεται **μία** φορά, στην προσάρτηση | ήταν ήδη έτσι (`useState(defaultOpen)`)· η νέα αλυσίδα κρίσης `open ?? επιλογή ?? cookie ?? αρχικό` θα το έκανε ζωντανό και η στήλη του γραφείου θα ανοιγόκλεινε μόνη της στην πλοήγηση προς/από `/dxf/viewer`. Κλειδωμένο από το test Μ4 |

### 10.4 Αρχεία

| Αρχείο | Τι |
|---|---|
| `src/config/personal-navigation.ts` *(νέο)* | `PERSONAL_NAVIGATION` · `PERSONAL_PRIMARY_ACTION` · `resolvePersonalNavigation(identity \| null, surface)` |
| `src/components/private-space/PersonalSidebar.tsx` *(νέο)* | η στήλη |
| `src/components/private-space/PrivateSpaceShell.tsx` | `SidebarProvider cookieName="personal_sidebar_state" restoreFromCookie` → στήλη + `SidebarInset as="div" data-shell-inset` (κεφαλίδα + φρουρός μέσα) |
| `src/components/public-site/PublicSiteHeader.tsx` | `useOptionalSidebar()` ⇒ ☰, κρυφά «Ζητώ/Προσφέρω», σήμα `md:hidden` |
| `src/components/header/user-menu.tsx` | 4 χειρόγραφα στοιχεία → `map` πάνω στον κατάλογο (`userMenu`) |
| `src/components/ui/sidebar-context.tsx` | `cookieName` · `restoreFromCookie` · `useOptionalSidebar` · επαναφορά με `useSyncExternalStore` |
| `src/components/ui/sidebar.tsx` · `sidebar-trigger.tsx` *(νέο)* · `sidebar-menu.tsx` | `SidebarInset as` · μετακόμιση trigger · `aria-current="page"` |
| `src/i18n/locales/{el,en}/navigation.json` · `common-account.json` | + `personal.*` · − νεκρά `userMenu.{myContacts,myDossiers,myMessages,account}` |
| `.i18n-shell-slice.json` · `.shell-boundary.json` | δήλωση δυναμικών κλειδιών (`navigation:personal*`) · νέος λόγος `(me)` |
| tests | `config/__tests__/personal-navigation.test.ts` (14) · `ui/__tests__/sidebar-context.test.tsx` (6) · `public-site/__tests__/public-site-header-sidebar.test.tsx` (2) · `lib/routes/__tests__/landing.test.ts` Λ4 (η κρίση του λογαριασμού μετακόμισε στον κατάλογο — η άγκυρα ρωτά πλέον **συμπεριφορά**) |

### 10.5 Παράπλευρα του §9 — Φάση Α (Π1-Π4): audit, έρευνα, αποφάσεις (γράφτηκαν **ΠΡΙΝ** τον κώδικα, 2026-09-21)

Ο Giorgio ενέκρινε τρεις φάσεις: **Α** = Π2 · Π3 · Π1 · Π4 (κέλυφος/στήλη) · **Β** = Π6 (τύποι μενού) · **Γ** = Π5 (badge αδιάβαστων, ADR-867).

#### Audit (grep, όχι ο χάρτης του handoff)

| # | Εύρημα | Συνέπεια |
|---|---|---|
| Β1 | 🔴 Το `app-sidebar.tsx` (αδέσμευτη αλλαγή του προηγούμενου κύκλου) είχε σχόλιο JSX `{/* */}` αμέσως μετά το `return (` ⇒ συντακτικό λάθος, **όλη** η στήλη του γραφείου δεν θα μεταγλωττιζόταν. Τα 6 tests κινητού δεν το είδαν (δοκιμάζουν μόνο το `PersonalSidebar`) | διορθώθηκε (σχόλιο `//` πάνω από το `return`) με έγκριση Giorgio |
| Β2 | Το Π2 **δεν** είναι διπλό αλλά έως **τριπλό** `<main>`: `SidebarInset` → `MainContentBridge` (`ShellSurface as="main"`) → δεκάδες σελίδες του `(app)` με δικό τους `<main>` (`NavigationPageContent`, `DashboardHome`, `ReportPage`, admin `*PageContent`, …) | Φάση Α: `SidebarInset as="div"` ⇒ **ένας** ιδιοκτήτης, ο `MainContentBridge`. Οι σελίδες (>4 αρχεία, και μερικά components αποδίδονται **και** στο `(me)`/`(light)` όπου το δικό τους `main` είναι σωστό) ⇒ `.claude-rules/pending-ratchet-work.md` (N.0.2) |
| Β3 | Γονείς που **δεν** περιέχουν το href των παιδιών τους: «Νομικά» `/legal-documents` → `/obligations` · «Ρυθμίσεις» `/settings` → `/admin/*` · «CRM» `/crm` → `/admin/ai-inbox`, `/admin/operator-inbox`. Σε αυτές τις σελίδες ο γονιός **δεν** φωτίζεται σήμερα καθόλου. Και ζεύγη ίδιου href γονιού/παιδιού: `/crm`→`/crm`, `/reports`→`/reports` | το «ενεργό» **δεν** λύνεται ανά στοιχείο με πρόθεμα (σημερινό `isItemActive(href)`) — λύνεται **μία** φορά για όλο τον κατάλογο |
| Β4 | `SidebarMenuSubButton` (primitive) **χωρίς** `aria-current`· το κουμπί-γονιός **χωρίς** `aria-expanded`· οι σύνδεσμοι του popover της συμπτυγμένης στήλης χωρίς `aria-current` και χωρίς ένδειξη ενεργού | a11y στο **primitive** — το κερδίζουν όλοι οι καταναλωτές |
| Β5 | Το `useSidebarState` έχει κενό `useEffect` «omitted for now» — ο γονιός του ενεργού **δεν** ανοίγει ποτέ. **Μηδέν** tests για `sidebar-menu-item` / `useSidebarState`. Καταναλωτές: `AppSidebar` **και** `PersonalSidebar` | η αλλαγή συμβολαίου πρέπει να κρατήσει την προσωπική στήλη (χωρίς υπο-στοιχεία) αμετάβλητη |
| Β6 | 🔴 **Δεύτερη** σκληρή αναφορά στη διαδρομή του καμβά: `sidebar-menu-item.tsx` → `href === '/dxf/viewer'` ⇒ `setOpen(false)` στο κλικ — δίδυμο της `SIDEBAR_COLLAPSED_ROUTES` του `(app)/layout.tsx`. Και το `setOpen` **γράφει το cookie** | αν απλώς ενεργοποιούνταν το `restoreFromCookie` στο `(app)`, **μία** επίσκεψη στον DXF θα «αποθήκευε» κλειστή στήλη για ΟΛΟ το γραφείο |
| Β7 | Το `/navigation` **δεν** είναι απλή σελίδα: είναι ο **ιεραρχικός περιηγητής** Εταιρεία → Έργο → Κτίριο → Όροφος → Μονάδα (`AdaptiveMultiColumnNavigation`) — το ανάλογο του Project Browser. Τα ίδια components τροφοδοτούν ήδη τα breadcrumbs των κεφαλίδων (`ModuleBreadcrumb`, `ListPageHeader`, …). Ο σύνδεσμος στη στήλη είναι ωμό `<a>` (πλήρης επαναφόρτωση, εκτός CHECK 3.61, χωρίς `aria-current`, χωρίς φίλτρο δικαιωμάτων/δουλειάς) | βλ. Υ12 |

#### Έρευνα (2026-09-21)

| Θέμα | Πηγή | Συμπέρασμα |
|---|---|---|
| Ενεργό σε εμφωλευμένη πλοήγηση | WAI-ARIA APG *Disclosure Navigation* (ένα `aria-current="page"`, `aria-expanded` στο κουμπί ομάδας) · GitHub Primer NavList (υπο-στοιχείο με `aria-current`, ο γονιός **ανοίγει**, δεν «επιλέγεται» — primer/react #3835) · Carbon `SideNavMenu` (`hasActiveDescendant`: η κατάσταση **ανεβαίνει** στον γονιό, ειδικά στο rail — carbon #3303) · Material 3 drawer | **ακριβώς ένα** ενεργό· κερδίζει η **μακρύτερη** αντιστοίχιση· η σχέση γονιού/παιδιού είναι **δηλωμένη** στον κατάλογο, **ποτέ** συμπέρασμα από το URL· ο γονιός ανοίγει αυτόματα· στη συμπτυγμένη στήλη η κατάσταση ανεβαίνει στο εικονίδιο του γονιού — [APG](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation) · [Primer](https://primer.style/product/components/nav-list/accessibility/) · [Carbon #3303](https://github.com/carbon-design-system/carbon/pull/3303) |
| Μνήμη σύμπτυξης vs λειτουργία καμβά | VS Code: `workbench.sideBar.visible` = προτίμηση, Zen Mode = **παροδική** επικάλυψη· γνωστά bugs όπου η εναλλαγή **μέσα** στο Zen «διαρρέει» στην προτίμηση (vscode #73408, #45582) · Figma `Ctrl+\` = ζωντανή εναλλαγή UI · Linear: απλή μόνιμη προτίμηση | **η λειτουργία καμβά είναι επικάλυψη, όχι εγγραφή προτίμησης**· στην έξοδο επιστρέφει η προτίμηση. Το bug του VS Code είναι ακριβώς το Β6 — το αποφεύγουμε **δομικά** |
| Ιεραρχικός περιηγητής οντοτήτων | Revit Project Browser · ArchiCAD Navigator · Bentley iTwin Model Tree = **προσαρτώμενο πάνελ δέντρου**· Procore / Autodesk Construction Cloud = **διακόπτης πλαισίου στην κεφαλίδα** για εταιρεία/έργο | κυρίαρχο: επίπεδα **μίσθωσης** (οργανισμός) στην κεφαλίδα — εδώ ήδη ο διακόπτης χώρου (ADR-820)· επίπεδα **εγγράφου** (κτίριο/όροφος/μονάδα) σε προσαρτώμενο δέντρο. Κανείς δεν το έχει ως ωμό σύνδεσμο έξω από τον κατάλογο |

#### Αποφάσεις

| # | Απόφαση | Λόγος |
|---|---|---|
| Υ9 (Π2) | `(app)/layout.tsx`: `SidebarInset as="div"`. Ο **μόνος** `<main>` του κελύφους είναι ο `MainContentBridge` (ήδη ιδιοκτήτης του διαδρόμου, ADR-797). `data-shell-inset` και σχέση αδελφού με τη στήλη **αμετάβλητα** (CHECK 3.63) | ένα ορόσημο `main` ανά σελίδα (HTML: «no more than one visible `main`»). Οι σελίδες με δικό τους `main` → ratchet, όχι στο πόδι |
| Υ10 (Π3) | **Προτίμηση + επικάλυψη καμβά, δύο διαφορετικά πράγματα.** Το `SidebarProvider` παίρνει `canvasMode?: boolean` (**ζωντανό**, ακολουθεί τη διαδρομή). Όσο ισχύει: η στήλη ξεκινά κλειστή σε **κάθε** είσοδο, ο χρήστης μπορεί να την ανοίξει προσωρινά, και **τίποτα δεν γράφεται στο cookie**. Στην έξοδο επιστρέφει η αποθηκευμένη προτίμηση. Το `(app)` περνά `restoreFromCookie` + `canvasMode={isSidebarCollapsedRoute(pathname)}` και **σταματά** να δίνει `defaultOpen` από τη διαδρομή. Το `href === '/dxf/viewer'` του `sidebar-menu-item.tsx` **διαγράφεται** (Β6) | Figma/VS Code: ο καμβάς είναι επικάλυψη. Αποφεύγει δομικά το bug «η εναλλαγή μέσα στη λειτουργία διαρρέει στην προτίμηση». Μία λίστα διαδρομών καμβά αντί για δύο. Επειδή το `pathname` υπάρχει και στο SSR, ο καμβάς είναι κλειστός από το **πρώτο** καρέ |
| Υ11 (Π1) | **Μία** καθαρή συνάρτηση `resolveActiveNavigation(items, pathname)` (νέο `src/components/sidebar/active-navigation.ts`, jest χωρίς React): υποψήφια = κάθε href στοιχείου **και** υπο-στοιχείου, σε **όλες** τις ενότητες μαζί· κερδίζει η μακρύτερη αντιστοίχιση σε **όριο τμήματος** (`/crm` ≠ `/crmx`)· σε ισοπαλία κερδίζει το υπο-στοιχείο. Επιστρέφει `{ activeHref, activeParentTitle }` — ο γονιός από τη **δηλωμένη** σχέση. Το `useSidebarState(items)` ανοίγει αυτόματα τον γονιό του ενεργού σε κάθε αλλαγή διαδρομής (ο χρήστης μπορεί ακόμη να τον κλείσει). **Οπτικά**: υπο-στοιχείο ενεργό = πλήρης φωτισμός + `aria-current="page"` (στο primitive `SidebarMenuSubButton` και στους συνδέσμους του popover)· γονιός **ανοιχτός** = διακριτική ένδειξη (εικονίδιο `text-primary`, όχι φόντο — το ενεργό φαίνεται από κάτω)· γονιός **κλειστός** ή στήλη **συμπτυγμένη** = πλήρης φωτισμός στον γονιό (Carbon roll-up: ο φωτισμός εκεί όπου **φαίνεται** η τρέχουσα σελίδα). `aria-expanded` στο κουμπί-γονιό | APG + Primer + Carbon. **Εξυπνότερο από το κοινό** «ο γονιός φωτίζεται πάντα»: ο φωτισμός ακολουθεί την ορατότητα, οπότε σε κάθε στιγμή υπάρχει **ακριβώς ένα** φωτισμένο στοιχείο στην οθόνη |
| Υ12 (Π4) | Ο ωμός σύνδεσμος **φεύγει από το `AppSidebar`** και ο περιηγητής μπαίνει στον **κατάλογο** του factory (ομάδα `tools`, πρώτη θέση, ίδιο εικονίδιο `MapPin`, ίδιο κλειδί `pages.navigation`): περνά από το σύνορο `Link` (CHECK 3.61), παίρνει `aria-current`, φίλτρο δικαιωμάτων/δουλειάς και προφόρτωση. Η πρακτική των μεγάλων (**προσαρτώμενο πάνελ δέντρου** δίπλα στο περιεχόμενο) είναι **νέο χαρακτηριστικό**, όχι διόρθωση — προτείνεται ως ξεχωριστό ADR, απόφαση Giorgio | ό,τι είναι στη στήλη βγαίνει από **έναν** κατάλογο (ADR-871 §5). Ο διακόπτης μίσθωσης (οργανισμός) υπάρχει ήδη στην κεφαλίδα (ADR-820) — δεν διπλασιάζεται |

### 10.6 Παράπλευρα του §9 — Φάση Β (Π6): ΕΝΑ συμβόλαιο «στοιχείου μενού» — audit, έρευνα, αποφάσεις (γράφτηκαν **ΠΡΙΝ** τον κώδικα, 2026-09-21)

Οδηγία Giorgio: «όπως οι μεγάλοι, χωρίς καμία έκπτωση — κι αν γίνεται, εξυπνότερα».

#### Audit (grep, όχι ο χάρτης του handoff)

| # | Εύρημα | Συνέπεια |
|---|---|---|
| Γ1 | Ο χάρτης του handoff ήταν **εν μέρει μπαγιάτικος**: το `MenuItem` του `config/navigation.ts` έχει **ήδη** `href: WorkspaceHref` (commit `ba8ecada`, ADR-787 Γ5). Όμως οι σταθερές/συναρτήσεις του γεμίζουν από το factory, που επιστρέφει το **τοπικό** `MenuItem` με `href: string` ⇒ `mainMenuItems: MenuItem[] = createMainMenuItems(…)` είναι ανάθεση `string → WorkspaceHref`, δηλαδή **τυπικό λάθος στη σημερινή κεφαλή** (6 σημεία). Η baseline `.ts-error-baseline.json` είναι **μόνο αριθμός** (3005, 2026-01-13) — δεν λέει ποια αρχεία | η σύγκλιση δεν είναι «ωραιοποίηση»: κλείνει λάθη που ήδη υπάρχουν. Και τα fixtures των tests της Φάσης Α (`active-navigation.test.ts`, `sidebar-menu-item-active.test.tsx`) γράφουν `href: '/legal-documents'` σε αυστηρό `MenuItem` = ίδιο λάθος |
| Γ2 | **Πέντε** (όχι τέσσερις) δηλώσεις σχήματος: `types/sidebar.ts` (`MenuItem`+`SubMenuItem`, με `warningDot`) · `config/navigation.ts` (`MenuItem`, αναδρομικό `subItems: MenuItem[]`, **χωρίς** `warningDot`) · factory: τοπικό `MenuItem` (`href: string`) · `SmartNavigationItem` · `NavigationConfigBase`. Και `as SmartNavigationItem` ×5 μέσα στο factory | ένα σχήμα, μηδέν `as` |
| Γ3 | Μετρήθηκαν **όλα** τα 65 κυριολεκτικά href του factory απέναντι στον κατάλογο διαδρομών που παράγει το Next (`.next/types/routes.d.ts`): **64 υπάρχουν**, **1 όχι** — το `/legal-documents` (ήδη τεκμηριωμένο νεκρό, `jobs-registry.ts` `LEGAL_DOCUMENTS_STATUS`, απόφαση 2026-08-02) | ο αυστηρός τύπος θα το απέρριπτε — σωστά |
| Γ4 | 🔑 **Ο γονιός-ομάδα ΔΕΝ είναι σύνδεσμος.** Με υπο-στοιχεία, το `SidebarMenuItem` αποδίδει **πάντα** `SidebarMenuButton` (ανοιχτή στήλη) ή `PopoverTrigger` (συμπτυγμένη) — **ποτέ** `Link`. Το `href` του γονιού χρησιμεύει μόνο ως **ταυτότητα** (κλειδί `hiddenSubItems`, `demotedClass`, κλειδί δουλειάς) και ως **υποψήφιο ενεργού** | ο τύπος λέει «διεύθυνση» για κάτι που είναι **ταυτότητα**. Γι' αυτό το `/legal-documents` δεν έδωσε ποτέ 404 στη στήλη: δεν πλοηγεί |
| Γ5 | Οι σελίδες-ρίζες των ομάδων: `/spaces` (`SpacesHub`) · `/sales` (`SalesHub`) · `/accounting` = **hubs**, **απρόσιτα από τη στήλη** (ο γονιός είναι κουμπί, και δεν είναι παιδιά). Το `/crm` (`CrmHub`) και το `/reports` (`ReportsExecutive`) τα έχουν **ήδη** ως πρώτο παιδί («Επισκόπηση» / «Διοικητική Σύνοψη»). Το `/settings` είναι **ανακατεύθυνση** (`ACCOUNT_ROUTES.preferences`) | ασυνέπεια: δύο ομάδες δίνουν πόρτα στο hub τους, τρεις όχι |
| Γ6 | Οι τίτλοι **συμπεραίνονται από το href**: `href.replace('/','')` → `getLabelKeyForPath` (~100 γρ. πίνακας διαδρομή→λογικό όνομα) → `NAVIGATION_LABELS` (λογικό όνομα→κλειδί i18n), με κανόνα `_overview` όταν παιδί = γονιός. Τρία βήματα έμμεσης αναφοράς· το CHECK 3.11 (`check-navigation-labels.js`) υπάρχει **μόνο** για να επαληθεύει ότι η αλυσίδα δεν έσπασε. Το `SidebarMenuItem` έχει `translateTitle` με «αν δεν έχει τελεία, δείξ' το όπως είναι» — γιατί ο τίτλος μπορεί να καταλήξει στο ίδιο το href | ο τίτλος πρέπει να είναι **δηλωμένος** — τότε η αλυσίδα, ο πίνακας και ο μισός έλεγχος 3.11 φεύγουν |
| Γ7 | 🔴 **Το `environments` ΔΕΝ εφαρμόζεται ΠΟΥΘΕΝΑ.** Το `filterItemsByPermissions` ελέγχει μόνο `permissions`. Το «Debug» (`/debug`, `environments: ['development']`) **εμφανίζεται στην παραγωγή** σε όποιον έχει `admin_access`· η σελίδα `(app)/debug/page.tsx` δεν έχει δικό της φρουρό | πραγματικό ελάττωμα, όχι θεωρία. Διορθώνεται στο **ένα** φίλτρο του καταλόγου |
| Γ8 | Νεκρή ρύθμιση: `analyticsKey` · `featureFlag` · `metadata` · `maxItems` · `conditionalItems` (πάντα `{}`) · `getNavigationStats` · `validateNavigationConfig` · `findNavigationItemByPath` · `debugNavigationFactory` · οι σταθερές `mainMenuItems`/`toolsMenuItems`/`settingsMenuItem` + `default export` του `navigation.ts` — **μηδέν** αναγνώστες έξω από το factory (grep) | διαγράφονται (δεν «συντηρούνται για ώρα ανάγκης») |
| Γ9 | Το σύστημα δουλειών (ADR-748) **ταξινομεί γονείς με τη διαδρομή τους**: `JOBS[job].sidebar` = `'/spaces'`, `'/sales'`, `'/crm'`, `'/accounting'`· `COMMON_SIDEBAR_ROUTES` ∋ `'/settings'`· `REPORTS_PARENT_ROUTE = '/reports'`· `hiddenSubItems`/`hiddenHrefs` με κλειδί το href του γονιού. Καταναλωτές: `jobs-registry` · `jobs-visibility` · `job-suggestion` · `jobs-access` · `navigation-capability` · `useJobFilteredNavigation` · `JobSwitch` · `DeclaredOccupationBadge` · `JobSuggestion` · `sidebar-menu-item` + 4 σουίτες | η ταυτότητα της ομάδας αγγίζει **και** το ADR-748 — δεύτερο domain |
| Γ10 | Το `useSidebarState` κρατά τις ανοιχτές ομάδες με κλειδί τον **τίτλο** (`onToggleExpanded(item.title)`) και το `resolveActiveNavigation` επιστρέφει `activeParentTitle` | ο τίτλος είναι κείμενο παρουσίασης, όχι ταυτότητα — αλλάζει με μια μετάφραση |
| Γ11 | Ο factory είναι **1.173 γραμμές** (N.7.1: >500 ⇒ υποχρεωτικό split όταν αγγίζεται) | split κατά ευθύνη |

#### Έρευνα (2026-09-21)

| Θέμα | Πηγή | Συμπέρασμα |
|---|---|---|
| Γονιός-ομάδα | **GitHub Primer NavList**: «If the item contains a sub-nav, the item is rendered as a `<button>` and `href` is ignored» · **IBM Carbon**: `SideNavMenu` (κουμπί, χωρίς `href`) ≠ `SideNavMenuItem`/`SideNavLink` (σύνδεσμος)· ο γονιός «ενεργός» μέσω `hasActiveDescendant` · **Atlassian navigation-system**: `ExpandableMenuItem` (trigger) ≠ `LinkMenuItem` · WAI-ARIA APG *Disclosure Navigation*: κουμπί ομάδας με `aria-expanded` | **ομοφωνία**: σύνδεσμος και ομάδα είναι **δύο διαφορετικά είδη**. Η ομάδα **δεν** έχει διεύθυνση· το ενεργό της **προκύπτει** από τους απογόνους — [Primer](https://primer.style/product/components/nav-list/) · [Carbon](https://github.com/carbon-design-system/carbon/pull/3303) · [Atlassian](https://atlassian.design/components/navigation-system/side-nav-items) |
| Κατάλογος ως δεδομένα με αυστηρούς τύπους | **Next.js typedRoutes** — «You can also type a simple data structure and iterate to render links: `navItems: NavItem<Route>[]`» · TanStack Router `linkOptions` (δηλωμένα δεδομένα συνδέσμου, ελεγμένα στη δήλωση) | ο κατάλογος ελέγχεται **στο σημείο δήλωσης** (`satisfies`), όχι στο σημείο κλήσης. Εμείς έχουμε ήδη το ισοδύναμο: `WorkspaceHref` (ADR-787 Γ5) — [nextjs.org/docs/…/typescript](https://nextjs.org/docs/app/api-reference/config/typescript) |
| Σελίδα-ρίζα ομάδας | Primer/Carbon: αφού ο γονιός δεν πλοηγεί, η σελίδα-επισκόπηση είναι **ρητό** πρώτο παιδί· εδώ **ήδη** έτσι στο CRM («Επισκόπηση») και στις Αναφορές | το ίδιο μοτίβο και για Χώρους · Πωλήσεις · Λογιστήριο — **ορατή** αλλαγή: τρεις νέες γραμμές «Επισκόπηση», που κάνουν **προσβάσιμα** τρία hubs |
| Ετικέτες | Primer / Atlassian / Next `navItems` / ο δικός μας `personal-navigation.ts` (`labelKey`): η ετικέτα **δηλώνεται** δίπλα στον προορισμό | κανένας δεν τη συμπεραίνει από το URL |

#### Αποφάσεις

| # | Απόφαση | Λόγος |
|---|---|---|
| Υ13 | **ΕΝΑ συμβόλαιο, διακριτή ένωση**, στο `src/types/sidebar.ts`: `MenuLink { kind: 'link'; titleKey; icon; href: WorkspaceHref; badge?; warningDot? }` · `MenuGroup { kind: 'group'; id; titleKey; icon; badge?; items: readonly MenuLink[] }` · `MenuEntry = MenuLink \| MenuGroup`. Διαγράφονται οι άλλες τέσσερις δηλώσεις. Σύνδεσμος με παιδιά ή ομάδα με διεύθυνση = **αδύνατη κατάσταση**, όχι έλεγχος | Primer / Carbon / Atlassian (Γ4). Το `/legal-documents` **λύνεται μόνο του**: η ομάδα «Νομικά» δεν ισχυρίζεται πια ότι είναι σελίδα |
| Υ14 | **Κλειδί κόμβου** `menuEntryKey(entry)` = `href` για σύνδεσμο, `id` για ομάδα. Τα `id` είναι **κλειστή ένωση χωρίς `/`** (`OfficeGroupId`: `spaces · sales · crm · reports · accounting · legal · settings`) ⇒ **δομικά** ξένα προς κάθε href. Το ADR-748 (`JOBS[job].sidebar`, `COMMON_SIDEBAR_ROUTES`, ο γονιός των αναφορών, `hiddenSubItems`/`hiddenHrefs`) μιλά **κλειδιά κόμβου** αντί για «διαδρομή γονιού» | η ταυτότητα της ομάδας γίνεται **ρητή**. Καμία αλλαγή στην ταξινόμηση: κάθε `'/spaces'` γίνεται `'spaces'` κ.ο.κ., ένα-προς-ένα |
| Υ15 | **Hubs ως ρητά παιδιά «Επισκόπηση»**: Χώροι → `/spaces` · Πωλήσεις → `/sales` · Λογιστήριο → `/accounting` (το CRM ήδη)· **ένα** κοινό κλειδί ετικέτας για «Επισκόπηση». Νομικά → ομάδα `legal` με παιδί `/obligations`. Ρυθμίσεις → ομάδα **χωρίς** παιδί-ρίζα (`/settings` είναι ανακατεύθυνση) | συνέπεια με CRM/Αναφορές (Γ5) + η πρακτική Primer/Carbon. ⚠️ **Ορατή** αλλαγή, δηλωμένη |
| Υ16 | **Δηλωμένοι τίτλοι** (`titleKey`) σε κάθε στοιχείο· διαγράφονται `NAVIGATION_LABELS`, `getLabelKeyForPath`, ο κανόνας `_overview` και το «χωρίς τελεία ⇒ ωμό» του `translateTitle`. Το CHECK 3.11 **ξαναγράφεται** ώστε να ρωτά το σωστό ερώτημα: «υπάρχει κάθε `titleKey` του καταλόγου σε `el` **και** `en`;» | Γ6 — τρία βήματα έμμεσης αναφοράς γίνονται μηδέν |
| Υ17 | **Split του factory** κατά ευθύνη (<500 γρ. το καθένα): δεδομένα καταλόγου ανά μενού (main · tools · settings, με `satisfies` πάνω στο συμβόλαιο) · μηχανή (φίλτρα + ταξινόμηση) · ταυτότητες ομάδων. Το `config/navigation.ts` (λεπτό περιτύλιγμα με νεκρές σταθερές, Γ8) **συγχωνεύεται** στη μηχανή | N.7.1 · SRP |
| Υ18 | **Το `environments` επιβάλλεται** στο **ένα** φίλτρο της μηχανής (Γ7) — το «Debug» φεύγει από την παραγωγή. Διαγράφεται η νεκρή ρύθμιση του Γ8 | ό,τι δηλώνεται **επιβάλλεται**, ή δεν δηλώνεται |
| Υ19 | **Κενή ομάδα δεν αποδίδεται**: μετά από **όλα** τα φίλτρα (δικαίωμα · περιβάλλον · ικανότητα · δουλειά), μία κανονικοποίηση αφαιρεί ομάδα χωρίς ορατά παιδιά — ένα σημείο, όχι ανά φίλτρο | κουμπί που ανοίγει το τίποτα είναι ψέμα της διεπαφής |
| Υ20 | Ανοιχτές ομάδες και «γονιός του ενεργού» με κλειδί το **`id`** της ομάδας, όχι τον τίτλο (Γ10): `resolveActiveNavigation` → `{ activeHref, activeGroupId }` | ταυτότητα ≠ κείμενο παρουσίασης |
| Υ21 | **Δίχτυ ασφαλείας πέρα από τους μεγάλους** — επειδή ο πράκτορας δεν τρέχει `tsc` (N.17), η ορθότητα αποδεικνύεται με **jest που εκτελεί τον κατάλογο**: *(α)* **χρυσή ισοδυναμία**: πριν αγγιχτεί ο κώδικας καταγράφεται το σημερινό αποτέλεσμα (κλειδί τίτλου, href, σειρά) για main/tools/settings × περιβάλλοντα × σύνολα δικαιωμάτων· μετά την αλλαγή πρέπει να είναι **ίδιο**, εκτός από τις **δηλωμένες** διαφορές Υ15/Υ18· *(β)* ακεραιότητα: μοναδικά κλειδιά κόμβων, κανένα `titleKey` χωρίς μετάφραση σε `el`/`en`, κάθε κλειδί του `JOBS`/`COMMON_SIDEBAR_ROUTES` **υπάρχει** στον κατάλογο (αλλιώς η ταξινόμηση θα έδειχνε σε φάντασμα)· *(γ)* μετάλλαξη σε κάθε κανόνα | οι μεγάλοι έχουν μεταγλωττιστή στο CI· εμείς έχουμε **και** εκτελούμενη απόδειξη πριν το CI |
| Υ22 | *(προέκυψε στην υλοποίηση)* Το πεδίο ετικέτας ονομάζεται **`navLabelKey`**, όχι `titleKey` (το Υ16 ισχύει κατά τα άλλα αυτούσιο) | ο γεννήτορας του shell slice (ADR-744) λύνει κάθε `t(x.<όνομα>)` του κελύφους με **όλα** τα κυριολεκτικά `<όνομα>:` του κελύφους. Το `titleKey` το διαβάζει ήδη το product tour ⇒ οι ετικέτες μενού θα γίνονταν «υποψήφιες» εκεί. Μοναδικό όνομα = οι ετικέτες του μενού πάνε **μόνο** στις κλήσεις του μενού. Ίδιο όνομα και στα στοιχεία του προσωπικού καταλόγου |
| Υ23 | *(προέκυψε στην υλοποίηση)* **Διόρθωση ρίζας στον γεννήτορα i18n**: ακριβές κλειδί που λύνεται σε **αντικείμενο** δεν αντιγράφει πια το υπο-δέντρο (`slice-build.js` `pruneNamespace`) | το `id: 'sales'` της ομάδας έσερνε ολόκληρο το `common-sales` στο κέλυφος. Το `t()` δεν επιστρέφει ποτέ αντικείμενο — υπο-δέντρο εκφράζει μόνο το `prefixes`. **Μετρημένο** σε καθαρό worktree του HEAD: **0** διαφορετικά artifacts ⇒ αμιγώς προληπτική. ADR-744 changelog |
| Υ24 | *(προέκυψε στην υλοποίηση)* Η ομάδα «Αναφορές» παίρνει τίτλο **`pages.reports`** («Αναφορές») | ο συμπερασμός έδινε στην **ομάδα** το κλειδί του πρώτου παιδιού της ⇒ εμφανιζόταν «Διοικητική Σύνοψη» δύο φορές στη σειρά. Τρίτο ορατό ελάττωμα του συμπερασμού (μετά το Γ5, Γ7). Δηλωμένη διαφορά της χρυσής ισοδυναμίας |
| Υ25 | *(προέκυψε στην υλοποίηση)* Το `sidebar-menu-item.tsx` (ένα component με 4 κλάδους) χωρίστηκε **κατά είδος**: σύνδεσμος (`sidebar-menu-item.tsx`) · ομάδα (`sidebar-menu-group.tsx`) · κοινά (`sidebar-menu-shared.tsx`, ένα σώμα για υποβάθμιση/ετικέτα/κουκκίδα/προφόρτωση) | N.7.1 (40 γραμμές ανά συνάρτηση) · N.18 — η διακλάδωση γίνεται στο `kind`, όχι στο «έχει `subItems`;» |

### 10.7 Φάση Β — αρχεία (ΥΛΟΠΟΙΗΘΗΚΕ 2026-09-22)

| Αρχείο | Τι |
|---|---|
| `src/config/navigation-node.ts` *(νέο)* | δομικός κόμβος `NavLinkNode` / `NavGroupNode` · `navNodeKey` · `isNavGroup` (type guard — στενεύει γενικούς τύπους χωρίς `as`) · `withGroupItems` (ο ΕΝΑΣ κανόνας κενής ομάδας) |
| `src/types/sidebar.ts` | **ΤΟ ΕΝΑ συμβόλαιο**: `MenuLink` · `MenuGroup` · `MenuEntry` (−`MenuItem`, −`SubMenuItem`, −`MenuSection`) |
| `src/config/office-navigation/` *(νέο)* | `catalog-types.ts` (`OFFICE_GROUP_IDS`, `SidebarNodeKey`, `NavPolicy`) · `catalog-main/tools/settings.ts` (δεδομένα `as const satisfies`) · `resolve-office-navigation.ts` (η μηχανή) |
| 🗑️ `src/config/smart-navigation-factory.ts` (1.173 γρ.) · `src/config/navigation.ts` | διαγράφηκαν — μαζί η νεκρή ρύθμιση του Γ8 |
| `src/config/jobs-registry.ts` · `jobs-visibility.ts` · `job-suggestion.ts` · `navigation-capability.ts` · `src/hooks/useJobFilteredNavigation.ts` | ADR-748: κλειδί κόμβου (βλ. changelog ADR-748 2026-09-22) |
| `src/components/sidebar/active-navigation.ts` · `src/hooks/useSidebarState.ts` · `sidebar-menu-section.tsx` · `sidebar-menu-item.tsx` · `sidebar-menu-group.tsx` *(νέο)* · `sidebar-menu-shared.tsx` *(νέο)* · `src/components/app-sidebar.tsx` | UI πάνω στο `kind` (Υ20, Υ25) |
| `src/config/personal-navigation.ts` · `src/components/header/user-menu.tsx` | ο προσωπικός κατάλογος μιλά `MenuLink` + `navLabelKey` |
| `src/i18n/locales/{el,en}/navigation.json` · `src/types/i18n.ts` · `src/i18n/generated/*` · `.i18n-shell-slice.json` | + `menu.overview` · − `crm.overview` · γεννήτορες 3.33/3.34 · −2 νεκρές δηλώσεις |
| `scripts/lib/i18n-shell-slice/slice-build.js` | Υ23 (ADR-744) |
| `scripts/check-navigation-labels.js` · `scripts/git-hooks/pre-commit` · `scripts/run-checks-parallel.js` | CHECK 3.11 ξαναγραμμένο: `navLabelKey` → locale, χωρίς τυφλό σημείο (μη-αναγνώσιμη τιμή ⇒ μπλοκ) |
| `.ssot-registry.json` · `scripts/lib/ssot/pattern-proofs.js` · `scripts/__tests__/registry-golden-regex.test.js` | − `smart-navigation-factory`, − `navigation-config` · + `office-navigation`, + `menu-item-contract` **με** απόδειξη · ταβάνι 600 → 599 (ήταν 602 = κόκκινο στο HEAD) |
| tests | νέα: `office-navigation-golden.test.ts` (+ `office-navigation.golden.json`, λήψη ΠΡΙΝ τον κώδικα) · `office-navigation-integrity.test.ts` · `__tests__/helpers/nav-node-fixtures.ts`· ενημερωμένα: jobs-visibility · jobs-access · jobs-registry · job-suggestion · navigation-capability · navigation-showcase-door · personal-navigation · active-navigation · sidebar-menu-item-active · i18n-shell-slice |

---

## 11. Changelog

| Ημερομηνία | Αλλαγή |
|---|---|
| 2026-09-21 | Δημιουργία. Έρευνα αγοράς (Notion, Linear, Figma, GitHub, Google Drive, Vercel, Canva, Atlassian, Airbnb, Etsy, Fiverr, Procore/ACC· NN/g, Material 3, Apple HIG) + σάρωση κώδικα τριών πρακτόρων (απογραφή διαδρομών, αρχιτεκτονική sidebar/κελύφους, πύλες). Απόφαση προτεινόμενη: υβριδικό sidebar μόνο στο `(me)`. Κανένας κώδικας |
| 2026-09-21 | **Διευκρινιστικός γύρος με τον Giorgio — Ε1-Ε5 όλα «Α» (οι προτάσεις του ADR εγκρίθηκαν αυτούσιες).** Ε1 στήλη μόνο στο `(me)` · Ε2 «Ζητώ/Προσφέρω» κρύβονται όπου υπάρχει στήλη · Ε3 «Αναζήτηση ακινήτων» + «Επαγγελματίες» στη στήλη · Ε4 χωριστή μνήμη σύμπτυξης ανά χώρο · Ε5 συντομεύσεις μένουν στο μενού avatar από **ΕΝΑΝ** κοινό κατάλογο. Status: PROPOSED → **ACCEPTED** (σχεδιασμός). Κανένας κώδικας ακόμη |
| 2026-09-21 | **SSoT audit + έρευνα, γραμμένα ΠΡΙΝ τον κώδικα (§10.1-10.3).** Ευρήματα: το cookie `sidebar_state` δεν διαβαζόταν ποτέ (Α3)· το `SidebarInset` ήταν σκληρό `<main>` ενώ οι σελίδες του `(me)` έχουν δικό τους (Α4)· κανένα `aria-current` στις στήλες (Α8)· «Ποιοι με πλησίασαν» ήδη καρτέλα ⇒ όχι υπο-στοιχείο (Α9)· καμία πηγή μετρητή αδιάβαστων ⇒ όχι badge (Α10)· ενοποίηση τύπων μενού γραφείου εκτός εμβέλειας (Α11). Έρευνα: WAI-ARIA APG (`aria-current`, όχι `role="menu"`)· shadcn cookie + issue #9189 ⇒ επαναφορά στον πελάτη αντί για `cookies()` (Υ1) |
| 2026-09-21 | **ΥΛΟΠΟΙΗΣΗ (§10.4).** Κατάλογος + στήλη + ένθεση + κεφαλίδα (Ε2) + `UserMenu` από τον κατάλογο (Ε5, νέα σειρά Υ4) + χωριστή μνήμη σύμπτυξης (Ε4, με **πραγματική** επαναφορά) + `aria-current` στο primitive + `SidebarInset as`. Προέκυψαν Υ7 (trigger σε δικό του module) και Υ8 (`defaultOpen` μία φορά). Jest: 22 νέα + 91 υπάρχοντα σχετικά πράσινα· μετάλλαξη του `hasOrganization` στον κατάλογο ⇒ κόκκινο. Πύλες τοπικά: 3.28 · 3.33 · 3.34 · 3.47 · 3.52 · 3.61 · 3.63 · 3.71 · 3.72 πράσινες. ⚠️ `i18n-namespace-attribution.test.js` Π2 κόκκινο σε `/privacy-policy`·`/terms`·`/data-deletion` (κλειδιά `privacyPolicy.*` κ.λπ.) — **άσχετο** με αυτή την αλλαγή: τα αρχεία του είναι ίδια σε HEAD/index/δίσκο και καμία σελίδα/κλειδί του δεν αγγίχθηκε. ⏳ Ζωντανή επαλήθευση **δεν** έγινε (ο dev server απαντά 403 σε curl, ο browser-πράκτορας δεν διάβασε τη σελίδα) |
| 2026-09-21 | **Ζωντανή επαλήθευση (στιγμιότυπο Giorgio, `/offers`, desktop, μέλος γραφείου).** ✅ στήλη + ομάδες + ενεργό «Τα ακίνητά μου» · «Δημιουργώ χώρο» σωστά απόν για μέλος γραφείου · «Ζητώ/Προσφέρω» κρυμμένα · νέα σειρά στο μενού avatar. 🔴 **Ελάττωμα που διορθώθηκε**: το ☰ καθόταν στη **μέση** της οθόνης — η κεφαλίδα κρατούσε το `mx-auto max-w-5xl` του δημόσιου ιστότοπου· με στήλη πλέον απλώνεται σε όλο το inset (όπως το `AppHeader`). ✅ **Απόφαση Giorgio (τροποποιεί το Ε2)**: η «Καταχώριση αγγελίας» εμφανιζόταν **δύο φορές** (κορυφή στήλης + κεφαλίδα) ⇒ με στήλη **κρύβεται από την κεφαλίδα από `md` και πάνω**· στο κινητό μένει (η στήλη είναι συρτάρι). Στο `(light)` αμετάβλητη |
| 2026-09-21 | **Επαλήθευση κινητού με jest** (`private-space/__tests__/personal-sidebar-mobile.test.tsx`, 6 tests, `useIsMobile` = true): ☰ ανοίγει το συρτάρι · σύνδεσμος **και** κύρια πράξη το κλείνουν · Esc το κλείνει. 🔴 **Βρέθηκε ελάττωμα προσβασιμότητας στο ΚΟΙΝΟ primitive**: το συρτάρι του κινητού (Radix Dialog) **δεν είχε τίτλο** — ο αναγνώστης οθόνης ανακοίνωνε «παράθυρο διαλόγου» χωρίς όνομα, **και στο γραφείο** (το Radix το κατήγγελλε σε κάθε άνοιγμα). Θεραπεία: το `Sidebar` παίρνει **υποχρεωτικό** `label` ⇒ `SheetTitle` `sr-only` + `aria-describedby={undefined}`· `PersonalSidebar` → `personal.sidebarLabel`, `AppSidebar` → `menu.main` (υπάρχον κλειδί). Μετάλλαξη (αφαίρεση τίτλου) ⇒ Κ6 κόκκινο. ⚠️ Το jsdom δεν έχει διάταξη: ελέγχθηκε **συμπεριφορά**, όχι εμφάνιση |
| 2026-09-21 | **ΠΑΡΑΠΛΕΥΡΑ ΦΑΣΗ Α (§10.5, Π1-Π4) — ΥΛΟΠΟΙΗΣΗ.** Διόρθωση συντακτικού λάθους JSX στο `app-sidebar.tsx` (Β1). **Π2 (Υ9)**: `(app)` → `SidebarInset as="div"`, ο `MainContentBridge` είναι ο μόνος `main` του κελύφους· οι σελίδες με δικό τους `main` → `.claude-rules/pending-ratchet-work.md`. **Π3 (Υ10)**: `SidebarProvider` + `canvasMode` (ζωντανό)· το `(app)` περνά `restoreFromCookie` + `canvasMode={isSidebarCollapsedRoute(pathname)}` και **δεν** δίνει πλέον `defaultOpen`· διαγράφηκε το δίδυμο `href === '/dxf/viewer'` του `sidebar-menu-item.tsx` (Β6). **Π1 (Υ11)**: νέο `components/sidebar/active-navigation.ts` (`resolveActiveNavigation`, `containsActive`)· `useSidebarState(items)` → `activeHref` + αυτόματο άνοιγμα γονιού· `SidebarMenuSection`/`SidebarMenuItem` με `activeHref` αντί για `isItemActive`· `aria-current` στο primitive `SidebarMenuSubButton` και στους συνδέσμους του popover· `aria-expanded` στο κουμπί-γονιό· φωτισμός εκεί όπου φαίνεται η σελίδα. **Π4 (Υ12)**: `/navigation` στον κατάλογο `tools` του factory (`MapPin`, `pages.navigation`) + `COMMON_SIDEBAR_ROUTES`· ο ωμός `<a>` αφαιρέθηκε. Jest: 3 σουίτες (`active-navigation` 8 · `sidebar-menu-item-active` 5 · `sidebar-context` +5 Κ1-Κ5) + σχετικές (jobs, personal) = **151 πράσινα**. Μετάλλαξη: ισοπαλία→γονιός ⇒ 1 κόκκινο · ο καμβάς γράφει cookie ⇒ Κ2 κόκκινο · χωρίς αυτόματο άνοιγμα ⇒ 5 κόκκινα. Πύλες τοπικά: 3.28 · 3.52 · 3.61 · 3.63 · 3.70 πράσινες. ⏳ Ζωντανή επαλήθευση (Giorgio) |
| 2026-09-21 | **Ζωντανή επαλήθευση Φάσης Α (Chrome, dev, μέλος γραφείου, μετά το commit `f3f69888`).** ✅ `/contacts`: ένα `aria-current` στη στήλη («Επαφές»)· το δεύτερο της σελίδας είναι το τελευταίο στοιχείο του breadcrumb (σωστό κατά APG). ✅ `/crm/tasks`: μόνο «Εργασίες & Ραντεβού» ενεργό, το «CRM» **άνοιξε μόνο του** με `aria-expanded="true"` χωρίς πλήρη φωτισμό. ✅ Σύμπτυξη ⇒ ο φωτισμός ανεβαίνει στο εικονίδιο του CRM (roll-up). ✅ Σύμπτυξη + πλήρης επαναφόρτωση ⇒ μένει συμπτυγμένη (Π3). ✅ `/dxf/viewer`: κλειστή· άνοιγμα με ☰ μέσα στον καμβά ⇒ έξοδος στο `/crm/tasks` ⇒ η προτίμηση έμεινε «συμπτυγμένη» (η επικάλυψη **δεν** γράφει). ✅ Ένα `<main>` σε `/contacts`, `/crm/tasks`, `/dxf/viewer`. ✅ «Πλοήγηση» πρώτη στα «Εργαλεία», σύνδεσμος του καταλόγου. ℹ️ Στον DXF το `Ctrl+B` το κρατά ο καμβάς (ιδιοκτησία πληκτρολογίου, ADR-711)· η στήλη ανοίγει από το ☰ — όχι παλινδρόμηση αυτής της αλλαγής |
| 2026-09-21 | **ΦΑΣΗ Β (Π6) — SSoT audit + έρευνα + αποφάσεις, ΠΡΙΝ τον κώδικα (§10.6).** Ευρήματα: η σημερινή κεφαλή έχει ήδη τυπικά λάθη `string → WorkspaceHref` στο `navigation.ts` (Γ1)· **πέντε** δηλώσεις σχήματος (Γ2)· 64/65 href του factory υπάρχουν στον κατάλογο του Next, λείπει το `/legal-documents` (Γ3)· ο γονιός-ομάδα **δεν** είναι σύνδεσμος — το href του είναι ταυτότητα (Γ4)· τρία hubs απρόσιτα από τη στήλη (Γ5)· τίτλοι συμπεραίνονται από το href (Γ6)· 🔴 το `environments` δεν επιβάλλεται ⇒ «Debug» στην παραγωγή (Γ7)· νεκρή ρύθμιση (Γ8)· το ADR-748 κλειδώνει στο href του γονιού (Γ9). Έρευνα: Primer · Carbon · Atlassian (ομάδα = κουμπί χωρίς διεύθυνση) · Next typedRoutes (κατάλογος τυπωμένος στη δήλωση). Αποφάσεις Υ13-Υ21 — **εντολή Giorgio: η πρακτική των μεγάλων, χωρίς έκπτωση**. Κανένας κώδικας ακόμη |
| 2026-09-22 | **ΦΑΣΗ Β (Π6) — ΥΛΟΠΟΙΗΣΗ (§10.6 Υ13-Υ25, αρχεία §10.7).** **ΕΝΑ** συμβόλαιο `MenuLink \| MenuGroup` (ήταν πέντε δηλώσεις)· η ομάδα **δεν έχει διεύθυνση** (Primer/Carbon/Atlassian) ⇒ το `/legal-documents` λύθηκε μόνο του. Ο factory των 1.173 γρ. έγινε κατάλογος-δεδομένα (`as const satisfies`, σειρά = σειρά δήλωσης, δηλωμένοι τίτλοι `navLabelKey`) + μία μηχανή· διαγράφηκαν factory, `config/navigation.ts` και η νεκρή ρύθμιση. ADR-748 σε κλειδί κόμβου (ένα-προς-ένα). **Ορατές αλλαγές, όλες δηλωμένες**: +3 «Επισκόπηση» (Χώροι · Πωλήσεις · Λογιστήριο) · «Debug» όχι πια στην παραγωγή (Υ18 — το `environments` δεν επιβαλλόταν) · ομάδα «Αναφορές» = «Αναφορές», όχι «Διοικητική Σύνοψη» (Υ24) · κενή ομάδα δεν αποδίδεται. **Απόδειξη χωρίς `tsc`** (N.17): χρυσή ισοδυναμία με λήψη του παλιού factory **πριν** τον κώδικα (12 σενάρια, ίσα εκτός από 4 δηλωμένες διαφορές) + ακεραιότητα καταλόγου (Κ1-Κ7). Jest: **15 σουίτες / 373 πράσινα**. **Μετάλλαξη 6/6 κόκκινη**: environments · κενή ομάδα · κλειδί δουλειάς-φάντασμα · σειρά καταλόγου · ομάδα υποψήφια ενεργού · υπο-δέντρο στο shell slice. Πύλες τοπικά πράσινες: 3.11 (ξαναγραμμένο) · 3.28 · 3.33 · 3.34 · 3.52 · 3.61 · 3.63 · 3.70 · 3.71 · registry-golden. **Προέκυψαν** (Υ22-Υ25): σύγκρουση με τη συγκομιδή ιδιοτήτων του shell slice ⇒ `navLabelKey` + **διόρθωση ρίζας στον γεννήτορα** (ADR-744, 0 artifacts στο HEAD)· split του `sidebar-menu-item`. ⚠️ **Προϋπάρχοντα, ΟΧΙ αυτής της αλλαγής (μετρημένα σε καθαρό worktree του `13d15291`)**: `registry-golden` ταβάνι **602 > 600** (κόκκινο στο main — πλέον 599)· νεκρή δήλωση `dynamicKeyPolicy` του `product-tour-overlay.tsx`. ⏳ Ζωντανή επαλήθευση (Giorgio) |
| 2026-09-22 | **Κατά τα commits (δύο διορθώσεις ρίζας).** (1) `ReportSource` του ADR-748: `{ kind: 'node', key }` → **`{ kind: 'node', node }`** — ίδιο σχήμα με το `{ kind: 'job', job }`· το πεδίο δεν είναι κλειδί μετάφρασης, και ως `key:` η συγκομιδή ιδιοτήτων του shell slice το πρόσφερε στο `t(announceRef.key)` του `IconCountBadge` ⇒ `'sales'` ⇒ όλο το `common-sales` στο κέλυφος (CHECK 3.34). (2) Ενεργό στοιχείο στήλης (ADR-770, CHECK 3.38): το στυλ ζει **μόνο** στο `SidebarMenuButton` (`data-[active=true]`) — αφαιρέθηκαν τα διπλά `bg/text-sidebar-accent` στα `sidebar-menu-{group,item}` και το `text-primary` του εικονιδίου (1,00:1 στο σκοτεινό θέμα)· το εικονίδιο κληρονομεί το `text-sidebar-accent-foreground`. Jest: sidebar 13/13 · jobs-access 56/56 · jobs/office-navigation πράσινα |
| 2026-09-22 | **ΦΑΣΗ Γ (Π5) — badge αδιάβαστων στο «Μηνύματα».** Η απόφαση γράφτηκε στο **ADR-867 §4.5 (Β10)**, πριν τον κώδικα (audit + έρευνα Intercom/Gmail/Slack/Firebase/a11y). Χωρίς μετρητή: γραμμή ανά αδιάβαστο νήμα, γραμμένη από τον έναν γραφέα στις τέσσερις μεταβάσεις, και ο αριθμός είναι το πλήθος των γραμμών (ζωντανά, οροφή 100 ⇒ «99+» / «τουλάχιστον 100» στον αναγνώστη οθόνης). Στη στήλη: `MenuLink.countSource` + `MenuCountBadge` (στήλη ανοιχτή/συμπτυγμένη + μενού avatar) + θέση `inline-end` στο `IconCountBadge`. Το Α10 του §10.1 έκλεισε |
