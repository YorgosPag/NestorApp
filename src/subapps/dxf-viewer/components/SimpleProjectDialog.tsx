'use client';
import React, { useState, useEffect } from 'react';
import { useProjectHierarchy, type Building, type Unit } from '../contexts/ProjectHierarchyContext';
import { useFloorplan } from '../../../contexts/FloorplanContext';
import { dxfImportService } from '../io/dxf-import';
import { FloorplanService } from '../../../services/floorplans/FloorplanService';
import { BuildingFloorplanService } from '../../../services/floorplans/BuildingFloorplanService';
import { UnitFloorplanService } from '../../../services/floorplans/UnitFloorplanService';
import { useNotifications } from '../../../providers/NotificationProvider';
import DxfImportModal from './DxfImportModal';
import type { SceneModel } from '../types/scene';
import { HOVER_TEXT_EFFECTS, INTERACTIVE_PATTERNS, FORM_BUTTON_EFFECTS } from '@/components/ui/effects';

interface SimpleProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onFileImport?: (file: File) => Promise<void>;
}

type DialogStep = 'company' | 'project' | 'building' | 'unit';

export function SimpleProjectDialog({ isOpen, onClose, onFileImport }: SimpleProjectDialogProps) {
  const {
    companies,
    selectedCompany,
    projects,
    selectedProject,
    loading,
    error,
    loadCompanies,
    selectCompany,
    loadProjectsForCompany,
    selectProject
  } = useProjectHierarchy();

  const { setProjectFloorplan, setParkingFloorplan } = useFloorplan();

  const [currentStep, setCurrentStep] = useState<DialogStep>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [units, setUnits] = useState<Unit[]>([]);

  // DXF Import Modal state
  const [showDxfModal, setShowDxfModal] = useState(false);
  const [currentFloorplanType, setCurrentFloorplanType] = useState<'project' | 'parking' | 'building' | 'storage' | 'unit'>('project');

  // Confirmation toast hook - TEMPORARY FIX: showConfirmDialog not available
  // const { showConfirmDialog } = useNotifications();

  // Real DXF parsing for project tabs using the same service as canvas
  const parseDxfForProjectTab = async (file: File, encoding?: string): Promise<SceneModel | null> => {

    try {
      const result = await dxfImportService.importDxfFile(file, encoding);
      if (result.success && result.scene) {

        return result.scene;
      } else {
        console.warn('⚠️ DXF parsing failed for project tab:', result.error);
        return null;
      }
    } catch (error) {
      console.error('❌ Error parsing DXF for project tab:', error);
      return null;
    }
  };

  // Auto-load companies when dialog opens
  useEffect(() => {
    if (isOpen && companies.length === 0) {

      loadCompanies();
    }
  }, [isOpen, companies.length, loadCompanies]);

  // Reset selection when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentStep('company');
      setSelectedCompanyId('');
      setSelectedProjectId('');
      setSelectedBuildingId('');
      setBuildings([]);
    }
  }, [isOpen]);

  // Load buildings when project is selected
  const loadBuildingsForProject = async (projectId: string) => {
    try {

      const selectedProjectData = projects.find(p => p.id === projectId);
      if (selectedProjectData?.buildings) {
        setBuildings(selectedProjectData.buildings);

      } else {
        setBuildings([]);

      }
    } catch (error) {
      console.error('🔺 Failed to load buildings:', error);
      setBuildings([]);
    }
  };

  const handleCompanyChange = (companyId: string) => {

    setSelectedCompanyId(companyId);
    if (companyId) {
      selectCompany(companyId);
    }
  };

  const handleProjectChange = (projectId: string) => {

    setSelectedProjectId(projectId);
    if (projectId) {
      selectProject(projectId);
    }
  };

  const handleNext = async () => {
    if (currentStep === 'company' && selectedCompanyId) {

      setCurrentStep('project');
      
      // Load projects for the selected company
      try {
        await loadProjectsForCompany(selectedCompanyId);

      } catch (error) {
        console.error('🔺 Failed to load projects:', error);
      }
    } else if (currentStep === 'project' && selectedProjectId) {

      setCurrentStep('building');
      
      // Load buildings for the selected project
      await loadBuildingsForProject(selectedProjectId);
    } else if (currentStep === 'building' && selectedBuildingId) {

      setCurrentStep('unit');
      
      // Units are already loaded by handleBuildingChange
    }
  };

  const handleBack = () => {
    if (currentStep === 'project') {
      setCurrentStep('company');
    } else if (currentStep === 'building') {
      setCurrentStep('project');
    } else if (currentStep === 'unit') {
      setCurrentStep('building');
    }
  };

  const handleBuildingChange = async (buildingId: string) => {

    setSelectedBuildingId(buildingId);
    
    // Load units for selected building
    if (buildingId) {
      await loadUnitsForBuilding(buildingId);
    } else {
      setUnits([]);
      setSelectedUnitId('');
    }
  };

  const loadUnitsForBuilding = async (buildingId: string) => {
    try {

      // Fetch units from API
      const response = await fetch('/api/units');
      if (!response.ok) {
        throw new Error(`Failed to fetch units: ${response.statusText}`);
      }
      
      const result = await response.json();
      if (result.success) {

        // Filter units that belong to the selected building
        const buildingUnits = result.units.filter((unit: Unit) =>
          unit.buildingId === buildingId || unit.building === buildingId
        );
        
        setUnits(buildingUnits);

        if (buildingUnits.length === 0) {

          const allBuildingIds = [...new Set(result.units.map((u: Unit) => u.buildingId))];

        }
      } else {
        throw new Error(result.error || 'Failed to fetch units');
      }
    } catch (error) {
      console.error('❌ Error loading units for building:', error);
      setUnits([]);
    }
  };

  const handleUnitChange = (unitId: string) => {

    setSelectedUnitId(unitId);
  };

  const handleClose = () => {
    setCurrentStep('company');
    setSelectedCompanyId('');
    setSelectedProjectId('');
    setSelectedBuildingId('');
    setBuildings([]);
    setSelectedUnitId('');
    setUnits([]);
    onClose();
  };

  // Handle DXF import with encoding from modal
  const handleDxfImportFromModal = async (file: File, encoding: string) => {
    console.log('🔺 SimpleProjectDialog.handleDxfImportFromModal called:', {
      fileName: file.name,
      encoding,
      currentStep,
      currentFloorplanType,
      selectedProjectId,
      selectedBuildingId,
      selectedUnitId
    });

    const type = currentFloorplanType;
    const targetId = currentStep === 'unit' ? selectedUnitId :
                    (currentStep === 'building' ? selectedBuildingId : selectedProjectId);
    const targetType = currentStep === 'unit' ? 'unit' :
                      (currentStep === 'building' ? 'building' : 'project');

    try {
      // Check if floorplan already exists before proceeding
      let hasExisting = false;
      
      if (currentStep === 'unit' && type === 'unit') {
        hasExisting = await UnitFloorplanService.hasFloorplan(selectedUnitId);
      } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
        hasExisting = await BuildingFloorplanService.hasFloorplan(selectedBuildingId, type as 'building' | 'storage');
      } else {
        hasExisting = await FloorplanService.hasFloorplan(selectedProjectId, type as 'project' | 'parking');
      }
      
      // If floorplan exists, show confirmation dialog
      if (hasExisting) {
        const typeLabels = {
          project: 'Κάτοψη Έργου',
          parking: 'Κάτοψη Θ.Σ.',
          building: 'Κάτοψη Κτηρίου',
          storage: 'Κάτοψη Αποθηκών',
          unit: 'Κάτοψη Μονάδας'
        };
        
        // TEMPORARY FIX: Use browser confirm instead of showConfirmDialog
        const confirmed = confirm(
          `Αντικατάσταση ${typeLabels[type as keyof typeof typeLabels]}\n\n` +
          `Υπάρχει ήδη αποθηκευμένη ${typeLabels[type as keyof typeof typeLabels]} για αυτή την εταιρεία.\n\n` +
          `Η νέα κάτοψη που θα φορτώσετε ενδέχεται να μην ταιριάζει με τα υπάρχοντα layers που έχουν σχεδιαστεί πάνω στην προηγούμενη κάτοψη.\n\n` +
          `Θέλετε να συνεχίσετε και να αντικαταστήσετε την υπάρχουσα κάτοψη;`
        );
        
        if (!confirmed) {

          return;
        }
      }
      
      // Use the same mechanism as Upload DXF File button to load to canvas
      console.log('🔺 SimpleProjectDialog calling onFileImport with file:', {
        fileName: file.name,
        hasOnFileImport: !!onFileImport
      });

      if (onFileImport) {
        await onFileImport(file);
        console.log('🔺 SimpleProjectDialog onFileImport completed');
      } else {
        console.warn('🔺 SimpleProjectDialog: onFileImport callback not provided!');
      }
      
      // Also parse and store for project tab using real DXF parser with encoding
      const scene = await parseDxfForProjectTab(file, encoding);
      
      if (scene) {
        const floorplanData = {
          projectId: selectedProjectId,
          buildingId: currentStep === 'building' ? selectedBuildingId : undefined,
          type,
          scene,
          fileName: file.name,
          timestamp: Date.now(),
          encoding: encoding // Store the encoding used
        };
        
        // Save to Firestore (persistent storage) - use appropriate service
        let saved = false;
        if (currentStep === 'unit' && type === 'unit') {
          const unitData = {
            unitId: selectedUnitId,
            type: 'unit' as const,
            scene,
            fileName: file.name,
            timestamp: Date.now(),
            encoding: encoding
          };
          saved = await UnitFloorplanService.saveFloorplan(selectedUnitId, unitData);
        } else if (currentStep === 'building' && (type === 'building' || type === 'storage')) {
          const buildingData = {
            buildingId: selectedBuildingId,
            type: type as 'building' | 'storage',
            scene,
            fileName: file.name,
            timestamp: Date.now(),
            encoding: encoding
          };
          saved = await BuildingFloorplanService.saveFloorplan(selectedBuildingId, type as 'building' | 'storage', buildingData);
        } else {
          saved = await FloorplanService.saveFloorplan(selectedProjectId, type as 'project' | 'parking', floorplanData);
        }
        
        if (saved) {

          // Store in context for immediate access
          if (type === 'project') {
            setProjectFloorplan(selectedProjectId, floorplanData);
          } else if (type === 'parking') {
            setParkingFloorplan(selectedProjectId, floorplanData);
          }
        } else {
          console.error(`❌ Failed to save ${type} floorplan to Firestore`);
        }
      } else {
        console.warn('⚠️ Could not parse DXF for project tab - no scene data');
      }
      
    } catch (error) {
      console.error(`❌ Failed to load ${type} floorplan:`, error);
    }
    
    // Close modals after processing
    setShowDxfModal(false);
    handleClose();
  };

  const handleLoadFloorplan = (type: 'project' | 'parking' | 'building' | 'storage' | 'unit') => {

    setCurrentFloorplanType(type);
    setShowDxfModal(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50">
      <dialog className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl max-w-md w-full mx-4" open={isOpen}>

        {/* Header */}
        <header className="p-6 border-b border-gray-600">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔺</span>
              <div>
                <h1 className="text-xl font-semibold text-white">Enhanced DXF Import</h1>
                <p className="text-gray-400 text-sm">
                  {currentStep === 'company' ? 'Βήμα 1: Επιλογή Εταιρείας' :
                   currentStep === 'project' ? 'Βήμα 2: Επιλογή Έργου' : 'Βήμα 3: Επιλογή Κτιρίου'}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className={`text-gray-400 text-2xl ${HOVER_TEXT_EFFECTS.WHITE}`}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="p-6">

          {/* Company Selection - Step 1 */}
          {currentStep === 'company' && (
            <fieldset className="mb-6">
              <legend className="block text-white font-medium mb-3">
                Επιλογή Εταιρείας
              </legend>
            
            {loading ? (
              <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-gray-300">Φόρτωση εταιρειών...</span>
              </div>
            ) : error ? (
              <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
                <p className="text-red-300 text-sm mb-2">Σφάλμα φόρτωσης: {error}</p>
                <button
                  onClick={loadCompanies}
                  className={`px-3 py-1 bg-red-600 text-white text-sm rounded ${FORM_BUTTON_EFFECTS.DESTRUCTIVE}`}
                >
                  Ξαναδοκιμή
                </button>
              </div>
            ) : (
              <select
                value={selectedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                style={{
                  backgroundColor: '#374151',
                  color: 'white'
                }}
              >
                <option value="" style={{ backgroundColor: '#374151', color: 'white' }}>
                  -- Επιλέξτε Εταιρεία --
                </option>
                {companies.map(company => (
                  <option 
                    key={company.id} 
                    value={company.id}
                    style={{ backgroundColor: '#374151', color: 'white' }}
                  >
                    {company.companyName}
                    {company.industry && ` (${company.industry})`}
                  </option>
                ))}
              </select>
            )}
            
              {companies.length === 0 && !loading && !error && (
                <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                  <p className="text-gray-300 text-sm">Δεν βρέθηκαν εταιρείες στο σύστημα.</p>
                </div>
              )}
            </fieldset>
          )}

          {/* Project Selection - Step 2 */}
          {currentStep === 'project' && (
            <div className="mb-6">
              <label className="block text-white font-medium mb-3">
                Επιλογή Έργου
              </label>

              {/* Selected Company Info */}
              {selectedCompany && (
                <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">🏢</span>
                    <div>
                      <p className="text-white text-sm font-medium">{selectedCompany.companyName}</p>
                      <p className="text-blue-300 text-xs">{selectedCompany.industry}</p>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center space-x-3 p-3 bg-gray-700 rounded-lg">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                  <span className="text-gray-300">Φόρτωση έργων...</span>
                </div>
              ) : error ? (
                <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
                  <p className="text-red-300 text-sm mb-2">Σφάλμα φόρτωσης έργων: {error}</p>
                </div>
              ) : (
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  style={{
                    backgroundColor: '#374151',
                    color: 'white'
                  }}
                >
                  <option value="" style={{ backgroundColor: '#374151', color: 'white' }}>
                    -- Επιλέξτε Έργο --
                  </option>
                  {projects.map(project => (
                    <option 
                      key={project.id} 
                      value={project.id}
                      style={{ backgroundColor: '#374151', color: 'white' }}
                    >
                      {project.name}
                      {project.buildings.length > 0 && ` (${project.buildings.length} κτίρια)`}
                    </option>
                  ))}
                </select>
              )}

              {projects.length === 0 && !loading && !error && selectedCompany && (
                <div className="mt-3 p-3 bg-gray-700 rounded-lg">
                  <p className="text-gray-300 text-sm">Δεν βρέθηκαν έργα για την επιλεγμένη εταιρεία.</p>
                </div>
              )}
            </div>
          )}

          {/* Building Selection - Step 3 */}
          {currentStep === 'building' && (
            <div className="mb-6">
              <label className="block text-white font-medium mb-3">
                Επιλογή Κτιρίου
              </label>

              {/* Selected Company & Project Info */}
              {selectedCompany && selectedProject && (
                <div className="mb-4 space-y-3">
                  <div className="p-3 bg-blue-900/20 border border-blue-600 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🏢</span>
                      <div>
                        <p className="text-white text-sm font-medium">{selectedCompany.companyName}</p>
                        <p className="text-blue-300 text-xs">{selectedCompany.industry}</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-green-900/20 border border-green-600 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">🏗️</span>
                      <div>
                        <p className="text-white text-sm font-medium">{selectedProject.name}</p>
                        <p className="text-green-300 text-xs">{selectedProject.buildings?.length || 0} κτίρια</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {buildings.length > 0 ? (
                <select
                  value={selectedBuildingId}
                  onChange={(e) => handleBuildingChange(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  style={{
                    backgroundColor: '#374151',
                    color: 'white'
                  }}
                >
                  <option value="" style={{ backgroundColor: '#374151', color: 'white' }}>
                    -- Επιλέξτε Κτίριο --
                  </option>
                  {buildings.map(building => (
                    <option 
                      key={building.id} 
                      value={building.id}
                      style={{ backgroundColor: '#374151', color: 'white' }}
                    >
                      {building.name}
                      {building.floors && ` (${building.floors.length} όροφοι)`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-gray-700 rounded-lg">
                  <p className="text-gray-300 text-sm">Δεν βρέθηκαν κτίρια για το επιλεγμένο έργο.</p>
                </div>
              )}
            </div>
          )}

          {/* Status */}
          <div className="text-center text-gray-400 text-sm">
            {currentStep === 'company' && companies.length > 0 && !loading && (
              <p>Βρέθηκαν {companies.length} διαθέσιμες εταιρείες</p>
            )}
            {currentStep === 'project' && projects.length > 0 && !loading && (
              <p>Βρέθηκαν {projects.length} έργα για την επιλεγμένη εταιρεία</p>
            )}
            {currentStep === 'building' && buildings.length > 0 && (
              <p>Βρέθηκαν {buildings.length} κτίρια για το επιλεγμένο έργο</p>
            )}
            {currentStep === 'unit' && units.length > 0 && (
              <p>Βρέθηκαν {units.length} μονάδες για το επιλεγμένο κτίριο</p>
            )}
          </div>

          {/* Floorplan Options - Only shown when project is selected */}
          {currentStep === 'project' && selectedProjectId && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border-t border-gray-600">
              <h3 className="text-white font-medium mb-3 text-center">Επιλέξτε Κάτοψη για Φόρτωση</h3>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleLoadFloorplan('project')}
                  className={`px-4 py-2 bg-blue-600 text-white rounded font-medium flex-1 max-w-[160px] ${FORM_BUTTON_EFFECTS.PRIMARY}`}
                >
                  Κάτοψη Έργου
                </button>
                <button
                  onClick={() => handleLoadFloorplan('parking')}
                  className={`px-4 py-2 bg-green-600 text-white rounded font-medium flex-1 max-w-[160px] ${FORM_BUTTON_EFFECTS.SUCCESS}`}
                >
                  Κάτοψη Θ.Σ.
                </button>
              </div>
              <p className="text-gray-400 text-xs text-center mt-2">
                Η κάτοψη θα φορτωθεί στον καμβά και στην αντίστοιχη καρτέλα του έργου
              </p>
            </div>
          )}

          {/* Building Floorplan Options - Only shown when building is selected */}
          {currentStep === 'building' && selectedBuildingId && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border-t border-gray-600">
              <h3 className="text-white font-medium mb-3 text-center">Επιλέξτε Κάτοψη Κτιρίου για Φόρτωση</h3>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleLoadFloorplan('building')}
                  className={`px-4 py-2 bg-blue-600 text-white rounded font-medium flex-1 max-w-[160px] ${FORM_BUTTON_EFFECTS.PRIMARY}`}
                >
                  Κάτοψη Κτιρίου
                </button>
                <button
                  onClick={() => handleLoadFloorplan('storage')}
                  className={`px-4 py-2 bg-green-600 text-white rounded font-medium flex-1 max-w-[160px] ${FORM_BUTTON_EFFECTS.SUCCESS}`}
                >
                  Κάτοψη Αποθηκών
                </button>
              </div>
              <p className="text-gray-400 text-xs text-center mt-2">
                Η κάτοψη θα φορτωθεί στον καμβά και στη διαχείριση κτιρίων
              </p>
            </div>
          )}

          {/* Step 4: Unit Selection - Only shown when in unit step */}
          {currentStep === 'unit' && (
            <div className="mt-6">
              <h3 className="text-white font-medium mb-4">Βήμα 4: Επιλογή Μονάδας</h3>
              
              {/* Hierarchy Display */}
              <div className="space-y-3 mb-4 text-sm">
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="font-medium">Εταιρεία:</span>
                  <span className="text-blue-400">{companies?.find(c => c.id === selectedCompanyId)?.companyName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="font-medium">Έργο:</span>
                  <span className="text-green-400">{projects.find(p => p.id === selectedProjectId)?.name}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-300">
                  <span className="font-medium">Κτίριο:</span>
                  <span className="text-purple-400">{buildings.find(b => b.id === selectedBuildingId)?.name}</span>
                </div>
              </div>

              {/* Units Selection */}
              {units.length > 0 ? (
                <select
                  value={selectedUnitId}
                  onChange={(e) => handleUnitChange(e.target.value)}
                  className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                  style={{
                    backgroundColor: '#374151',
                    color: 'white'
                  }}
                >
                  <option value="" style={{ backgroundColor: '#374151', color: 'white' }}>
                    -- Επιλέξτε Μονάδα --
                  </option>
                  {units.map(unit => (
                    <option 
                      key={unit.id} 
                      value={unit.id}
                      style={{ backgroundColor: '#374151', color: 'white' }}
                    >
                      {unit.name || unit.unitName} 
                      {unit.type && ` (${unit.type})`}
                      {unit.floor && ` - ${unit.floor}ος όροφος`}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-gray-700 rounded-lg">
                  <p className="text-gray-300 text-sm">Δεν βρέθηκαν μονάδες για το επιλεγμένο κτίριο.</p>
                </div>
              )}
            </div>
          )}

          {/* Unit Floorplan Options - Only shown when unit is selected */}
          {currentStep === 'unit' && selectedUnitId && (
            <div className="mt-6 p-4 bg-gray-700 rounded-lg border-t border-gray-600">
              <h3 className="text-white font-medium mb-3 text-center">Επιλέξτε Κάτοψη Μονάδας για Φόρτωση</h3>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => handleLoadFloorplan('unit')}
                  className={`px-4 py-2 bg-orange-600 text-white rounded font-medium flex-1 max-w-[160px] ${FORM_BUTTON_EFFECTS.WARNING}`}
                >
                  Κάτοψη Μονάδας
                </button>
              </div>
              <p className="text-gray-400 text-xs text-center mt-2">
                Η κάτοψη θα φορτωθεί στον καμβά και στη διαχείριση μονάδων
              </p>
            </div>
          )}
        </main>

        {/* Footer */}
        <div className="p-6 border-t border-gray-600 flex justify-between">
          <button
            onClick={currentStep === 'company' ? handleClose : handleBack}
            className={`px-4 py-2 text-gray-200 bg-gray-700 rounded ${FORM_BUTTON_EFFECTS.SECONDARY}`}
          >
            {currentStep === 'company' ? 'Ακύρωση' : '← Προηγούμενο'}
          </button>
          
          {currentStep === 'company' ? (
            <button
              onClick={handleNext}
              disabled={!selectedCompanyId}
              className={`px-6 py-2 bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-medium ${FORM_BUTTON_EFFECTS.PRIMARY}`}
            >
              Επόμενο →
            </button>
          ) : currentStep === 'project' ? (
            <button
              onClick={handleNext}
              disabled={!selectedProjectId}
              className={`px-6 py-2 bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-medium ${FORM_BUTTON_EFFECTS.PRIMARY}`}
            >
              Επόμενο →
            </button>
          ) : currentStep === 'building' ? (
            <button
              onClick={handleNext}
              disabled={!selectedBuildingId}
              className={`px-6 py-2 bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-medium ${FORM_BUTTON_EFFECTS.PRIMARY}`}
            >
              Επόμενο →
            </button>
          ) : (
            <button
              onClick={() => console.log('Ready for unit floorplan selection:', selectedUnitId)}
              disabled={!selectedUnitId}
              className={`px-6 py-2 bg-green-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-medium ${FORM_BUTTON_EFFECTS.SUCCESS}`}
            >
              Έτοιμο
            </button>
          )}
        </div>
      </dialog>

      {/* DXF Import Modal */}
      <DxfImportModal
        isOpen={showDxfModal}
        onClose={() => setShowDxfModal(false)}
        onImport={handleDxfImportFromModal}
      />
    </div>
  );
}