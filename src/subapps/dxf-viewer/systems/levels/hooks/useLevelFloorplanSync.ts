'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n';
import { RealtimeService } from '@/services/realtime';
import type { FileTrashedPayload } from '@/services/realtime';
import type { Level } from '../config';
import { levelsThatLostTheirFloorplan } from '../level-floorplan-loss';
import { useFloorplanBackgroundStore } from '../../../floorplan-background/stores/floorplanBackgroundStore';

interface UseLevelFloorplanSyncParams {
  levels: Level[];
  clearLevelScene: (levelId: string) => void;
}

/**
 * Bidirectional sync: **απώλεια** κάτοψης → καθαρισμός καμβά.
 *
 * Ακούει το `FILE_TRASHED` του κεντρικού `RealtimeService`. Όταν μια κάτοψη σβήνεται
 * **εξωτερικά** (π.χ. από την καρτέλα Αρχείων του κτηρίου μέσω `EntityFilesManager`),
 * καθαρίζει τον αντίστοιχο καμβά αμέσως, χωρίς reload — DXF σκηνή **και** υπόβαθρο PDF.
 *
 * 🔴 ΤΙ **ΔΕΝ** ΕΙΝΑΙ ΑΠΩΛΕΙΑ (ADR-845 Ο-16): η **αντικατάσταση**. Η εισαγωγή νέας
 * κάτοψης τραβάει το προηγούμενο αρχείο στον κάδο — και το κάνει **αφού** έχει ήδη
 * γράψει τη νέα σκηνή (`commitImportedScene`: `setLevelScene` βήμα 2 →
 * `linkSceneFileToLevel` βήμα 5). Μέχρι τις 2026-09-09 αυτός ο συνδρομητής έσβηνε
 * εκείνη ακριβώς τη σκηνή, και ο `loadedSceneLevelsRef` του `useLevelSceneLoader` την
 * κρατούσε **κενή μέχρι το reload**: η κάτοψη ανέβαινε με μήνυμα επιτυχίας και δεν
 * φαινόταν ποτέ. Η κρίση ζει τώρα στο pure {@link didLevelLoseItsFloorplan}.
 *
 * 🔊 ΚΑΙ ΟΤΑΝ ΟΝΤΩΣ ΧΑΘΕΙ, ΤΟ ΛΕΜΕ. Ο σιωπηλός καθαρισμός έκανε το «διαγράφηκε» να
 * μοιάζει ίδιο με το «κενό επίπεδο» — η ίδια σύγχυση που κράτησε αυτό το ελάττωμα
 * κρυφό. Ονομασμένη άρνηση, ποτέ σιωπή.
 *
 * `removeBackground` είναι idempotent — ασφαλές όταν δεν υπάρχει υπόβαθρο.
 */
export function useLevelFloorplanSync({
  levels,
  clearLevelScene,
}: UseLevelFloorplanSyncParams): void {
  const { t } = useTranslation('dxf-viewer');
  const levelsRef = useRef<Level[]>(levels);
  levelsRef.current = levels;
  // Ο `t` αλλάζει ταυτότητα σε κάθε αλλαγή γλώσσας/namespace· η συνδρομή δεν πρέπει να
  // ξαναστήνεται γι' αυτό (θα έχανε γεγονότα στο παράθυρο του teardown).
  const translateRef = useRef(t);
  translateRef.current = t;

  useEffect(() => {
    const handleFileTrashed = (payload: FileTrashedPayload) => {
      // ΕΝΑ σώμα απόφασης, δύο εκτελεστές: αυτός ο hook και η άγκυρα.
      for (const level of levelsThatLostTheirFloorplan(levelsRef.current, payload)) {
        clearLevelScene(level.id);
        if (level.floorId) {
          useFloorplanBackgroundStore.getState().removeBackground(level.floorId).catch(() => undefined);
        }
        toast.warning(
          translateRef.current('scene.floorplanDeletedExternally', { level: level.name }),
        );
      }
    };

    const unsub = RealtimeService.subscribe('FILE_TRASHED', handleFileTrashed);
    return () => unsub();
  }, [clearLevelScene]);
}
