import React from 'react';
import { useLevels } from '../../systems/levels/useLevels';

export function AutoSaveStatus() {
  const levelsSystem = useLevels();
  
  const currentFileName = levelsSystem.getCurrentFileName?.() || null;
  const autoSaveStatus = levelsSystem.getAutoSaveStatus?.() || { 
    lastSaveTime: null, 
    saveStatus: 'idle' 
  };
  
  if (!currentFileName) {
    return null; // No file loaded, don't show anything
  }
  
  const getStatusIcon = () => {
    switch (autoSaveStatus.saveStatus) {
      case 'saving':
        return (
          <div className="flex items-center text-yellow-400">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-yellow-400 mr-1"></div>
            <span className="text-xs">Saving...</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center text-green-400">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Saved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center text-red-400">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Error</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center text-gray-400">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
              <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Auto-save</span>
          </div>
        );
    }
  };
  
  const formatLastSaveTime = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };
  
  return (
    <div className="flex items-center justify-between p-2 bg-gray-800 border border-gray-700 rounded text-xs">
      <div className="flex flex-col">
        <div className="flex items-center">
          <span className="text-gray-300 mr-2">📁 {currentFileName}</span>
          {getStatusIcon()}
        </div>
        {autoSaveStatus.lastSaveTime && (
          <div className="text-gray-500 text-[10px] mt-1">
            Last saved: {formatLastSaveTime(autoSaveStatus.lastSaveTime)}
          </div>
        )}
      </div>
      
      <div className="flex items-center">
        <button
          onClick={() => {
            if (levelsSystem.setAutoSaveEnabled) {
              // Toggle auto-save (simplified - in a real app you'd track this state)

            }
          }}
          className="px-2 py-1 text-[10px] bg-gray-700 hover:bg-gray-600 rounded border border-gray-600"
          title="Trigger manual save"
        >
          💾 Save
        </button>
      </div>
    </div>
  );
}