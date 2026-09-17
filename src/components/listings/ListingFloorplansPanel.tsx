'use client';

/**
 * @fileoverview **Η ΟΘΟΝΗ ΤΩΝ ΚΑΤΟΨΕΩΝ** — ποια σχέδια φεύγουν στην αγγελία (Α17.7).
 * @related ADR-841 §7 (Α17.7 · Α17.4 · Α14.2) · hooks/listings/useListingFloorplans
 * @module components/listings/ListingFloorplansPanel
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔑 Η ΠΡΑΞΗ ΕΙΝΑΙ **Η ΙΔΙΑ ΧΕΙΡΟΝΟΜΙΑ ΜΕ ΤΟΥ ΙΔΙΩΤΗ** — ένα πλαίσιο ελέγχου
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο ιδιώτης δηλώνει κάτοψη με **checkbox** *«Είναι κάτοψη»* δίπλα στο *«Δημοσίευση»*
 * (`OwnerPropertyMediaItem`). Το γραφείο παίρνει **την ίδια** χειρονομία, με τη διαφορά
 * που ονομάζει η **Α17.7.4**: εκεί το αρχείο **ανήκει** στην αγγελία *(ζει στον πίνακά
 * της)*, εδώ **δεν ανήκει** *(ζει στη `files` της εταιρείας και μπορεί να είναι
 * `linkedTo` αλλού)* — γι' αυτό η δήλωση ζει στο **έγγραφο της αγγελίας**.
 *
 * ⛔ **ΚΑΝΕΝΑ Radix `Select`, κανένα dropdown**: η ερώτηση είναι **ναι/όχι** ανά αρχείο,
 * και μια λίστα θα ζητούσε **δύο** κλικ για ένα ναι/όχι — το ίδιο σκεπτικό που είναι ήδη
 * γραμμένο στο `OwnerPropertyMediaItem`.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΔΕΙΧΝΕΙ **ΟΛΕΣ** ΤΙΣ ΚΑΤΟΨΕΙΣ, ΚΑΙ ΛΕΕΙ ΠΟΙΕΣ **ΔΕΝ** ΦΕΥΓΟΥΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η δήλωση **δεν αρκεί**: χρειάζεται και `classification: 'public'` **και**
 * αποκωδικοποιήσιμη εικόνα *(τα DXF δεν μπαίνουν σε `<img>`)*. Μια οθόνη που έδειχνε μόνο
 * τις δημοσιεύσιμες θα ζητούσε πράξη για αρχεία **που δεν εμφανίζει**· μια οθόνη που
 * έδειχνε όλες **χωρίς να λέει ποιες κόβονται** θα υποσχόταν δημοσίευση που δεν γίνεται.
 * ⇒ Δείχνει **όλες**, με ρητή σήμανση *«δηλωμένη, αλλά δεν φεύγει»*.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { ENTITY_TYPES, FILE_CATEGORIES } from '@/config/domain-constants';
import { useListingFloorplans } from '@/hooks/listings/useListingFloorplans';
import { companyReadCustodyOf } from '@/lib/files/file-custody';
import { ListingMaterialPanel, ListingMaterialRow } from './ListingMaterialPanel';

const NS = 'property-market';
const K = `${NS}:listing.floorplans`;

export interface ListingFloorplansPanelProps {
  readonly propertyId: string;
  readonly companyId: string;
  /** Η **αποθηκευμένη** δήλωση, ωμή από το έγγραφο του ακινήτου. */
  readonly storedFloorplans: unknown;
}

/**
 * **Ποιες κατόψεις φεύγουν στη δημόσια αγγελία — και ποιες όχι, με τον λόγο τους.**
 *
 * ⚠️ **Ζωντανή συνδρομή** για τον ίδιο λόγο με την αδελφή οθόνη: η ταξινόμηση
 * `public` γίνεται στον διαχειριστή αρχείων από πάνω, και η γραμμή εδώ οφείλει να το
 * μάθει **χωρίς ανανέωση σελίδας** — αλλιώς ο άνθρωπος θα έβλεπε *«δεν φεύγει»* αμέσως
 * αφού το διόρθωσε.
 *
 * ⚠️ **Φιλτράρει σε `floorplans`, και είναι σωστό εδώ**: αυτή η οθόνη ρωτά **μόνο** για
 * κατόψεις. *(Η αδελφή της, που δείχνει τη **σειρά του ραφιού**, δεν φιλτράρει — εκεί το
 * φίλτρο θα έκρυβε δηλωμένες κατόψεις από τη σειρά.)*
 */
export function ListingFloorplansPanel({
  propertyId,
  companyId,
  storedFloorplans,
}: ListingFloorplansPanelProps) {
  const { t } = useTranslation([NS]);

  const { files } = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY,
    entityId: propertyId,
    custody: companyReadCustodyOf(companyId),
    category: FILE_CATEGORIES.FLOORPLANS,
    realtime: true,
  });

  const { rows, saving, failed, toggle } = useListingFloorplans(
    propertyId,
    files,
    storedFloorplans,
  );

  return (
    <ListingMaterialPanel
      titleId="listing-floorplans-title"
      title={t(`${K}.title`)}
      help={t(`${K}.help`)}
      empty={t(`${K}.empty`)}
      failure={failed ? t(`${K}.saveFailed`) : null}
      isEmpty={rows.length === 0}
    >
      <ul className="flex flex-col gap-2">
        {rows.map(({ file, declared, published }) => (
          <ListingMaterialRow
            key={file.id}
            contentType={file.contentType}
            thumbnailUrl={file.thumbnailUrl}
            downloadUrl={file.downloadUrl}
            displayName={file.displayName}
          >
            {/*
              ⚠️ **Η σήμανση «δεν φεύγει» εμφανίζεται ΜΟΝΟ όταν ο άνθρωπος έχει δηλώσει**:
              σε αδήλωτο αρχείο το «δεν φεύγει» είναι προφανές και θα ήταν θόρυβος. Σε
              **δηλωμένο** είναι η μόνη εξήγηση για το γιατί η πράξη του δεν φάνηκε.
            */}
            {declared && !published && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {t(`${K}.blocked`)}
              </span>
            )}

            <span className="flex items-center gap-1.5">
              <input
                id={`listing-floorplan-${file.id}`}
                type="checkbox"
                checked={declared}
                disabled={saving}
                onChange={() => void toggle(file.id)}
                className="h-4 w-4 rounded border-border"
              />
              <label
                htmlFor={`listing-floorplan-${file.id}`}
                className="text-xs text-muted-foreground"
              >
                {t(`${K}.declare`)}
              </label>
            </span>
          </ListingMaterialRow>
        ))}
      </ul>
    </ListingMaterialPanel>
  );
}
