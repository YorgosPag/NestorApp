'use client';

/**
 * @fileoverview **Η ΦΟΡΜΑ ΘΥΜΑΤΑΙ ΤΗΝ ΠΡΟΣΚΛΗΣΗ** (ADR-915 §39, 2026-11-14) — «για ποια διεύθυνση;» και, μετά από
 * αποτυχημένη σύνδεση, «μήπως δεν έχετε λογαριασμό;».
 * @related `lib/routes/return-path.ts` (`invitedAs` — μόνο καλυμμένη μορφή) · `components/invitations/InvitationAccountStepPanel.tsx`
 * @module auth/components/InvitationLoginNotice
 *
 * 🔴 **Μετρημένο ζωντανά**: ο νέος επαγγελματίας προσπάθησε **Σύνδεση** χωρίς λογαριασμό και πήρε σκέτο «Μη έγκυρα
 * στοιχεία σύνδεσης» — το Firebase **επίτηδες** δεν ξεχωρίζει «δεν υπάρχει» από «λάθος κωδικός» (προστασία
 * απαρίθμησης). Μέσα σε ροή πρόσκλησης όμως ο άνθρωπος έχει ήδη αποδείξει το κουτί του ⇒ του δείχνουμε τον δρόμο.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { INVITATION_ACCOUNT_KEYS, INVITATION_ACCOUNT_NS } from '@/components/invitations/invitation-account-labels';
import { useTranslation } from '@/i18n/hooks/useTranslation';

/** «Συνεχίζετε την πρόσκληση για g***1@gmail.com — χρησιμοποιήστε αυτή τη διεύθυνση.» */
export function InvitationLoginBanner({ invitedAs }: { readonly invitedAs: string }) {
  const { t } = useTranslation([INVITATION_ACCOUNT_NS]);
  return (
    <Alert>
      <AlertDescription>{t(INVITATION_ACCOUNT_KEYS.loginBanner, { email: invitedAs })}</AlertDescription>
    </Alert>
  );
}

/** Μετά από αποτυχημένη **σύνδεση** σε ροή πρόσκλησης: ο δρόμος προς την εγγραφή, ένα κλικ. */
export function InvitationNoAccountHint({ onCreate }: { readonly onCreate: () => void }) {
  const { t } = useTranslation([INVITATION_ACCOUNT_NS]);
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm">
      <span>{t(INVITATION_ACCOUNT_KEYS.loginNoAccountHint)}</span>
      <Button type="button" variant="link" className="h-auto p-0" onClick={onCreate}>
        {t(INVITATION_ACCOUNT_KEYS.loginNoAccountAction)}
      </Button>
    </p>
  );
}
