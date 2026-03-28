
'use client';
/* eslint-disable custom/no-hardcoded-strings */
import '@/lib/design-system';

export function PropertyViewerPage() {
    return (
        <div className="property-viewer-page">
            <h2>Property Viewer</h2>
            <p>Property management interface placeholder</p>
        </div>
    );
}

// Legacy alias for backward compatibility
export const PropertyManagementPageContent = PropertyViewerPage;
