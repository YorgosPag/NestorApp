# ADR-001: Select/Dropdown Component

| Metadata | Value |
|----------|-------|
| **Status** | APPROVED |
| **Date** | 2026-01-01 |
| **Category** | UI Components |
| **Canonical Location** | `@/components/ui/select` |
| **Author** | Γιώργος Παγώνης + Claude Code (Anthropic AI) |

---

## Summary

- **Canonical**: `@/components/ui/select` (Radix Select)
- **Clearable extension**: `@/components/ui/clearable-select` (ADR-287 Batch 26) — SSoT helper για dropdowns με deselect option. Χρησιμοποιεί `SELECT_CLEAR_VALUE` sentinel από `@/config/domain-constants`. Δεν αντικαθιστά το canonical — είναι thin wrapper πάνω του.
- **Deprecated**: `EnterpriseComboBox`
- **Strategy**: Migrate on touch (7 legacy files)

---

## Clearable pattern (2026-04-17)

Όταν ένα dropdown πρέπει να επιτρέπει στον χρήστη να επιστρέψει σε «μη επιλεγμένο» state μετά από selection (π.χ. property fields με Google-style missing-data warnings), χρησιμοποιείται ο `ClearableSelect` wrapper:

```tsx
import { ClearableSelect } from '@/components/ui/clearable-select';
import { SelectItem } from '@/components/ui/select';

<ClearableSelect
  value={formData.heatingType}
  onValueChange={(v) => setFormData(p => ({ ...p, heatingType: v }))}
  placeholder={t('fields.clearSelection.heating')}
  clearLabel={t('fields.clearSelection.heating')}
  disabled={!isEditing}
>
  {HEATING_OPTIONS.map((h) => (
    <SelectItem key={h} value={h}>{t(`systems.heating.${h}`)}</SelectItem>
  ))}
</ClearableSelect>
```

- Το `onValueChange` καλείται με κενό string `''` όταν ο χρήστης επιλέξει το clear item.
- Ο wrapper χρησιμοποιεί `SELECT_CLEAR_VALUE` internally — zero exposure του sentinel στο call site.
- Για enum-typed fields, ο caller κάνει `value ? (value as EnumType) : undefined` στο update.

**Σωστά use cases**: optional enum fields όπου η απουσία τιμής έχει σημασιολογία (missing data warnings, filters, soft-delete). **Λάθος use case**: required fields — χρησιμοποίησε plain Select με required validation αντί.

## Native option sync (2026-10-01)

**Πρόβλημα**: το `SelectItemText` της Radix (`@radix-ui/react-select@2.2.6`, `dist/index.mjs:913-917`)
χτίζει το `<option>` του κρυφού native `<select>` από το `textContent` του DOM **κατά το render**,
δηλαδή το κείμενο του προηγούμενου commit. Όταν μια ετικέτα αλλάζει (ωμό κλειδί → μετάφραση,
αλλαγή γλώσσας), το option μένει με το παλιό κείμενο για πάντα. Μετρήθηκε στην καρτέλα ακινήτου
(`audience.publicListing` κ.ά.).

**Θεραπεία** (μόνο στο SSoT `src/components/ui/select.tsx`): το `useResyncItemTextAfterCommit`
συγκρίνει το κείμενο που **έφτασε στο DOM** με το προηγούμενο commit και, αν άλλαξε, ζητά **ένα**
ακόμη render. Ισχύει για όλους τους καταναλωτές του `SelectItem` χωρίς αλλαγή στο call site.

**Άγκυρα**: `src/components/ui/__tests__/select-native-option-sync.test.tsx` (ρωτά το αποδοθέν native
option· μετάλλαξη ⇒ 2 🔴). Πλήρες ιστορικό: ADR-744 §25.
