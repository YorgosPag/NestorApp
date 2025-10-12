Unhandled Runtime Error
TypeError: react_map_gl_maplibre__WEBPACK_IMPORTED_MODULE_2__.default is not a constructor

Source
src\subapps\geo-canvas\components\InteractiveMap.tsx (148:77) @ InteractiveMap

  146 |
  147 |   // ✅ NEW: Elevation data state και caching
> 148 |   const [elevationCache, setElevationCache] = useState<Map<string, number>>(new Map());
      |                                                                             ^
  149 |   const [elevationLoading, setElevationLoading] = useState<boolean>(false);
  150 |
  151 |   // ✅ ENTERPRISE: Throttled elevation fetcher με caching
Call Stack
Show collapsed frames