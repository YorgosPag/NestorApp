import { z } from 'zod';
import i18n from '@/i18n/config';
import { PHONE_REGEX } from '@/lib/validation/phone-validation';
import { parseDate } from './validation/date-validators';

/**
 * 🔑 Η ΜΙΑ ΠΗΓΗ ΜΗΝΥΜΑΤΩΝ ΕΠΙΚΥΡΩΣΗΣ — i18n, αποτιμώμενη ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΧΡΗΣΗΣ.
 *
 * ⚠️ **ΤΟ NAMESPACE ΕΙΝΑΙ ΗΔΗ `forms` — ΜΗΝ ξαναγράψεις πρόθεμα `forms.` στο κλειδί.**
 * Μέχρι 2026-08-25 η κλήση ήταν `t('forms.validation.' + key, { ns: 'forms' })`:
 * διπλό πρόθεμα ⇒ το κλειδί δεν υπάρχει ⇒ το i18next επιστρέφει **το ίδιο το
 * κλειδί**, και ο χρήστης έβλεπε `forms.validation.required` σε **22** κανόνες
 * του `validationRules`. Αποδείχθηκε **εκτελώντας** το πραγματικό i18next.
 *
 * ⚠️ **ΜΗΝ την κάνεις σταθερά σε εμβέλεια module** (`const messages = build()`):
 * το module φορτώνεται πριν ολοκληρωθεί το `i18n.init()` ⇒ κάθε μήνυμα θα
 * «πάγωνε» ως **ωμό κλειδί** — το σχήμα του CHECK 3.51. Ακριβώς αυτό έκανε το
 * `validationMessages`, που αντικαταστάθηκε από αυτή τη συνάρτηση.
 *
 * ⚠️ **ΜΗΝ ξαναφέρεις δεύτερο μονοπάτι μηνυμάτων.** Το προηγούμενο ήταν
 * `try { getValidationMessages() } catch { <i18n fallback> }` πάνω σε συνάρτηση
 * που επιστρέφει σκέτο object literal, άρα **δεν μπορούσε να πετάξει ΠΟΤΕ**:
 * το fallback ήταν **αδρανής φρουρός** (ADR-749 §5) και τα πέντε μηνύματα
 * ημερομηνίας έβγαιναν `undefined` — κενό μήνυμα σφάλματος στην οθόνη.
 *
 * @see ADR-804 §2
 */
export const getValidationMessage = (key: string, params?: Record<string, unknown>) => {
  return i18n.t(`validation.${key}`, { ...params, ns: 'forms' });
};

/**
 * 🏛️ **Ο ΕΝΑΣ ΚΑΝΟΝΑΣ ΤΗΣ ΠΡΟΑΙΡΕΤΙΚΗΣ ΜΗ-ΜΕΛΛΟΝΤΙΚΗΣ ΗΜΕΡΟΜΗΝΙΑΣ** (N.0.2 · CHECK 3.28).
 *
 * Το `birthDate` και το `documentIssueDate` έθεταν **το ίδιο ερώτημα με δύο σώματα** —
 * *«κενό ⇒ δεκτό· αλλιώς έγκυρη ημερομηνία που δεν έχει περάσει το τώρα»* — και η μόνη
 * τους διαφορά ήταν **το κλειδί του μηνύματος**. Ο κλώνος ήταν κληρονομημένος (75 tokens,
 * τον ονόμασε το `jscpd --diff` όταν η μετανάστευση i18n ακούμπησε μία γραμμή του καθενός).
 *
 * ⚠️ **Η ΑΝΟΧΗ ΣΤΟ ΚΕΝΟ ΕΙΝΑΙ ΜΕΡΟΣ ΤΟΥ ΚΑΝΟΝΑ, ΟΧΙ ΠΑΡΑΛΕΙΨΗ**: το πεδίο είναι
 * `optional()`, άρα κενή συμβολοσειρά σημαίνει «δεν απάντησε ο άνθρωπος», όχι «άκυρη
 * ημερομηνία». Ένας τρίτος καλών που ξεχνούσε αυτή τη γραμμή θα έκανε το πεδίο **σιωπηλά
 * υποχρεωτικό**.
 */
