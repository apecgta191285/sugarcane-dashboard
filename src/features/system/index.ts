/**
 * System Feature
 * 
 * This feature contains system-level utilities like health checks,
 * configuration, and diagnostics.
 * 
 * Structure:
 * - actions/     Server Actions for system operations
 */

export { runHealthCheck, type HealthCheckResult, type ServiceHealth } from "./actions/health-check";
