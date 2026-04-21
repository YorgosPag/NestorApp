# ADR-297: HQ Address Clear + Undo — Google-level Single-Click UX

| Metadata | Value |
|----------|-------|
| **Status** | ✅ IMPLEMENTED |
| **Date** | 2026-04-21 |
| **Category** | Frontend UX / Contacts Form |
| **Related ADRs** | ADR-277 (Address Impact Guard), ADR-280 (i18n namespace split), ADR-291 (Notification pattern) |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## 1. Context

### Πρόβλημα

Στο tab «Διευθύνσεις & Υποκαταστήματα» η **Έδρα (HQ)** μιας επαφής νομικού προσώπου έχει **11+ πεδία** που εκτείνονται σε όλη την ελληνική διοικητική ιεραρχία (level 8 → level 1):

```
street, streetNumber, postalCode, city,
settlement/settlementId, community, municipalUnit,
municipality/municipalityId, regionalUnit, region,
decentAdmin, majorGeo
```

Μέχρι σήμερα ο χρήστης **δεν είχε** single-click τρόπο να καθαρίσει τη διεύθυνση — έπρεπε να σβήσει ένα-ένα τα πεδία. Τα Branches αντιθέτως έχουν ήδη `Trash2` icon + `BranchDeleteConfirmDialog` (ADR-277).

### Γιατί όχι modal επιβεβαίωσης

Η Google Docs/Gmail pattern για **reversible actions** είναι optimistic + undo snackbar, ΟΧΙ double-confirm modal. Το clear είναι reversible (snapshot), οπότε modal = friction χωρίς value.

---

## 2. Decision

### 2.1 Αρχιτεκτονική — Optimistic Clear + 5s Undo Snackbar

```
User click Eraser icon
    ↓
snapshot = formData (ref)
    ↓
setFormData({ ...cleared HQ fields })   ← instant UI update
    ↓
notify({ message, actions: [{ label: "Αναίρεση", onClick: restore }] })
    ↓ 5s timeout
Toast fades — action becomes permanent
```

### 2.2 Location

Single `Eraser` IconButton στο header της HQ section, **δίπλα στο `FullscreenToggleButton`** (φυσική ομαδοποίηση section-level actions). Layout: `flex items-center gap-1`.

### 2.3 SSoT — Single Source of Truth

- **Hook**: `src/components/contacts/dynamic/useClearCompanyHqAddress.ts`
  - Δέχεται `formData` + `setFormData`
  - Επιστρέφει `{ clearHq, hasPendingUndo }`
  - Internal `snapshotRef` κρατά το προηγούμενο state έως το undo timeout
- **Consumer**: `AddressesSectionWithFullscreen.tsx` (μοναδικός σημείο wiring)
- **Reuse-ready**: future Branch-clear ενέργεια θα χρησιμοποιήσει τον ίδιο hook ή shared `clearAddress()` pattern — ΟΧΙ duplicated logic

### 2.4 Keyboard Affordance

`Ctrl+Backspace` σε focus μέσα στη φόρμα HQ → καλεί `clearHq()`. Wrapper `<div onKeyDown>` γύρω από `<AddressWithHierarchy>`.

### 2.5 Toast Library

Χρήση της **υπάρχουσας** `useNotifications()` (wrap πάνω σε `sonner`) από `NotificationProvider.tsx`. Η `NotificationAction` API υποστηρίζει ήδη `{ label, onClick }` → no wrapper, no νέο npm.

### 2.6 i18n Keys

Όλες οι strings σε `contacts-form.json` (el + en) κάτω από `addressesSection`:

```json
"clearAddress": "Καθαρισμός Διεύθυνσης" | "Clear Address",
"addressCleared": "Η διεύθυνση καθαρίστηκε" | "Address cleared",
"undo": "Αναίρεση" | "Undo"
```

Explicit namespace prefix `t('contacts-form:addressesSection.*')` λόγω react-i18next ns-array lookup (ADR-280).

---

## 3. Google-level Checklist (N.7.2)

