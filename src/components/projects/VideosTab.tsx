/**
 * 🏢 ENTERPRISE: Project Videos Tab — βίντεο έργου μέσω EntityFilesManager (ADR-031).
 * Το σώμα ζει στο `project-files-tab` (κοινό με τα Photos).
 *
 * @module components/projects/VideosTab
 */

'use client';

import React from 'react';
import { ProjectMediaTab, type ProjectFilesTabProps } from './project-files-tab';

export function VideosTab(props: ProjectFilesTabProps) {
  return <ProjectMediaTab {...props} kind="videos" />;
}
