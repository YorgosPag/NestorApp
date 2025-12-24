# 🎨 ENTERPRISE BORDER DESIGN SYSTEM

## 🏢 Επαγγελματικό Σύστημα Περιγραμμάτων

Αυτό το σύστημα ακολουθεί τα πρότυπα των μεγαλύτερων εταιρειών λογισμικού (Microsoft, Google, Apple) για πλήρως κεντρικοποιημένη διαχείριση περιγραμμάτων.

## 🎯 ΤΙ ΕΠΙΤΥΓΧΑΝΕΙ

### ✅ **SINGLE SOURCE OF TRUTH**
- **Ένα αρχείο ελέγχει όλα τα borders**: `src/styles/design-tokens/core/borders.ts`
- **Μία αλλαγή → παγκόσμια εφαρμογή**: Αλλάζεις σε ένα σημείο, αλλάζει παντού
- **Zero duplication**: Δεν υπάρχουν hardcoded border values

### 🎨 **COMPREHENSIVE CONTROL**
- **Border Colors**: Light/Dark mode support, semantic colors (success, error, etc.)
- **Border Width**: Από hairline (0.5px) έως heavy (4px)
- **Border Radius**: Από sharp corners έως full circles
- **Contextual Variants**: Card, Button, Input, Modal variants

### 🚀 **ENTERPRISE FEATURES**
- **TypeScript Type Safety**: Πλήρης type support
- **Responsive Design**: Mobile/Tablet/Desktop variants
- **Accessibility**: WCAG-compliant border patterns
- **Dark Mode**: Automatic light/dark theme switching

---

## 🛠️ ΠΩΣ ΝΑ ΤΟ ΧΡΗΣΙΜΟΠΟΙΗΣΕΙΣ

### **1. 🎯 BASIC USAGE - Με το Hook**

```tsx
import { useBorderTokens } from '@/hooks/useBorderTokens';

function MyCard() {
  const { quick } = useBorderTokens();

  return (
    <div className={quick.card}>
      Η κάρτα με enterprise border!
    </div>
  );
}
```

### **2. 🏗️ COMPONENT VARIANTS**

```tsx
function MyButton({ variant = 'default' }) {
  const { getElementBorder } = useBorderTokens();

  return (
    <button className={getElementBorder('button', variant)}>
      Button με dynamic border
    </button>
  );
}
```

### **3. 🎨 STATUS BORDERS**

```tsx
function StatusMessage({ status }) {
  const { getStatusBorder } = useBorderTokens();

  return (
    <div className={getStatusBorder(status)}>
      {/* success, error, warning, info borders */}
    </div>
  );
}
```

### **4. 📱 RESPONSIVE BORDERS**

```tsx
function ResponsiveCard() {
  const { getResponsiveBorder } = useBorderTokens();

  return (
    <div className={getResponsiveBorder('card')}>
      Borders που αλλάζουν ανάλογα με το μέγεθος οθόνης
    </div>
  );
}
```

---

## 🔧 ADVANCED USAGE

### **🎯 DIRECT TOKEN ACCESS**

```tsx
import { borders } from '@/styles/design-tokens';

// Πρόσβαση στα raw tokens
const cardBorder = borders.variants.card.className;
const primaryColor = borders.colors.primary.css;
const mediumWidth = borders.width.medium;
```

### **🎨 CUSTOM COMBINATIONS**

```tsx
function CustomElement() {
  const { createBorder, combineBorders } = useBorderTokens();

  // Δημιουργία custom border
  const customBorder = createBorder('medium', 'hsl(var(--primary))', 'dashed');

  // Combination πολλαπλών classes
  const combined = combineBorders(
    'border-2',
    'border-primary',
    'rounded-xl',
    'hover:border-secondary'
  );

  return <div className={combined}>Custom styled element</div>;
}
```

---

## 📋 ΔΙΑΘΕΣΙΜΑ VARIANTS

### **🏗️ COMPONENT VARIANTS**
- `card` - Subtle border για cards
- `button.default` - Standard button border
- `button.primary` - Primary action border
- `button.ghost` - Transparent border
- `input.default` - Input field border
- `input.focus` - Focused input border
- `input.error` - Error state border
- `modal` - Modal border (συνήθως none + shadow)
- `container` - Container border (συνήθως none)

