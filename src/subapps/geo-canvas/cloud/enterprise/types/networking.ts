/**
 * NETWORKING TYPE DEFINITIONS
 *
 * Enterprise-class type definitions για cloud networking configurations
 * Split from monolithic CloudInfrastructure.ts για modular architecture
 *
 * @module enterprise/types/networking
 * @version 1.0.0 - ENTERPRISE MODULAR SPLITTING
 * @updated 2025-12-28 - Split from CloudInfrastructure.ts
 */

// ============================================================================
// CORE NETWORKING TYPES
// ============================================================================

/**
 * Network configuration - Main networking orchestration
 * Enterprise: Multi-cloud networking με advanced routing
 */
export interface NetworkConfig {
  vpc: VPCConfig;
  subnets: SubnetConfig[];
  loadBalancers: LoadBalancerConfig[];
  cdn: CDNConfig;
  dns: DNSConfig;
  firewall: FirewallConfig;
}

/**
 * VPC configuration για network isolation
 * Enterprise: Cross-cloud VPC peering capabilities
 */
export interface VPCConfig {
  cidr: string;
  enableDnsHostnames: boolean;
  enableDnsSupport: boolean;
  tags: Record<string, string>;
}

/**
 * Cache behavior
 */
export interface CacheBehavior {
  pathPattern: string;
  targetOriginId: string;
  compress: boolean;
  allowedMethods: string[];
  cachedMethods: string[];
  forwardCookies: 'none' | 'whitelist' | 'all';
  forwardHeaders: string[];
  ttl: {
    min: number;
    default: number;
    max: number;
  };
}

/**
 * WAF condition
 */
export interface WAFCondition {
  type: 'ip' | 'country' | 'string-match' | 'size-constraint' | 'xss' | 'sql-injection';
  value: string;
  operator: 'equals' | 'contains' | 'starts-with' | 'ends-with' | 'greater-than' | 'less-than';
}

/**
 * Subnet configuration για network segmentation
 * Enterprise: Multi-AZ deployment support
 */
export interface SubnetConfig {
  name: string;
  cidr: string;
  availabilityZone: string;
  type: 'public' | 'private' | 'database';
  routeTable: string;
}

// ============================================================================
// LOAD BALANCING TYPES
// ============================================================================

/**
 * Load balancer configuration για traffic distribution
 * Enterprise: Advanced health checking και SSL termination
 */
export interface LoadBalancerConfig {
  name: string;
  type: 'application' | 'network' | 'classic';
  scheme: 'internet-facing' | 'internal';
  listeners: ListenerConfig[];
  healthCheck: HealthCheckConfig;
  sslPolicy: string;
  stickySessions: boolean;
}

/**
 * Listener configuration για load balancer endpoints
 * Enterprise: SSL/TLS termination με certificate management
 */
export interface ListenerConfig {
  port: number;
  protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
  ssl: boolean;
  certificateArn?: string;
  rules: ListenerRule[];
}

/**
 * Listener rule για traffic routing logic
 * Enterprise: Advanced routing based on conditions
 */
