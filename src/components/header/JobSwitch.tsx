'use client';

/**
 * ADR-748 Φάση 3 — Ο ΟΡΑΤΟΣ ΔΙΑΚΟΠΤΗΣ ΔΟΥΛΕΙΑΣ («τι δουλειά κάνω τώρα»).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΗΔΗ ΑΠΟ ΤΗ ΦΑΣΗ 3 ΚΑΙ ΟΧΙ ΣΤΗ ΦΑΣΗ 4 *(απόφαση Γιώργου,
 * 2026-08-02)*: χωρίς αυτόν η Φάση 3 είναι **ανεπαλήθευτη στην οθόνη** —
 * ακριβώς το πρόβλημα που λύθηκε στη Φάση 2 με τον διακόπτη ειδικότητας. Ο
 * Γιώργος είναι `super_admin` ⇒ τα δικαιούται όλα (Ε4.ε) ⇒ φίλτρο βασισμένο
 * μόνο σε δικαιώματα δείχνει «καμία αλλαγή», και έχει δίκιο.
 *
 * 🔑 Και **δεν είναι πρόωρο κομμάτι της Φάσης 4**: το **Ε6.β** έχει ήδη
 * κλειδώσει ότι η δουλειά ζει **ΕΞΩ** από το μονοπάτι *οργανισμός › έργο* και
 * έχει **δικό της, οπτικά διαφορετικό** χειριστήριο. Άρα το μονοπάτι της Φάσης 4
 * δεν αντικαθιστά αυτό εδώ — χτίζεται **δίπλα** του (αριστερά), όπως το Dev Mode
 * της Figma ζει έξω από τη διαδρομή του αρχείου.
 *
 * ⛔ ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ: δεν είναι ο επιλογέας οργανισμού. Το
 * `CompanySwitcher` / `WorkspaceContext` / `switchWorkspace()` είναι ο **άξονας
 * 1** και **δεν αγγίζονται** (Φάση 4, Ε6.ζ/Ε6.η). `Workspace` = ΟΡΓΑΝΙΣΜΟΣ.
 * ─────────────────────────────────────────────────────────────────────────────
 * Α-3 — ΠΟΤΕ ΣΙΩΠΗΛΗ ΑΠΟΚΡΥΨΗ (μάθημα Office 2000, §6.7)
 *
 * Ο δείκτης «Χ κρυμμένα» **δεν είναι ετικέτα**: είναι κουμπί που επαναφέρει τα
 * πάντα με **ένα** κλικ. Και εμφανίζεται μόνο όταν όντως κρύβεται κάτι.
 * ─────────────────────────────────────────────────────────────────────────────
 * Υ-6 — Η ΑΛΥΣΙΔΑ ΑΙΤΙΑΣΗΣ ΟΡΑΤΗ
 *
 * Κάθε δουλειά στη λίστα ξέρει **γιατί** είναι εκεί. Οι `unknown` — αυτές που
 * θα τις απαντούσε πηγή που **δεν φτάνει στον browser** (Π-15) — φέρουν ρητή
 * εξήγηση αντί να εξαφανιστούν. Ούτε ο ACC ούτε η Figma το κάνουν αυτό.
 *
 * ADR-001: `@/components/ui/select` (Radix). CHECK 3.23: κανένα native `title=`.
 */

import React, { useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HiddenItemsBadge } from '@/components/job/HiddenItemsBadge';
import { JobSuggestion } from '@/components/job/JobSuggestion';
import { JOBS } from '@/config/jobs-registry';
import { JOB_ALL, resolveJobAccess } from '@/config/jobs-access';
import { useActiveJob, isJobSelection } from '@/contexts/ActiveJobContext';
import { useEffectivePermissions } from '@/hooks/useEffectivePermissions';
import { useJobFilteredNavigation } from '@/hooks/useJobFilteredNavigation';

export function JobSwitch() {
  const { t } = useTranslation('navigation');
  const { activeJob, setActiveJob, resetToAll } = useActiveJob();
  const permissionInput = useEffectivePermissions();
  // Ο ΙΔΙΟΣ υπολογισμός με το sidebar — ένα μονοπάτι, ένας αριθμός.
  const { hiddenCount, hiddenSubItemCount } = useJobFilteredNavigation();

  // Ε5.α — ΖΩΝΤΑΝΟΣ υπολογισμός σε κάθε render. Καμία αποθηκευμένη λίστα.
  const selectable = useMemo(
    () => resolveJobAccess(permissionInput).filter((access) => access.decision !== 'none'),
    [permissionInput],
  );

  const handleChange = useCallback(
    (value: string) => {
      // Ο Radix επιστρέφει `string` — ποτέ cast, πάντα type guard.
      if (isJobSelection(value)) setActiveJob(value);
    },
    [setActiveJob],
  );

  // Καμία δουλειά διαθέσιμη ⇒ ο διακόπτης δεν έχει τι να προσφέρει. Δεν
  // εμφανίζεται κενός επιλογέας: κενό χειριστήριο είναι θόρυβος, όχι πληροφορία.
  if (selectable.length === 0) return null;

  return (
    <span className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <span>
            <Select value={activeJob} onValueChange={handleChange}>
              <SelectTrigger
                className="h-8 w-auto min-w-0 gap-1 border-none bg-transparent px-2 text-sm focus:ring-0 focus:ring-offset-0"
                aria-label={t('jobs.switch.ariaLabel')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[12rem]">
                <SelectItem value={JOB_ALL}>{t('jobs.switch.all')}</SelectItem>
                {selectable.map((access) => (
                  <SelectItem key={access.job} value={access.job}>
                    {t(JOBS[access.job].labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </span>
        </TooltipTrigger>
        <TooltipContent>{t('jobs.switch.tooltip')}</TooltipContent>
      </Tooltip>

      <HiddenItemsBadge
        count={hiddenCount}
        subItemCount={hiddenSubItemCount}
        onRestore={resetToAll}
      />

      {/* ΦΑΣΗ 3.5α / Υ-12 — η πρόταση ζει **πάνω στο χειριστήριο** που την
          εκτελεί, όχι σε modal πρώτης εκκίνησης. Ο Revit ρωτά αλλού και σε
          βάζει να διορθώσεις αλλού· γι' αυτό υπάρχει άρθρο «How to disable».
          ⓘ Οι δύο δείκτες **δεν συνυπάρχουν ποτέ**: η πρόταση ζητά
          `activeJob === JOB_ALL`, όπου το `hiddenCount` είναι εξ ορισμού 0. */}
      <JobSuggestion />
    </span>
  );
}
