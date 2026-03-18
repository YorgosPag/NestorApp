---
name: i18n
description: Πρόσθεσε ή ενημέρωσε i18n μεταφράσεις (ICU format)
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: "[namespace] [key.path] [el] [en]"
---

# i18n Translation Management

## Εντολή
$ARGUMENTS

## ΚΡΙΣΙΜΟΣ ΚΑΝΟΝΑΣ: ICU FORMAT
Το project χρησιμοποιεί `i18next-icu` (src/i18n/config.ts line 46).

✅ ΣΩΣΤΟ: `"greeting": "Γειά σου {name}"`  (single braces)
❌ ΛΑΘΟΣ: `"greeting": "Γειά σου {{name}}"` (double braces — ΔΕΝ ΔΟΥΛΕΥΕΙ)

## Plurals (ICU syntax)
```json
"items": "{count, plural, one {# αρχείο} other {# αρχεία}}"
```

## Αρχεία
- Ελληνικά: `src/i18n/locales/el/{namespace}.json`
- Αγγλικά: `src/i18n/locales/en/{namespace}.json`

## Namespaces (υπάρχοντα)
common, filters, dxf-viewer, geo-canvas, forms, toasts, errors,
properties, crm, navigation, auth, dashboard, projects, obligations,
toolbars, compositions, tasks, users, building, contacts, units,
landing, telegram, files, storage, parking, admin, tool-hints,
accounting, banking, addresses, payments

## Flow
1. Βρες το σωστό namespace (Grep αν δεν είσαι σίγουρος)
2. Διάβασε ΚΑΙ ΤΑ ΔΥΟ αρχεία (el + en)
3. Πρόσθεσε key στο ΙΔΙΟ path και στα δύο
4. Interpolation: ΜΟΝΟ single braces `{variable}`

## Χρήση στον κώδικα
```tsx
// Namespace prefix
t('properties:viewer.media.floorplanLevel', { name: level.name })

// Default namespace
const { t } = useTranslation('properties');
t('viewer.media.floorplanLevel', { name: level.name })
```
