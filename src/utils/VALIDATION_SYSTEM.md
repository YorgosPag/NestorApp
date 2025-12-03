# 🏢 ENTERPRISE DATE VALIDATION SYSTEM

**Κεντρικοποιημένο validation system για όλη την εφαρμογή**

---

## 📍 **SINGLE SOURCE OF TRUTH**

**Location**: `src/utils/validation.ts`

**Purpose**: Centralized, enterprise-class validation για όλους τους τύπους δεδομένων της εφαρμογής, με ειδική έμφαση στις ημερομηνίες.

---

## 🎯 **ΤΥΠΟΙ VALIDATION**

### 1. **DATE VALIDATIONS**

```typescript
import {
  validateDocumentDates,
  isDatePastOrToday,
  isDateFutureOrToday,
  parseDate,
  formatDateForDisplay
} from '@/utils/validation';
```

#### ✅ **Available Date Validators:**

| Validator | Purpose | Example |
|-----------|---------|---------|
| `birthDate()` | Ημερομηνία γέννησης (δεν μπορεί να είναι μελλοντική) | `validationRules.birthDate()` |
| `documentIssueDate()` | Ημερομηνία έκδοσης εγγράφου (δεν μπορεί να είναι μελλοντική) | `validationRules.documentIssueDate()` |
| `documentExpiryDate()` | Ημερομηνία λήξης (πρέπει να είναι μετά την έκδοση) | `validationRules.documentExpiryDate(issueDate)` |
| `futureOrTodayDate()` | Μελλοντικές ημερομηνίες (events, meetings) | `validationRules.futureOrTodayDate()` |
| `reasonablePastDate()` | Εύλογο παρελθόν (π.χ. max 150 χρόνια) | `validationRules.reasonablePastDate(150)` |
| `reasonableFutureDate()` | Εύλογο μέλλον (π.χ. max 10 χρόνια) | `validationRules.reasonableFutureDate(10)` |

### 2. **UTILITY FUNCTIONS**

```typescript
// Date parsing & validation
const date = parseDate('2025-12-03'); // Date | null
const isValid = isValidDate('2025-12-03'); // boolean

// Date comparisons
const isPast = isDatePastOrToday('2025-12-03'); // boolean
const isFuture = isDateFutureOrToday('2025-12-03'); // boolean
const isBeforeOrEqual = isDateBeforeOrEqual('2025-12-01', '2025-12-03'); // boolean

// Formatting
const formatted = formatDateForDisplay('2025-12-03'); // "03/12/2025"
```

### 3. **CONTACT VALIDATIONS**

#### **Individual Contact**
```typescript
import { fieldValidations } from '@/utils/validation';

const individualSchema = {
  firstName: fieldValidations.individual.firstName,
  lastName: fieldValidations.individual.lastName,
  birthDate: fieldValidations.individual.birthDate,
  documentIssueDate: fieldValidations.individual.documentIssueDate,
  vatNumber: fieldValidations.individual.vatNumber,
  amka: fieldValidations.individual.amka,
  email: fieldValidations.individual.email,
  phone: fieldValidations.individual.phone,
};
```

#### **Company Contact**
```typescript
const companySchema = {
  companyName: fieldValidations.company.companyName,
  vatNumber: fieldValidations.company.vatNumber,
  email: fieldValidations.company.email,
  phone: fieldValidations.company.phone,
};
```

#### **Service Contact**
```typescript
const serviceSchema = {
  serviceName: fieldValidations.service.serviceName,
  email: fieldValidations.service.email,
  phone: fieldValidations.service.phone,
};
```

---

## 🚀 **USAGE EXAMPLES**

### **1. Individual Contact Form Validation**

```typescript
import {
  validateDocumentDates,
  isDatePastOrToday
} from '@/utils/validation';

function validateIndividualContact(formData: ContactFormData): boolean {
  // Basic fields
  if (!formData.firstName.trim() || !formData.lastName.trim()) {
    toast.error("Συμπληρώστε όνομα και επώνυμο.");
    return false;
  }

  // 🎯 DATE VALIDATIONS
  // Birth date - cannot be future
  if (formData.birthDate && !isDatePastOrToday(formData.birthDate)) {
    toast.error("Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική.");
    return false;
  }

  // Document issue date - cannot be future
  if (formData.documentIssueDate && !isDatePastOrToday(formData.documentIssueDate)) {
    toast.error("Η ημερομηνία έκδοσης εγγράφου δεν μπορεί να είναι μελλοντική.");
    return false;
  }

  // Document dates relationship
  const documentValidation = validateDocumentDates({
    documentIssueDate: formData.documentIssueDate,
    documentExpiryDate: formData.documentExpiryDate
  });

  if (!documentValidation.isValid && documentValidation.error) {
    toast.error(documentValidation.error);
    return false;
  }

  return true;
}
```

