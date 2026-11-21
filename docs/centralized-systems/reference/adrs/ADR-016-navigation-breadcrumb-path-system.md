# ADR-016: Navigation Breadcrumb Path System

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Updated** | 2026-03-12 |
| **Category** | UI Components |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

Δύο τύποι breadcrumb καλύπτουν **κάθε σελίδα** της εφαρμογής:

| Τύπος | Component | Χρήση |
|-------|-----------|-------|
| **Entity Breadcrumb** | `NavigationBreadcrumb` | Entity hierarchy: Company → Project → Building → Unit |
| **Module Breadcrumb** | `ModuleBreadcrumb` | Module path: Αρχική → CRM → Εργασίες |

---

## 1. NavigationBreadcrumb (Entity Hierarchy)

- **File**: `src/components/navigation/components/NavigationBreadcrumb.tsx`
- **Context**: `syncBreadcrumb()` from `NavigationContext`
- **Type**: `BreadcrumbEntityRef` (lightweight display-only)
- **Ιεραρχία**: Companies → Projects → Buildings → Units/Storage/Parking
- **URLs**: Via `ContextualNavigationService.generateRoute()`

### Σελίδες που χρησιμοποιούν NavigationBreadcrumb

| Route | Header Component |
|-------|------------------|
| `/navigation` | NavigationBreadcrumb + NavigationTree |
| `/projects` | ProjectsHeader.tsx |
| `/buildings` | BuildingsHeader.tsx |
| `/units` | UnitsHeader.tsx |
| `/spaces/parking` | ParkingsHeader.tsx |
| `/spaces/storage` | StoragesHeader.tsx |
| `/properties` | PropertiesHeader.tsx |
| `/files` | FileManagerPageContent.tsx |
| `/sales/available-*` | SalesAvailableHeader.tsx |

---

## 2. ModuleBreadcrumb (Module Path)

- **File**: `src/components/shared/ModuleBreadcrumb.tsx`
- **Pattern**: Auto-generates breadcrumb from URL path via `usePathname()`
- **i18n**: `navigation.module.*` keys (EL + EN)
- **Visual**: Colored lucide icons per module, `→` separator (matches NavigationBreadcrumb), `hidden sm:flex`
- **Placement**: INSIDE page headers (PageHeader `breadcrumb` prop, or manual `<header>` elements)

### Route → Breadcrumb Mapping

```
/crm                     → 🏠 Αρχική → 📊 CRM
/crm/tasks               → 🏠 Αρχική → 📊 CRM → 📋 Εργασίες
/crm/calendar            → 🏠 Αρχική → 📊 CRM → 📅 Ημερολόγιο
/crm/leads               → 🏠 Αρχική → 📊 CRM → 🎯 Leads
/crm/pipeline            → 🏠 Αρχική → 📊 CRM → 🔀 Pipeline
/crm/communications      → 🏠 Αρχική → 📊 CRM → 📞 Επικοινωνίες
/sales                   → 🏠 Αρχική → 💲 Πωλήσεις
/spaces                  → 🏠 Αρχική → 🏗️ Χώροι
/obligations             → 🏠 Αρχική → ⚖️ Υποχρεώσεις
/contacts                → 🏠 Αρχική → 👥 Επαφές
/accounting              → 🏠 Αρχική → 🧮 Λογιστικό
/accounting/*            → 🏠 Αρχική → 🧮 Λογιστικό → [sub]
/account/profile         → 🏠 Αρχική → 👤 Λογαριασμός → Προφίλ
/account/preferences     → 🏠 Αρχική → 👤 Λογαριασμός → Προτιμήσεις
/account/privacy         → 🏠 Αρχική → 👤 Λογαριασμός → Απόρρητο
/account/security        → 🏠 Αρχική → 👤 Λογαριασμός → Ασφάλεια
/account/notifications   → 🏠 Αρχική → 👤 Λογαριασμός → Ειδοποιήσεις
/admin/ai-inbox          → 🏠 Αρχική → ⚙️ Διαχείριση → AI Inbox
/admin/operator-inbox    → 🏠 Αρχική → ⚙️ Διαχείριση → Operator Inbox
```

