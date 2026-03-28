'use client';

/**
 * =============================================================================
 * 🏢 ENTERPRISE: ProjectCardLocation Component (ADR-167)
 * =============================================================================
 *
 * Displays project location with multi-address support
 * Shows primary address + badge for additional addresses
 *
 * Features:
 * - Lazy migration from legacy address/city fields
 * - Multi-address display with "+X ακόμα" badge
 * - Enterprise formatting via helpers
 *
 * @enterprise Fortune 500-grade address display
 * @created 2026-02-02
 */

import React from 'react';
import { MapPin } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useTypography } from '@/hooks/useTypography';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project';
import {
  getPrimaryAddress,
  formatAddressLine,
  migrateLegacyAddress,
} from '@/types/project/address-helpers';
import '@/lib/design-system';

interface ProjectCardLocationProps {
  /** Full project object (for multi-address support) */
  project: Project;
}

export function ProjectCardLocation({ project }: ProjectCardLocationProps) {
  const iconSizes = useIconSizes();
  const typography = useTypography();

  // 🏢 ENTERPRISE: Lazy migration from legacy fields (ADR-167)
  const addresses = project.addresses ||
    (project.address && project.city
      ? migrateLegacyAddress(project.address, project.city)
      : []);

  const primary = getPrimaryAddress(addresses);
  if (!primary) return null;

  const additionalCount = addresses.length - 1;

  return (
    <div className={cn("flex items-center gap-2", typography.special.secondary)}>
      <MapPin className={`${iconSizes.sm} shrink-0`} />
      <span className="truncate">{formatAddressLine(primary)}</span>
      {additionalCount > 0 && (
        <Badge variant="outline" className="ml-1 shrink-0">
          +{additionalCount} ακόμα {/* eslint-disable-line custom/no-hardcoded-strings */}
        </Badge>
      )}
    </div>
  );
}
