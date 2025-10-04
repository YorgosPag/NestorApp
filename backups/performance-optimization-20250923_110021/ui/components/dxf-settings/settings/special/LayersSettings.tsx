import React, { useState } from 'react';

interface LayersSettingsProps {
  // Για μελλοντική επέκταση μπορούμε να προσθέσουμε props
}

export const LayersSettings: React.FC<LayersSettingsProps> = () => {
  const [activeTab, setActiveTab] = useState<'outlines' | 'fills'>('outlines');
  const [selectedPreset, setSelectedPreset] = useState<number>(0);

  // Mock preset colors για εμφάνιση
  const presetColors = [
    { name: 'Προς Πώληση', color: '#22c55e' },
    { name: 'Προς Ενοικίαση', color: '#3b82f6' },
    { name: 'Δεσμευμένο', color: '#f59e0b' },
    { name: 'Πουλημένο', color: '#ef4444' },
    { name: 'Οικοπεδούχου', color: '#8b5cf6' }
  ];

  return (
    <div className="p-4">
      {/* Header */}
      <div className="border-b border-gray-600 pb-3 mb-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          🎨 Ρυθμίσεις Layers
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Χρώματα και εμφάνιση επιπέδων σχεδίασης
        </p>
      </div>

      {/* Layer Preview */}
      <div className="mb-4 p-2 bg-gray-700 rounded space-y-2">
        <div className="text-sm text-white">
          <div className="font-medium">Προεπισκόπηση Layer</div>
          <div className="font-normal text-gray-400">Δείτε πώς θα φαίνονται τα layers</div>
        </div>
        <div className="p-2 bg-gray-800 rounded border border-gray-600 flex justify-center">
          <div className="flex gap-1">
            {presetColors.map((preset, index) => (
              <div
                key={preset.name}
                className="w-8 h-8 border-2 rounded cursor-pointer hover:scale-105 transition-transform"
                title={preset.name}
                style={{
                  borderColor: preset.color,
                  backgroundColor: activeTab === 'fills' ? `${preset.color}80` : 'transparent'
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="mb-4">
        <div className="flex gap-1 bg-gray-700 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('outlines')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 ${
              activeTab === 'outlines'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            ✏️ Περιγράμματα
          </button>
          <button
            onClick={() => setActiveTab('fills')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors duration-150 ${
              activeTab === 'fills'
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            🎨 Γεμίσματα
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'outlines' && (
          <>
            {/* Preset Outline Colors */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white font-medium">Χρώματα Περιγραμμάτων</div>
              <div className="grid grid-cols-5 gap-2">
                {presetColors.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`p-2 rounded border transition-colors ${
                      selectedPreset === index
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div
                      className="w-full h-6 rounded border border-gray-400"
                      style={{ backgroundColor: preset.color }}
                    />
                    <div className="text-xs text-white mt-1 truncate">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Outline Settings */}
            <div className="p-2 bg-gray-700 rounded">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white">
                  <div className="font-medium">Εμφάνιση Περιγραμμάτων</div>
                  <div className="font-normal text-gray-400">Ενεργοποίηση/Απενεργοποίηση των περιγραμμάτων</div>
                </div>
                <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-green-600">
                  <span className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out transform translate-x-5" />
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'fills' && (
          <>
            {/* Preset Fill Colors */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white font-medium">Χρώματα Γεμισμάτων</div>
              <div className="grid grid-cols-5 gap-2">
                {presetColors.map((preset, index) => (
                  <button
                    key={preset.name}
                    onClick={() => setSelectedPreset(index)}
                    className={`p-2 rounded border transition-colors ${
                      selectedPreset === index
                        ? 'bg-blue-600 border-blue-500'
                        : 'bg-gray-600 hover:bg-blue-600 border-gray-500'
                    }`}
                  >
                    <div
                      className="w-full h-6 rounded border border-gray-400"
                      style={{ backgroundColor: preset.color }}
                    />
                    <div className="text-xs text-white mt-1 truncate">{preset.name}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Opacity Control */}
            <div className="p-2 bg-gray-700 rounded space-y-2">
              <div className="text-sm text-white">
                <div className="font-medium">Διαφάνεια Γεμίσματος</div>
                <div className="font-normal text-gray-400">Επίπεδο διαφάνειας για το γέμισμα</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="1"
                  step="0.1"
                  defaultValue="1.0"
                  className="flex-1"
                />
                <div className="w-12 text-xs bg-gray-600 text-white rounded px-2 py-1 text-center">
                  100%
                </div>
              </div>
            </div>

            {/* Fill Settings */}
            <div className="p-2 bg-gray-700 rounded">
              <div className="flex items-center justify-between">
                <div className="text-sm text-white">
                  <div className="font-medium">Εμφάνιση Γεμισμάτων</div>
                  <div className="font-normal text-gray-400">Ενεργοποίηση/Απενεργοποίηση των γεμισμάτων</div>
                </div>
                <div className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-green-600">
                  <span className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition duration-200 ease-in-out transform translate-x-5" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Reset Button */}
        <div className="p-2 bg-gray-700 rounded space-y-2">
          <div className="text-sm text-white">
            <div className="font-medium">Επαναφορά</div>
            <div className="font-normal text-gray-400">Επαναφορά στις προεπιλεγμένες ρυθμίσεις</div>
          </div>
          <button className="w-full px-3 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
            🔄 Επαναφορά Ρυθμίσεων Layers
          </button>
        </div>

        {/* Coming Soon Features */}
        <div className="p-2 bg-gray-800 rounded border border-gray-600">
          <div className="text-sm text-white font-medium mb-2">🚧 Σύντομα Διαθέσιμο</div>
          <ul className="text-xs text-gray-400 space-y-1">
            <li>• Χρώματα γεμίσματος layers</li>
            <li>• Ρυθμίσεις πάχους γραμμών</li>
            <li>• Στυλ γραμμών (διακεκομμένη, κλπ)</li>
            <li>• Εξατομικευμένες παλέτες χρωμάτων</li>
            <li>• Import/Export προφίλ χρωμάτων</li>
          </ul>
        </div>
      </div>
    </div>
  );
};