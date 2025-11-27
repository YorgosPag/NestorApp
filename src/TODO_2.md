Build Error
Failed to compile

Next.js (14.2.33) is outdated (learn more)
./src/subapps/geo-canvas/hooks/useAdministrativeBoundaries.ts
Error: 
  × the name `historySuggestions` is defined multiple times
     ╭─[C:\Nestor_Pagonis\src\subapps\geo-canvas\hooks\useAdministrativeBoundaries.ts:88:1]
  88 │     debounceMs = 300,
  89 │     maxResults = 10,
  90 │     enableHistory = true,
  91 │     historySuggestions = true
     ·     ─────────┬────────
     ·              ╰── previous definition of `historySuggestions` here
  92 │   } = options;
  93 │ 
  94 │   // State
  95 │   const [isLoading, setIsLoading] = useState(false);
  96 │   const [error, setError] = useState<string | null>(null);
  97 │   const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  98 │   const [currentBoundary, setCurrentBoundary] = useState<GeoJSON.Feature | GeoJSON.FeatureCollection | null>(null);
  99 │   const [detectedType, setDetectedType] = useState<'municipality' | 'region' | 'general' | null>(null);
 100 │   const [suggestions, setSuggestions] = useState<string[]>([]);
 101 │   const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
 102 │   const [historySuggestions, setHistorySuggestions] = useState<string[]>([]);
     ·          ─────────┬────────
     ·                   ╰── `historySuggestions` redefined here
 103 │ 
 104 │   // Refs για debouncing και caching
 105 │   const debounceTimeoutRef = useRef<NodeJS.Timeout>();
     ╰────

Import trace for requested module:
./src/subapps/geo-canvas/hooks/useAdministrativeBoundaries.ts
./src/subapps/geo-canvas/components/AddressSearchPanel.tsx
./src/subapps/geo-canvas/components/CitizenDrawingInterface.tsx
./src/subapps/geo-canvas/app/GeoCanvasContent.tsx
./src/subapps/geo-canvas/GeoCanvasApp.tsx
./src/app/geo/canvas/page.tsx
This error occurred during the build process and can only be dismissed by fixing the error.