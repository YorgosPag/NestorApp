'use client';

/**
 * @fileoverview **Η ΕΙΔΟΠΟΙΗΣΗ ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ** — το ένα κουτί επιτυχίας/σφάλματος της περιοχής λογαριασμού.
 * @module components/account/AccountNotice
 *
 * 🔑 **Ο ρόλος ARIA ΠΑΡΑΓΕΤΑΙ από τον τόνο, δεν δηλώνεται**: σφάλμα ⇒ `alert` (διακόπτει τον
 * αναγνώστη οθόνης), επιτυχία ⇒ `status` (ευγενικό). Έτσι δεν μπορεί να βγει ποτέ πράσινο κουτί
 * που φωνάζει ούτε κόκκινο που ψιθυρίζει (WAI-ARIA: `alert` = assertive, `status` = polite).
 *
 * Γεννήθηκε 2026-09-11 από κλώνο που έπιασε το CHECK 3.28 ανάμεσα σε `AccountEmailChangeDialog`
 * και `AccountPasswordLinkAction` (ADR-850). Το ίδιο κουτί ζει ακόμη χειρόγραφο σε
 * `SecurityPageContent` · `ProfilePageContent` · `TwoFactorEnrollment` (με εικονίδιο) —
 * `.claude-rules/pending-ratchet-work.md`.
 */

import React from 'react';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/design-system';

export type AccountNoticeTone = 'success' | 'error';

export interface AccountNoticeProps {
  readonly tone: AccountNoticeTone;
  readonly children: React.ReactNode;
}

export function AccountNotice({ tone, children }: AccountNoticeProps): React.JSX.Element {
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const typography = useTypography();
  const toneClass = tone === 'success'
    ? cn(colors.bg.success, colors.text.success)
    : cn(colors.bg.error, colors.text.error);

  return (
    <output
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(layout.padding3, borders.radiusClass.md, typography.body.sm, toneClass)}
    >
      {children}
    </output>
  );
}
