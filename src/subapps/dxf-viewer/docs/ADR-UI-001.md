# ADR-UI-001: Visual Primitive Ownership & Semantic Tokens

**Status**: Accepted
**Date**: 2026-01-04
**Scope**: UI / Design System / Frontend Architecture
**Author**: Γιώργος Παγώνης + Claude Code (Anthropic AI)

---

## 1. Context

Το project χρησιμοποιεί **Tailwind CSS** και ένα σύνολο helpers (`quick.*`, `useBorderTokens`, κ.λπ.) για τον καθορισμό οπτικών primitives όπως:

- borders
- border radius
- shadows
- surfaces

Αυτά τα helpers χρησιμοποιούνται σε **εκατοντάδες components** και λειτουργούν ως de facto **Single Source of Truth**.

### Το Πρόβλημα

Ωστόσο, δεν υπήρχε γραπτή απόφαση που να καθορίζει:

1. Αν τα `quick.*` είναι **semantic tokens** ή απλές συντομεύσεις
2. Αν επιτρέπεται άμεση χρήση Tailwind utility classes σε components
3. Ποιος "κατέχει" (owns) τα visual primitives

**Αποτέλεσμα**: Γνωστική σύγχυση, όχι λειτουργικό πρόβλημα.

---

## 2. Decision

### 2.1 Semantic Ownership

Τα `quick.*` ορίζονται επισήμως ως **Semantic Design Tokens**.

Παραδείγματα:
- `quick.card`
- `quick.input`
- `quick.panel`
- `quick.button`
- `quick.modal`

**Αυτά ΔΕΝ είναι convenience helpers.**
**Αποτελούν συμβόλαιο σχεδίασης (design contract).**

### 2.2 Component Rules

Από το σημείο αυτό και μετά:

#### ✅ ΕΠΙΤΡΕΠΕΤΑΙ

- Χρήση `quick.*` tokens
- Χρήση hooks / helpers που επιστρέφουν tokens (`useBorderTokens`, `useSemanticColors`, κλπ)
- Χρήση `getStatusBorder()`, `getElementBorder()` functions

#### ❌ ΑΠΑΓΟΡΕΥΕΤΑΙ

Άμεση χρήση των παρακάτω **μέσα σε components εφαρμογής**:

- `border-*` (π.χ. `border-gray-200`)
- `rounded-*` (π.χ. `rounded-lg`)
- `shadow-*` (π.χ. `shadow-lg`)
- Παρόμοιων visual utility classes

#### 🔧 ΕΞΑΙΡΕΣΕΙΣ

Επιτρέπονται ΜΟΝΟ:
- Μέσα στο **design system layer** (`useBorderTokens.ts`, `design-tokens.ts`)
- Μέσα σε **token definitions**
- Σε **primitive components** του UI library

### 2.3 Implementation Neutrality

Η υλοποίηση των semantic tokens:

- **ΜΠΟΡΕΙ** να γίνεται με Tailwind utility strings (τρέχουσα κατάσταση)
- **ΜΠΟΡΕΙ** να αλλάξει σε CSS variables στο μέλλον

**Κρίσιμο**: Τα components **ΔΕΝ γνωρίζουν** και **ΔΕΝ εξαρτώνται** από τον μηχανισμό υλοποίησης.

---

## 3. Token Architecture

### Layer 1: Abstract Design Tokens (Conceptual)

```
Card.border.radius = "medium"
Card.border.color = "surface-outline"
Input.border.radius = "small"
Input.border.color = "input-outline"
```

### Layer 2: Implementation Tokens (Current - Tailwind)

```typescript
// useBorderTokens.ts
quick: {
  card: 'border border-gray-200 rounded-lg',     // maps to Card token
  input: 'border border-gray-300 rounded-md',    // maps to Input token
  button: 'border border-gray-300',              // maps to Button token
}
```

### Layer 3: Future Option (CSS Variables)

```css
/* Potential future implementation */
--card-border: 1px solid var(--color-surface-outline);
--card-radius: var(--radius-medium);
```

**Σημαντικό**: Η αλλαγή από Layer 2 σε Layer 3 **ΔΕΝ απαιτεί αλλαγές στα components** αν ακολουθείται το ADR.

---

## 4. Consequences

### Θετικά

✅ Υπάρχει ξεκάθαρο **ownership** των visual primitives
✅ Το σύστημα είναι **επεκτάσιμο** χωρίς μαζικά refactors
✅ Νέοι developers καταλαβαίνουν αμέσως "πώς παίζουμε"
✅ **Future-proof**: Δυνατότητα migration σε CSS variables χωρίς breaking changes

### Αρνητικά

⚠️ Ελαφρώς λιγότερη "ελευθερία" σε μεμονωμένα components
*(αποδεκτό για enterprise προϊόν)*

---

## 5. Non-Goals

Αυτή η απόφαση:

❌ **ΔΕΝ** απαιτεί refactor σε CSS variables
❌ **ΔΕΝ** αλλάζει υπάρχον API
❌ **ΔΕΝ** επιβάλλει αλλαγές σε υπάρχοντα components
❌ **ΔΕΝ** σπάει backward compatibility

---

## 6. Enforcement (Προτεινόμενο)

Στο μέλλον, μπορούν να προστεθούν:

### ESLint Rules
```javascript
// .eslintrc.js
rules: {
  'no-restricted-syntax': [
    'error',
    {
      selector: 'Literal[value=/border-gray|rounded-lg|shadow-/]',
      message: 'Use semantic tokens (quick.*, useBorderTokens) instead of direct Tailwind classes'
    }
  ]
}
```

### Code Review Checklist
- [ ] No direct `border-*` classes in components
- [ ] No direct `rounded-*` classes in components
- [ ] All visual primitives via `quick.*` or hooks

### Documentation Examples
- See `useBorderTokens.ts` for implementation
- See `centralized_systems.md` for usage guide

---

## 7. Related Documents

- [Centralized Systems Documentation](./centralized_systems.md)
- [Design Tokens](../../styles/design-tokens.ts)
- [useBorderTokens Hook](../hooks/useBorderTokens.ts)
- [CLAUDE.md Guidelines](../../../../CLAUDE.md)

---

## 8. Decision Log

| Date | Decision | Author |
|------|----------|--------|
| 2026-01-04 | ADR Created | Claude Code + Γιώργος |
| 2026-01-04 | Status: Accepted | Γιώργος Παγώνης |

---

## 9. Summary

**Ένα πρόταση, μία απόφαση:**

> Τα `quick.*` tokens είναι το **επίσημο API** για visual primitives.
> Components **ΔΕΝ** γράφουν απευθείας `border-*` / `rounded-*`.
> Η υλοποίηση (Tailwind ή CSS vars) είναι **αόρατη** στα components.

---

*ADR Format based on: Michael Nygard's Architecture Decision Records*
*Enterprise standards inspired by: Autodesk, Adobe, Bentley Systems*
