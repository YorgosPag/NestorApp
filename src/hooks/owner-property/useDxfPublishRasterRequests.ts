'use client';

/**
 * @fileoverview **Ζητά την εικόνα δημοσίευσης για κάθε DXF του φακέλου που δεν την έχει** (ADR-922).
 * @module hooks/owner-property/useDxfPublishRasterRequests
 *
 * 🔑 **Αμέσως μετά το ανέβασμα, χωρίς κανένα κλικ**: η ζωντανή λίστα φέρνει το νέο DXF ⇒ αυτός ο hook το βλέπει
 * χωρίς έκβαση ⇒ ζητά. Το ίδιο πιάνει και DXF που ανέβηκε **αλλού** (σελίδα του φακέλου) πριν ανοίξει η φόρμα —
 * το πρότυπο «ζήτα ⇒ φτιάχνεται» των Box Representations, χωρίς δεύτερο trigger στο Storage.
 *
 * ⚠️ **Μία αίτηση ανά αρχείο ανά ζωή της φόρμας** (N.7.2 #3): ο διακομιστής είναι ιδεμπότητος, αλλά κάθε απόδοση
 * σέρνει bytes και CPU. Η έκβαση γυρίζει από τον ακροατή· όσο λείπει, η οθόνη λέει «Ετοιμάζεται…».
 */

import React from 'react';

import { needsDxfPublishRaster } from '@/services/floorplans/dxf-publish-raster';
import { requestDxfPublishRaster } from '@/services/filesystem/dxf-publish-raster.client';
import { FILE_STATUS } from '@/config/domain-constants';
import type { FileRecord } from '@/types/file-record';

/** Ό,τι χρειάζεται η απόφαση από ένα αρχείο. */
type RasterRequestCandidate = Pick<FileRecord, 'id' | 'ext' | 'status' | 'storagePath' | 'publishRaster'>;

export function useDxfPublishRasterRequests(files: readonly RasterRequestCandidate[]): void {
  const requested = React.useRef(new Set<string>());

  React.useEffect(() => {
    for (const file of files) {
      if (file.status !== FILE_STATUS.READY || !needsDxfPublishRaster(file)) continue;
      if (requested.current.has(file.id)) continue;
      requested.current.add(file.id);
      // Ο φάκελος είναι **πάντα** προσωπικό διαμέρισμα (ADR-866 §5.2) — το είδος ταξιδεύει, ποτέ ο κάτοχος.
      void requestDxfPublishRaster(file.id, 'personal');
    }
  }, [files]);
}
