
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, Eye } from 'lucide-react';
import type { ProjectCustomer } from '@/types/project';

interface CustomersTableProps {
  customers: ProjectCustomer[];
}

export function CustomersTable({ customers }: CustomersTableProps) {
  return (
    <div>
      {/* Table Headers */}
      <div className="grid grid-cols-4 gap-4 pb-2 mb-4 border-b border-border text-sm font-medium text-muted-foreground">
        <div>Ονοματεπώνυμο</div>
        <div>Τηλέφωνο</div>
        <div>Αριθμός Μονάδων</div>
        <div className="text-right">Ενέργειες</div>
      </div>

      {/* Table Content */}
      <section className="space-y-1" aria-label="Λίστα πελατών έργου">
        {customers.map(customer => {
          const initials = customer.name
            ?.split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '??';

          return (
            <div
              key={customer.contactId}
              className="grid grid-cols-4 gap-4 items-center py-3 px-1 hover:bg-accent/30 transition-colors rounded-md"
            >
              {/* Column 1: Avatar + Name */}
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground truncate">
                  {customer.name}
                </span>
              </div>

              {/* Column 2: Phone */}
              <div className="flex items-center gap-2 min-w-0">
                {customer.phone ? (
                  <>
                    <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate">
                      {customer.phone}
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>

              {/* Column 3: Units Count */}
              <div className="flex items-center gap-1">
                <span className="text-sm text-foreground font-medium">
                  #{customer.unitsCount}
                </span>
              </div>

              {/* Column 4: Actions */}
              <div className="flex justify-end">
                <div className="flex items-center gap-1">
                  {/* View Action (Ματάκι) */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    title="Προβολή πελάτη"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>

                  {/* Phone Action (Τηλέφωνο) */}
                  {customer.phone && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => {
                        const cleanPhone = customer.phone!.replace(/\s+/g, '');
                        window.open(`tel:${cleanPhone}`, '_self');
                      }}
                      title="Κλήση"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
