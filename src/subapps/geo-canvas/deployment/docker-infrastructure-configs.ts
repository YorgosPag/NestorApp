/**
 * DOCKER ORCHESTRATOR — INFRASTRUCTURE CONFIGURATIONS
 * Geo-Alert System - Phase 8: Production Docker Containerization & Orchestration
 *
 * Factory functions for service, ingress, configmap, and secret configurations.
 * Extracted from DockerOrchestrator.ts per ADR-065 (SRP compliance).
 */

import type {
  ServiceConfig,
  IngressConfig,
  ConfigMapConfig,
  SecretConfig
} from './docker-orchestrator-types';

// ============================================================================
// SERVICE CONFIGURATION FACTORIES
// ============================================================================

/**
 * Frontend service configuration (ClusterIP)
 */
export function createFrontendServiceConfig(): ServiceConfig {
  return {
    name: 'geo-alert-frontend-service',
    type: 'ClusterIP',
    selector: { 'app': 'geo-alert', 'component': 'frontend' },
    ports: [
      {
        name: 'http',
        port: 3000,
        targetPort: 3000,
        protocol: 'TCP'
      }
    ],
    sessionAffinity: 'None'
  };
}

/**
 * Backend service configuration (ClusterIP with metrics)
 */
export function createBackendServiceConfig(): ServiceConfig {
  return {
    name: 'geo-alert-backend-service',
    type: 'ClusterIP',
    selector: { 'app': 'geo-alert', 'component': 'backend' },
    ports: [
      {
        name: 'http',
        port: 8080,
        targetPort: 8080,
        protocol: 'TCP'
      },
      {
        name: 'metrics',
        port: 9090,
        targetPort: 9090,
        protocol: 'TCP'
      }
    ],
    sessionAffinity: 'ClientIP'
  };
}

/**
 * Database service configuration (ClusterIP)
 */
export function createDatabaseServiceConfig(): ServiceConfig {
  return {
    name: 'geo-alert-database-service',
    type: 'ClusterIP',
    selector: { 'app': 'geo-alert', 'component': 'database' },
    ports: [
      {
        name: 'postgresql',
        port: 5432,
        targetPort: 5432,
        protocol: 'TCP'
      }
    ],
    sessionAffinity: 'None'
  };
}

/**
 * Redis service configuration (ClusterIP)
 */
export function createRedisServiceConfig(): ServiceConfig {
  return {
    name: 'geo-alert-redis-service',
    type: 'ClusterIP',
    selector: { 'app': 'geo-alert', 'component': 'cache' },
    ports: [
      {
        name: 'redis',
        port: 6379,
        targetPort: 6379,
        protocol: 'TCP'
      }
    ],
    sessionAffinity: 'None'
  };
}

/**
 * Nginx service configuration (LoadBalancer — public-facing)
 */
export function createNginxServiceConfig(): ServiceConfig {
  return {
    name: 'geo-alert-nginx-service',
    type: 'LoadBalancer',
    selector: { 'app': 'geo-alert', 'component': 'proxy' },
    ports: [
      {
        name: 'http',
        port: 80,
        targetPort: 80,
        protocol: 'TCP'
      },
      {
        name: 'https',
        port: 443,
        targetPort: 443,
        protocol: 'TCP'
      }
    ],
    sessionAffinity: 'None'
  };
}

// ============================================================================
// INGRESS CONFIGURATION
// ============================================================================

/**
 * Ingress configuration with TLS and rate limiting
 */
export function createIngressConfig(): IngressConfig {
  return {
    name: 'geo-alert-ingress',
    className: 'nginx',
    tls: true,
    hosts: [
      {
        host: 'geo-alert.com',
        paths: [
          {
            path: '/',
            pathType: 'Prefix',
            service: {
              name: 'geo-alert-nginx-service',
              port: 80
            }
          }
        ]
      },
      {
        host: 'api.geo-alert.com',
        paths: [
          {
            path: '/api',
            pathType: 'Prefix',
            service: {
              name: 'geo-alert-backend-service',
              port: 8080
            }
          }
        ]
      }
    ],
    annotations: {
      'kubernetes.io/ingress.class': 'nginx',
      'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
      'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
      'nginx.ingress.kubernetes.io/force-ssl-redirect': 'true',
      'nginx.ingress.kubernetes.io/proxy-body-size': '50m',
      'nginx.ingress.kubernetes.io/rate-limit': '100',
      'nginx.ingress.kubernetes.io/rate-limit-window': '1m'
    }
  };
}

