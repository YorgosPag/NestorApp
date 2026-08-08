'use client';

/**
 * ADR-739 §43 / ADR-755 — **τα items του μενού δεξιού κλικ σε κελιά**: η υποδοχή του
 * {@link TABLE_RANGE_MENU_GROUPS}, με εικονίδια και τον έναν κανόνα ενεργοποίησης.
 *
 * ## 🔴 Ο ΚΑΝΟΝΑΣ ΕΝΕΡΓΟΠΟΙΗΣΗΣ ΓΡΑΦΕΤΑΙ ΜΙΑ ΦΟΡΑ
 * Μια εντολή είναι πατήσιμη **μόνο** αν (α) υπάρχει χειριστής στο {@link TableRangeMenuActions}
 * **και** (β) το `enabled[id] !== false`. Άρα ό,τι δεν έχει πράξη είναι **δομικά** γκρίζο: δεν
 * υπάρχει τρόπος να ξεχαστεί ένα `disabled` σε δεκαπέντε items, γιατί κανένα item δεν το
 * δηλώνει μόνο του. Η ημέρα που θα γραφτεί η «Ειδική επικόλληση» χρειάζεται **μία** προσθήκη
 * στον χάρτη χειριστών — και το item ανοίγει μόνο του.
 *
 * ## Γιατί ξεχωριστό αρχείο
 * Ίδιο κριτήριο με το {@link TableHeaderMenuItems}: αυτά τα items είναι καθαρή απόδοση από
 * μητρώο + επτά χειριστές — δεν αγγίζουν ούτε την εστίαση, ούτε τον κύκλο ζωής του μενού, ούτε
 * τον φύλακα «κλικ έξω». Δηλαδή τίποτα από τη μηχανική που κάνει το γονικό αρχείο δύσκολο.
 *
 * @module subapps/dxf-viewer/ui/components/table-range-menu/TableRangeMenuItems
 * @see ui/components/table-range-menu/table-range-menu-commands.ts — η διάταξη (καθαρή γνώση)
 * @see ui/components/TableRangeContextMenu.tsx — ποιος τα ανοίγει και ποιος κλείνει το μενού
 */

import React from 'react';
import {
  ArrowUpDown,
  ClipboardPaste,
  Copy,
  Filter,
  Link,
  MessageSquare,
  ScanSearch,
  Scissors,
  Search,
  StickyNote,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  DropdownMenuSub,
  DxfMenuIcon,
  DxfMenuItem,
  DxfMenuLabel,
  DxfMenuSeparator,
  DxfMenuShortcut,
  DxfMenuSubContent,
  DxfMenuSubTrigger,
} from '../dxf-context-menu/DxfContextMenu';
import {
  TABLE_RANGE_MENU_GROUPS,
  type TableRangeMenuCommandEntry,
  type TableRangeMenuCommandId,
  type TableRangeMenuEnabled,
  type TableRangeMenuEntry,
  type TableRangeMenuSubmenuEntry,
  type TableRangeMenuSubmenuId,
} from './table-range-menu-commands';

/**
 * Οι **επτά** πράξεις που υπάρχουν σήμερα.
 *
 * Ένα αντικείμενο και όχι επτά props, για τον ίδιο λόγο που το ADR-750 έβαλε τα περιγράμματα σε
 * ένα: ο τύπος **είναι** το συμβόλαιο, και μια κατάσταση «τέσσερις από τις επτά» δεν πρέπει να
 * είναι εκφράσιμη.
 */
export interface TableRangeMenuActions {
  readonly onCut: () => void;
  readonly onCopy: () => void;
  readonly onPaste: () => void;
  readonly onInsert: () => void;
  readonly onDelete: () => void;
  readonly onClearContents: () => void;
  /**
   * 🔴 ADR-739 §61 — «Μορφοποίηση κελιών…», **το κανονικό σημείο εισόδου του Excel**.
   *
   * Η προσθήκη είναι **μία γραμμή εδώ και μία στον χάρτη χειριστών** — και αυτό είναι η απόδειξη
   * ότι ο κανόνας ενεργοποίησης του module δουλεύει όπως γράφτηκε: το item υπάρχει στο μητρώο
   * **από το §43**, γκρίζο, στην έβδομη ομάδα, στη μετρημένη θέση του Excel. Κανείς δεν
   * χρειάστηκε να θυμηθεί πού μπαίνει· η ημέρα που απέκτησε πράξη το άνοιξε **μόνο του**.
   */
  readonly onFormatCells: () => void;
}

