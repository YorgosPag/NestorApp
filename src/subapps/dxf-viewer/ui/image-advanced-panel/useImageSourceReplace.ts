'use client';

/**
 * ADR-736 §6 — **αντικατάσταση της πηγής μιας επιλεγμένης εικόνας** (InDesign *Relink* /
 * Figma *Replace image* / AutoCAD *Change Path* / Revit *Manage Images*).
 *
 * ## Δύο είδη εικόνας, δύο σωστές απαντήσεις — και ο λόγος
 *
 * **1. Εικόνα με `externalRefId` (ήρθε από DXF).** Πηγαίνει από τον υπάρχοντα resolver:
 * `resolve([], overrides)` όπου `overrides = refId → αρχείο`. Το `overrides` **παρακάμπτει τη
 * σκάλα ταύτισης** — ο άνθρωπος αποφάσισε, ο αλγόριθμος δεν ξαναρωτά — και είναι, κυριολεκτικά,
 * ο μηχανισμός «αντικατάσταση εικόνας» που υπήρχε ήδη στο μητρώο ως «Στοχευμένος εντοπισμός».
 * Δεύτερη υλοποίηση εδώ θα ήταν διπλότυπο του ΕΝΟΣ σημείου εγγραφής (N.18).
 *
 * 🔴 **Ο σύνδεσμος ΔΕΝ κόβεται** και η αλλαγή πιάνει **ΟΛΕΣ** τις εμφανίσεις της αναφοράς
 * (Giorgio 2026-07-31 — σχέση N:1, βλ. `types/image.ts`). Είναι η συμπεριφορά του AutoCAD, όπου
 * το `IMAGEDEF` είναι κοινό: το ίδιο υπόβαθρο τοποθετημένο δύο φορές παραμένει **ένα** αρχείο.
 * Έτσι το σχέδιο συνεχίζει να ξέρει ότι αυτή η εικόνα «είναι» το `Z:\Jobs\…\1.jpg` — απλώς
 * δείχνει πλέον σε άλλο περιεχόμενο.
 *
 * ⚠️ Τα `intrinsicWidth/Height` **σκόπιμα δεν αγγίζονται** σε αυτό το μονοπάτι: για εισαγόμενη
 * εικόνα τα γέμισε ο `dxf-image-converter` από **το ίδιο το DXF**, άρα εκφράζουν γεωμετρία του
 * *σχεδίου*, όχι φυσικό μέγεθος του *αρχείου*. Ο AutoCAD ομοίως δεν αλλάζει το `IMAGE` entity
 * σε *Change Path*. Για γεωαναφερμένο υπόβαθρο αυτό είναι το σωστό: η «Επαναφορά Διαστάσεων»
 * οφείλει να επαναφέρει στο μέγεθος **που δηλώνει το σχέδιο**.
 *
 * **2. Εικόνα χωρίς `externalRefId`** (entourage, ή τοποθετημένη με την εντολή εισαγωγής).
 * Δεν υπάρχει αναφορά να ενημερωθεί — ανέβασμα + `UpdateEntityCommand` (undoable), και **εδώ**
 * τα intrinsic ενημερώνονται, γιατί εκεί εκφράζουν όντως το φυσικό μέγεθος του αρχείου.
 *
 * Και στις δύο περιπτώσεις **η γεωμετρία μένει** — βλ. `bim/image/image-source-attach.ts`.
 *
 * @see ../../hooks/useExternalReferenceResolution — resolve(files, overrides)
 * @see ../../io/user-image-asset — το ανέβασμα (thin adapter πάνω στο ΕΝΑ SSoT)
 * @see ../../bim/image/image-source-attach — τι αλλάζει, ως καθαρή γεωμετρία
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useCompanyId } from '@/hooks/useCompanyId';
import { useLevels } from '../../systems/levels';
import type { ImageEntity } from '../../types/image';
import { useEntityPatchCommand } from '../../hooks/commands/useEntityPatchCommand';
import { useExternalReferenceResolution } from '../../hooks/useExternalReferenceResolution';
import { uploadUserImageAsset } from '../../io/user-image-asset';
import { buildImageSourceSwapPatch } from '../../bim/image/image-source-attach';
import { dwarn } from '../../debug';

/** Ό,τι δέχεται ο επιλογέας: οι μορφές που ο `validateImageAssetFile` όντως ανεβάζει. */
export const IMAGE_REPLACE_ACCEPT = '.png,.jpg,.jpeg,.webp';

