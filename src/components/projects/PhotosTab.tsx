/**
 * 🏢 ENTERPRISE: Project Photos Tab — φωτογραφίες έργου μέσω EntityFilesManager (ADR-031).
 * Το σώμα ζει στο `project-files-tab` (κοινό με τα Videos).
 *
 * @module components/projects/PhotosTab
 */

'use client';

import React from 'react';
import { ProjectMediaTab, type ProjectFilesTabProps } from './project-files-tab';

export function PhotosTab(props: ProjectFilesTabProps) {
  return <ProjectMediaTab {...props} kind="photos" />;
}
