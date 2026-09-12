/**
 * 🔢 ICON COUNT BADGE — SSoT για το «σήμα μετρητή πάνω σε εικονίδιο»
 *
 * Ένα σήμα μετρητή απαντά σε **πέντε** ερωτήσεις: ποιο χρώμα, ποιο μέγεθος, πού
 * ακριβώς, πότε κόβεται ο αριθμός, και τι ακούει ο αναγνώστης οθόνης. Πριν από το
 * ADR-854 τις απαντούσε **κάθε call site μόνο του**, σε έξι αντίγραφα — με αποτέλεσμα
 * τέσσερα διαφορετικά χρώματα, έξι μεγέθη, τέσσερις θέσεις και τρία cutoff.
 *
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΔΕΧΕΤΑΙ `className`: η ελευθερία του call site ΕΙΝΑΙ η αιτία των έξι
 * αντιγράφων. Με ελεύθερο `className` η απόκλιση απλώς μεταναστεύει μέσα στο string
 * και το jscpd βλέπει «καθαρό» component. Νέα θέση/μέγεθος = τιμή στο enum εδώ, που
 * περνά από έναν ιδιοκτήτη — όχι override από κάθε καλούντα.
 *
 * 🔑 ΓΙΑΤΙ ΔΕΝ ΤΥΛΙΓΕΙ ΤΟ `Badge`: το `Badge` αποδίδει `<div>`. Τα σήματα αυτά ζουν
 * μέσα σε `<button>`, και `<button><div>` είναι άκυρη φωλίαση.
 *
 * 📘 ADR-854 · Προϋπόθεση χρήσης: ο γονέας πρέπει να είναι `relative`.
 */

'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { COMMON_NAMESPACES } from '@/i18n/namespace-bundles';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

/** Το προεπιλεγμένο κλειδί ανακοίνωσης όταν ο καταναλωτής δεν δίνει σημασιολογικό δικό του. */
const DEFAULT_ANNOUNCE_NS = 'common-shared' as const;
const DEFAULT_ANNOUNCE_KEY = 'iconCountBadge.items' as const;

/** Σύμβαση Material Design 3 / MUI Badge: ο μετρητής κόβεται στο 99 και γίνεται «99+». */
export const ICON_COUNT_BADGE_DEFAULT_MAX = 99;

/**
 * 🎨 ΤΟΝΟΣ = ΖΕΥΓΟΣ (γέμισμα + μελάνι), ΠΟΤΕ ΜΟΝΟ ΓΕΜΙΣΜΑ.
 *
 * Εδώ ξεπερνάμε τη σύμβαση των μεγάλων: ο MUI δίνει `color="success"` με σταθερό λευκό
 * κείμενο, που στο δικό μας palette μετριέται **2,30:1** — δηλαδή σε αφήνει να φτιάξεις
 * δυσανάγνωστο σήμα. Κάθε γραμμή εδώ είναι μετρημένη (WCAG, φωτεινό/σκοτεινό):
 *
 *   urgent  --status-error   + λευκό → 4,80 / 4,80 ✅
 *   count   --status-info    + λευκό → 5,20 / 5,20 ✅
 *   success --status-success + μαύρο → 9,14 / 6,27 ✅   (με λευκό: 2,30 ❌)
 *   warning --status-warning + μαύρο → 6,66 / 6,66 ✅   (με λευκό: 3,15 ❌)
 *
 * ⛔ ΜΗΝ προσθέσεις τόνο χωρίς να μετρήσεις το ζεύγος, και ΜΗΝ αλλάξεις μελάνι σε
 * «λευκό παντού για συνέπεια» — η συνέπεια εδώ είναι η ΑΝΑΓΝΩΣΙΜΟΤΗΤΑ, όχι το μελάνι.
 */
export type IconCountBadgeTone = 'urgent' | 'count' | 'success' | 'warning';

/** Κλειστό σύνολο μεγεθών — `min-w` (όχι `w`) ώστε ο τριψήφιος να μην κόβεται. */
export type IconCountBadgeSize = 'sm' | 'md';

/** Λογικές θέσεις (`start`/`end`), όχι φυσικές — σωστές σε RTL χωρίς δεύτερο κανόνα. */
export type IconCountBadgePlacement = 'top-end' | 'top-start';

/** Ανακοίνωση σε αναγνώστη οθόνης: `true` = προεπιλεγμένο «N στοιχεία», ή δικό σου κλειδί. */
export type IconCountBadgeAnnounce = true | { readonly ns: string; readonly key: string };