export interface TableRangeMenuItemsProps {
  readonly actions: TableRangeMenuActions;
  /** Ποιες εντολές έχουν νόημα ΤΩΡΑ (π.χ. δεν υπάρχει τίποτα να επικολληθεί). */
  readonly enabled: TableRangeMenuEnabled;
}

/**
 * Τα εικονίδια ζουν **εδώ** και όχι στο μητρώο: είναι React, και το μητρώο οφείλει να μένει
 * εισαγώγιμο χωρίς JSX runtime. `null` όπου το Excel δείχνει item **χωρίς** εικονίδιο — η
 * υποδοχή κρατά ούτως ή άλλως το αυλάκι των 16px, ώστε οι ετικέτες να στοιχίζονται.
 */
const COMMAND_ICONS: Readonly<Record<TableRangeMenuCommandId, LucideIcon | null>> = {
  cut: Scissors,
  copy: Copy,
  pasteAll: ClipboardPaste,
  pasteSpecial: null,
  smartLookup: Search,
  insert: null,
  delete: null,
  clearContents: null,
  quickAnalysis: ScanSearch,
  newComment: MessageSquare,
  newNote: StickyNote,
  formatCells: null,
  pickFromList: null,
  defineName: null,
  link: Link,
};

const SUBMENU_ICONS: Readonly<Record<TableRangeMenuSubmenuId, LucideIcon>> = {
  filter: Filter,
  sort: ArrowUpDown,
};

const ICON_SIZE = 15;

/** Το βελάκι του υπομενού — γλύφος, όχι κείμενο: ίδιος με τον `DrawingContextMenu`. */
const SUBMENU_ARROW = '▶';

/**
 * Ο χάρτης ταυτότητα → χειριστής. **Δεν** είναι πλήρης και δεν πρέπει να γίνει: η απουσία
 * είναι ακριβώς ο μηχανισμός που κρατά γκρίζες τις **οκτώ** εντολές χωρίς πράξη (ήταν εννιά
 * μέχρι το §61, που έδωσε πράξη στη «Μορφοποίηση κελιών…»).
 */
function commandHandlers(
  actions: TableRangeMenuActions,
): Readonly<Partial<Record<TableRangeMenuCommandId, () => void>>> {
  return {
    cut: actions.onCut,
    copy: actions.onCopy,
    pasteAll: actions.onPaste,
    insert: actions.onInsert,
    delete: actions.onDelete,
    clearContents: actions.onClearContents,
    formatCells: actions.onFormatCells,
  };
}

/** Μια εντολή: εικονίδιο (ή κενό αυλάκι) + ετικέτα. Το `disabled` το έκρινε ο καλών. */
function RangeMenuCommand({
  entry, onSelect,
}: {
  readonly entry: TableRangeMenuCommandEntry;
  readonly onSelect: (() => void) | undefined;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const Icon = COMMAND_ICONS[entry.id];

  return (
    <DxfMenuItem disabled={!onSelect} onSelect={onSelect}>
      <DxfMenuIcon>{Icon ? <Icon size={ICON_SIZE} aria-hidden="true" /> : null}</DxfMenuIcon>
      <DxfMenuLabel>{t(entry.labelKey)}</DxfMenuLabel>
    </DxfMenuItem>
  );
}

/**
 * «Φίλτρο ▶» / «Ταξινόμηση ▶» — **η όψη πρώτα**.
 *
 * Ο πυροδότης είναι `disabled`, άρα τα παιδιά δεν ανοίγουν ποτέ σήμερα· υπάρχουν γραμμένα
 * ώστε η ημέρα που θα υπάρξει ταξινόμηση να είναι **αφαίρεση** ενός `disabled`, όχι νέα
 * σχεδίαση μενού από μνήμη.
 *
 * ⚠️ Το `opacity-40` γράφεται εδώ επειδή ο `DxfMenuSubTrigger` — σε αντίθεση με τον
 * `DxfMenuItem` — **δεν** βάφει γκρίζα την ανενεργή κατάσταση (δες `DxfContextMenu.tsx`: η
 * κλάση `menuItemDisabled` μπαίνει μόνο στα items). Χωρίς αυτό ο χρήστης θα έβλεπε ενεργό
 * item που δεν ανοίγει — δηλαδή ακριβώς το «κουμπί που δεν κάνει τίποτα» του Α17.
 */
function RangeMenuSubmenu({
  entry,
}: {
  readonly entry: TableRangeMenuSubmenuEntry;
}): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  const Icon = SUBMENU_ICONS[entry.id];

  return (
    <DropdownMenuSub>
      <DxfMenuSubTrigger disabled className="opacity-40">
        <DxfMenuIcon><Icon size={ICON_SIZE} aria-hidden="true" /></DxfMenuIcon>
        <DxfMenuLabel>{t(entry.labelKey)}</DxfMenuLabel>
        <DxfMenuShortcut>{SUBMENU_ARROW}</DxfMenuShortcut>
      </DxfMenuSubTrigger>
      <DxfMenuSubContent>
        {entry.children.map((child) => (
          <DxfMenuItem key={child.id} disabled>
            <DxfMenuLabel>{t(child.labelKey)}</DxfMenuLabel>
          </DxfMenuItem>
        ))}
      </DxfMenuSubContent>
    </DropdownMenuSub>
  );
}

