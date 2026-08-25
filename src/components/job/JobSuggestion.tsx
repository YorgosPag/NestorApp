'use client';

/**
 * ADR-748 Φάση 3.5α — **Η ΠΡΟΤΑΣΗ ΔΟΥΛΕΙΑΣ**, δίπλα στο χειριστήριο που την εκτελεί.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ MODAL — ΜΕΤΡΗΜΕΝΟ ΚΟΣΤΟΣ, ΟΧΙ ΓΟΥΣΤΟ (§6.14)
 *
 * Ο **Revit 2022** έβαλε ακριβώς αυτή τη λειτουργία σε modal πρώτης εκκίνησης
 * («Hello There!»: ειδικότητα + ρόλος, με λίστα αλλαγών και accept/decline).
 * Το αποτέλεσμα είναι δημόσιο: αίτημα στο **Autodesk Ideas** να απενεργοποιηθεί
 * και **επίσημο άρθρο υποστήριξης «How to disable Hello There window»**.
 *
 * Ο **Cinema 4D** δεν ρωτά καθόλου — δίνει **μόνιμο ορατό επιλογέα**. Το
 * **ArchiCAD** δεν έχει ξεχωριστή οθόνη: ο επιλογέας ζει **μέσα** στη ροή
 * έναρξης. Το **NN/g** το ονομάζει: *active user paradox* — οι χρήστες
 * **αρνούνται** να ρυθμίσουν, και η επιτυχία της Amazon είναι ότι απαιτεί
 * *«no extra work on the users»*.
 *
 * 🔑 **Υ-12 — πού τους ξεπερνάμε**: ο Revit ρωτά σε **ένα** μέρος (modal) και
 * σε βάζει να διορθώσεις σε **άλλο** (`File → Options → User Interface →
 * Configure`) — αυτή **είναι** η αιτία του άρθρου υποστήριξης. Εδώ η πρόταση
 * ζει **πάνω στο ίδιο το χειριστήριο** που θα την αλλάξει: ο χρήστης **μαθαίνει
 * πού ζει η απόφαση την ώρα που την παίρνει**.
 * ─────────────────────────────────────────────────────────────────────────────
 * ⛔ **ΔΕΝ ΑΝΟΙΓΕΙ ΠΟΤΕ ΜΟΝΟ ΤΟΥ.** Είναι προσφορά, όχι διακοπή. Αυτόματο
 * άνοιγμα σε κάθε φόρτωση θα ήταν το «Hello There!» με άλλο ρούχο.
 *
 * ⚠️ **Ε14.ιγ (κανόνας θέσης)**: ο αριθμός εδώ είναι **θετικός** — «πόσα **θα
 * δεις**», όχι «πόσα κρύβονται». Ο αρνητικός ανήκει **μόνο** στο ανοιγμένο
 * δοχείο, με ρήμα και ενέργεια (Φάση 3.6). Ίδια οπτική θέση με δύο νοήματα
 * είναι το σχήμα ελαττώματος που πιάστηκε **τέσσερις** φορές σε αυτό το ADR.
 *
 * 🔑 **Η αναίρεση δεν γράφτηκε εδώ — υπάρχει ήδη**: μόλις δεχτεί, ο δείκτης της
 * Φάσης 3.6 δείχνει «Χ κρυμμένα · Επαναφορά» (Α-3). Ο Revit εφαρμόζει και σε
 * αφήνει· εμάς η επαναφορά μας είναι **μόνιμα ορατή**.
 *
 * CHECK 3.23: κανένα native `title=`. ADR-001: κανένα legacy dropdown.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-748-role-based-workspaces.md §6.14 / Υ-12
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { JOBS } from '@/config/jobs-registry';
import { useActiveJob } from '@/contexts/ActiveJobContext';
import { useJobSuggestion } from '@/hooks/useJobFilteredNavigation';
import { useAuth } from '@/auth/contexts/AuthContext';
import { STORAGE_KEYS, safeGetItem, safeSetItem } from '@/lib/storage';
import { useIconSizes } from '@/hooks/useIconSizes';

/** Η αποθηκευμένη τιμή είναι σημαία· το κλειδί κουβαλά την ταυτότητα. */
const DISMISSED = '1';

/**
 * Το κλειδί απόρριψης **ανά χρήστη**.
 *
 * ⚠️ Χωρίς `uid` επιστρέφει `null` και η πρόταση **δεν εμφανίζεται**: χωρίς
 * ταυτότητα δεν υπάρχει πού να θυμηθούμε το «όχι», και μια πρόταση που
 * ξαναεμφανίζεται μετά την άρνηση είναι χειρότερη από καμία.
 */
function dismissalKey(uid: string | undefined): string | null {
  return uid ? `${STORAGE_KEYS.JOB_SUGGESTION_DISMISSED_PREFIX}${uid}` : null;
}

