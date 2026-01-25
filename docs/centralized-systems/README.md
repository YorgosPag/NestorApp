# 🏢 **CENTRALIZED SYSTEMS DOCUMENTATION**

> **Enterprise-Grade Architecture Documentation**
>
> Complete documentation για όλα τα κεντρικοποιημένα συστήματα της εφαρμογής

**📊 Quick Stats**: 19 Enterprise Systems | 12,837+ Lines | Fortune 500 Quality

---

## 🏛️ **ARCHITECTURAL DECISIONS (ADRs)**

| ADR | Decision | Canonical Component | Deprecated | Date |
|-----|----------|---------------------|------------|------|
| **ADR-001** | Select/Dropdown Component | `@/components/ui/select` (Radix) | `EnterpriseComboBox` | 2026-01-01 |

> **🚫 PROHIBITION**: Νέα Select/Dropdown implementations **ΑΠΑΓΟΡΕΥΟΝΤΑΙ** εκτός Radix Select.
>
> **📍 Full Details**: [centralized_systems.md](../src/subapps/dxf-viewer/docs/centralized_systems.md)

---

## 🎯 **NAVIGATION INDEX**

### 📋 **QUICK ACCESS**

| Documentation Type | Location | Best For | Content |
|--------------------|----------|----------|---------|
| **📚 Complete Reference** | [Original Docs](../src/subapps/dxf-viewer/docs/centralized_systems.md) | **Deep dive** | Full implementation details (2,824 lines) |
| **📋 Quick Table** | [Systems Table](../src/subapps/dxf-viewer/docs/centralized_systems_TABLE.md) | **Quick lookup** | Comprehensive systems table (341 lines) |
| **🎯 Modular Docs** | **Below sections** | **Focused learning** | Organized by system type |

---

## 🗂️ **ENTERPRISE DOCUMENTATION STRUCTURE**

### 🎨 **DESIGN SYSTEM**
- **[📋 Overview](design-system/index.md)** - Design system architecture & philosophy
- **[🎨 Design Tokens](design-system/tokens.md)** - Colors, spacing, typography, animations
- **[🔗 Hooks Ecosystem](design-system/hooks.md)** - 78+ enterprise hooks detailed
- **[🧱 UI Components](design-system/components.md)** - Enterprise UI components system

### 🏭 **SMART FACTORIES**
- **[📋 Overview](smart-factories/index.md)** - Smart factory architecture & guidelines
- **[📑 Tabs Factory](smart-factories/tabs-factory.md)** - Dynamic tab configuration generation
- **[🧭 Navigation Factory](smart-factories/navigation-factory.md)** - Dynamic menu generation
- **[📖 Usage Guidelines](smart-factories/guidelines.md)** - When to use/avoid smart factories

### 🔄 **DATA SYSTEMS**
- **[📋 Overview](data-systems/index.md)** - Data management architecture
- **[🏠 Unit Fields System](data-systems/unit-fields.md)** - Extended unit properties (layout, areas, features)
- **[🎯 Multi-Selection System](../src/subapps/dxf-viewer/docs/HYBRID_LAYER_MOVEMENT_ARCHITECTURE.md#9-multi-selection--marquee-selection-system-2026-01-25)** - AutoCAD-style Window/Crossing selection ✨ **NEW**
- **[🚨 Alert Engine](data-systems/alert-engine.md)** - Real-time monitoring & notifications
- **[🌍 Polygon System](data-systems/polygon-system.md)** - Geographic drawing engine
- **[🏗️ State Management](data-systems/state-management.md)** - Context providers & stores

### 🖼️ **UI SYSTEMS**
- **[📋 Overview](ui-systems/index.md)** - User interface systems architecture
- **[📸 Photo System](ui-systems/photo-system.md)** - Media management & display
- **[🔍 Search System](ui-systems/search-system.md)** - Unified search experience
- **[📄 Enterprise Headers](ui-systems/enterprise-headers.md)** - Header component system

### ⚙️ **CONFIGURATION**
- **[📋 Overview](configuration/index.md)** - Configuration systems overview
- **[🏗️ DXF Configuration](configuration/dxf-config.md)** - CAD-specific settings
- **[📱 App Configuration](configuration/app-config.md)** - Global application settings
- **[⚙️ Settings Management](configuration/settings.md)** - User preferences & overrides

### 📚 **REFERENCE**
- **[🔗 API Quick Reference](reference/api-quick-reference.md)** - Complete imports & usage
- **[📖 Import Examples](reference/import-examples.md)** - Code examples cheatsheet
- **[🛠️ Troubleshooting](reference/troubleshooting.md)** - Common issues & solutions

---

## 🚀 **GETTING STARTED**

### 🔍 **QUICK SYSTEM LOOKUP**

**Need specific system info?** Use the quick navigation:

| System Category | Quick Links |
|-----------------|-------------|
| **UI Styling** | [Design Tokens](design-system/tokens.md), [Hooks](design-system/hooks.md) |
| **Dynamic Configuration** | [Smart Factories](smart-factories/index.md), [Guidelines](smart-factories/guidelines.md) |
| **Data & State** | [Alert Engine](data-systems/alert-engine.md), [State Management](data-systems/state-management.md) |
| **Components** | [Photo System](ui-systems/photo-system.md), [Search](ui-systems/search-system.md) |

### 📖 **RECOMMENDED READING ORDER**

1. **Architecture Overview** → [Design System Index](design-system/index.md)
2. **Core Patterns** → [Smart Factories Overview](smart-factories/index.md)
3. **Implementation** → [API Reference](reference/api-quick-reference.md)
4. **Specific Systems** → Choose relevant category above

---

## 🔗 **CROSS-REFERENCES**

### 📋 **RELATED DOCUMENTATION**

- **[🏢 Original Complete Documentation](../src/subapps/dxf-viewer/docs/centralized_systems.md)** - Full 2,824-line reference
- **[📊 Systems Overview Table](../src/subapps/dxf-viewer/docs/centralized_systems_TABLE.md)** - Quick stats & metrics
- **[📁 DXF Architecture](../src/subapps/dxf-viewer/docs/architecture/)** - DXF-specific documentation
- **[⚙️ Settings System](../src/subapps/dxf-viewer/docs/settings-system/)** - Settings architecture details

### 🎯 **EXTERNAL REFERENCES**

- **Design System Inspiration**: Microsoft Fluent, Google Material, Adobe Spectrum
- **Smart Factory Patterns**: Gang of Four Design Patterns
- **Enterprise Architecture**: Fortune 500 best practices

---

## 📈 **DOCUMENTATION METRICS**

| Metric | Value | Status |
|--------|-------|---------|
| **Total Systems** | 18 | ✅ **Complete** |
| **Total Code Lines** | 11,362+ | ✅ **Enterprise** |
| **Documentation Files** | 20+ | ✅ **Modular** |
| **Cross-Links** | 50+ | ✅ **Interconnected** |

---

> **💡 Tip**: Bookmark this page για quick navigation στα centralized systems!
>
> **🔄 Last Updated**: 2026-01-24
>
> **👥 Maintainers**: Γιώργος Παγώνης + Claude Code (Anthropic AI)