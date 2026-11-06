/**
 * Ο παραλήπτης μιας **προεπισκόπησης** πρόσκλησης — ίδια δύο σχήματα με τη δημιουργία (επαφή ή χειροκίνητο email),
 * κοινός τύπος για τη φόρμα και τον server (ADR-327 §7.5).
 *
 * @module subapps/procurement/types/vendor-invite-preview
 */
export type VendorInvitePreviewRecipient =
  | { readonly vendorContactId: string }
  | { readonly manualEmail: string; readonly manualName?: string };
