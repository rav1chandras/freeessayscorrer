/**
 * MySQL connection pool.
 *
 * One pool per Node process, shared across all DB-touching modules.
 * On first use, ensures the schema exists. All subsequent calls skip the
 * check via a module-level `schemaReady` promise.
 *
 * Configure via env vars:
 *   DB_HOST      (required in production)
 *   DB_PORT      (default 3306)
 *   DB_USER      (required)
 *   DB_PASSWORD  (required)
 *   DB_NAME      (required)
 *
 * Hostinger provides these in hPanel under Databases → MySQL.
 */

import mysql from 'mysql2/promise'

let pool: mysql.Pool | null = null
let schemaReady: Promise<void> | null = null

function getPool(): mysql.Pool {
  if (pool) return pool

  const host = process.env.DB_HOST
  const user = process.env.DB_USER
  const password = process.env.DB_PASSWORD
  const database = process.env.DB_NAME
  const port = Number(process.env.DB_PORT ?? 3306)

  if (!host || !user || !database) {
    throw new Error(
      'Database not configured. Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME in your environment.'
    )
  }

  pool = mysql.createPool({
    host,
    port,
    user,
    password: password ?? '',
    database,
    // Hostinger shared plans cap connections; 5 is a conservative ceiling.
    connectionLimit: 5,
    waitForConnections: true,
    queueLimit: 0,
    // Keep connections healthy across idle periods.
    enableKeepAlive: true,
    keepAliveInitialDelay: 30_000,
    // Match the existing JSON behavior where createdAt is ISO UTC.
    timezone: 'Z',
    // Safer date handling: return DATETIME as Date objects, not strings.
    dateStrings: false,
  })

  return pool
}

/**
 * Create tables if they don't exist. Idempotent — safe to call on every boot.
 * MySQL 5.7+ compatible; Hostinger Business/Cloud ships MariaDB 10.5+ which
 * supports every feature used here.
 */
async function ensureSchema(p: mysql.Pool): Promise<void> {
  // email_captures — unique by email (case-insensitive via utf8mb4_unicode_ci)
  await p.query(`
    CREATE TABLE IF NOT EXISTS email_captures (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      email VARCHAR(254) NOT NULL,
      first_tool VARCHAR(64) NULL,
      source VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_email (email),
      KEY idx_created (created_at),
      KEY idx_source (source)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // analytics_events — meta stored as JSON column
  await p.query(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(64) NOT NULL,
      session_id VARCHAR(64) NULL,
      tool VARCHAR(64) NULL,
      quality VARCHAR(16) NULL,
      source VARCHAR(64) NULL,
      meta JSON NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_name_created (name, created_at),
      KEY idx_tool (tool),
      KEY idx_source (source),
      KEY idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
}

/**
 * Acquire the pool and make sure the schema exists.
 * The schemaReady promise caches the first init so we only hit DDL once per process.
 */
export async function getDb(): Promise<mysql.Pool> {
  const p = getPool()
  if (!schemaReady) {
    schemaReady = ensureSchema(p).catch((err) => {
      // Reset so the next call retries instead of poisoning the promise forever.
      schemaReady = null
      throw err
    })
  }
  await schemaReady
  return p
}
