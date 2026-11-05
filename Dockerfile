# ADR-923 §5.6.1 — η μηχανή του εκδότη καταλόγου. Το στάδιο πετιέται: στην εικόνα περνά μόνο το εκτελέσιμο.
# Το κτίσμα αποτυγχάνει ΠΡΙΝ από κάθε κυκλοφορία αν αλλάξει το αρχείο, αν η εικόνα δεν είναι x86_64,
# ή αν το κτίσμα musl δεν βγάζει πραγματικό PDF/A με τη γραμματοσειρά του μητρώου.
# Σε αναβάθμιση: `TYPST_VERSION`, sha256 και `TYPST_EXPECTED_VERSION` μαζί (άγκυρα: typst-image-pin.test.ts).
FROM node:22-alpine AS typst
ARG TYPST_VERSION=0.15.1
ADD --checksum=sha256:a6d077d0a95eed5a2eba715b2dae06be954f624ccbf85758a03f389ded33118c \
    https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz /tmp/typst.tar.xz
COPY public/fonts/LiberationSans-Regular.ttf /tmp/fonts/
RUN test "$(uname -m)" = x86_64 && \
    apk add --no-cache tar xz && \
    mkdir /typst && \
    tar -xJf /tmp/typst.tar.xz -C /typst --strip-components=1 && \
    /typst/typst --version | grep -Fq "typst ${TYPST_VERSION} " && \
    printf '#set text(font: "Liberation Sans")\nNestor\n' > /tmp/smoke.typ && \
    /typst/typst compile /tmp/smoke.typ /tmp/smoke.pdf --root /tmp --ignore-system-fonts --font-path /tmp/fonts --pdf-standard a-2b && \
    test -s /tmp/smoke.pdf

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

# ADR-923 §5.6.1 — ιδιοκτησία root, εκτέλεση από τον nextjs. Οι άδειες συνοδεύουν το εκτελέσιμο (Apache-2.0).
COPY --from=typst /typst/typst /usr/local/bin/typst
COPY --from=typst /typst/LICENSE /typst/NOTICE /usr/share/licenses/typst/
ENV CATALOG_TYPST_BIN=/usr/local/bin/typst

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# ADR-865 §11.12 — «έτοιμο» = ο server ΑΠΑΝΤΑ, όχι «το container ξεκίνησε». Χωρίς αυτό το Coolify θεωρεί
# έτοιμο κάθε container που μόλις ξεκίνησε. ⚠️ `node`, ΟΧΙ curl/wget: η εικόνα δεν έχει curl, και και τα δύο
# είναι στη BLOCKED_BOT_PATTERNS του middleware ⇒ 403 ⇒ «ανθυγιές» για πάντα ⇒ κανένα deploy δεν ανεβαίνει.
# Ρητό UA (πρότυπο ADR-740 §9 `nestor-scheduler/1`)· άγκυρα: scripts/__tests__/netcup-release.test.js.
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --start-interval=2s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health',{headers:{'user-agent':'nestor-healthcheck/1'},signal:AbortSignal.timeout(4000)}).then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]

CMD ["node", "server.js"]
