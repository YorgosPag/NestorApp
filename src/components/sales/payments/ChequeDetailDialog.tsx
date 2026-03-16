'use client';

/**
 * ChequeDetailDialog — 3-tab detail view: Στοιχεία / Ενέργειες / Ιστορικό
 * @enterprise ADR-234 Phase 3 — SPEC-234A
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChequeStatusBadge } from './ChequeStatusBadge';
import type {
  ChequeRecord,
  ChequeStatus,
  UpdateChequeInput,
  ChequeTransitionInput,
  EndorseInput,
  BounceInput,
  BouncedReason,
} from '@/types/cheque-registry';
import { getValidNextChequeStatuses, isTerminalChequeStatus } from '@/types/cheque-registry';

// ============================================================================
// PROPS
// ============================================================================

interface ChequeDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cheque: ChequeRecord;
  onUpdate: (input: UpdateChequeInput) => Promise<{ success: boolean; error?: string }>;
  onTransition: (input: ChequeTransitionInput) => Promise<{ success: boolean; error?: string }>;
  onEndorse: (input: EndorseInput) => Promise<{ success: boolean; error?: string }>;
  onBounce: (input: BounceInput) => Promise<{ success: boolean; error?: string }>;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('el-GR');
  } catch {
    return iso;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('el-GR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

const BOUNCED_REASONS: BouncedReason[] = [
  'insufficient_funds',
  'account_closed',
  'signature_mismatch',
  'stop_payment',
  'post_dated_early',
  'technical_issue',
  'other',
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ChequeDetailDialog({
  open,
  onOpenChange,
  cheque,
  onUpdate,
  onTransition,
  onEndorse,
  onBounce,
}: ChequeDetailDialogProps) {
  const { t } = useTranslation('payments');
  const isTerminal = isTerminalChequeStatus(cheque.status);
  const nextStatuses = getValidNextChequeStatuses(cheque.status);

  // Action state
  const [isBusy, setIsBusy] = useState(false);

  // --- Bounce form ---
  const [bounceReason, setBounceReason] = useState<BouncedReason>('insufficient_funds');
  const [bounceNotes, setBounceNotes] = useState('');

  // --- Endorse form ---
  const [endorserName, setEndorserName] = useState('');
  const [endorseeName, setEndorseeName] = useState('');
  const [endorseDate, setEndorseDate] = useState(new Date().toISOString().split('T')[0]);

  // --- Edit form ---
  const [editNotes, setEditNotes] = useState(cheque.notes ?? '');

  const handleAction = useCallback(
    async (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
      setIsBusy(true);
      try {
        const result = await fn();
        if (result.success) {
          toast.success(label);
          onOpenChange(false);
        } else {
          toast.error(result.error ?? t('errors.createFailed'));
        }
      } finally {
        setIsBusy(false);
      }
    },
    [onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <span className="font-mono">{cheque.chequeNumber}</span>
            <ChequeStatusBadge status={cheque.status} />
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details" className="text-xs">
              {t('chequeRegistry.tabs.details')}
            </TabsTrigger>
            <TabsTrigger value="actions" className="text-xs">
              {t('chequeRegistry.tabs.actions')}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              {t('chequeRegistry.tabs.history')}
            </TabsTrigger>
          </TabsList>

          {/* ============= DETAILS TAB ============= */}
          <TabsContent value="details" className="space-y-3 mt-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <dt className="text-muted-foreground">{t('chequeRegistry.fields.chequeType')}</dt>
              <dd>{t(`paymentMethod.${cheque.chequeType}`)}</dd>

              <dt className="text-muted-foreground">{t('chequeRegistry.fields.amount')}</dt>
              <dd className="font-medium">{formatCurrency(cheque.amount)}</dd>

              <dt className="text-muted-foreground">{t('chequeRegistry.fields.drawerName')}</dt>
              <dd>{cheque.drawerName}</dd>

              <dt className="text-muted-foreground">{t('chequeRegistry.fields.bankName')}</dt>
              <dd>{cheque.bankName}{cheque.bankBranch ? ` — ${cheque.bankBranch}` : ''}</dd>

              <dt className="text-muted-foreground">{t('chequeRegistry.fields.issueDate')}</dt>
              <dd>{formatDate(cheque.issueDate)}</dd>

              <dt className="text-muted-foreground">{t('chequeRegistry.fields.maturityDate')}</dt>
              <dd>{formatDate(cheque.maturityDate)}</dd>

              {cheque.postDated && (
                <>
                  <dt className="text-muted-foreground">{t('chequeRegistry.fields.postDated')}</dt>
                  <dd className="text-amber-600 font-medium">
                    {t('chequeRegistry.fields.yes')}
                  </dd>
                </>
              )}

              {cheque.crossedCheque && (
                <>
                  <dt className="text-muted-foreground">{t('chequeRegistry.fields.crossedCheque')}</dt>
                  <dd>
                    {t('chequeRegistry.fields.yes')}
                  </dd>
                </>
              )}

              {cheque.depositDate && (
                <>
                  <dt className="text-muted-foreground">{t('chequeRegistry.fields.depositDate')}</dt>
                  <dd>{formatDate(cheque.depositDate)}</dd>
                </>
              )}

              {cheque.clearingDate && (
                <>
                  <dt className="text-muted-foreground">{t('chequeRegistry.fields.clearingDate')}</dt>
                  <dd>{formatDate(cheque.clearingDate)}</dd>
                </>
              )}
            </dl>

            {/* Editable notes */}
            {!isTerminal && (
              <fieldset className="space-y-1 pt-2 border-t">
                <Label className="text-xs">{t('labels.notes')}</Label>
                <Textarea
                  className="text-xs min-h-[50px]"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  disabled={isBusy || editNotes === (cheque.notes ?? '')}
                  onClick={() => handleAction(
                    t('chequeRegistry.actions.updated'),
                    () => onUpdate({ notes: editNotes.trim() || undefined })
                  )}
                >
                  {t('chequeRegistry.actions.save')}
                </Button>
              </fieldset>
            )}
          </TabsContent>

          {/* ============= ACTIONS TAB ============= */}
          <TabsContent value="actions" className="space-y-4 mt-3">
            {isTerminal ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('chequeRegistry.actions.terminal')}
              </p>
            ) : (
              <>
                {/* Status transitions */}
                {nextStatuses.length > 0 && (
                  <section className="space-y-2">
                    <h4 className="text-xs font-semibold">
                      {t('chequeRegistry.actions.transitionTitle')}
                    </h4>
                    <nav className="flex flex-wrap gap-2">
                      {nextStatuses
                        .filter((s): s is ChequeStatus => s !== 'bounced' && s !== 'endorsed')
                        .map((targetStatus) => (
                          <Button
                            key={targetStatus}
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            disabled={isBusy}
                            onClick={() => handleAction(
                              t(`chequeRegistry.status.${targetStatus}`),
                              () => onTransition({ targetStatus })
                            )}
                          >
                            → {t(`chequeRegistry.status.${targetStatus}`)}
                          </Button>
                        ))}
                    </nav>
                  </section>
                )}

                {/* Endorsement */}
                {nextStatuses.includes('endorsed') && (
                  <section className="space-y-2 border-t pt-3">
                    <h4 className="text-xs font-semibold">
                      {t('chequeRegistry.actions.endorse')}
                    </h4>
                    <fieldset className="grid grid-cols-2 gap-2">
                      <section className="space-y-1">
                        <Label className="text-xs">
                          {t('chequeRegistry.fields.endorserName')}
                        </Label>
                        <Input
                          className="h-8 text-xs"
                          value={endorserName}
                          onChange={(e) => setEndorserName(e.target.value)}
                        />
                      </section>
                      <section className="space-y-1">
                        <Label className="text-xs">
                          {t('chequeRegistry.fields.endorseeName')}
                        </Label>
                        <Input
                          className="h-8 text-xs"
                          value={endorseeName}
                          onChange={(e) => setEndorseeName(e.target.value)}
                        />
                      </section>
                    </fieldset>
                    <Input
                      className="h-8 text-xs"
                      type="date"
                      value={endorseDate}
                      onChange={(e) => setEndorseDate(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-7"
                      disabled={isBusy || !endorserName.trim() || !endorseeName.trim()}
                      onClick={() => handleAction(
                        t('chequeRegistry.actions.endorsed'),
                        () => onEndorse({
                          endorserName: endorserName.trim(),
                          endorseeName: endorseeName.trim(),
                          endorsementDate: endorseDate,
                        })
                      )}
                    >
                      {t('chequeRegistry.actions.endorse')}
                    </Button>
                  </section>
                )}

                {/* Bounce (only from clearing) */}
                {nextStatuses.includes('bounced') && (
                  <section className="space-y-2 border-t pt-3">
                    <h4 className="text-xs font-semibold text-destructive">
                      {t('chequeRegistry.actions.bounce')}
                    </h4>
                    <fieldset className="space-y-1">
                      <Label className="text-xs">
                        {t('chequeRegistry.fields.bouncedReason')}
                      </Label>
                      <Select
                        value={bounceReason}
                        onValueChange={(v) => setBounceReason(v as BouncedReason)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BOUNCED_REASONS.map((reason) => (
                            <SelectItem key={reason} value={reason}>
                              {t(`chequeRegistry.bouncedReason.${reason}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </fieldset>
                    <Textarea
                      className="text-xs min-h-[40px]"
                      placeholder={t('labels.notes')}
                      value={bounceNotes}
                      onChange={(e) => setBounceNotes(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="text-xs h-7"
                      disabled={isBusy}
                      onClick={() => handleAction(
                        t('chequeRegistry.actions.bounced'),
                        () => onBounce({
                          bouncedReason: bounceReason,
                          ...(bounceNotes.trim() ? { bouncedNotes: bounceNotes.trim() } : {}),
                        })
                      )}
                    >
                      {t('chequeRegistry.actions.bounce')}
                    </Button>
                  </section>
                )}
              </>
            )}

            {/* Bounced info (if already bounced) */}
            {cheque.status === 'bounced' && (
              <section className="space-y-2 border-t pt-3">
                <h4 className="text-xs font-semibold text-destructive">
                  {t('chequeRegistry.bouncedInfo.title')}
                </h4>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">{t('chequeRegistry.fields.bouncedReason')}</dt>
                  <dd>{t(`chequeRegistry.bouncedReason.${cheque.bouncedReason}`)}</dd>

                  <dt className="text-muted-foreground">{t('chequeRegistry.fields.bouncedDate')}</dt>
                  <dd>{formatDate(cheque.bouncedDate)}</dd>
                </dl>

                {/* Τειρεσίας / Μήνυση toggles */}
                <fieldset className="flex flex-col gap-2 pt-2">
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={cheque.teiresiasFiled} disabled />
                    {t('chequeRegistry.fields.teiresiasFiled')}
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Checkbox checked={cheque.policeCaseFiled} disabled />
                    {t('chequeRegistry.fields.policeCaseFiled')}
                  </label>
                </fieldset>
              </section>
            )}
          </TabsContent>

          {/* ============= HISTORY TAB ============= */}
          <TabsContent value="history" className="space-y-3 mt-3">
            {/* Endorsement chain */}
            {cheque.endorsementChain.length > 0 ? (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold">
                  {t('chequeRegistry.endorsement.title')}
                </h4>
                <ol className="space-y-1">
                  {cheque.endorsementChain.map((entry) => (
                    <li
                      key={entry.order}
                      className="text-xs flex items-center gap-2 rounded border p-2"
                    >
                      <span className="font-mono text-muted-foreground">#{entry.order}</span>
                      <span>{entry.endorserName} → {entry.endorseeName}</span>
                      <span className="text-muted-foreground ml-auto">{formatDate(entry.endorsementDate)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">
                {t('chequeRegistry.endorsement.empty')}
              </p>
            )}

            {/* Replacement info */}
            {cheque.replacesChequeId && (
              <section className="text-xs border-t pt-2">
                <p className="text-muted-foreground">
                  {t('chequeRegistry.replacement.replaces')}{' '}
                  <span className="font-mono">{cheque.replacesChequeId}</span>
                </p>
              </section>
            )}
            {cheque.replacedByChequeId && (
              <section className="text-xs border-t pt-2">
                <p className="text-muted-foreground">
                  {t('chequeRegistry.replacement.replacedBy')}{' '}
                  <span className="font-mono">{cheque.replacedByChequeId}</span>
                </p>
              </section>
            )}

            {/* Audit */}
            <section className="text-xs text-muted-foreground border-t pt-2 space-y-1">
              <p>{t('chequeRegistry.audit.created')} {formatDate(cheque.createdAt)}</p>
              <p>{t('chequeRegistry.audit.updated')} {formatDate(cheque.updatedAt)}</p>
            </section>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