export interface ListenerRule {
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

/**
 * Rule condition για traffic matching
 * Enterprise: Multiple condition types για flexible routing
 */
export interface RuleCondition {
  type: 'host-header' | 'path-pattern' | 'source-ip';
  values: string[];
}

/**
 * Rule action για traffic processing
 * Enterprise: Multiple action types including redirects
 */
export interface RuleAction {
  type: 'forward' | 'redirect' | 'fixed-response';
  targetGroupArn?: string;
  redirectConfig?: {
    host?: string;
    path?: string;
    port?: string;
    protocol?: string;
    query?: string;
    statusCode: 'HTTP_301' | 'HTTP_302';
  };
  fixedResponseConfig?: {
    statusCode: string;
    contentType?: string;
    messageBody?: string;
  };
}

/**
 * Health check configuration για load balancer monitoring
 * Enterprise: Multi-protocol health checking
 */
export interface HealthCheckConfig {
  protocol: 'HTTP' | 'HTTPS' | 'TCP' | 'UDP';
  port: number;
  path?: string;
  interval: number;
  timeout: number;
  healthyThreshold: number;
  unhealthyThreshold: number;
}

// ============================================================================
// CDN CONFIGURATION TYPES
// ============================================================================

/**
 * CDN configuration για content delivery optimization
 * Enterprise: Multi-provider CDN με advanced caching
 */
export interface CDNConfig {
  enabled: boolean;
  provider: 'cloudflare' | 'aws-cloudfront' | 'azure-cdn' | 'google-cdn';
  origins: CDNOrigin[];
  caching: CachingConfig;
  compression: boolean;
  minify: boolean;
  waf: WAFConfig;
}

/**
 * CDN origin configuration
 * Enterprise: Multiple origins με failover support
 */
export interface CDNOrigin {
  name: string;
  domain: string;
  path: string;
  originType: 'load-balancer' | 's3' | 'custom';
  customHeaders: Record<string, string>;
  connectionAttempts: number;
  connectionTimeout: number;
  readTimeout: number;
}

/**
 * Caching configuration για CDN optimization
 * Enterprise: Granular cache control με TTL management
 */
export interface CachingConfig {
  enabled: boolean;
  defaultTTL: number;
  maxTTL: number;
  rules: CacheRule[];
  browserCaching: boolean;
  gzipCompression: boolean;
}

/**
 * Cache rule για granular caching control
 * Enterprise: Path-based caching strategies
 */
export interface CacheRule {
  pathPattern: string;
  ttl: number;
  queryStringCaching: 'none' | 'whitelist' | 'all';
  queryStringWhitelist?: string[];
  headers: string[];
  cookies: CookieCachingConfig;
}

/**
 * Cookie caching configuration
 * Enterprise: Cookie-based cache differentiation
 */
export interface CookieCachingConfig {
  forward: 'none' | 'whitelist' | 'all';
  whitelist?: string[];
}

// ============================================================================
// DNS CONFIGURATION TYPES
// ============================================================================

/**
 * DNS configuration για domain management
 * Enterprise: Multi-provider DNS με failover
 */
export interface DNSConfig {
  enabled: boolean;
  provider: 'aws-route53' | 'cloudflare' | 'azure-dns' | 'google-dns';
  zones: DNSZone[];
  healthChecks: DNSHealthCheck[];
  trafficPolicies: TrafficPolicy[];
}

/**
 * DNS zone configuration
 * Enterprise: Multi-zone management με delegation
 */
export interface DNSZone {
  name: string;
  type: 'public' | 'private';
  records: DNSRecord[];
  ttl: number;
  autoRenew: boolean;
}

/**
 * DNS record configuration
 * Enterprise: All record types με advanced routing
 */
export interface DNSRecord {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS' | 'PTR';
  value: string[];
  ttl: number;
  weight?: number;
  priority?: number;
  port?: number;
  protocol?: string;
  service?: string;
}

/**
 * DNS health check configuration
 * Enterprise: Multi-region health monitoring
 */
export interface DNSHealthCheck {
  name: string;
  type: 'HTTP' | 'HTTPS' | 'TCP';
  resourcePath?: string;
  fullyQualifiedDomainName: string;
  port?: number;
  requestInterval: number;
  failureThreshold: number;
  regions: string[];
  alertOnFailure: boolean;
}

/**
 * Traffic policy για advanced DNS routing
 * Enterprise: Geolocation και latency-based routing
 */
export interface TrafficPolicy {
  name: string;
  type: 'simple' | 'weighted' | 'latency' | 'failover' | 'geolocation';
  version: number;
  rules: TrafficPolicyRule[];
}

/**
 * Traffic policy rule
 * Enterprise: Complex routing logic με conditions
 */
export interface TrafficPolicyRule {
  ruleType: string;
  location?: string;
  weight?: number;
  healthCheck?: string;
  target: string;
  failover?: 'primary' | 'secondary';
}

// ============================================================================
// FIREWALL CONFIGURATION TYPES
// ============================================================================

/**
 * Firewall configuration - EXACT COPY FROM ORIGINAL
 */
export interface FirewallConfig {
  rules: FirewallRule[];
  defaultAction: 'allow' | 'deny';
  logging: boolean;
}

/**
 * Firewall rule - EXACT COPY FROM ORIGINAL
 */
export interface FirewallRule {
  name: string;
  priority: number;
  direction: 'inbound' | 'outbound';
  action: 'allow' | 'deny';
  protocol: 'TCP' | 'UDP' | 'ICMP' | 'any';
  sourceIP?: string;
  sourcePort?: string;
  destinationIP?: string;
  destinationPort?: string;
}

// ============================================================================
// WAF CONFIGURATION TYPES
// ============================================================================

/**
 * WAF configuration - EXACT COPY FROM ORIGINAL
 */
export interface WAFConfig {
  enabled: boolean;
  rules: WAFRule[];
  rateLimiting: {
    enabled: boolean;
    requestsPerMinute: number;
  };
  geoBlocking: {
    enabled: boolean;
    blockedCountries: string[];
    allowedCountries: string[];
  };
}

/**
 * WAF rule για application security
 * Enterprise: OWASP Top 10 protection με custom rules
 */
export interface WAFRule {
  name: string;
  type: 'sql-injection' | 'xss' | 'rate-limit' | 'geo-block' | 'custom';
  action: 'allow' | 'block' | 'challenge';
  priority: number;
  conditions: string[];
}

// ============================================================================
// VPN CONFIGURATION TYPES
// ============================================================================

/**
 * VPN configuration για secure connectivity
 * Enterprise: Site-to-site και client-to-site support
 */
export interface VPNConfig {
  enabled: boolean;
  type: 'site-to-site' | 'client-to-site';
  endpoints: VPNEndpoint[];
  encryption: string;
}

/**
 * VPN endpoint configuration
 * Enterprise: Multiple tunnels με BGP support
 */
export interface VPNEndpoint {
  name: string;
  address: string;
  tunnels: number;
  bgp: boolean;
}

// ============================================================================
// NETWORK MONITORING TYPES
// ============================================================================

/**
 * Network monitoring configuration
 * Enterprise: Real-time network performance monitoring
 */
export interface NetworkMonitoringConfig {
  enabled: boolean;
  metrics: NetworkMetric[];
  flowLogs: FlowLogConfig;
  packetCapture: PacketCaptureConfig;
  latencyMonitoring: LatencyMonitoringConfig;
}

/**
 * Network metric configuration
 * Enterprise: Comprehensive network metrics collection
 */
export interface NetworkMetric {
  name: string;
  type: 'bandwidth' | 'latency' | 'packet-loss' | 'connections' | 'errors';
  threshold: number;
  unit: string;
  alertEnabled: boolean;
}

/**
 * Flow log configuration για network traffic analysis
 * Enterprise: Detailed network flow monitoring
 */
export interface FlowLogConfig {
  enabled: boolean;
  logFormat: 'standard' | 'custom';
  fields: string[];
  destination: 'cloudwatch' | 's3' | 'kinesis';
  retention: number;
}

/**
 * Packet capture configuration για deep analysis
 * Enterprise: On-demand packet capture capabilities
 */
export interface PacketCaptureConfig {
  enabled: boolean;
  filters: PacketFilter[];
  maxPacketSize: number;
  maxDuration: number;
  storageLocation: string;
}

/**
 * Packet filter για targeted capture
 * Enterprise: Protocol και port-based filtering
 */
export interface PacketFilter {
  name: string;
  protocol?: string;
  sourceIP?: string;
  destinationIP?: string;
  sourcePort?: number;
  destinationPort?: number;
}

/**
 * Latency monitoring configuration
 * Enterprise: End-to-end latency measurement
 */
export interface LatencyMonitoringConfig {
  enabled: boolean;
  probes: LatencyProbe[];
  alertThreshold: number;
  measurementInterval: number;
}

/**
 * Latency probe configuration
 * Enterprise: Multi-point latency measurement
 */
export interface LatencyProbe {
  name: string;
  source: string;
  destination: string;
  protocol: 'ICMP' | 'TCP' | 'UDP';
  port?: number;
  frequency: number;
}

// ============================================================================
// TRAFFIC SHAPING TYPES
// ============================================================================

/**
 * Traffic shaping configuration για bandwidth management
 * Enterprise: QoS και bandwidth allocation
 */
export interface TrafficShapingConfig {
  enabled: boolean;
  policies: QoSPolicy[];
  bandwidthLimits: BandwidthLimit[];
  prioritization: TrafficPrioritization;
}

/**
 * Quality of Service policy
 * Enterprise: Application-aware traffic prioritization
 */
export interface QoSPolicy {
  name: string;
  rules: QoSRule[];
  defaultClass: string;
  enabled: boolean;
}

/**
 * QoS rule για traffic classification
 * Enterprise: Multi-criteria traffic classification
 */
export interface QoSRule {
  name: string;
  priority: number;
  conditions: QoSCondition[];
  actions: QoSAction[];
}

/**
 * QoS condition για traffic matching
 * Enterprise: Application και protocol-based matching
 */
export interface QoSCondition {
  type: 'protocol' | 'port' | 'dscp' | 'application' | 'source-ip' | 'destination-ip';
  value: string | number;
  operator: 'equals' | 'not-equals' | 'greater-than' | 'less-than' | 'contains';
}

/**
 * QoS action για traffic handling
 * Enterprise: Bandwidth allocation και marking
 */
export interface QoSAction {
  type: 'set-dscp' | 'set-class' | 'limit-bandwidth' | 'drop' | 'prioritize';
  value?: string | number;
}

/**
 * Bandwidth limit configuration
 * Enterprise: Per-application bandwidth limits
 */
export interface BandwidthLimit {
  name: string;
  application?: string;
  protocol?: string;
  upload: number;
  download: number;
  burstAllowed: boolean;
  enforcement: 'soft' | 'hard';
}

/**
 * Traffic prioritization configuration
 * Enterprise: Multi-tier traffic prioritization
 */
export interface TrafficPrioritization {
  enabled: boolean;
  classes: TrafficClass[];
  algorithm: 'strict' | 'weighted' | 'deficit-round-robin';
}

/**
 * Traffic class για prioritization
 * Enterprise: Application-aware traffic classes
 */
export interface TrafficClass {
  name: string;
  priority: number;
  weight?: number;
  guaranteedBandwidth: number;
  maxBandwidth?: number;
  applications: string[];
}

// ============================================================================
// EXACT COPIES FROM ORIGINAL CloudInfrastructure.ts (CHUNK 2: LINES 201-400)
// ============================================================================

/**
 * CDN configuration
 */
export interface CDNConfig {
  enabled: boolean;
  provider: 'cloudflare' | 'aws-cloudfront' | 'azure-cdn' | 'google-cdn';
  origins: CDNOrigin[];
  caching: CachingConfig;
  compression: boolean;
  minify: boolean;
  waf: WAFConfig;
}

/**
 * CDN origin
 */
export interface CDNOrigin {
  id: string;
  domainName: string;
  path?: string;
  customHeaders: Record<string, string>;
  sslProtocols: string[];
}

/**
 * Caching configuration
 */
export interface CachingConfig {
  defaultTtl: number;
  maxTtl: number;
  cachePolicyId?: string;
  behaviors: CacheBehavior[];
}

/**
 * WAF rule
 */
export interface WAFRule {
  name: string;
  priority: number;
  action: 'allow' | 'block' | 'count';
  conditions: WAFCondition[];
}

/**
 * DNS configuration
 */
export interface DNSConfig {
  provider: 'route53' | 'cloudflare' | 'azure-dns' | 'google-dns';
  domain: string;
  records: DNSRecord[];
  healthChecks: DNSHealthCheck[];
}

/**
 * DNS record
 */
export interface DNSRecord {
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SOA';
  value: string;
  ttl: number;
  geolocation?: {
    continent?: string;
    country?: string;
    subdivision?: string;
  };
  weight?: number;
  setIdentifier?: string;
}

/**
 * DNS health check
 */
export interface DNSHealthCheck {
  name: string;
  type: 'HTTP' | 'HTTPS' | 'TCP';
  target: string;
  port?: number;
  path?: string;
  interval: number;
  timeout: number;
  failureThreshold: number;
}

/**
 * CORS configuration - EXACT COPY FROM ORIGINAL
 */
export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  maxAge: number;
}