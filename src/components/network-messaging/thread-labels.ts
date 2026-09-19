'use client';

/**
 * @fileoverview **ΠΩΣ ΛΕΓΕΤΑΙ ΚΑΘΕ ΠΡΟΣΩΠΟ ΣΤΗΝ ΟΘΟΝΗ ΤΟΥ ΝΗΜΑΤΟΣ** — ένας τόπος, για λίστα, μηνύματα, λωρίδα.
 * @related ADR-867 Β7 · §8 #8 · `types/network-wire.ts` (`NetworkPerson`)
 * @module components/network-messaging/thread-labels
 *
 * 🔑 Όνομα από την ταυτότητα προσώπου (ADR-798) · αλλιώς ο **ρόλος** («Μέλος του γραφείου») · **ποτέ** `uid`
 * (το μάθημα του ADR-841 Α18.13: ένα UUID σε άνθρωπο). Ο θεατής λέγεται «Εσείς».
 * ⚠️ Τρεις επιφάνειες (λίστα · φούσκα · λωρίδα απουσίας) που ονόμαζαν μόνες τους θα απέκλιναν: η μία θα
 * έδειχνε όνομα, η άλλη ρόλο, για τον ίδιο άνθρωπο.
 */

import { useCallback, useMemo } from 'react';

import { useTranslation } from '@/i18n/hooks/useTranslation';
import type { NetworkAudienceEntry, NetworkAudienceRole } from '@/types/network-thread';
import type { NetworkPeopleResult, NetworkPerson } from '@/types/network-wire';

import { FALLBACK_NAME_KEYS, MESSAGE_KEYS, NETWORK_NS } from './network-messaging-keys';

export interface PersonLabeler {
  /** Το όνομα που τυπώνεται — «Εσείς» για τον θεατή. */
  readonly nameOf: (uid: string) => string;
  readonly photoOf: (uid: string) => string | null;
  readonly roleOf: (uid: string) => NetworkAudienceRole | null;
}

/** Ο ονοματοδότης του νήματος — ονόματα από τη διαδρομή `…/people`, ρόλοι από το ζωντανό ακροατήριο. */
export function usePersonLabeler(
  people: NetworkPeopleResult | null,
  audience: readonly NetworkAudienceEntry[] | null,
  viewerUid: string | null,
): PersonLabeler {
  const { t } = useTranslation([NETWORK_NS]);
  const byUid = useMemo(
    () => new Map<string, NetworkPerson>((people?.people ?? []).map((person) => [person.uid, person])),
    [people],
  );
  const roles = useMemo(
    () => new Map<string, NetworkAudienceRole>((audience ?? []).map((entry) => [entry.uid, entry.role])),
    [audience],
  );

  const roleOf = useCallback((uid: string) => roles.get(uid) ?? null, [roles]);
  const nameOf = useCallback(
    (uid: string) => {
      if (uid === viewerUid) return t(MESSAGE_KEYS.you);
      const name = byUid.get(uid)?.name ?? null;
      if (name !== null) return name;
      return t(FALLBACK_NAME_KEYS[roles.get(uid) ?? 'person']);
    },
    [byUid, roles, t, viewerUid],
  );
  const photoOf = useCallback((uid: string) => byUid.get(uid)?.photoUrl ?? null, [byUid]);

  return { nameOf, photoOf, roleOf };
}

/** Τα αρχικά για avatar χωρίς φωτογραφία — από το **τυπωμένο** όνομα, ώστε να συμφωνούν. */
export function initialsOf(label: string): string {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? [parts[0]?.[0], parts[parts.length - 1]?.[0]] : [parts[0]?.[0]];
  return letters.filter(Boolean).join('').toUpperCase();
}
