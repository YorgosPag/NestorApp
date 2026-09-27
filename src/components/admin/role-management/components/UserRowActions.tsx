'use client';

/**
 * Οι **ενέργειες μιας γραμμής μέλους** — εξάχθηκαν από το `UserTable` (ADR-892 Φ2β, N.7.1).
 *
 * Τρεις ομάδες, τρεις κάτοχοι (ADR-892 §3.1):
 * - **Πλατφόρμα** (`canEdit`, `super_admin`): ρόλος · δικαιώματα · **Αναστολή λογαριασμού** — κρίνει από το
 *   `disabled` του λογαριασμού, ποτέ από την κατάσταση μέλους.
 * - **Γραφείο** (`canRemove` = `users:users:manage`): **Παύση** / **Επαναφορά πρόσβασης** (από την κατάσταση
 *   μέλους) · **Αφαίρεση**. Ποτέ στον εαυτό (η αποχώρηση είναι Φ3).
 * - Αίτημα ένταξης (`needsApproval`): μόνο έγκριση / απόρριψη.
 *
 * @module components/admin/role-management/components/UserRowActions
 */

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';

import type { CompanyUser } from '../types';
import { MEMBER_EXIT_MODE_KEYS, MEMBER_EXIT_NS, MEMBER_RESTORE_KEYS } from '../member-exit-labels';

export interface UserRowHandlers {
  readonly onChangeRole: (user: CompanyUser) => void;
  readonly onManagePermissions: (user: CompanyUser) => void;
  readonly onSuspend: (user: CompanyUser) => void;
  readonly onRemove: (user: CompanyUser) => void;
  readonly onPauseAccess: (user: CompanyUser) => void;
  readonly onRestoreAccess: (user: CompanyUser) => void;
  readonly onViewDetails: (user: CompanyUser) => void;
  readonly onApprove: (user: CompanyUser) => void;
  readonly onDeny: (user: CompanyUser) => void;
}

interface UserRowActionsProps extends UserRowHandlers {
  readonly user: CompanyUser;
  readonly isSelf: boolean;
  readonly canEdit: boolean;
  readonly canRemove: boolean;
}

/** ADR-660: unassigned/pending → μόνο Έγκριση/Απόρριψη (οι υπόλοιπες θέλουν έγγραφο μέλους). */
function ApprovalActions({ user, onApprove, onDeny }: Pick<UserRowActionsProps, 'user' | 'onApprove' | 'onDeny'>) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <>
      <Button variant="default" size="sm" onClick={() => onApprove(user)}>{t('roleManagement.actions.approve')}</Button>
      <Button variant="ghost" size="sm" onClick={() => onDeny(user)}>{t('roleManagement.actions.deny')}</Button>
    </>
  );
}

/** Πλατφόρμα — ο λογαριασμός (όχι η ιδιότητα μέλους). */
function PlatformActions({ user, isSelf, onChangeRole, onManagePermissions, onSuspend }: Pick<
  UserRowActionsProps, 'user' | 'isSelf' | 'onChangeRole' | 'onManagePermissions' | 'onSuspend'
>) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChangeRole(user)}
        disabled={isSelf}
        title={isSelf ? t('roleManagement.roleChange.selfProtection') : ''}
      >
        {t('roleManagement.actions.changeRole')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => onManagePermissions(user)}>
        {t('roleManagement.actions.permissions')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSuspend(user)}
        disabled={isSelf}
        title={isSelf ? t('roleManagement.cannotSuspendSelf') : ''}
      >
        {user.disabled ? t('roleManagement.actions.reactivateAccount') : t('roleManagement.actions.suspendAccount')}
      </Button>
    </>
  );
}

/** Γραφείο — η ιδιότητα μέλους: παύση **ή** επαναφορά (από την κατάσταση μέλους) + αφαίρεση. */
function OfficeActions({ user, onPauseAccess, onRestoreAccess, onRemove }: Pick<
  UserRowActionsProps, 'user' | 'onPauseAccess' | 'onRestoreAccess' | 'onRemove'
>) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  return (
    <>
      {user.status === 'active' && (
        <Button variant="ghost" size="sm" onClick={() => onPauseAccess(user)}>
          {t(MEMBER_EXIT_MODE_KEYS.pause.button)}
        </Button>
      )}
      {user.status === 'suspended' && (
        <Button variant="ghost" size="sm" onClick={() => onRestoreAccess(user)}>
          {t(MEMBER_RESTORE_KEYS.button)}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onRemove(user)}>
        {t(MEMBER_EXIT_MODE_KEYS.removal.button)}
      </Button>
    </>
  );
}

export function UserRowActions(props: UserRowActionsProps) {
  const { t } = useTranslation(['admin', MEMBER_EXIT_NS]);
  const { user, isSelf, canEdit, canRemove } = props;
  // ADR-660: χρήστης χωρίς tenant = αυτο-εγγραφή που εκκρεμεί έγκριση.
  const needsApproval = user.companyId === null;
  return (
    <nav className="flex items-center justify-end gap-1" aria-label={t('roleManagement.table.actions')}>
      {canEdit && needsApproval && <ApprovalActions {...props} />}
      {canEdit && !needsApproval && <PlatformActions {...props} />}
      {/* ADR-892 Φ2/Φ2β — ο εαυτός ΔΕΝ βλέπει πράξεις γραφείου: η αποχώρηση είναι άλλη πράξη (Φ3). */}
      {canRemove && !needsApproval && !isSelf && <OfficeActions {...props} />}
      <Button variant="ghost" size="sm" onClick={() => props.onViewDetails(user)}>
        {t('roleManagement.actions.details')}
      </Button>
    </nav>
  );
}
