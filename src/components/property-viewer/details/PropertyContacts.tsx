'use client';

import React from 'react';
import { User, Phone, Mail } from 'lucide-react';
import type { ExtendedPropertyDetails } from '@/types/property-viewer';

interface PropertyContactsProps {
  owner: ExtendedPropertyDetails['owner'];
  agent: ExtendedPropertyDetails['agent'];
}

export function PropertyContacts({ owner, agent }: PropertyContactsProps) {
  return (
    <div className="space-y-3">
      {owner && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <User className="h-3 w-3" />
            Ιδιοκτήτης
          </h4>
          <div className="space-y-1 pl-4">
            <p className="text-xs">{owner.name}</p>
            {owner.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{owner.phone}</span>
              </div>
            )}
            {owner.email && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{owner.email}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {agent && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium flex items-center gap-1">
            <User className="h-3 w-3" />
            Μεσίτης
          </h4>
          <div className="space-y-1 pl-4">
            <p className="text-xs">{agent.name}</p>
            {agent.phone && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{agent.phone}</span>
              </div>
            )}
            {agent.email && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span>{agent.email}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
