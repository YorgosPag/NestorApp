'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Home, Building, MapPin, Euro, Ruler, Users, Phone, Mail, FileText, ExternalLink, Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Property } from '@/types/property';
import { PROPERTY_STATUS_CONFIG } from '@/lib/property-utils';
import { PropertyInfoItem } from './details/PropertyInfoItem';

interface PropertyDetailsProps {
  property: Property;
}

export function PropertyDetails({ property }: PropertyDetailsProps) {
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;

  return (
    <Card className="flex-1 flex flex-col min-w-0">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg">{property.code}</CardTitle>
            <p className="text-sm text-muted-foreground">{property.description}</p>
          </div>
          <Badge className={cn("text-xs", statusInfo.color)}>{statusInfo.label}</Badge>
        </div>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardContent className="space-y-4">
          <Separator />
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <PropertyInfoItem icon={<Building />} label="Κτίριο" value={property.building} />
            <PropertyInfoItem icon={<MapPin />} label="Όροφος" value={property.floor} />
            <PropertyInfoItem icon={<Euro />} label="Τιμή" value={`${property.price.toLocaleString('el-GR')} €`} valueClassName="font-semibold text-green-600" iconClassName="text-green-600" />
            <PropertyInfoItem icon={<Ruler />} label="Εμβαδόν" value={`${property.area} m²`} />
            <PropertyInfoItem icon={<Home />} label="Δωμάτια" value={property.rooms} />
            <PropertyInfoItem icon={<Home />} label="Μπαλκόνι" value={property.balconyArea ? `${property.balconyArea} m²` : '-'} />
          </div>
          
          <Separator />

          {property.status === 'sold' && (
            <div className="space-y-3">
                <h4 className="font-semibold text-sm">Αγοραστής</h4>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{property.buyer || '-'}</span>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs h-7">Προβολή Επαφής</Button>
                </div>
                {property.saleDate && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>Ημ/νία Πώλησης: {new Date(property.saleDate).toLocaleDateString('el-GR')}</span>
                  </div>
                )}
            </div>
          )}

          {property.features && property.features.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Χαρακτηριστικά</h4>
              <div className="flex flex-wrap gap-2">
                {property.features.map((feature, index) => (
                  <Badge key={index} variant="secondary">{feature}</Badge>
                ))}
              </div>
            </div>
          )}

        </CardContent>
      </ScrollArea>
    </Card>
  );
}
