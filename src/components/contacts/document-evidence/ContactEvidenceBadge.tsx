'use client';

/**
 * @fileoverview Το σήμα **«Ν διαφορές με την επαφή»** στη γραμμή ενός αρχείου (ADR-950 §4.4).
 * @module components/contacts/document-evidence/ContactEvidenceBadge
 *
 * Έξω από φόρμα επαφής ή χωρίς ανάγνωση ⇒ **τίποτα**. Εικονίδιο **και** κείμενο — ποτέ μόνο χρώμα (CHECK 3.41).
 * «Συμφωνεί» μόνο όταν **υπάρχει** τουλάχιστον μία γραμμή σε `match`: ένα έγγραφο όπου τίποτα δεν συγκρίθηκε
 * **δεν** «συμφωνεί» — απλώς δεν ξέρουμε (ποτέ πράσινο από απουσία).
 */

import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

import { useIconSizes } from '@/hooks/useIconSizes';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { getStatusSurfaceClass } from '@/lib/design-system';
import { countActionableEvidence } from '@/lib/contacts/contact-evidence-comparison';
import { cn } from '@/lib/utils';
import type { FileRecord } from '@/types/file-record';

import { useContactEvidenceRows } from './ContactEvidenceContext';
import { CONTACT_EVIDENCE_KEYS as KEYS } from './contact-evidence-labels';

const BADGE = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none';

export function ContactEvidenceBadge({ file }: { readonly file: FileRecord }) {
  const { t } = useTranslation('contacts-form');
  const iconSizes = useIconSizes();
  const rows = useContactEvidenceRows(file);
  if (rows === null) return null;
  const count = countActionableEvidence(rows);
  if (count > 0) {
    return (
      <span className={cn(BADGE, getStatusSurfaceClass('warning'))}>
        <AlertTriangle className={iconSizes.xs} aria-hidden="true" />
        {t(KEYS.badge, { count })}
      </span>
    );
  }
  if (!rows.some((row) => row.state === 'match')) return null;
  return (
    <span className={cn(BADGE, getStatusSurfaceClass('available'))}>
      <CheckCircle2 className={iconSizes.xs} aria-hidden="true" />
      {t(KEYS.badgeMatched)}
    </span>
  );
}
