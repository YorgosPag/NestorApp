/**
 * 🏢 ENTITY ACTION PRESETS — Enterprise Standard
 *
 * Κεντρικοποιημένα presets για action buttons σε entity headers.
 * Single Source of Truth για εικονίδιο, **έμφαση** και σειρά.
 *
 * 🔑 **Η έμφαση δηλώνεται, το χρώμα όχι** (ADR-912 §12.13). Ως τις 2026-10-17 κάθε τύπος είχε δικό του gradient
 *   (μπλε · πράσινο · μωβ · κόκκινο) και όλα τα κουμπιά είχαν το ίδιο βάρος — στο κινητό, τέσσερα χρώματα σε τρεις
 *   γραμμές χωρίς να λένε ποιο είναι το κύριο. Πρακτική Material 3 / Apple HIG / Polaris: **ΕΝΑ** γεμάτο κουμπί ανά
 *   γραμμή, τα υπόλοιπα ουδέτερα, οι καταστροφικές **ΜΟΝΟ** στο μενού «⋯», μακριά από τον αντίχειρα.
 *
 * | Action  | Emphasis    |
 * |---------|-------------|
 * | save · edit · complete | primary (το πρώτο της γραμμής γεμίζει) |
 * | cancel · new · view · print · showcase | secondary |
 * | delete · trash | destructive (πάντα στο μενού) |
 */

import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { Pencil, Save, X, Trash2, Plus, Eye, Printer, Share2, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EntityActionEmphasis, EntityHeaderAction } from './UnifiedEntityHeaderSystem';

// ===== TYPES =====

type ActionType = 'edit' | 'save' | 'cancel' | 'delete' | 'trash' | 'new' | 'view' | 'print' | 'showcase' | 'complete';

interface EntityActionPreset {
  icon: LucideIcon;
  emphasis: EntityActionEmphasis;
}

// ===== PRESETS =====

/**
 * **Το γέμισμα της ΜΙΑΣ κύριας ενέργειας.** ⚠️ ΟΧΙ `variant="default"` (`bg-primary`): στο προεπιλεγμένο σκοτεινό θέμα
 * το `--primary` είναι **ταυτόσημο** με το `--card` (ADR-770, CHECK 3.38) — μετρημένο ζωντανά 2026-10-17 στη σελίδα
 * ακινήτου, `217 33% 17%` και τα δύο ⇒ το «γεμάτο» κουμπί δεν ξεχώριζε από την κάρτα. Η αλλαγή του `--primary`
 * απορρίφθηκε γραπτώς (ADR-682 §5.5)· εδώ μένει το μπλε της εφαρμογής, που ήταν ήδη το χρώμα της «Επεξεργασίας».
 */
const ENTITY_ACTION_PRIMARY_FILL = `${GRADIENT_HOVER_EFFECTS.BLUE} text-white`;

const ENTITY_ACTION_PRESETS: Record<ActionType, EntityActionPreset> = {
  edit:     { icon: Pencil,      emphasis: 'primary' },
  save:     { icon: Save,        emphasis: 'primary' },
  cancel:   { icon: X,           emphasis: 'secondary' },
  delete:   { icon: Trash2,      emphasis: 'destructive' },
  trash:    { icon: Trash2,      emphasis: 'destructive' },
  new:      { icon: Plus,        emphasis: 'secondary' },
  view:     { icon: Eye,         emphasis: 'secondary' },
  print:    { icon: Printer,     emphasis: 'secondary' },
  showcase: { icon: Share2,      emphasis: 'secondary' },
  complete: { icon: CheckCircle, emphasis: 'primary' },
};

// ===== PRIORITY =====

/**
 * **Η κανονική σειρά των ενεργειών** (ADR-912 §12) — μικρότερος αριθμός = πιο μπροστά **και** τελευταία που φεύγει
 * στο μενού «Περισσότερες». ΕΝΑΣ πίνακας για όλες τις οντότητες.
 *
 * 🔴 **Η αφορμή**: κάθε κεφαλίδα δήλωνε τις ίδιες ενέργειες με άλλη σειρά (κτίριο: Επίδειξη · Νέο · Επεξεργασία ·
 *   Διαγραφή — έργο: Νέο · Επεξεργασία · Επίδειξη · Κάδος), και η υπερχείλιση κρατά **τις πρώτες**. Σε στενό πλάτος το
 *   κτίριο κρατούσε την «Επίδειξη» και έστελνε στο μενού την «Επεξεργασία».
 * 🔑 Η προτεραιότητα **δηλώνεται**, δεν προκύπτει από το πώς έτυχε να γραφτεί ο πίνακας (Fluent `Overflow` `priority`)·
 *   η επιβεβαίωση προηγείται, η καταστροφική ενέργεια έρχεται τελευταία (Polaris page actions).
 */
const ENTITY_ACTION_PRIORITY: Record<ActionType, number> = {
  save: 10,
  cancel: 20,
  complete: 30,
  edit: 40,
  new: 50,
  view: 60,
  showcase: 70,
  print: 80,
  trash: 90,
  delete: 100,
};

/** Ενέργεια χωρίς δηλωμένη προτεραιότητα (χτισμένη με το χέρι): στη μέση — μετά τις κύριες, πριν από τις καταστροφικές. */
const UNDECLARED_ACTION_PRIORITY = ENTITY_ACTION_PRIORITY.view;

