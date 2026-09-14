'use client';

/**
 * @fileoverview **«Κυκλοφόρησε νέα έκδοση — αποθηκεύστε και ανανεώστε»** — ADR-860 §Ε3β.
 * @related lib/app-version/app-update-state · lib/app-version/chunk-recovery/recovery-coordinator
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ΠΟΤΕ ΕΜΦΑΝΙΖΕΤΑΙ
 * ────────────────────────────────────────────────────────────────────────────
 * **Μόνο** όταν συνέβησαν δύο πράγματα μαζί: (α) φόρτωση κώδικα απέτυχε επειδή άλλαξε η έκδοση
 * στον server, **και** (β) υπάρχει μη αποθηκευμένη δουλειά. Χωρίς το (β) η ανάκαμψη ανανεώνει
 * μόνη της και ο άνθρωπος δεν βλέπει τίποτα. Με το (β) **η απόφαση ανήκει στον άνθρωπο** — μια
 * αυτόματη ανανέωση θα έσβηνε ό,τι έγραφε.
 *
 * 🔑 **Πληροφορεί, δεν μπλοκάρει.** Ο άνθρωπος αποθηκεύει με τον τρόπο που ήδη ξέρει και πατά
 * «Ανανέωση» όταν είναι έτοιμος. Αν πατήσει πριν αποθηκεύσει, τα native `beforeunload` της
 * φόρμας ρωτούν ακόμη — διχτάκι ασφαλείας.
 *
 * ⚠️ **ΜΗΔΕΝ DOM όσο δεν υπάρχει νέα έκδοση** (`return null`) — ζει στο root layout, άρα και
 * κάτω από το `(bare)` που δηλώνει «αποδίδει μηδέν DOM, επίτηδες».
 */

import { useSyncExternalStore } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import {
  getAppUpdateSnapshot,
  getServerAppUpdateSnapshot,
  subscribeAppUpdate,
} from '@/lib/app-version/app-update-state';

/**
 * ⚠️ **Namespace `common`, ΟΧΙ `errors` — μετρημένο.** Το banner ζει στο root layout, άρα κάθε
 * namespace που ζητά μπαίνει στο **κέλυφος** (~150 διαδρομές). Το `errors` δεν είναι εκεί· η
 * γεννήτρια του shell slice (CHECK 3.34) το αρνήθηκε («9 έναντι σφραγισμένων 8»). Το `common`
 * είναι ήδη εγγυημένο στο κέλυφος και κόβεται ανά κλειδί.
 * ⛔ ΜΗΝ το κάνεις `next/dynamic` για να γλιτώσεις το namespace: εμφανίζεται ΑΚΡΙΒΩΣ όταν η
 * φόρτωση chunks είναι σπασμένη.
 */
export function AppUpdateBanner() {
  const { t } = useTranslation('common');
  const update = useSyncExternalStore(subscribeAppUpdate, getAppUpdateSnapshot, getServerAppUpdateSnapshot);

  if (!update.available) return null;

  return (
    <aside
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[var(--z-index-banner)] mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-lg border bg-card p-4 text-sm text-card-foreground shadow-lg"
    >
      <p className="min-w-0 flex-1">{t('appUpdate.message')}</p>
      <Button type="button" size="sm" onClick={() => window.location.reload()}>
        {t('appUpdate.reload')}
      </Button>
    </aside>
  );
}
