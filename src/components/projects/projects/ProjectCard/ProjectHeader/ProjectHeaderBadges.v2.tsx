/**
 * 🏷️ PROJECT HEADER BADGES V2 - UNIFIED SYSTEM
 *
 * Migration από παλιό system στο νέο Unified Badge System
 * Enterprise-class centralized implementation
 */

'use client';

import React from 'react';
import { ProjectBadge, CommonBadge } from '@/core/badges';
import type { ProjectStatus } from '@/core/types/BadgeTypes';

interface ProjectHeaderBadgesV2Props {
  status: ProjectStatus;
  company: string;
}

export function ProjectHeaderBadgesV2({
  status,
  company,
}: ProjectHeaderBadgesV2Props) {
  return (
    <div className="flex items-center gap-2">
      {/* Status Badge - χρησιμοποιεί το κεντρικό ProjectBadge */}
      <ProjectBadge
        status={status}
        size="sm"
        className="text-xs shadow-sm"
      />

      {/* Company Badge - χρησιμοποιεί το CommonBadge */}
      <CommonBadge
        status="company"
        variant="secondary"
        size="sm"
        className="text-xs bg-white/90 text-gray-700 shadow-sm"
        customLabel={company}
      />
    </div>
  );
}

// ===== BACKWARD COMPATIBILITY =====

/**
 * Legacy interface για compatibility με παλιό code
 * Σταδιακά θα αφαιρεθεί μετά τη μετάβαση
 */
interface LegacyProjectHeaderBadgesProps {
  status: ProjectStatus;
  company: string;
  getStatusColor?: (status: ProjectStatus) => string;  // Deprecated
  getStatusLabel?: (status: ProjectStatus) => string; // Deprecated
}

export function ProjectHeaderBadges({
  status,
  company,
  // Deprecated props - ignored για backward compatibility
  getStatusColor,
  getStatusLabel,
}: LegacyProjectHeaderBadgesProps) {
  // Show deprecation warning in development
  if (process.env.NODE_ENV === 'development') {
    if (getStatusColor || getStatusLabel) {
      console.warn(
        '[DEPRECATED] ProjectHeaderBadges: getStatusColor και getStatusLabel props are deprecated. ' +
        'Use the new ProjectHeaderBadgesV2 component instead.'
      );
    }
  }

  return <ProjectHeaderBadgesV2 status={status} company={company} />;
}

// Default export για seamless migration
export default ProjectHeaderBadgesV2;