export interface ImageSourceReplace {
  /** `true` όσο τρέχει ανέβασμα/εγγραφή — το κουμπί κλειδώνει. */
  readonly isPending: boolean;
  /** `false` όταν λείπει η εταιρεία (χωρίς αυτήν δεν υπάρχει company-scoped Storage path). */
  readonly canReplace: boolean;
  /** Ο handler που δένει το component στο κρυφό `<input type="file">`. */
  readonly onFilePicked: (file: File) => Promise<void>;
}

export function useImageSourceReplace(image: ImageEntity | null): ImageSourceReplace {
  const companyId = useCompanyId()?.companyId;
  const levelManager = useLevels();
  const patchEntity = useEntityPatchCommand(levelManager);
  const { references, resolve } = useExternalReferenceResolution();
  const [isPending, setPending] = useState(false);

  /**
   * ⚠️ Η **τελευταία γνωστή** εικόνα σε ref, όχι στα deps του handler — ίδιο σκεπτικό με το
   * `sceneRef` του resolver: το ανέβασμα διαρκεί, και ο handler πρέπει να γράψει την οντότητα
   * όπως είναι **τη στιγμή της εγγραφής**, όχι όπως ήταν όταν πατήθηκε το κουμπί.
   */
  const imageRef = useRef(image);
  imageRef.current = image;

  /** Η αναφορά αυτής της εικόνας, αν προέρχεται από DXF. `null` = ελεύθερη εικόνα. */
  const referenceId = useMemo(() => {
    const refId = image?.externalRefId;
    if (!refId) return null;
    const key = refId.toUpperCase();
    // Ίδιο κλειδί ταύτισης με το `dxf-external-reference-apply`: τα DXF handles είναι
    // δεκαεξαδικά, άρα η πεζότητα δεν φέρει πληροφορία (μετατροπείς τρίτων δεν την εγγυώνται).
    return references.find((r) => r.sourceHandle?.toUpperCase() === key)?.id ?? null;
  }, [image?.externalRefId, references]);

  const onFilePicked = useCallback(
    async (file: File): Promise<void> => {
      const current = imageRef.current;
      if (!current || !companyId) return;

      setPending(true);
      try {
        if (referenceId) {
          // Μονοπάτι 1 — ρητή επιλογή του χρήστη πάνω στην υπάρχουσα αναφορά. Το `resolve`
          // ανεβάζει, γράφει `status:'resolved'` + `url` στην αναφορά, και περνά το αποτέλεσμα
          // στο ΕΝΑ σημείο εγγραφής (`applyExternalReferencesToEntities`) — μία εγγραφή στη
          // σκηνή, άρα κανένα ενδιάμεσο frame «η αναφορά βρέθηκε αλλά η εικόνα είναι πλαίσιο».
          await resolve([], new Map([[referenceId, file]]));
          return;
        }

        // Μονοπάτι 2 — ελεύθερη εικόνα: ανέβασμα + undoable patch. Καμία αναφορά δεν εμπλέκεται.
        const uploaded = await uploadUserImageAsset(file, companyId);
        const latest = imageRef.current;
        if (!latest) return;
        const patch = buildImageSourceSwapPatch(latest, {
          url: uploaded.url,
          pixelSize: uploaded.pixelSize,
          sourceName: uploaded.fileName,
        });
        if (patch) patchEntity(latest.id, patch, 'Replace image source');
      } catch (error) {
        // Ο χρήστης ξεκίνησε ρητά αυτή την ενέργεια: η αποτυχία δεν ρίχνει τον viewer, αλλά
        // ούτε καταπίνεται σιωπηλά — το `finally` ξεκλειδώνει το κουμπί ώστε να ξαναδοκιμάσει.
        dwarn('ImageSourceReplace', '⚠️ Η αντικατάσταση της εικόνας απέτυχε', error);
      } finally {
        setPending(false);
      }
    },
    [companyId, referenceId, resolve, patchEntity],
  );

  // Το `<input>` και το ref του ανήκουν στο **component** που τα αποδίδει, όχι σε αυτό το hook:
  // ένα hook που επιστρέφει DOM handle υποχρεώνει κάθε καταναλωτή να ξέρει ότι κάπου υπάρχει
  // input να δεθεί. Εδώ μένει μόνο η **απόφαση** (τι γίνεται με το αρχείο), που είναι και το
  // μόνο κομμάτι που αξίζει να δοκιμαστεί χωρίς DOM.
  return { isPending, canReplace: !!companyId && !!image, onFilePicked };
}
