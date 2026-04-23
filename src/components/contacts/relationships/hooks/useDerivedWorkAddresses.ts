'use client';

import { useEffect, useState } from 'react';
import { ContactRelationshipService } from '@/services/contact-relationships/ContactRelationshipService';
import { ContactsService } from '@/services/contacts.service';
import { getWorkAddressDerivation } from '@/types/contacts/relationships/core/relationship-metadata';
import type { ContactRelationship } from '@/types/contacts/relationships';
import type { IndividualAddress } from '@/types/ContactFormTypes';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('useDerivedWorkAddresses');

/**
 * ADR-318: a relationship derives a work address when
 *   - its type's metadata is `derivesWorkAddress: 'always'`, OR
 *   - the type is `'optional'` AND `relationship.isWorkplace === true`
 */
function derivesWorkAddress(rel: ContactRelationship): boolean {
  const mode = getWorkAddressDerivation(rel.relationshipType);
  if (mode === 'always') return true;
  if (mode === 'optional') return rel.isWorkplace === true;
  return false;
}

interface DerivedWorkAddress extends IndividualAddress {
  companyId: string;
  companyName: string;
  relationshipLabel: string;
}

/**
 * ADR-318: derive work addresses live from professional relationships.
 * For each employment/ownership relationship where the individual is linked
 * to a company/service, fetch the company address and expose it as a
 * read-only IndividualAddress with type='work'. Zero Firestore writes —
 * relationship is the SSoT, address tab derives on render.
 */
export function useDerivedWorkAddresses(individualId: string | undefined): {
  derived: DerivedWorkAddress[];
  loading: boolean;
} {
  const [derived, setDerived] = useState<DerivedWorkAddress[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!individualId || individualId === 'new-contact') {
      setDerived([]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const relationships = await ContactRelationshipService.getContactRelationships(individualId);
        const professional = relationships.filter(derivesWorkAddress);
        if (professional.length === 0) {
          if (!cancelled) setDerived([]);
          return;
        }

        const companyIds = professional.map(r =>
          r.sourceContactId === individualId ? r.targetContactId : r.sourceContactId
        );
        const companies = await Promise.all(companyIds.map(id => ContactsService.getContact(id)));

        const result: DerivedWorkAddress[] = [];
        companies.forEach((company, idx) => {
          if (!company) return;
          if (company.type !== 'company' && company.type !== 'service') return;
          const addr = company.addresses?.[0];
          if (!addr?.street && !addr?.city) return;

          const rel = professional[idx];
          const companyName = company.companyName ?? company.serviceName ?? company.name ?? '';

          result.push({
            type: 'work',
            street: addr.street ?? '',
            number: addr.number ?? '',
            postalCode: addr.postalCode ?? '',
            city: addr.city ?? '',
            region: addr.region,
            companyId: company.id ?? '',
            companyName,
            relationshipLabel: rel.relationshipType,
          });
        });

        if (!cancelled) {
          logger.info('Derived work addresses from relationships', {
            data: { individualId, count: result.length },
          });
          setDerived(result);
        }
      } catch (err) {
        logger.warn('Failed to derive work addresses', { error: err });
        if (!cancelled) setDerived([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [individualId]);

  return { derived, loading };
}

export type { DerivedWorkAddress };
