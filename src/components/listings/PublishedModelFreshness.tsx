'use client';

/**
 * @fileoverview 🏆 **Η ΜΙΑ ΕΝΔΕΙΞΗ ΠΑΛΑΙΟΤΗΤΑΣ** — δύο οθόνες, ένα κείμενο (ADR-845 Ο-25).
 * @related hooks/listings/usePublishedModelFreshness · lib/listings/model-source-revisions
 * @module components/listings/PublishedModelFreshness
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο κάτοχος κοίταξε τη **δική του** αγγελία, είδε παλιό μοντέλο, και **χρειάστηκε να ρωτήσει
 * άνθρωπο**. Το σύστημα ήξερε **και τους δύο** αριθμούς και δεν είπε κανέναν.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΕΝΑ ΣΩΜΑ, ΔΥΟ ΣΗΜΕΙΑ ΠΡΟΣΑΡΤΗΣΗΣ — απόφαση Giorgio
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ίδιο component μπαίνει **στον viewer** *(εκεί που γίνεται η δουλειά και εκεί που θα
 * ξαναδημοσιεύσει)* **και στην καρτέλα του ακινήτου** *(εκεί που βλέπει την αγγελία ως
 * σύνολο)*. Δύο διατυπώσεις της ίδιας ένδειξης θα ήταν δύο μηνύματα ελεύθερα να αποκλίνουν —
 * και ο άνθρωπος θα μάθαινε **άλλο πράγμα** ανάλογα με το πού κοίταξε.
 *
 * ⛔ **ΚΑΜΙΑ ΚΡΙΣΗ ΕΔΩ.** Το *«ισχύει;»* το απαντά το `modelFreshness` *(καθαρή συνάρτηση)*
 * και το φέρνει το `usePublishedModelFreshness`. Αυτό το αρχείο **διαλέγει λέξεις**.
 *
 * ⚠️ **ΔΕΝ φτάνει ΠΟΤΕ στον επισκέπτη.** Είναι εργαλείο **κηδεμονίας**: ο επισκέπτης βλέπει
 * ό,τι δημοσιεύτηκε — το αν άλλαξε το σχέδιο είναι δουλειά του κατόχου. Γι' αυτό το
 * namespace είναι **lazy** και **δεν** ζει στο κέλυφος *(το μάθημα του Ο-7)*.
 */

import * as React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { usePublishedModelFreshness } from '@/hooks/listings/usePublishedModelFreshness';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

export interface PublishedModelFreshnessProps {
  readonly propertyId: string | null | undefined;
  readonly companyId: string | null | undefined;
  /**
   * **Πόσο δυνατά μιλά** — και είναι η **μόνη** διαφορά ανάμεσα στις δύο οθόνες.
   *
   * - `'badge'`  — μία γραμμή, για λίστα ή πλάι σε κουμπί *(καρτέλα ακινήτου)*.
   * - `'alert'`  — ολόκληρη η εξήγηση + η πράξη *(viewer, όπου η διόρθωση είναι ΕΝΑ κλικ)*.
   *
   * 🔑 **Το κείμενο είναι το ΙΔΙΟ**· αλλάζει μόνο πόσο από αυτό δείχνεται. Δύο *component*
   * θα ήταν δύο κείμενα.
   */
  readonly tone?: 'badge' | 'alert';
  /** Τι κάνει το κουμπί της άρνησης — `undefined` ⇒ δεν δείχνεται (η καρτέλα δεν δημοσιεύει). */
  readonly onRepublish?: () => void;
}

/**
 * ⚠️ **Σιωπά όταν δεν έχει να πει κάτι**, και είναι απόφαση: `current` και `loading` **δεν**
 * παράγουν τίποτα στο `alert`. Μια ένδειξη «όλα καλά» που κάθεται μόνιμα πάνω από τον καμβά
 * είναι θόρυβος — και ο θόρυβος **σκοτώνει** την προσοχή ακριβώς τη μέρα που κάτι δεν πάει καλά.
 */
export function PublishedModelFreshness({
  propertyId,
  companyId,
  tone = 'badge',
  onRepublish,
}: PublishedModelFreshnessProps): React.JSX.Element | null {
  const { t } = useTranslation('model-freshness');
  const { models, loading, hasStale } = usePublishedModelFreshness(propertyId, companyId);

  if (loading || models.length === 0) return null;

  const changed = models.flatMap((model) =>
    model.freshness.state === 'stale' ? model.freshness.changed : [],
  );
  const unknown = models.some((model) => model.freshness.state === 'unknown');

  if (tone === 'alert') {
    // ⚠️ Το `alert` μιλά **μόνο** για το μπαγιάτικο: εκεί υπάρχει πράξη να προταθεί.
    if (!hasStale) return null;

    return (
      <Alert variant="destructive">
        <AlertTitle>{t('stale.title')}</AlertTitle>
        <AlertDescription>
          {t('stale.body', { count: changed.length })}
          {onRepublish !== undefined && (
            <button type="button" onClick={onRepublish} className="mt-2 block underline">
              {t('stale.action')}
            </button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // 🔑 **Η σειρά των κλάδων ΕΙΝΑΙ η ιεραρχία**: «μπαγιάτικο» υπερισχύει του «δεν ξέρω», και
  //    το «δεν ξέρω» του «ισχύει». Ο άνθρωπος πρέπει να μάθει πρώτα τη **χειρότερη** αλήθεια.
  if (hasStale) return <Badge variant="destructive">{t('stale.badge')}</Badge>;
  if (unknown) return <Badge variant="secondary">{t('unknown.badge')}</Badge>;

  return <Badge variant="outline">{t('current.badge')}</Badge>;
}
