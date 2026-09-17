/**
 * 🏢 ENTERPRISE: Building Photos Tab — gallery φωτογραφιών κτιρίου (ADR-031).
 * Το σώμα ζει στο `building-files-tab` (κοινό με τα Videos).
 *
 * @module components/building-management/tabs/BuildingPhotosTab
 */

'use client';

import React from 'react';
import { BuildingMediaTab, type BuildingFilesTabProps } from './building-files-tab';

export function BuildingPhotosTab(props: BuildingFilesTabProps) {
  return <BuildingMediaTab {...props} kind="photos" />;
}

export default BuildingPhotosTab;
