'use client';

/**
 * Γιατί δεν άνοιξε η πύλη — και, για ληγμένο σύνδεσμο, **«Στείλτε μου νέο σύνδεσμο»** (ADR-876 §5).
 *
 * 🔑 Ένας λόγος → ένα ζεύγος κλειδιών, με εξαντλητικό `Record` πάνω στο **ΕΝΑ** λεξιλόγιο αρνήσεων
 * του αναλυτή (`VendorInviteRefusal`): νέα άρνηση δεν μεταγλωττίζεται χωρίς μήνυμα. Πριν, η οθόνη
 * είχε δικό της λεξιλόγιο και η **άρνηση του ίδιου του προμηθευτή** εμφανιζόταν ως «ανακλήθηκε» (Σ5).
 *
 * ⚠️ Η ανανέωση απαντά **πάντα** το ίδιο («ελέγξτε το email σας») — η οθόνη δεν μαθαίνει, και άρα
 * δεν προδίδει, αν η πρόσκληση υπάρχει.
 *
 * Ιστορικό (ADR-876 Ε10/Ε11): `AuthCardSection` αντί για `<main className="min-h-screen">`· κλειδιά
 * i18n αντί για ωμά ελληνικά.
 *
 * @module app/(auth)/vendor/quote/VendorPortalErrorState
 * @enterprise ADR-327 §7 · ADR-876
 */

import { useState } from 'react';

import { AuthCardSection } from '@/components/ui/auth-card-section';
import { Button } from '@/components/ui/button';
import { PRODUCT_NAME } from '@/constants/product-identity';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import { vendorPortalAction, type VendorPortalFailure } from './vendor-portal-api';

interface MessageKeys {
  readonly title: string;
  readonly body: string;
}

const INVALID: MessageKeys = { title: 'vendor-portal:errors.tokenInvalid', body: 'vendor-portal:errors.tokenInvalidBody' };
const SERVER: MessageKeys = { title: 'vendor-portal:errors.serverError', body: 'vendor-portal:errors.serverErrorBody' };

const ERROR_KEYS: Record<VendorPortalFailure, MessageKeys> = {
  invalid_link: INVALID,
  link_not_found: INVALID,
  server_config_error: SERVER,
  server_error: SERVER,
  missing_link: { title: 'vendor-portal:errors.linkMissing', body: 'vendor-portal:errors.linkMissingBody' },
  link_expired: { title: 'vendor-portal:errors.tokenExpired', body: 'vendor-portal:errors.tokenExpiredBody' },
  link_revoked: { title: 'vendor-portal:errors.tokenRevoked', body: 'vendor-portal:errors.tokenRevokedBody' },
  invite_revoked: { title: 'vendor-portal:errors.inviteRevoked', body: 'vendor-portal:errors.inviteRevokedBody' },
  invite_declined: { title: 'vendor-portal:errors.inviteDeclined', body: 'vendor-portal:errors.inviteDeclinedBody' },
  already_submitted: { title: 'vendor-portal:errors.tokenAlreadyUsed', body: 'vendor-portal:errors.tokenAlreadyUsedBody' },
  edit_window_closed: { title: 'vendor-portal:errors.editWindowClosed', body: 'vendor-portal:errors.editWindowClosedBody' },
};

interface Props {
  readonly reason: VendorPortalFailure;
  /** Υπάρχει ⇒ ο σύνδεσμος (ακόμη και ληγμένος) μπορεί να ζητήσει νέο. */
  readonly token: string | null;
}

type RenewPhase = 'idle' | 'sending' | 'sent';

function RenewAction({ token }: { readonly token: string }) {
  const { t, i18n } = useTranslation(['vendor-portal']);
  const [phase, setPhase] = useState<RenewPhase>('idle');

  const requestNewLink = async () => {
    setPhase('sending');
    try {
      await vendorPortalAction(token, '/renew', { locale: i18n.language === 'en' ? 'en' : 'el' });
    } catch {
      // Ουδέτερο και στο σφάλμα δικτύου: η απάντηση δεν διαφοροποιείται ποτέ.
    }
    setPhase('sent');
  };

  if (phase === 'sent') {
    return (
      <section className="rounded-md border border-border bg-muted p-3" aria-live="polite">
        <h2 className="m-0 text-sm font-semibold text-card-foreground">{t('vendor-portal:renew.sentTitle')}</h2>
        <p className="m-0 mt-1 text-sm leading-6 text-card-foreground">{t('vendor-portal:renew.sentBody')}</p>
      </section>
    );
  }
  return (
    <Button type="button" onClick={requestNewLink} disabled={phase === 'sending'}>
      {phase === 'sending' ? t('vendor-portal:renew.sending') : t('vendor-portal:renew.action')}
    </Button>
  );
}

export function VendorPortalErrorState({ reason, token }: Props) {
  const { t } = useTranslation(['vendor-portal']);
  const keys = ERROR_KEYS[reason];
  return (
    <AuthCardSection gap={4}>
      <h1 className="m-0 text-lg font-semibold text-card-foreground">{t(keys.title)}</h1>
      <p className="m-0 text-sm leading-6 text-card-foreground">{t(keys.body)}</p>
      {reason === 'link_expired' && token ? <RenewAction token={token} /> : null}
      <footer className="border-t border-border pt-3 text-xs text-muted-foreground">{PRODUCT_NAME}</footer>
    </AuthCardSection>
  );
}
