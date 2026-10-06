'use client';

/**
 * @fileoverview **Η ΚΕΦΑΛΙΔΑ ΕΝΟΣ ΒΗΜΑΤΟΣ ΛΟΓΑΡΙΑΣΜΟΥ** — εικονίδιο, «τι συμβαίνει», «τι να κάνετε» (ADR-851 Φ2).
 * @module components/account/AccountStepIntro
 *
 * Γεννήθηκε 2026-10-06 με τον **δεύτερο** καταναλωτή: η πύλη επιβεβαίωσης email και το βήμα «είστε όντως εσείς;»
 * λένε το ίδιο πράγμα με την ίδια μορφή — γιατί δεν προχωρά η πράξη και ποια είναι η επόμενη κίνηση.
 *
 * 🔑 Το `titleId` το δίνει ο καλών: είναι ο στόχος του `aria-labelledby` της περιοχής που τυλίγει το βήμα.
 */

import React from 'react';
import type { LucideIcon } from 'lucide-react';

import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/design-system';

export interface AccountStepIntroProps {
  readonly icon: LucideIcon;
  readonly titleId: string;
  readonly title: string;
  readonly body: string;
}

export function AccountStepIntro({ icon: Icon, titleId, title, body }: AccountStepIntroProps): React.JSX.Element {
  const colors = useSemanticColors();
  const borders = useBorderTokens();
  const layout = useLayoutClasses();
  const iconSizes = useIconSizes();
  const typography = useTypography();

  return (
    <header className={cn(layout.flexCenterGap2, layout.padding4, borders.radiusClass.md, colors.bg.muted)}>
      <Icon className={cn(iconSizes.lg, colors.text.muted, 'shrink-0')} aria-hidden="true" />
      <div className={layout.flexColGap2}>
        <h4 id={titleId} className={cn(typography.body.base, 'font-medium')}>{title}</h4>
        <p className={cn(typography.body.sm, colors.text.muted)}>{body}</p>
      </div>
    </header>
  );
}