export interface IconCountBadgeProps {
  /**
   * Η τιμή του μετρητή. **Όταν `count <= 0` δεν αποδίδεται τίποτα** — η συνθήκη ζει ΜΕΣΑ
   * στο component ώστε να μην ξαναγράφεται `count > 0 &&` σε κάθε καταναλωτή.
   */
  readonly count: number;
  /** Οροφή πριν το cutoff. @default 99 */
  readonly max?: number;
  /** @default 'urgent' */
  readonly tone?: IconCountBadgeTone;
  /** @default 'sm' */
  readonly size?: IconCountBadgeSize;
  /** @default 'top-end' */
  readonly placement?: IconCountBadgePlacement;
  /**
   * Πώς ανακοινώνεται ο αριθμός. **Παράλειψέ το μόνο όταν ο γονέας ήδη κουβαλά τον
   * αριθμό στο `aria-label` του** (σύμβαση Primer/eBay/SAP: «Κάδος (3 στοιχεία)»).
   * Ο αναγνώστης ακούει τον **πραγματικό** αριθμό, όχι το κομμένο «99+».
   */
  readonly announce?: IconCountBadgeAnnounce;
  /** `true` → ο κρυφός κόμβος γίνεται `aria-live="polite"`, ώστε να ακουστεί η ΑΛΛΑΓΗ. */
  readonly live?: boolean;
  readonly 'data-testid'?: string;
}

interface TonePair {
  /** Κλειδί του `COLOR_BRIDGE.bg` — πάντα `*Solid`, ποτέ `--bg-*` (soft surface). */
  readonly fill: 'errorSolid' | 'infoSolid' | 'successSolid' | 'warningSolid';
  /** Κλειδί του `COLOR_BRIDGE.text` — το μετρημένο μελάνι αυτού του γεμίσματος. */
  readonly ink: 'onSolid' | 'onSolidDark';
}

const TONE_PAIRS: Readonly<Record<IconCountBadgeTone, TonePair>> = {
  urgent: { fill: 'errorSolid', ink: 'onSolid' },
  count: { fill: 'infoSolid', ink: 'onSolid' },
  success: { fill: 'successSolid', ink: 'onSolidDark' },
  warning: { fill: 'warningSolid', ink: 'onSolidDark' },
};

const SIZE_CLASSES: Readonly<Record<IconCountBadgeSize, string>> = {
  sm: 'h-4 min-w-4 px-1 text-[10px]',
  md: 'h-5 min-w-5 px-1.5 text-xs',
};

const PLACEMENT_CLASSES: Readonly<Record<IconCountBadgePlacement, string>> = {
  'top-end': '-top-1 -end-1',
  'top-start': '-top-1 -start-1',
};

/** Σύμβαση MD3/MUI: πάνω από την οροφή δείχνουμε «<max>+», ποτέ τον ωμό αριθμό. */
export function formatCount(count: number, max: number): string {
  return count > max ? `${max}+` : String(count);
}

function resolveAnnounceRef(announce: IconCountBadgeAnnounce): { ns: string; key: string } {
  return announce === true
    ? { ns: DEFAULT_ANNOUNCE_NS, key: DEFAULT_ANNOUNCE_KEY }
    : { ns: announce.ns, key: announce.key };
}

/**
 * Σήμα μετρητή τοποθετημένο πάνω στο εικονίδιο του γονέα.
 *
 * @example
 * // Ο γονέας είναι `relative` και κουβαλά το προσβάσιμο όνομα· το σήμα βάζει μόνο τον αριθμό.
 * <button className="relative" aria-label={labelFromLocale}>
 *   <Trash2 />
 *   <IconCountBadge count={trashCount} announce={{ ns: 'contacts-lifecycle', key: 'trash.count' }} />
 * </button>
 *
 * ⚠️ Το παράδειγμα ΔΕΝ γράφει `t('…')`: το CHECK 3.8 σαρώνει και τα σχόλια, οπότε ένα
 * κλειδί σε παράδειγμα καταγγέλλεται σαν να έλειπε από τα locales (μετρημένο 2026-09-12).
 */
export function IconCountBadge({
  count,
  max = ICON_COUNT_BADGE_DEFAULT_MAX,
  tone = 'urgent',
  size = 'sm',
  placement = 'top-end',
  announce,
  live = false,
  'data-testid': testId,
}: IconCountBadgeProps): React.ReactElement | null {
  const colors = useSemanticColors();
  const { t } = useTranslation(COMMON_NAMESPACES);

  // Η συνθήκη ζει εδώ, όχι σε έξι call sites.
  if (!Number.isFinite(count) || count <= 0) return null;

  const pair = TONE_PAIRS[tone];
  const announceRef = announce ? resolveAnnounceRef(announce) : null;

  return (
    <>
      <span
        // `tabular-nums`: ο δίσκος δεν μεταπηδά σε πλάτος όταν 8→9→10.
        className={cn(
          'pointer-events-none absolute inline-flex items-center justify-center',
          'rounded-full font-medium leading-none tabular-nums',
          PLACEMENT_CLASSES[placement],
          SIZE_CLASSES[size],
          colors.bg[pair.fill],
          colors.text[pair.ink],
        )}
        // ⛔ ΣΤΑΘΕΡΑ, ΟΧΙ prop: ο ίδιος ο αριθμός χωρίς συμφραζόμενα («3») δεν λέει
        // τίποτα σε αναγνώστη οθόνης. Το νόημα ζει στο `announce` ή στον γονέα.
        aria-hidden="true"
        data-testid={testId}
      >
        {formatCount(count, max)}
      </span>
      {announceRef ? (
        <span className="sr-only" aria-live={live ? 'polite' : undefined}>
          {t(announceRef.key, { ns: announceRef.ns, count })}
        </span>
      ) : null}
    </>
  );
}
