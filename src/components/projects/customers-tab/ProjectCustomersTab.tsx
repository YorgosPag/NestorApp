
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useProjectCustomers } from './hooks/useProjectCustomers';
import { LoadingCard } from './parts/LoadingCard';
import { ErrorCard } from './parts/ErrorCard';
import { EmptyState } from './parts/EmptyState';
import { CustomersTable } from './parts/CustomersTable';
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
        <CustomersTable customers={customers} />
      </CardContent>
    </Card>
  );
}
