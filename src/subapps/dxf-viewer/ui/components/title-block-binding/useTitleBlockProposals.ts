'use client';

/**
 * @fileoverview Η ζωντανή διαδρομή: σκηνή → Λ1 → στιγμιότυπο βάσης → Λ2 (ADR-745 Φ3β).
 *
 * 🔴 **Διαβάζει. Δεν γράφει — ποτέ, με κανέναν τρόπο.** Το `getAllContacts` είναι ανάγνωση, και
 * είναι η **μόνη** επαφή αυτού του hook με το Firestore. Η εγγραφή ζει αποκλειστικά πίσω από το
 * κουμπί έγκρισης· ένα `useEffect` που θα «προ-εφάρμοζε» μια βέβαιη πρόταση θα ήταν παραβίαση της
 * θεμελιώδους αρχής του ADR (§5.1) και το πιάνει ο κατάσκοπος εγγραφής, όχι αυτό το σχόλιο.
 *
 * @module subapps/dxf-viewer/ui/components/title-block-binding/useTitleBlockProposals
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAllContacts } from '@/services/contacts-query.service';
import { resolveContactDisplayName } from '@/services/contacts/ContactNameResolver';
import { readProjectSnapshot } from '@/services/title-block-apply/project-snapshot';
import { resolveTitleBlockProposals } from '@/lib/title-block/title-block-proposals';
import type { ContactSnapshotEntry } from '@/lib/title-block/resolve-people';
import type { BindingProposal } from '@/types/title-block-binding';
import {
  scanTitleBlockLayers,
  type TitleBlockLayerScan,
} from '../../../text-engine/title-block/reading/scene-title-block-cells';
import { useLevelScene } from '../../../systems/scene/useSceneSelectors';

/**
 * Ανώτατο πλήθος επαφών του στιγμιότυπου.
 *
 * ⚠️ Το `getAllContacts` **δεν έχει κανένα εξ ορισμού όριο**: χωρίς αυτό, μια ανάγνωση πινακίδας
 * θα κατέβαζε ολόκληρη τη συλλογή επαφών του μισθωτή. Το όριο **δηλώνεται** στο αποτέλεσμα
 * (`truncated`) ώστε ένα «δεν βρέθηκε» να μην μπορεί να σημαίνει σιωπηλά «δεν κοίταξα όλους».
 */
const CONTACT_SNAPSHOT_LIMIT = 1000;

export interface TitleBlockProposalsState {
  readonly loading: boolean;
  readonly scan: TitleBlockLayerScan | null;
  /** Το layer που εξετάζεται — ο πρώτος υποψήφιος, ή ό,τι διάλεξε ο άνθρωπος. */
  readonly selectedLayerId: string | null;
  readonly proposals: readonly BindingProposal[];
  /** Το στιγμιότυπο κόπηκε στο όριο ⇒ «δεν βρέθηκε» δεν είναι εξαντλητικό. */
  readonly truncated: boolean;
  readonly error: string | null;
}

/** `Contact` → η ελάχιστη προβολή που χρειάζεται το ταίριασμα. */
function toSnapshot(contact: { id: string }): ContactSnapshotEntry {
  const raw = contact as Record<string, unknown>;
  const phones = (raw.phones as { number?: string }[] | undefined) ?? [];
  const emails = (raw.emails as { email?: string }[] | undefined) ?? [];
  return {
    id: contact.id,
    displayName: resolveContactDisplayName(contact as never) ?? '',
    phones: phones.map((p) => p.number ?? '').filter(Boolean),
    emails: emails.map((e) => e.email ?? '').filter(Boolean),
  };
}

export interface UseTitleBlockProposalsParams {
  readonly levelId: string | null;
  readonly projectId?: string;
  /** Ζητείται μόνο όταν η παλέτα είναι ανοιχτή — κλειστή παλέτα δεν διαβάζει τη βάση. */
  readonly enabled: boolean;
}

