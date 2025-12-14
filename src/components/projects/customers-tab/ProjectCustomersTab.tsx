
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CustomerInfoCompact } from '@/components/shared/customer-info';
import { useProjectCustomers } from './hooks/useProjectCustomers';
import { LoadingCard } from './parts/LoadingCard';
import { ErrorCard } from './parts/ErrorCard';
import { EmptyState } from './parts/EmptyState';
import type { ProjectCustomersTabProps } from './types';

export function ProjectCustomersTab({ projectId }: ProjectCustomersTabProps) {
  const { customers, loading, error } = useProjectCustomers(projectId);

  if (loading) {
    return <LoadingCard />;
  }

  if (error) {
    return <ErrorCard message={error} />;
  }

  if (customers.length === 0) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Πελάτες Έργου ({customers.length})</CardTitle>
        <CardDescription>Λίστα πελατών που έχουν αγοράσει ακίνητα σε αυτό το έργο.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table Headers */}
        <div className="grid grid-cols-[2fr_1fr_1.8fr_auto_auto] gap-3 pb-2 mb-4 border-b border-border text-sm font-medium text-muted-foreground">
          <div>Ονοματεπώνυμο</div>
          <div>Τηλέφωνο</div>
          <div>Email</div>
          <div className="text-right pr-3">Μονάδες</div>
          <div className="text-right">Ενέργειες</div>
        </div>

        {/* Table Content */}
        <section className="space-y-1" aria-label="Λίστα πελατών έργου">
          {customers.map((customer) => (
            <CustomerInfoCompact
              key={customer.contactId}
              contactId={customer.contactId}
              context="project"
              variant="table"
              size="md"
              showPhone={true}
              showActions={true}
              showUnitsCount={true}
              unitsCount={customer.unitsCount}
              className="hover:bg-accent/30 transition-colors rounded-md"
              customerData={{
                name: customer.name,
                phone: customer.phone,
                email: customer.email
              }}
            />
          ))}
        </section>
      </CardContent>
    </Card>
  );
}
