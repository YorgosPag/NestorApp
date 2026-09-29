FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone server (pre-built by GitHub Actions outside Docker)
COPY --chown=nextjs:nodejs .next/standalone ./
# Copy static assets (not included in standalone)
COPY --chown=nextjs:nodejs .next/static ./.next/static
# Copy public folder
COPY --chown=nextjs:nodejs public ./public

# ADR-894 — η τοπική βάση GeoIP (DB-IP City Lite). Την κατεβάζει το docker-build.yml (`geoip:fetch`)·
# ο server τη διαβάζει από `/app/data/geoip` (ή `GEOIP_DB_PATH`). Φάκελος χωρίς βάση ⇒ «άγνωστη τοποθεσία».
COPY --chown=nextjs:nodejs data/geoip ./data/geoip
# ADR-884 Φ2ζ ζ4 — ο ανιχνευτής προσώπων του ψήστη (YuNet, MIT, στο repo). Χωρίς αυτόν ⇒ το ψήσιμο αναβάλλεται (fail-closed).
COPY --chown=nextjs:nodejs data/models ./data/models

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
