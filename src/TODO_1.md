 ▲ Next.js 14.2.32 (turbo)
  - Local:        http://localhost:3000
  - Environments: .env.local, .env

 ✓ Starting...
 ✓ Ready in 4.5s
 ○ Compiling /dxf/viewer ...
 ✓ Compiled /dxf/viewer in 33.4s
Failed to load cursor settings: ReferenceError: localStorage is not defined
    at CursorConfiguration.loadSettings (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2154:28)
    at new CursorConfiguration (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2065:30)
    at CursorConfiguration.getInstance (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2090:44)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2260:42
    at [project]/src/subapps/dxf-viewer/systems/cursor/config.ts [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2275:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:3534:166
    at [project]/src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4445:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4459:172
    at [project]/src/subapps/dxf-viewer/providers/GripProvider.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4676:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4928:165
    at [project]/src/subapps/dxf-viewer/providers/UnifiedProviders.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:5022:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:5033:169
    at [project]/src/app/dxf/viewer/page.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:5240:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at commonJsRequire (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:136:20)
    at require (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:39:20088)
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89292
    at eo (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89477)
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:91706
    at Object._fromJSON (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:92262)   
    at JSON.parse (<anonymous>)
    at eu (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89971)
    at en (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89039)
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96197
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96214
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96247
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96264
    at t (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96487)
 GET /dxf/viewer 200 in 18504ms
 GET /dxf/viewer 200 in 41690ms
 ○ Compiling /_not-found/page ...
 ✓ Compiled /_not-found/page in 4.1s
 GET /.well-known/appspecific/com.chrome.devtools.json 404 in 8596ms
 ✓ Compiled in 458ms
Failed to load cursor settings: ReferenceError: localStorage is not defined
    at CursorConfiguration.loadSettings (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2154:28)
    at new CursorConfiguration (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2065:30)
    at CursorConfiguration.getInstance (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2090:44)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2260:42
    at [project]/src/subapps/dxf-viewer/systems/cursor/config.ts [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:2275:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:3534:166
    at [project]/src/subapps/dxf-viewer/providers/DxfSettingsProvider.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4445:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4459:172
    at [project]/src/subapps/dxf-viewer/providers/GripProvider.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4676:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:4928:165
    at [project]/src/subapps/dxf-viewer/providers/UnifiedProviders.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:5022:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at esmImport (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:122:20)
    at F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:5033:169
    at [project]/src/app/dxf/viewer/page.tsx [app-ssr] (ecmascript) (F:\Pagonis_Nestor\.next\server\chunks\ssr\src_e1724c._.js:5240:3)
    at instantiateModule (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:520:23)
    at getOrInstantiateModuleFromParent (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:572:12)
    at commonJsRequire (F:\Pagonis_Nestor\.next\server\chunks\ssr\[turbopack]_runtime.js:136:20)
    at require (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:39:20088)
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89292
    at eo (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89477)
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:91706
    at Object._fromJSON (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:92262)   
    at JSON.parse (<anonymous>)
    at eu (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89971)
    at en (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:89039)
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96197
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96214
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96247
    at F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96264
    at t (F:\Pagonis_Nestor\node_modules\next\dist\compiled\next-server\app-page.runtime.dev.js:35:96487)
 GET /dxf/viewer 200 in 25094ms
 ○ Compiling /favicon.ico ...
 GET /dxf/viewer 200 in 21274ms
 ✓ Compiled /favicon.ico in 3.2s
 GET /favicon.ico?favicon.56766c03.ico 200 in 7491ms