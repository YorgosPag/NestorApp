'use client';

/**
 * @fileoverview **ΤΑ ΠΑΡΟΥΣΙΑΣΤΙΚΑ ΚΟΜΜΑΤΙΑ ΕΝΟΣ ΝΗΜΑΤΟΣ** — φούσκα, κεφαλίδα μηνύματος, «παλαιότερα», κενό νήμα.
 * @related ADR-867 §2.1 + Β7 (N.0.2: εξαγωγή από το `crm/inbox/ThreadView`) · ADR-030 (`ds-messageBubble`)
 * @module components/shared/messaging/MessageBubble
 *
 * 🔑 **Δεν ξέρουν ΤΙ νήμα δείχνουν**: ούτε inbox (ADR-029), ούτε δίκτυο (ADR-867). Γεννήθηκαν όταν η οθόνη του
 * δικτύου θα έγραφε **δεύτερη** φούσκα δίπλα στην πρώτη — το `ThreadView` είναι δεμένο στο inbox
 * (`useInboxApi`, `useMessageActions`) και **δεν** επαναχρησιμοποιείται ως μηχανή, μόνο ως όψη.
 *
 * ⚠️ **Το ΣΩΜΑ το δίνει ο καλών** (`children`), επίτηδες: το omnichannel αποδίδει **HTML** από κανάλια
 * (`formatMessageHTML`, καθαρισμένο), το δίκτυο **απλό κείμενο** από ξένο χώρο. Μια φούσκα που θα
 * «ήξερε» να αποδίδει θα έπρεπε να διαλέξει — και η λάθος επιλογή είναι XSS από άλλο γραφείο.
 */

import React from 'react';
import { ChevronUp, MessageSquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import '@/lib/design-system';

interface MessageBubbleProps {
  /** Δικό μου / εξερχόμενο ⇒ δεξιά, με το χρώμα του εξερχόμενου. */
  readonly outbound: boolean;
  readonly children: React.ReactNode;
  readonly selected?: boolean;
  /** Σε λειτουργία επιλογής η φούσκα είναι **στόχος κλικ** (inbox). */
  readonly selectable?: boolean;
  readonly onClick?: () => void;
  readonly className?: string;
}

/** Η φούσκα — `<article>`, γιατί κάθε μήνυμα είναι αυτοτελές κείμενο με συγγραφέα και ώρα. */
export function MessageBubble({
  outbound,
  children,
  selected = false,
  selectable = false,
  onClick,
  className = '',
}: MessageBubbleProps): React.ReactElement {
  const direction = outbound ? 'ds-messageBubble--outbound ml-auto' : 'ds-messageBubble--inbound';
  const selection = `${selected ? 'ring-2 ring-primary ring-offset-2' : ''} ${selectable ? 'cursor-pointer hover:opacity-80' : ''}`;
  return (
    <article
      onClick={onClick}
      className={`ds-messageBubble ${direction} max-w-[75%] ${TRANSITION_PRESETS.STANDARD_COLORS} ${selection} ${className}`}
    >
      {children}
    </article>
  );
}

interface MessageMetaProps {
  readonly name: React.ReactNode;
  /** ISO — γίνεται `dateTime` του `<time>` (μηχανικά αναγνώσιμο). */
  readonly at: string;
  readonly timeLabel: string;
  readonly icon?: React.ReactNode;
  /** Ό,τι ακολουθεί την ώρα: κατάσταση παράδοσης, καρφίτσα, «επεξεργάστηκε». */
  readonly trailing?: React.ReactNode;
}

/** Η κεφαλίδα μηνύματος: ποιος, πότε, και ό,τι άλλο λέει ο καλών. */
export function MessageMeta({ name, at, timeLabel, icon, trailing }: MessageMetaProps): React.ReactElement {
  const spacing = useSpacingTokens();
  const colors = useSemanticColors();
  return (
    <header className={`flex flex-wrap items-center ${spacing.gap.sm} ${spacing.margin.bottom.xs} text-sm ${colors.text.muted}`}>
      {icon}
      <span className="font-medium">{name}</span>
      <time dateTime={at} className="text-xs">{timeLabel}</time>
      {trailing}
    </header>
  );
}

/** «Παλαιότερα μηνύματα» — σελιδοποίηση **προς τα πάνω**. Η ετικέτα έρχεται από το namespace του καλούντος. */
export function LoadEarlierNav({
  label,
  navLabel,
  onLoadMore,
  disabled,
}: {
  readonly label: string;
  readonly navLabel: string;
  readonly onLoadMore: () => void;
  readonly disabled: boolean;
}): React.ReactElement {
  const iconSizes = useIconSizes();
  const spacing = useSpacingTokens();
  return (
    <nav className={`flex justify-center ${spacing.margin.bottom.md}`} aria-label={navLabel}>
      <Button variant="outline" size="sm" onClick={onLoadMore} disabled={disabled} className={spacing.gap.sm}>
        <ChevronUp className={iconSizes.sm} />
        {label}
      </Button>
    </nav>
  );
}

/** Κανένα μήνυμα ακόμη — το κείμενο το δίνει ο καλών (άλλο λέει το inbox, άλλο το δίκτυο). */
export function EmptyThreadNotice({ message, label }: { readonly message: string; readonly label: string }): React.ReactElement {
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();
  const spacing = useSpacingTokens();
  return (
    <section className="py-8 text-center" aria-label={label}>
      <MessageSquare className={`${iconSizes.xl} ${colors.text.muted} mx-auto ${spacing.margin.bottom.sm} opacity-30`} />
      <p className={colors.text.muted}>{message}</p>
    </section>
  );
}
