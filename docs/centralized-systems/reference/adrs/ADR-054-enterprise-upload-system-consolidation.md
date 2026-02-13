# ADR-054: Enterprise Upload System Consolidation

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Last Updated** | 2026-02-13 |
| **Category** | Entity Systems |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: 5 canonical components
- **Pipeline**: pending → upload → finalize

---

## Canonical Components

| Component | File | Purpose |
|-----------|------|---------|
| `EnterprisePhotoUpload` | `src/components/ui/EnterprisePhotoUpload.tsx` | Single photo upload with preview |
| `MultiplePhotosUpload` | `src/components/ui/MultiplePhotosUpload.tsx` | Multi-slot photo management |
| `MultiplePhotosFull` | `src/components/ui/MultiplePhotosFull.tsx` | Full-size multi-photo layout |
| `MultiplePhotosCompact` | `src/components/ui/MultiplePhotosCompact.tsx` | Compact multi-photo layout |
| `useEnterpriseFileUpload` | `src/hooks/useEnterpriseFileUpload.ts` | Upload hook with Firebase Storage |

## Data Flow — Contact Photos

```
individualMapper.ts (SSoT: multiplePhotoURLs → multiplePhotos)
    ↓
ContactDetails.tsx (enhancedFormData useMemo — uses mapper output directly)
    ↓
UnifiedContactTabbedSection → IndividualFormTabRenderer
    ↓
MultiplePhotosUpload → MultiplePhotosFull → EnterprisePhotoUpload
    ↓
useAutoUploadEffect → useEnterpriseFileUpload → Firebase Storage
    ↓
handleMultiplePhotosChange (functional updater) → setEditedData
```

### Single Source of Truth

- **`individualMapper.ts`** (lines 43-81): ΜΟΝΑΔΙΚΟ σημείο μετατροπής `multiplePhotoURLs[]` → `PhotoSlot[]`
- **`ContactDetails.tsx`**: Χρησιμοποιεί ΜΟΝΟ το output του mapper, χωρίς πρόσθετη μετατροπή

---

## Changelog

### 2026-02-13 — Critical Bug Fixes (VERIFIED WORKING)

> **ΣΗΜΕΙΩΣΗ**: Το photo upload pipeline λειτουργεί σωστά. ΜΗΝ ΤΡΟΠΟΠΟΙΕΙΤΕ τα παρακάτω αρχεία χωρίς σοβαρό λόγο.

**Bug 1: Duplicate photo σε 2 consecutive slots** (commit `8d894bfc`)
- **Αιτία**: `ContactDetails.tsx` `enhancedFormData` useMemo συνένωνε `getMultiplePhotoURLs(contact)` πάνω στα ήδη mapped `formData.multiplePhotos` από τον `individualMapper.ts`, διπλασιάζοντας τις εγγραφές
- **Λύση**: Αφαίρεση του redundant κώδικα μετατροπής — ο `individualMapper.ts` είναι η μοναδική πηγή αλήθειας
- **Αρχεία**: `src/components/contacts/details/ContactDetails.tsx`

**Bug 2: addCacheBuster URL corruption** (commit `1dc71775`)
- **Αιτία**: `addCacheBuster` χρησιμοποιούσε `?` separator ακόμα κι όταν το URL είχε ήδη query params, δημιουργώντας invalid double-`?` URLs
- **Λύση**: Χρήση `&` separator όταν το URL περιέχει ήδη `?`
- **Αρχεία**: `src/hooks/useCacheBusting.ts`

**Bug 3: Stale closure σε async upload callbacks** (commit `533f7e95`)
- **Αιτία**: Τα handlers στο `MultiplePhotosFull` έκλειναν πάνω σε stale `formData` state
- **Λύση**: `useRef` pattern + functional updater `setEditedData(prev => ({...prev, multiplePhotos}))` στο `ContactDetails.tsx`
- **Αρχεία**: `MultiplePhotosFull.tsx`, `MultiplePhotosCompact.tsx`, `ContactDetails.tsx`

### Αρχεία που ΔΕΝ πρέπει να αλλάξουν (σταθεροποιημένα 2026-02-13)

| Αρχείο | Λόγος |
|--------|-------|
| `src/utils/contactForm/fieldMappers/individualMapper.ts` | SSoT για multiplePhotoURLs → PhotoSlot[] |
| `src/components/contacts/details/ContactDetails.tsx` | Σωστό data flow χωρίς duplicate μετατροπή |
| `src/hooks/useCacheBusting.ts` | Σωστό URL handling με & separator |
| `src/components/ui/MultiplePhotosFull.tsx` | useRef pattern για async uploads |
| `src/components/ui/MultiplePhotosCompact.tsx` | useRef pattern για async uploads |
| `src/components/ui/EnterprisePhotoUpload.tsx` | Stable upload component |
| `src/hooks/upload/useAutoUploadEffect.ts` | Stable auto-upload trigger |