| # | Question | Answer |
|---|----------|--------|
| 1 | Proactive/reactive? | **Proactive** — clear + undo window at lifecycle moment |
| 2 | Race condition? | **No** — snapshot captured **before** setFormData dispatch |
| 3 | Idempotent? | **Yes** — δεύτερο click σε ήδη-clear HQ = disabled (`hqHasValue` guard) |
| 4 | Belt-and-suspenders? | **Yes** — undo snackbar + keyboard shortcut + disabled-when-empty guard |
| 5 | SSoT? | **Yes** — `useClearCompanyHqAddress` hook is single point of clear logic |
| 6 | Await/fire-and-forget? | **Sync** — local state, no async needed |
| 7 | Lifecycle owner? | **Explicit** — hook owns snapshot lifetime; expires naturally με toast |

✅ **Google-level: YES** — Optimistic update + undo window matches Gmail/Docs pattern, zero friction, fully reversible.

---

## 4. Επηρεαζόμενα αρχεία

**Νέα**:
- `src/components/contacts/dynamic/useClearCompanyHqAddress.ts` (123 γραμμές)
- `docs/centralized-systems/reference/adrs/ADR-297-hq-clear-undo-pattern.md`

**Modified**:
- `src/components/contacts/dynamic/AddressesSectionWithFullscreen.tsx` — Eraser button + keyboard handler + wrapper
- `src/i18n/locales/el/contacts-form.json` — 3 keys
- `src/i18n/locales/en/contacts-form.json` — 3 keys

---

## 5. Consequences

### Positive

- **Single click clear** vs 11+ manual deletions
- **Zero-risk UX** — undo window 5s
- **Accessibility** — aria-label, title tooltip, keyboard shortcut
- **Reusable hook** για future branch clear

### Neutral

- Snapshot σε ref (όχι state) — δεν προκαλεί re-render κατά την κράτηση
- Δεν κάνουμε persist snapshot μετά από 5s — reversibility expires naturally

### Negative / mitigations

- Αν ο χρήστης κάνει κάτι σοβαρό μέσα στα 5s (π.χ. save), η undo δεν επαναφέρει το saved state. **Mitigation**: το undo επαναφέρει μόνο τοπικό formData — αν το save έχει ήδη γίνει, θα χρειαστεί explicit edit (γνωστό Gmail trade-off).

---

## 6. Safety Net (Google Presubmit Pattern)

### 6.1 Unit test

`src/components/contacts/dynamic/__tests__/useClearCompanyHqAddress.test.ts` (9 tests):

1. No-op when `setFormData` undefined (read-only mode)
2. `clearHq` updater blanks every HQ flat field (14 fields: `street`, `streetNumber`, `postalCode`, `city`, `settlement`, `settlementId`, `community`, `municipalUnit`, `municipality`, `municipalityId`, `regionalUnit`, `region`, `decentAdmin`, `majorGeo`)
3. Preserves non-address fields (`firstName`, `lastName`, `email`, `type`)
4. Replaces HQ entry in `companyAddresses`, keeps branches intact
5. Inserts cleared HQ entry when `companyAddresses` undefined
6. `notify` called with `type: 'info'`, `duration: 5000`, action label = undo i18n key
7. Undo action restores **exact snapshot** (not partial)
8. `hasPendingUndo` lifecycle (false → true → false)
9. Undo idempotent (double-click fires `setFormData` once)

Run: `npx jest src/components/contacts/dynamic/__tests__/useClearCompanyHqAddress.test.ts`

### 6.2 SSoT ratchet

Module `hq-clear-pattern` στο `.ssot-registry.json` (tier 3):

```json
"forbiddenPatterns": [
  "export\\s+(function|const)\\s+useClearCompanyHqAddress\\b",
  "export\\s+(function|const)\\s+buildClearedHqEntry\\b",
  "export\\s+(function|const)\\s+withClearedHqEntry\\b"
]
```

Allowlist: solo il canonical file. Νέο export με stesso nome → pre-commit hook CHECK 3.7 blocca.

Qualsiasi futuro branch-clear deve **importare** dal canonical hook, non reimplementare.

---

## 7. Changelog

- **2026-04-21** — Initial implementation. Eraser icon + optimistic clear + 5s undo snackbar + Ctrl+Backspace. Hook `useClearCompanyHqAddress` για SSoT. Keys σε `contacts-form.json`.
- **2026-04-21** — Safety net: 9 unit test + SSoT ratchet module `hq-clear-pattern` στο `.ssot-registry.json` (tier 3). Google Presubmit Pattern completato.
