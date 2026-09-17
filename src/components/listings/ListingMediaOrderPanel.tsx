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
import { Button } from '@/components/ui/button';
import { ENTITY_TYPES } from '@/config/domain-constants';
import { declaredFileIds } from '@/lib/listings/declared-file-ids';
import { useListingMediaOrder } from '@/hooks/listings/useListingMediaOrder';
import { companyReadCustodyOf } from '@/lib/files/file-custody';
import { ListingMaterialPanel, ListingMaterialRow } from './ListingMaterialPanel';

const NS = 'property-market';
const K = `${NS}:listing.mediaOrder`;

export interface ListingMediaOrderPanelProps {
  readonly propertyId: string;
  readonly companyId: string;
  /**
   * Η **αποθηκευμένη** δήλωση σειράς, ωμή από το έγγραφο του ακινήτου.
   *
   * ⚠️ **`unknown` και όχι `string[]`**: το `Property` του viewer είναι ωμό spread
   * εγγράφου Firestore· η **μία** ανάγνωση είναι το `declaredFileIds`, μέσα στο hook.
   */
  readonly storedOrder: unknown;
  /**
   * Οι **δηλωμένες κατόψεις** — ωμές, από το ίδιο έγγραφο (ADR-841 §7 Α17.7).
   *
   * 🔑 **Η οθόνη της σειράς ΔΕΝ τις αποφασίζει, αλλά ΟΦΕΙΛΕΙ να τις ξέρει**: μετά την
   * Α17.7 μια δηλωμένη κάτοψη **φεύγει** και **μετρά στο ίδιο, συνολικό όριο**. Μια οθόνη
   * που τις αγνοούσε θα έδειχνε άλλη σειρά και άλλο πλήθος από τον κόσμο — ακριβώς το
   * κενό «οθόνη ⇄ ράφι» που αυτή η οικογένεια αρχείων υπάρχει για να κλείσει.
   */
  readonly storedFloorplans: unknown;
}

/**
 * **Τι βλέπει ο κόσμος, με ποια σειρά — και η πράξη που το αλλάζει.**
 *
 * ⚠️ **Ζωντανή συνδρομή** (`realtime`): η **συμμετοχή** αλλάζει από τον διαχειριστή από
 * πάνω *(κάποιος σημαίνει μια φωτογραφία «δημόσια»)*. Με εφάπαξ ανάγνωση, η οθόνη θα
 * έλεγε *«καμία φωτογραφία»* ακριβώς αφού ο άνθρωπος πρόσθεσε μία — δηλαδή θα φαινόταν
 * χαλασμένη τη στιγμή που δούλεψε.
 *
 * ⚠️ **ΧΩΡΙΣ φίλτρο κατηγορίας**: μετά την Α17.7 στο ράφι φεύγουν **δύο** κάδοι, και ο
 * κανόνας τους κόβει στο **ίδιο** όριο. Ένα `category: 'photos'` εδώ θα έκρυβε τις
 * δηλωμένες κατόψεις από τη σειρά — δηλαδή θα ξανάνοιγε το κενό «οθόνη ⇄ ράφι» από την
 * πίσω πόρτα.
 */
export function ListingMediaOrderPanel({
  propertyId,
  companyId,
  storedOrder,
  storedFloorplans,
}: ListingMediaOrderPanelProps) {
  const { t } = useTranslation([NS]);

  const { files } = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    custody: companyReadCustodyOf(companyId),
    realtime: true,
  });

  const floorplans = React.useMemo(
    () => declaredFileIds(storedFloorplans),
    [storedFloorplans],
  );

  const { items, saving, failed, makeFirst } = useListingMediaOrder(
    propertyId,
    files,
    storedOrder,
    floorplans,
  );

  return (
    <ListingMaterialPanel
      titleId="listing-media-order-title"
      title={t(`${K}.title`)}
      help={t(`${K}.help`)}
      empty={t(`${K}.empty`)}
      failure={failed ? t(`${K}.saveFailed`) : null}
      isEmpty={items.length === 0}
    >
      <ol className="flex flex-col gap-2">
        {items.map((file, index) => (
          <ListingMaterialRow
            key={file.id}
            contentType={file.contentType}
            thumbnailUrl={file.thumbnailUrl}
            downloadUrl={file.downloadUrl}
            displayName={file.displayName}
          >
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
          </ListingMaterialRow>
        ))}
      </ol>
    </ListingMaterialPanel>
  );
}
