'use client';

/**
 * ADR-853 Φ6 — **ΟΙ ΕΚΚΡΕΜΕΙΣ ΠΡΟΣΚΛΗΣΕΙΣ, ΣΕ ΔΙΚΟ ΤΟΥΣ ΠΙΝΑΚΑ.**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΔΕΥΤΕΡΟΣ ΠΙΝΑΚΑΣ ΚΑΙ ΟΧΙ ΓΡΑΜΜΕΣ ΣΤΟΥΣ ΧΡΗΣΤΕΣ
 * ─────────────────────────────────────────────────────────────────────────────
 * Το `CompanyUser` απαιτεί **`uid`**, και η πρόσκληση **δεν έχει** — φτάνει σε email.
 * Αυτός ακριβώς είναι ο λόγος που το §7.1 αρνήθηκε να την αποθηκεύσει ως μέλος με
 * `status: 'invited'`· να τη χώσουμε στον πίνακα χρηστών θα ήταν **το ίδιο κατηγοριακό
 * λάθος έναν όροφο πιο ψηλά** — στην οθόνη αντί στη βάση. Πρότυπο «Members / Pending
 * invitations» του GitHub και του Slack.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΣΤΗΛΕΣ ΠΟΥ ΛΕΝΕ ΤΗΝ ΑΛΗΘΕΙΑ ΑΝΤΙ ΝΑ ΚΑΘΗΣΥΧΑΖΟΥΝ
 * ─────────────────────────────────────────────────────────────────────────────
 * · **Κατάσταση**: το `expired` είναι **παραγόμενο** (άγκυρα Λ2) — κανείς δεν σκουπίζει
 *   τις ληγμένες, άρα μια `pending` με περασμένη ώρα φτάνει εδώ ήδη ως `expired`. Αλλιώς
 *   ο διαχειριστής βλέπει «σε αναμονή» για σύνδεσμο **που δεν δουλεύει**.
 * · **Άνοιγμα**: *«ένδειξη, όχι απόδειξη»* (§6 #3) — οι εφαρμογές email **προφορτώνουν**
 *   συνδέσμους, άρα η σφραγίδα μπορεί να γράφτηκε από σαρωτή. Η στήλη το λέει με λέξεις,
 *   σε tooltip· **ποτέ** «το είδε».
 *
 * ⛔ **ΚΑΜΙΑ ΣΤΗΛΗ «ΛΗΓΕΙ ΣΕ Ν ΜΕΡΕΣ» ΑΠΟ ΤΟΝ ΔΙΑΚΟΜΙΣΤΗ**: ταξιδεύει το `expiresAt`
 *    (απόλυτη στιγμή) και το «σε Ν» το υπολογίζει **η οθόνη τη στιγμή που ζωγραφίζει** —
 *    ένα στιγμιότυπο θα ήταν λάθος μετά από δύο μέρες στην ίδια ανοιχτή καρτέλα.
 * ⛔ **ΚΑΝΕΝΑΣ ΔΕΥΤΕΡΟΣ ΚΑΝΟΝΑΣ ΗΜΕΡΩΝ**: η λήξη είναι **προθεσμία** ⇒ `formatDeadlineRelative`
 *    (ο κανόνας `deadlineDaysLeft`, προς τα πάνω — ο ίδιος με το email και τη σελίδα της
 *    πρόσκλησης, ADR-853 §13 ε.γ). Το `formatRelativeTime` κόβει: 6η21ω ⇒ «σε 6» ενώ το email
 *    έλεγε «7». Το άνοιγμα είναι **παρελθόν** ⇒ `formatRelativeTime`. Η ληγμένη πέφτει μόνη της
 *    στο «πριν από Ν» (κάτω από μία ημέρα το `formatDeadlineRelative` αναθέτει στο ίδιο).
 *
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { formatDeadlineRelative, formatRelativeTime } from '@/lib/intl-formatting';
import { cn } from '@/lib/utils';
import type { WorkspaceInvitationView } from '@/types/workspace-invitation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { INVITATION_STATE_KEY, INVITE_KEYS } from '../invite-labels';
import { INVITATION_STATE_BADGE_VARIANT } from '../types';

interface InvitationTableProps {
  invitations: readonly WorkspaceInvitationView[];
  /** Απάντηση του **ΕΝΟΣ** κριτή — ποτέ σύγκριση ρόλων εδώ (CHECK 3.68). */
  canManage: boolean;
  /** Ποια γραμμή έχει πράξη σε εξέλιξη — `null` όταν καμία. */
  busyId: string | null;
  onRevoke: (invitation: WorkspaceInvitationView) => void;
  onResend: (invitation: WorkspaceInvitationView) => void;
}

