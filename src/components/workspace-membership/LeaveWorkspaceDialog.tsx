'use client';

/**
 * **Αποχώρηση από το γραφείο** — από τον ίδιο τον άνθρωπο (ADR-892 Φ3, §13).
 *
 * Όπως ο διάλογος του διαχειριστή (§11–§12): **πρώτα τι θα γίνει**, μετά το κουμπί (§3.6). Αν ο κριτής λέει
 * «όχι», λέει **γιατί** — και για τον τελευταίο διαχειριστή δείχνει και τον **δρόμο** («Διαχείριση ρόλων»),
 * όχι μόνο το «όχι» (GitHub: «You cannot leave as the last owner» χωρίς οδηγία).
 * Χωρίς πεδίο λόγου (GitHub «Leave» · Notion «Leave workspace» δεν ζητούν), με το **όνομα του γραφείου** στον
 * τίτλο και στο κουμπί — ο άνθρωπος σε δύο γραφεία δεν αποχωρεί ποτέ από το λάθος.
 *
 * 🔑 Λεπτή σύνθεση, όχι κλώνος: ο κινητήρας (`exit-action`), η άρνηση/αποτυχία (`exit-dialog-parts`) και το
 * υποσέλιδο (`DialogActionFooter`) είναι **τα ίδια** με του διαχειριστή. Διαφέρουν η οπτική («εσείς»), το
 * namespace (`common-account` — το βλέπει κάθε μέλος) και η ροή μετά την πράξη (`use-leave-workspace`).
 * Default export: φορτώνεται με `next/dynamic` από το μενού χρήστη, **εκτός** κελύφους (CHECK 3.34).
 *
 * @module components/workspace-membership/LeaveWorkspaceDialog
 * @see docs/centralized-systems/reference/adrs/ADR-892-workspace-member-removal.md §13
 */

import { useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogActionFooter } from '@/components/ui/dialog-action-footer';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { APP_ROUTES } from '@/lib/routes/appRoutes';
import { cn } from '@/lib/utils';
import { Link } from '@/lib/workspace/navigation';
import { useNotifications } from '@/providers/NotificationProvider';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { ExitRefusalNotice, PreviewFailedNotice } from './exit-dialog-parts';
import {
  isLeaveRefusal,
  LEAVE_REFUSAL_KEY,
  LEAVE_WORKSPACE_KEYS as K,
  type LeaveRefusal,
} from './leave-workspace-labels';
import { useLeaveWorkspace, type LeavePreview, type LeaveStage } from './use-leave-workspace';

interface LeaveWorkspaceDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Η ετυμηγορία της προεπισκόπησης → άρνηση που ξέρουμε να πούμε · `allowed` · ή «άγνωστη» (⇒ αποτυχία). */
function refusalOfPreview(preview: LeavePreview): LeaveRefusal | 'allowed' | 'unknown' {
  const { kind } = preview.preview.verdict;
  if (kind === 'allowed') return 'allowed';
  return isLeaveRefusal(kind) ? kind : 'unknown';
}

/** Η άρνηση που ισχύει: της **πράξης** νικά της προεπισκόπησης (ο κόσμος άλλαξε στο μεταξύ). */
function effectiveRefusal(stage: LeaveStage, fromPreview: LeaveRefusal | 'allowed' | 'unknown' | null) {
  if (stage.kind === 'refused') return stage.refusal;
  return fromPreview === 'allowed' || fromPreview === 'unknown' ? null : fromPreview;
}

/** «Τι θα γίνει» — από την οπτική του ίδιου. */
function Consequences({ data }: { data: LeavePreview }) {
  const { t } = useTranslation('common-account');
  const { actTeams, isHomeWorkspace } = data.preview;
  const teamsLine = actTeams === 0
    ? t(K.noActTeams)
    : data.heirName === null
      ? t(K.actTeamsOrphaned, { count: actTeams })
      : t(K.actTeamsTo, { count: actTeams, heir: data.heirName });
  return (
    <section className="space-y-1 rounded-lg border p-3" aria-labelledby="workspace-leave-consequences">
      <h3 id="workspace-leave-consequences" className="text-sm font-medium">{t(K.consequencesHeading)}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>{t(K.losesAccess)}</li>
        <li>{t(K.contributionsStay)}</li>
        <li>{teamsLine}</li>
        <li>{isHomeWorkspace ? t(K.homeContinues) : t(K.staysSignedIn)}</li>
        <li>{t(K.unaffected)}</li>
        <li>{t(K.rejoin)}</li>
      </ul>
    </section>
  );
}

