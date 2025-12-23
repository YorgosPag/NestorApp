'use client';

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CustomerInfoCompact } from '@/components/shared/customer-info';
import { Users } from "lucide-react";
import { useIconSizes } from '@/hooks/useIconSizes';
// import { getProjectCustomers } from "@/services/projects.service"; // Server action - can't use from client
import type { ProjectCustomersTableProps } from "../types";
import type { ProjectCustomer } from "@/types/project";

export function ProjectCustomersTable({ projectId }: ProjectCustomersTableProps) {
  const iconSizes = useIconSizes();
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/projects/${projectId}/customers`);
        if (!response.ok) {
          throw new Error(`Failed to fetch customers: ${response.status}`);
        }
        const data = await response.json();
        if (mounted) {
          setCustomers(data.customers || []);
        }
      } catch (e) {
        console.error("Failed to fetch project customers:", e);
        if (mounted) {
          setError(e instanceof Error ? e.message : 'Άγνωστο σφάλμα');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            Πελάτες Έργου
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Φόρτωση πελατών...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            Πελάτες Έργου
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            Σφάλμα κατά τη φόρτωση: {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (customers.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className={iconSizes.md} />
            Πελάτες Έργου
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Users className={`${iconSizes.xl3} mx-auto text-muted-foreground mb-4`} />
            <p className="text-sm text-muted-foreground">
              Δεν υπάρχουν καταχωρημένοι πελάτες για αυτό το έργο.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className={iconSizes.md} />
          Πελάτες Έργου
        </CardTitle>
        <CardDescription>
          Λίστα των πελατών που έχουν αγοράσει μονάδες σε αυτό το έργο ({customers.length} πελάτες).
        </CardDescription>
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
              context="building"
              variant="table"
              size="md"
              showPhone={true}
              showActions={true}
              showUnitsCount={true}
              unitsCount={customer.unitsCount}
              className="hover:bg-accent/30 transition-colors rounded-md"
            />
          ))}
        </section>
      </CardContent>
    </Card>
  );
}
