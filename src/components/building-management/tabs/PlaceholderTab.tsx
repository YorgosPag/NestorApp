
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';

interface PlaceholderTabProps {
  title?: string;
  icon?: React.ElementType;
  building?: Record<string, unknown>; // Optional building prop
  [key: string]: unknown; // Allow additional props from UniversalTabsRenderer
}

const PlaceholderTab = ({ title = 'Περιεχόμενο', icon: Icon, building, ...additionalProps }: PlaceholderTabProps) => {
  const iconSizes = useIconSizes();
  const { createBorder } = useBorderTokens();

  // Default icon fallback
  const FallbackIcon = () => <div className={`${iconSizes.xl3} text-muted-foreground mb-4 text-4xl`}>📦</div>;
  const IconComponent = Icon || FallbackIcon;

  return (
    <div className={`flex flex-col items-center justify-center ${iconSizes.xl12} ${createBorder('medium', 'hsl(var(--border))', 'dashed')} rounded-lg bg-muted/50`}>
      <IconComponent className={`${iconSizes.xl3} text-muted-foreground mb-4`} />
    <h2 className="text-xl font-semibold text-muted-foreground mb-2">{title}</h2>
    <p className="text-sm text-muted-foreground text-center max-w-md">
      Αυτή η ενότητα θα αναπτυχθεί σύντομα. Θα περιέχει όλες τις απαραίτητες λειτουργίες για τη διαχείριση {title.toLowerCase()}.
    </p>
    <Button variant="outline" className="mt-4">
      <Plus className={`${iconSizes.sm} mr-2`} />
      Προσθήκη {title}
    </Button>
  </div>
  );
};

export default PlaceholderTab;
