'use client';

/**
 * =============================================================================
 * «ΑΝΟΙΓΜΑ ΣΕ ΝΕΑ ΚΑΡΤΕΛΑ» — η ΜΙΑ επιφάνεια του ΕΝΟΣ απαντητή (ADR-899 §9 θέμα 10)
 * =============================================================================
 *
 * Κάθε επιφάνεια αρχείων (πάνελ, split view οντότητας, Εισερχόμενα, διπλό κλικ) ρωτά τον `fileOpenInTabTarget`
 * **μέσα από εδώ** — κανείς δεν ξαναγράφει «αν είναι θεατής βάλε πρόθεμα χώρου, αλλιώς άνοιξε τα bytes».
 *
 * 🏆 **Πραγματικός σύνδεσμος, όχι `window.open`** (Drive / Figma): μεσαίο κλικ, Ctrl+κλικ, «Αντιγραφή διεύθυνσης
 * συνδέσμου» και ανάγνωση από αναγνώστη οθόνης ως σύνδεσμος. Η εσωτερική διεύθυνση περνά από το **σύνορο
 * πλοήγησης**, που βάζει τον χώρο (CHECK 3.61).
 *
 * @module components/shared/files/FileOpenInTabAction
 * @see lib/files/file-open-in-tab — η απόφαση
 */

import React, { useCallback } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { openRemoteUrlInNewTab } from '@/lib/exports/trigger-export-download';
import { fileOpenInTabTarget, type FileOpenInTabTargetSubject } from '@/lib/files/file-open-in-tab';
import { Link, useWorkspaceHref } from '@/lib/workspace/navigation';

const NEW_TAB_REL = 'noopener noreferrer';

/**
 * Η **προστακτική** μορφή, για χειρονομίες που δεν είναι σύνδεσμος (διπλό κλικ σε γραμμή λίστας).
 * Έκβαση `none` ⇒ καμία ενέργεια: το πρώτο κλικ έχει ήδη ανοίξει το αρχείο στο πάνελ.
 */
export function useOpenFileInNewTab(): (record: FileOpenInTabTargetSubject) => void {
  const resolve = useWorkspaceHref();
  return useCallback((record: FileOpenInTabTargetSubject) => {
    const target = fileOpenInTabTarget(record);
    if (target.kind === 'viewer') openRemoteUrlInNewTab(resolve(target.href));
    else if (target.kind === 'native') openRemoteUrlInNewTab(target.url);
  }, [resolve]);
}

export interface FileOpenInTabButtonProps {
  readonly record: FileOpenInTabTargetSubject;
  /** Το όνομα της ενέργειας — tooltip **και** προσβάσιμο όνομα. */
  readonly label: string;
  /** Το εικονίδιο, με το μέγεθος της επιφάνειας που το φιλοξενεί. */
  readonly icon: React.ReactNode;
  readonly className?: string;
}

/** Το κουμπί-σύνδεσμος. Δεν αποδίδει **τίποτα** όταν η ενέργεια δεν προσφέρεται. */
export function FileOpenInTabButton({ record, label, icon, className }: FileOpenInTabButtonProps) {
  const target = fileOpenInTabTarget(record);
  if (target.kind === 'none') return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="ghost" size="sm" className={className}>
          {target.kind === 'viewer' ? (
            <Link href={target.href} target="_blank" rel={NEW_TAB_REL} aria-label={label}>{icon}</Link>
          ) : (
            <a href={target.url} target="_blank" rel={NEW_TAB_REL} aria-label={label}>{icon}</a>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
