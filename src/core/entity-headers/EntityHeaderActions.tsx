'use client';
/**
 * @fileoverview **Οι ενέργειες μιας κεφαλίδας οντότητας** — το κουμπί, η γραμμή που υπερχειλίζει σε μενού, το μενού.
 * @related ADR-777 §8.87.7 · ADR-332 D27 Ζ5 (`pending`) · `action-overflow.ts` · `UnifiedEntityHeaderSystem.tsx`
 * @module core/entity-headers/EntityHeaderActions
 *
 * 🔴 **Η αφορμή, μετρημένη στην παραγωγή (2026-10-08)**: πέντε ενέργειες = 820px μέσα σε γραμμή 517–671px. Οι ενέργειες
 *   δεν συρρικνώνονταν, άρα ο τίτλος είχε πλάτος **0** και το τελευταίο κουμπί κοβόταν κάτω από `overflow-hidden`.
 * 🔑 **Το όνομα προηγείται των ενεργειών.** Το Salesforce υπερχειλίζει τις ενέργειες σε μενού αλλά παραδέχεται ότι
 *   «δείχνει όσες περισσότερες μπορεί, άρα ίσως λιγότερο από το όνομα». Εδώ η ταυτότητα έχει εγγυημένο ελάχιστο
 *   (η στήλη του πλέγματος στο `EntityDetailsHeader`) και υποχωρούν **οι ενέργειες**.
 * 🔑 **Οι κρυμμένες μένουν στη ροή, αόρατες**: έτσι το πλάτος του δοχείου δεν εξαρτάται από το πόσες κρύφτηκαν, και
 *   ο χώρος που ξαναβρίσκεται **φαίνεται** (βλ. `useActionOverflow`). Κανένα διπλό κουμπί στο DOM.
 */
import React from 'react';
import { MoreHorizontal } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { ENTITY_ACTION_ATTR, ENTITY_ACTION_MORE_ATTR, useActionOverflow } from './action-overflow';
import type { EntityHeaderAction } from './UnifiedEntityHeaderSystem';

const ACTION_MARK = { [ENTITY_ACTION_ATTR]: '' };
const MORE_MARK = { [ENTITY_ACTION_MORE_ATTR]: '' };

/**
 * Η γραμμή είναι `flex-row-reverse` (δεξιά στοίχιση, ό,τι δεν χωρά κόβεται **αριστερά**)· η οπτική σειρά ορίζεται με
 * `order`, ώστε η σειρά του DOM — άρα και του Tab — να μένει η σειρά των ενεργειών. Θέση `n` = `n` θέσεις από δεξιά.
 */
const ORDER_FROM_RIGHT = [
  'order-none', 'order-1', 'order-2', 'order-3', 'order-4', 'order-5', 'order-6',
  'order-7', 'order-8', 'order-9', 'order-10', 'order-11', 'order-12',
] as const;
const MAX_VISIBLE_ACTIONS = ORDER_FROM_RIGHT.length - 1;

/** Εικονίδιο (ή δείκτης όσο τρέχει) + ετικέτα — ίδια όψη στο κουμπί και στη γραμμή του μενού. */
function ActionContent({ icon: Icon, label, pending, pendingLabel }: EntityHeaderAction) {
  const iconSizes = useIconSizes();
  return (
    <>
      {pending ? (
        <Spinner size="small" color="inherit" className="mr-2" />
      ) : (
        Icon && <Icon className={`${iconSizes.sm} mr-2`} />
      )}
      {pending && pendingLabel ? pendingLabel : label}
    </>
  );
}

interface EntityActionButtonProps {
  readonly action: EntityHeaderAction;
  readonly className?: string;
  /** Δεν χωρά στη γραμμή: μένει στη ροή για να μετριέται, αλλά δεν φαίνεται, δεν εστιάζεται, δεν διαβάζεται. */
  readonly overflowed?: boolean;
}

export function EntityActionButton({ action, className, overflowed = false }: EntityActionButtonProps) {
  const spacing = useSpacingTokens();
  const { variant = 'default', onClick, disabled, pending } = action;
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      aria-hidden={overflowed || undefined}
      tabIndex={overflowed ? -1 : undefined}
      className={cn('h-8', spacing.padding.x.sm, action.className, overflowed && 'invisible', className)}
      {...ACTION_MARK}
    >
      <ActionContent {...action} />
    </Button>
  );
}

function ActionOverflowMenu({ actions }: { readonly actions: readonly EntityHeaderAction[] }) {
  const { t } = useTranslation('common-actions');
  const iconSizes = useIconSizes();
  // Ενέργεια που τρέχει μέσα στο κλειστό μενού δεν φαίνεται από πουθενά ⇒ το λέει το ίδιο το κουμπί του μενού.
  const busy = actions.some((action) => action.pending);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          aria-label={t('actions.more')}
          aria-busy={busy || undefined}
          {...MORE_MARK}
        >
          {busy ? <Spinner size="small" color="inherit" /> : <MoreHorizontal className={iconSizes.sm} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action, index) => (
          <DropdownMenuItem
            key={index}
            disabled={action.disabled || action.pending}
            onClick={action.onClick}
          >
            <ActionContent {...action} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * **Η γραμμή ενεργειών που υπερχειλίζει κατά προτεραιότητα**: οι πρώτες μένουν, οι υπόλοιπες πάνε στο μενού
 * «Περισσότερες ενέργειες». Χωρίς μέτρηση (SSR · jsdom) φαίνονται **όλες** — άγνωστος χώρος δεν κρύβει τίποτα.
 */
export function EntityHeaderActions({ actions }: { readonly actions: readonly EntityHeaderAction[] }) {
  const { containerRef, visibleCount } = useActionOverflow(actions.length);
  const shown = Math.min(visibleCount, MAX_VISIBLE_ACTIONS);
  const overflowed = actions.slice(shown);

  return (
    // `-m-1 p-1`: το `overflow-hidden` θα έκοβε το δαχτυλίδι εστίασης των ακριανών κουμπιών.
    <div ref={containerRef} className="-m-1 flex min-w-0 flex-row-reverse gap-2 overflow-hidden p-1">
      {actions.map((action, index) => {
        const isOverflowed = index >= shown;
        return (
          <EntityActionButton
            key={index}
            action={action}
            overflowed={isOverflowed}
            className={cn('shrink-0', isOverflowed ? 'order-last' : ORDER_FROM_RIGHT[shown - index])}
          />
        );
      })}
      {overflowed.length > 0 && <ActionOverflowMenu actions={overflowed} />}
    </div>
  );
}
