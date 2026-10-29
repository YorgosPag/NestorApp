'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContactDetails } from '@/components/contacts/details/ContactDetails';
import { Card } from '@/components/ui/card';
import { ContactsService } from '@/services/contacts.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { CompanyContact, Contact, IndividualContact } from '@/types/contacts';

interface SaveSnapshot {
  readonly contactId: string;
  readonly type: string;
  readonly firstName?: string;
  readonly companyName?: string;
  /** Τα πεδία του dirty diff (ADR-323) που έφτασαν στον γραφέα — ταξινομημένα. */
  readonly dirtyKeys: readonly string[];
}

type HarnessScenario = 'individual' | 'company' | 'server-company';

function buildIndividualContact(): IndividualContact {
  return {
    id: 'contact_e2e_individual',
    type: 'individual',
    isFavorite: false,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    companyId: 'company_e2e',
    firstName: 'Maria',
    lastName: 'Papadopoulou',
    fatherName: 'Nikos',
    motherName: 'Eleni',
    birthDate: '1990-01-15',
    gender: 'female',
    amka: '12345678901',
    emails: [],
    phones: [],
    addresses: [],
    websites: [],
    socialMedia: [],
  };
}

function buildCompanyContact(): CompanyContact {
  return {
    id: 'contact_e2e_company',
    type: 'company',
    isFavorite: false,
    status: 'active',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    companyId: 'company_e2e',
    companyName: 'Acme Construction SA',
    vatNumber: '099999999',
    legalForm: 'ΑΕ',
    taxOffice: 'Athens Tax Office',
    emails: [],
    phones: [],
    addresses: [],
    websites: [],
    socialMedia: [],
  };
}

/**
 * Επαφή εταιρείας όπως τη γράφει ο **server** (σάρωση προσφοράς · `api/contacts/resolve`):
 * διεύθυνση χωρίς `id`/`label`, `customFields: null`. Ελέγχει ότι η φόρμα που ανοίγει και
 * αποθηκεύεται πάνω της στέλνει **μόνο** ό,τι άλλαξε ο άνθρωπος (ADR-327 §8.5.4 · ADR-323).
 */
function buildServerCompanyContact(): CompanyContact {
  return {
    ...buildCompanyContact(),
    id: 'contact_e2e_server_company',
    companyName: 'Server Supplier ATEE',
    vatNumber: '094201577',
    legalForm: undefined,
    taxOffice: undefined,
    phones: [{ number: '2310428900', countryCode: '+30', type: 'main', isPrimary: true }],
    emails: [{ email: 'info@example.invalid', type: 'info', isPrimary: true }],
    addresses: [{
      street: 'Απόλλωνος', city: 'Θεσσαλονίκη', postalCode: '55535',
      country: 'GR', type: 'work', isPrimary: true,
    }],
  };
}

function resolveScenario(value: string | null): HarnessScenario {
  if (value === 'company' || value === 'server-company') return value;
  return 'individual';
}

function buildScenarioContact(scenario: HarnessScenario): Contact {
  if (scenario === 'company') return buildCompanyContact();
  if (scenario === 'server-company') return buildServerCompanyContact();
  return buildIndividualContact();
}

export function ContactMutationHarness() {
  const searchParams = useSearchParams();
  const scenario = resolveScenario(searchParams.get('scenario'));
  const [saveCount, setSaveCount] = useState(0);
  const [updateEvents, setUpdateEvents] = useState(0);
  const [lastSave, setLastSave] = useState<SaveSnapshot | null>(null);

  const contact = useMemo<Contact>(() => buildScenarioContact(scenario), [scenario]);

  useEffect(() => {
    setSaveCount(0);
    setUpdateEvents(0);
    setLastSave(null);
  }, [scenario]);

  useEffect(() => {
    const originalUpdate = ContactsService.updateContactFromForm;
    const originalGet = apiClient.get.bind(apiClient);
    const originalPost = apiClient.post.bind(apiClient);

    ContactsService.updateContactFromForm = async (contactId, formData) => {
      setSaveCount((current) => current + 1);
      setLastSave({
        contactId,
        type: String(formData.type ?? ''),
        firstName: typeof formData.firstName === 'string' ? formData.firstName : undefined,
        companyName: typeof formData.companyName === 'string' ? formData.companyName : undefined,
        dirtyKeys: Object.keys(formData).sort(),
      });
    };

    apiClient.get = async <T = unknown>(url: string): Promise<T> => {
      const response = await fetch(url, { method: 'GET' });
      const json = await response.json() as { data?: T };
      if (!response.ok) {
        throw new Error(`GET ${url} failed with ${response.status}`);
      }
      return (json.data ?? json) as T;
    };

    apiClient.post = async <T = unknown>(url: string, body?: Record<string, unknown> | unknown): Promise<T> => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      const json = await response.json() as { data?: T };
      if (!response.ok) {
        throw new Error(`POST ${url} failed with ${response.status}`);
      }
      return (json.data ?? json) as T;
    };

    return () => {
      ContactsService.updateContactFromForm = originalUpdate;
      apiClient.get = originalGet;
      apiClient.post = originalPost;
    };
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6" aria-label="Contact Mutation Harness">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-foreground">Contact Mutation Harness</h1>
        <p className="text-sm text-muted-foreground">
          Browser-level deterministic harness for contact identity impact flows.
        </p>
      </header>

      <Card asChild className="grid gap-3 p-4">
        <section aria-label="Harness State">
          <div className="flex flex-wrap gap-3 text-sm text-foreground">
            <span data-testid="harness-scenario">scenario:{scenario}</span>
            <span data-testid="harness-contact-id">contact:{contact.id}</span>
            <span data-testid="save-count">saves:{saveCount}</span>
            <span data-testid="update-events">updates:{updateEvents}</span>
          </div>
          <output data-testid="last-save" className="rounded-md border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
            {lastSave ? JSON.stringify(lastSave) : 'no-save'}
          </output>
        </section>
      </Card>

      <section className="min-h-[640px] rounded-lg border border-border bg-background" aria-label="Contact Details Harness">
        <ContactDetails
          contact={contact}
          onContactUpdated={() => setUpdateEvents((current) => current + 1)}
        />
      </section>
    </main>
  );
}

export default ContactMutationHarness;