// ============================================================================
// CONFIGMAP FACTORIES
// ============================================================================

/**
 * Application ConfigMap (app settings + database tuning)
 */
export function createAppConfigMap(): ConfigMapConfig {
  return {
    name: 'app-config',
    data: {
      'app.json': JSON.stringify({
        name: 'Geo-Alert System',
        version: '1.0.0',
        environment: 'production',
        features: {
          dxfTransformation: true,
          mapIntegration: true,
          alertEngine: true,
          performanceMonitoring: true
        },
        limits: {
          maxFileSize: '50MB',
          maxUsers: 1000,
          rateLimitPerMinute: 100
        }
      }),
      'database.conf': `
          max_connections = 200
          shared_buffers = 256MB
          effective_cache_size = 1GB
          maintenance_work_mem = 64MB
          checkpoint_completion_target = 0.9
          wal_buffers = 16MB
          default_statistics_target = 100
          random_page_cost = 1.1
          effective_io_concurrency = 200
        `
    }
  };
}

/**
 * Nginx ConfigMap (reverse proxy configuration)
 */
export function createNginxConfigMap(): ConfigMapConfig {
  return {
    name: 'nginx-config',
    data: {
      'nginx.conf': `
          events {
            worker_connections 1024;
          }

          http {
            upstream frontend {
              server geo-alert-frontend-service:3000;
            }

            upstream backend {
              server geo-alert-backend-service:8080;
            }

            server {
              listen 80;
              server_name geo-alert.com;

              location / {
                proxy_pass http://frontend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
              }

              location /api {
                proxy_pass http://backend;
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_connect_timeout 60s;
                proxy_send_timeout 60s;
                proxy_read_timeout 60s;
              }

              location /nginx-health {
                access_log off;
                return 200 "healthy\\n";
                add_header Content-Type text/plain;
              }
            }
          }
        `
    }
  };
}

// ============================================================================
// SECRET FACTORIES
// ============================================================================

/**
 * Database secrets (connection credentials)
 */
export function createDatabaseSecrets(): SecretConfig {
  return {
    name: 'database-secrets',
    type: 'Opaque',
    data: {
      'database-name': Buffer.from('geo_alert_prod').toString('base64'),
      'username': Buffer.from('geo_alert_user').toString('base64'),
      'password': Buffer.from('secure_random_password_123').toString('base64'),
      'connection-string': Buffer.from('postgresql://geo_alert_user:secure_random_password_123@geo-alert-database-service:5432/geo_alert_prod').toString('base64')
    }
  };
}

/**
 * API secrets (JWT, encryption keys)
 */
export function createAPISecrets(): SecretConfig {
  return {
    name: 'api-secrets',
    type: 'Opaque',
    data: {
      'jwt-secret': Buffer.from('super_secure_jwt_secret_key_256_bits').toString('base64'),
      'frontend-api-key': Buffer.from('frontend_api_key_12345').toString('base64'),
      'encryption-key': Buffer.from('aes_256_encryption_key_32_chars').toString('base64')
    }
  };
}

/**
 * TLS secrets (SSL certificates)
 */
export function createTLSSecrets(): SecretConfig {
  return {
    name: 'tls-secrets',
    type: 'kubernetes.io/tls',
    data: {
      'tls.crt': Buffer.from('PLACEHOLDER_CERTIFICATE_DATA').toString('base64'),
      'tls.key': Buffer.from('PLACEHOLDER_TLS_KEY_DATA').toString('base64')
    }
  };
}
