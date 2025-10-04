# 🏗️ DXF Viewer - Enterprise CAD Application

> Advanced DXF/CAD viewer με κεντρικοποιημένη αρχιτεκτονική και enterprise-level patterns

## 📖 **ΣΗΜΑΝΤΙΚΗ ΤΕΚΜΗΡΙΩΣΗ**

### 🎯 **Αρχιτεκτονική Συστημάτων**
**ΠΡΙΝ ΞΕΚΙΝΗΣΕΙΣ DEVELOPMENT**, διάβασε τον οδηγό αρχιτεκτονικής:

📋 **[Centralized Systems Guide](./centralized_systems.md)**

Αυτός ο οδηγός περιέχει:
- ✅ 20 κύριες κατηγορίες κεντρικοποιημένων συστημάτων
- ✅ 56 κεντρικοποιημένα συστήματα με paths και APIs
- ✅ 200+ κλάσεις και services με τις διευθύνσεις τους
- ✅ Enterprise patterns και best practices

## 🏢 **Enterprise Architecture Principles**

### **1. Factory Pattern Usage**
```typescript
// ✅ ΣΩΣΤΑ - Χρήση factory
const index = SpatialFactory.forHitTesting(bounds);

// ❌ ΛΑΘΟΣ - Direct instantiation
const index = new QuadTreeSpatialIndex(bounds);
```

### **2. Registry Pattern Usage**
```typescript
// ✅ ΣΩΣΤΑ - Register through registry
registry.register('line', () => new LineRenderer());

// ❌ ΛΑΘΟΣ - Direct renderer usage
const renderer = new LineRenderer(); // Skip registry
```

### **3. Centralized State Management**
```typescript
// ✅ ΣΩΣΤΑ - Χρήση centralized hooks
const { selectedEntities, selectEntity } = useSelection();

// ❌ ΛΑΘΟΣ - Custom selection state
const [selected, setSelected] = useState([]); // Bypass system
```

## 🔍 **Quick Reference - Core Systems**

| System | Path | Purpose |
|--------|------|---------|
| 🏭 **Spatial Factory** | `core/spatial/SpatialIndexFactory.ts` | Spatial index creation |
| 📋 **Renderer Registry** | `rendering/core/RendererRegistry.ts` | Entity renderer management |
| 🎭 **Snap Orchestrator** | `snapping/orchestrator/SnapOrchestrator.ts` | CAD snapping coordination |
| ✨ **Selection System** | `systems/selection/index.ts` | Entity selection management |
| 🔍 **Zoom Manager** | `systems/zoom/ZoomManager.ts` | Viewport management |
| 🖼️ **Canvas Manager** | `rendering/canvas/core/CanvasManager.ts` | Canvas lifecycle |

## 🚀 **Development Guidelines**

### **Before Creating New Components:**
1. 📖 **Read**: `centralized_systems.md`
2. 🔍 **Search**: Check if similar functionality exists
3. 🏗️ **Integrate**: Use existing patterns and systems
4. ✅ **Document**: Follow JSDoc standards with architecture references

### **Code Quality Standards:**
- Enterprise-level TypeScript patterns
- Comprehensive JSDoc documentation
- Factory/Registry pattern compliance
- Centralized state management
- Performance-optimized spatial indexing

## 📊 **System Statistics**

- **56** Centralized Systems
- **200+** Classes & Services
- **20** Architecture Categories
- **95%** Centralization Score (EXCELLENT)

---

## 🎯 **Next Steps**

1. Read the [Architecture Guide](./centralized_systems.md)
2. Explore the codebase following the centralized patterns
3. Use factories and registries for extensibility
4. Follow enterprise development practices

**Happy Coding! 🚀**