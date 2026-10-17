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
 * 🔑 **Έμφαση, όχι χρώμα ανά τύπο** (ADR-912 §12.13): ΕΝΑ γεμάτο κουμπί, τα υπόλοιπα `outline`, οι καταστροφικές
 *   **μόνο** στο μενού, κάτω από διαχωριστικό και με χρώμα κινδύνου. Ο κανόνας ζει στο `presentEntityActions`.
 */
import React from 'react';
import { MoreHorizontal, MoreVertical } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSpacingTokens } from '@/hooks/useSpacingTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';

import { ENTITY_ACTION_ATTR, ENTITY_ACTION_MORE_ATTR, useActionOverflow } from './action-overflow';
import { ENTITY_ACTION_PRIMARY_FILL, presentEntityActions } from './entity-action-presets';
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

/** Χρώμα κινδύνου στη γραμμή του μενού — ίδιο ιδίωμα με την «Αποσύνδεση» του μενού χρήστη. */
const DESTRUCTIVE_MENU_ITEM = 'text-destructive focus:bg-destructive/10 focus:text-destructive';

/** Η όψη του κουμπιού: ρητή `variant` υπερισχύει· αλλιώς η κύρια γεμίζει και όλες οι άλλες είναι `outline`. */
function buttonVariantOf(action: EntityHeaderAction): NonNullable<EntityHeaderAction['variant']> {
  return action.variant ?? (action.emphasis === 'primary' ? 'default' : 'outline');
}

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
  const { onClick, disabled, pending } = action;
  return (
    <Button
      type="button"
      variant={buttonVariantOf(action)}
      size="sm"
      onClick={onClick}
      disabled={disabled || pending}
      aria-busy={pending}
      aria-hidden={overflowed || undefined}
      tabIndex={overflowed ? -1 : undefined}
      className={cn(
        'h-8',
        spacing.padding.x.sm,
        !action.variant && action.emphasis === 'primary' && ENTITY_ACTION_PRIMARY_FILL,
        action.className,
        overflowed && 'invisible',
        className,
      )}
      {...ACTION_MARK}
    >
      <ActionContent {...action} />
    </Button>
  );
}

interface ActionOverflowMenuProps {
  /** Ενέργειες που δεν χώρεσαν στη γραμμή — στη σειρά τους. */
  readonly actions: readonly EntityHeaderAction[];
  /** Καταστροφικές: ζουν μόνο εδώ, στο τέλος, κάτω από διαχωριστικό (Polaris · Material menus). */
  readonly destructive?: readonly EntityHeaderAction[];
  /**
   * `toolbar` (προεπιλογή) = «⋯» με περίγραμμα, δίπλα σε κουμπιά. `row` = «⋮» χωρίς περίγραμμα, στο τέλος μιας γραμμής
   * λίστας (Drive · Dropbox · Material lists) — ίδιο μενού, ίδιος κανόνας, άλλη θέση.
   */
  readonly appearance?: 'toolbar' | 'row';
  /** Ετικέτα του κουμπιού· απούσα ⇒ «Περισσότερες ενέργειες». Στη γραμμή λίστας λέει **ποιανού** (WCAG 2.4.6). */
  readonly label?: string;
}

interface ActionMenuItemsProps {
  readonly actions: readonly EntityHeaderAction[];
  readonly className?: string;
  readonly onClaimFocus: () => void;
}

function ActionMenuItems({ actions, className, onClaimFocus }: ActionMenuItemsProps) {
  return (
    <>
      {actions.map((action, index) => (
        <DropdownMenuItem
          key={index}
          disabled={action.disabled || action.pending}
          onClick={() => {
            if (action.claimsFocus) onClaimFocus();
            action.onClick();
          }}
          className={className}
        >
          <ActionContent {...action} />
        </DropdownMenuItem>
      ))}
    </>
  );
}

export function ActionOverflowMenu({
  actions,
  destructive = [],
  appearance = 'toolbar',
  label,
}: ActionOverflowMenuProps) {
  const { t } = useTranslation('common-actions');
  const iconSizes = useIconSizes();
  // Ενέργεια που τρέχει μέσα στο κλειστό μενού δεν φαίνεται από πουθενά ⇒ το λέει το ίδιο το κουμπί του μενού.
  const busy = [...actions, ...destructive].some((action) => action.pending);
  const MoreIcon = appearance === 'row' ? MoreVertical : MoreHorizontal;
  // Ενέργεια με `claimsFocus` (επιτόπια μετονομασία) ⇒ στο κλείσιμο η εστίαση ΔΕΝ γυρίζει στο κουμπί: αλλιώς το Radix
  // την κλέβει από το πεδίο που μόλις άνοιξε. Escape / κλικ έξω ⇒ γυρίζει κανονικά (WAI-ARIA menu button).
  const focusClaimed = React.useRef(false);
  const claimFocus = React.useCallback(() => { focusClaimed.current = true; }, []);
  const onCloseAutoFocus = React.useCallback((event: Event) => {
    if (focusClaimed.current) event.preventDefault();
    focusClaimed.current = false;
  }, []);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={appearance === 'row' ? 'ghost' : 'outline'}
          size="sm"
          className="h-8 w-8 shrink-0 p-0"
          aria-label={label ?? t('actions.more')}
          aria-busy={busy || undefined}
          {...MORE_MARK}
        >
          {busy ? <Spinner size="small" color="inherit" /> : <MoreIcon className={iconSizes.sm} />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={onCloseAutoFocus}>
        <ActionMenuItems actions={actions} onClaimFocus={claimFocus} />
        {actions.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
        <ActionMenuItems actions={destructive} className={DESTRUCTIVE_MENU_ITEM} onClaimFocus={claimFocus} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * **Η γραμμή ενεργειών που υπερχειλίζει κατά προτεραιότητα**: οι πρώτες μένουν, οι υπόλοιπες πάνε στο μενού
 * «Περισσότερες ενέργειες». Χωρίς μέτρηση (SSR · jsdom) φαίνονται **όλες** — άγνωστος χώρος δεν κρύβει τίποτα.
 */
interface EntityHeaderActionsProps {
  readonly actions: readonly EntityHeaderAction[];
  /** Η πρώτη ενέργεια μένει ορατή ακόμη κι αν δεν χωρά ολόκληρη (μπάρα φύλλου κινητού — ADR-912 §12). */
  readonly keepPrimary?: boolean;
}

export function EntityHeaderActions({ actions: declared, keepPrimary = false }: EntityHeaderActionsProps) {
  const { inline: actions, menuOnly } = React.useMemo(() => presentEntityActions(declared), [declared]);
  const { containerRef, visibleCount } = useActionOverflow(actions.length, keepPrimary, menuOnly.length > 0);
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
      {(overflowed.length > 0 || menuOnly.length > 0) && (
        <ActionOverflowMenu actions={overflowed} destructive={menuOnly} />
      )}
    </div>
  );
}