/**
 * Οι ενέργειες στην κανονική τους σειρά. **Σταθερή** ταξινόμηση: ίση προτεραιότητα ⇒ μένει η σειρά δήλωσης.
 * Επιστρέφει τον **ίδιο** πίνακα όταν είναι ήδη σε σειρά (καμία νέα ταυτότητα χωρίς λόγο).
 */
function orderEntityActions(actions: readonly EntityHeaderAction[]): readonly EntityHeaderAction[] {
  const rank = (action: EntityHeaderAction) => action.priority ?? UNDECLARED_ACTION_PRIORITY;
  const inOrder = actions.every((action, index) => index === 0 || rank(actions[index - 1]) <= rank(action));
  return inOrder ? actions : [...actions].sort((left, right) => rank(left) - rank(right));
}

/**
 * **Η σειρά δήλωσης ΕΙΝΑΙ η σειρά** — για γραμμές όπου οι τύποι δανείζονται μόνο για την όψη τους και η σειρά είναι
 * ροή εργασίας (π.χ. Αλλαγή τιμής → Κράτηση → Πώληση → Επαναφορά). Ρητή εξαίρεση από τον πίνακα, όχι σιωπηλή.
 */
function inDeclaredOrder(actions: readonly EntityHeaderAction[]): EntityHeaderAction[] {
  return actions.map((action, index) => ({ ...action, priority: index }));
}

// ===== PRESENTATION =====

/** Πώς αποδίδεται μια γραμμή ενεργειών: ποια μένουν κουμπιά (στη σειρά τους) και ποια ζουν **μόνο** στο μενού. */
interface PresentedEntityActions {
  readonly inline: readonly EntityHeaderAction[];
  readonly menuOnly: readonly EntityHeaderAction[];
}

/**
 * **Ο ΕΝΑΣ κανόνας έμφασης** (ADR-912 §12.13): οι καταστροφικές πάνε στο μενού· από τις κύριες **μόνο η πρώτη** μένει
 * κύρια — οι επόμενες υποβιβάζονται σε δευτερεύουσες. Ενέργεια χωρίς δηλωμένη έμφαση (χτισμένη με το χέρι) =
 * δευτερεύουσα. Η σειρά δεν αλλάζει· καθαρή συνάρτηση, καμία μέτρηση.
 */
function presentEntityActions(actions: readonly EntityHeaderAction[]): PresentedEntityActions {
  const inline: EntityHeaderAction[] = [];
  const menuOnly: EntityHeaderAction[] = [];
  let leadTaken = false;
  for (const action of actions) {
    if (action.emphasis === 'destructive') {
      menuOnly.push(action);
    } else if (action.emphasis === 'primary' && !leadTaken) {
      leadTaken = true;
      inline.push(action);
    } else {
      inline.push(action.emphasis === 'primary' ? { ...action, emphasis: 'secondary' } : action);
    }
  }
  return { inline, menuOnly };
}

// ===== FACTORY =====

/**
 * Creates a standardized entity header action with consistent styling.
 *
 * ⚠️ **Τα `overrides` ΠΕΡΙΛΑΜΒΑΝΟΥΝ πλέον `disabled` / `pending` / `pendingLabel`** (ADR-332 D27 Ζ5).
 * Μέχρι τότε ο τύπος τα **απέκλειε**: ένας καλών που ήθελε να δηλώσει «τρέχει τώρα» **δεν μπορούσε**,
 * κι έτσι κάθε κουμπί αυτής της οικογένειας έμενε πατήσιμο όσο η πράξη του εκτελούνταν. Μετρημένο
 * ζωντανά στις επαφές: αποθήκευση **61,4″** με ενεργό κουμπί.
 *
 * @example
 * createEntityAction('edit', t('header.edit'), onStartEdit)
 * createEntityAction('new', t('header.new'), onNew, { icon: UserPlus })
 * createEntityAction('save', t('header.actions.save'), onSave, { pending: isSaving, pendingLabel: t('actions.save_loading') })
 */
function createEntityAction(
  type: ActionType,
  label: string,
  onClick: () => void,
  overrides?: Partial<
    Pick<EntityHeaderAction, 'icon' | 'className' | 'variant' | 'emphasis' | 'disabled' | 'pending' | 'pendingLabel' | 'priority' | 'discards'>
  >
): EntityHeaderAction {
  const preset = ENTITY_ACTION_PRESETS[type];
  return {
    label,
    onClick,
    icon: overrides?.icon ?? preset.icon,
    emphasis: overrides?.emphasis ?? preset.emphasis,
    priority: overrides?.priority ?? ENTITY_ACTION_PRIORITY[type],
    // Η Ακύρωση εγκαταλείπει την επεξεργασία: στο φύλλο κινητού την αναλαμβάνει ο ✕ της μπάρας (ADR-912 §12.5).
    ...(type === 'cancel' ? { dismisses: true } : {}),
    ...(overrides?.discards !== undefined ? { discards: overrides.discards } : {}),
    ...(overrides?.className ? { className: overrides.className } : {}),
    ...(overrides?.variant ? { variant: overrides.variant } : {}),
    ...(overrides?.disabled !== undefined ? { disabled: overrides.disabled } : {}),
    ...(overrides?.pending !== undefined ? { pending: overrides.pending } : {}),
    ...(overrides?.pendingLabel !== undefined ? { pendingLabel: overrides.pendingLabel } : {}),
  };
}

export { ENTITY_ACTION_PRESETS, ENTITY_ACTION_PRIMARY_FILL, ENTITY_ACTION_PRIORITY, createEntityAction, inDeclaredOrder, orderEntityActions, presentEntityActions };
export type { ActionType, EntityActionPreset, PresentedEntityActions };
