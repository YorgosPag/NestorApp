
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface PlaceholderTabProps {
  title: string;
  icon: React.ElementType;
  building?: any; // Optional building prop
}

const PlaceholderTab = ({ title, icon: Icon, building }: PlaceholderTabProps) => (
  <div className="flex flex-col items-center justify-center h-96 border-2 border-dashed border-border rounded-lg bg-muted/50">
    <Icon className="w-12 h-12 text-muted-foreground mb-4" />
    <h2 className="text-xl font-semibold text-muted-foreground mb-2">{title}</h2>
    <p className="text-sm text-muted-foreground text-center max-w-md">
      Αυτή η ενότητα θα αναπτυχθεί σύντομα. Θα περιέχει όλες τις απαραίτητες λειτουργίες για τη διαχείριση {title.toLowerCase()}.
    </p>
    <Button variant="outline" className="mt-4">
      <Plus className="w-4 h-4 mr-2" />
      Προσθήκη {title}
    </Button>
  </div>
);

export default PlaceholderTab;
