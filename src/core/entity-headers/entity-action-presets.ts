/**
 * 🏢 ENTITY ACTION PRESETS — Enterprise Standard
 *
 * Κεντρικοποιημένα presets για action buttons σε entity headers.
 * Single Source of Truth για χρώματα, icons και styling.
 *
 * | Action  | Color   | Gradient Key     |
 * |---------|---------|------------------|
 * | edit    | Blue    | BLUE             |
 * | save    | Green   | GREEN            |
 * | cancel  | Gray    | GRAY             |
 * | delete  | Red     | RED              |
 * | trash   | Gray    | GRAY             | soft-delete (move to trash)
 * | new     | Green   | GREEN            |
 * | view    | Primary | PRIMARY_BUTTON   |
 * | print   | Gray    | GRAY             |
 * | showcase| Violet  | VIOLET           | ADR-312 Property Showcase
 * | complete| Green   | GREEN            | task/item completion
 */

import { GRADIENT_HOVER_EFFECTS } from '@/components/ui/effects';
import { Pencil, Save, X, Trash2, Plus, Eye, Printer, Share2, CheckCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { EntityHeaderAction } from './UnifiedEntityHeaderSystem';

// ===== TYPES =====

type ActionType = 'edit' | 'save' | 'cancel' | 'delete' | 'trash' | 'new' | 'view' | 'print' | 'showcase' | 'complete';

interface EntityActionPreset {
  icon: LucideIcon;
  className: string;
}

// ===== PRESETS =====

const ENTITY_ACTION_PRESETS: Record<ActionType, EntityActionPreset> = {
  edit:     { icon: Pencil,  className: `${GRADIENT_HOVER_EFFECTS.BLUE} text-white` },
  save:     { icon: Save,    className: `${GRADIENT_HOVER_EFFECTS.GREEN} text-white` },
  cancel:   { icon: X,       className: `${GRADIENT_HOVER_EFFECTS.GRAY} text-white` },
  delete:   { icon: Trash2,  className: `${GRADIENT_HOVER_EFFECTS.RED} text-white` },
  trash:    { icon: Trash2,  className: `${GRADIENT_HOVER_EFFECTS.RED} text-white` },
  new:      { icon: Plus,    className: `${GRADIENT_HOVER_EFFECTS.GREEN} text-white` },
  view:     { icon: Eye,     className: GRADIENT_HOVER_EFFECTS.PRIMARY_BUTTON },
  print:    { icon: Printer, className: `${GRADIENT_HOVER_EFFECTS.GRAY} text-white` },
  // ADR-312: Violet gradient literal (kept inline to avoid growing hover-effects.ts past its size budget).
  showcase: { icon: Share2,       className: 'bg-gradient-to-r from-violet-500 to-fuchsia-600 hover:from-violet-600 hover:to-fuchsia-700 text-white' },
  complete: { icon: CheckCircle,  className: `${GRADIENT_HOVER_EFFECTS.GREEN} text-white` },
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
    Pick<EntityHeaderAction, 'icon' | 'className' | 'variant' | 'disabled' | 'pending' | 'pendingLabel' | 'priority' | 'discards'>
  >
): EntityHeaderAction {
  const preset = ENTITY_ACTION_PRESETS[type];
  return {
    label,
    onClick,
    icon: overrides?.icon ?? preset.icon,
    className: overrides?.className ?? preset.className,
    priority: overrides?.priority ?? ENTITY_ACTION_PRIORITY[type],
    // Η Ακύρωση εγκαταλείπει την επεξεργασία: στο φύλλο κινητού την αναλαμβάνει ο ✕ της μπάρας (ADR-912 §12.5).
    ...(type === 'cancel' ? { dismisses: true } : {}),
    ...(overrides?.discards !== undefined ? { discards: overrides.discards } : {}),
    ...(overrides?.variant ? { variant: overrides.variant } : {}),
    ...(overrides?.disabled !== undefined ? { disabled: overrides.disabled } : {}),
    ...(overrides?.pending !== undefined ? { pending: overrides.pending } : {}),
    ...(overrides?.pendingLabel !== undefined ? { pendingLabel: overrides.pendingLabel } : {}),
  };
}

export { ENTITY_ACTION_PRESETS, ENTITY_ACTION_PRIORITY, createEntityAction, inDeclaredOrder, orderEntityActions };
export type { ActionType, EntityActionPreset };