/**
 * Οι καταστάσεις στις οποίες οι πράξεις **έχουν νόημα**.
 *
 * 🔑 **Το `expired` είναι ΜΕΣΑ, και δεν είναι αβλεψία**: η κατάσταση είναι **παραγόμενη**
 * στην ανάγνωση — το έγγραφο στη βάση είναι ακόμη `pending`. Άρα η ανάκληση **όντως
 * γράφει** κάτι, και η επαναποστολή είναι ακριβώς αυτό που θέλει ο διαχειριστής.
 */
const ACTIONABLE_STATES: readonly WorkspaceInvitationView['state'][] = ['pending', 'expired'];

export function InvitationTable({
  invitations,
  canManage,
  busyId,
  onRevoke,
  onResend,
}: InvitationTableProps) {
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();

  // Ο άνθρωπος που δεν διαχειρίζεται χώρο δεν έχει λόγο να δει καν την ενότητα όταν
  // είναι άδεια — αλλά όταν **υπάρχουν** προσκλήσεις, τις βλέπει: είναι μέρος του «ποιοι
  // είναι στον χώρο μου;».
  if (!canManage && invitations.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-lg font-semibold tracking-tight">{t(INVITE_KEYS.listHeading)}</h2>

      {invitations.length === 0 ? (
        <section className="flex items-center justify-center rounded-lg border py-10">
          <p className={colors.text.muted}>{t(INVITE_KEYS.listEmpty)}</p>
        </section>
      ) : (
        <section className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t(INVITE_KEYS.listEmail)}</TableHead>
                <TableHead>{t(INVITE_KEYS.listRole)}</TableHead>
                <TableHead>{t(INVITE_KEYS.listState)}</TableHead>
                <TableHead>{t(INVITE_KEYS.listExpires)}</TableHead>
                <TableHead>{t(INVITE_KEYS.listOpened)}</TableHead>
                <TableHead className="text-right">{t(INVITE_KEYS.listActions)}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => (
                <InvitationRow
                  key={invitation.id}
                  invitation={invitation}
                  canManage={canManage}
                  isBusy={busyId === invitation.id}
                  onRevoke={onRevoke}
                  onResend={onResend}
                />
              ))}
            </TableBody>
          </Table>
        </section>
      )}
    </section>
  );
}

// =============================================================================
// Η ΓΡΑΜΜΗ
// =============================================================================

interface InvitationRowProps {
  invitation: WorkspaceInvitationView;
  canManage: boolean;
  isBusy: boolean;
  onRevoke: (invitation: WorkspaceInvitationView) => void;
  onResend: (invitation: WorkspaceInvitationView) => void;
}

function InvitationRow({ invitation, canManage, isBusy, onRevoke, onResend }: InvitationRowProps) {
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();
  const showActions = canManage && ACTIONABLE_STATES.includes(invitation.state);

  return (
    <TableRow>
      <TableCell className="text-sm font-medium">{invitation.inviteeEmail}</TableCell>

      <TableCell className={cn('text-sm', colors.text.muted)}>
        {t(`roleManagement.roleNames.${invitation.role}`)}
      </TableCell>

      <TableCell>
        <Badge variant={INVITATION_STATE_BADGE_VARIANT[invitation.state]}>
          {t(INVITATION_STATE_KEY[invitation.state])}
        </Badge>
      </TableCell>

      <TableCell className={cn('text-sm', colors.text.muted)}>
        {formatDeadlineRelative(invitation.expiresAt)}
      </TableCell>

      <TableCell className={cn('text-sm', colors.text.muted)}>
        <OpenedCell openedAt={invitation.openedAt} />
      </TableCell>

      <TableCell>
        <nav className="flex items-center justify-end gap-1" aria-label={t(INVITE_KEYS.listActions)}>
          {showActions && (
            <>
              <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onResend(invitation)}>
                {t(INVITE_KEYS.actionResend)}
              </Button>
              <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onRevoke(invitation)}>
                {t(INVITE_KEYS.actionRevoke)}
              </Button>
            </>
          )}
        </nav>
      </TableCell>
    </TableRow>
  );
}

/**
 * ⚠️ **Το tooltip ΔΕΝ είναι διακόσμηση** — είναι το σημείο όπου λέμε ότι η σφραγίδα είναι
 * **ένδειξη, όχι απόδειξη**. Χωρίς αυτό, μια ώρα σε στήλη «Άνοιγμα συνδέσμου» διαβάζεται
 * ως *«το είδε»*, που είναι ισχυρισμός **που δεν μπορούμε να στηρίξουμε**.
 *
 * ⛔ Ποτέ `title=` σε στοιχείο HTML (CHECK 3.23) — ο `Tooltip` είναι ο ΕΝΑΣ τρόπος.
 */
function OpenedCell({ openedAt }: { openedAt: string | null }) {
  const { t } = useTranslation('admin');

  if (openedAt === null) return <span>{t(INVITE_KEYS.openedNever)}</span>;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span>{formatRelativeTime(openedAt)}</span>
        </TooltipTrigger>
        <TooltipContent>{t(INVITE_KEYS.openedHint)}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
