'use client';

import React, { useState } from 'react';
import type { Building } from '../../BuildingsPageContent';
import { MapHeader } from './MapHeader';
import { LocationInfoCard } from './LocationInfoCard';
import { InteractiveMap } from './InteractiveMap';
import { NearbyProjectsList } from './NearbyProjectsList';
import { LocationAnalyticsGrid } from './LocationAnalyticsGrid';
import { GEOGRAPHIC_CONFIG } from '@/config/geographic-config';

interface MapTabContentProps {
  building: Pick<Building, 'name' | 'address' | 'city'>;
}

const MapTabContent = ({ building }: MapTabContentProps) => {
  const [mapView, setMapView] = useState<'satellite' | 'street' | 'hybrid'>('street');
  const [showNearbyProjects, setShowNearbyProjects] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<'all' | 'active' | 'completed'>('all');

  const coordinates = {
    lat: GEOGRAPHIC_CONFIG.DEFAULT_LATITUDE,
    lng: GEOGRAPHIC_CONFIG.DEFAULT_LONGITUDE
  };

  return (
    <div className="space-y-6">
      <MapHeader mapView={mapView} setMapView={setMapView} />
      <LocationInfoCard building={building} coordinates={coordinates} />
      <InteractiveMap
        building={building}
        mapView={mapView}
        selectedLayer={selectedLayer}
        setSelectedLayer={setSelectedLayer}
        showNearbyProjects={showNearbyProjects}
        setShowNearbyProjects={setShowNearbyProjects}
      />
      <NearbyProjectsList />
      <LocationAnalyticsGrid />
    </div>
  );
};

export default MapTabContent;