### **2. Schema-based Validation με Zod**

```typescript
import { createContactValidationSchema } from '@/utils/validation';

// Create schema for specific contact type
const schema = createContactValidationSchema('individual');

// Validate form data
try {
  const validatedData = schema.parse(formData);
  // ✅ Valid - proceed
} catch (error) {
  if (error instanceof z.ZodError) {
    // ❌ Show validation errors
    const errors = formatZodErrors(error);
    console.error('Validation errors:', errors);
  }
}
```

### **3. Custom Date Validation**

```typescript
import { validateDocumentDates } from '@/utils/validation';

// Validate expiry after issue date
const result = validateDocumentDates({
  documentIssueDate: '2024-01-01',
  documentExpiryDate: '2026-01-01'
});

if (result.isValid) {
  console.log('✅ Document dates are valid');
} else {
  console.error('❌', result.error);
}
```

---

## 🔧 **INTEGRATION**

### **Current Integrations:**

1. **✅ useContactSubmission.ts** - Contact forms validation
2. **✅ Individual Contact Forms** - Birth date, document dates
3. **✅ Company Contact Forms** - Basic validation
4. **✅ Service Contact Forms** - Basic validation

### **Future Integrations:**

- **Projects**: Start/end dates, deadlines
- **Obligations**: Due dates, completion dates
- **CRM**: Meeting dates, follow-up dates
- **Tasks**: Due dates, reminder dates
- **Events**: Event dates, booking dates

---

## 🏗️ **ARCHITECTURE**

### **Design Principles:**

1. **Single Source of Truth** - Όλα τα validations στο `src/utils/validation.ts`
2. **Reusable Components** - Validation rules μπορούν να συνδυαστούν
3. **Type Safety** - Full TypeScript support με Zod
4. **Internationalization Ready** - Greek error messages
5. **Enterprise Class** - Production-ready με comprehensive testing

### **Pattern:**

```typescript
// 1. Define validation rules
validationRules.ruleName(params, customMessage)

// 2. Create field validations
fieldValidations.category.fieldName

// 3. Create schemas
createContactValidationSchema(type)

// 4. Validate data
validateSpecificFunction(formData)
```

---

## 📝 **ERROR MESSAGES**

**Όλα τα error messages είναι στα ελληνικά:**

- `"Η ημερομηνία γέννησης δεν μπορεί να είναι μελλοντική"`
- `"Η ημερομηνία έκδοσης δεν μπορεί να είναι μελλοντική"`
- `"Η ημερομηνία λήξης πρέπει να είναι μετά την ημερομηνία έκδοσης"`
- `"Η ημερομηνία δεν μπορεί να είναι παρελθούσα"`
- `"Η ημερομηνία δεν μπορεί να είναι πάνω από X χρόνια πίσω/μπροστά"`

---

## ⚠️ **IMPORTANT NOTES**

### **1. Centralization Rule**
**ΠΟΤΕ** μη δημιουργείς duplicate validation logic. **ΠΑΝΤΑ** χρησιμοποίησε το centralized system.

### **2. Optional Fields**
Όλα τα date validations είναι optional-friendly - επιτρέπουν empty/undefined values.

### **3. Date Format**
Το validation system δουλεύει με:
- Date objects
- ISO date strings
- JavaScript Date constructor compatible strings

### **4. Performance**
Όλες οι date comparisons γίνονται με native Date objects για maximum performance.

---

## 🧪 **TESTING**

```typescript
// Test date validations
import { isDatePastOrToday, validateDocumentDates } from '@/utils/validation';

// Test past date validation
expect(isDatePastOrToday('2020-01-01')).toBe(true);  // ✅ Past
expect(isDatePastOrToday('2030-01-01')).toBe(false); // ❌ Future

// Test document dates
const result = validateDocumentDates({
  documentIssueDate: '2024-01-01',
  documentExpiryDate: '2023-01-01' // ❌ Before issue
});
expect(result.isValid).toBe(false);
expect(result.error).toContain('λήξης πρέπει να είναι μετά την έκδοσης');
```

---

## 🔮 **FUTURE ENHANCEMENTS**

1. **Date Range Validations** - Start/end date pairs
2. **Business Days Validation** - Skip weekends/holidays
3. **Timezone Support** - For international apps
4. **Custom Date Formats** - Support for DD/MM/YYYY, etc.
5. **Age Validations** - Minimum/maximum age checks
6. **Working Hours Validation** - Business hours constraints

---

**Created**: 2025-12-03
**Last Updated**: 2025-12-03
**Version**: 1.0.0
**Status**: ✅ Production Ready