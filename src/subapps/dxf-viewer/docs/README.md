# 📚 DXF Viewer - Enterprise Documentation

> **Comprehensive documentation for the Pagonis Nestor DXF Viewer application**
> Last Updated: 2025-10-03

---

## 🗺️ Quick Navigation

### 🏗️ [Architecture](./architecture/)
High-level system design and architectural decisions
- [Overview](./architecture/overview.md) - System architecture και design principles
- [Entity Management](./architecture/entity-management.md) - Entity systems, rendering, validation
- [Coordinate Systems](./architecture/coordinate-systems.md) - Unified coordinate transformations
- [Rendering Pipeline](./architecture/rendering-pipeline.md) - Canvas rendering και performance
- [State Management](./architecture/state-management.md) - Context providers και stores

### ⚙️ [Systems](./systems/)
Detailed documentation για κάθε κεντρικοποιημένο σύστημα
- [Zoom & Pan](./systems/zoom-pan.md) - 🏢 Enterprise zoom/pan system με keyboard/mouse shortcuts
- [Selection System](./systems/selection.md) - Entity selection και interaction
- [Drawing Tools](./systems/drawing-tools.md) - Line, circle, polygon drawing tools
- [Grips System](./systems/grips.md) - Entity manipulation grips
- [Snapping System](./systems/snapping.md) - Smart object snapping
- [Hit Testing](./systems/hit-testing.md) - Spatial indexing και hit detection
- [Bounds & Fitting](./systems/bounds-fitting.md) - Viewport bounds calculation

### 📖 [Reference](./reference/)
API reference και class listings
- [Class Index](./reference/class-index.md) - Όλες οι κλάσεις alphabetically
- [API Reference](./reference/api-reference.md) - Public APIs και interfaces
- [Type Definitions](./reference/types.md) - TypeScript type definitions

---

## 🎯 Getting Started

### Για Developers
1. Ξεκίνα με το [Architecture Overview](./architecture/overview.md)
2. Διάβασε το [Zoom & Pan System](./systems/zoom-pan.md) για Enterprise patterns
3. Δες το [Class Index](./reference/class-index.md) για available APIs

### Για Contributors
- Όλα τα systems είναι **κεντρικοποιημένα** - NO duplicates!
- Διάβασε τα architecture docs πριν προσθέσεις νέο feature
- Follow τα Enterprise patterns (Context, Manager classes, Services)

### Για Code Reviewers
- Check το [Architecture Overview](./architecture/overview.md) για design principles
- Verify ότι νέος κώδικας χρησιμοποιεί centralized systems
- Ensure NO duplicate functionality

---

## 📊 System Statistics

| Category | Count | Status |
|----------|-------|--------|
| **Centralized Systems** | 17+ | ✅ Active |
| **Manager Classes** | 20+ | ✅ Documented |
| **Services** | 15+ | ✅ Centralized |
| **React Hooks** | 30+ | ✅ Unified |
| **Context Providers** | 10+ | ✅ Enterprise |

---

## 🏢 Enterprise Features (2025-10-03)

### Zoom & Pan System
- ✅ Ctrl+Wheel → Fast zoom (2x speed)
- ✅ Shift+Wheel → Horizontal pan
- ✅ Centralized ZoomManager via CanvasContext
- ✅ Browser conflict avoidance (NO Ctrl+± shortcuts)
- ✅ Cross-platform support (Ctrl/Cmd detection)

### Architecture Highlights
- ✅ Single Source of Truth pattern
- ✅ Context-based dependency injection
- ✅ Fallback chains for backward compatibility
- ✅ Zero breaking changes guarantee
- ✅ Performance optimization (rAF, caching, spatial indexing)

---

## 📝 Documentation Guidelines

### File Organization
```
docs/
├── README.md                 (This file - Navigation index)
├── architecture/             (High-level design docs)
│   ├── overview.md          (~400 lines)
│   ├── entity-management.md (~300 lines)
│   └── ...
├── systems/                  (Per-system detailed docs)
│   ├── zoom-pan.md          (~400 lines)
│   ├── selection.md         (~300 lines)
│   └── ...
└── reference/                (API reference)
    ├── class-index.md       (~500 lines)
    └── api-reference.md     (~400 lines)
```

### File Size Guidelines
- **Target**: 300-500 lines per file
- **Maximum**: 600 lines (if absolutely necessary)
- **Minimum**: 150 lines (otherwise merge with related doc)

### Writing Style
- ✅ Clear, concise headings
- ✅ Code examples για complex concepts
- ✅ Cross-references με relative links
- ✅ Enterprise terminology (Manager, Service, Provider, System)
- ✅ Emoji για visual hierarchy (🏢 Enterprise, ✅ Completed, 🔜 TODO)

---

## 🔗 Related Documentation

- [CLAUDE.md](../CLAUDE.md) - Κανόνες εργασίας και guidelines
- [pos_proxorame.txt](../../../txt_files/pos_proxorame.txt) - Enterprise Zoom Roadmap
- [README.md](../README.md) - DXF Viewer main README

---

## 📞 Need Help?

- **Architecture Questions**: Δες το [Architecture Overview](./architecture/overview.md)
- **API Usage**: Δες το [API Reference](./reference/api-reference.md)
- **System Details**: Δες το [Systems](./systems/) directory
- **Class Lookup**: Δες το [Class Index](./reference/class-index.md)

---

**🏢 Enterprise-Grade Documentation Structure**
*Modular • Maintainable • Scalable*
