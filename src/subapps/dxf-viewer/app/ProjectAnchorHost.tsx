'use client';

/**
 * ADR-782 §21 — ο **καλών που έλειπε**: ο κύκλος ζωής της κατά προσέγγιση θέσης του έργου.
 *
 * ## Τι διόρθωσε
 * Ο γραφέας της άγκυρας υπήρχε, το store υπήρχε, η ένδειξη «κατά προσέγγιση» ζωγραφιζόταν —
 * και **κανείς δεν καλούσε ποτέ τον γραφέα** (επαληθευμένο με grep: μόνο tests). Δηλαδή ολόκληρο
 * το σκέλος `approximate` ήταν **δομικά ανενεργό**: μια κατάσταση που κανένα μονοπάτι δεν μπορούσε
 * να παραγάγει, με φρουρούς και οθόνες γραμμένες γι' αυτήν. Το αποθετήριο ονομάζει αυτό το σχήμα
 * «φρουρός χωρίς απόδειξη ζωής» (ADR-749 §5) — εδώ ήταν ολόκληρη λειτουργία.
 *
 * ## Γιατί ξεχωριστός host και όχι επέκταση του `GeoReferenceHost`
 * Οι δύο απαντούν **διαφορετικά ερωτήματα σε διαφορετικά δεδομένα**: εκείνος υδατώνει τη
 * **δηλωμένη** γεωαναφορά (`basePoint`/`northRotation`, νομικό παραδοτέο), αυτός την **εικασία**
 * από διεύθυνση, που δεν επιτρέπεται ποτέ να αγγίξει εκείνα τα πεδία. Ένας host με δύο ευθύνες θα
 * έκανε τη μία αποτυχία να παρασύρει την άλλη — ένα σφάλμα ανάγνωσης διευθύνσεων θα έσβηνε τη
 * γεωαναφορά, δηλαδή θα ξεκόλλαγε το τοπογραφικό από το κτίριο εξαιτίας μιας διεύθυνσης.
 *
 * ⚠️ **Καμία στάθμιση με τη γεωαναφορά εδώ.** Η άγκυρα δηλώνεται πάντα· η προτεραιότητα
 * («ακριβής ⟩ κατά προσέγγιση») ζει **ολόκληρη** στη `getBasemapAvailability`. Αν σταθμιζόταν και
 * εδώ, η ίδια απόφαση θα κρινόταν σε δύο σημεία και θα απέκλινε την πρώτη φορά που αλλάξει το ένα.
 *
 * ADR-040: μηδέν εγγραφές υψηλής συχνότητας — ένα `useEffect` ανά αλλαγή έργου (CHECK 6B/6C).
 *
 * @see ../systems/basemap/project-anchor-persistence.ts — η ανάγνωση
 * @see ../systems/basemap/project-anchor-resolution.ts — η κρίση (καθαρή)
 * @see ./GeoReferenceHost.tsx — ο δίδυμος για την **ακριβή** γεωαναφορά
 */

import * as React from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import { loadProjectAddresses } from '../systems/basemap/project-anchor-persistence';
import { resolveProjectAnchor } from '../systems/basemap/project-anchor-resolution';
import { setProjectAnchor } from '../systems/basemap/basemap-availability';

const logger = createModuleLogger('project-anchor-host');

export interface ProjectAnchorHostProps {
  readonly projectId: string | null | undefined;
}

export function ProjectAnchorHost({ projectId }: ProjectAnchorHostProps): React.ReactElement | null {
  React.useEffect(() => {
    if (!projectId) {
      setProjectAnchor(null);
      return;
    }

    let cancelled = false;
    // `null` όσο εκκρεμεί: «δεν ρωτήθηκε ακόμη» ≠ «ρωτήθηκε και δεν βρέθηκε». Χωρίς αυτό, η
    // προηγούμενη απάντηση θα επιβίωνε της αλλαγής έργου και ο χάρτης θα καθόταν στη **γειτονιά
    // του προηγούμενου έργου** — λάθος που μοιάζει απόλυτα σωστό στην οθόνη.
    setProjectAnchor(null);

    (async () => {
      try {
        const addresses = await loadProjectAddresses(projectId);
        if (!cancelled) setProjectAnchor(resolveProjectAnchor(addresses));
      } catch (error) {
        // Αποτυχία ανάγνωσης **δεν** είναι άρνηση: δεν μάθαμε τίποτα για τη διεύθυνση. Το `null`
        // το λέει αυτό· ένα `refused` θα ονόμαζε λόγο που δεν διαπιστώθηκε ποτέ.
        logger.error('Ανάγνωση διευθύνσεων έργου απέτυχε', {
          error: String(error),
          data: { projectId },
        });
        if (!cancelled) setProjectAnchor(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return null;
}
