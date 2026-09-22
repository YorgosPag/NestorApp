'use client';

/**
 * @fileoverview **Ο ΦΑΚΕΛΟΣ ΜΕΣΑ ΣΤΗ ΦΟΡΜΑ ΤΗΣ ΑΓΓΕΛΙΑΣ** — γέννηση στο πρώτο ανέβασμα, ζωντανή λίστα (ADR-866 Φ1.3β).
 * @related ADR-866 §2.11 (Δ1 · Δ4) · §2.10.8 Β5 · services/property-dossier/dossier-media-publication
 * @module hooks/owner-property/useOwnerPropertyDossierFiles
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Ο ΦΑΚΕΛΟΣ **ΕΙΝΑΙ** ΤΟ ΠΡΟΧΕΙΡΟ (§2.11.2 Δ1) — ΓΙ' ΑΥΤΟ ΔΕΝ ΥΠΑΡΧΟΥΝ ΟΡΦΑΝΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Airbnb («In progress»), Zillow Rental Manager (Drafts), Gmail (πρόχειρο με συνημμένα): το πρόχειρο είναι
 * **οντότητα διακομιστή με κάτοχο**. 🏆 **Παραπέρα**: εδώ η οντότητα **υπάρχει ήδη** — ο φάκελος του σπιτιού. Ο
 * άνθρωπος που εγκαταλείπει τη φόρμα **δεν χάνει** ό,τι ανέβασε: το βρίσκει στο «Οι φάκελοί μου», γιατί τα αρχεία
 * ανήκουν στο **σπίτι**, όχι στην αγγελία. **Μηδέν ορφανά, χωρίς εκκαθαριστή.**
 *
 * 🔑 **Η γέννηση είναι ΡΗΤΗ ΠΡΑΞΗ ΕΓΓΡΑΦΗΣ, ποτέ παρενέργεια ανάγνωσης** (N.7.2 #1): συμβαίνει όταν ο άνθρωπος
 * διαλέγει αρχείο, **όχι** όταν ανοίγει τη φόρμα. Μια φόρμα που άνοιξε και έκλεισε δεν αφήνει τίποτα πίσω της.
 *
 * ⚠️ **ΕΝΑ αίτημα γέννησης ανά ζωή του hook** (N.7.2 #3): το `POST /api/property-dossiers` είναι **ιδεμπότητο** —
 * η ταυτότητα **είναι** το κλειδί (§2.8.7 Δ4) — αλλά δέκα αρχεία δεν είναι λόγος για δέκα ταξίδια. Δύο γρήγορα
 * κλικ μοιράζονται **την ίδια** εκκρεμή υπόσχεση· αποτυχία **δεν** απομνημονεύεται (το επόμενο ανέβασμα ξαναρωτά).
 */

import React from 'react';

import { ENTITY_TYPES } from '@/config/domain-constants';
import { useEntityFiles } from '@/components/shared/files/hooks/useEntityFiles';
import { propertyDossierMediaBinding } from '@/components/space-management/shared/tabs/entity-media-binding';
import {
  mediaTabScopePolicy,
  mediaTabUploadDefaults,
} from '@/components/space-management/shared/tabs/media-tab-scope';
import { propertyDossierMediaTab } from '@/components/property-dossier/property-dossier-media';
import { resolveUploadScope, type FileScope } from '@/components/shared/files/utils/upload-scope';
import { createModuleLogger } from '@/lib/telemetry';
import { validateCustodyUploadAuth } from '@/services/filesystem/file-mutation-gateway';
import { uploadEntityFile } from '@/services/filesystem/upload-entity-file';
import { createPropertyDossierRequest } from '@/services/property-dossier/property-dossier.service';
import {
  PUBLISHABLE_TABS,
  type DossierMediaOwner,
  type PublishableDossierTab,
} from '@/services/property-dossier/dossier-media-publication';
import type { FileRecord } from '@/types/file-record';

const logger = createModuleLogger('useOwnerPropertyDossierFiles');

/**
 * Τι δείχνει η οθόνη όσο δουλεύει το ανέβασμα.
 *
 * ⚠️ **Καμία ποσοστιαία ένδειξη, και είναι δήλωση όχι παράλειψη**: ο κανονικός αγωγός ({@link uploadEntityFile})
 * δεν εκπέμπει πρόοδο. Ένα ψεύτικο ποσοστό θα ήταν χειρότερο από την απουσία του.
 */
export type DossierUploadState =
  | { readonly state: 'idle' }
  | { readonly state: 'uploading'; readonly fileName: string }
  | { readonly state: 'failed'; readonly fileName: string };

