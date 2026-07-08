# ADR-595: Generic Form Renderer Primitives SSoT (`form-field-primitives` + `form-tabs-shell`)

## Status
✅ **ACTIVE — 2026-07-08** — De-duplication of the config-driven form renderers under `src/components/generic/`. The three form renderers (`GenericFormRenderer`, `IndividualFormRenderer`, `ServiceFormRenderer`) each re-implemented an identical field-render layer (input/textarea/select JSX, the `renderField` type switch, `toStringValue`, the handler type aliases, `PhotoData`); the three tabbed renderers (`GenericFormTabRenderer`, `ServiceFormTabRenderer`, `IndividualFormTabRenderer`) each re-implemented an identical `<TabsOnlyTriggers>`+`TabsContent` shell, the "dot → t() → last-segment" i18n resolver and the single-slot logo uploader. Collapsed onto two shared modules — **field primitives + strategy-injected dispatcher** (`form-field-primitives.tsx`) and **tab shell + i18n resolver + logo section** (`form-tabs-shell.tsx`) — plus a Boy-Scout extract inside the (read-only) `GenericTabRenderer`. jscpd (min-tokens 50) on `components/generic/`: **29 exact clones / 355 dup-lines → 3 / 26**, and the remaining 3 are pre-existing self-clones in files untouched by this ADR (`UniversalTabsRenderer`, `photo-system/PhotosTabBase`). `jscpd:diff` on the staged fileset: **✅ 0 clones**. Public API (exports, prop names, component signatures) is unchanged — internal refactor only.

**Related:**
- **ADR-585** (Domain Card View-Model Hook), **ADR-586** (Meta Webhook Shared Core), **ADR-588** (Space Media Tab Shell), **ADR-590** (Email Template Shared Primitives), **ADR-591** (Impact-Preview Primitives), **ADR-592** (BIM Entity Factory Base), **ADR-593** (Communication Row Primitives) — same 2026-07-08 de-duplication sweep, same **shared shell/primitive + per-instance binding** archetype across successive buckets («Κουβάδες Α–Ζ»). This ADR is «Κουβάς Η».
- **ADR-584** (jscpd Clone Ratchet, CHECK 3.28) — the token-based detector that surfaced these twins and gates re-introduction.
- **ADR-324** (Clearable Select SSoT) — `form-select-helpers`, reused unchanged by `FormSelectField`.

---

## Context

`src/components/generic/` holds config-driven form renderers that turn a `SectionConfig[]` (company-GEMI / individual / service) into a form. A **real SSoT audit (grep + jscpd, min-tokens 50)** found **no** existing shared field primitive and two clone families:

### Family 1 — Form Renderers (Individual / Service / Generic)
The three files each re-declared, near-identically:
- `toStringValue` (3×), the handler type aliases (`*ChangeHandler` / `*BlurHandler` / `CustomFieldRenderer`), and the `PhotoData` shape (3×).
- The field-render functions `renderInputField` / `renderTextareaField` / `renderSelectField` and the `renderField` type switch. In `GenericFormRenderer` the five text-like types (input/date/number/email/tel) had **five byte-identical `UniversalClickableField` wrappers** — a 58-line self-clone.

jscpd measured the family at `Individual↔Service` **77**, `Generic (self)` **58**, `Generic↔Service` **55**, `Generic↔Individual` **51** dup-lines. The genuinely-divergent part is small: each renderer's **i18n strategy** (Individual translates placeholders/options inline via `t`; Service pre-translates in the parent + a multi-namespace option resolver; Generic uses a "dot → t() → last-segment" resolver with a namespace-ready gate) and its **section header** (Individual: none; Service/Generic: icon + title).

### Family 2 — Form Tab Renderers (Generic / Service / Individual)
The three tab files each re-declared the same `<TabsOnlyTriggers>` + per-tab `<TabsContent>` shell, the same loose `FormField`/custom-renderer contracts, the "dot → t()" label resolver (3rd+ copy), and (Generic/Service) the same single-slot logo `MultiplePhotosUpload` block. jscpd: `GenericFormTab↔ServiceFormTab` **33**, `GenericFormTab↔IndividualFormTab` **12**, `IndividualFormTab (self)` **11** dup-lines. Divergent: which inner renderer is used, the i18n strategy, and per-variant special sections (Individual photo grid `maxPhotos=6`; Generic `companyPhotos`; Service `logo` with `showPhotosWhenDisabled`).

Big-player practice for config-driven form editors (Figma property panels, Revit family-parameter forms, Cinema 4D attribute editors) is a **shared field-slot primitive + a per-field-type dispatcher fed by an injected strategy**, plus a **shared tab shell**, not a per-config form component. The fix generalises that.

