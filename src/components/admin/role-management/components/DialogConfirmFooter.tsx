'use client';

/**
 * =============================================================================
 * ΤΟ ΥΠΟΣΕΛΙΔΟ ΤΟΥ ΔΙΑΛΟΓΟΥ — **ΕΝΑ**, ΟΧΙ ΤΕΣΣΕΡΑ (N.0.2 · ADR-583/CHECK 3.28)
 * =============================================================================
 *
 * 🔴 **Το εύρημα (2026-09-22)**: τέσσερις διάλογοι της διαχείρισης ρόλων
 * (`ApproveUserDialog` · `RoleChangeDialog` · `InviteUserDialog` ·
 * `DenyAccessRequestDialog`) έγραφαν **το ίδιο** υποσέλιδο — «Ακύρωση» αριστερά,
 * κατάφαση δεξιά που γίνεται «Αποθήκευση…» όσο τρέχει. Το CHECK 3.28 το ανέδειξε
 * όταν τρία από τα τέσσερα βρέθηκαν στο **ίδιο** commit.
 *
 * ⚠️ **Ήταν προϋπάρχον δίδυμο, όχι νέο**: η πύλη δεν είδε «καινούργια» αντιγραφή,
 * είδε ότι τα αδέλφια ακούμπησαν μαζί. Ο κανόνας N.0.2 λέει τι γίνεται τότε —
 * εξαγωγή **τώρα**, όχι γραμμή σε λίστα εκκρεμοτήτων.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 ΤΙ ΚΑΤΕΧΕΙ ΚΑΙ ΤΙ ΟΧΙ
 * ─────────────────────────────────────────────────────────────────────────────
 * **Κατέχει** τις δύο λέξεις που είναι **ίδιες παντού** (`common.cancel`,
 * `common.saving`) και τη ρήτρα «όσο τρέχει, το κουμπί λέει ότι τρέχει».
 * **Δεν κατέχει** τη λέξη της κατάφασης: αυτή λέει τι θα συμβεί —
 * «Έγκριση» ≠ «Άρνηση» ≠ «Αποστολή πρόσκλησης» — και ο διάλογος τη δηλώνει.
 *
 * ⚠️ **ΜΗΝ γράψεις εδώ σκληρό κείμενο** (N.11): το `confirmKey` είναι κλειδί του
 * namespace **`admin`**, το ίδιο που φορτώνουν και οι τέσσερις καλούντες.
 *
 * @module components/admin/role-management/components/DialogConfirmFooter
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';

import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface DialogConfirmFooterProps {
  /** Η έξοδος χωρίς πράξη. Κλειδωμένη όσο τρέχει η πράξη — ποτέ μισοτελειωμένη. */
  readonly onCancel: () => void;
  /** Η πράξη. */
  readonly onConfirm: () => void;
  /**
   * **Η λέξη της κατάφασης**, ως κλειδί i18n στο namespace `admin` — λέει τι θα
   * συμβεί, άρα ανήκει στον διάλογο και όχι εδώ.
   */
  readonly confirmKey: string;
  /** Τρέχει η πράξη; Τότε και τα δύο κουμπιά κλειδώνουν, και η λέξη το λέει. */
  readonly isSubmitting: boolean;
  /**
   * Επιτρέπεται η κατάφαση; **Προεπιλογή: όποτε δεν τρέχει ήδη.** Οι διάλογοι με
   * φόρμα περνούν τον δικό τους κριτή (π.χ. «διάλεξε ρόλο»).
   */
  readonly canSubmit?: boolean;
  /** `destructive` όταν η πράξη **αφαιρεί** — η άρνηση πρόσβασης, όχι η έγκριση. */
  readonly confirmVariant?: 'default' | 'destructive';
}

/**
 * **Ακύρωση + κατάφαση**, με την κατάσταση εκτέλεσης γραμμένη **μία φορά**.
 */
export function DialogConfirmFooter({
  onCancel,
  onConfirm,
  confirmKey,
  isSubmitting,
  canSubmit,
  confirmVariant = 'default',
}: DialogConfirmFooterProps) {
  const { t } = useTranslation('admin');
  const mayConfirm = canSubmit ?? !isSubmitting;

  return (
    <DialogFooter>
      <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
        {t('common.cancel')}
      </Button>
      <Button variant={confirmVariant} onClick={onConfirm} disabled={!mayConfirm}>
        {isSubmitting ? t('common.saving') : t(confirmKey)}
      </Button>
    </DialogFooter>
  );
}
