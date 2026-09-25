'use client';

/**
 * **Η λίστα κάτω από το πεδίο τόπου** — «Τρέχουσα τοποθεσία» + «Ιστορικό αναζητήσεων» (ADR-882).
 *
 * **Layering**: leaf UI — καμία κατάσταση. Ο `usePlaceRecall` κατέχει δείκτη και πράξεις.
 *
 * 🔑 **Η εστίαση μένει στο πεδίο**: κάθε `mousedown` κάνει `preventDefault`, αλλιώς το `blur`
 * του πεδίου θα έκλεινε τη λίστα πριν φτάσει το κλικ (ίδια σύμβαση με το `searchable-combobox`).
 *
 * 🔑 **Το ✕ ΔΕΝ είναι κουμπί μέσα στην επιλογή** — διαδραστικό μέσα σε `role="option"` είναι
 * σφάλμα axe (`nested-interactive`) και απρόσιτο από πληκτρολόγιο όσο η εστίαση μένει στο
 * πεδίο. Είναι οπτική λαβή για το ποντίκι· το πληκτρολόγιο έχει `Shift+Delete`, δηλωμένο με
 * `aria-keyshortcuts` ώστε να το ανακοινώνει ο αναγνώστης οθόνης.
 */

import { useId, useRef, type ReactNode, type RefObject } from 'react';
import { Clock, LocateFixed, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDropdownTokens } from '@/hooks/useDropdownTokens';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { optionDomId } from '@/components/ui/searchable-combobox-listbox';
import { useRevealHighlightedOption } from '@/lib/a11y/use-reveal-highlighted-option';
import type { GeolocationPermission } from '@/lib/geo/current-position';
import type { RecentPlaceSearch } from '@/lib/geo/recent-place-searches';
import { placeRecallOptionKey, type PlaceRecallOption } from './place-recall-options';
import '@/lib/design-system';

const REMOVE_HANDLE = 'data-recall-remove';

interface PlaceRecallListboxProps {
  readonly listboxId: string;
  readonly anchorRef: RefObject<HTMLElement | null>;
  /** Το πεδίο — ο «άγκυρας» της λίστας. */
  readonly children: ReactNode;
  readonly expanded: boolean;
  readonly options: readonly PlaceRecallOption[];
  readonly highlightedIndex: number;
  readonly permission: GeolocationPermission;
  readonly onPick: (option: PlaceRecallOption) => void;
  readonly onRemove: (label: string) => void;
  readonly onHighlight: (index: number) => void;
  readonly onClose: () => void;
}

export function PlaceRecallListbox(props: PlaceRecallListboxProps) {
  const { anchorRef, children, expanded, onClose } = props;
  const dropdown = useDropdownTokens();
  return (
    <Popover open={expanded} onOpenChange={(open) => { if (!open) onClose(); }}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        role="presentation"
        align="start"
        sideOffset={dropdown.content.sideOffset}
        className="w-[var(--radix-popover-trigger-width)] p-0"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        // Το κλικ στο ίδιο το πεδίο δεν είναι «έξω» — αλλιώς η λίστα θα έκλεινε και θα ξανάνοιγε.
        onInteractOutside={(event) => {
          if (event.target instanceof Node && anchorRef.current?.contains(event.target)) {
            event.preventDefault();
          }
        }}
      >
        <RecallList {...props} />
      </PopoverContent>
    </Popover>
  );
}

type RowContext = Pick<
  PlaceRecallListboxProps,
  'listboxId' | 'highlightedIndex' | 'permission' | 'onPick' | 'onRemove' | 'onHighlight'
>;

interface IndexedOption {
  readonly option: PlaceRecallOption;
  readonly index: number;
}

