'use client';

/**
 * ADR-853 Φ6 — **Ο ΧΩΡΟΣ ΠΡΟΣΚΑΛΕΙ ΕΝΑΝ ΑΝΘΡΩΠΟ.**
 *
 * Πρότυπο: `ApproveUserDialog`. Η διαφορά είναι **ποιος υπάρχει**: εκεί ο χρήστης έχει
 * ήδη `uid` και περιμένει έγκριση· εδώ **δεν υπάρχει λογαριασμός** — η πρόσκληση φτάνει σε
 * **email** (§7.1, ο κεντρικός λόγος που είναι ξεχωριστή οντότητα).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΠΟΥ Η ΟΘΟΝΗ ΟΦΕΙΛΕΙ ΝΑ ΠΕΙ, ΚΑΙ ΚΑΝΕΝΑ ΔΕΝ ΕΙΝΑΙ «ΕΓΙΝΕ»
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. **Η πρόσκληση δημιουργήθηκε** — αυτό είναι βέβαιο, το λέει το `201`.
 * 2. **Αν ακύρωσε προηγούμενη** (`supersededCount > 0`): η επαναποστολή ανακαλεί την
 *    προηγούμενη στην **ίδια** συναλλαγή. Χωρίς αυτή τη λέξη ο διαχειριστής νομίζει ότι
 *    κυκλοφορούν **δύο** σύνδεσμοι, ενώ ο παλιός είναι ήδη νεκρός.
 * 3. **Τι απέγινε το μήνυμα** — και **ποτέ «στάλθηκε»**: το `accepted` σημαίνει *«ο
 *    πάροχος το δέχτηκε προς αποστολή»*. Το ίδιο το λεξιλόγιο του Mailgun ξεχωρίζει
 *    `accepted` από `delivered`.
 *
 * 🔑 **ΚΑΙ ΓΙ' ΑΥΤΟ Ο ΔΙΑΛΟΓΟΣ ΔΕΝ ΚΛΕΙΝΕΙ ΠΑΝΤΑ**: όταν το μήνυμα **δεν** έφυγε, το
 *    παράθυρο **μένει ανοιχτό** με τον ονομασμένο λόγο. Ένα toast που περνά θα άφηνε τον
 *    διαχειριστή να περιμένει άνθρωπο που **δεν έλαβε ποτέ** τίποτα — ακριβώς η βλάβη που
 *    η Atlassian χρειάστηκε να λύσει εκ των υστέρων με ξεχωριστό *«admin email audit»*.
 *
 * ⛔ **Ο πίνακας ρόλων είναι το `INVITABLE_ROLES`, ΠΟΤΕ το `GLOBAL_ROLES`** — εκείνο
 *    περιέχει `super_admin`, που είναι **break-glass** και δεν δίνεται με email (Α3 · Ρ2).
 * ⛔ **Καμία δεύτερη κρίση «επιτρέπεται;» εδώ** (CHECK 3.68): το ποιος βλέπει το κουμπί το
 *    απαντά το `useInviteCapability`, με τον ΕΝΑ κριτή.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-853-workspace-invitations.md §8 Φ6
 */

