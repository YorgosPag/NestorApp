# SPEC-244B: Phase 1 — Sales Flow (Multi-Buyer Reserve & Sell)

**Parent ADR**: ADR-244 (Multi-Buyer Co-Ownership)
**Depends on**: SPEC-244A (Phase 0 must be complete)
**Status**: READY FOR IMPLEMENTATION (μετά Phase 0)
**Risk**: ΧΑΜΗΛΟΣ — dual-write pattern, backward compatible
**Εκτίμηση**: 5-6 ώρες

---

## ΣΤΟΧΟΣ

Ο χρήστης μπορεί να κάνει κράτηση + πώληση σε πολλαπλά άτομα. Ο παλιός κώδικας (single buyer) δουλεύει ταυτόχρονα.

---

## ΑΛΛΑΓΕΣ

### 1. ReserveDialog → Multi-Buyer

**Αρχείο**: `src/components/sales/dialogs/SalesActionDialogs.tsx` (γρ. 209-509)

**Τρέχον**:
```typescript
const [buyerContactId, setBuyerContactId] = useState<string>('');
const [buyerName, setBuyerName] = useState<string>('');
// 1 ContactSearchManager
```

**Νέο**:
```typescript
const [owners, setOwners] = useState<PropertyOwnerEntry[]>([]);
// N ContactSearchManagers + % inputs
// + button "Προσθήκη Συνιδιοκτήτη"
// + σύνολο ποσοστών = 100%
```

**Dual-write στο PATCH**:
```typescript
await apiClient.patch(API_ROUTES.UNITS.BY_ID(unit.id), {
  commercialStatus: 'reserved',
  commercial: {
    // OLD (backward compatible)
    buyerContactId: owners[0]?.contactId ?? null,
    buyerName: owners[0]?.name ?? null,
    // NEW
    owners: owners.length > 0 ? owners : null,
    reservationDate: new Date().toISOString(),
  },
});
```

### 2. SellDialog → Multi-Buyer

**Αρχείο**: `src/components/sales/dialogs/SalesActionDialogs.tsx` (γρ. 515-668)

Ίδιο pattern — dual-write `owners[]` + `buyerContactId`.

### 3. Multi-Owner Form Component (reusable)

**Νέο αρχείο**: `src/components/sales/shared/OwnersList.tsx`

Reusable component για Reserve + Sell + μελλοντικά:
```
┌─────────────────────────────────────────────┐
│ Ιδιοκτήτες                                  │
│                                              │
│ [ContactSearch] Γιάννης Π.    [70%] [🗑️]    │
│ [ContactSearch] Μαρία Κ.      [30%] [🗑️]    │
│                                              │
│ [+ Προσθήκη Συνιδιοκτήτη]   Σύνολο: 100% ✅ │
└─────────────────────────────────────────────┘
```

Props:
```typescript
interface OwnersListProps {
  owners: PropertyOwnerEntry[];
  onChange: (owners: PropertyOwnerEntry[]) => void;
  defaultRole: PropertyOwnerRole;
  disabled?: boolean;
  maxOwners?: number;
}
```

### 4. Email Templates Update

**Αρχεία**:
- `src/services/email-templates/reservation-confirmation.ts`
- `src/services/email-templates/sale-confirmation.ts`

Αλλαγή: `buyerName` → join all owner names: "Γιάννης Π. & Μαρία Κ."

### 5. Appurtenance Sync Update

**Αρχείο**: `src/app/api/sales/[unitId]/appurtenance-sync/route.ts`

Αλλαγή: Propagate `owners[]` (ΟΧΙ μόνο `buyerContactId`) σε linked parking/storage.

---

## ΑΡΧΕΙΑ ΠΟΥ ΑΛΛΑΖΟΥΝ

| # | Αρχείο | Αλλαγή | Risk |
|---|--------|--------|------|
| 1 | `SalesActionDialogs.tsx` | ReserveDialog + SellDialog multi-buyer | Μεσαίο |
| 2 | `OwnersList.tsx` | **ΝΕΟ** reusable component | ZERO |
| 3 | `reservation-confirmation.ts` | Owner names join | Χαμηλό |
| 4 | `sale-confirmation.ts` | Owner names join | Χαμηλό |
| 5 | `appurtenance-sync/route.ts` | Propagate owners[] | Χαμηλό |

---

## VERIFICATION

1. Reserve → 1 buyer: λειτουργεί ΟΠΩ ΠΡΙΝ
2. Reserve → 2 buyers (70/30): `owners[]` γράφεται + `buyerContactId` = owners[0]
3. Sell → ίδιο
4. Email confirmation: "Γιάννης Π. & Μαρία Κ."
5. Linked parking/storage: propagated `owners[]`

---

## ROLLBACK

Αν κάτι σπάσει: αφαίρεσε μόνο το `OwnersList` component. Ο `buyerContactId` δουλεύει πάντα ως fallback.
