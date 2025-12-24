'use client';

import React from 'react';
import { toast } from 'react-hot-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PropertyBadge, CommonBadge } from '@/core/badges';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EntityDetailsHeader } from '@/core/entity-headers';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useLayoutClasses } from '@/hooks/useLayoutClasses';
import { useTypography } from '@/hooks/useTypography';
import { useButtonPatterns } from '@/hooks/useButtonPatterns';
import { useSemanticColors } from '@/hooks/useSemanticColors';
import {
  Home, Building, MapPin, Euro, Ruler, Users, Phone, Mail, FileText, ExternalLink, Calendar, Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCurrency, formatDate } from '@/lib/intl-utils';
import type { Property } from '@/types/property';
import { PROPERTY_STATUS_CONFIG } from '@/lib/property-utils';
import { PropertyInfoItem } from './details/PropertyInfoItem';
import { shareProperty, trackShareEvent, type PropertyShareData } from '@/lib/share-utils';

interface PropertyDetailsProps {
  property: Property;
}

export function PropertyDetails({ property }: PropertyDetailsProps) {
  const statusInfo = PROPERTY_STATUS_CONFIG[property.status] || PROPERTY_STATUS_CONFIG.default;

  // 🏢 ENTERPRISE: Centralized systems
  const iconSizes = useIconSizes();
  const layout = useLayoutClasses();
  const typography = useTypography();
  const buttonPatterns = useButtonPatterns();
  const colors = useSemanticColors();

  const handleShare = async () => {
    try {
      const propertyShareData: PropertyShareData = {
        id: property.id,
        title: `${property.code} - ${property.description}`,
        description: `${property.area} τ.μ. • ${property.rooms} δωμάτια • ${formatCurrency(property.price)}`,
        price: property.price,
        area: property.area,
        location: property.building,
        propertyType: 'apartment' // You might want to add this to the Property type
      };

      const success = await shareProperty(propertyShareData, 'property_details');
      
      if (success) {
        toast.success('🎉 Ακίνητο κοινοποιήθηκε επιτυχώς!');
        
        // Track the share event
        trackShareEvent('native_share', 'property', property.id);
      } else {
        toast.error('❌ Πρόβλημα κοινοποίησης. Δοκιμάστε ξανά.');
      }
    } catch (error) {
      console.error('Share error:', error);
      toast.error('❌ Πρόβλημα κοινοποίησης. Δοκιμάστε ξανά.');
    }
  };

  return (
    <div className={layout.cardFlexCol}>
      <EntityDetailsHeader
        icon={Home}
        title={property.code}
        subtitle={property.description}
        badges={[
          {
            type: 'status',
            value: property.status,
            variant: 'default',
            size: 'sm'
          }
        ]}
        actions={[
          {
            label: 'Κοινοποίηση',
            onClick: handleShare,
            icon: Share2,
            variant: 'outline'
          }
        ]}
        variant="default"
      />
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <Separator />
          
          <div className={`${layout.gridCols2Gap4} ${typography.body.sm}`}>
            <PropertyInfoItem icon={<Building />} label="Κτίριο" value={property.building} />
            <PropertyInfoItem icon={<MapPin />} label="Όροφος" value={property.floor} />
            <PropertyInfoItem icon={<Euro />} label="Τιμή" value={formatCurrency(property.price)} valueClassName={`font-semibold ${colors.text.price}`} iconClassName={colors.text.price} />
            <PropertyInfoItem icon={<Ruler />} label="Εμβαδόν" value={`${property.area} m²`} />
            <PropertyInfoItem icon={<Home />} label="Δωμάτια" value={property.rooms} />
            <PropertyInfoItem icon={<Home />} label="Μπαλκόνι" value={property.balconyArea ? `${property.balconyArea} m²` : '-'} />
          </div>
          
          <Separator />

          {property.status === 'sold' && (
            <div className="space-y-3">
                <h4 className={typography.heading.sm}>Αγοραστής</h4>
                <div className="flex items-center justify-between">
                    <div className={`${layout.flexCenterGap2} ${typography.body.sm}`}>
                        <Users className={`${iconSizes.sm} text-muted-foreground`} />
                        <span>{property.buyer || '-'}</span>
                    </div>
                    <Button {...buttonPatterns.actions.view} className={`${typography.body.xs} h-7`}>Προβολή Επαφής</Button>
                </div>
                {property.saleDate && (
                  <div className={`${layout.flexCenterGap2} ${typography.special.secondary}`}>
                    <Calendar className={iconSizes.sm} />
                    <span>Ημ/νία Πώλησης: {formatDate(property.saleDate)}</span>
                  </div>
                )}
            </div>
          )}

          {property.features && property.features.length > 0 && (
            <div className="space-y-2">
              <h4 className={typography.heading.sm}>Χαρακτηριστικά</h4>
              <div className="flex flex-wrap gap-2">
                {property.features.map((feature, index) => (
                  <CommonBadge
                    key={index}
                    status="property"
                    customLabel={feature}
                    variant="secondary"
                  />
                ))}
              </div>
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