/** Ο τελευταίος διαχειριστής φεύγει **αφού** ορίσει άλλον — ο δρόμος, όχι μόνο το «όχι». */
function ManageRolesLink({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation('common-account');
  return (
    <Button asChild>
      <Link href={APP_ROUTES.roleManagement} onClick={onNavigate}>{t(K.manageRoles)}</Link>
    </Button>
  );
}

interface LeaveFormProps {
  readonly data: LeavePreview;
  readonly office: string;
  readonly stage: LeaveStage;
  readonly busy: boolean;
  readonly onCancel: () => void;
  readonly onLeave: () => Promise<void>;
}

/** Συνέπειες + (αποτυχία της πράξης) + κουμπί με το **όνομα** — **μόνο** όταν ο κριτής είπε `allowed`. */
function LeaveForm({ data, office, stage, busy, onCancel, onLeave }: LeaveFormProps) {
  const { t } = useTranslation('common-account');
  return (
    <>
      <Consequences data={data} />
      {stage.kind === 'failed' && <p role="alert" className="text-sm text-destructive">{t(K.failed)}</p>}
      <DialogActionFooter
        cancelLabel={t(K.cancel)}
        confirmLabel={t(K.confirm, { office })}
        busyLabel={t(K.leaving)}
        onCancel={onCancel}
        onConfirm={() => { void onLeave(); }}
        isSubmitting={busy}
        confirmVariant="destructive"
      />
    </>
  );
}

export default function LeaveWorkspaceDialog({ open, onClose }: LeaveWorkspaceDialogProps) {
  const { t } = useTranslation('common-account');
  const colors = useSemanticColors();
  const { info } = useNotifications();
  // Το όνομα έρχεται με την προεπισκόπηση — η αποσύνδεση (μετά την πράξη) διαβάζει την **τελευταία** τιμή.
  const officeRef = useRef('');

  const { previewState, reloadPreview, stage, leave } = useLeaveWorkspace(
    useCallback(() => info(t(K.signInAgain, { office: officeRef.current })), [info, t]),
  );
  const data = previewState.kind === 'ready' ? previewState.preview : null;
  const office = data !== null && data.workspaceName !== ''
    ? t(K.officeQuoted, { name: data.workspaceName })
    : t(K.officeUnnamed);
  officeRef.current = office;
  const fromPreview = data === null ? null : refusalOfPreview(data);
  const refusal = effectiveRefusal(stage, fromPreview);
  const busy = stage.kind === 'leaving' || stage.kind === 'handover';
  const failedPreview = previewState.kind === 'failed' || fromPreview === 'unknown';

  return (
    // Όσο τρέχει η πράξη (ή στήνεται η νέα συνεδρία) ο διάλογος δεν κλείνει — ποτέ μισοτελειωμένη πράξη.
    <Dialog open={open} onOpenChange={busy ? undefined : onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(K.title, { office })}</DialogTitle>
          <DialogDescription>{t(K.description)}</DialogDescription>
        </DialogHeader>
        {previewState.kind === 'loading' && (
          <p className={cn('animate-pulse text-sm', colors.text.muted)}>{t(K.loading)}</p>
        )}
        {failedPreview && (
          <PreviewFailedNotice
            message={t(K.previewFailed)}
            cancelLabel={t(K.cancel)}
            retryLabel={t(K.retry)}
            onClose={onClose}
            onRetry={reloadPreview}
          />
        )}
        {refusal !== null && (
          <ExitRefusalNotice
            message={t(LEAVE_REFUSAL_KEY[refusal])}
            cancelLabel={t(K.cancel)}
            onClose={onClose}
            action={refusal === 'last-manager' ? <ManageRolesLink onNavigate={onClose} /> : undefined}
          />
        )}
        {data !== null && !failedPreview && refusal === null && (
          <LeaveForm data={data} office={office} stage={stage} busy={busy} onCancel={onClose} onLeave={leave} />
        )}
      </DialogContent>
    </Dialog>
  );
}
