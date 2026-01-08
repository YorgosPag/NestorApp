'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';
// 🏢 ENTERPRISE: Using centralized entity config for Building icon
import { NAVIGATION_ENTITIES } from '@/components/navigation/config/navigation-entities';
import { useRouter } from 'next/navigation';
import { useProjectStructure } from '../../structure-tab/hooks/useProjectStructure';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';

// 🏢 ENTERPRISE: Type definitions (ZERO any)
interface ProjectBuildingsCardProps {
  /** Project ID για fetch buildings */
  projectId: number;
}

interface BuildingSummary {
  id: string | number;
  name: string;
  unitsCount: number;
  soldUnits: number;
  totalArea: number;
}

// 🏢 ENTERPRISE: Centralized labels (ZERO hardcoded strings)
const LABELS = {
  CARD_TITLE: 'Κτίρια Έργου',
  LOADING: 'Φόρτωση κτιρίων...',
  ERROR_PREFIX: 'Σφάλμα κατά τη φόρτωση:',
  EMPTY_TITLE: 'Δεν υπάρχουν κτίρια',
  EMPTY_DESCRIPTION: 'Δεν έχουν συνδεθεί κτίρια με αυτό το έργο.',
  EMPTY_ACTION: 'Προσθήκη από Κτίρια',
  VIEW_BUILDING: 'Προβολή',
  UNITS_LABEL: 'μονάδες',
  SOLD_LABEL: 'πωλημένες',
  AREA_LABEL: 'm²',
  VIEW_ALL_STRUCTURE: 'Προβολή Δομής Έργου',
} as const;

/**
 * 🏢 ENTERPRISE: ProjectBuildingsCard Component
 *
 * Εμφανίζει τα κτίρια που ανήκουν σε ένα έργο.
 * Χρησιμοποιεί το existing useProjectStructure hook για data fetching.
 */
export function ProjectBuildingsCard({ projectId }: ProjectBuildingsCardProps) {
  const router = useRouter();
  const iconSizes = useIconSizes();
  const colors = useSemanticColors();

  // 🏢 ENTERPRISE: Reuse existing hook (ZERO duplicate API calls)
  const { structure, loading, error } = useProjectStructure(projectId);

  // 🏢 ENTERPRISE: Transform buildings data for display
  const buildings: BuildingSummary[] = structure?.buildings.map(building => ({
    id: building.id,
    name: building.name,
    unitsCount: building.units.length,
    soldUnits: building.units.filter(u => u.status === 'sold').length,
    totalArea: building.units.reduce((sum, u) => sum + (u.area || 0), 0),
  })) || [];

  // 🏢 ENTERPRISE: Navigation handlers
  const handleViewBuilding = (buildingId: string | number) => {
    router.push(`/buildings?selected=${buildingId}`);
  };

  const handleAddBuilding = () => {
    router.push('/buildings');
  };

  // 🏢 ENTERPRISE: Loading state
  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
            {LABELS.CARD_TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <section className="flex items-center justify-center gap-2 py-8" aria-busy="true">
            <Loader2 className={cn(iconSizes.md, 'animate-spin', colors.text.muted)} />
            <span className={colors.text.muted}>{LABELS.LOADING}</span>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Error state
  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
            {LABELS.CARD_TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <section className="flex items-center justify-center gap-2 py-8 text-destructive" aria-live="polite">
            <AlertCircle className={iconSizes.md} />
            <span>{LABELS.ERROR_PREFIX} {error}</span>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Empty state
  if (buildings.length === 0) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
            {LABELS.CARD_TITLE}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <section className="text-center py-8" aria-label="Κενή λίστα κτιρίων">
            <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.xl3, 'mx-auto mb-4', NAVIGATION_ENTITIES.building.color)} />
            <p className={cn('text-sm font-medium', colors.text.foreground)}>
              {LABELS.EMPTY_TITLE}
            </p>
            <p className={cn('text-sm mt-1 mb-4', colors.text.muted)}>
              {LABELS.EMPTY_DESCRIPTION}
            </p>
            <Button variant="outline" size="sm" onClick={handleAddBuilding}>
              <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color, 'mr-2')} />
              {LABELS.EMPTY_ACTION}
            </Button>
          </section>
        </CardContent>
      </Card>
    );
  }

  // 🏢 ENTERPRISE: Buildings list
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.md, NAVIGATION_ENTITIES.building.color)} />
          {LABELS.CARD_TITLE}
        </CardTitle>
        <CardDescription>
          {buildings.length} κτίρια συνδεδεμένα με αυτό το έργο
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Table Headers */}
        <header className="grid grid-cols-[2fr_1fr_1fr_auto] gap-3 pb-2 mb-3 border-b border-border text-sm font-medium text-muted-foreground">
          <span>Όνομα Κτιρίου</span>
          <span className="text-right">Μονάδες</span>
          <span className="text-right">Εμβαδόν</span>
          <span className="text-right">Ενέργειες</span>
        </header>

        {/* Buildings List */}
        <section className="space-y-2" aria-label="Λίστα κτιρίων έργου">
          {buildings.map((building) => (
            <article
              key={building.id}
              className={cn(
                'grid grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center p-3 rounded-md',
                'hover:bg-accent/30 transition-colors cursor-pointer border border-transparent hover:border-border'
              )}
              onClick={() => handleViewBuilding(building.id)}
            >
              <div className="flex items-center gap-2">
                <NAVIGATION_ENTITIES.building.icon className={cn(iconSizes.sm, NAVIGATION_ENTITIES.building.color)} />
                <span className="font-medium">{building.name}</span>
              </div>
              <div className="text-right text-sm">
                <span className="font-medium">{building.unitsCount}</span>
                <span className={cn('ml-1', colors.text.muted)}>{LABELS.UNITS_LABEL}</span>
                <div className={cn('text-xs', colors.text.muted)}>
                  {building.soldUnits} {LABELS.SOLD_LABEL}
                </div>
              </div>
              <div className={cn('text-right text-sm', colors.text.muted)}>
                {building.totalArea.toLocaleString('el-GR', { maximumFractionDigits: 1 })} {LABELS.AREA_LABEL}
              </div>
              <div className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleViewBuilding(building.id);
                  }}
                >
                  <ExternalLink className={iconSizes.sm} />
                  <span className="sr-only">{LABELS.VIEW_BUILDING}</span>
                </Button>
              </div>
            </article>
          ))}
        </section>
      </CardContent>
    </Card>
  );
}

export default ProjectBuildingsCard;