import { useCallback, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { PREDEFINED_ROLES } from '@/lib/auth/roles';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/providers/NotificationProvider';
import { issueWorkspaceInvitationFromScreen } from '@/services/workspace/workspace-invitation.client';
import { INVITABLE_ROLES, type InvitableRole } from '@/types/workspace-invitation';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';

import { DELIVERY_KEY, INVITE_KEYS, ISSUE_SETBACK_KEY } from '../invite-labels';

interface InviteUserDialogProps {
  open: boolean;
  onClose: () => void;
  /** Η λίστα του χώρου είναι **μπαγιάτικη** — ο ιδιοκτήτης της ας ξαναρωτήσει. */
  onIssued: () => void;
}

/**
 * Ασφαλές default: **ελάχιστα προνόμια**. Ίδια επιλογή με το `ApproveUserDialog` — ο
 * διαχειριστής ανεβάζει συνειδητά, ποτέ κατά λάθος.
 */
const DEFAULT_INVITE_ROLE: InvitableRole = 'external_user';

/**
 * ⚠️ **Καθρεφτίζει το `z.string().min(3)` του διακομιστή, και τίποτα παραπάνω.** Ένας
 * δεύτερος, «εξυπνότερος» έλεγχος email εδώ θα ήταν **δεύτερος κριτής εγκυρότητας**,
 * ελεύθερος να αποκλίνει· η αληθινή κρίση ζει στη μία διαδρομή. Αυτό εδώ είναι
 * **εργονομία**: να μη φεύγει αίτημα που ξέρουμε ότι θα απορριφθεί.
 */
const MIN_EMAIL_LENGTH = 3;

export function InviteUserDialog({ open, onClose, onIssued }: InviteUserDialogProps) {
  const { success, warning, error: notifyError } = useNotifications();
  const { t } = useTranslation('admin');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>(DEFAULT_INVITE_ROLE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /** Κλειδί μετάφρασης — **ποτέ έτοιμο κείμενο**, ώστε να αλλάζει με τη γλώσσα. */
  const [notice, setNotice] = useState<string | null>(null);

  const canSubmit = email.trim().length >= MIN_EMAIL_LENGTH && !isSubmitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setNotice(null);
    try {
      const result = await issueWorkspaceInvitationFromScreen({ email: email.trim(), role });

      if (result.kind === 'refused') {
        setNotice(ISSUE_SETBACK_KEY[result.setback.kind]);
        return;
      }
      if (result.kind === 'failed') {
        setNotice(INVITE_KEYS.error);
        return;
      }

      success(t(INVITE_KEYS.success));
      if (result.issued.supersededCount > 0) warning(t(INVITE_KEYS.superseded));
      // ⚠️ **Πρώτα το σήμα, μετά η απόφαση για το κλείσιμο**: η πρόσκληση υπάρχει ό,τι κι
      //    αν έγινε με το μήνυμα, άρα η λίστα είναι μπαγιάτικη **και στις δύο** διαδρομές.
      onIssued();

      if (result.issued.delivery === 'accepted') {
        onClose();
        return;
      }
      setNotice(DELIVERY_KEY[result.issued.delivery]);
    } catch {
      // Ο καλών **δεν πετά** (κλειστή ένωση)· αυτό εδώ φυλά μόνο από απρόβλεπτο σφάλμα
      // απόδοσης και δεν αφήνει ποτέ το κουμπί κλειδωμένο.
      notifyError(t(INVITE_KEYS.error));
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmit, email, role, success, warning, notifyError, t, onIssued, onClose]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t(INVITE_KEYS.title)}</DialogTitle>
          <DialogDescription>{t(INVITE_KEYS.description)}</DialogDescription>
        </DialogHeader>

        <InviteFields
          email={email}
          role={role}
          disabled={isSubmitting}
          onEmailChange={setEmail}
          onRoleChange={setRole}
        />

        {notice !== null && (
          <Alert variant="destructive">
            <p className="text-sm">{t(notice)}</p>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? t('common.saving') : t(INVITE_KEYS.submit)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// ΤΑ ΠΕΔΙΑ — χωριστά, ώστε ο διάλογος να μείνει «κατάσταση + απόφαση»
// =============================================================================

interface InviteFieldsProps {
  email: string;
  role: InvitableRole;
  disabled: boolean;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: InvitableRole) => void;
}

function InviteFields({ email, role, disabled, onEmailChange, onRoleChange }: InviteFieldsProps) {
  const { t } = useTranslation('admin');
  const colors = useSemanticColors();

  return (
    <section className="space-y-4">
      <fieldset className="space-y-2">
        <Label htmlFor="invite-email">{t(INVITE_KEYS.emailLabel)}</Label>
        <Input
          id="invite-email"
          type="email"
          autoComplete="email"
          value={email}
          disabled={disabled}
          placeholder={t(INVITE_KEYS.emailPlaceholder)}
          onChange={(event) => onEmailChange(event.target.value)}
        />
      </fieldset>

      <fieldset className="space-y-2">
        <Label htmlFor="invite-role">{t(INVITE_KEYS.roleLabel)}</Label>
        <Select
          value={role}
          disabled={disabled}
          onValueChange={(value) => onRoleChange(value as InvitableRole)}
        >
          <SelectTrigger id="invite-role" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* ⛔ ΠΟΤΕ `value=""` — το Radix το δεσμεύει και ρίχνει την επιφάνεια (CHECK 3.48). */}
            {INVITABLE_ROLES.map((invitable) => {
              const definition = PREDEFINED_ROLES[invitable];
              return (
                <SelectItem key={invitable} value={invitable}>
                  <span className="flex flex-col">
                    <span>{t(`roleManagement.roleNames.${invitable}`)}</span>
                    {definition && (
                      <span className={cn('text-xs', colors.text.muted)}>
                        L{definition.level} — {t(`roleManagement.roleDescriptions.${invitable}`)}
                      </span>
                    )}
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </fieldset>
    </section>
  );
}
