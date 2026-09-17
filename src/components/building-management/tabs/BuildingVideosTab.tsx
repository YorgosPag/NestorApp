/**
 * 🏢 ENTERPRISE: Building Videos Tab — gallery βίντεο κτιρίου (ADR-031).
 * Το σώμα ζει στο `building-files-tab` (κοινό με τα Photos).
 *
 * @module components/building-management/tabs/BuildingVideosTab
 */

'use client';

import React from 'react';
import { BuildingMediaTab, type BuildingFilesTabProps } from './building-files-tab';

export function BuildingVideosTab(props: BuildingFilesTabProps) {
  return <BuildingMediaTab {...props} kind="videos" />;
}

export default BuildingVideosTab;
