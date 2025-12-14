
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Hash, Eye } from 'lucide-react';
import type { ProjectCustomer } from '@/types/project';

interface CustomersTableProps {
  customers: ProjectCustomer[];
}

export function CustomersTable({ customers }: CustomersTableProps) {
  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ονοματεπώνυμο</TableHead>
            <TableHead>Τηλέφωνο</TableHead>
            <TableHead className="text-center">Αριθμός Μονάδων</TableHead>
            <TableHead className="text-right">Ενέργειες</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map(customer => {
            const initials = customer.name
              ?.split(' ')
              .map(n => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2) || '??';

            return (
              <TableRow key={customer.contactId}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span>{customer.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {customer.phone ? (
                    <span className="flex items-center gap-2">
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {customer.phone}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Δ/Υ</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <span className="flex items-center justify-center gap-1">
                    <Hash className="w-3 h-3 text-muted-foreground" />
                    {customer.unitsCount}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm">
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
