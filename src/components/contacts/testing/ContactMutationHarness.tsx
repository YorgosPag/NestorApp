'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ContactDetails } from '@/components/contacts/details/ContactDetails';
import { ContactsService } from '@/services/contacts.service';
import { apiClient } from '@/lib/api/enterprise-api-client';
import type { CompanyContact, Contact, IndividualContact } from '@/types/contacts';

interface SaveSnapshot {
  readonly contactId: string;
  readonly type: string;
  readonly firstName?: string;
  readonly companyName?: string;
}

type HarnessScenario = 'individual' | 'company';

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

function resolveScenario(value: string | null): HarnessScenario {
  return value === 'company' ? 'company' : 'individual';
}

export function ContactMutationHarness() {
  const searchParams = useSearchParams();
  const scenario = resolveScenario(searchParams.get('scenario'));
  const [saveCount, setSaveCount] = useState(0);
  const [updateEvents, setUpdateEvents] = useState(0);
  const [lastSave, setLastSave] = useState<SaveSnapshot | null>(null);

  const contact = useMemo<Contact>(() => (
    scenario === 'company' ? buildCompanyContact() : buildIndividualContact()
  ), [scenario]);

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

      <section className="grid gap-3 rounded-lg border border-border bg-card p-4" aria-label="Harness State">
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
