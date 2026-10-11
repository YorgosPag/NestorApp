'use client';

/**
 * ChoiceCards — πλέγμα μεγάλων καρτών επιλογής (εικονίδιο · τίτλος · περιγραφή).
 *
 * Το ΕΝΑ component για «διάλεξε ένα από λίγα, με εξήγηση»: τύπος επαφής (Επαφές), συντόμευση
 * του οδηγού κάτοψης, παράθυρο «Άνοιγμα / Δημιουργία» του DXF viewer (ADR-914).
 *
 * Δεν ξέρει τομέα και δεν κουβαλά κείμενο: ο καλών δίνει έτοιμες, μεταφρασμένες ετικέτες.
 * Κάθε κάρτα είναι πραγματικό `<button>` που **φοράει** την επιφάνεια του `Card` (`asChild`) —
 * πληκτρολόγιο, εστίαση και `disabled` έρχονται από το στοιχείο, όχι από `role` + `onKeyDown`.
 *
 * @module components/ui/choice-cards
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { INTERACTIVE_PATTERNS, TRANSITION_PRESETS } from '@/components/ui/effects';
import { useIconSizes } from '@/hooks/useIconSizes';
import { cn } from '@/lib/utils';

/** Χρωματικός τόνος μιας κάρτας — πλήρεις κλάσεις από τον καλούντα (ο τομέας ξέρει το χρώμα του). */
export interface ChoiceCardTone {
  /** Χρώμα εικονιδίου, π.χ. `text-foreground`. */
  readonly icon?: string;
  /** Φόντο του κύκλου πίσω από το εικονίδιο, π.χ. `bg-accent`. */
  readonly iconBackground?: string;
  /** Κλάση ορίου στο hover, **με** το πρόθεμα, π.χ. `hover:border-border`. */
  readonly hoverBorder?: string;
}

export interface ChoiceCardOption<TId extends string = string> {
  readonly id: TId;
  readonly icon: React.ElementType;
  readonly title: string;
  readonly description?: string;
  readonly tone?: ChoiceCardTone;
  readonly disabled?: boolean;
  /** Γιατί η κάρτα είναι ανενεργή — φαίνεται στη θέση της περιγραφής. */
  readonly disabledReason?: string;
}

export interface ChoiceCardsProps<TId extends string = string> {
  readonly options: readonly ChoiceCardOption<TId>[];
  readonly onSelect: (id: TId) => void;
  /** Κλάσεις πλέγματος (στήλες/πλάτος). Προεπιλογή: μία στήλη, τρεις από `sm`. */
  readonly className?: string;
  /** Όνομα της ομάδας για αναγνώστες οθόνης. */
  readonly ariaLabel?: string;
  /**
   * `md` (προεπιλογή): συμπαγής κάρτα για πλέγμα επιλογών. `lg`: ψηλή κάρτα με μεγάλο εικονίδιο,
   * για ΜΙΑ προεξέχουσα ενέργεια (η κάρτα συντόμευσης του οδηγού κάτοψης).
   */
  readonly size?: ChoiceCardSize;
}

export type ChoiceCardSize = 'md' | 'lg';

/** Ό,τι αλλάζει με το μέγεθος — μία γραμμή ανά μέγεθος, καμία διακλάδωση μέσα στο JSX. */
const SIZE_CLASSES: Record<ChoiceCardSize, { card: string; title: string; icon: 'lg' | 'xl2' }> = {
  md: { card: 'gap-2 p-2', title: 'font-medium', icon: 'lg' },
  lg: { card: 'gap-3 px-4 py-6', title: 'text-sm font-semibold', icon: 'xl2' },
};

const DEFAULT_GRID = 'grid grid-cols-1 sm:grid-cols-3 gap-2 w-full';

const CARD_BASE =
  'flex w-full cursor-pointer flex-col items-center border-2 border-transparent text-center '
  + 'hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 '
  + 'disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:shadow-sm';

export function ChoiceCards<TId extends string = string>({
  options,
  onSelect,
  className,
  ariaLabel,
  size = 'md',
}: ChoiceCardsProps<TId>) {
  const iconSizes = useIconSizes();
  const sizing = SIZE_CLASSES[size];

  return (
    <ul className={cn(DEFAULT_GRID, className)} aria-label={ariaLabel}>
      {options.map((option) => {
        const Icon = option.icon;
        const note = option.disabled && option.disabledReason ? option.disabledReason : option.description;
        return (
          <li key={option.id} className="flex">
            <Card asChild>
              <button
                type="button"
                disabled={option.disabled}
                onClick={() => onSelect(option.id)}
                className={cn(
                  CARD_BASE,
                  sizing.card,
                  INTERACTIVE_PATTERNS.BUTTON_SUBTLE,
                  TRANSITION_PRESETS.STANDARD_COLORS,
                  !option.disabled && option.tone?.hoverBorder,
                )}
              >
                <span className={cn('rounded-full p-2', option.tone?.icon, option.tone?.iconBackground)}>
                  <Icon className={iconSizes[sizing.icon]} aria-hidden="true" />
                </span>
                <span className={cn('block text-foreground', sizing.title)}>{option.title}</span>
                {note && (
                  <span className="block text-xs leading-relaxed text-muted-foreground">{note}</span>
                )}
              </button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