> **i18n note (N.11):** no user-facing literals were introduced. The three renderers keep their existing `t(...)` strategies (now expressed as a small `FieldRenderStrategy` object); the `'basicInfo'` default tab id in `FormTabsShell` is an identifier, not a label. Zero new baseline entries.

---

## Decision

### New module `form-field-primitives.tsx` (field SSoT)

Presentational primitives + prop contracts + the shared type dispatcher, deliberately free of any i18n strategy (they receive already-resolved strings — no God-shell):

| Export | Owns |
|---|---|
| `FormFieldDescriptor` | Structural subset satisfied by `FieldConfig` / `IndividualFieldConfig` / `ServiceFieldConfig`. |
| `FormFieldValue` / `FormFieldDataRecord` / `FormFieldChangeHandler` / `FormSelectChangeHandler` / `FormFieldBlurHandler` / `FormPhotoData` | The shared type aliases (each renderer re-exports its old names as aliases → backward-compatible). |
| `toStringValue` | Single value→string coercion. |
| `FormTextField` | One primitive for input/date/number/email/tel (`type={field.type}`) — kills the five-way self-clone. |
| `FormTextAreaField` | Textarea primitive (`rows` param). |
| `FormSelectField` | Clearable `<Select>` primitive; reuses `form-select-helpers` (ADR-324). |
| `FieldRenderStrategy<F>` | Injected per-renderer i18n/config behaviour (placeholder/option resolvers, `selectFallbackValue`, `textareaRows`). |
| `renderFormField(args)` | The single `select → textarea → text` switch every renderer shares. A `select` with no options degrades to text; unknown types are logged. |
| `createFieldRenderer(ctx)` | Binds the form's shared context so section loops call `renderField(field)` — keeps the dispatch call out of each renderer's JSX (no prop-forwarding clone). |

Each `*FormRenderer` keeps its own thin `buildXFieldStrategy(t)` + section shell (header/grid genuinely differ) and calls `createFieldRenderer(...)` once.

### New module `form-tabs-shell.tsx` (tab SSoT)

| Export | Owns |
|---|---|
| `FormTabsShell` | The `<TabsOnlyTriggers>` + per-tab `<TabsContent>` shell (`contentClassName` param). |
| `resolveI18nKeyLabel` | The "dot → t() → last-segment fallback" resolver (consolidated 3 copies). |
| `FormLogoUploadSection` | Single-slot logo `MultiplePhotosUpload` block (`showPhotosWhenDisabled` param). |
| `TabCustomFieldData` / `TabFieldCustomRenderer` / `TabSectionCustomRenderer` | Shared loose custom-renderer contracts (killed the Individual↔Service interface clone). |

Each `*FormTabRenderer` keeps its own `createTabsFromConfig` (inner renderer + per-variant special sections stay per-variant — no God-shell) and threads the whole `props` object into it (`createTabsFromConfig(props, t)`), so the component body stops cloning; the render returns through `<FormTabsShell>`.

### Boy-Scout — `GenericTabRenderer.tsx` (read-only display renderer, N.0.2)
Its `CompactSectionRenderer` / `FullSectionRenderer` self-clone (shared props signature + fields grid) was collapsed onto a shared `SectionRendererProps` type + a `SectionFieldsGrid` component (spread-forwarded, ADR-593 lesson). Unrelated to the form SSoT but in-bucket and clean.

---

## Verification

- **jscpd** (`components/generic/`, min-tokens 50): 29 clones / 355 dup-lines → **3 / 26** (residual 3 are pre-existing self-clones in `UniversalTabsRenderer` + `photo-system/PhotosTabBase`, both untouched here). `jscpd:diff` on the staged fileset: **0 clones**.
- **Tests** (jest + RTL): `__tests__/form-field-primitives.test.tsx` (12) — `toStringValue`, the three primitives (value flow + onChange), `renderFormField` dispatch (select/textarea/text/unknown-warn/no-options-degrade/custom-renderer override), `createFieldRenderer` context binding; `__tests__/resolve-i18n-key-label.test.ts` (4) — the consolidated resolver. Existing `form-select-helpers.test.tsx` still green (no regression).
- **No behaviour change**: public exports/props unchanged; the only intentional simplifications are that a no-options `<select>` now renders a text input in all three renderers (was already the case in Generic) and the Service phone/email/website `logger.info` debug line was dropped.

---

## Changelog
- **2026-07-08** — Initial version. Created `form-field-primitives.tsx` + `form-tabs-shell.tsx`; migrated the 3 form renderers + 3 tab renderers onto them; Boy-Scout extract in `GenericTabRenderer`; added 2 test suites (16 tests). «Κουβάς Η» of the 2026-07-08 de-duplication sweep. (ADR number bumped 594→595: the dxf agent took 594 concurrently.)
