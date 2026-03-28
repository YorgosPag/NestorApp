/* eslint-disable custom/no-hardcoded-strings */
/* eslint-disable design-system/enforce-semantic-colors */
'use client';

import React, { useState } from 'react';
import {
  BuildingManagementToolbar,
  ProjectToolbar,
  ContactsToolbar
} from '@/components/compositions';
import { useSemanticColors } from '@/ui-adapters/react/useSemanticColors';
import { cn } from '@/lib/utils';
import { createModuleLogger } from '@/lib/telemetry';
import '@/lib/design-system';

const logger = createModuleLogger('ToolbarShowcase');

export function ToolbarShowcase() {
  const colors = useSemanticColors();
  // 🏢 ENTERPRISE: Shared state για demonstration - using string[] for IDs
  const [buildingState, setBuildingState] = useState({
    selectedItems: [] as string[],
    searchTerm: '',
    activeFilters: [] as string[]
  });

  // 🏢 ENTERPRISE: ProjectToolbar uses string[] for IDs
  const [projectState, setProjectState] = useState({
    selectedItems: [] as string[],
    searchTerm: '',
    activeFilters: [] as string[]
  });

  const [contactState, setContactState] = useState({
    selectedItems: [] as string[],
    searchTerm: '',
    activeFilters: [] as string[]
  });

  return (
    <div className={`space-y-8 ${colors.bg.primary} p-6`}>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Toolbar Composition Showcase</h1>
        <p className={colors.text.muted}>
          Demonstration των νέων toolbar compositions που χρησιμοποιούν το BaseToolbar system
        </p>
      </div>

      {/* BuildingToolbar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          🏢 BuildingToolbar
        </h2>
        <div className="border rounded-lg">
          <BuildingManagementToolbar
            selectedItems={buildingState.selectedItems}
            onSelectionChange={(items) => setBuildingState(prev => ({ ...prev, selectedItems: items }))}
            searchTerm={buildingState.searchTerm}
            onSearchChange={(term) => setBuildingState(prev => ({ ...prev, searchTerm: term }))}
            activeFilters={buildingState.activeFilters}
            onFiltersChange={(filters) => setBuildingState(prev => ({ ...prev, activeFilters: filters }))}
            onNewBuilding={() => logger.info('New building')}
            onEditBuilding={() => logger.info('Edit building')}
            onDeleteBuilding={(ids) => logger.info('Delete buildings', { ids })}
            onExport={() => logger.info('Export buildings')}
            onRefresh={() => logger.info('Refresh buildings')}
          />
          <div className="p-4 bg-muted/20">
            <h3 className="font-medium mb-2">Demo State:</h3>
            <div className="text-sm space-y-1">
              <div>Selected: {buildingState.selectedItems.length} κτίρια</div>
              <div>Search: &quot;{buildingState.searchTerm}&quot;</div>
              <div>Filters: {buildingState.activeFilters.join(', ') || 'None'}</div>
              <button 
                className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
                onClick={() => setBuildingState(prev => ({ ...prev, selectedItems: ['bld1', 'bld2', 'bld3'] }))}
              >
                Simulate Selection (3 items)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ProjectToolbar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          📁 ProjectToolbar
        </h2>
        <div className="border rounded-lg">
          <ProjectToolbar
            selectedItems={projectState.selectedItems}
            onSelectionChange={(items) => setProjectState(prev => ({ ...prev, selectedItems: items }))}
            activeFilters={projectState.activeFilters}
            onFiltersChange={(filters) => setProjectState(prev => ({ ...prev, activeFilters: filters }))}
            onNewProject={() => logger.info('New project')}
            onEditProject={(id) => logger.info('Edit project', { id })}
            onDeleteProject={(ids) => logger.info('Delete projects', { ids })}
            onExport={() => logger.info('Export projects')}
            onRefresh={() => logger.info('Refresh projects')}
          />
          <div className="p-4 bg-muted/20">
            <h3 className="font-medium mb-2">Demo State:</h3>
            <div className="text-sm space-y-1">
              <div>Selected: {projectState.selectedItems.length} έργα</div>
              <div>Search: &quot;{projectState.searchTerm}&quot;</div>
              <div>Filters: {projectState.activeFilters.join(', ') || 'None'}</div>
              <button 
                className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
                onClick={() => setProjectState(prev => ({ ...prev, selectedItems: ['1', '2'] }))}
              >
                Simulate Selection (2 items)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ContactsToolbar Section */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          👥 ContactsToolbar
        </h2>
        <div className="border rounded-lg">
          <ContactsToolbar
            selectedItems={contactState.selectedItems}
            onSelectionChange={(items) => setContactState(prev => ({ ...prev, selectedItems: items }))}
            searchTerm={contactState.searchTerm}
            onSearchChange={(term) => setContactState(prev => ({ ...prev, searchTerm: term }))}
            activeFilters={contactState.activeFilters}
            onFiltersChange={(filters) => setContactState(prev => ({ ...prev, activeFilters: filters }))}
            onNewContact={() => logger.info('New contact')}
            onEditContact={() => logger.info('Edit contact')}
            onDeleteContact={(ids) => logger.info('Delete contacts', { ids })}
            onExport={() => logger.info('Export contacts')}
            onRefresh={() => logger.info('Refresh contacts')}
          />
          <div className="p-4 bg-muted/20">
            <h3 className="font-medium mb-2">Demo State:</h3>
            <div className="text-sm space-y-1">
              <div>Selected: {contactState.selectedItems.length} επαφές</div>
              <div>Search: &quot;{contactState.searchTerm}&quot;</div>
              <div>Filters: {contactState.activeFilters.join(', ') || 'None'}</div>
              <button 
                className="mt-2 px-3 py-1 bg-primary text-primary-foreground rounded text-xs"
                onClick={() => setContactState(prev => ({ ...prev, selectedItems: ['contact1', 'contact2', 'contact3', 'contact4'] }))}
              >
                Simulate Selection (4 items)
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Integration Demo */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          🔧 BaseToolbar Integration
        </h2>
        <div className="p-4 border rounded-lg bg-muted/20">
          <h3 className="font-medium mb-2">Χρήση στην εφαρμογή:</h3>
          <pre className={`text-sm ${colors.bg.primary} p-3 rounded border overflow-x-auto`}>
{`import { BuildingManagementToolbar, ProjectToolbar, ContactsToolbar } from '@/components/compositions';

// Building management page
<BuildingManagementToolbar 
  selectedItems={selectedBuildings}
  onNewBuilding={handleNewBuilding}
  onExport={handleExport}
  searchTerm={searchTerm}
  onSearchChange={setSearchTerm}
/>

// Projects page  
<ProjectToolbar
  selectedItems={selectedProjects}
  onNewProject={handleNewProject}
  activeFilters={filters}
  onFiltersChange={setFilters}
/>

// Contacts page
<ContactsToolbar
  selectedItems={selectedContacts}
  onNewContact={handleNewContact}
  onDeleteContact={handleDeleteContacts}
/>`}
          </pre>
        </div>
      </section>

      {/* Design System Benefits */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          🎨 BaseToolbar Benefits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-green-600 mb-2">✅ Unified Interface</h3>
            <p className={cn("text-sm", colors.text.muted)}>
              Όλα τα toolbars χρησιμοποιούν το ίδιο BaseToolbar system για consistent behavior και styling
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-blue-600 mb-2">🔧 Configurable</h3>
            <p className={cn("text-sm", colors.text.muted)}>
              Flexible configuration με actions, filters, search και custom content sections
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-purple-600 mb-2">🎯 Type Safe</h3>
            <p className={cn("text-sm", colors.text.muted)}>
              Full TypeScript support με strongly typed props και callback functions
            </p>
          </div>
          
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-orange-600 mb-2">🚀 Accessible</h3>
            <p className={cn("text-sm", colors.text.muted)}>
              Built-in accessibility με keyboard shortcuts, tooltips και ARIA support
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}