const optionalNonFutureDate = (messageKey: string) => (message?: string) =>
  z.string()
    .optional()
    .refine(dateStr => {
      if (!dateStr || dateStr.trim() === '') return true; // Optional field
      const date = new Date(dateStr);
      return !isNaN(date.getTime()) && date <= new Date();
    }, {
      message: message || getValidationMessage(messageKey)
    });

// Common validation rules with i18n messages
export const validationRules = {
  // String validations
  required: (message?: string) => 
    z.string().min(1, message || getValidationMessage('required')),
  
  minLength: (min: number, message?: string) =>
    z.string().min(min, message || getValidationMessage('minLength', { min })),
  
  maxLength: (max: number, message?: string) =>
    z.string().max(max, message || getValidationMessage('maxLength', { max })),
  
  exactLength: (length: number, message?: string) =>
    z.string().length(length, message || getValidationMessage('exactLength', { length })),

  // Email validation
  email: (message?: string) =>
    z.string().email(message || getValidationMessage('invalidEmail')),

  // Phone validation — ADR-212: centralized
  phone: (message?: string) =>
    z.string().regex(PHONE_REGEX, message || getValidationMessage('invalidPhone')),

  // URL validation
  url: (message?: string) =>
    z.string().url(message || getValidationMessage('invalidUrl')),

  // Number validations
  number: (message?: string) =>
    z.number({ invalid_type_error: message || getValidationMessage('invalidNumber') }),

  integer: (message?: string) =>
    z.number().int(message || getValidationMessage('notInteger')),

  positiveNumber: (message?: string) =>
    z.number().positive(message || getValidationMessage('positiveNumber')),

  nonNegative: (message?: string) =>
    z.number().nonnegative(message || getValidationMessage('nonNegativeNumber')),

  minValue: (min: number, message?: string) =>
    z.number().min(min, message || getValidationMessage('minValue', { min })),

  maxValue: (max: number, message?: string) =>
    z.number().max(max, message || getValidationMessage('maxValue', { max })),

  greaterThan: (value: number, message?: string) =>
    z.number().gt(value, message || getValidationMessage('greaterThan', { value })),

  lessThan: (value: number, message?: string) =>
    z.number().lt(value, message || getValidationMessage('lessThan', { value })),

  // Date validations
  date: (message?: string) =>
    z.date({ invalid_type_error: message || getValidationMessage('invalidDate') }),

  pastDate: (message?: string) =>
    z.date().refine(date => date < new Date(), {
      message: message || getValidationMessage('pastDate')
    }),

  futureDate: (message?: string) =>
    z.date().refine(date => date > new Date(), {
      message: message || getValidationMessage('futureDate')
    }),

  // 🏢 ENTERPRISE DATE VALIDATION SYSTEM για όλη την εφαρμογή
  // ===============================================================

  /**
   * Ημερομηνία γέννησης - δεν μπορεί να είναι μελλοντική
   */
  birthDate: optionalNonFutureDate('dates.birthdateFutureError'),

  /**
   * Ημερομηνία έκδοσης εγγράφου - δεν μπορεί να είναι μελλοντική
   */
  documentIssueDate: optionalNonFutureDate('dates.issueDateFutureError'),

  /**
   * Ημερομηνία λήξης εγγράφου - πρέπει να είναι μετά την ημερομηνία έκδοσης
   */
  documentExpiryDate: (issueDate?: string, message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        if (!issueDate || issueDate.trim() === '') return true; // No issue date to compare

        const expiryDate = new Date(dateStr);
        const issueDateObj = new Date(issueDate);

        if (isNaN(expiryDate.getTime()) || isNaN(issueDateObj.getTime())) return true;

        return expiryDate > issueDateObj;
      }, {
        message: message || getValidationMessage('dates.expiryAfterIssueError')
      }),

  /**
   * Μελλοντική ημερομηνία - για events, meetings, deadlines κλπ
   */
  futureOrTodayDate: (message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today
        return !isNaN(date.getTime()) && date >= today;
      }, {
        message: message || getValidationMessage('dates.pastDateError')
      }),

  /**
   * Ημερομηνία εντός εύλογου παρελθόντος (π.χ. max 150 χρόνια πίσω για γεννήσεις)
   */
  reasonablePastDate: (maxYearsAgo: number = 150, message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        const minDate = new Date();
        minDate.setFullYear(minDate.getFullYear() - maxYearsAgo);
        return !isNaN(date.getTime()) && date >= minDate && date <= new Date();
      }, {
        // 🌐 i18n: Converted to i18n key with interpolation - 2026-01-18
        message: message || getValidationMessage('dates.maxYearsAgo', { years: maxYearsAgo })
      }),

  /**
   * Ημερομηνία εντός εύλογου μέλλοντος (π.χ. max 10 χρόνια μπροστά για events)
   */
  reasonableFutureDate: (maxYearsAhead: number = 10, message?: string) =>
    z.string()
      .optional()
      .refine(dateStr => {
        if (!dateStr || dateStr.trim() === '') return true; // Optional field
        const date = new Date(dateStr);
        const maxDate = new Date();
        maxDate.setFullYear(maxDate.getFullYear() + maxYearsAhead);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return !isNaN(date.getTime()) && date >= today && date <= maxDate;
      }, {
        // 🌐 i18n: Converted to i18n key with interpolation - 2026-01-18
        message: message || getValidationMessage('dates.maxYearsAhead', { years: maxYearsAhead })
      }),

  // Selection validation
  selection: (options: string[], message?: string) =>
    z.enum(options as [string, ...string[]], {
      errorMap: () => ({ message: message || getValidationMessage('invalidSelection') })
    }),

  // Custom business logic validations
  area: (message?: string) =>
    z.number().positive(message || getValidationMessage('areaRequired')),

  price: (message?: string) =>
    z.number().positive(message || getValidationMessage('priceRequired')),

  code: (message?: string) =>
    z.string().min(1, message || getValidationMessage('invalidCode')),
};

