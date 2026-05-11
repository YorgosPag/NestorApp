# ADR-344 Phase 4 — Yjs sync server container.
#
# Build:   docker build -t nestor-yjs-server .
# Run:     docker run -p 1234:1234 \
#            -v $HOME/.config/gcloud:/gcloud \
#            -e GOOGLE_APPLICATION_CREDENTIALS=/gcloud/application_default_credentials.json \
#            nestor-yjs-server
#
# Deploy to Cloud Run:
#   gcloud run deploy nestor-yjs-server --source . --region=europe-west3 \
#     --allow-unauthenticated --port=1234 --min-instances=1 \
#     --cpu-throttling=false --session-affinity
#
# session-affinity + cpu-throttling=false are MANDATORY: long-lived
# WebSockets require sticky routing and uninterrupted CPU.

FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js auth.js ./

EXPOSE 1234

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://localhost:1234/healthz || exit 1

CMD ["node", "server.js"]
