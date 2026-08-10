'use client';

/**
 * ADR-782 §24 — ο κύκλος ζωής της **μόνιμης** χειροκίνητης τοποθέτησης υποβάθρου (αποδίδει `null`).
 *
 * ## Τι διόρθωσε
 * Η τοποθέτηση ζούσε **μόνο** σε runtime store: ο χρήστης κούμπωνε τον χάρτη κάτω από το σχέδιο
 * και τον έχανε στην πρώτη ανανέωση σελίδας. Ένα υπόβαθρο αναφοράς που το ξανατοποθετείς κάθε
 * φορά δεν είναι εργαλείο.
 *
 * ## Γιατί **τρίτος** host και όχι επέκταση των δύο υπαρχόντων
 * | host | ερώτημα | δεδομένα | γράφει; |
 * |---|---|---|---|
 * | `GeoReferenceHost` | πού είναι το έργο, **επίσημα** | `basePoint`/`northRotation` | όχι (γράφει το εργαλείο) |
 * | `ProjectAnchorHost` | τι λέει η **διεύθυνση** | `addresses` | **ποτέ** — γραμμένο συμβόλαιο |
 * | αυτός | πώς **τοποθέτησε ο χρήστης** τον χάρτη | `basemapPlacement` | **ναι** |
 *
 * Η τρίτη γραμμή είναι ο λόγος: το `project-anchor-persistence` δηλώνει στην επικεφαλίδα του
 * «καμία εγγραφή, ποτέ». Ένας γραφέας μέσα σε εκείνον τον host θα αντέφασκε σε γραπτό συμβόλαιο,
 * και η επόμενη αλλαγή θα το έβρισκε ως πρόταση σε σχόλιο αντί ως δομή.
 *
 * ## Ο ιδιοκτήτης του κύκλου ζωής είναι **ΕΝΑΣ** (N.7.2 #7)
 * Μέχρι το §23 η τοποθέτηση καθαριζόταν από τον `ProjectAnchorHost`. Με την υδάτωση να ζει εδώ,
 * δύο host θα έγραφαν στο ίδιο store σε **δύο** effects με την ίδια εξάρτηση — και η σειρά τους
 * θα ήταν η σειρά προσάρτησης, δηλαδή τύχη. Ο καθαρισμός **μετακόμισε** εδώ· δεν προστέθηκε
 * δεύτερος.
 *
 * ⚠️ **Ο γραφέας συνδέεται ΣΥΓΧΡΟΝΑ**, πριν από την ανάγνωση, και όχι αφού αυτή επιστρέψει: το
 * εργαλείο μπορεί να ξεκλειδώσει μόλις φτάσει η **άγκυρα**, που είναι άλλη ανάγνωση χωρίς
 * εγγυημένη σειρά. Ένας γραφέας που συνδεόταν στο τέλος θα άφηνε ένα παράθυρο όπου το σύρσιμο
 * φαίνεται να δουλεύει και **δεν αποθηκεύεται ποτέ**.
 *
 * ADR-040: μηδέν εγγραφές υψηλής συχνότητας — ένα `useEffect` ανά αλλαγή έργου (CHECK 6B/6C).
 *
 * @see ../systems/basemap/basemap-placement-persistence.ts — η ανάγνωση/εγγραφή
 * @see ../systems/basemap/basemap-placement-store.ts — οι τέσσερις πόρτες του store
 * @see ./ProjectAnchorHost.tsx — ο δίδυμος για την **κατά προσέγγιση** θέση
 */

import * as React from 'react';
import { createModuleLogger } from '@/lib/telemetry';
import {
  loadProjectBasemapPlacement,
  persistProjectBasemapPlacement,
} from '../systems/basemap/basemap-placement-persistence';
import {
  detachBasemapPlacement,
  hydrateBasemapPlacement,
  setBasemapPlacementPersister,
} from '../systems/basemap/basemap-placement-store';

const logger = createModuleLogger('basemap-placement-host');

export interface BasemapPlacementHostProps {
  readonly projectId: string | null | undefined;
}

export function BasemapPlacementHost({
  projectId,
}: BasemapPlacementHostProps): React.ReactElement | null {
  React.useEffect(() => {
    // Το προηγούμενο έργο φεύγει **μαζί με ό,τι δεν πρόλαβε να γραφτεί**: μια εκκρεμής
    // αποθήκευση που προσγειωνόταν τώρα θα έγραφε την τοποθέτηση του προηγούμενου σχεδίου.
    detachBasemapPlacement();

    if (!projectId) {
      setBasemapPlacementPersister(null);
      return;
    }

    setBasemapPlacementPersister((geo) => persistProjectBasemapPlacement(projectId, geo));

    let cancelled = false;
    (async () => {
      try {
        const placement = await loadProjectBasemapPlacement(projectId);
        if (!cancelled) hydrateBasemapPlacement(placement);
      } catch (error) {
        // Αποτυχία ανάγνωσης **δεν** είναι «δεν υπάρχει τοποθέτηση»: δεν μάθαμε τίποτα. Το store
        // μένει ως έχει (`null` από το detach) και ο χάρτης ακολουθεί τη διεύθυνση — ορατή,
        // δηλωμένη κατά προσέγγιση θέση, αντί για σιωπηλά λάθος τοποθετημένο υπόβαθρο.
        logger.error('Ανάγνωση τοποθέτησης υποβάθρου απέτυχε', {
          error: String(error),
          data: { projectId },
        });
      }
    })();

    return () => {
      cancelled = true;
      setBasemapPlacementPersister(null);
    };
  }, [projectId]);

  return null;
}