// 🏢 ENTERPRISE DATE UTILITY FUNCTIONS
// Extracted to ./validation/date-validators.ts (ADR-314 Phase B — Google SRP file split)
// formatDateForDisplay alias REMOVED — canonical SSoT: '@/lib/intl-utils'
export {
  parseDate,
  isDatePastOrToday,
} from './validation/date-validators';


// Utility to convert Zod errors to form-friendly format
export const formatZodErrors = (error: z.ZodError) => {
  const formattedErrors: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const path = err.path.join('.');
    formattedErrors[path] = err.message;
  });
  
  return formattedErrors;
};

// 🏢 ENTERPRISE DATE VALIDATION FUNCTIONS
// =========================================
// Χρησιμοποίησε αυτές τις functions για custom validation logic

/**
 * Validates document expiry date against issue date
 * @param formData - Form data containing both dates
 * @returns validation result
 */
export const validateDocumentDates = (formData: {
  documentIssueDate?: string;
  documentExpiryDate?: string;
}) => {
  const { documentIssueDate, documentExpiryDate } = formData;

  // If either date is missing, skip validation
  if (!documentIssueDate || !documentExpiryDate) return { isValid: true };

  const issueDate = parseDate(documentIssueDate);
  const expiryDate = parseDate(documentExpiryDate);

  // If either date is invalid, skip validation (other validators will catch this)
  if (!issueDate || !expiryDate) return { isValid: true };

  const isValid = expiryDate > issueDate;

  return {
    isValid,
    error: isValid ? undefined : getValidationMessage('dates.dateComparisonError')
  };
};

