'use client';

import React, { useState } from 'react';
import type { Building } from '../../BuildingsPageContent';
import { MapHeader } from './MapHeader';
import { LocationInfoCard } from './LocationInfoCard';
import { InteractiveMap } from './InteractiveMap';
import { NearbyProjectsList } from './NearbyProjectsList';
import { LocationAnalyticsGrid } from './LocationAnalyticsGrid';

interface MapTabContentProps {
  building: Pick<Building, 'name' | 'address' | 'city'>;
}

const MapTabContent = ({ building }: MapTabContentProps) => {
  const [mapView, setMapView] = useState<'satellite' | 'street' | 'hybrid'>('street');
  const [showNearbyProjects, setShowNearbyProjects] = useState(true);
  const [selectedLayer, setSelectedLayer] = useState<'all' | 'active' | 'completed'>('all');

  const coordinates = {
    lat: 37.9838,  // Approximate coordinates for Athens center
    lng: 23.7275
  };

  return (
    <div className="space-y-6">
      <MapHeader mapView={mapView} setMapView={setMapView} />
      <LocationInfoCard building={building} coordinates={coordinates} />
      <InteractiveMap
        building={building}
        coordinates={coordinates}
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
