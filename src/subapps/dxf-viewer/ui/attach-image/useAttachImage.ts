'use client';

/**
 * ADR-736 §6 — **η εντολή ΕΙΣΑΓΩΓΗΣ εικόνας**: τι γίνεται με το αρχείο που διάλεξε ο χρήστης
 * (AutoCAD `IMAGEATTACH` / Revit *Insert ▸ Image* / ArchiCAD *Place Picture*).
 *
 * Αδελφός του `useImageSourceReplace` — ίδιο σχήμα, άλλη ερώτηση: εκεί «αυτή η εικόνα δείχνει
 * πλέον αλλού», εδώ «μπαίνει μια εικόνα που δεν υπήρχε». Και οι δύο μοιράζονται **το ίδιο**
 * ανέβασμα (`uploadUserImageAsset`), γι' αυτό δεν υπάρχει δεύτερος validator, δεύτερο hash ή
 * δεύτερο Storage path (N.18).
 *
 * Το hook κρατά **μόνο την απόφαση**· το `<input type="file">` ανήκει στο component που το
 * αποδίδει (`AttachImageHost`) — ίδιο σκεπτικό με τον αδελφό του: ένα hook που επιστρέφει DOM
 * handle υποχρεώνει κάθε καταναλωτή να ξέρει ότι κάπου υπάρχει input να δεθεί.
 *
 * ## Η σειρά των βημάτων ΔΕΝ είναι αυθαίρετη
 *
 * Οι μετρήσεις της προβολής διαβάζονται **ΠΡΙΝ** το ανέβασμα. Το ανέβασμα διαρκεί (hash +
 * δίκτυο + αποκωδικοποίηση raster)· αν διαβάζαμε μετά, το μέγεθος θα κλείδωνε πάνω σε ένα
 * viewport που ο χρήστης μπορεί να έχει ήδη κάνει zoom — δηλαδή σε **κατάσταση που δεν είναι
 * αυτή που είδε όταν αποφάσισε**. «Το μέγεθος κλειδώνει τη στιγμή της επιλογής αρχείου» είναι
 * η απόφαση (Giorgio 2026-07-31)· αυτή η σειρά είναι που την υλοποιεί.
 *
 * @see ../../io/user-image-asset.ts — το ΕΝΑ ανέβασμα (validation + SHA-256 + idempotent)
 * @see ../../bim/image/image-source-attach.ts — `imagePlacementSizeMm` (οθόνη → mm)
 * @see ../../bim/image/attached-image-placement.ts — ο store που διαβάζει το tool
 * @see ../image-advanced-panel/useImageSourceReplace.ts — ο αδελφός (αντικατάσταση)
 */

import { useCallback, useState } from 'react';
import { useTranslation } from '@/i18n/hooks/useTranslation';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useNotifications } from '@/providers/NotificationProvider';
import { useLevels } from '../../systems/levels';
import { EventBus } from '../../systems/events/EventBus';
import { resolveSceneUnits } from '../../utils/scene-units';
import { uploadUserImageAsset } from '../../io/user-image-asset';
import { imagePlacementSizeMm } from '../../bim/image/image-source-attach';
import { attachedImageSelection } from '../../bim/image/attached-image-placement';
import { readViewportWorldMetrics } from '../../rendering/utils/viewport-world-metrics';
import { dwarn } from '../../debug';

/** Οι μορφές που ο `validateImageAssetFile` όντως ανεβάζει — ίδιος επιλογέας με την αντικατάσταση. */
export { IMAGE_REPLACE_ACCEPT as ATTACH_IMAGE_ACCEPT } from '../image-advanced-panel/useImageSourceReplace';

export interface AttachImage {
  /** `true` όσο τρέχει το ανέβασμα — το κουμπί κλειδώνει, ο επιλογέας δεν ξανανοίγει. */
  readonly isPending: boolean;
  /** Ο handler που δένει το component στο κρυφό `<input type="file">`. */
  readonly onFilePicked: (file: File) => Promise<void>;
}

export function useAttachImage(): AttachImage {
  const { t } = useTranslation('dxf-viewer-shell');
  const companyId = useCompanyId()?.companyId;
  const notifications = useNotifications();
  const levelManager = useLevels();
  const [isPending, setPending] = useState(false);

  const onFilePicked = useCallback(
    async (file: File): Promise<void> => {
      if (!companyId) {
        // Χωρίς εταιρεία δεν υπάρχει company-scoped Storage path — η εικόνα δεν έχει πού να
        // ζήσει. Ρητό μήνυμα, ποτέ σιωπηλή αποτυχία: ο χρήστης μόλις διάλεξε αρχείο.
        notifications.error(t('tools.attachImage.noCompany'));
        return;
      }
      // ΠΡΙΝ το ανέβασμα — βλ. κεφαλίδα. `null` = ο καμβάς δεν έχει διαστάσεις (δεν έχει
      // ανοίξει σχέδιο): ματαιώνουμε αντί να καρφώσουμε εικόνα άγνωστου μεγέθους.
      const metrics = readViewportWorldMetrics();
      if (!metrics) return;

      const levelId = levelManager.currentLevelId;
      const sceneUnits = levelId ? resolveSceneUnits(levelManager.getLevelScene(levelId)) : 'mm';

      setPending(true);
      try {
        const uploaded = await uploadUserImageAsset(file, companyId);
        const sizeMm = imagePlacementSizeMm(
          uploaded.pixelSize,
          metrics.visibleWorldWidth,
          sceneUnits,
        );
        if (!sizeMm) return;

        // Ταυτότητα = το content-addressed URL (βλ. `attached-image-placement.ts`).
        attachedImageSelection.set({
          id: uploaded.url,
          url: uploaded.url,
          sizeMm,
          sourceName: uploaded.fileName,
        });
        // Οπλίζει το εργαλείο μέσω του ΥΠΑΡΧΟΝΤΟΣ καναλιού (ίδιο με «AI Πινακίδα», ADR-651
        // Φάση Δ) — μηδέν νέος μηχανισμός ενεργοποίησης εργαλείου.
        EventBus.emit('level-panel:tool-change', 'attach-image');
      } catch (error) {
        dwarn('AttachImage', '⚠️ Η εισαγωγή της εικόνας απέτυχε', error);
        notifications.error(t('tools.attachImage.uploadFailed'));
      } finally {
        setPending(false);
      }
    },
    [companyId, levelManager, notifications, t],
  );

  return { isPending, onFilePicked };
}
