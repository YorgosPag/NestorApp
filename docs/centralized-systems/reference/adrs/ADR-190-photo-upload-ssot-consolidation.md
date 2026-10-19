# ADR-190: Photo/Logo Upload System — SSoT Consolidation

**Status**: Accepted
**Date**: 2026-03-06
**Category**: Infrastructure / File Upload

---

## Context

The photo/logo upload system evolved organically across 16+ files. After bug fixes (flickering, save issues), analysis revealed **3 actual duplications** — not 16 scattered files. Most files are proper abstraction layers, not duplicates.

### Duplications Found

1. **Dead Code**: `hooks/contactForm/modular/orchestrator.ts` exported `useContactFormState()` but **no production code** imported it. The real hook lives at `hooks/useContactFormState.ts`.

2. **Logo Validation Duplication**: `hooks/useContactLogoHandlers.ts` (169 lines) duplicated validation (image type + 5MB + allowed types) already handled by `useEnterpriseFileUpload.validateAndPreview()`.

3. **Upload Handler Creation — 2 paths**:
   - `PhotoUploadConfiguration.ts` called `FirebasePhotoUploadService.uploadPhoto()` directly
   - `defaultUploadHandler.ts` provided `createUploadHandlerFromPreset()` factory (canonical)
   - Same result, different interface.

---

## Decision

### Phase 1: Remove Dead Code (ZERO RISK)
- **Deleted** `hooks/contactForm/modular/orchestrator.ts`
- **Cleaned** `hooks/contactForm/index.ts` barrel exports

### Phase 2: Centralise Logo Validation (LOW RISK)
- **Deleted** `hooks/useContactLogoHandlers.ts`
- **Simplified** `hooks/useContactFormHandlers.ts` — logo validation is handled by `EnterprisePhotoUpload` -> `useEnterpriseFileUpload.validateAndPreview()` (SSoT)
- **Removed** `logoHandlers` from `useContactForm.ts` return API (no consumer existed)

### Phase 3: Unify Upload Handler Factory (MEDIUM RISK)
- **Refactored** `PhotoUploadConfiguration.ts` → `getPhotoUploadHandlers()` now uses `createUploadHandlerFromPreset()` from `@/services/upload-handlers`
- **Removed** direct `FirebasePhotoUploadService.uploadPhoto()` calls, `LEGACY_STORAGE_PATHS`, `UPLOAD_PURPOSE`, `COMPRESSION_USAGE` imports
- External interface unchanged — `UnifiedContactTabbedSection.tsx` unaffected

---

## Canonical Architecture

```
Config:          file-upload-config.ts, photo-compression-config.ts
Core State:      useFileUploadState.ts
Firebase:        photo-upload.service.ts
Handler Factory: upload-handlers/defaultUploadHandler.ts  <-- SSoT for handler creation
Enterprise Hook: useEnterpriseFileUpload.ts               <-- SSoT for validation
Upload Utils:    useAutoUploadEffect.ts, useFileSelectionHandlers.ts, usePhotoUploadLogic.ts
Form State:      useContactFormState.ts                   <-- SSoT for form photo/logo state
Save Pipeline:   photo-urls.ts -> data-cleaning.ts -> mappers -> EnterpriseContactSaver
UI Components:   EnterprisePhotoUpload -> MultiplePhotosUpload -> UnifiedPhotoManager
```

---

## Files Changed

| Action | File |
|--------|------|
| DELETED | `src/hooks/contactForm/modular/orchestrator.ts` |
| DELETED | `src/hooks/useContactLogoHandlers.ts` |
| MODIFIED | `src/hooks/contactForm/index.ts` |
| MODIFIED | `src/hooks/useContactFormHandlers.ts` |
| MODIFIED | `src/hooks/useContactForm.ts` |
| MODIFIED | `src/components/ContactFormSections/utils/PhotoUploadConfiguration.ts` |

---

## Consequences

- **Positive**: Single path for upload handler creation, no duplicate validation, less dead code
- **Negative**: None — external interfaces unchanged, all consumers unaffected
- **Risk**: Low — validation still happens in `useEnterpriseFileUpload`, factory presets match previous config exactly

---

## §Display — Εικόνα ταυτότητας: ποια, πώς ζωγραφίζεται, τι κατεβαίνει *(2026-10-18)*

Το ADR κάλυπτε μόνο το **ανέβασμα**. Η **προβολή** δεν είχε ιδιοκτήτη. Η επιλογή «ποια εικόνα έχει αυτή η επαφή» ζούσε
μέσα στο `ContactDetailsHeader`, το πλέγμα και η λίστα επαφών **δεν** έδειχναν εικόνα, και οκτώ οθόνες έστηναν
`Avatar` + `AvatarFallback` με το χέρι, η καθεμιά με δικό της fallback.

### Μετρημένα (Chrome, 2400 px, 2026-10-18)

