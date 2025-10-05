# 🐛 DEBUG LOGGING GUIDE - DXF Viewer

**Ημερομηνία Δημιουργίας:** 2025-10-04
**Τελευταία Ενημέρωση:** 2025-10-04
**Στόχος:** Centralized debug logging με environment control

---

## 🎯 ΤΙ ΕΙΝΑΙ ΤΟ DEBUG LOGGING SYSTEM

Το Debug Logging System είναι ένα **centralized utility** που αντικαθιστά τα `console.log` με **conditional logging** που μπορεί να ενεργοποιηθεί/απενεργοποιηθεί:

- ✅ **Environment Control** - Control μέσω `.env.local`
- ✅ **Per-Component Control** - Ενεργοποίηση μόνο συγκεκριμένων components
- ✅ **Styled Output** - Color-coded log levels
- ✅ **Performance** - Zero overhead όταν disabled

---

## 📋 ΠΙΝΑΚΑΣ ΠΕΡΙΕΧΟΜΕΝΩΝ

1. [Quick Start](#quick-start)
2. [Configuration](#configuration)
3. [Usage Examples](#usage-examples)
4. [API Reference](#api-reference)
5. [Migration Guide](#migration-guide)

---

## 🚀 QUICK START

### 1. Enable/Disable Debug Logging

Επεξεργασία του `.env.local`:

```bash
# ✅ DISABLE όλα τα debug logs (PRODUCTION MODE)
NEXT_PUBLIC_DEBUG=false

# 🐛 ENABLE όλα τα debug logs (DEVELOPMENT MODE)
NEXT_PUBLIC_DEBUG=true
```

### 2. Per-Component Debugging

```bash
# ΜΟΝΟ specific components
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_DEBUG_COMPONENTS=CanvasSection,DxfCanvas
```

### 3. Restart Dev Server

```bash
npm run dev:fast
```

---

## ⚙️ CONFIGURATION

### Environment Variables

| Variable | Values | Περιγραφή |
|----------|--------|-----------|
| `NEXT_PUBLIC_DEBUG` | `true` / `false` | Master switch για debug logging |
| `NEXT_PUBLIC_DEBUG_COMPONENTS` | Comma-separated list | Specific components to debug |

### Configuration Examples

#### 1️⃣ Production Mode (No Debug Logs)

```bash
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_DEBUG_COMPONENTS=
```

**Result**: ❌ Όλα τα debug logs disabled

---

#### 2️⃣ Development Mode (All Debug Logs)

```bash
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_DEBUG_COMPONENTS=
```

**Result**: ✅ Όλα τα debug logs enabled

---

#### 3️⃣ Selective Debugging

```bash
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_DEBUG_COMPONENTS=CanvasSection,DxfCanvas,DxfRenderer
```

**Result**: ✅ Μόνο τα specified components show logs

---

#### 4️⃣ Performance Debugging

```bash
NEXT_PUBLIC_DEBUG=true
NEXT_PUBLIC_DEBUG_COMPONENTS=ZoomManager,DxfRenderer,PhaseManager
```

**Result**: ✅ Μόνο performance-critical components

---

## 📚 USAGE EXAMPLES

### Basic Usage

```typescript
import { debugLog } from '@/utils/debug-logger';

// Basic log
debugLog('CanvasSection', 'Rendering canvas', { width: 800, height: 600 });

// With emoji
debugLog('DxfCanvas', '🎨 Rendering scene', scene);
```

### Log Levels

```typescript
// Info (Blue)
debugLog.info('CanvasSection', 'Canvas initialized', canvas);

// Success (Green)
debugLog.success('DxfCanvas', 'Scene loaded successfully', scene);

// Warning (Orange)
debugLog.warning('ZoomManager', 'Zoom limit reached', { scale });

// Error (Red) - ALWAYS shows, even when DEBUG=false
debugLog.error('DxfRenderer', 'Render failed', error);
```

### Grouped Logging

```typescript
debugLog.group('CanvasSection', 'Rendering State', () => {
  debugLog('CanvasSection', 'Width', 800);
  debugLog('CanvasSection', 'Height', 600);
  debugLog('CanvasSection', 'Zoom', 1.5);
});

// Console output:
// [CanvasSection] Rendering State
//   [CanvasSection] Width 800
//   [CanvasSection] Height 600
//   [CanvasSection] Zoom 1.5
```

### Table Logging

```typescript
debugLog.table('EntityRenderer', 'Entities', entities);

// Shows nice table in console
```

### Performance Timing

```typescript
const timer = debugLog.timer('DxfRenderer', 'Render Scene');

// ... do work ...

timer.end();
// Output: [DxfRenderer] Render Scene: 45.23ms
```

### Critical Messages (Always Show)

```typescript
// Για critical messages που πρέπει να φαίνονται ΠΑΝΤΑ
debugLog.always('CanvasSection', '🚨 Critical Error', error);
```

### Check if Debug Enabled

```typescript
if (debugLog.isEnabled('CanvasSection')) {
  // Expensive debug operation
  const debugData = calculateExpensiveDebugInfo();
  debugLog('CanvasSection', 'Debug info', debugData);
}
```

---

## 🔧 API REFERENCE

### `debugLog(component, message, data?, level?)`

Main logging function.

**Parameters:**
- `component` (string) - Component name (e.g., 'CanvasSection')
- `message` (string) - Log message
- `data` (any, optional) - Data to log
- `level` ('info' | 'success' | 'warning' | 'error' | 'debug', optional) - Log level

---

### Convenience Methods

| Method | Description | Color |
|--------|-------------|-------|
| `debugLog.info()` | Info log | Blue |
| `debugLog.success()` | Success log | Green |
| `debugLog.warning()` | Warning log | Orange |
| `debugLog.error()` | Error log (always shows) | Red |

---

### Utility Methods

| Method | Description |
|--------|-------------|
| `debugLog.group(component, title, fn)` | Grouped logging |
| `debugLog.table(component, title, data)` | Table logging |
| `debugLog.timer(component, label)` | Performance timing |
| `debugLog.always(component, message, data)` | Always log (critical) |
| `debugLog.isEnabled(component?)` | Check if enabled |
| `debugLog.getConfig()` | Get configuration |

---

## 🔄 MIGRATION GUIDE

### Before (Old Way)

```typescript
console.log('🎨 Rendering canvas:', { width, height });
console.log('🔍 DEBUG:', state);
console.warn('⚠️ Warning:', message);
```

**Problem**: Logs show ΠΑΝΤΑ, ακόμα και σε production!

---

### After (New Way)

```typescript
import { debugLog } from '@/utils/debug-logger';

debugLog('CanvasSection', '🎨 Rendering canvas:', { width, height });
debugLog('CanvasSection', '🔍 DEBUG:', state);
debugLog.warning('CanvasSection', '⚠️ Warning:', message);
```

**Solution**: Logs show μόνο όταν enabled!

---

## 📊 AVAILABLE COMPONENTS

Components που μπορούν να debug-αριστούν:

- `CanvasSection`
- `DxfCanvas`
- `DxfRenderer`
- `TransformContext`
- `DxfSettingsProvider`
- `DxfViewerContent`
- `TestResultsModal`
- `ZoomManager`
- `LayerRenderer`
- `GripRenderer`
- `ServiceHealthMonitor`
- `PhaseManager`
- `EntityRenderer`

---

## 🎨 LOG OUTPUT EXAMPLE

Με `NEXT_PUBLIC_DEBUG=true`:

```
[22:50:36] [CanvasSection] 🎨 CANVAS OVERLAY RENDERING STATE: {...}
[22:50:36] [DxfCanvas] ✅ HILITE_EVENT listener registered
[22:50:36] [ZoomManager] 🔍 Zoom changed: {scale: 1.5}
```

Με `NEXT_PUBLIC_DEBUG=false`:

```
(empty - no debug logs)
```

---

## 🚨 ΣΗΜΑΝΤΙΚΟ

### Errors Show ALWAYS

Τα **error logs** φαίνονται ΠΑΝΤΑ, ακόμα και με `DEBUG=false`:

```typescript
debugLog.error('DxfRenderer', 'Render failed', error);
// ✅ Shows ALWAYS
```

### Critical Messages

Χρησιμοποίησε `debugLog.always()` για critical messages:

```typescript
debugLog.always('CanvasSection', '🚨 Critical issue', data);
// ✅ Shows ALWAYS
```

---

## 📂 FILES

- **Utility**: `src/subapps/dxf-viewer/utils/debug-logger.ts`
- **Config**: `.env.local`
- **Example**: `.env.local.example`
- **Docs**: `DEBUG_LOGGING.md` (this file)

---

## ✅ CHECKLIST - Πριν Commit

- [ ] Debug logs replaced με `debugLog()`
- [ ] `.env.local` configured (`DEBUG=false` για production)
- [ ] Critical errors use `debugLog.error()` ή `debugLog.always()`
- [ ] No `console.log` remaining (except errors)

---

## 🎯 ΤΕΛΙΚΟ ΑΠΟΤΕΛΕΣΜΑ

**ΠΡΙΝ:**
```
❌ Χιλιάδες console.log σε κάθε mouse move
❌ Logs φαίνονται ΠΑΝΤΑ
❌ Δύσκολο debugging - πολύ noise
```

**ΜΕΤΑ:**
```
✅ Clean console σε production
✅ Controlled logging σε development
✅ Per-component debugging
✅ Zero performance overhead όταν disabled
```

---

**🚀 Τέλος στα χιλιάδες logs - Ξεκινάει η εποχή του clean console!**

*Last updated: 2025-10-04 by Claude & Γιώργος*