export function JobSuggestion() {
  const { t } = useTranslation('navigation');
  const { user } = useAuth();
  const { setActiveJob } = useActiveJob();
  const iconSizes = useIconSizes();
  const [open, setOpen] = useState(false);

  const storageKey = useMemo(() => dismissalKey(user?.uid), [user?.uid]);

  // ⚠️ Ξεκινά ΠΑΝΤΑ «απορριμμένη» και το localStorage διαβάζεται σε effect —
  // **ίδια σύμβαση με το `ActiveJobContext`** (το πρώτο render είναι
  // server-rendered και δεν έχει localStorage· διαφορετική αρχική τιμή ⇒
  // hydration mismatch).
  //
  // 🔑 Και η **φορά** είναι απόφαση: ξεκινώντας από `true` η πρόταση εμφανίζεται
  // μόνο **αφού** επιβεβαιωθεί ότι δεν έχει απορριφθεί. Η αντίστροφη επιλογή θα
  // την έδειχνε για ένα καρέ σε **κάθε** χρήστη που είχε ήδη πει «όχι» — δηλαδή
  // θα αγνοούσε την άρνησή του μία φορά ανά φόρτωση.
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (storageKey === null) return;
    setDismissed(safeGetItem(storageKey, '') === DISMISSED);
  }, [storageKey]);

  // Ο ίδιος ζωντανός υπολογισμός με το sidebar — ένα μονοπάτι, ένας αριθμός.
  const suggestion = useJobSuggestion(dismissed || storageKey === null);

  const handleDismiss = useCallback(() => {
    setOpen(false);
    setDismissed(true);
    if (storageKey !== null) safeSetItem(storageKey, DISMISSED);
  }, [storageKey]);

  const handleAccept = useCallback(() => {
    if (suggestion === null) return;
    setOpen(false);
    // 🔑 Η αποδοχή **δεν** γράφει απόρριψη: το `activeJob !== JOB_ALL` κάνει
    // μόνο του την πρόταση να πάψει να ισχύει (job-suggestion.ts). Αν έγραφε
    // και τα δύο, ο χρήστης που επιστρέφει σε «Όλες» δεν θα ξανάβλεπε ποτέ την
    // πρόταση — τιμωρία για μια αναίρεση που το Α-3 ρητά ενθαρρύνει.
    setActiveJob(suggestion.job);
  }, [suggestion, setActiveJob]);

  // Ο έλεγχος «έχω κάτι να πω;» ζει ολόκληρος στο `computeJobSuggestion` — εδώ
  // μένει μόνο η συνέπειά του. Πέντε συνθήκες σε δύο αρχεία θα ήταν πέντε
  // ευκαιρίες να διαφωνήσουν.
  if (suggestion === null) return null;

  const jobLabel = t(JOBS[suggestion.job].labelKey);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t('jobs.suggestion.triggerAriaLabel', { job: jobLabel })}
          className={[
            'flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/40',
            'px-2 py-0.5 text-xs text-muted-foreground',
            'transition-colors hover:bg-accent hover:text-accent-foreground',
          ].join(' ')}
        >
          <Lightbulb className={iconSizes.xs} aria-hidden="true" />
          <span>{t('jobs.suggestion.trigger', { job: jobLabel })}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80">
        <section className="flex flex-col gap-3">
          <header className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">
              {t('jobs.suggestion.title', { job: jobLabel })}
            </h3>
            <p className="text-xs text-muted-foreground">
              {/* Υ-6 — η ΑΙΤΙΑ, όπως τη ΜΕΤΡΗΣΕ το computeJobSuggestion.
                  🔴 Μέχρι 2026-08-25 ήταν σταθερά «με βάση τα δικαιώματά σου»,
                  **ψευδές** για κάθε υπερδιαχειριστή: εκεί όλες οι δουλειές
                  έχουν ταυτόσημα δικαιώματα και η αιτία είναι το επάγγελμα. */}
              {t(suggestion.basis === 'occupation'
                ? 'jobs.suggestion.reasonOccupation'
                : 'jobs.suggestion.reason')}
            </p>
          </header>

          {/* Πρότυπο Revit: **δες τι θα αλλάξει πριν το δεχτείς**. Ο αριθμός
              βγαίνει από το ίδιο φίλτρο που θα τρέξει — δεν μπορεί να πει
              άλλα από ό,τι θα δει ο χρήστης ένα κλικ μετά. */}
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
            {t('jobs.suggestion.preview', {
              visible: suggestion.visibleCount,
              total: suggestion.totalCount,
            })}
          </p>

          <p className="text-xs text-muted-foreground">
            {t('jobs.suggestion.reversible')}
          </p>

          <footer className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleDismiss}>
              {t('jobs.suggestion.decline')}
            </Button>
            <Button type="button" size="sm" onClick={handleAccept}>
              {t('jobs.suggestion.accept')}
            </Button>
          </footer>
        </section>
      </PopoverContent>
    </Popover>
  );
}
