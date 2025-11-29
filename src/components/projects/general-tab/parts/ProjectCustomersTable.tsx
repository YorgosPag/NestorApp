'use client';

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { CommonBadge } from "@/core/badges";
import { Users, Eye } from "lucide-react";
// import { getProjectCustomers } from "@/services/projects.service"; // Server action - can't use from client
import type { ProjectCustomersTableProps } from "../types";
import type { ProjectCustomer } from "@/types/project";

export function ProjectCustomersTable({ projectId }: ProjectCustomersTableProps) {
  const [customers, setCustomers] = useState<ProjectCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/projects/${projectId}/customers`);
        if (!response.ok) throw new Error('Failed to fetch customers');
        const data = await response.json();
        if (mounted) setCustomers(data);
      } catch (e) {
        console.error("Failed to fetch project customers:", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [projectId]);

  if (loading) return <div>Φόρτωση πελατών...</div>;

  if (customers.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Πελάτες Έργου
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Δεν υπάρχουν καταχωρημένοι πελάτες για αυτό το έργο.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Πελάτες Έργου
        </CardTitle>
        <CardDescription>Λίστα των πελατών που έχουν αγοράσει μονάδες σε αυτό το έργο.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα Πελάτη</TableHead>
              <TableHead>Τηλέφωνο</TableHead>
              <TableHead>Αριθμός Μονάδων</TableHead>
              <TableHead className="text-right">Ενέργειες</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.contactId}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>{c.phone || "Δεν έχει καταχωρηθεί"}</TableCell>
                <TableCell>
                  <CommonBadge
                    status="units"
                    customLabel={`${c.unitsCount} μονάδα/ες`}
                    variant="secondary"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4 mr-2" />
                    Προβολή
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
