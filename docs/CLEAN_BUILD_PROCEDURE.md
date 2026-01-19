# Clean Build Procedure

## Quick Reference

```bash
# Clean build (recommended for production)
npm run build:clean

# Clear cache only
npm run clear-cache

# Development with clean start
npm run dev:clean
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build:clean` | Clears cache + runs production build |
| `npm run clear-cache` | Clears Next.js cache (.next, node_modules/.cache) |
| `npm run dev:clean` | Clears cache + starts dev server with Turbopack |

## When to Use Clean Build

1. **ENOSPC errors** - Disk space issues during build
2. **Stale cache** - Build artifacts causing unexpected behavior
3. **After major dependency updates** - Ensure clean state
4. **CI/CD pipelines** - Always start with clean state

## Manual Cache Clearing

If scripts fail, manually remove:

```bash
# Windows PowerShell
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules\.cache

# Unix/Mac
rm -rf .next node_modules/.cache
```

## Related Scripts

- `scripts/clear-cache.js` - Cache clearing implementation
- `scripts/build-design-tokens.js` - Design token generation (runs before build)