| Μέτρηση | Πριν | Μετά |
|---|---|---|
| Εικόνα στις κάρτες πλέγματος / λίστας | καμία (μόνο εικονίδιο τύπου) | φωτογραφία / λογότυπο / μονόγραμμα |
| Bytes λογότυπου για πλακίδιο 40 px | **167.503** (JPEG 1600×1137, πρωτότυπο) | **831** (AVIF 48×34) — **÷201** |
| Λογότυπο στην κεφαλίδα | κύκλος `object-cover` ⇒ **κομμένο** | στρογγυλεμένο τετράγωνο, `object-contain` |
| Λήψεις για avatar εκτός οθόνης | Radix `new Image()` ⇒ αμέσως, όλες | `loading="lazy"` ⇒ καμία (μετρημένο: κρυφό αντίγραφο = `loading`) |
| Αντίθεση αρχικών (χειρότερη, 8 αποχρώσεις × 2 θέματα) | — | **5,10 : 1** (λευκό σε `--chart-N` θα έδινε 3,5–4,4) |

### Αρχιτεκτονική

```
Domain:   lib/contacts/contact-identity-image.ts  resolveContactIdentityImage(contact) → EntityAvatarSpec
                                                  (ΕΝΑΣ επιλυτής — κεφαλίδα, πλέγμα, λίστα)
Contract: design-system/primitives/Avatar/entity-avatar.types.ts  { name, seed, imageUrl?, kind: person|organization }
Render:   design-system/primitives/Avatar/EntityAvatar.tsx        σχήμα+fit από το kind· μονόγραμμα· <img> lazy
Tone:     design-system/primitives/Avatar/monogram-tone.ts        FNV-1a(seed) → 8 τόνοι από --chart-1..8
Bytes:    lib/media/identity-image-source.ts                     getImageProps → 1x/2x μέσω optimizer
Origins:  config/remote-image-sources.json   ← ΙΔΙΑ πηγή για next.config.js `images.remotePatterns`
Cards:    CardIdentityProps.avatar? → pickCardIdentity → CardTitleBlock   (ADR-585: CardViewModel.avatar?)
Header:   EntityDetailsHeader `avatar` (αντικατέστησε το `avatarImageUrl` — μόνος καταναλωτής: επαφές)
```

### Αποφάσεις και γιατί

1. **Resize τη στιγμή της ζήτησης, όχι παράγωγα στο ανέβασμα.** Η Google (People API `=s96-c`), το GitHub (`?s=40`) και
   η Idealista μικραίνουν τη στιγμή της ζήτησης, με cache. Το Slack και το Firebase *Resize Images* φτιάχνουν σταθερά
   μεγέθη. Τα σταθερά μεγέθη κλειδώνουν το μέγεθος **πριν** το ξέρεις και θέλουν backfill για ό,τι υπάρχει ήδη, ενώ
   εδώ κάθε υπάρχουσα εικόνα παίρνει μικρογραφία από την πρώτη μέρα, χωρίς αλλαγή σχήματος ή μετάπτωση δεδομένων.
   Μηχανισμός: ο optimizer του Next (`sharp`, Apache-2.0, ήδη εξάρτηση· `output: 'standalone'` στον Netcup) μέσω του
   **δημόσιου** `getImageProps`. ⚠️ **Αντίφαση με ADR-881, δηλωμένη**: εκεί ο optimizer απορρίφθηκε για τα παράγωγα
   ραφιού, που είναι **ήδη** WebP ανά πλάτος (διπλή κωδικοποίηση). Εδώ η πηγή είναι το πρωτότυπο και η έξοδος ≤128 px.
2. **Μόνο ο δικός μας κάδος** (`/v0/b/{bucket}/o/**`). Το `/v0/b/**` θα έκανε τον server ανοιχτό proxy αλλαγής
   μεγέθους για οποιοδήποτε project Firebase. Οτιδήποτε άλλο (`data:`, `blob:`, ξένος host) περνά αυτούσιο.
3. **`minimumCacheTTL: 2592000`** (30 ημ.). Μετρημένο: ο κάδος απαντά `Cache-Control: private, max-age=0`, οπότε
   χωρίς αυτό ο optimizer έπεφτε στα 60s του Next 15 και ξανα-κωδικοποιούσε κάθε λεπτό. Είναι ασφαλές επειδή κάθε
   URL είναι αμετάβλητο (`file_<uuid>` + token, και `v=` για τα παλιά in-place αρχεία) και η cache του container
   μηδενίζεται σε κάθε deploy.
4. **Όχι Radix `AvatarImage`.** Αποφασίζει «φόρτωσε» με `new Image()` και μόνο `src`. Έτσι (α) αγνοεί το `lazy`,
   οπότε 100 κάρτες = 100 λήψεις, και (β) σε οθόνη 2x κατεβάζει το 1x για δοκιμή και μετά το 2x από το `srcset`.
   Το `useImageStatus` κρίνει το **ίδιο** το `<img>`, συμπεριλαμβανομένου του `complete` για όσα είναι ήδη στην cache.