export function useTitleBlockProposals(
  params: UseTitleBlockProposalsParams,
): TitleBlockProposalsState & {
  selectLayer: (layerId: string) => void;
  /** Ξαναδιαβάζει τις επαφές και **επαναϋπολογίζει** τις προτάσεις από τον ίδιο Λ2. */
  refresh: () => void;
} {
  const { levelId, projectId, enabled } = params;
  const scene = useLevelScene(levelId);

  const [contacts, setContacts] = useState<readonly ContactSnapshotEntry[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chosenLayerId, setChosenLayerId] = useState<string | null>(null);
  const requestSeq = useRef(0);

  /**
   * Ένας μετρητής που **ζητά** νέο στιγμιότυπο επαφών — δεν κρατά δεδομένα.
   *
   * 🔴 **Γιατί μετρητής και όχι «πρόσθεσε τη νέα επαφή στη λίστα».** Το ADR-759 §4.5 το λέει
   * ρητά: *«δεν μαντεύουμε το `contactId`, το ξαναπερνάμε από τον ίδιο Λ2. Ένα μονοπάτι, όχι
   * δύο.»* Σπρώχνοντας τη νεογέννητη επαφή απευθείας στο `contacts`, το ταίριασμα θα γινόταν
   * πάνω σε ό,τι **νομίζαμε** ότι γράψαμε — και το `name-exact` θα ήταν εγγυημένο **εξ
   * ορισμού**, δηλαδή θα έπαυε να αποδεικνύει οτιδήποτε. Έτσι, αν το όνομα αποθηκεύτηκε
   * διαφορετικά απ' ό,τι διαβάστηκε, η γραμμή **παραμένει** `no-match` και φαίνεται.
   */
  const [refreshSeq, setRefreshSeq] = useState(0);
  const refresh = useCallback(() => setRefreshSeq((n) => n + 1), []);

  /**
   * Έχει το έργο κύρια διεύθυνση; **`undefined` όσο δεν ξέρουμε — ποτέ `false` από άγνοια.**
   *
   * 🔴 Γεννά το `no-primary-address` **πριν** το κλικ (ADR-759 §4.4): ο φύλακας υπήρχε ήδη στο
   * `apply-project-value.ts:65`, αλλά μιλούσε **μετά**, όταν ο άνθρωπος είχε ήδη πατήσει
   * Έγκριση σε πρόταση που η εφαρμογή ήξερε ότι θα αποτύχει.
   *
   * ⚠️ **Το `catch` αφήνει `undefined`, δεν βάζει `false`.** Αποτυχία δικτύου θα βαφόταν
   * «το έργο δεν έχει διεύθυνση» — λάθος συμπέρασμα με σωστή μορφή, ακριβώς το σχήμα που το
   * παρακάτω `catch` των επαφών υπάρχει για να αποτρέψει (§9.5).
   *
   * 🔑 Ίδια διαδρομή ανάγνωσης με την **εγγραφή** (`readProjectSnapshot` → `GET /api/projects`,
   * ADR-742): δεύτερο direct Firestore read θα ήταν δεύτερο μοντέλο ασφαλείας για την ίδια
   * ερώτηση.
   */
  const [hasPrimaryAddress, setHasPrimaryAddress] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!enabled || !projectId) {
      setHasPrimaryAddress(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const snapshot = await readProjectSnapshot(projectId);
        if (!cancelled) setHasPrimaryAddress(snapshot.addresses.some((a) => a.isPrimary));
      } catch {
        if (!cancelled) setHasPrimaryAddress(undefined);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, projectId, refreshSeq]);

  useEffect(() => {
    if (!enabled) return;
    const seq = ++requestSeq.current;
    let cancelled = false;
    void (async () => {
      try {
        const result = await getAllContacts({ limitCount: CONTACT_SNAPSHOT_LIMIT });
        if (cancelled || seq !== requestSeq.current) return;
        setContacts(result.contacts.map(toSnapshot));
        setTruncated(result.contacts.length >= CONTACT_SNAPSHOT_LIMIT);
        setError(null);
      } catch (cause) {
        if (cancelled || seq !== requestSeq.current) return;
        // Η αποτυχία **μιλάει**: σιωπηλό `catch` εδώ θα εμφανιζόταν ως «δεν βρέθηκε καμία
        // επαφή» — δηλαδή λάθος συμπέρασμα με σωστή μορφή (ADR-745 §9.5, ίδιο σχήμα).
        setError(cause instanceof Error ? cause.message : String(cause));
        setContacts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [enabled, refreshSeq]);

  const scan = useMemo(() => {
    if (!enabled || !scene) return null;
    return scanTitleBlockLayers(scene.entities, scene.layersById);
  }, [enabled, scene]);

  const selectedLayerId = chosenLayerId ?? scan?.candidates[0]?.layerId ?? null;

  const proposals = useMemo(() => {
    if (!scan || !contacts || !levelId) return [];
    const layer = scan.candidates.find((c) => c.layerId === selectedLayerId);
    if (!layer) return [];
    return resolveTitleBlockProposals(layer.readings, {
      projectId,
      levelId,
      contacts,
      ...(hasPrimaryAddress !== undefined ? { hasPrimaryAddress } : {}),
    });
  }, [scan, contacts, levelId, projectId, selectedLayerId, hasPrimaryAddress]);

  return {
    loading: enabled && (contacts === null || scan === null),
    scan,
    selectedLayerId,
    proposals,
    truncated,
    error,
    selectLayer: setChosenLayerId,
    refresh,
  };
}
