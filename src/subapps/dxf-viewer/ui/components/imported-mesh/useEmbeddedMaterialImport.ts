'use client';

/**
 * useEmbeddedMaterialImport — ADR-691. Η **μία** πράξη «τα υλικά του εισαγόμενου μοντέλου γίνονται
 * υλικά της βιβλιοθήκης», έτοιμη για κλήση από το dialog εισαγωγής.
 *
 * ## Τι κάνει (και τι ρητά ΔΕΝ κάνει)
 *
 * Διαβάζει τα embedded υλικά **από τον ίδιο τον container** του `.glb`/`.gltf` που μόλις αναλύθηκε
 * (αρχικά bytes υφών → σταθερό content-hash, βλ. ADR-691 §4.1 #2), τα προάγει σε πραγματικά
 * `bmat_*` και επιστρέφει `glTF material index → bmat_*`.
 *
 * ⚠️ **Δεν βάφει τίποτα.** Η γεωμετρία renderάρεται με τα δικά της embedded υλικά, αμετάβλητη
 * (ADR-691 §3.α: το `resolveSlotMaterial` θα αντικαθιστούσε ΟΛΟΚΛΗΡΟ το υλικό και η σύμβαση
 * world-meter UV της βιβλιοθήκης θα κατέστρεφε τα authored UVs του ξένου μοντέλου). Ο χάρτης
 * καταλήγει στο `params.embeddedMaterialIds` ως **καταγραφή χρήσης** — Revit «Imported Material».
 *
 * ## Γιατί hook και γιατί εδώ
 *
 * Το `useMaterialLibrary` ανοίγει live Firestore subscription. Ζώντας μέσα στο dialog (που
 * προσαρτάται μόνο όταν υπάρχουν κόμβοι προς εισαγωγή) δεν πληρώνεται τίποτα στη συνήθη ροή —
 * ίδιο σκεπτικό με τα hooks τοποθέτησης του `ImportedMeshImportDialog`.
 *
 * @see ../../../io/mesh3d-roundtrip/glb-embedded-materials — ο pure container reader
 * @see ../../../io/mesh3d-material-import/import-embedded-materials — ο DI orchestrator
 * @see ../../../io/mesh3d-material-import/foreign-texture-deps — η καλωδίωση των SSoT (N.18)
 * @see docs/centralized-systems/reference/adrs/ADR-691-imported-mesh-embedded-material-extraction.md
 */

import { useCallback, useMemo } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';
import { useMaterialLibrary } from '../../panels/materials/hooks/useMaterialLibrary';
import { readEmbeddedGltfMaterials } from '../../../io/mesh3d-roundtrip/glb-embedded-materials';
import {
  importEmbeddedMeshMaterials,
  type EmbeddedMaterialImportResult,
} from '../../../io/mesh3d-material-import/import-embedded-materials';
import { buildKnownMaterialResolver } from '../../../io/mesh3d-material-import/known-import-materials';
import { buildForeignTextureDeps } from '../../../io/mesh3d-material-import/foreign-texture-deps';

/** Τίποτα δεν έγινε — σταθερή ταυτότητα ώστε ο caller να μη διακρίνει «άκυρο» από «κενό». */
const NOTHING_IMPORTED: EmbeddedMaterialImportResult = {
  idByIndex: new Map<number, string>(),
  createdCount: 0,
  reusedCount: 0,
};

export interface EmbeddedMaterialImportRunner {
  /**
   * `false` όταν λείπει company/user scope (χωρίς αυτά δεν γράφεται υλικό ούτε ανεβαίνει υφή). Το UI
   * κρύβει τότε την επιλογή αντί να προσφέρει κουμπί που δεν μπορεί να τηρηθεί.
   */
  readonly available: boolean;
  /**
   * `data` = **τα ίδια bytes** που αναλύθηκαν (File για `.glb`/`.gltf`, ArrayBuffer για το `.dae`
   * που μετατράπηκε — ADR-690). `sourceLabel` = ανθρώπινη ρίζα ονόματος για τα **ανώνυμα** υλικά.
   * **Ποτέ δεν πετά:** αποτυχία εδώ δεν επιτρέπεται να ακυρώσει την εισαγωγή της γεωμετρίας.
   */
  readonly run: (
    data: ArrayBuffer | Blob,
    sourceLabel: string,
  ) => Promise<EmbeddedMaterialImportResult>;
}

/** Το όνομα αρχείου χωρίς κατάληξη — αυτό βλέπει ο χρήστης ως ρίζα των ανώνυμων υλικών. */
export function materialSourceLabel(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '') || fileName;
}

export function useEmbeddedMaterialImport(projectId: string | undefined): EmbeddedMaterialImportRunner {
  const { user } = useAuth();
  const companyId = user?.companyId ?? undefined;
  const { materials, save, update, remove } = useMaterialLibrary({
    companyId,
    userId: user?.uid ?? undefined,
    projectId,
  });

  const resolveKnownId = useMemo(() => buildKnownMaterialResolver(materials), [materials]);
  const deps = useMemo(
    () => (companyId ? buildForeignTextureDeps({ companyId, materials, save, update, remove }) : null),
    [companyId, materials, save, update, remove],
  );

  const run = useCallback(
    async (data: ArrayBuffer | Blob, sourceLabel: string): Promise<EmbeddedMaterialImportResult> => {
      if (!deps) return NOTHING_IMPORTED;
      try {
        const bytes = data instanceof Blob ? await data.arrayBuffer() : data;
        const embedded = readEmbeddedGltfMaterials(bytes);
        if (embedded.length === 0) return NOTHING_IMPORTED;
        return await importEmbeddedMeshMaterials({
          materials: embedded,
          sourceLabel,
          resolveKnownId,
          deps,
        });
      } catch (error) {
        // Η γεωμετρία είναι το κύριο παραδοτέο· ένα σπασμένο υλικό δεν ακυρώνει την εισαγωγή.
        console.error('[ADR-691] embedded material import failed:', error);
        return NOTHING_IMPORTED;
      }
    },
    [deps, resolveKnownId],
  );

  return { available: deps !== null, run };
}
