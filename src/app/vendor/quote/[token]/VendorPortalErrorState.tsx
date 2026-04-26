/**
 * Error state for invalid / expired / revoked / used vendor portal tokens.
 * Server Component. No interactivity.
 *
 * @module app/vendor/quote/[token]/VendorPortalErrorState
 * @enterprise ADR-327 §7
 */

import type { VendorPortalTokenInvalidReason } from '@/services/vendor-portal/vendor-portal-token-service';

const MESSAGES_EL: Record<string, { title: string; body: string }> = {
  malformed_token: {
    title: 'Μη έγκυρος σύνδεσμος',
    body: 'Ο σύνδεσμος είναι άκυρος ή έχει αλλοιωθεί. Επικοινωνήστε με τον υπεύθυνο του έργου.',
  },
  invalid_format: {
    title: 'Μη έγκυρος σύνδεσμος',
    body: 'Ο σύνδεσμος δεν είναι ολοκληρωμένος.',
  },
  invalid_signature: {
    title: 'Μη έγκυρος σύνδεσμος',
    body: 'Η υπογραφή του συνδέσμου δεν επαληθεύεται.',
  },
  server_config_error: {
    title: 'Σφάλμα διακομιστή',
    body: 'Δοκιμάστε ξανά σε λίγο.',
  },
  token_expired: {
    title: 'Ο σύνδεσμος έληξε',
    body: 'Η προθεσμία για την υποβολή της προσφοράς πέρασε.',
  },
  token_revoked: {
    title: 'Ο σύνδεσμος ανακλήθηκε',
    body: 'Ο σύνδεσμος δεν είναι πλέον ενεργός.',
  },
  token_already_used: {
    title: 'Έχετε ήδη υποβάλει',
    body: 'Η προσφορά έχει ήδη υποβληθεί από αυτόν τον σύνδεσμο.',
  },
  invite_not_found: {
    title: 'Δεν βρέθηκε πρόσκληση',
    body: 'Η πρόσκληση δεν υπάρχει ή έχει διαγραφεί.',
  },
};

interface Props {
  reason: VendorPortalTokenInvalidReason | 'invite_not_found';
}

export function VendorPortalErrorState({ reason }: Props) {
  const msg = MESSAGES_EL[reason] ?? MESSAGES_EL.malformed_token;
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-4">
          <h1 className="text-lg font-semibold text-slate-900">{msg.title}</h1>
        </header>
        <div className="px-6 py-6">
          <p className="text-sm leading-6 text-slate-700">{msg.body}</p>
        </div>
        <footer className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
          Nestor Construct
        </footer>
      </section>
    </main>
  );
}
