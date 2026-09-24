'use client';

/**
 * @fileoverview **ΜΙΑ ΓΡΑΜΜΗ ΑΡΧΕΙΟΥ ΤΟΥ ΦΑΚΕΛΟΥ — και η δήλωση που το βγάζει στον κόσμο** (ADR-866 Φ1.3β).
 * @related ADR-866 §2.7.4 · §2.11 · services/property-dossier/dossier-media-publication
 * @module components/owner-property/form/OwnerPropertyDossierItem
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 ΔΥΟ ΑΠΟΦΑΣΕΙΣ ΛΙΓΟΤΕΡΕΣ ΑΠΟ ΤΟΝ ΑΔΕΛΦΟ ΤΗΣ — ΚΑΙ ΕΙΝΑΙ ΚΕΡΔΟΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η γραμμή του `media[]` ({@link OwnerPropertyMediaItem}) ρωτά *«είναι κάτοψη;»* και προσφέρει *«αφαίρεση»*.
 * Εδώ **καμία** από τις δύο δεν έχει νόημα, και η απουσία τους είναι **δομική**:
 *
 * · *«τι είναι;»* — το απάντησε **το κουμπί** που πάτησε ο άνθρωπος για να το ανεβάσει, και την ίδια απάντηση
 *   δίνει η σελίδα του φακέλου: `propertyDossierFileTabOf` πάνω στις **ίδιες** εμβέλειες. Ένα δεύτερο κουτάκι εδώ
 *   θα ήταν **δεύτερη αυθεντία** που μπορεί να διαφωνήσει με την καρτέλα όπου το βλέπει.
 * · *«αφαίρεση»* — τα αρχεία **ανήκουν στο σπίτι, όχι στην αγγελία** (Ε-1). Το ξε-διάλεγμα τα κάνει ιδιωτικά· η
 *   διαγραφή είναι πράξη του **φακέλου** (με κάδο και επαναφορά), όχι παρενέργεια μιας φόρμας που μπορεί να ακυρωθεί.
 *
 * ⚠️ **Καμία κρίση δεν γράφεται εδώ**: *«φεύγει;»* · *«ως τι;»* · *«είναι η πρώτη;»* τα απαντά ο **ίδιος** SSoT που
 * ρωτά ο γραφέας της βιτρίνας — αλλιώς η οθόνη θα μπορούσε να υπόσχεται κάτι που ο κόσμος δεν βλέπει ποτέ.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { PublishableDossierTab } from '@/services/property-dossier/dossier-media-publication';

const NS = 'property-market';
const K = `${NS}:offer.media`;

interface OwnerPropertyDossierItemProps {
  readonly fileId: string;
  readonly name: string;
  /** Σε ποια καρτέλα του φακέλου ζει — κρίση του SSoT (`propertyDossierFileTabOf`), ποτέ της κατηγορίας αρχείου. */
  readonly tab: PublishableDossierTab | null;
  readonly isLand: boolean;
  /**
   * **Μπορεί αυτό το αρχείο να φύγει;** — κρίση του **κοινού** κριτή (`dossierMediaMaterial`).
   *
   * 🔴 **Λέγεται, δεν κρύβεται**: ένα PDF ή DXF σχέδιο είναι απολύτως χρήσιμο **στον φάκελο** και απλώς δεν μπαίνει
   * σε `<img>`. Κρυμμένη γραμμή θα έκανε τον άνθρωπο να ψάχνει αρχείο που «χάθηκε»· κουτάκι που δεν κάνει τίποτα θα
   * ήταν χειρότερο — θα **υποσχόταν** δημοσίευση που δεν συμβαίνει.
   */
  readonly deliverable: boolean;
  readonly published: boolean;
  /** Είναι **η πρώτη που θα δει ο κόσμος**; Κρίση του SSoT, ποτέ «είναι η γραμμή 0;». */
  readonly isLead: boolean;
  /**
   * Μπορεί **ακόμη** να επιλεγεί; `false` όταν το ράφι γέμισε **και** αυτή είναι έξω.
   *
   * ⚠️ **Ποτέ δεν κλειδώνει το ΞΕ-διάλεγμα** — η αφαίρεση από τη δημοσίευση είναι επιστροφή στην ιδιωτικότητα.
   */
  readonly canPublish: boolean;
  readonly onTogglePublished: (fileId: string, published: boolean) => void;
  readonly onMakeFirst: (fileId: string) => void;
  /** 🎯 ADR-880 — το χειριστήριο σημείου εστίασης, όταν η γραμμή είναι φωτογραφία. */
  readonly focalPointSlot?: React.ReactNode;
}

