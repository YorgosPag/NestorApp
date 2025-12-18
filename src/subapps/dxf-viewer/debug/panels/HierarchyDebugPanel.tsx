'use client';
import React from 'react';
import { Building, Building2, FolderIcon, Home, Package, ParkingCircle, Target } from 'lucide-react';
import { CraneIcon } from '../../components/icons';
import { useProjectHierarchy } from '../../contexts/ProjectHierarchyContext';
import { useTranslation } from '../../../../i18n';
import { HOVER_BACKGROUND_EFFECTS } from '@/components/ui/effects';

export function HierarchyDebugPanel() {
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
      <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
        <h3 className="text-white text-lg font-semibold mb-2 flex items-center space-x-2">
          <CraneIcon className="h-5 w-5 text-orange-500" />
          <span>{t('panels.hierarchy.projectHierarchy')}</span>
        </h3>
        <p className="text-gray-400">{t('panels.hierarchy.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-4 rounded-lg border border-red-600">
        <h3 className="text-white text-lg font-semibold mb-2">{t('panels.hierarchy.error')}</h3>
        <p className="text-red-400">{error}</p>
        <button 
          onClick={loadCompanies}
          className={`mt-2 px-3 py-1 bg-blue-600 text-white rounded ${HOVER_BACKGROUND_EFFECTS.BLUE_BUTTON}`}
        >
          {t('panels.hierarchy.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg border border-gray-600">
      <h3 className="text-white text-lg font-semibold mb-4 flex items-center space-x-2">
        <CraneIcon className="h-5 w-5 text-orange-500" />
        <span>{t('panels.hierarchy.projectHierarchy')}</span>
      </h3>
      
      {/* Companies List */}
      <div className="mb-4">
        <h4 className="text-gray-300 font-medium mb-2">{t('panels.hierarchy.companies')} ({companies.length})</h4>
        {companies.length === 0 ? (
          <p className="text-gray-500 text-sm">{t('panels.hierarchy.noCompanies')}</p>
        ) : (
          <div className="space-y-1">
            {companies.map(company => (
              <button
                key={company.id}
                onClick={() => selectCompany(company.id!)}
                className={`w-full text-left px-2 py-1 rounded text-sm ${
                  selectedCompany?.id === company.id 
                    ? 'bg-orange-600 text-white' 
                    : `bg-gray-700 text-gray-300 ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                }`}
              >
                <Building className="h-4 w-4 inline mr-1" />{company.companyName}
                <span className="text-xs ml-2 opacity-70">
                  {company.industry}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Company Info */}
      {selectedCompany && (
        <div className="mb-4 pl-4 border-l-2 border-orange-500">
          <h4 className="text-orange-300 font-medium mb-2">
            <div className="flex items-center space-x-2">
              <Building className="h-4 w-4" />
              <span>{selectedCompany.companyName}</span>
            </div>
          </h4>
          <div className="text-xs text-gray-400 mb-2">
            {selectedCompany.vatNumber && <div>ΑΦΜ: {selectedCompany.vatNumber}</div>}
            {selectedCompany.legalForm && <div>{selectedCompany.legalForm}</div>}
          </div>
          
          {/* Projects for Selected Company */}
          <div className="mb-3">
            <h5 className="text-gray-300 text-sm font-medium mb-2">{t('panels.hierarchy.projects')} ({projects.length})</h5>
            {projects.length === 0 ? (
              <p className="text-gray-500 text-xs">{t('panels.hierarchy.noProjects')}</p>
            ) : (
              <div className="space-y-1">
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => selectProject(project.id)}
                    className={`w-full text-left px-2 py-1 rounded text-sm ${
                      selectedProject?.id === project.id 
                        ? 'bg-blue-600 text-white' 
                        : `bg-gray-700 text-gray-300 ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                    }`}
                  >
                    <FolderIcon className="h-4 w-4 inline mr-1" />{project.name}
                    <span className="text-xs ml-2 opacity-70">
                      ({project.buildings.length} {t('panels.hierarchy.buildingsCount', { count: project.buildings.length })})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected Project Info */}
      {selectedProject && (
        <div className="mb-4 pl-4 border-l-2 border-blue-500">
          <h4 className="text-blue-300 font-medium mb-2">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>{selectedProject.name}</span>
            </div>
          </h4>
          
          {/* Buildings */}
          {selectedProject.buildings.length > 0 && (
            <div className="mb-3">
              <h5 className="text-gray-300 text-sm font-medium mb-1">{t('panels.hierarchy.buildings')}</h5>
              <div className="space-y-1">
                {selectedProject.buildings.map(building => (
                  <button
                    key={building.id}
                    onClick={() => selectBuilding(building.id)}
                    className={`w-full text-left px-2 py-1 rounded text-sm ${
                      selectedBuilding?.id === building.id 
                        ? 'bg-green-600 text-white' 
                        : `bg-gray-700 text-gray-300 ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                    }`}
                  >
                    <Building2 className="h-4 w-4 inline mr-1" />{building.name}
                    <span className="text-xs ml-2 opacity-70">
                      ({building.floors.length} {t('panels.hierarchy.floorsCount', { count: building.floors.length })})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parking */}
          {selectedProject.parkingSpots && selectedProject.parkingSpots.length > 0 && (
            <div className="text-sm text-gray-400 flex items-center space-x-2">
              <ParkingCircle className="h-4 w-4" />
              <span>{t('panels.hierarchy.parkingSpots', { count: selectedProject.parkingSpots.length })}</span>
            </div>
          )}
        </div>
      )}

      {/* Selected Building Info */}
      {selectedBuilding && (
        <div className="mb-4 pl-8 border-l-2 border-green-500">
          <h4 className="text-green-300 font-medium mb-2">
            <div className="flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>{selectedBuilding.name}</span>
            </div>
          </h4>
          
          {/* Floors */}
          {selectedBuilding.floors.length > 0 && (
            <div className="mb-3">
              <h5 className="text-gray-300 text-sm font-medium mb-1">{t('panels.hierarchy.floors')}</h5>
              <div className="space-y-1">
                {selectedBuilding.floors.map(floor => (
                  <button
                    key={floor.id}
                    onClick={() => selectFloor(floor.id)}
                    className={`w-full text-left px-2 py-1 rounded text-sm ${
                      selectedFloor?.id === floor.id 
                        ? 'bg-purple-600 text-white' 
                        : `bg-gray-700 text-gray-300 ${HOVER_BACKGROUND_EFFECTS.GRAY_PANEL}`
                    }`}
                  >
                    <Home className="h-4 w-4 inline mr-1" />{floor.name}
                    <span className="text-xs ml-2 opacity-70">
                      ({Array.isArray(floor.units) ? floor.units.length : 0} {t('panels.hierarchy.unitsCount', { count: Array.isArray(floor.units) ? floor.units.length : 0 })})
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Storage Areas */}
          {selectedBuilding.storageAreas && selectedBuilding.storageAreas.length > 0 && (
            <div className="text-sm text-gray-400 flex items-center space-x-2">
              <Package className="h-4 w-4" />
              <span>{t('panels.hierarchy.storageAreas', { count: selectedBuilding.storageAreas.length })}</span>
            </div>
          )}
        </div>
      )}

      {/* Selected Floor Info */}
      {selectedFloor && (
        <div className="mb-4 pl-12 border-l-2 border-purple-500">
          <h4 className="text-purple-300 font-medium mb-2">
            <div className="flex items-center space-x-2">
              <Home className="h-4 w-4" />
              <span>{selectedFloor.name}</span>
            </div>
          </h4>
          <div className="text-sm space-y-1">
            {Array.isArray(selectedFloor.units) ? selectedFloor.units.map(unit => (
              <div key={unit.id} className="text-gray-400 flex justify-between">
                <span className="flex items-center space-x-1">
                  <Home className="h-3 w-3" />
                  <span>{unit.name}</span>
                </span>
                <span className={`px-1 rounded text-xs ${
                  unit.status === 'forSale' ? 'bg-orange-800' :
                  unit.status === 'sold' ? 'bg-red-800' :
                  unit.status === 'forRent' ? 'bg-blue-800' :
                  unit.status === 'reserved' ? 'bg-purple-800' :
                  'bg-green-800'
                }`}>
                  {unit.status}
                </span>
              </div>
            )) : (
              <div className="text-gray-500 text-xs">Δεν υπάρχουν διαθέσιμα units</div>
            )}
          </div>
        </div>
      )}

      {/* Available Destinations */}
      <div className="mt-6 pt-4 border-t border-gray-600">
        <h4 className="text-gray-300 font-medium mb-2 flex items-center space-x-2">
          <Target className="h-4 w-4 text-blue-400" />
          <span>{t('panels.hierarchy.availableDestinations')} ({destinations.length})</span>
        </h4>
        <div className="max-h-32 overflow-y-auto text-xs space-y-1">
          {destinations.map(dest => (
            <div key={dest.id} className="text-gray-400 flex justify-between">
              <span>{dest.label}</span>
              <span className={`px-1 rounded ${
                dest.type === 'project' ? 'bg-blue-800' :
                dest.type === 'building' ? 'bg-green-800' :
                dest.type === 'floor' ? 'bg-purple-800' :
                dest.type === 'parking' ? 'bg-yellow-800' :
                dest.type === 'storage' ? 'bg-orange-800' :
                'bg-gray-800'
              }`}>
                {dest.type}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}