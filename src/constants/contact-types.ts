/**
 * =============================================================================
 * SSoT: ContactType Canonical Definitions (Server-Safe Leaf)
 * =============================================================================
 *
 * **Single Source of Truth** για τον τύπο μιας επαφής (individual / company /
 * service). Πριν από αυτό το module, το ίδιο concept οριζόταν σε πολλαπλά σημεία:
 *   - inline union στο `src/types/contacts/contracts.ts`
 *   - object literal στο `src/constants/contacts.ts` (UI-heavy, imports lucide/styles)
 *   - hardcoded bilingual if/else στο UC-013 admin-property-stats-module.ts
 *
 * **Layering**: Leaf module — **καμία** εξάρτηση από React/UI/styles. Ασφαλές
 * για import σε server-only code (AI pipeline, API routes, workers).
 *
 * **Γιατί ξεχωριστό από `contacts.ts`**: Το `contacts.ts` εισάγει
 * lucide-react + brandClasses + useSemanticColors — δεν μπορεί να τρέξει σε
 * `'server-only'` modules. Το παρόν leaf είναι pure data.
 *
 * @module constants/contact-types
 * @enterprise ADR-287 — Enum SSoT Centralization (Batch 10B)
 */

// =============================================================================
// 1. CANONICAL ARRAY
// =============================================================================

/**
 * All canonical ContactType values.
 *
 * - `individual` — Φυσικό πρόσωπο
 * - `company`    — Εταιρεία / Νομικό πρόσωπο
 * - `service`    — Υπηρεσία / Δημόσιος φορέας / Ρυθμιστική αρχή
 */
export const CONTACT_TYPES = ['individual', 'company', 'service'] as const;

/** Canonical TypeScript union — derived automatically from `CONTACT_TYPES`. */
export type ContactType = (typeof CONTACT_TYPES)[number];

// =============================================================================
// 2. RUNTIME TYPE GUARD
// =============================================================================


// =============================================================================
// 3. ALIAS RESOLUTION — Greek ↔ English normalization
// =============================================================================

/**
 * Alias map: user-facing / legacy input → canonical `ContactType`.
 *
 * Keys αποθηκεύονται **lowercase** — ο resolver κάνει `.toLowerCase().trim()`
 * πριν το lookup. Περιέχει:
 *   - Canonical values (self-mapping) για idempotency
 *   - Greek aliases με/χωρίς τόνους, σε πολλαπλές μορφές
 *
 * **Προσθήκη νέου alias**: Πρόσθεσε entry εδώ — δεν χρειάζεται αλλαγή αλλού.
 */
export const CONTACT_TYPE_ALIASES: Record<string, ContactType> = {
  // Canonical (self-mapping)
  'individual': 'individual',
  'company': 'company',
  'service': 'service',

  // Greek — individual / φυσικό πρόσωπο
  'ιδιώτης': 'individual',
  'ιδιωτης': 'individual',
  'φυσικό πρόσωπο': 'individual',
  'φυσικο προσωπο': 'individual',
  'φυσικά πρόσωπα': 'individual',
  'φυσικα προσωπα': 'individual',
  'άτομο': 'individual',
  'ατομο': 'individual',
  'person': 'individual',

  // Greek — company / εταιρεία (both spellings — Γιώργος uses both in data)
  'εταιρεία': 'company',
  'εταιρεια': 'company',
  'εταιρία': 'company',
  'εταιρια': 'company',
  'εταιρείες': 'company',
  'εταιρειες': 'company',
  'εταιρίες': 'company',
  'εταιριες': 'company',
  'νομικό πρόσωπο': 'company',
  'νομικο προσωπο': 'company',
  'οργανισμός': 'company',
  'οργανισμος': 'company',
  'corporation': 'company',
  'business': 'company',

  // Greek — service / υπηρεσία / δημόσιος φορέας
  'υπηρεσία': 'service',
  'υπηρεσια': 'service',
  'δημόσιος φορέας': 'service',
  'δημοσιος φορεας': 'service',
  'δημόσιο': 'service',
  'δημοσιο': 'service',
  'φορέας': 'service',
  'φορεας': 'service',
  'agency': 'service',
  'government': 'service',
};

/**
 * Normalize any user-facing or legacy input to the canonical `ContactType`.
 *
 * Safe to call with untrusted input (Firestore data, AI-extracted entities,
 * user message text). Returns `null` αν το value δεν αντιστοιχεί σε γνωστό
 * alias — ο consumer μπορεί να εφαρμόσει fallback (π.χ. default 'individual').
 *
 * @param raw — Οποιοδήποτε string (με ή χωρίς whitespace, case-insensitive)
 * @returns Canonical `ContactType` ή `null` αν unknown
 *
 * @example
 * normalizeContactType('εταιρία')        // → 'company'
 * normalizeContactType('  COMPANY  ')    // → 'company' (idempotent)
 * normalizeContactType('κάτι τυχαίο')    // → null
 */
export function normalizeContactType(raw: unknown): ContactType | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase();
  if (key.length === 0) return null;
  return CONTACT_TYPE_ALIASES[key] ?? null;
}

/**
 * Convenience predicate: `true` αν το raw input κανονικοποιείται σε `'company'`.
 *
 * Χρήσιμο για binary bucket aggregation (π.χ. UC-013 admin stats:
 * companies vs individuals/everything-else).
 *
 * @example
 * isCompanyContactType('εταιρία')  // → true
 * isCompanyContactType('company')  // → true
 * isCompanyContactType('ιδιώτης')  // → false
 * isCompanyContactType(null)       // → false
 */
export function isCompanyContactType(raw: unknown): boolean {
  return normalizeContactType(raw) === 'company';
}
