'use client';
import React from 'react';
import { useIconSizes } from '@/hooks/useIconSizes';
import { useBorderTokens } from '@/hooks/useBorderTokens';
import { useSemanticColors } from '@/hooks/useSemanticColors';  // ✅ ENTERPRISE: Background centralization - ZERO DUPLICATES
import { Building, Building2, FolderIcon, Home, Package, ParkingCircle, Target } from 'lucide-react';
import { CraneIcon } from '../../components/icons';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { useTranslation } from '../../../../i18n';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

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
      <section className={`${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.LG} rounded-lg ${getStatusBorder('muted')}`}>
        <h3 className={`text-white text-lg font-semibold ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <CraneIcon className={`${iconSizes.md} ${colors.text.warning}`} />
          <span>{t('panels.hierarchy.projectHierarchy')}</span>
        </h3>
        <p className={`${colors.text.muted}`}>{t('panels.hierarchy.loading')}</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className={`${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.LG} rounded-lg ${getStatusBorder('error')}`}>
        <h3 className={`text-white text-lg font-semibold ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('panels.hierarchy.error')}</h3>
        <p className={`${colors.text.error}`}>{error}</p>
        <button
          onClick={loadCompanies}
          className={`${PANEL_LAYOUT.MARGIN.TOP_SM} ${PANEL_LAYOUT.BUTTON.PADDING_COMPACT} ${colors.bg.info} text-white rounded ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`}
        >
          {t('panels.hierarchy.retry')}
        </button>
      </section>
    );
  }

  return (
    <article className={`${colors.bg.secondary} ${PANEL_LAYOUT.SPACING.LG} rounded-lg ${getStatusBorder('muted')}`}>
      <h3 className={`text-white text-lg font-semibold ${PANEL_LAYOUT.MARGIN.BOTTOM_LG} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
        <CraneIcon className={`${iconSizes.md} ${colors.text.warning}`} />
        <span>{t('panels.hierarchy.projectHierarchy')}</span>
      </h3>

      {/* Companies List */}
      <section className={PANEL_LAYOUT.MARGIN.BOTTOM_LG}>
        <h4 className={`${colors.text.secondary} font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('panels.hierarchy.companies')} ({companies.length})</h4>
        {companies.length === 0 ? (
          <p className={`${colors.text.muted} text-sm`}>{t('panels.hierarchy.noCompanies')}</p>
        ) : (
          <nav className={PANEL_LAYOUT.SPACING.GAP_XS}>
            {companies.map(company => (
              <button
                key={company.id}
                onClick={() => selectCompany(company.id!)}
                className={`w-full text-left ${PANEL_LAYOUT.SPACING.COMPACT} rounded text-sm ${
                  selectedCompany?.id === company.id
                    ? `${colors.bg.warning} text-white`
                    : `${colors.bg.hover} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                }`}
              >
                <Building className={`${iconSizes.sm} inline ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />{company.companyName}
                <span className={`text-xs ${PANEL_LAYOUT.SPACING.GAP_H_SM} opacity-70`}>
                  {company.industry}
                </span>
              </button>
            ))}
          </nav>
        )}
      </section>

      {/* Selected Company Info */}
      {selectedCompany && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_LG} ${getDirectionalBorder('warning', 'left')}`}>
          {/* ✅ ADR-003: Removed nested div - h4 is now directly flex */}
          <h4 className={`${colors.text.warning} font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Building className={iconSizes.sm} />
            <span>{selectedCompany.companyName}</span>
          </h4>
          <address className={`text-xs ${colors.text.muted} ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} not-italic`}>
            {selectedCompany.vatNumber && <span className="block">ΑΦΜ: {selectedCompany.vatNumber}</span>}
            {selectedCompany.legalForm && <span className="block">{selectedCompany.legalForm}</span>}
          </address>

          {/* Projects for Selected Company */}
          <nav className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
            <h5 className={`${colors.text.secondary} text-sm font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM}`}>{t('panels.hierarchy.projects')} ({projects.length})</h5>
            {projects.length === 0 ? (
              <p className={`${colors.text.muted} text-xs`}>{t('panels.hierarchy.noProjects')}</p>
            ) : (
              <menu className={PANEL_LAYOUT.SPACING.GAP_XS}>
                {projects.map(project => (
                  <li key={project.id} className="list-none">
                    <button
                      onClick={() => selectProject(project.id)}
                      className={`w-full text-left ${PANEL_LAYOUT.SPACING.COMPACT} rounded text-sm ${
                        selectedProject?.id === project.id
                          ? `${colors.bg.info} text-white`
                          : `${colors.bg.hover} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                      }`}
                    >
                      <FolderIcon className={`${iconSizes.sm} inline ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />{project.name}
                      <span className={`text-xs ${PANEL_LAYOUT.SPACING.GAP_H_SM} opacity-70`}>
                        ({project.buildings.length} {t('panels.hierarchy.buildingsCount', { count: project.buildings.length })})
                      </span>
                    </button>
                  </li>
                ))}
              </menu>
            )}
          </nav>
        </section>
      )}

      {/* Selected Project Info */}
      {selectedProject && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_LG} ${getDirectionalBorder('info', 'left')}`}>
          {/* ✅ ADR-003: Removed nested div - h4 is now directly flex */}
          <h4 className={`${colors.text.info} font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Building2 className={iconSizes.sm} />
            <span>{selectedProject.name}</span>
          </h4>

          {/* Buildings */}
          {selectedProject.buildings.length > 0 && (
            <nav className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
              <h5 className={`${colors.text.secondary} text-sm font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>{t('panels.hierarchy.buildings')}</h5>
              <menu className={PANEL_LAYOUT.SPACING.GAP_XS}>
                {selectedProject.buildings.map(building => (
                  <li key={building.id} className="list-none">
                    <button
                      onClick={() => selectBuilding(building.id)}
                      className={`w-full text-left ${PANEL_LAYOUT.SPACING.COMPACT} rounded text-sm ${
                        selectedBuilding?.id === building.id
                          ? `${colors.bg.success} text-white`
                          : `${colors.bg.hover} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                      }`}
                    >
                      <Building2 className={`${iconSizes.sm} inline ${PANEL_LAYOUT.MARGIN.LEFT_HALF}`} />{building.name}
                      <span className={`text-xs ${PANEL_LAYOUT.SPACING.GAP_H_SM} opacity-70`}>
                        ({building.floors.length} {t('panels.hierarchy.floorsCount', { count: building.floors.length })})
                      </span>
                    </button>
                  </li>
                ))}
              </menu>
            </nav>
          )}

          {/* Parking */}
          {selectedProject.parkingSpots && selectedProject.parkingSpots.length > 0 && (
            <aside className={`text-sm ${colors.text.muted} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
              <ParkingCircle className={iconSizes.sm} />
              <span>{t('panels.hierarchy.parkingSpots', { count: selectedProject.parkingSpots.length })}</span>
            </aside>
          )}
        </section>
      )}

      {/* Selected Building Info */}
      {selectedBuilding && (
        <section className={`${PANEL_LAYOUT.MARGIN.BOTTOM_LG} ${PANEL_LAYOUT.MARGIN.LEFT_XL} ${getDirectionalBorder('success', 'left')}`}>
          {/* ✅ ADR-003: Removed nested div - h4 is now directly flex */}
          <h4 className={`${colors.text.success} font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Building2 className={iconSizes.sm} />
            <span>{selectedBuilding.name}</span>
          </h4>

          {/* Floors */}
          {selectedBuilding.floors.length > 0 && (
            <nav className={PANEL_LAYOUT.MARGIN.BOTTOM_MD}>
              <h5 className={`${colors.text.tertiary} text-sm font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_XS}`}>{t('panels.hierarchy.floors')}</h5>
              <menu className={PANEL_LAYOUT.SPACING.GAP_XS}>
                {selectedBuilding.floors.map(floor => (
                  <li key={floor.id} className="list-none">
                    <button
                      onClick={() => selectFloor(floor.id)}
                      className={`w-full text-left ${PANEL_LAYOUT.SPACING.COMPACT} rounded text-sm ${
                        selectedFloor?.id === floor.id
                          ? `${colors.bg.info} text-white`
                          : `${colors.bg.hover} ${colors.text.secondary} ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                      }`}
                    >
                      <Home className={`${iconSizes.sm} inline ${PANEL_LAYOUT.MARGIN.RIGHT_XS}`} />{floor.name}
                      <span className={`text-xs ${PANEL_LAYOUT.MARGIN.LEFT_SM} opacity-70`}>
                      ({Array.isArray(floor.units) ? floor.units.length : 0} {t('panels.hierarchy.unitsCount', { count: Array.isArray(floor.units) ? floor.units.length : 0 })})
                      </span>
                    </button>
                  </li>
                ))}
              </menu>
            </nav>
          )}

          {/* Storage Areas */}
          {selectedBuilding.storageAreas && selectedBuilding.storageAreas.length > 0 && (
            <aside className={`text-sm ${colors.text.muted} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
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
          <h4 className={`${colors.text.info} font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
            <Home className={iconSizes.sm} />
            <span>{selectedFloor.name}</span>
          </h4>
          <ul className={`text-sm ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
            {Array.isArray(selectedFloor.units) ? selectedFloor.units.map(unit => (
              <li key={unit.id} className={`${colors.text.muted} flex justify-between`}>
                <span className={`flex items-center ${PANEL_LAYOUT.GAP.XS}`}>
                  <Home className={iconSizes.xs} />
                  <span>{unit.name}</span>
                </span>
                <span className={`${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} rounded text-xs ${
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
              <li className={`${colors.text.disabled} text-xs`}>Δεν υπάρχουν διαθέσιμα units</li>
            )}
          </ul>
        </section>
      )}

      {/* Available Destinations */}
      <section className={`${PANEL_LAYOUT.MARGIN.TOP_XL} ${PANEL_LAYOUT.PADDING.TOP_LG} ${getDirectionalBorder('muted', 'top')}`}>
        {/* ✅ ADR-003: h4 with flex - clean semantic structure */}
        <h4 className={`${colors.text.tertiary} font-medium ${PANEL_LAYOUT.MARGIN.BOTTOM_SM} flex items-center ${PANEL_LAYOUT.GAP.SM}`}>
          <Target className={`${iconSizes.sm} ${colors.text.info}`} />
          <span>{t('panels.hierarchy.availableDestinations')} ({destinations.length})</span>
        </h4>
        <ul className={`max-h-32 overflow-y-auto text-xs ${PANEL_LAYOUT.SPACING.GAP_XS}`}>
          {destinations.map(dest => (
            <li key={dest.id} className={`${colors.text.muted} flex justify-between`}>
              <span>{dest.label}</span>
              <span className={`${PANEL_LAYOUT.SPACING.HORIZONTAL_XS} rounded ${
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