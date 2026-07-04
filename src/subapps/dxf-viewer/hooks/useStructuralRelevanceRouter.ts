'use client';

/**
 * useStructuralRelevanceRouter — ADR-459 v19 (SINGLE-PATH structural relevance).
 *
 * **Η ΜΙΑ πηγή αλήθειας** για την ερώτηση «άλλαξε δομική γεωμετρία;». Τα δύο **generic**
 * geometry events (`bim:entities-moved` + `drawing:entity-created`) εκπέμπονται για **ΚΑΘΕ**
 * τύπο entity (γραμμή/διάσταση/έπιπλο/…). Αντί κάθε structural reactor να φιλτράρει μόνος του
 * (fragile — αρκεί ΕΝΑΣ να ξεχάσει τον gate και το bug επιστρέφει· ακριβώς αυτό συνέβη με τον
 * `useWallRetrimEffect` στο v17→v18), η σχετικότητα κρίνεται **ΕΔΩ, μία φορά**, και εκπέμπεται
 * το σημασιολογικό `bim:structural-geometry-changed` **μόνο** όταν ≥1 εμπλεκόμενο entity είναι
 * **δομικό μέλος** (SSoT `isStructuralMemberEntity`).
 *
 * Έτσι οι structural reactors (`useProactiveStructuralLoads` / `-OrganismReinforce` /
 * `-MemberSizing` / `useAutoFoundationDesign` / `useStructuralOrganism` / `useWallRetrimEffect`)
 * ακούν **ΑΥΤΟ** το event — **μηδέν** per-subscriber gate. Το generic `bim:entities-moved` μένει
 * για τους μη-δομικούς consumers (persistence, grips, render, column-adjacency-notification).
 *
 * **Γιατί router (re-emit) κι όχι emit-at-source:** το `bim:entities-moved` εκπέμπεται από
 * πολλά σημεία (`reconcileAssociativeGeometry`, `emitRestoredEntities`, envelope/attach commands).
 * Ένας router-subscriber είναι το **μοναδικό** chokepoint ανεξαρτήτως πόσοι το εκπέμπουν —
 * η προσέγγιση των μεγάλων παικτών (relevance κρίνεται σε ΕΝΑ σημείο, όχι από κάθε παραλήπτη).
 *
 * Mounted ΜΙΑ φορά από το viewer shell (δίπλα στο `useStructuralOrganism`).
 *
 * @see types/structural-entity-types.ts — isStructuralMemberEntity (SSoT predicate)
 * @see hooks/useGroupedStructuralReaction.ts — οι proactive reactors (ακούν το σημασιολογικό event)
 * @see docs/centralized-systems/reference/adrs/ADR-459-structural-organism-connectivity.md §v19
 */

import { useEffect } from 'react';
import { EventBus } from '../systems/events/EventBus';
import { isStructuralMemberEntity } from '../types/structural-entity-types';
import type { AnySceneEntity } from '../types/entities';

/** True αν το entity φέρει `type: string` (minimal shape guard για τα generic payloads). */
function hasType(value: unknown): value is AnySceneEntity {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string';
}

export function useStructuralRelevanceRouter(): void {
  useEffect(() => {
    // move → φίλτραρε τα δομικά μέλη του payload· εκπομπή μόνο αν υπάρχει ≥1.
    const offMoved = EventBus.on('bim:entities-moved', ({ movedEntities }) => {
      if (!Array.isArray(movedEntities)) return; // άγνωστο shape → no-op (defensive)
      const members = (movedEntities as ReadonlyArray<unknown>).filter(
        (e): e is AnySceneEntity => hasType(e) && isStructuralMemberEntity(e),
      );
      if (members.length > 0) {
        EventBus.emit('bim:structural-geometry-changed', { members, sourceEvent: 'bim:entities-moved' });
      }
    });
    // create → σημασιολογικό event μόνο αν το νέο entity είναι δομικό μέλος.
    const offCreated = EventBus.on('drawing:entity-created', ({ entity }) => {
      if (hasType(entity) && isStructuralMemberEntity(entity)) {
        EventBus.emit('bim:structural-geometry-changed', { members: [entity], sourceEvent: 'drawing:entity-created' });
      }
    });
    return () => {
      offMoved();
      offCreated();
    };
  }, []);
}