export interface OwnerPropertyDossierFiles {
  /**
   * Τα **ζωντανά** αρχεία του φακέλου στις καρτέλες που μπορούν να δημοσιευτούν — από **ακροατή**, ποτέ εφάπαξ.
   *
   * 🔑 **Ολόκληρο `FileRecord`, όχι το `DossierMediaCandidate`**: ο επιλογέας θέλει **λιγότερα** (γι' αυτό είναι
   * `Pick`), αλλά η οθόνη θέλει και το **όνομα** που βλέπει ο άνθρωπος. Στένεμα εδώ θα ανάγκαζε τον καλούντα σε
   * δεύτερη ανάγνωση για το ίδιο έγγραφο.
   */
  readonly files: readonly FileRecord[];
  readonly upload: DossierUploadState;
  /** Ανεβάζει **σειριακά** στην καρτέλα που ζήτησε ο άνθρωπος. Ποτέ δεν πετά — η αστοχία λέγεται στην οθόνη. */
  readonly uploadFiles: (chosen: readonly File[], tab: PublishableDossierTab) => Promise<void>;
}

/** Ο φάκελος όπως τον ξέρει η φόρμα τη στιγμή του ανεβάσματος — **όχι** στιγμιότυπο: ο τίτλος αλλάζει καθώς γράφει. */
export interface FormDossier extends DossierMediaOwner {
  /**
   * `true` όταν ο φάκελος **υπάρχει ήδη** στον διακομιστή (επεξεργασία αγγελίας που τον δηλώνει) ⇒ καμία γέννηση.
   * Στη δημιουργία είναι `false` **ακόμη κι αν** ο άνθρωπος είχε ανεβάσει πριν φύγει: το ιδεμπότητο `POST`
   * απαντά τον υπάρχοντα, και μια ψεύτικη «ξέρω ότι υπάρχει» θα ήταν μαντεψιά για την οποία κανείς δεν ρώτησε.
   */
  readonly existsOnServer: boolean;
}

/**
 * **Οι εμβέλειες που διαβάζει η φόρμα** = η ένωση των καρτελών που **μπορούν να δημοσιευτούν**.
 *
 * 🔑 Οι **ίδιες** που παράγει το κέλυφος για τη σελίδα του φακέλου (`mediaTabScopePolicy`) ⇒ ό,τι βλέπει ο άνθρωπος
 * εκεί, το βλέπει κι εδώ. Και επειδή δίνονται εμβέλειες, η λίστα είναι **ζωντανή** (`fileListIsLive`, §2.10.8 Β5):
 * το αρχείο εμφανίζεται μόνο του, χωρίς «Ανανέωση» και χωρίς την κούρσα του «γράφω και ξαναρωτώ».
 */
function publishableReadScopes(dossier: DossierMediaOwner): readonly FileScope[] {
  const binding = propertyDossierMediaBinding(dossier);
  return PUBLISHABLE_TABS.flatMap(
    (tab) => mediaTabScopePolicy(binding, propertyDossierMediaTab(tab, dossier.type))?.readScopes ?? [],
  );
}

/** **Πού γράφει** ένα ανέβασμα αυτής της καρτέλας — από τον **ίδιο** επιλυτή με το κέλυφος, ποτέ χειρόγραφο ζεύγος. */
function tabUploadScope(dossier: DossierMediaOwner, tab: PublishableDossierTab): FileScope {
  const binding = propertyDossierMediaBinding(dossier);
  // ⚠️ `null` τύπος εγγράφου: η φόρμα **δεν** ζητά από τον ιδιώτη να διαλέξει «Κάτοψη ορόφου» ή «Τομή» — το ποια
  //    καρτέλα πάτησε **είναι** η απάντηση (Α14: «δεν επιβάλλουμε στον χρήστη να γίνει ειδικός του κλάδου»).
  return resolveUploadScope(null, mediaTabUploadDefaults(binding, propertyDossierMediaTab(tab, dossier.type)));
}