/** «Επιλογές επικόλλησης:» — ετικέτα χωρίς αυλάκι εικονιδίου, ίδιο σχήμα με τον τίτλο. */
function RangeMenuHeading({ labelKey }: { readonly labelKey: string }): React.ReactElement {
  const { t } = useTranslation('dxf-viewer');
  return (
    <DxfMenuItem disabled>
      <DxfMenuLabel>{t(labelKey)}</DxfMenuLabel>
    </DxfMenuItem>
  );
}

function RangeMenuEntry({
  entry, handlers, enabled,
}: {
  readonly entry: TableRangeMenuEntry;
  readonly handlers: Readonly<Partial<Record<TableRangeMenuCommandId, () => void>>>;
  readonly enabled: TableRangeMenuEnabled;
}): React.ReactElement {
  if (entry.kind === 'heading') return <RangeMenuHeading labelKey={entry.labelKey} />;
  if (entry.kind === 'submenu') return <RangeMenuSubmenu entry={entry} />;

  // 🔴 Ο ΕΝΑΣ κανόνας: χειριστής **και** μη-`false`. Ό,τι λείπει από τον χάρτη χειριστών δεν
  // μπορεί να ανοίξει, ό,τι απαγόρευσε ο καλών δεν μπορεί να ανοίξει — καμία τρίτη διαδρομή.
  const handler = handlers[entry.id];
  const isEnabled = handler !== undefined && enabled[entry.id] !== false;
  return <RangeMenuCommand entry={entry} onSelect={isEnabled ? handler : undefined} />;
}

/**
 * Τα items **δεν κλείνουν μόνα τους**: το κλείσιμο το ζητά το ίδιο το Radix (`onSelect` ⇒
 * `onOpenChange(false)`), δηλαδή περνά από τον **έναν** δρόμο εξόδου του γονέα.
 *
 * Το διαχωριστικό μπαίνει **πριν** από κάθε ομάδα πλην της πρώτης: πάνω από την πρώτη κάθεται
 * ήδη ο τίτλος της περιοχής με το δικό του διαχωριστικό, και δύο γραμμές κολλητά διαβάζονται
 * ως κενή ομάδα.
 */
export function TableRangeMenuItems({
  actions, enabled,
}: TableRangeMenuItemsProps): React.ReactElement {
  const handlers = commandHandlers(actions);

  return (
    <>
      {TABLE_RANGE_MENU_GROUPS.map((group, index) => (
        // Κλειδί το πρώτο item της ομάδας: οι ταυτότητες είναι μοναδικές σε όλο το μενού και ο
        // τύπος μη-κενής πλειάδας εγγυάται ότι υπάρχει — ποτέ `index` ως κλειδί.
        <React.Fragment key={group[0].id}>
          {index > 0 ? <DxfMenuSeparator /> : null}
          {group.map((entry) => (
            <RangeMenuEntry
              key={entry.id}
              entry={entry}
              handlers={handlers}
              enabled={enabled}
            />
          ))}
        </React.Fragment>
      ))}
    </>
  );
}
