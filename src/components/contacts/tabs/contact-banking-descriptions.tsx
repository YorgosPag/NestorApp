'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { BankAccount } from '@/types/contacts/banking';

type Translator = (key: string, options?: Record<string, unknown>) => string;

export function buildDeleteDescription(
  account: BankAccount | null,
  isLastActive: boolean,
  t: Translator,
  mutedText: string,
): React.ReactNode {
  if (!account) return null;

  return (
    <div className="space-y-3">
      <p>
        {t('bankingTab.deleteAccount.confirmation')}{' '}
        <strong>{account.bankName}</strong> {t('bankingTab.deleteAccount.withIban')}{' '}
        <code className="text-xs">{account.iban}</code>;
      </p>
      <p>{t('bankingTab.impact.futureUse')}</p>
      <p className={cn('text-sm', mutedText)}>{t('bankingTab.impact.snapshotPreserved')}</p>
      {account.isPrimary && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {t('bankingTab.impact.deletePrimary')}
        </p>
      )}
      {isLastActive && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {t('bankingTab.impact.deleteLastActive')}
        </p>
      )}
      <p>{t('bankingTab.deleteAccount.irreversible')}</p>
    </div>
  );
}

export function buildSetPrimaryDescription(
  account: BankAccount | null,
  t: Translator,
  mutedText: string,
): React.ReactNode {
  if (!account) return null;

  return (
    <div className="space-y-3">
      <p>{t('bankingTab.setPrimaryDialog.confirmation', { bankName: account.bankName })}</p>
      <p>{t('bankingTab.setPrimaryDialog.impact')}</p>
      <p className={cn('text-sm', mutedText)}>{t('bankingTab.impact.snapshotPreserved')}</p>
    </div>
  );
}

export function buildSensitiveEditDescription(
  isSensitiveEdit: boolean,
  becomesPrimary: boolean,
  t: Translator,
  mutedText: string,
): React.ReactNode {
  const messages: string[] = [];
  if (becomesPrimary) messages.push(t('bankingTab.editImpact.makePrimary'));
  if (isSensitiveEdit) messages.push(t('bankingTab.editImpact.updateSensitive'));

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <p key={message}>{message}</p>
      ))}
      <p className={cn('text-sm', mutedText)}>{t('bankingTab.impact.snapshotPreserved')}</p>
    </div>
  );
}