### Σελίδες + Τοποθέτηση

| Route | Placement | File |
|-------|-----------|------|
| `/crm` | Inside header div | `src/app/crm/page.tsx` |
| `/crm/tasks` | PageHeader `breadcrumb` prop | `src/app/crm/tasks/page.tsx` |
| `/crm/calendar` | Inside `<header>` element | `src/app/crm/calendar/page.tsx` |
| `/crm/leads` | Inside `<header>` wrapper | `src/app/crm/leads/page.tsx` |
| `/crm/pipeline` | Inside `<header>` wrapper | `src/app/crm/pipeline/page.tsx` |
| `/crm/communications` | PageHeader `breadcrumb` prop | `src/app/crm/communications/page.tsx` |
| `/sales` | Inside header div | `src/app/sales/page.tsx` |
| `/spaces` | Inside header div | `src/app/spaces/page.tsx` |
| `/obligations` | Inside `<header>` element | `src/app/obligations/page.tsx` |
| `/contacts` | ContactsHeader → PageHeader `breadcrumb` | `src/components/contacts/ContactsPageContent.tsx` |
| `/accounting` | Above (no header to target) | `src/app/accounting/page.tsx` |
| `/account/*` (5 pages) | Account layout `<header>` | `src/app/account/layout.tsx` |
| `/admin/ai-inbox` | AIInboxHeader → PageHeader `breadcrumb` | `src/app/admin/ai-inbox/AIInboxClient.tsx` |
| `/admin/operator-inbox` | PageHeader `breadcrumb` prop | `src/app/admin/operator-inbox/OperatorInboxClient.tsx` |

### Εξαιρέσεις (χωρίς breadcrumb)

- `/` — Home page (root)
- `/(auth)/*` — Login/auth pages
- `/share/*`, `/shared/*` — Public pages
- `/debug/*`, `/test-*`, `/demo/*` — Dev pages
- `/data-deletion`, `/privacy-policy`, `/terms` — Legal pages
- `/attendance/check-in/*` — Public QR page
- `/dxf/viewer` — Has its own DxfBreadcrumb

---

## API Reference

### useBreadcrumbSync (ADR-016 §3 — Centralized hook)

**File**: `src/components/navigation/core/hooks/useBreadcrumbSync.ts`

Centralizes `syncBreadcrumb()` calls across all entity pages. Each entity type uses the correct resolution strategy internally — callers pass only the entity descriptor.

```tsx
import { useBreadcrumbSync } from '@/components/navigation/core/hooks/useBreadcrumbSync';

// project
useBreadcrumbSync(selectedProject ? { type: 'project', id: selectedProject.id, name: selectedProject.name, companyId: selectedProject.companyId, linkedCompanyId: selectedProject.linkedCompanyId, company: selectedProject.company } : null);

// building
useBreadcrumbSync(selectedBuilding?.projectId ? { type: 'building', id: selectedBuilding.id, name: selectedBuilding.name, projectId: selectedBuilding.projectId } : null);

// property  (uses hierarchy API internally — Admin SDK, tenant-safe)
useBreadcrumbSync(selectedProperty ? { type: 'property', id: selectedProperty.id, name: selectedProperty.name } : null);

// space (parking / storage)
useBreadcrumbSync(
  selectedParking ? { type: 'space', id: selectedParking.id, name: selectedParking.number, spaceType: 'parking', buildingId: selectedParking.buildingId, projectId: String(selectedParking.projectId) } : null,
  { buildings }
);
```

**Resolution strategies per type:**

| Type | Strategy |
|------|----------|
| `project` | NavigationContext `projects` → resolved company name from bootstrap step 3.6 |
| `building` | NavigationContext `projects` → `project.company` name |
| `property` | Hierarchy API `/api/properties/[id]/hierarchy` (Admin SDK) — cancellable async |
| `space` | `options.buildings` (from `useFirestoreBuildings`) + NavigationContext `projects` |

