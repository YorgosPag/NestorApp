'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΗΣ ΣΕΙΡΑΣ** — τι βλέπει ο κόσμος, και με ποια σειρά (Α14.7).
 * @related ADR-841 §7 (Α14.7 · Α14.2 · Α2.1) · hooks/listings/useListingMediaOrder
 * @module components/listings/ListingMediaOrderPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ **ΞΕΧΩΡΙΣΤΟ ΠΑΝΕΛ** ΚΑΙ ΟΧΙ ΚΟΥΜΠΙ ΜΕΣΑ ΣΤΟΝ ΔΙΑΧΕΙΡΙΣΤΗ ΑΡΧΕΙΩΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο `EntityFilesManager` είναι **γενικός**: τον φοράνε επαφές, έργα, κτίρια, όροφοι. Η
 * ερώτηση *«ποια φωτογραφία είναι πρώτη **στην αγγελία**;»* έχει νόημα **μόνο** για
 * ακίνητο με δημόσια αγγελία. Ένα κουμπί εκεί μέσα θα δίδασκε λεξιλόγιο αγγελίας σε
 * κεντρικό εξάρτημα που δεν το χρειάζεται — και θα το φόραγαν, αόρατα, άλλες πέντε
 * οθόνες.
 *
 * 🔑 **Είναι αδελφός, όχι τροποποίηση**: κάθεται **δίπλα** στον διαχειριστή και ρωτά τη
 * δική του ερώτηση. Ο διαχειριστής απαντά *«ποια αρχεία υπάρχουν και ποια είναι
 * δημόσια;»* (η **εξουσιοδότηση** της Α14.2)· αυτό εδώ απαντά *«με ποια σειρά φεύγουν;»*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΠΡΑΞΗ ΕΙΝΑΙ **Η ΙΔΙΑ ΛΕΞΗ** ΜΕ ΤΟΥ ΙΔΙΩΤΗ — «να μπει πρώτη» (Α14.7.4)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `OwnerPropertyMediaItem` δίνει στον ιδιώτη **ένα** κουμπί, ορατό μόνο για
 * δημοσιευμένο αρχείο που **δεν** είναι ήδη πρώτο, και σήμα «1η» στο πρώτο.
 * ⛔ **Κανένα drag-and-drop εδώ**: θα ήταν **δεύτερο ιδίωμα σειράς** στο ίδιο προϊόν για
 * την ίδια ερώτηση. Επαναλαμβανόμενες «να μπει πρώτη» χτίζουν **οποιαδήποτε** σειρά.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { FileThumbnail } from '@/components/shared/files/FileThumbnail';
import { Button } from '@/components/ui/button';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { useListingMediaOrder } from '@/hooks/listings/useListingMediaOrder';

const NS = 'property-market';
const K = `${NS}:listing.mediaOrder`;

export interface ListingMediaOrderPanelProps {
  readonly propertyId: string;
  readonly companyId: string;
  /**
   * Η **αποθηκευμένη** δήλωση, ωμή από το έγγραφο του ακινήτου.
   *
   * ⚠️ **`unknown` και όχι `string[]`**: το `Property` του viewer είναι ωμό spread
   * εγγράφου Firestore· η **μία** ανάγνωση είναι το `declaredMediaOrder`, μέσα στο hook.
   */
  readonly storedOrder: unknown;
}

/**
 * **Τι βλέπει ο κόσμος, με ποια σειρά — και η πράξη που το αλλάζει.**
 *
 * ⚠️ **Ζωντανή συνδρομή** (`realtime`): η **συμμετοχή** αλλάζει από τον διαχειριστή από
 * πάνω *(κάποιος σημαίνει μια φωτογραφία «δημόσια»)*. Με εφάπαξ ανάγνωση, η οθόνη θα
 * έλεγε *«καμία φωτογραφία»* ακριβώς αφού ο άνθρωπος πρόσθεσε μία — δηλαδή θα φαινόταν
 * χαλασμένη τη στιγμή που δούλεψε.
 */
export function ListingMediaOrderPanel({
  propertyId,
  companyId,
  storedOrder,
}: ListingMediaOrderPanelProps) {
  const { t } = useTranslation([NS]);

  const { files } = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    companyId,
    category: FILE_CATEGORIES.PHOTOS,
    realtime: true,
  });

  const { items, saving, failed, makeFirst } = useListingMediaOrder(
    propertyId,
    files,
    storedOrder,
  );

  return (
    <section aria-labelledby="listing-media-order-title" className="mt-6 rounded-lg border border-border p-4">
      <header className="mb-3">
        <h3 id="listing-media-order-title" className="text-sm font-semibold text-foreground">
          {t(`${K}.title`)}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{t(`${K}.help`)}</p>
      </header>

      {/*
        ⚠️ **Το άδειο δεν είναι σφάλμα — είναι απάντηση, και λέει ΤΙ ΝΑ ΚΑΝΕΙ ο άνθρωπος.**
        Ο λόγος που δεν φεύγει καμία φωτογραφία είναι σχεδόν πάντα ο φρουρός #1 της Α14.2
        *(κανείς δεν τη σήμανε δημόσια)*, και αυτό δεν το μαντεύει κανείς κοιτάζοντας μια
        κενή λίστα.
      */}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t(`${K}.empty`)}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((file, index) => (
            <li key={file.id} className="flex items-center gap-3 rounded-md border border-border p-2">
              <FileThumbnail
                contentType={file.contentType}
                thumbnailUrl={file.thumbnailUrl}
                downloadUrl={file.downloadUrl}
                displayName={file.displayName}
                size="sm"
              />

              <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                {file.displayName}
              </span>

              {/*
                🔑 **Το σήμα «1η» και το κουμπί είναι ΑΜΟΙΒΑΙΑ ΑΠΟΚΛΕΙΟΜΕΝΑ**, ίδιο με του
                ιδιώτη: *«κάνε πρώτο κάτι που είναι ήδη πρώτο»* δεν σημαίνει τίποτα.
              */}
              {index === 0 ? (
                <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                  {t(`${K}.firstBadge`)}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => void makeFirst(file.id)}
                >
                  {t(`${K}.makeFirst`)}
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}

      {/*
        ⚠️ **Η αποτυχία λέγεται, δεν σιωπά** — η οθόνη έχει ήδη γυρίσει πίσω στη σειρά που
        πράγματι ισχύει, οπότε χωρίς αυτή τη γραμμή ο άνθρωπος θα έβλεπε το κλικ του να
        «μην κάνει τίποτα» και θα το ξαναπατούσε.
      */}
      {failed && (
        <p role="alert" className="mt-3 text-xs text-destructive">
          {t(`${K}.saveFailed`)}
        </p>
      )}
    </section>
  );
}
