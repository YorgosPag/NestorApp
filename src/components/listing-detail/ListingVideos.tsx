'use client';

/**
 * @fileoverview **ΤΟ ΒΙΝΤΕΟ ΤΗΣ ΑΓΓΕΛΙΑΣ** — πέμπτο φύλλο του προβολέα, δίπλα στο μοντέλο (ADR-907 §10.6).
 * @related ADR-907 §10 · ADR-842 Α7 · ListingModels (το αδελφό προηγούμενο) · lib/listings/listing-video-keys
 * @module components/listing-detail/ListingVideos
 *
 * 🔑 **Οι αποφάσεις του `ListingModels` ισχύουν αυτούσιες**: ξεχωριστό φύλλο (το σχήμα το χώρισε — `videos[]`), καμία
 * αρίθμηση, και **καμία ονομασμένη απουσία** — το βίντεο είναι προαιρετικό, άρα η απουσία του σιωπά (η καρτέλα απλώς
 * δεν υπάρχει).
 *
 * ⚠️ **ΚΑΙ ΜΙΑ ΠΟΥ ΔΕΝ ΑΝΤΙΓΡΑΦΕΤΑΙ: ΚΑΜΙΑ ΓΡΑΜΜΗ «δηλωμένο / μετρημένο»** κάτω από το βίντεο. Στο μοντέλο η γραμμή
 * ξεχωρίζει δύο **υπαρκτούς** παραγωγούς (ψημένο από το BIM · ανεβασμένο από άνθρωπο). Το βίντεο έχει **έναν** — το
 * ανέβασε άνθρωπος — και αυτό το λέει ήδη η σημείωση «τίνος υλικό είναι». Τρία κλειδιά για μία τιμή θα ήταν υπόσχεση
 * χωρίς μηχανισμό (ADR-845 §7.3). Ο **κριτής** της προέλευσης μένει: μαντεμένο υλικό δεν φτάνει ποτέ στον αγοραστή.
 *
 * ⚠️ **Καμία επικεφαλίδα**: το φύλλο ζει **μόνο** μέσα σε καρτέλα του προβολέα, που λέει ήδη «Βίντεο». Η ενότητα κρατά
 * το `aria-label` της.
 */

import React from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { LISTING_VIDEO_NOTE_KEYS } from '@/lib/listings/listing-video-keys';
import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { PublicListing } from '@/types/public-listing';

import { ListingVideoStage } from './media/ListingVideoStage';

export function ListingVideos({ listing }: { readonly listing: PublicListing }) {
  const { t } = useTranslation(['listing-detail']);

  // Ο κριτής του ADR-842 Α7 — ο ίδιος που φυλά κατόψεις και μοντέλα, όχι ξαναγραμμένος.
  const shown = listing.videos.filter(isPubliclyPresentable);

  if (shown.length === 0) return null;

  return (
    <section aria-label={t('listing-detail:media.tabs.video')} className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {shown.map((video) => (
          <li key={video.value.url}>
            <ListingVideoStage video={video.value} alt={t(video.value.altKey)} />
          </li>
        ))}
      </ul>

      {/* 🔴 Η σημείωση του ΒΙΝΤΕΟ, ποτέ `sourceNote`/`modelNote` — ίδια ερώτηση, άλλο υποκείμενο (το μάθημα του Α17). */}
      <p className="text-xs text-muted-foreground">
        {t(LISTING_VIDEO_NOTE_KEYS[listing.authorship])}
      </p>
    </section>
  );
}
