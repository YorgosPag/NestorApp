'use client';

/**
 * @fileoverview **ΣΕ ΠΟΙΟ ΕΠΙΠΕΔΟ ΤΟΥ DXF VIEWER ΖΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΣΚΗΝΗΣ;** (ADR-400)
 * @related lib/dxf-viewer/dxf-viewer-routes · app/api/dxf-levels (η ΜΙΑ ανάγνωση) · components/shared/files/media/OpenInDxfViewerButton
 * @module hooks/useSceneFileLevelId
 *
 * 🔑 **Η σύνδεση υπάρχει ήδη στα δεδομένα**: κάθε επίπεδο κρατά `sceneFileId`. Εδώ διαβάζεται **ανάποδα** —
 * από το αρχείο προς το επίπεδο — ώστε η καρτέλα «Κάτοψη» ενός ακινήτου να ξέρει πού να στείλει τον άνθρωπο.
 *
 * 🔑 **Η ανάγνωση περνά από το υπάρχον `GET /api/dxf-levels`**, όχι από νέο ερώτημα πελάτη: έτσι (α) δεν γεννιέται
 * δεύτερος δρόμος προς τη συλλογή, (β) δεν χρειάζεται νέος δείκτης, και (γ) το **δικαίωμα** `dxf:layers:view` το κρίνει
 * ο διακομιστής — όποιος δεν επιτρέπεται να δει επίπεδα παίρνει 403 και το κουμπί απλώς **δεν υπάρχει**.
 *
 * ⚠️ **Μία ανάγνωση ανά χρήστη, όχι ανά αρχείο**: η λίστα μοιράζεται ανάμεσα σε όλα τα σημεία κλήσης. Η εναλλαγή
 * κάτοψης 1/2 → 2/2 δεν ξαναρωτά τον διακομιστή.
 *
 * ⚠️ **Άγνωστο ≠ «δεν υπάρχει»**: όσο η απάντηση εκκρεμεί η τιμή είναι `null`, όπως και όταν το αρχείο δεν έχει
 * επίπεδο. Ο καλών δείχνει κουμπί **μόνο** σε γνωστό επίπεδο — ποτέ κουμπί που οδηγεί σε λάθος ή άδεια σκηνή.
 */

import { useEffect, useState } from 'react';

import { useAuthOptional } from '@/auth/contexts/AuthContext';
import type { DxfLevelsListResponse } from '@/app/api/dxf-levels/dxf-levels.types';
import { API_ROUTES } from '@/config/domain-constants';
import { apiClient } from '@/lib/api/enterprise-api-client';

/** `sceneFileId → levelId` για τα επίπεδα που βλέπει ο χρήστης. */
type SceneFileLevels = ReadonlyMap<string, string>;

const NO_LEVELS: SceneFileLevels = new Map();

/** Η κοινή ανάγνωση, **ανά χρήστη**: άλλος χρήστης (ή άλλος χώρος) ⇒ άλλη λίστα, ποτέ η προηγούμενη. */
let shared: { readonly uid: string; readonly levels: Promise<SceneFileLevels> } | null = null;

async function fetchSceneFileLevels(): Promise<SceneFileLevels> {
  const response = await apiClient.get<DxfLevelsListResponse>(API_ROUTES.DXF_LEVELS.LIST);
  if (!response?.success) return NO_LEVELS;

  const bySceneFile = new Map<string, string>();
  for (const level of response.levels) {
    // Το πρώτο επίπεδο κερδίζει: η λίστα έρχεται ταξινομημένη κατά `order`, άρα η επιλογή είναι σταθερή.
    if (level.sceneFileId && !bySceneFile.has(level.sceneFileId)) bySceneFile.set(level.sceneFileId, level.id);
  }
  return bySceneFile;
}

function sceneFileLevelsFor(uid: string): Promise<SceneFileLevels> {
  if (shared?.uid !== uid) {
    // Αποτυχία (403 χωρίς δικαίωμα, δίκτυο) ⇒ «κανένα γνωστό επίπεδο»: το κουμπί σιωπά, η κάτοψη δουλεύει κανονικά.
    shared = { uid, levels: fetchSceneFileLevels().catch(() => NO_LEVELS) };
  }
  return shared.levels;
}

/** Το επίπεδο του viewer που δείχνει αυτό το αρχείο σκηνής — `null` όσο είναι άγνωστο ή όταν δεν υπάρχει. */
export function useSceneFileLevelId(fileId: string | null): string | null {
  // Προαιρετικό: η συλλογή κατόψεων ζει και σε δημόσιες σελίδες, όπου ο ανώνυμος επισκέπτης δεν ρωτά ποτέ.
  const uid = useAuthOptional()?.user?.uid ?? null;
  const [resolved, setResolved] = useState<{ readonly key: string; readonly levelId: string | null } | null>(null);
  const key = uid !== null && fileId !== null ? `${uid}:${fileId}` : null;

  useEffect(() => {
    if (uid === null || fileId === null || key === null) return;
    let cancelled = false;
    void sceneFileLevelsFor(uid).then((levels) => {
      if (!cancelled) setResolved({ key, levelId: levels.get(fileId) ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [uid, fileId, key]);

  // Απάντηση για **άλλο** αρχείο δεν είναι απάντηση: ανάμεσα σε δύο κατόψεις το κουμπί σβήνει, δεν δείχνει την παλιά.
  return resolved !== null && resolved.key === key ? resolved.levelId : null;
}