### **🎨 STATUS VARIANTS**
- `status.success` - Πράσινο border για success
- `status.error` - Κόκκινο border για errors
- `status.warning` - Πορτοκαλί border για warnings
- `status.info` - Μπλε border για info

### **🔄 INTERACTIVE VARIANTS**
- `interactive.hover` - Hover state border
- `interactive.focus` - Focus state border
- `interactive.selected` - Selected state border

### **📏 SEPARATOR VARIANTS**
- `separator.horizontal` - Horizontal divider
- `separator.vertical` - Vertical divider

---

## 🎯 QUICK REFERENCE

### **⚡ QUICK BORDERS**

```tsx
const { quick } = useBorderTokens();

// Instant access to common patterns
<div className={quick.card}>Card</div>
<button className={quick.button}>Button</button>
<input className={quick.input} />
<div className={quick.success}>Success message</div>
<div className={quick.error}>Error message</div>
<hr className={quick.separatorH} />
```

### **📏 WIDTH TOKENS**
- `none` - 0px
- `hairline` - 0.5px
- `default` - 1px (most common)
- `medium` - 2px (emphasis)
- `thick` - 3px (primary actions)
- `heavy` - 4px (high emphasis)

### **🔘 RADIUS TOKENS**
- `none` - 0px (sharp)
- `xs` - 2px (subtle)
- `sm` - 4px (gentle)
- `default` - 6px (balanced)
- `md` - 8px (standard)
- `lg` - 12px (cards)
- `xl` - 16px (prominent)
- `2xl` - 20px (hero)
- `3xl` - 24px (special)
- `full` - circular

---

## 🚫 ΤΙ ΔΕΝ ΠΡΕΠΕΙ ΝΑ ΚΑΝΕΙΣ

### **❌ HARDCODED VALUES**
```tsx
// ❌ ΜΠΑΚΑΛΙΚΟ ΓΕΙΤΟΝΙΑΣ
<div className="border-2 border-red-500 rounded-lg" />
<div style={{border: "1px solid #ccc"}} />
```

### **✅ ENTERPRISE APPROACH**
```tsx
// ✅ ΕΠΑΓΓΕΛΜΑΤΙΚΟ
const { quick, getStatusBorder } = useBorderTokens();
<div className={getStatusBorder('error')} />
<div className={quick.card} />
```

---

## 🎯 MIGRATION STRATEGY

### **📋 ΒΗΜΑ 1: ΕΝΤΟΠΙΣΜΟΣ**
```bash
# Ψάξε για hardcoded borders
grep -r "border-" src/
grep -r "rounded-" src/
```

### **📋 ΒΗΜΑ 2: ΑΝΤΙΚΑΤΑΣΤΑΣΗ**
```tsx
// Πριν
<div className="border border-gray-200 rounded-lg p-4">

// Μετά
const { quick } = useBorderTokens();
<div className={`${quick.card} p-4`}>
```

### **📋 ΒΗΜΑ 3: VERIFICATION**
- Ελέγχε visual consistency
- Test σε light/dark mode
- Verify responsive behavior

---

## 🎨 THEMING SUPPORT

### **🌓 AUTOMATIC DARK MODE**
Όλα τα border colors αλλάζουν αυτόματα:
- Light: `border-gray-200`
- Dark: `border-gray-700`
- CSS Variables: `hsl(var(--border))`

### **🎯 BRAND CUSTOMIZATION**
Αλλάζεις τα χρώματα σε ένα σημείο:
```ts
// src/styles/design-tokens/core/borders.ts
primary: {
  css: 'hsl(var(--primary))' // Αυτό αλλάζει όλα τα primary borders
}
```

---

## 🏢 ENTERPRISE PRINCIPLES

### **✅ FOLLOWS INDUSTRY STANDARDS**
- **Microsoft Fluent UI** patterns
- **Google Material Design** principles
- **Apple Human Interface Guidelines**
- **Shopify Polaris** design tokens

### **✅ SCALABLE ARCHITECTURE**
- Single Source of Truth
- Type-safe development
- Zero runtime dependencies
- Tree-shakable exports

### **✅ DEVELOPER EXPERIENCE**
- IntelliSense support
- Clear naming conventions
- Comprehensive documentation
- Easy migration path

---

**🎯 ΑΠΟΤΕΛΕΣΜΑ: Enterprise-class border system που ανταγωνίζεται τις μεγαλύτερες εταιρείες λογισμικού!**