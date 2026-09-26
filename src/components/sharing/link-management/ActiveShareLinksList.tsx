/**
 * =============================================================================
 * ActiveShareLinksList — «Ενεργοί σύνδεσμοι» μιας οντότητας (ADR-315 §5)
 * =============================================================================
 *
 * Η λίστα του κατόχου (πρότυπο Drive «Manage access» / DocSend «All Links»), με:
 *   - **Ανάκληση** ανά σύνδεσμο — με επιβεβαίωση, επειδή είναι **μη αναστρέψιμη** (Dropbox: «you
 *     won't be able to re-enable it»). Καμία ψεύτικη «αναίρεση» σε ενέργεια ασφαλείας: μια
 *     αναβαλλόμενη ανάκληση που χάνεται με το κλείσιμο της καρτέλας θα άφηνε τον άνθρωπο να
 *     πιστεύει ότι έκοψε πρόσβαση που δεν έκοψε.
 *   - **Ρυθμίσεις χωρίς αλλαγή URL** (Α13) — μέσα στη γραμμή.
 *   - **«Ανάκληση όλων (εκτός από αυτόν)»** — το Dropbox δεν έχει μαζική ανάκληση.
 *
 * @module components/sharing/link-management/ActiveShareLinksList
 */

'use client';

import React, { useCallback, useState } from 'react';
import { Link2Off, RotateCw } from 'lucide-react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/spinner';
import { LinkTokenForm } from '@/components/ui/sharing/panels/link-token/LinkTokenForm';
import { draftToUpdate, summaryToDraft } from '@/components/ui/sharing/panels/link-token/draft-mapping';
import type { LinkTokenDraft } from '@/components/ui/sharing/panels/link-token/types';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { ApiClientError } from '@/lib/api/api-client-types';
import { useNotifications } from '@/providers/NotificationProvider';
import type { ShareKindLinkPolicy } from '@/services/sharing/share-resolve-contract';
import type { ShareLinkSummary } from '@/types/sharing';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { ActiveShareLinkRow } from './ActiveShareLinkRow';
import type { UseShareLinksResult } from './useShareLinks';

export interface ActiveShareLinksListProps {
  readonly state: UseShareLinksResult;
  /** Ο σύνδεσμος που μόλις γεννήθηκε σε αυτή τη συνεδρία — σημαίνεται και εξαιρείται από το «όλων εκτός». */
  readonly currentShareId: string | null;
  /** ADR-884 Κ3β — η πολιτική συνδέσμου του είδους, για τη φόρμα ρυθμίσεων. */
  readonly policy?: ShareKindLinkPolicy;
}

type RevokeTarget = { readonly kind: 'one'; readonly link: ShareLinkSummary } | { readonly kind: 'all' };

/** Ο ονομασμένος λόγος άρνησης του διακομιστή, αν υπάρχει. */
function refusalReason(error: unknown): string | null {
  if (!(error instanceof ApiClientError)) return null;
  const body = error.errorBody as { reason?: unknown } | undefined;
  return typeof body?.reason === 'string' ? body.reason : null;
}

function useLinkEditor(state: UseShareLinksResult) {
  const { t } = useTranslation(['files', 'files-media']);
  const notifications = useNotifications();
  const [editing, setEditing] = useState<{ link: ShareLinkSummary; draft: LinkTokenDraft } | null>(null);
  const [saving, setSaving] = useState(false);

  const open = useCallback((link: ShareLinkSummary) => setEditing({ link, draft: summaryToDraft(link) }), []);
  const close = useCallback(() => setEditing(null), []);
  const setDraft = useCallback((draft: LinkTokenDraft) => setEditing((prev) => (prev ? { ...prev, draft } : prev)), []);

  const save = useCallback(async () => {
    const request = editing ? draftToUpdate(editing.draft, editing.link) : null;
    if (!editing || !request) return;
    setSaving(true);
    try {
      await state.update(editing.link.shareId, request);
      notifications.success(t('share.links.updated'));
      setEditing(null);
    } catch (error) {
      const reason = refusalReason(error);
      notifications.error(reason === 'max-below-count' ? t('share.links.maxBelowCount') : t('share.links.actionError'));
    } finally {
      setSaving(false);
    }
  }, [editing, state, notifications, t]);

  return { editing, saving, open, close, setDraft, save };
}