5. **Μονόγραμμα με αντίθεση AA — εκεί όπου η Google μένει στο ~3:1.** Λευκό σε `--chart-N` = 3,5–4,4 : 1 (αποτυχία WCAG 1.4.3 στα ~14 px). Τόνος =
   `color-mix(in oklab, chart-N 20%, --card)` / μελάνι `color-mix(in oklab, chart-N 60%, --foreground)`, θεματικό
   χωρίς δεύτερο πίνακα. Η άγκυρα το ξαναϋπολογίζει από το `globals.css` (`scripts/lib/contrast/oklab-mix.js`).
   Το χρώμα βγαίνει από FNV-1a, γιατί το άθροισμα χαρακτήρων του `UserTable` δίνει ίδιο χρώμα σε αναγραμματισμούς.
   Όνομα χωρίς γράμματα ⇒ σιλουέτα του είδους, ποτέ άδειος δίσκος.
6. **Λογότυπο σε λευκό πλακίδιο και στα δύο θέματα**, όπως Slack/Attio: είναι το έδαφος για το οποίο σχεδιάστηκε το
   λογότυπο, και ένα σκούρο διάφανο λογότυπο σε σκοτεινή κάρτα χάνεται.
7. 🔴 **Διορθώθηκε bug της κεφαλίδας**: ο cache-buster κολλούσε `?v=` πάνω σε URL που έχει ήδη query
   (`?alt=media&token=…`), οπότε έβγαινε `token=xxx?v=…`, δηλαδή **άλλο token**. Επιπλέον το `updatedAt` είναι Timestamp,
   οπότε γραφόταν `?v=[object Object]`. Πλέον η παράμετρος μπαίνει με το URL API και η έκδοση είναι αριθμός (`normalizeToDate`).

### ⚠️ Τι ΔΕΝ έγινε (δηλωμένο)
- **Αυτόματο λογότυπο από domain** (HubSpot/Attio): εξωτερική υπηρεσία = άδεια + απόρρητο + κόστος. Επόμενο βήμα.
- **Οι άλλες 7 χειροποίητες `Avatar`** (`UserTable` με το άθροισμα χαρακτήρων, `CustomerInfoCompact`,
  `UnifiedCustomerCard`, `CrmTeamsPageContent`, `user-menu`, `AudienceRosterPanel`, `account/layout`) δεν μεταφέρθηκαν.
  Γράφτηκαν στο `.claude-rules/pending-ratchet-work.md`. Το `thread-labels.ts` `initialsOf` είναι δεύτερη υλοποίηση
  αρχικών που κρατά τόνους («ΆΤ») και παίρνει πρώτη + τελευταία λέξη.
- Το `EntityAvatar` εισάγει το `getInitials` από `@/types/contacts/helpers` (ADR-209). Είναι γενική συνάρτηση που ζει
  σε φάκελο τομέα. Η μετακίνηση σε `lib/text` αγγίζει 5+ καταναλωτές, γι' αυτό είναι στο ίδιο pending.

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-03-06 | ADR Created — SSoT consolidation for photo/logo upload | Claude Code |
| 2026-04-07 | Bugfix: eliminate competing state updates in onUploadComplete — two `setFormData` calls raced (Call #2 used stale formData, overriding `file: null` from Call #1). Fix: single state update per event + full slot reset in `handleMultiplePhotoUploadComplete` | Claude Code |
| 2026-10-18 | **§Display** — identity image SSoT: `resolveContactIdentityImage` (one resolver for header + grid + list), `EntityAvatar` (photo circle / logo contained tile / AA monogram), on-demand thumbnails via `getImageProps` scoped to our bucket (`remote-image-sources.json`, `minimumCacheTTL` 30d). Logo 167.503 → 831 bytes. Fixed header cache-buster corrupting the Firebase token. Anchors: `monogram-tone` (contrast recomputed from globals.css, mutations 2/2), `EntityAvatar`, `contact-identity-image`, `card-shells` | Claude Code |

---

## Related Documents (Upload Architecture)

| Document | Relationship | Context |
|----------|-------------|---------|
| **[ADR-292](./ADR-292-floorplan-upload-consolidation-map.md)** | **Hub** | Full upload architecture map — all 6 paths, service diagram, consolidation roadmap |
| **[ADR-054](./ADR-054-enterprise-upload-system-consolidation.md)** | Upstream | Enterprise upload consolidation — parent initiative this ADR refines for photos |
| **[ADR-018](./ADR-018-unified-upload-service.md)** | Upstream | Unified Upload Service — Gateway + Strategy foundation |
| **[ADR-191](./ADR-191-enterprise-document-management.md)** | Downstream | FileRecord model — photo uploads create records following this lifecycle |
| **[ADR-293](./ADR-293-file-naming-storage-path-ssot-audit.md)** | Audit | Naming/path SSoT audit — violation #4: `useEnterpriseFileUpload` still uses legacy paths for new photo uploads |
