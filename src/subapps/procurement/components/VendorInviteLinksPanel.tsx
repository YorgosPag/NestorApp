'use client';

/**
 * **Οι σύνδεσμοι μιας πρόσκλησης** — από πού βγήκε ο καθένας, ζει, χρησιμοποιήθηκε, ανάκληση ενός (ADR-876 §5).
 *
 * «Ένας σύνδεσμος = ένα διαπιστευτήριο» (W3C TAG *Capability URLs*): το γραφείο βλέπει **ποιος**
 * σύνδεσμος άνοιξε την πύλη (email πρόσκλησης · αντιγραφή · επαναποστολή · αίτημα προμηθευτή) και
 * ανακαλεί **εκείνον** — χωρίς να ακυρώσει το email που ο προμηθευτής ήδη κρατά (πάνω από DocuSign,
 * όπου η ανάκληση είναι ολική). Η λίστα δεν περιέχει ποτέ υλικό που φτιάχνει σύνδεσμο.
 *
 * @module subapps/procurement/components/VendorInviteLinksPanel
 */

import { useCallback, useEffect, useState } from 'react';
import { XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import type { BadgeVariantProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { VendorInviteCredentialSummary } from '../types/vendor-invite-credential';

type LinkState = 'active' | 'expired' | 'revoked';

const STATE_VARIANTS: Record<LinkState, BadgeVariantProps['variant']> = {
  active: 'success',
  expired: 'muted',
  revoked: 'outline',
};

function linkState(link: VendorInviteCredentialSummary, nowMs: number): LinkState {
  if (link.revokedAt) return 'revoked';
  return Date.parse(link.expiresAt) <= nowMs ? 'expired' : 'active';
}

function formatInstant(iso: string | null, locale: string, never: string): string {
  if (!iso) return never;
  return new Date(iso).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

interface Props {
  readonly inviteId: string;
  readonly listLinks: (inviteId: string) => Promise<VendorInviteCredentialSummary[]>;
  readonly revokeLink: (inviteId: string, credentialId: string) => Promise<void>;
  /** Αλλάζει όταν εκδίδεται νέος σύνδεσμος — ξαναφορτώνει τη λίστα. */
  readonly revision: number;
}

type Load =
  | { readonly phase: 'loading' }
  | { readonly phase: 'failed' }
  | { readonly phase: 'ready'; readonly links: VendorInviteCredentialSummary[] };

export function VendorInviteLinksPanel({ inviteId, listLinks, revokeLink, revision }: Props) {
  const { t, i18n } = useTranslation('quotes');
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [revoking, setRevoking] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoad({ phase: 'ready', links: await listLinks(inviteId) });
    } catch {
      setLoad({ phase: 'failed' });
    }
  }, [inviteId, listLinks]);

  useEffect(() => {
    void reload();
  }, [reload, revision]);

  const onRevoke = useCallback(async (credentialId: string) => {
    if (!confirm(t('invites.links.confirmRevoke'))) return;
    setRevoking(credentialId);
    try {
      await revokeLink(inviteId, credentialId);
      await reload();
    } finally {
      setRevoking(null);
    }
  }, [inviteId, reload, revokeLink, t]);

  if (load.phase === 'loading') return <p className="text-xs text-muted-foreground">{t('invites.links.loading')}</p>;
  if (load.phase === 'failed') return <p className="text-xs text-destructive">{t('invites.errors.linksFailed')}</p>;

  const nowMs = Date.now();
  const never = t('invites.links.never');
  return (
    <section aria-label={t('invites.links.title')} className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('invites.links.hint')}</p>
      {load.links.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t('invites.links.empty')}</p>
      ) : (
        <ul className="space-y-1">
          {load.links.map((link) => {
            const state = linkState(link, nowMs);
            return (
              <li key={link.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="font-medium">{t(`invites.links.origin.${link.issuedVia}`)}</span>
                <Badge variant={STATE_VARIANTS[state]}>{t(`invites.links.state.${state}`)}</Badge>
                <span className="text-muted-foreground">
                  {t('invites.links.issuedAt')}: {formatInstant(link.issuedAt, i18n.language, never)}
                </span>
                <span className="text-muted-foreground">
                  {t('invites.links.expiresAt')}: {formatInstant(link.expiresAt, i18n.language, never)}
                </span>
                <span className="text-muted-foreground">
                  {t('invites.links.lastUsed')}: {formatInstant(link.lastUsedAt, i18n.language, never)}
                </span>
                {state === 'active' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRevoke(link.id)}
                    disabled={revoking === link.id}
                    aria-label={t('invites.links.revoke')}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