function RecallList(props: PlaceRecallListboxProps) {
  const { listboxId, options, highlightedIndex } = props;
  const { t } = useTranslation(['common-shared']);
  const dropdown = useDropdownTokens();
  const listRef = useRef<HTMLUListElement>(null);
  const headingId = useId();
  const areasHeadingId = useId();
  useRevealHighlightedOption(listRef, highlightedIndex);

  const indexed: IndexedOption[] = options.map((option, index) => ({ option, index }));
  const ofKind = (kind: PlaceRecallOption['kind']) =>
    indexed.filter(({ option }) => option.kind === kind);
  const recents = ofKind('recent');
  const areas = ofKind('area');
  const renderRow = ({ option, index }: IndexedOption) => (
    <RecallRow key={placeRecallOptionKey(option)} option={option} index={index} context={props} />
  );

  return (
    <ul
      ref={listRef}
      id={listboxId}
      role="listbox"
      aria-label={t('common-shared:placeRecall.label')}
      className={`${dropdown.combobox.listPadding} ${dropdown.content.maxHeightCombobox} overflow-y-auto`}
    >
      {ofKind('current-location').map(renderRow)}
      {recents.length > 0 && (
        <li role="presentation">
          <ul role="group" aria-labelledby={headingId}>
            <li
              role="presentation"
              id={headingId}
              className={`bg-muted ${dropdown.item.combobox} ${dropdown.item.fontSizeSecondary} font-semibold uppercase tracking-wide text-muted-foreground`}
            >
              {t('common-shared:placeRecall.historyHeading')}
            </li>
            {recents.map(renderRow)}
          </ul>
        </li>
      )}
      {/* ADR-883 — διοικητικές περιοχές με όριο, ΜΕΤΑ το ιστορικό του ίδιου του ανθρώπου. */}
      {areas.length > 0 && (
        <li role="presentation">
          <ul role="group" aria-labelledby={areasHeadingId}>
            <li
              role="presentation"
              id={areasHeadingId}
              className={`bg-muted ${dropdown.item.combobox} ${dropdown.item.fontSizeSecondary} font-semibold uppercase tracking-wide text-muted-foreground`}
            >
              {t('common-shared:placeRecall.areasHeading')}
            </li>
            {areas.map(renderRow)}
          </ul>
        </li>
      )}
      {ofKind('clear-history').map(renderRow)}
    </ul>
  );
}

interface RecallRowProps extends IndexedOption {
  readonly context: RowContext;
}

function RecallRow({ option, index, context }: RecallRowProps) {
  const { listboxId, highlightedIndex, onPick, onRemove, onHighlight } = context;
  const dropdown = useDropdownTokens();
  const highlighted = highlightedIndex === index;
  const recent = option.kind === 'recent' ? option.place : null;

  return (
    <li
      id={optionDomId(listboxId, index)}
      role="option"
      aria-selected={highlighted}
      aria-keyshortcuts={recent ? 'Shift+Delete' : undefined}
      className={cn(
        `flex cursor-pointer items-center ${dropdown.item.gap} ${dropdown.item.combobox} ${dropdown.item.fontSize} transition-colors`,
        option.kind === 'clear-history' && dropdown.combobox.addNewDivider,
        highlighted ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
      )}
      onMouseDown={(event) => {
        event.preventDefault();
        const removing =
          event.target instanceof Element && event.target.closest(`[${REMOVE_HANDLE}]`) !== null;
        if (recent && removing) onRemove(recent.label);
        else onPick(option);
      }}
      onMouseEnter={() => onHighlight(index)}
    >
      <RecallRowBody option={option} context={context} />
    </li>
  );
}

function RecallRowBody({ option, context }: { option: PlaceRecallOption; context: RowContext }) {
  const { t } = useTranslation(['common-shared']);
  const dropdown = useDropdownTokens();

  if (option.kind === 'current-location') {
    return (
      <>
        <LocateFixed className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="flex flex-col">
          <span className="font-medium">{t('common-shared:placeRecall.currentLocation')}</span>
          {context.permission === 'denied' && (
            <span className={`${dropdown.item.fontSizeSecondary} text-muted-foreground`}>
              {t('common-shared:placeRecall.locationBlocked')}
            </span>
          )}
        </span>
      </>
    );
  }
  if (option.kind === 'clear-history') {
    return (
      <span className="text-[hsl(var(--text-info))]">
        {t('common-shared:placeRecall.clearHistory')}
      </span>
    );
  }
  if (option.kind === 'area') {
    return (
      <>
        <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{option.area.name}</span>
          {option.within !== null && (
            <span className={`${dropdown.item.fontSizeSecondary} truncate text-muted-foreground`}>{option.within}</span>
          )}
        </span>
      </>
    );
  }
  return <RecentRowBody place={option.place} />;
}

function RecentRowBody({ place }: { place: RecentPlaceSearch }) {
  return (
    <>
      <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{place.label}</span>
      {/* Λαβή ΜΟΝΟ για το ποντίκι, κρυμμένη από την προσβασιμότητα: ένα κείμενο εδώ θα γινόταν
          μέρος του ΟΝΟΜΑΤΟΣ της επιλογής («Αθήνα Αφαίρεση…»). Το πληκτρολόγιο/ο αναγνώστης
          οθόνης έχουν το `Shift+Delete` της επιλογής (`aria-keyshortcuts`). */}
      <span
        {...{ [REMOVE_HANDLE]: '' }}
        aria-hidden="true"
        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </span>
    </>
  );
}