function useRevocation(state: UseShareLinksResult, currentShareId: string | null) {
  const { t } = useTranslation(['files', 'files-media']);
  const notifications = useNotifications();
  const [target, setTarget] = useState<RevokeTarget | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback(async () => {
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === 'one') {
        await state.revoke(target.link.shareId);
        notifications.success(t('share.links.revoked'));
      } else {
        const count = await state.revokeAll(currentShareId ?? undefined);
        notifications.success(t('share.links.revokedMany', { count }));
      }
      setTarget(null);
    } catch {
      notifications.error(t('share.links.actionError'));
    } finally {
      setBusy(false);
    }
  }, [target, state, currentShareId, notifications, t]);

  return { target, setTarget, busy, confirm };
}

export function ActiveShareLinksList({ state, currentShareId, policy }: ActiveShareLinksListProps): React.ReactElement {
  const { t } = useTranslation(['files', 'files-media']);
  const colors = useSemanticColors();
  const editor = useLinkEditor(state);
  const revocation = useRevocation(state, currentShareId);
  const { links, status } = state;
  const othersCount = links.filter((link) => link.shareId !== currentShareId).length;
  const target = revocation.target;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="active-share-links-title" aria-busy={status === 'loading'}>
      <header className="flex items-center justify-between gap-2">
        <h3 id="active-share-links-title" className="text-sm font-semibold">
          {t('share.links.title', { count: links.length })}
        </h3>
        {othersCount > 1 && (
          <Button type="button" size="sm" variant="outline" onClick={() => revocation.setTarget({ kind: 'all' })}>
            <Link2Off className="h-4 w-4 mr-1" />
            {currentShareId ? t('share.links.revokeAllOthers') : t('share.links.revokeAll')}
          </Button>
        )}
      </header>

      {status === 'loading' && links.length === 0 && <Spinner size="small" />}
      {status === 'error' && (
        <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
          {t('share.links.loadError')}
          <Button type="button" size="sm" variant="ghost" onClick={() => void state.refresh()}>
            <RotateCw className="h-4 w-4 mr-1" />{t('share.links.retry')}
          </Button>
        </p>
      )}
      {status === 'ready' && links.length === 0 && (
        <EmptyState size="sm" icon={Link2Off} title={t('share.links.empty')} description={t('share.links.emptyHint')} />
      )}

      {links.length > 0 && (
        <ul className="flex flex-col gap-2">
          {links.map((link) => (
            <ActiveShareLinkRow
              key={link.shareId}
              link={link}
              isCurrent={link.shareId === currentShareId}
              busy={revocation.busy && target?.kind === 'one' && target.link.shareId === link.shareId}
              onEdit={editor.open}
              onRevoke={(row) => revocation.setTarget({ kind: 'one', link: row })}
            >
              {editor.editing?.link.shareId === link.shareId && (
                <LinkTokenForm
                  mode="edit"
                  policy={policy}
                  hasPassword={link.requiresPassword}
                  draft={editor.editing.draft}
                  onDraftChange={editor.setDraft}
                  onSubmit={() => void editor.save()}
                  onCancel={editor.close}
                  submitting={editor.saving}
                  disabled={draftToUpdate(editor.editing.draft, link) === null}
                />
              )}
            </ActiveShareLinkRow>
          ))}
        </ul>
      )}
      {state.hasMore && <p className={`text-xs ${colors.text.muted}`}>{t('share.links.hasMore')}</p>}

      <ConfirmDialog
        open={target !== null}
        onOpenChange={(next) => { if (!next) revocation.setTarget(null); }}
        variant="destructive"
        title={target?.kind === 'all' ? t('share.links.revokeAllConfirmTitle', { count: othersCount }) : t('share.links.revokeConfirmTitle')}
        description={target?.kind === 'one'
          ? t('share.links.revokeConfirmBody', { label: target.link.label ?? t('share.links.unlabeled') })
          : t('share.links.revokeAllConfirmBody')}
        confirmText={t('share.links.revoke')}
        onConfirm={revocation.confirm}
        loading={revocation.busy}
      />
    </section>
  );
}
