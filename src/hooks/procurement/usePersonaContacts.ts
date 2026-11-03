'use client';

/**
 * **Ενεργές επαφές με ρόλο (persona)** — η μία ζωντανή ανάγνωση για κάθε επιλογέα αντισυμβαλλομένου των προμηθειών:
 * προμηθευτής (PO, συμφωνία-πλαίσιο, υλικά — ADR-267) και υπεργολάβος (ADR-928 Φ3γ).
 *
 * 🔑 **Ένα ερώτημα `array-contains` ανά persona** — το ίδιο σχήμα που έτρεχε ήδη για τον προμηθευτή, άρα κανένας νέος
 *    δείκτης (CHECK 3.15). Πολλά personas ⇒ ένωση χωρίς διπλότυπα, με τη σειρά των personas.
 * 🔑 ADR-300: cache ανά persona σε επίπεδο αρχείου — επιβιώνει την πλοήγηση, μηδέν αναλαμπή στην επιστροφή.
 * 🔑 Auth-gated (το ίδιο μοτίβο με το `useFirestoreBuildings`): χωρίς χρήστη ⇒ `AUTH_REQUIRED`, καμία συνδρομή.
 * @module hooks/procurement/usePersonaContacts
 * @see ADR-214 — Contact Query Service
 */

import { useEffect, useMemo, useState } from 'react';
import { where } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import { createStaleCache, type StaleCache } from '@/lib/stale-cache';
import { createModuleLogger } from '@/lib/telemetry';
import { firestoreQueryService } from '@/services/firestore/firestore-query.service';
import type { Contact } from '@/types/contacts';
import type { PersonaType } from '@/types/contacts/personas';

const logger = createModuleLogger('usePersonaContacts');

/** Το κλειδί cache του προμηθευτή μένει το ιστορικό του, ώστε η μνήμη του PO να μη χαθεί με τη μετακόμιση. */
const CACHE_KEYS: Partial<Record<PersonaType, string>> = { supplier: 'po-supplier-contacts' };
const caches = new Map<PersonaType, StaleCache<Contact[]>>();

function cacheOf(persona: PersonaType): StaleCache<Contact[]> {
  const existing = caches.get(persona);
  if (existing) return existing;
  const created = createStaleCache<Contact[]>(CACHE_KEYS[persona] ?? `persona-contacts-${persona}`);
  caches.set(persona, created);
  return created;
}

export interface PersonaContacts {
  readonly contacts: Contact[];
  readonly loading: boolean;
  /** `AUTH_REQUIRED` · `SUBSCRIPTION_ERROR`. */
  readonly error: string | null;
}

const activeWith = (persona: PersonaType) => (contact: Contact): boolean =>
  Array.isArray(contact.personaTypes) && contact.personaTypes.includes(persona) && contact.status === 'active';

function subscribePersona(persona: PersonaType, onData: (contacts: Contact[]) => void, onError: () => void): () => void {
  return firestoreQueryService.subscribe<Record<string, unknown>>(
    'CONTACTS',
    (result) => {
      const contacts = result.documents.map((doc) => doc as unknown as Contact).filter(activeWith(persona));
      cacheOf(persona).set(contacts);
      onData(contacts);
      logger.info('Persona contacts loaded', { persona, count: contacts.length });
    },
    (err) => {
      logger.error('Persona contacts subscription error', { persona, error: err.message });
      onError();
    },
    { constraints: [where('personaTypes', 'array-contains', persona)] },
  );
}

type ByPersona = Partial<Record<PersonaType, Contact[]>>;

function seedOf(personas: readonly PersonaType[]): ByPersona {
  return Object.fromEntries(personas.flatMap((persona) => {
    const cached = cacheOf(persona).get();
    return cached ? [[persona, cached]] : [];
  }));
}

/** Ένωση χωρίς διπλότυπα (μία επαφή με δύο ρόλους φαίνεται μία φορά), με τη σειρά των personas. */
function unionOf(personas: readonly PersonaType[], byPersona: ByPersona): Contact[] {
  const seen = new Set<string>();
  return personas.flatMap((persona) => byPersona[persona] ?? []).filter((contact) => {
    const key = contact.id ?? '';
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** `personas`: σταθερός πίνακας (σε επίπεδο αρχείου) — αλλαγή του περιεχομένου ⇒ νέες συνδρομές. */
export function usePersonaContacts(personas: readonly PersonaType[]): PersonaContacts {
  const { user, loading: authLoading } = useAuth();
  const personaKey = personas.join(',');
  const [byPersona, setByPersona] = useState<ByPersona>(() => seedOf(personas));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (authLoading || !user) return undefined;
    const keys = personaKey.split(',') as PersonaType[];
    const unsubscribers = keys.map((persona) => subscribePersona(
      persona,
      (contacts) => { setByPersona((previous) => ({ ...previous, [persona]: contacts })); setFailed(false); },
      () => setFailed(true),
    ));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [authLoading, user, personaKey]);

  return useMemo(() => {
    const keys = personaKey.split(',') as PersonaType[];
    if (!authLoading && !user) return { contacts: [], loading: false, error: 'AUTH_REQUIRED' };
    const loading = !failed && keys.some((persona) => byPersona[persona] === undefined);
    return { contacts: unionOf(keys, byPersona), loading, error: failed ? 'SUBSCRIPTION_ERROR' : null };
  }, [personaKey, byPersona, failed, authLoading, user]);
}
