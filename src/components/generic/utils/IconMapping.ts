import {
  Info, FileText, Users, History, User, CreditCard, Briefcase, Phone, MapPin,
  Gavel, UserCheck, Megaphone, Activity, DollarSign, Calendar, Construction,
  Building, Car, Landmark, Map, Settings, Home, Camera, Video, Clock, TrendingUp,
  Package, Ruler, BarChart, Target, MessageCircle, Cake, Globe, Badge, Clipboard,
  Hash, Wrench, Factory, Smartphone, Shield, ClipboardList, Image, Mail, Lock,
  AlertTriangle, CheckCircle, XCircle, Star, Search, Edit, Save, Upload, Download,
  Building2, Warehouse, LayoutGrid, FileSignature, ClipboardCheck, PlayCircle,
  BarChart3, Network,
  // 🎭 ENTERPRISE: Persona System icons (ADR-121)
  HardHat, UserCog, Calculator, Scale, Key, Euro, Award, Tag, Percent,
  // 🏢 Procurement icons (PO statuses)
  FileEdit, Send, PackageOpen, PackageCheck, CircleCheck,
  // 📁 Project participation icon (ADR-282)
  FolderKanban,
  LucideIcon
} from 'lucide-react';
import { CraneIcon } from '@/subapps/dxf-viewer/components/icons';
import { createModuleLogger } from '@/lib/telemetry';

const logger = createModuleLogger('IconMapping');

// ============================================================================
// 🔥 CENTRALIZED ICON MAPPING - SINGLE SOURCE OF TRUTH
// ============================================================================

/**
 * ENTERPRISE ICON MAPPING SYSTEM
 *
 * Centralized icon mapping που εξαλείφει τα διπλότυπα από όλα τα generic components.
 * Αυτό το αρχείο παρέχει unified ICON_MAPPING για όλα τα renderer components:
 *
 * Features:
 * - Unified Lucide icons mapping
 * - Type-safe icon resolution
 * - Automatic fallback για unknown icons
 * - Zero duplication across components
 */
export const ICON_MAPPING = {
  // 🏢 Company GEMI icons
  'info': Info,
  'file-text': FileText,
  'dollar-sign': DollarSign,
  'calendar': Calendar,

  // 👤 Individual contact icons
  'user': User,
  'credit-card': CreditCard,
  'briefcase': Briefcase,
  'phone': Phone,

  // 🏛️ GEMI categories
  'map-pin': MapPin,
  'users': Users,
  'gavel': Gavel,
  'history': History,
  'user-check': UserCheck,
  'megaphone': Megaphone,
  'activity': Activity,

  // 🏗️ Project/Building icons
  'construction': Construction,
  'building': Building,
  'car': Car,
  'landmark': Landmark,
  'map': Map,
  'settings': Settings,
  'home': Home,
  'camera': Camera,
  'video': Video,
  'clock': Clock,
  'trending-up': TrendingUp,
  'package': Package,
  'ruler': Ruler,
  'bar-chart': BarChart,
  'target': Target,
  'message-circle': MessageCircle,

  // 🎂 Individual specific icons
  'cake': Cake,
  'globe': Globe,
  'badge': Badge,
  'clipboard': Clipboard,
  'hash': Hash,
  'wrench': Wrench,
  'factory': Factory,
  'smartphone': Smartphone,

  // 🏢 Service config icons
  'shield': Shield,
  'clipboard-list': ClipboardList,
  'image': Image,

  // 📧 Common utility icons
  'mail': Mail,
  'lock': Lock,
  'alert-triangle': AlertTriangle,
  'check-circle': CheckCircle,
  'x-circle': XCircle,
  'star': Star,
  'search': Search,
  'edit': Edit,
  'save': Save,
  'upload': Upload,
  'download': Download,
  'building-2': Building2,
  'warehouse': Warehouse,
  'layout-grid': LayoutGrid,
  'file-signature': FileSignature,
  'clipboard-check': ClipboardCheck,
  'play-circle': PlayCircle,
  'bar-chart-3': BarChart3,
  'network': Network,

  // 🏢 ENTERPRISE: PascalCase aliases for component-style icon names
  // Ensures compatibility with configs that use PascalCase (e.g., 'FileSignature')
  'FileSignature': FileSignature,
  'ClipboardCheck': ClipboardCheck,
  'PlayCircle': PlayCircle,
  'BarChart3': BarChart3,
  'Building2': Building2,
  'Warehouse': Warehouse,
  'LayoutGrid': LayoutGrid,
  'ClipboardList': ClipboardList,
  'CheckCircle': CheckCircle,
  'AlertTriangle': AlertTriangle,

  // 📊 CRM/Dashboard icons (from GenericCRMDashboardTabsRenderer)
  '📊': BarChart,
  '📈': TrendingUp,
  '👥': Users,
  '📞': Phone,
  '📧': Mail,
  '📅': Calendar,
  '🏢': Building,
  '🎯': Target,
  '💼': Briefcase,
  '⚙️': Settings,

  // 🏗️ Building/Project icons (from GenericBuildingTabsRenderer)
  // Note: '🏢' and '📊' already defined above (CRM section)
  '🏠': Home,
  '🏗️': CraneIcon,
  '📐': Ruler,
  '📹': Video,
  '📷': Camera,
  '🕒': Clock,
  '📦': Package,
  '🚗': Car,
  '🏛️': Landmark,
  '🗺️': Map,

  // 🎭 Contact Persona System icons (ADR-121)
  'hard-hat': HardHat,
  'user-cog': UserCog,
  'calculator': Calculator,
  'scale': Scale,
  'key': Key,
  'euro': Euro,
  'award': Award,
  'tag': Tag,
  'percent': Percent,

  // 🏢 Procurement PO status icons (PascalCase aliases)
  'FileEdit': FileEdit,
  'Send': Send,
  'PackageOpen': PackageOpen,
  'PackageCheck': PackageCheck,
  'CircleCheck': CircleCheck,
  'file-edit': FileEdit,
  'send': Send,
  'package-open': PackageOpen,
  'package-check': PackageCheck,
  'circle-check': CircleCheck,

  // 🔧 Legacy emoji fallbacks για backward compatibility
  'handshake': UserCheck, // Alias

  // 📁 Project participation (ADR-282)
  'folder-kanban': FolderKanban,
} as const;