export function useOwnerPropertyDossierFiles(dossier: FormDossier): OwnerPropertyDossierFiles {
  const [upload, setUpload] = React.useState<DossierUploadState>({ state: 'idle' });

  /**
   * ⚠️ **ΧΩΡΙΣ `useMemo`, ΕΠΙΤΗΔΕΣ.** Ο τίτλος αλλάζει σε κάθε πληκτρολόγηση, άρα αυτό ξαναχτίζεται συνεχώς — και
   * **δεν πειράζει**: το `useEntityFiles` περνά και τα δύο από τους σταθεροποιητές που φτιάχτηκαν γι' αυτόν ακριβώς
   * τον λόγο ({@link internFileScopes} · `useStableFileCustody`), οπότε **ίδιο περιεχόμενο ⇒ ίδιο αντικείμενο**.
   * Ένα δικό μας `useMemo` θα ήταν **δεύτερος** σταθεροποιητής, με δική του λίστα εξαρτήσεων να ξεχαστεί.
   */
  const { files } = useEntityFiles({
    entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
    entityId: dossier.id,
    custody: { userId: dossier.userId },
    scopes: publishableReadScopes(dossier),
    realtime: true,
  });

  /**
   * 🔴 **ΤΟ ΤΡΕΧΟΝ ΠΡΟΣΩΠΟ ΤΟΥ ΦΑΚΕΛΟΥ, ΔΙΑΒΑΣΜΕΝΟ ΤΗ ΣΤΙΓΜΗ ΤΗΣ ΠΡΑΞΗΣ** — όχι στιγμιότυπο στο κλείσιμο.
   *
   * Ο άνθρωπος γράφει τον τίτλο **ενώ** ανεβάζει. Ένα `label` παγωμένο στην απόδοση που έφτιαξε τον χειριστή θα
   * γεννούσε φάκελο με το όνομα που είχε η φόρμα **πριν δύο λέξεις** (ίδιο μάθημα με τα event-time reads του
   * ADR-040: getter, ποτέ snapshot).
   */
  const dossierRef = React.useRef(dossier);
  React.useEffect(() => {
    dossierRef.current = dossier;
  }, [dossier]);

  const bornRef = React.useRef(dossier.existsOnServer);
  const birthRef = React.useRef<Promise<boolean> | null>(null);

  const ensureDossier = React.useCallback(async (): Promise<boolean> => {
    if (bornRef.current) return true;
    const current = dossierRef.current;
    birthRef.current ??= createPropertyDossierRequest(current.id, {
      label: current.label,
      type: current.type,
    }).then((result) => result.kind === 'saved');

    const born = await birthRef.current;
    // ⚠️ Η **αποτυχία** δεν απομνημονεύεται: ο άνθρωπος που ξαναδοκιμάζει αξίζει καινούργια προσπάθεια, όχι το
    //    αποθηκευμένο «όχι» μιας στιγμής χωρίς δίκτυο.
    birthRef.current = null;
    bornRef.current = born;
    return born;
  }, []);

  const uploadFiles = React.useCallback(
    async (chosen: readonly File[], tab: PublishableDossierTab): Promise<void> => {
      // ⚠️ **Σειριακά, όχι `Promise.all`**: η κατάσταση ανεβάσματος είναι **μία** και δείχνει ένα όνομα αρχείου —
      //    ίδιο ιδίωμα με το `OwnerPropertyMediaField`, ώστε ο άνθρωπος να μη βλέπει ονόματα να πηδάνε.
      for (const file of chosen) {
        setUpload({ state: 'uploading', fileName: file.name });
        try {
          const custodyScope = { userId: dossierRef.current.userId } as const;
          // 🔑 **Ο ΕΝΑΣ κριτής «επιτρέπεται να ανεβάσεις εδώ;» για κάτοχο-άνθρωπο** (§5.2 σημείο 7) — ποτέ ο
          //    εταιρικός `validateUploadAuth`: ο ιδιώτης **δεν έχει** claim εταιρείας και δεν αποκτά.
          await validateCustodyUploadAuth(custodyScope);
          if (!(await ensureDossier())) throw new Error('DOSSIER_BIRTH_FAILED');

          const current = dossierRef.current;
          const scope = tabUploadScope(current, tab);
          await uploadEntityFile(
            {
              custody: custodyScope,
              entityType: ENTITY_TYPES.PROPERTY_DOSSIER,
              entityId: current.id,
              entityLabel: current.label,
              domain: scope.domain,
              category: scope.category,
              purpose: scope.purpose,
              createdBy: current.userId,
            },
            file,
          );
          setUpload({ state: 'idle' });
        } catch (cause) {
          logger.warn('Το αρχείο δεν ανέβηκε στον φάκελο', {
            dossierId: dossierRef.current.id,
            tab,
            error: cause instanceof Error ? cause.message : String(cause),
          });
          // ⚠️ **Σταματά στο πρώτο σφάλμα**: αν λείπει ο φάκελος ή το δικαίωμα, τα επόμενα αρχεία θα αποτύχουν
          //    **όλα** με το ίδιο αίτιο — και η οθόνη θα έδειχνε το τελευταίο όνομα αντί για το πρώτο πρόβλημα.
          setUpload({ state: 'failed', fileName: file.name });
          return;
        }
      }
    },
    [ensureDossier],
  );

  return { files, upload, uploadFiles };
}
