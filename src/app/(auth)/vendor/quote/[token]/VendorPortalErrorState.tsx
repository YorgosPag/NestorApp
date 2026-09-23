'use client';

/**
 * Error state for invalid / expired / revoked / used vendor portal tokens.
 *
 * 🔴 **ADR-876 — ΤΡΙΑ ΣΦΑΛΜΑΤΑ ΣΤΗΝ ΙΔΙΑ ΟΘΟΝΗ, ΕΝΑ ΑΠΟ ΤΗ ΜΕΤΑΚΟΜΙΣΗ:**
 *  · εδώ ζούσε `MESSAGES_EL` — **ωμά ελληνικά** (N.11) που ήταν **αντίγραφο** κλειδιών που ήδη
 *    υπήρχαν στο `vendor-portal.json` (`errors.token*`). Ο Άγγλος προμηθευτής έβλεπε ελληνικά·
 *  · `<main className="min-h-screen">`: μέσα στο `(auth)` το `<main>` και το ύψος τα κατέχει
 *    **το layout** (`ShellSurface`) ⇒ διπλό `<main>` + 48px κύλιση (μετρημένο στο `(auth)/layout`).
 *    Πλέον `AuthCardSection` — η κάρτα του `(auth)`, ονομασμένη μία φορά·
 *  · `bg-white` σε θεματική επιφάνεια → `bg-card` (μέσω της κάρτας).
 *
 * @module app/(auth)/vendor/quote/[token]/VendorPortalErrorState
 * @enterprise ADR-327 §7 · ADR-876
 */

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { VendorPortalTokenInvalidReason } from '@/services/vendor-portal/vendor-portal-token-service';

type ErrorReason = VendorPortalTokenInvalidReason | 'invite_not_found';

/** Κάθε λόγος → το **υπάρχον** ζεύγος κλειδιών. Εξαντλητικό `Record`: νέος λόγος δεν μεταγλωττίζεται χωρίς μήνυμα. */
const ERROR_KEYS: Record<ErrorReason, { readonly title: string; readonly body: string }> = {
  malformed_token: { title: 'vendor-portal:errors.tokenInvalid', body: 'vendor-portal:errors.tokenInvalidBody' },
  invalid_format: { title: 'vendor-portal:errors.tokenInvalid', body: 'vendor-portal:errors.tokenInvalidBody' },
  invalid_signature: { title: 'vendor-portal:errors.tokenInvalid', body: 'vendor-portal:errors.tokenInvalidBody' },
  server_config_error: { title: 'vendor-portal:errors.serverError', body: 'vendor-portal:errors.serverErrorBody' },
  token_expired: { title: 'vendor-portal:errors.tokenExpired', body: 'vendor-portal:errors.tokenExpiredBody' },
  token_revoked: { title: 'vendor-portal:errors.tokenRevoked', body: 'vendor-portal:errors.tokenRevokedBody' },
  token_already_used: { title: 'vendor-portal:errors.tokenAlreadyUsed', body: 'vendor-portal:errors.tokenAlreadyUsedBody' },
  invite_not_found: { title: 'vendor-portal:errors.inviteNotFound', body: 'vendor-portal:errors.inviteNotFoundBody' },
};

interface Props {
  reason: ErrorReason;
}

export function VendorPortalErrorState({ reason }: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const keys = ERROR_KEYS[reason];
  return (
    <AuthCardSection gap={4}>
      <h1 className="m-0 text-lg font-semibold text-card-foreground">{t(keys.title)}</h1>
      <p className="m-0 text-sm leading-6 text-card-foreground">{t(keys.body)}</p>
      <footer className="border-t border-border pt-3 text-xs text-muted-foreground">{PRODUCT_NAME}</footer>
    </AuthCardSection>
  );
}
