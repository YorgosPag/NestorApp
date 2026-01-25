'use client';
import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { Building, Construction, Factory, Home, Package, ParkingCircle, Target } from 'lucide-react';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { useTranslation } from '../../../../i18n';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// 🏢 ENTERPRISE: Centralized BaseButton for error retry
import { BaseButton } from '../../components/shared/BaseButton';
// 🏢 ENTERPRISE: Centralized ListCard for hierarchy items (same as contacts, projects, buildings lists)
import { ListCard } from '@/design-system/components/ListCard/ListCard';

export function HierarchyDebugPanel() {
  const iconSizes = useIconSizes();
  const { getStatusBorder, getDirectionalBorder } = useBorderTokens();
  const colors = useSemanticColors();  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
  const { t } = useTranslation('dxf-viewer');
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    selectedBuilding,
    selectedFloor,
    loading,
    error,
    loadCompanies,
    selectCompany,
    selectProject,
    selectBuilding,
    selectFloor,
    getAvailableDestinations,
    loadProjects
  } = useProjectHierarchy();

  const destinations = getAvailableDestinations();

  if (loading) {
    return (
      // 🏢 ENTERPRISE: SPACING.MS = 6px padding, bg.card for darker background
      <section className={`${colors.bg.card} ${PANEL_LAYOUT.SPACING.MS} ${PANEL_LAYOUT.ROUNDED.LG} ${getStatusBorder('muted')}`}>
        <h3 className={`${colors.text.inverse} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          {/* 🏢 ENTERPRISE: Factory icon (blue) - same as company cards */}
          <Factory className={`${iconSizes.md} text-blue-600`} />
          <span>{t('panels.hierarchy.projectHierarchy')}</span>
        </h3>
        <p className={`${colors.text.muted}`}>{t('panels.hierarchy.loading')}</p>
      </section>
    );
  }

  if (error) {
    return (
      // 🏢 ENTERPRISE: SPACING.MS = 6px padding, bg.card for darker background
      <section className={`${colors.bg.card} ${PANEL_LAYOUT.SPACING.MS} ${PANEL_LAYOUT.ROUNDED.LG} ${getStatusBorder('error')}`}>
        <h3 className={`${colors.text.inverse} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('panels.hierarchy.error')}</h3>
        <p className={`${colors.text.error}`}>{error}</p>
        {/* 🏢 ENTERPRISE: Centralized BaseButton for error retry */}
        <BaseButton
          variant="primary"
          size="sm"
          onClick={loadCompanies}
          className={PANEL_LAYOUT.MARGIN.TOP_SM}
        >
          {t('panels.hierarchy.retry')}
        </BaseButton>
      </section>
    );
  }

  return (
    // 🏢 ENTERPRISE: SPACING.MS = 6px padding, bg.card for darker background
    <article className={`${colors.bg.card} ${PANEL_LAYOUT.SPACING.MS} ${PANEL_LAYOUT.ROUNDED.LG} ${getStatusBorder('muted')}`}>
      <h3 className={`${colors.text.inverse} ${PANEL_LAYOUT.TYPOGRAPHY.LG} ${PANEL_LAYOUT.FONT_WEIGHT.SEMIBOLD} ${PANEL_LAYOUT.MARGIN.BOTTOM_LG} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        {/* 🏢 ENTERPRISE: Factory icon (blue) - same as company cards */}
        <Factory className={`${iconSizes.md} text-blue-600`} />
        <span>{t('panels.hierarchy.projectHierarchy')}</span>
      </h3>

      {/* Companies List */}
      <section className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}>
        <h4 className={`${colors.text.secondary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('panels.hierarchy.companies')} ({companies.length})</h4>
        {companies.length === 0 ? (
          <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.SM}`}>{t('panels.hierarchy.noCompanies')}</p>
        ) : (
          <nav className={`flex flex-col ${PANEL_LAYOUT.GAP.XS}`}>
            {/* 🏢 ENTERPRISE: Centralized ListCard - same as contacts/projects lists */}
            {companies.map(company => (
              <ListCard
                key={company.id}
                entityType="company"
                title={company.companyName}
                subtitle={company.industry}
                isSelected={selectedCompany?.id === company.id}
                onClick={() => selectCompany(company.id!)}
                compact
                hideStats
                className="[&_header]:!mb-0"
              />
            ))}
          </nav>
        )}
      </section>

      {/* Selected Company Info */}
      {selectedCompany && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_LG} ${getDirectionalBorder('warning', 'left')}`}>
          {/* ✅ ADR-003: Removed nested div - h4 is now directly flex */}
          <h4 className={`${colors.text.warning} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Building className={iconSizes.sm} />
            <span>{selectedCompany.companyName}</span>
          </h4>
          <address className={`${PANEL_LAYOUT.TYPOGRAPHY.XS} ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} not-italic`}>
            {selectedCompany.vatNumber && <span className="block">ΑΦΜ: {selectedCompany.vatNumber}</span>}
            {selectedCompany.legalForm && <span className="block">{selectedCompany.legalForm}</span>}
          </address>

          {/* Projects for Selected Company */}
          <nav className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
            <h5 className={`${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('panels.hierarchy.projects')} ({projects.length})</h5>
            {projects.length === 0 ? (
              <p className={`${colors.text.muted} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>{t('panels.hierarchy.noProjects')}</p>
            ) : (
              <menu className={`flex flex-col ${PANEL_LAYOUT.GAP.XS} list-none`}>
                {/* 🏢 ENTERPRISE: Centralized ListCard - same as projects list */}
                {projects.map(project => (
                  <li key={project.id} className="list-none">
                    <ListCard
                      entityType="project"
                      title={project.name}
                      subtitle={`${project.buildings.length} ${t('panels.hierarchy.buildingsCount', { count: project.buildings.length })}`}
                      isSelected={selectedProject?.id === project.id}
                      onClick={() => selectProject(project.id)}
                      compact
                      hideStats
                      className="[&_header]:!mb-0"
                    />
                  </li>
                ))}
              </menu>
            )}
          </nav>
        </section>
      )}

      {/* Selected Project Info */}
      {selectedProject && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_LG} ${getDirectionalBorder('success', 'left')}`}>
          {/* 🏢 ENTERPRISE: Construction icon (green) - same as project cards in NAVIGATION_ENTITIES */}
          <h4 className={`text-green-600 ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Construction className={iconSizes.sm} />
            <span>{selectedProject.name}</span>
          </h4>

          {/* Buildings */}
          {selectedProject.buildings.length > 0 && (
            <nav className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
              <h5 className={`${colors.text.secondary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>{t('panels.hierarchy.buildings')}</h5>
              {/* 🏢 ENTERPRISE: Centralized ListCard - same as buildings list */}
              <menu className={`flex flex-col ${PANEL_LAYOUT.GAP.XS} list-none`}>
                {selectedProject.buildings.map(building => (
                  <li key={building.id} className="list-none">
                    <ListCard
                      entityType="building"
                      title={building.name}
                      subtitle={`${building.floors.length} ${t('panels.hierarchy.floorsCount', { count: building.floors.length })}`}
                      isSelected={selectedBuilding?.id === building.id}
                      onClick={() => selectBuilding(building.id)}
                      compact
                      hideStats
                      className="[&_header]:!mb-0"
                    />
                  </li>
                ))}
              </menu>
            </nav>
          )}

          {/* Parking */}
          {selectedProject.parkingSpots && selectedProject.parkingSpots.length > 0 && (
            <aside className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <ParkingCircle className={iconSizes.sm} />
              <span>{t('panels.hierarchy.parkingSpots', { count: selectedProject.parkingSpots.length })}</span>
            </aside>
          )}
        </section>
      )}

      {/* Selected Building Info */}
      {selectedBuilding && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_XL} ${getDirectionalBorder('info', 'left')}`}>
          {/* 🏢 ENTERPRISE: Building icon (purple) - same as building cards in NAVIGATION_ENTITIES */}
          <h4 className={`text-purple-600 ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Building className={iconSizes.sm} />
            <span>{selectedBuilding.name}</span>
          </h4>

          {/* Floors */}
          {selectedBuilding.floors.length > 0 && (
            <nav className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
              <h5 className={`${colors.text.tertiary} ${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>{t('panels.hierarchy.floors')}</h5>
              {/* 🏢 ENTERPRISE: Centralized ListCard - same as floors/units list */}
              <menu className={`flex flex-col ${PANEL_LAYOUT.GAP.XS} list-none`}>
                {selectedBuilding.floors.map(floor => (
                  <li key={floor.id} className="list-none">
                    <ListCard
                      entityType="floor"
                      title={floor.name}
                      subtitle={`${Array.isArray(floor.units) ? floor.units.length : 0} ${t('panels.hierarchy.unitsCount', { count: Array.isArray(floor.units) ? floor.units.length : 0 })}`}
                      isSelected={selectedFloor?.id === floor.id}
                      onClick={() => selectFloor(floor.id)}
                      compact
                      hideStats
                      className="[&_header]:!mb-0"
                    />
                  </li>
                ))}
              </menu>
            </nav>
          )}

          {/* Storage Areas */}
          {selectedBuilding.storageAreas && selectedBuilding.storageAreas.length > 0 && (
            <aside className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${colors.text.muted} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <Package className={iconSizes.sm} />
              <span>{t('panels.hierarchy.storageAreas', { count: selectedBuilding.storageAreas.length })}</span>
            </aside>
          )}
        </section>
      )}

      {/* Selected Floor Info */}
      {selectedFloor && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_XXL} ${getDirectionalBorder('info', 'left')}`}>
          {/* ✅ ADR-003: Removed nested div - h4 is now directly flex */}
          <h4 className={`${colors.text.info} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Home className={iconSizes.sm} />
            <span>{selectedFloor.name}</span>
          </h4>
          <ul className={`${PANEL_LAYOUT.TYPOGRAPHY.SM} ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
            {Array.isArray(selectedFloor.units) ? selectedFloor.units.map(unit => (
              <li key={unit.id} className={`${colors.text.muted} flex justify-between`}>
                <span className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
                  <Home className={iconSizes.xs} />
                  <span>{unit.name}</span>
                </span>
                <span className={`${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${
                  unit.status === 'forSale' ? colors.bg.warning :
                  unit.status === 'sold' ? colors.bg.error :
                  unit.status === 'forRent' ? colors.bg.info :
                  unit.status === 'reserved' ? colors.bg.hover :
                  colors.bg.success
                }`}>
                  {unit.status}
                </span>
              </li>
            )) : (
              <li className={`${colors.text.disabled} ${PANEL_LAYOUT.TYPOGRAPHY.XS}`}>Δεν υπάρχουν διαθέσιμα units</li>
            )}
          </ul>
        </section>
      )}

      {/* Available Destinations */}
      <section className={`${PANEL_LAYOUT.MARGIN.TOP_XL} ${PANEL_LAYOUT.PADDING.TOP_LG} ${getDirectionalBorder('muted', 'top')}`}>
        {/* ✅ ADR-003: h4 with flex - clean semantic structure */}
        <h4 className={`${colors.text.tertiary} ${PANEL_LAYOUT.FONT_WEIGHT.MEDIUM} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Target className={`${iconSizes.sm} ${colors.text.info}`} />
          <span>{t('panels.hierarchy.availableDestinations')} ({destinations.length})</span>
        </h4>
        <ul className={`${PANEL_LAYOUT.MAX_HEIGHT.SM} ${PANEL_LAYOUT.OVERFLOW.Y_AUTO} ${PANEL_LAYOUT.TYPOGRAPHY.XS} ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
          {destinations.map(dest => (
            <li key={dest.id} className={`${colors.text.muted} flex justify-between`}>
              <span>{dest.label}</span>
              <span className={`${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} ${PANEL_LAYOUT.ROUNDED.DEFAULT} ${
                dest.type === 'project' ? colors.bg.info :
                dest.type === 'building' ? colors.bg.success :
                dest.type === 'floor' ? colors.bg.hover :
                dest.type === 'parking' ? colors.bg.warning :
                dest.type === 'storage' ? colors.bg.warning :
                colors.bg.secondary
              }`}>
                {dest.type}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}