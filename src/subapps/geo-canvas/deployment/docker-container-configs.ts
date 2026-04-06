/**
 * DOCKER ORCHESTRATOR — CONTAINER CONFIGURATIONS
 * Geo-Alert System - Phase 8: Production Docker Containerization & Orchestration
 *
 * Factory functions for all Geo-Alert container configurations.
 * Extracted from DockerOrchestrator.ts per ADR-065 (SRP compliance).
 */

import type { ContainerConfig } from './docker-orchestrator-types';

// ============================================================================
// CONTAINER CONFIGURATION FACTORIES
// ============================================================================

/**
 * Frontend container configuration (Next.js app)
 */
export function createFrontendContainerConfig(): ContainerConfig {
  return {
    name: 'geo-alert-frontend',
    image: 'geo-alert/frontend',
    tag: 'latest',
    replicas: 3,
    resources: {
      cpu: { request: '0.1', limit: '0.5' },
      memory: { request: '128Mi', limit: '512Mi' },
      storage: { request: '1Gi', class: 'fast' }
    },
    environment: [
      { name: 'NODE_ENV', value: 'production' },
      { name: 'API_URL', value: 'https://api.geo-alert.com' },
      { name: 'ENABLE_ANALYTICS', value: 'true' },
      {
        name: 'API_KEY',
        valueFrom: {
          secretKeyRef: { name: 'api-secrets', key: 'frontend-api-key' }
        }
      }
    ],
    ports: [
      {
        name: 'http',
        containerPort: 3000,
        hostPort: 3000,
        protocol: 'TCP',
        expose: true
      }
    ],
    volumes: [
      {
        name: 'nginx-config',
        mountPath: '/etc/nginx/conf.d',
        readOnly: true,
        volume: {
          type: 'configMap',
          source: { name: 'nginx-config' }
        }
      },
      {
        name: 'static-files',
        mountPath: '/app/dist',
        readOnly: false,
        volume: {
          type: 'emptyDir',
          source: {}
        }
      }
    ],
    healthCheck: {
      enabled: true,
      type: 'http',
      path: '/health',
      port: 3000,
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
      successThreshold: 1
    },
    restartPolicy: 'Always',
    networks: ['geo-alert-network'],
    labels: {
      'app': 'geo-alert',
      'component': 'frontend',
      'tier': 'web'
    },
    dependsOn: ['geo-alert-backend']
  };
}

/**
 * Backend container configuration (Node.js API)
 */
export function createBackendContainerConfig(): ContainerConfig {
  return {
    name: 'geo-alert-backend',
    image: 'geo-alert/backend',
    tag: 'latest',
    replicas: 3,
    resources: {
      cpu: { request: '0.5', limit: '2.0' },
      memory: { request: '1Gi', limit: '4Gi' },
      storage: { request: '5Gi', class: 'standard' }
    },
    environment: [
      { name: 'NODE_ENV', value: 'production' },
      { name: 'PORT', value: '8080' },
      { name: 'REDIS_URL', value: 'redis://geo-alert-redis:6379' },
      {
        name: 'DATABASE_URL',
        valueFrom: {
          secretKeyRef: { name: 'database-secrets', key: 'connection-string' }
        }
      },
      {
        name: 'JWT_SECRET',
        valueFrom: {
          secretKeyRef: { name: 'api-secrets', key: 'jwt-secret' }
        }
      }
    ],
    ports: [
      {
        name: 'http',
        containerPort: 8080,
        hostPort: 8080,
        protocol: 'TCP',
        expose: true
      },
      {
        name: 'metrics',
        containerPort: 9090,
        protocol: 'TCP',
        expose: false
      }
    ],
    volumes: [
      {
        name: 'app-config',
        mountPath: '/app/config',
        readOnly: true,
        volume: {
          type: 'configMap',
          source: { name: 'app-config' }
        }
      },
      {
        name: 'uploads',
        mountPath: '/app/uploads',
        readOnly: false,
        volume: {
          type: 'persistentVolumeClaim',
          source: { claimName: 'uploads-pvc' }
        }
      }
    ],
    healthCheck: {
      enabled: true,
      type: 'http',
      path: '/api/health',
      port: 8080,
      initialDelaySeconds: 45,
      periodSeconds: 15,
      timeoutSeconds: 10,
      failureThreshold: 3,
      successThreshold: 1
    },
    restartPolicy: 'Always',
    networks: ['geo-alert-network'],
    labels: {
      'app': 'geo-alert',
      'component': 'backend',
      'tier': 'api'
    },
    dependsOn: ['geo-alert-database', 'geo-alert-redis']
  };
}

/**
 * Database container configuration (PostGIS)
 */