// ============================================================================
// TYPE-SAFE ICON RESOLUTION
// ============================================================================

export type IconName = keyof typeof ICON_MAPPING;

/**
 * ENTERPRISE ICON COMPONENT RESOLVER
 *
 * Gets the appropriate Lucide icon component for an icon name or emoji.
 * Replaces all scattered `getIconComponent` functions across the codebase.
 *
 * Features:
 * - Type-safe icon resolution
 * - Automatic fallback για unknown icons
 * - Support για both string names και emoji
 * - Zero external dependencies
 *
 * @param iconName - Icon name (kebab-case), emoji, ή Lucide icon name
 * @returns Lucide React component
 *
 * @example
 * ```tsx
 * const IconComponent = getIconComponent('file-text');
 * const iconSizes = useIconSizes();
 * <IconComponent className={iconSizes.sm} />
 * ```
 */
/**
 * 🏢 ENTERPRISE: Get icon component by name with type safety
 * Returns LucideIcon component or custom icon (like CraneIcon) for the given icon name
 */
export function getIconComponent(iconName: string): LucideIcon | React.ComponentType<{ className?: string }> {
  // Direct lookup in mapping
  const iconComponent = ICON_MAPPING[iconName as IconName];
  if (iconComponent) {
    // 🏢 ENTERPRISE: Type assertion to handle both Lucide icons and custom icons
    return iconComponent as LucideIcon | React.ComponentType<{ className?: string }>;
  }

  // Fallback για unrecognized icons
  logger.warn('Unknown icon, using Info fallback', { iconName });
  return Info;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Επιστρέφει όλα τα available icon names
 */
export function getAvailableIcons(): IconName[] {
  return Object.keys(ICON_MAPPING) as IconName[];
}

/**
 * Ελέγχει αν ένα icon name υπάρχει στο mapping
 */
export function isValidIcon(iconName: string): iconName is IconName {
  return iconName in ICON_MAPPING;
}

/**
 * Helper για creating icon components με custom props
 *
 * @example
 * ```tsx
 * import { createIconElement } from './IconMapping';
 * const iconSizes = useIconSizes();
 * const iconElement = createIconElement('file-text', { className: iconSizes.sm });
 * ```
 */
/** Props for icon elements */
interface IconElementProps {
  className?: string;
  size?: number;
  color?: string;
  [key: string]: unknown;
}

export function createIconElement(iconName: string, props: IconElementProps = {}) {
  const IconComponent = getIconComponent(iconName);
  // Return the component class, not JSX (since this is .ts not .tsx)
  return { IconComponent, props };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  getIconComponent,
  getAvailableIcons,
  isValidIcon,
  createIconElement,
  ICON_MAPPING
};