### ModuleBreadcrumb

```tsx
import { ModuleBreadcrumb } from '@/components/shared/ModuleBreadcrumb';

<ModuleBreadcrumb className="px-6 pt-4" />
```

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string?` | Additional CSS classes |

### Adding a new route

Add the URL segment to `SEGMENT_CONFIG` in `ModuleBreadcrumb.tsx` (with `labelKey`, `icon`, and `color`) and add the corresponding i18n key to `navigation.module.*` in both `el/navigation.json` and `en/navigation.json`.

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-01 | Initial: NavigationBreadcrumb for entity hierarchy |
| 2026-03-12 | Added ModuleBreadcrumb for module/dashboard pages (18 pages) |
| 2026-03-12 | Fix: moved breadcrumb INSIDE headers, `→` separator, colored icons per module |
| 2026-04-24 | Added `useBreadcrumbSync` hook — centralized SSoT for all 5 entity page types (project/building/property/parking/storage). Eliminates per-page useEffect scatter. |
| 2026-10-04 | 🔴 **Στο breadcrumb δεν εμφανίζεται ποτέ η ταυτότητα της εταιρείας.** Τρία σημεία του `useBreadcrumbSync` (έργο · κτίριο · χώρος) έγραφαν `όνομα \|\| companyId` ⇒ αμέσως μετά τη δημιουργία έργου η γραμμή έδειχνε `cont_…` (μετρημένο ζωντανά). Νέο `hooks/breadcrumb-company-name.ts`: `breadcrumbCompanyName` (όνομα έργου πλοήγησης → όνομα οντότητας → `companies` της πλοήγησης → **κενό**) και `projectBreadcrumbTrail` (οι δύο κρίκοι που μοιράζονται κτίριο και χώρος). Κενό όνομα ⇒ το `NavigationBreadcrumb` **παραλείπει** τον κρίκο. Το effect εξαρτάται πλέον και από όνομα/εταιρεία της οντότητας, ώστε να ξανασυγχρονίζει όταν τα μάθει. Tests: `breadcrumb-company-name.test.ts` (6). |
| 2026-10-10 | **Το κοινό breadcrumb και στον DXF Viewer — ίδιος κώδικας, όχι αντίγραφο.** Νέο φύλλο `dxf-viewer/components/dxf-layout/ViewerLocationBreadcrumb.tsx` στη δεξιά άκρη του `ViewerContextStrip` (ADR-782 §25): είναι **μόνο** ο προσαρμογέας «κατάσταση θεατή → περιγραφικό οντότητας»· η ιεραρχία λύνεται από το `useBreadcrumbSync` και η απόδοση είναι το `NavigationBreadcrumb`. **Δύο βαθμίδες**: ενεργό κτίριο (`useActiveBuildingId`, ADR-845 §7.15) χωρίς επιλεγμένη περιοχή ⇒ `type: 'building'` (Εταιρεία → Έργο → Κτίριο)· επιλεγμένη περιοχή με `linked.propertyId` ⇒ `type: 'property'` (… → Ακίνητο). Το ειδικότερο κερδίζει, και η αποεπιλογή **γυρίζει στο κτίριο** αντί να σβήνει τη γραμμή. Αποδίδεται μόνο όταν το `NavigationContext` έχει λύσει **αυτή** την οντότητα (το context είναι καθολικό ⇒ όσο τρέχει το αίτημα κρατά την προηγούμενη). Ο **όροφος** δεν είναι κρίκος (τον δείχνει το `FloorTabBar`). Tests: `viewer-location-breadcrumb.test.tsx` (7). ⚠️ Εκτός εμβέλειας: (α) περιοχές συνδεδεμένες με **θέση στάθμευσης/αποθήκη** (ο κλάδος `space` θέλει λίστα κτιρίων)· (β) επίπεδα-κατόψεις **ακινήτου** (`floorplanType: 'unit'`) — το `Level` δεν κρατά `propertyId`, μόνο `entityLabel`, άρα σταματούν στο κτίριο· (γ) το παλαιό `DxfBreadcrumb` της παλέτας (… → **Όροφος**, μη κλικαριστό — άλλο περιεχόμενο, δική του απόδοση). |
| 2026-10-15 | **Breadcrumb και στη «Διαθέσιμα Ακίνητα» (προβολή κάτοψης, `/properties?view=floorplan`).** Η κεφαλίδα (`property-management/page/PropertiesHeader`) περνούσε ήδη `<NavigationBreadcrumb />`, αλλά το `PropertyManagementPageContent` δεν καλούσε το `useBreadcrumbSync` ⇒ άδειο `NavigationContext` ⇒ `null`. Τώρα η ΙΔΙΑ κλήση με το `UnitsPageContent` (`type: 'property'` με το `hookState.selectedProperty`) ⇒ εταιρεία → έργο → κτίριο → ακίνητο από το hierarchy API. Η όψη πλέγματος δεν έχει επιλεγμένο ακίνητο, άρα σωστά δεν δείχνει διαδρομή ακινήτου. |
| 2026-11-03 | **Καρτέλα ευκαιρίας (`/crm/leads/:id`): σύνδεσμος μόνο προς ΑΛΛΗ εγγραφή.** Ο τίτλος της σελίδας δεν είναι σύνδεσμος (ίδιος κανόνας με το τελευταίο στοιχείο του breadcrumb) και δείχνει πλέον τον τίτλο της ευκαιρίας (`title`, εφεδρεία `fullName`), όχι το όνομα του προσώπου. Το όνομα στα «Στοιχεία Επαφής» είναι `Link` προς την επαφή του `contactId`, μέσω `ContextualNavigationService.generateRoute('contact', …)`· χωρίς `contactId` μένει κείμενο. Διόρθωση: το `CommunicationsHistory` λάμβανε το id της ευκαιρίας ως `contactId`, άρα το ερώτημα στα `messages` δεν μπορούσε να επιστρέψει τίποτα· τώρα λαμβάνει `lead.contactId`. Tests: `ContactCard.test.tsx` (2). |
| 2026-11-03 | **Καρτέλα ευκαιρίας: το πρόσωπο έρχεται από την επαφή.** Νέο `lead-person.ts` (`resolveLeadPerson`): με φορτωμένη επαφή, όνομα, email και τηλέφωνο διαβάζονται μόνο από αυτή και κενό πεδίο μένει κενό· τα αντίγραφα της ευκαιρίας ισχύουν μόνο χωρίς `contactId`, κατά τη φόρτωση ή σε αποτυχία ανάγνωσης. Το ίδιο πρόσωπο τροφοδοτεί κάρτα, γρήγορες ενέργειες, αποστολή email και προεπισκόπηση. Το `EditOpportunityModal` κρύβει τα τρία πεδία όταν υπάρχει `contactId`. Νέο πλαϊνό `LeadContactPreviewSheet`: στοιχεία επαφής και οι άλλες ευκαιρίες της (`getOpportunitiesByContact`), χωρίς έξοδο από την ευκαιρία. Το `/api/communications/email` δέχεται `contactId` και γράφει το σταλμένο email στα `messages` (`record-sent-email.ts`, μέσω `createEntity('sentEmailRecord')`): έλεγχος tenant, ιδεμπότητα από το id του παρόχου, και αποτυχία εγγραφής που δεν εμφανίζεται ως αποτυχία αποστολής. ⚠️ Οι λίστες (`OpportunityCard`) δείχνουν ακόμη το αντίγραφο `fullName`. Tests: `ContactCard.test.tsx` (3) · `lead-person.test.ts` (2) · `record-sent-email.test.ts` (4). |
| 2026-11-03 | **Ζωντανή επαλήθευση στην παραγωγή (nestorconstruct.gr, Chrome).** ⚠️ Το lead του handoff (`opp_51777db4…`) δεν είναι πια «GEO PAGONIS»: η επαφή του είναι η «Μινιμαλ Τεστ» (`cont_a10f1d22…`, χωρίς email/τηλέφωνο) ⇒ για τα 4/5/7/9/10 χρησιμοποιήθηκε επιπλέον το `opp_7e31e486…` (επαφή «Γραφείο Β Δοκιμή 6α», με email). ✅ **1** h1 = `title`, όχι σύνδεσμος. ✅ **2** όνομα = `Link` με κλάση `text-link` → `/o/<εταιρεία>/contacts?contactId=…` και ανοίγει τη σωστή επαφή (η σελίδα επαφών αργεί ~30″ να φορτώσει). ⏭️ **3** δεν δοκιμάστηκε: και οι 8 ευκαιρίες της εταιρείας έχουν `contactId`, και η δημιουργία μίας θα ήταν εγγραφή στην παραγωγή. ✅ **4** email από την επαφή (`…+grafeio-b@…`, όχι το `demo.pipeline3@…` του lead)· τα τηλέφωνα των αντιγράφων (`6900000003`/`…04`) δεν φαίνονται και η «Κλήση» είναι απενεργοποιημένη· επαφή χωρίς email ⇒ και η «Αποστολή Email» απενεργοποιημένη. ✅ **5** Sheet: email, άλλες ευκαιρίες με στάδιο (ίδιες με το ερώτημα Firestore `contactId ==`), «Άνοιγμα πλήρους επαφής». ✅ **6** συνεπές: «Δεν υπάρχουν επικοινωνίες» και 0 έγγραφα `messages` για τις δύο επαφές (χωρίς θετικό δείγμα). ❌ **7** η αποστολή αποτυγχάνει: `POST /api/communications/email` → **500** (log παραγωγής: `EmailRoute` «Error in email API», δηλαδή κλάδος `catch`)· κανένα email στο Gmail, κανένα έγγραφο `messages`. **Δεν είναι παλινδρόμηση του ADR-016**: το `recordSentEmail` τρέχει μόνο μετά από επιτυχή αποστολή και καταπίνει τα σφάλματά του. Ρίζα: στο repo **δεν υπάρχει** Cloud Function `sendEmail` (το `functions/src` δεν στέλνει email) και το `EMAIL_FUNCTION_URL` υπάρχει μόνο ως placeholder στο `.env.example` ⇒ **Επιβεβαιωμένο στο Coolify** (εφαρμογή `f661kuiq…`, 71 μεταβλητές): το `EMAIL_FUNCTION_URL` **δεν υπάρχει** ⇒ το `getRequiredEmailFunctionUrl` ρίχνει, πριν από κάθε αποστολή. Υπάρχουν όμως τα `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_REGION`. Δευτερεύον: το log γράφει `error: [object Object]`, άρα χάνεται η αιτία. ⏭️ **8** δεν ελέγχεται χωρίς επιτυχημένο 7. ✅ **9** με `contactId` το modal κρύβει όνομα/email/τηλέφωνο και δείχνει την υπόδειξη (el + en). ✅ **10** σελίδα, Sheet και modal σε el/en χωρίς ωμά κλειδιά· καμία εξαίρεση της εφαρμογής στην κονσόλα. |
| 2026-11-03 | **Διόρθωση του ❌ 7** (εκτός ADR-016, καταγραφή στο ADR-877): το `POST /api/communications/email` στέλνει πλέον μέσω της ΕΝΑ αλυσίδας παρόχων (`sendThroughChain(defaultEmailChain())` → Mailgun στην παραγωγή) αντί για την ανύπαρκτη Cloud Function· το `messageId` του παρόχου τροφοδοτεί το `recordSentEmail` (`providerMessageId`). Αποτυχία παρόχου ⇒ 502/503 χωρίς εγγραφή ιστορικού· το log του `catch` κρατά το μήνυμα. Τα 7 και 8 μένουν **προς ζωντανή επανάληψη μετά το deploy**. |