export function createDatabaseContainerConfig(): ContainerConfig {
  return {
    name: 'geo-alert-database',
    image: 'postgis/postgis',
    tag: '14-3.2',
    replicas: 1,
    resources: {
      cpu: { request: '1.0', limit: '4.0' },
      memory: { request: '2Gi', limit: '8Gi' },
      storage: { request: '50Gi', class: 'ssd' }
    },
    environment: [
      {
        name: 'POSTGRES_DB',
        valueFrom: {
          secretKeyRef: { name: 'database-secrets', key: 'database-name' }
        }
      },
      {
        name: 'POSTGRES_USER',
        valueFrom: {
          secretKeyRef: { name: 'database-secrets', key: 'username' }
        }
      },
      {
        name: 'POSTGRES_PASSWORD',
        valueFrom: {
          secretKeyRef: { name: 'database-secrets', key: 'password' }
        }
      },
      { name: 'POSTGRES_INITDB_ARGS', value: '--encoding=UTF-8 --lc-collate=C --lc-ctype=C' }
    ],
    ports: [
      {
        name: 'postgresql',
        containerPort: 5432,
        protocol: 'TCP',
        expose: false
      }
    ],
    volumes: [
      {
        name: 'postgres-data',
        mountPath: '/var/lib/postgresql/data',
        readOnly: false,
        volume: {
          type: 'persistentVolumeClaim',
          source: { claimName: 'postgres-data-pvc' }
        }
      },
      {
        name: 'postgres-config',
        mountPath: '/etc/postgresql/postgresql.conf',
        readOnly: true,
        subPath: 'postgresql.conf',
        volume: {
          type: 'configMap',
          source: { name: 'postgres-config' }
        }
      }
    ],
    healthCheck: {
      enabled: true,
      type: 'exec',
      command: ['pg_isready', '-U', 'postgres'],
      initialDelaySeconds: 30,
      periodSeconds: 10,
      timeoutSeconds: 5,
      failureThreshold: 3,
      successThreshold: 1
    },
    restartPolicy: 'Always',
    networks: ['geo-alert-network'],
    labels: {
      'app': 'geo-alert',
      'component': 'database',
      'tier': 'data'
    },
    dependsOn: []
  };
}

/**
 * Redis container configuration (cache layer)
 */
export function createRedisContainerConfig(): ContainerConfig {
  return {
    name: 'geo-alert-redis',
    image: 'redis',
    tag: '7-alpine',
    replicas: 1,
    resources: {
      cpu: { request: '0.1', limit: '0.5' },
      memory: { request: '256Mi', limit: '1Gi' },
      storage: { request: '5Gi', class: 'standard' }
    },
    environment: [
      { name: 'REDIS_PASSWORD', value: '' }
    ],
    ports: [
      {
        name: 'redis',
        containerPort: 6379,
        protocol: 'TCP',
        expose: false
      }
    ],
    volumes: [
      {
        name: 'redis-data',
        mountPath: '/data',
        readOnly: false,
        volume: {
          type: 'persistentVolumeClaim',
          source: { claimName: 'redis-data-pvc' }
        }
      }
    ],
    healthCheck: {
      enabled: true,
      type: 'exec',
      command: ['redis-cli', 'ping'],
      initialDelaySeconds: 15,
      periodSeconds: 10,
      timeoutSeconds: 3,
      failureThreshold: 3,
      successThreshold: 1
    },
    restartPolicy: 'Always',
    networks: ['geo-alert-network'],
    labels: {
      'app': 'geo-alert',
      'component': 'cache',
      'tier': 'data'
    },
    dependsOn: []
  };
}

/**
 * Nginx container configuration (reverse proxy)
 */
export function createNginxContainerConfig(): ContainerConfig {
  return {
    name: 'geo-alert-nginx',
    image: 'nginx',
    tag: '1.24-alpine',
    replicas: 2,
    resources: {
      cpu: { request: '0.1', limit: '0.3' },
      memory: { request: '64Mi', limit: '256Mi' },
      storage: { request: '1Gi', class: 'standard' }
    },
    environment: [],
    ports: [
      {
        name: 'http',
        containerPort: 80,
        hostPort: 80,
        protocol: 'TCP',
        expose: true
      },
      {
        name: 'https',
        containerPort: 443,
        hostPort: 443,
        protocol: 'TCP',
        expose: true
      }
    ],
    volumes: [
      {
        name: 'nginx-config',
        mountPath: '/etc/nginx/nginx.conf',
        readOnly: true,
        subPath: 'nginx.conf',
        volume: {
          type: 'configMap',
          source: { name: 'nginx-config' }
        }
      },
      {
        name: 'ssl-certs',
        mountPath: '/etc/ssl/certs',
        readOnly: true,
        volume: {
          type: 'secret',
          source: { secretName: 'tls-secrets' }
        }
      }
    ],
    healthCheck: {
      enabled: true,
      type: 'http',
      path: '/nginx-health',
      port: 80,
      initialDelaySeconds: 10,
      periodSeconds: 10,
      timeoutSeconds: 3,
      failureThreshold: 3,
      successThreshold: 1
    },
    restartPolicy: 'Always',
    networks: ['geo-alert-network'],
    labels: {
      'app': 'geo-alert',
      'component': 'proxy',
      'tier': 'edge'
    },
    dependsOn: ['geo-alert-frontend', 'geo-alert-backend']
  };
}
