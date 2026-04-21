/**
 * @fileoverview Bank Account Form — Public Types
 * @description Props interface for BankAccountForm component
 */

import type { BankAccount, BankAccountInput } from '@/types/contacts/banking';

// ============================================================================
// TYPES
// ============================================================================

export interface BankAccountFormProps {
  /** Existing account for editing, or undefined for new */
  account?: BankAccount;
  /** Submit handler */
  onSubmit: (data: BankAccountInput) => Promise<void>;
  /** Cancel handler */
  onCancel: () => void;
  /** Whether the form is in loading state */
  loading?: boolean;
  /** Contact display name — used to pre-fill holder name */
  contactName?: string;
  /** Custom className */
  className?: string;
  /** ADR-317: DOM form id so an external button (header) can trigger requestSubmit() */
  formId?: string;
  /** ADR-317: Hide internal Save/Cancel so the header owns submission */
  hideActions?: boolean;
}