export function OwnerPropertyDossierItem({
  fileId,
  name,
  tab,
  isLand,
  deliverable,
  published,
  isLead,
  canPublish,
  onTogglePublished,
  onMakeFirst,
  focalPointSlot,
}: OwnerPropertyDossierItemProps): React.ReactElement {
  const { t } = useTranslation([NS]);
  const checkboxId = React.useId();

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border py-2 text-sm text-foreground last:border-b-0">
      <span className="min-w-0 flex-1 truncate">{name}</span>

      {/*
        🔴 **Η ΕΠΙΛΟΓΗ ΓΙΝΕΤΑΙ ΠΡΙΝ ΤΟ `t()`, ΩΣ ΤΡΙΑΔΙΚΟ — ΠΟΤΕ ΚΛΗΣΗ ΜΕΣΑ ΤΟΥ** (ADR-744 · κανόνας της σκάλας).
        Το κλειδί ήταν γραμμένο σε συνάρτηση (`t(kindKey(tab, isLand))`), και ο γεννήτορας του shell slice **δεν
        μπορεί** να λύσει στατικά τι επιστρέφει μια κλήση: τρεις σελίδες βγήκαν «ΔΕΝ ΚΡΙΘΗΚΕ» και ο γεννήτορας
        **δεν έγραψε τίποτα**, μπλοκάροντας και άλλη συνεδρία. Η θεραπεία του ADR-834 §6.5.δ είναι «άσε την
        επιλογή **δεδομένο**» — ποτέ εξαίρεση στο `dynamicKeyPolicy`.

        🔑 Η **ίδια** διάκριση με τη σελίδα του φακέλου: σε γη η πρώτη καρτέλα λέγεται «Τοπογραφικό», σε κτίριο
        «Κάτοψη» (`floorplanTabKind`). Δύο ονόματα για **μία** καρτέλα — ποτέ δύο καρτέλες.
      */}
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        {t(
          tab === 'photos'
            ? `${K}.dossier.kindPhoto`
            : isLand
              ? `${K}.dossier.kindTopographic`
              : `${K}.dossier.kindFloorplan`,
        )}
      </span>

      {deliverable ? (
        <span className="flex items-center gap-1.5">
          <input
            id={checkboxId}
            type="checkbox"
            checked={published}
            disabled={!published && !canPublish}
            onChange={(event) => onTogglePublished(fileId, event.target.checked)}
            className="h-4 w-4 rounded border-border"
          />
          <label htmlFor={checkboxId} className="text-xs text-muted-foreground">
            {t(`${K}.publish`)}
          </label>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground">{t(`${K}.dossier.notDeliverable`)}</span>
      )}

      {/*
        🔑 **Η «πρώτη» είναι ΠΡΑΞΗ, όχι παραγόμενη από χρόνο** (ADR-841 §7 Α2.1 · Α6.2) — και εδώ η πράξη γράφει
        **τη σειρά της δήλωσης**, που είναι η ίδια σειρά που φτάνει στη βιτρίνα (§2.7.4). Καμία δεύτερη λίστα να
        μείνει πίσω: ό,τι βλέπει ο κάτοχος **είναι** ό,τι φεύγει.
      */}
      {focalPointSlot}

      {published && !isLead && (
        <button
          type="button"
          onClick={() => onMakeFirst(fileId)}
          className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground"
        >
          {t(`${K}.makeFirst`)}
        </button>
      )}

      {isLead && (
        <span className="rounded bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
          {t(`${K}.firstBadge`)}
        </span>
      )}
    </li>
  );
}
