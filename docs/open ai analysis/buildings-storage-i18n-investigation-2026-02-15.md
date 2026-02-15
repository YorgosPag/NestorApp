# Buildings > Αποθήκες i18n Investigation (2026-02-15)

## Scope
- Flow investigated: `buildings` page -> select building -> `Αποθήκες` tab.
- Focus: raw translation keys / key-like labels shown instead of proper translations in tab actions and Storage/Parking modals.

## Findings
1. Missing translation injection in StorageForm pipeline
- File: `src/components/building-management/StorageForm/useStorageForm.ts`
- Problem:
  - `useStorageFormHandlers` was called without `t`, so modal title localization path was bypassed.
  - `storageFormConfig` was called without `t`, so it returned fallback identifier arrays.
- User-visible effect:
  - Modal title fallback behavior and untranslated/key-like floor/feature labels.

2. Fragmented key schema (`storageForm.*` vs `storage.form.*`)
- File: `src/components/building-management/StorageForm/storageFormConfig.ts`
- Problem:
  - Config was reading from legacy `storageForm.*` path while the form UI components read `storage.form.*` keys.
- User-visible effect:
  - Non-unified translation source and inconsistent labels across sections.

3. Key-like values shown in common feature buttons/options
- File: `src/components/building-management/StorageForm/storageFormConfig.ts`
- Problem:
  - Fallback values were raw identifiers (`basement2`, `naturalLight`, etc.).
- User-visible effect:
  - UI looked like translation keys instead of human text.

## Changes Applied
1. Passed `t` through form state/composition layer
- Updated: `src/components/building-management/StorageForm/useStorageForm.ts`
- Actions:
  - Added `useTranslation('building')`.
  - Passed `t` into `useStorageFormHandlers`.
  - Passed `t` into `storageFormConfig(formType, t)`.

2. Unified config lookup to one storage form schema
- Updated: `src/components/building-management/StorageForm/storageFormConfig.ts`
- Actions:
  - Moved config key resolution to `storage.form.*` paths.
  - Floor labels now resolve from `storage.form.floors.*`.
  - Feature labels now resolve from:
    - `storage.form.storageFeatures.*`
    - `storage.form.parkingFeatures.*`
  - Updated feature key set to match active schema (`airChamber`, `enclosed`).

## Quality Gate
- Command run: `npx tsc --noEmit`
- Result: PASS (exit code 0)

## Remaining Centralization Risks (Not changed in this patch)
1. Duplicate translation structures still exist in `building.json`
- Both `storage.form.*` and `storageForm.*` are present.
- Recommendation: remove legacy duplicate tree after full usage audit.

2. Cross-namespace usage still exists in storage form stack
- Example: `StorageFormBasicInfo.tsx` uses `useTranslation('properties')` while nearby form sections use `building`.
- Recommendation: move all StorageTab/StorageForm translations to one namespace (`building`) and retire duplicates.

## Conclusion
The main cause of key-like/untranslated text in the investigated flow was not passing `t` to the StorageForm composition/config layer plus split translation schemas. The applied patch restores translated labels in the storage/parking form flow and aligns config reads to a single active key tree (`storage.form.*`).
