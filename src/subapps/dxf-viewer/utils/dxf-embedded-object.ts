/**
 * ADR-920 Β4.1β — re-export. The implementation lives in `@/lib/dxf/dxf-embedded-object`, shared by the DXF Viewer
 * and the owner's plot-listing survey import (which may not import from the subapp — CHECK 3.62). The lib file is
 * still a zero-import LEAF. Same bodies, same semantics: every existing importer is unchanged. Edit the lib file.
 */
export * from '@/lib/dxf/dxf-embedded-object';
