/**
 * =============================================================================
 * 🏢 ENTERPRISE: Centralized File Icon Mapping
 * =============================================================================
 *
 * Single source of truth για file type → icon mapping.
 * Αντικαθιστά scattered getFileIcon() implementations.
 *
 * @module components/shared/files/utils/file-icons
 * @enterprise ADR-191 - Enterprise Document Management System
 */

import {
  FileText,
  Image,
  Video,
  Music,
  FileSpreadsheet,
  FileCode,
  Archive,
  File,
  Presentation,
  Film,
  FileSignature,
  MapIcon,
  Files,
  type LucideIcon,
} from 'lucide-react';

// ============================================================================
// CONTENT TYPE → ICON MAPPING
// ============================================================================

/** Map content type prefix to icon */
const CONTENT_TYPE_MAP: ReadonlyArray<[prefix: string, icon: LucideIcon, colorClass: string]> = [
  ['image/', Image, 'text-pink-500'],
  ['video/', Film, 'text-red-500'],
  ['audio/', Music, 'text-violet-500'],
];

// ============================================================================
// EXTENSION → ICON MAPPING
// ============================================================================

interface FileIconInfo {
  readonly icon: LucideIcon;
  readonly colorClass: string;
}

const EXTENSION_MAP: Readonly<Record<string, FileIconInfo>> = {
  // Documents
  pdf: { icon: FileText, colorClass: 'text-red-600' },
  doc: { icon: FileText, colorClass: 'text-blue-600' },
  docx: { icon: FileText, colorClass: 'text-blue-600' },
  odt: { icon: FileText, colorClass: 'text-blue-500' },
  rtf: { icon: FileText, colorClass: 'text-blue-400' },
  txt: { icon: FileText, colorClass: 'text-gray-500' },

  // Spreadsheets
  xls: { icon: FileSpreadsheet, colorClass: 'text-green-600' },
  xlsx: { icon: FileSpreadsheet, colorClass: 'text-green-600' },
  csv: { icon: FileSpreadsheet, colorClass: 'text-green-500' },
  ods: { icon: FileSpreadsheet, colorClass: 'text-green-500' },

  // Presentations
  ppt: { icon: Presentation, colorClass: 'text-orange-600' },
  pptx: { icon: Presentation, colorClass: 'text-orange-600' },
  odp: { icon: Presentation, colorClass: 'text-orange-500' },

  // Images
  jpg: { icon: Image, colorClass: 'text-pink-500' },
  jpeg: { icon: Image, colorClass: 'text-pink-500' },
  png: { icon: Image, colorClass: 'text-pink-500' },
  gif: { icon: Image, colorClass: 'text-pink-500' },
  webp: { icon: Image, colorClass: 'text-pink-500' },
  svg: { icon: Image, colorClass: 'text-pink-400' },
  bmp: { icon: Image, colorClass: 'text-pink-400' },
  tiff: { icon: Image, colorClass: 'text-pink-400' },
  heic: { icon: Image, colorClass: 'text-pink-400' },

  // Video
  mp4: { icon: Film, colorClass: 'text-red-500' },
  mov: { icon: Film, colorClass: 'text-red-500' },
  avi: { icon: Film, colorClass: 'text-red-500' },
  mkv: { icon: Film, colorClass: 'text-red-500' },
  webm: { icon: Video, colorClass: 'text-red-400' },

  // Audio
  mp3: { icon: Music, colorClass: 'text-violet-500' },
  wav: { icon: Music, colorClass: 'text-violet-500' },
  ogg: { icon: Music, colorClass: 'text-violet-500' },
  m4a: { icon: Music, colorClass: 'text-violet-500' },

  // Archives
  zip: { icon: Archive, colorClass: 'text-yellow-600' },
  rar: { icon: Archive, colorClass: 'text-yellow-600' },
  '7z': { icon: Archive, colorClass: 'text-yellow-600' },
  tar: { icon: Archive, colorClass: 'text-yellow-600' },
  gz: { icon: Archive, colorClass: 'text-yellow-600' },

  // Code / Technical
  json: { icon: FileCode, colorClass: 'text-amber-500' },
  xml: { icon: FileCode, colorClass: 'text-amber-500' },
  html: { icon: FileCode, colorClass: 'text-orange-500' },
  css: { icon: FileCode, colorClass: 'text-blue-400' },
  js: { icon: FileCode, colorClass: 'text-yellow-500' },
  ts: { icon: FileCode, colorClass: 'text-blue-500' },

  // CAD / Construction
  dxf: { icon: MapIcon, colorClass: 'text-teal-500' },
  dwg: { icon: MapIcon, colorClass: 'text-teal-600' },
  ifc: { icon: MapIcon, colorClass: 'text-teal-400' },
};

// ============================================================================
// CATEGORY → ICON MAPPING
// ============================================================================

const CATEGORY_MAP: Readonly<Record<string, FileIconInfo>> = {
  photos: { icon: Image, colorClass: 'text-blue-500' },
  videos: { icon: Film, colorClass: 'text-red-500' },
  floorplans: { icon: MapIcon, colorClass: 'text-teal-500' },
  contracts: { icon: FileSignature, colorClass: 'text-amber-500' },
  documents: { icon: FileText, colorClass: 'text-blue-500' },
  invoices: { icon: FileSpreadsheet, colorClass: 'text-green-500' },
  permits: { icon: FileText, colorClass: 'text-purple-500' },
  other: { icon: Files, colorClass: 'text-gray-500' },
};

const DEFAULT_ICON: FileIconInfo = { icon: File, colorClass: 'text-gray-500' };

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get icon info for a file based on extension and/or content type.
 * Priority: extension → contentType → default
 */
export function getFileIconInfo(ext?: string, contentType?: string): FileIconInfo {
  // 1. Try extension first (most specific)
  if (ext) {
    const normalized = ext.toLowerCase().replace(/^\./, '');
    const byExt = EXTENSION_MAP[normalized];
    if (byExt) return byExt;
  }

  // 2. Try content type prefix
  if (contentType) {
    for (const [prefix, icon, colorClass] of CONTENT_TYPE_MAP) {
      if (contentType.startsWith(prefix)) {
        return { icon, colorClass };
      }
    }
  }

  return DEFAULT_ICON;
}

/**
 * Get icon info for a file category.
 */
export function getCategoryIconInfo(category?: string): FileIconInfo {
  if (!category) return CATEGORY_MAP.other ?? DEFAULT_ICON;
  return CATEGORY_MAP[category] ?? CATEGORY_MAP.other ?? DEFAULT_ICON;
}

/**
 * Check if a file is previewable as an image (can be displayed directly).
 */
export function isImageFile(ext?: string, contentType?: string): boolean {
  if (contentType?.startsWith('image/')) return true;
  if (!ext) return false;
  const normalized = ext.toLowerCase().replace(/^\./, '');
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(normalized);
}

/**
 * Check if a file is a PDF.
 */
export function isPdfFile(ext?: string, contentType?: string): boolean {
  if (contentType === 'application/pdf') return true;
  if (!ext) return false;
  return ext.toLowerCase().replace(/^\./, '') === 'pdf';
}

/**
 * Check if a file is a video.
 */
export function isVideoFile(ext?: string, contentType?: string): boolean {
  if (contentType?.startsWith('video/')) return true;
  if (!ext) return false;
  const normalized = ext.toLowerCase().replace(/^\./, '');
  return ['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(normalized);
}
