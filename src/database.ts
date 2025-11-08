/**
 * Database module for SQLite operations
 * Manages user threads, attempt tracking, and thread lifecycle
 */

import Database from 'better-sqlite3';
import { config } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

export interface UserThread {
  id: number;
  user_id: string;
  thread_id: string;
  channel_id: string;
  created_at: number;
  expires_at: number;
  attempt_count: number;
  is_active: number;
}

let db: Database.Database;

/**
 * Initialize the database and create tables if they don't exist
 */
export function initializeDatabase(): void {
  // Ensure the database directory exists
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  }

  db = new Database(config.databasePath);

  // Create the user_threads table
  const createTableSQL = `
    CREATE TABLE IF NOT EXISTS user_threads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      attempt_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1
    )
  `;

  db.exec(createTableSQL);

  // Create indexes for better query performance
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_id ON user_threads(user_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_thread_id ON user_threads(thread_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_is_active ON user_threads(is_active)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_expires_at ON user_threads(expires_at)');
  // Compound index for the common query pattern (user_id + is_active)
  db.exec('CREATE INDEX IF NOT EXISTS idx_user_active ON user_threads(user_id, is_active)');

  console.log('Database initialized successfully');
}

/**
 * Get active thread for a user (within 24 hours)
 * @param userId - Discord user ID
 * @returns UserThread object if active thread exists, null otherwise
 */
export function getActiveThread(userId: string): UserThread | null {
  const stmt = db.prepare(`
    SELECT * FROM user_threads
    WHERE user_id = ? AND is_active = 1
    ORDER BY created_at DESC
    LIMIT 1
  `);

  const thread = stmt.get(userId) as UserThread | undefined;
  return thread || null;
}

/**
 * Create a new thread record in the database
 * @param userId - Discord user ID
 * @param threadId - Discord thread ID
 * @param channelId - Discord channel ID
 * @returns The created thread ID
 */
export function createThread(userId: string, threadId: string, channelId: string): number {
  const now = Date.now();
  const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours from now

  const stmt = db.prepare(`
    INSERT INTO user_threads (user_id, thread_id, channel_id, created_at, expires_at, attempt_count, is_active)
    VALUES (?, ?, ?, ?, ?, 0, 1)
  `);

  const result = stmt.run(userId, threadId, channelId, now, expiresAt);
  return result.lastInsertRowid as number;
}

/**
 * Increment the attempt count for a user's active thread
 * @param userId - Discord user ID
 * @returns New attempt count
 */
export function incrementAttempts(userId: string): number {
  // Use a transaction to make this atomic
  const transaction = db.transaction((userId: string) => {
    const updateStmt = db.prepare(`
      UPDATE user_threads
      SET attempt_count = attempt_count + 1
      WHERE user_id = ? AND is_active = 1
    `);
    updateStmt.run(userId);

    const selectStmt = db.prepare(`
      SELECT attempt_count FROM user_threads
      WHERE user_id = ? AND is_active = 1
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const result = selectStmt.get(userId) as { attempt_count: number } | undefined;
    return result?.attempt_count || 0;
  });

  return transaction(userId);
}

/**
 * Get the current attempt count for a user
 * @param userId - Discord user ID
 * @returns Current attempt count
 */
export function getAttemptCount(userId: string): number {
  const thread = getActiveThread(userId);
  return thread?.attempt_count || 0;
}

/**
 * Deactivate a thread (when it's manually deleted)
 * @param threadId - Discord thread ID
 */
export function deactivateThread(threadId: string): void {
  const stmt = db.prepare(`
    UPDATE user_threads
    SET is_active = 0
    WHERE thread_id = ?
  `);

  stmt.run(threadId);
}

/**
 * Get all threads that have expired (past 24 hours)
 * @returns Array of expired threads
 */
export function getExpiredThreads(): UserThread[] {
  const now = Date.now();
  const stmt = db.prepare(`
    SELECT * FROM user_threads
    WHERE expires_at < ? AND is_active = 1
  `);

  return stmt.all(now) as UserThread[];
}

/**
 * Close/deactivate a thread
 * @param threadId - Discord thread ID
 */
export function closeThread(threadId: string): void {
  deactivateThread(threadId);
}

/**
 * Close the database connection gracefully
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    console.log('Database connection closed');
  }
}

/**
 * Get database instance (for advanced queries if needed)
 */
export function getDatabase(): Database.Database {
  return db;
}
