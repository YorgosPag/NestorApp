'use client';

import React from 'react';
import { AlertTriangle, ShieldAlert, Mail } from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import type { ContactSummary } from '@/components/ui/enterprise-contact-dropdown';
import type { LegalProfessionalRole } from '@/types/legal-contracts';
import { cn } from '@/lib/utils';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

export interface PendingAssignment {
  contact: ContactSummary;
  targetRole: LegalProfessionalRole;
  existingRole: LegalProfessionalRole;
  existingRoleLabel: string;
  targetRoleLabel: string;
  conflictType: 'hard_block' | 'warning';
}

export interface PendingEmailNotification {
  contactId: string;
  contactName: string;
  role: string;
  roleLabel: string;
  type: 'assignment' | 'removal';
}

interface ConflictDialogProps {
  pendingAssignment: PendingAssignment | null;
  onDismiss: () => void;
  onConfirm: () => void;
}

export function ConflictBlockDialog({ pendingAssignment, onDismiss }: ConflictDialogProps) {
  const { t } = useTranslation(['common', 'common-sales']);
  const colors = useSemanticColors();

  return (
    <AlertDialog
      open={pendingAssignment?.conflictType === 'hard_block'}
      onOpenChange={(open) => { if (!open) onDismiss(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            {t('sales.legal.conflictBlockTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-2 text-sm">
              <p>
                {t('sales.legal.conflictBlockPre')}{' '}
                <strong>«{pendingAssignment?.contact.name}»</strong>{' '}
                {t('sales.legal.conflictBlockAlready')}{' '}
                <strong>{pendingAssignment?.existingRoleLabel}</strong>.{' '}
                {t('sales.legal.conflictBlockCannot')}{' '}
                <strong>{pendingAssignment?.targetRoleLabel}</strong>.
              </p>
              <p className={cn("italic", colors.text.muted)}>
                {t('sales.legal.conflictBlockLaw')}
              </p>
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('sales.legal.understood')}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ConflictWarningDialog({ pendingAssignment, onDismiss, onConfirm }: ConflictDialogProps) {
  const { t } = useTranslation(['common', 'common-actions', 'common-sales']);
  const colors = useSemanticColors();

  return (
    <AlertDialog
      open={pendingAssignment?.conflictType === 'warning'}
      onOpenChange={(open) => { if (!open) onDismiss(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={cn("flex items-center gap-2", colors.text.warning)}>
            <AlertTriangle className="h-5 w-5" />
            {t('sales.legal.conflictWarningTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <section className="space-y-2 text-sm">
              <p>
                {t('sales.legal.conflictBlockPre')}{' '}
                <strong>«{pendingAssignment?.contact.name}»</strong>{' '}
                {t('sales.legal.conflictBlockAlready')}{' '}
                <strong>{pendingAssignment?.existingRoleLabel}</strong>.{' '}
                {t('sales.legal.conflictWarningSure')}{' '}
                <strong>{pendingAssignment?.targetRoleLabel}</strong>;
              </p>
              <p className={cn("italic", colors.text.muted)}>
                {t('sales.legal.conflictWarningLaw')}
              </p>
            </section>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('actions.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="bg-[hsl(var(--text-warning))] hover:bg-[hsl(var(--text-warning))]/80">
            {t('sales.legal.assignAnyway')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface EmailNotifyDialogProps {
  pendingEmail: PendingEmailNotification | null;
  onClose: () => void;
  onSend: (notification: PendingEmailNotification) => void;
}

export function EmailNotifyDialog({ pendingEmail, onClose, onSend }: EmailNotifyDialogProps) {
  const { t } = useTranslation(['common', 'common-sales']);

  return (
    <AlertDialog
      open={pendingEmail !== null}
      onOpenChange={(open) => { if (!open) onClose(); }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className={`h-5 w-5 ${pendingEmail?.type === 'removal' ? 'text-destructive' : 'text-primary'}`} />
            {pendingEmail?.type === 'removal'
              ? t('sales.legal.emailNotifyRemoveTitle')
              : t('sales.legal.emailNotifyAssignTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <p className="text-sm">
              {pendingEmail?.type === 'removal'
                ? t('sales.legal.emailNotifyRemoveBody', {
                    contactName: pendingEmail?.contactName ?? '',
                    roleLabel: pendingEmail?.roleLabel ?? '',
                  })
                : t('sales.legal.emailNotifyAssignBody', {
                    contactName: pendingEmail?.contactName ?? '',
                    roleLabel: pendingEmail?.roleLabel ?? '',
                  })}
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t('sales.legal.emailNotifyNo')}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (pendingEmail) onSend(pendingEmail);
              onClose();
            }}
          >
            {t('sales.legal.emailNotifyYes')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
