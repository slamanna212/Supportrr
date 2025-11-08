/**
 * Thread handler for managing thread lifecycle and cleanup
 */

import { ThreadChannel } from 'discord.js';
import { client } from '../bot.js';
import { getExpiredThreads, deactivateThread, closeThread } from '../database.js';
import { logThreadDeleted, logThreadExpired, logError } from '../utils/logger.js';

// Cleanup interval in milliseconds (5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000;

let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Initialize thread event handlers and cleanup job
 */
export function initializeThreadHandler(): void {
  // Listen for thread deletion events
  client.on('threadDelete', handleThreadDelete);

  // Start periodic cleanup job
  startCleanupJob();

  console.log('Thread handler initialized');
}

/**
 * Handle thread deletion event
 * @param thread - Deleted thread
 */
async function handleThreadDelete(thread: ThreadChannel): Promise<void> {
  try {
    console.log(`Thread deleted: ${thread.name} (${thread.id})`);

    // Deactivate the thread in database
    deactivateThread(thread.id);

    // Log the deletion
    await logThreadDeleted(thread.id);
  } catch (error) {
    console.error('Error handling thread deletion:', error);
    await logError(error as Error, 'handleThreadDelete');
  }
}

/**
 * Start the periodic cleanup job for expired threads
 */
function startCleanupJob(): void {
  console.log(`Starting thread cleanup job (runs every ${CLEANUP_INTERVAL / 60000} minutes)`);

  // Run cleanup immediately on startup
  cleanupExpiredThreads().catch(error => {
    console.error('Error in initial cleanup:', error);
  });

  // Set up periodic cleanup
  cleanupIntervalId = setInterval(async () => {
    try {
      await cleanupExpiredThreads();
    } catch (error) {
      console.error('Error in cleanup job:', error);
      await logError(error as Error, 'cleanupJob');
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Stop the cleanup job (called during shutdown)
 */
export function stopCleanupJob(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('Thread cleanup job stopped');
  }
}

/**
 * Clean up threads that have expired (past 24 hours)
 */
async function cleanupExpiredThreads(): Promise<void> {
  try {
    const expiredThreads = getExpiredThreads();

    if (expiredThreads.length === 0) {
      console.log('No expired threads to clean up');
      return;
    }

    console.log(`Found ${expiredThreads.length} expired thread(s) to clean up`);

    for (const threadData of expiredThreads) {
      try {
        // Fetch the thread from Discord
        const thread = await client.channels.fetch(threadData.thread_id).catch((error: any) => {
          // Check if it's a 404 error (thread not found)
          if (error.code === 10003 || error.status === 404) {
            console.log(`Thread ${threadData.thread_id} not found (deleted)`);
            return null;
          }
          // For other errors (network issues, etc.), re-throw to be handled by outer try-catch
          throw error;
        });

        if (!thread || !thread.isThread()) {
          console.log(`Thread ${threadData.thread_id} not found or is not a thread`);
          // Mark as closed in database only if thread doesn't exist (404)
          closeThread(threadData.thread_id);
          continue;
        }

        // Lock the thread
        await thread.setLocked(true, 'Thread expired after 24 hours');

        // Archive the thread
        await thread.setArchived(true, 'Thread expired after 24 hours');

        // Mark as closed in database
        closeThread(threadData.thread_id);

        // Log the expiration
        await logThreadExpired(threadData.thread_id, thread.name);

        console.log(`Closed expired thread: ${thread.name} (${thread.id})`);
      } catch (error: any) {
        console.error(`Error closing thread ${threadData.thread_id}:`, error);

        // Only mark as closed if it's a permanent error (not found, permissions, etc.)
        // Don't mark as closed for transient errors (network issues, rate limits, etc.)
        const permanentErrorCodes = [10003, 10004, 10008, 50001, 50013]; // Unknown Channel, Unknown Guild, Unknown Message, Missing Access, Missing Permissions
        if (error.code && permanentErrorCodes.includes(error.code)) {
          console.log(`Marking thread ${threadData.thread_id} as closed due to permanent error`);
          closeThread(threadData.thread_id);
        } else {
          console.log(`Not marking thread ${threadData.thread_id} as closed - may be transient error, will retry later`);
        }

        await logError(error as Error, `cleanupThread-${threadData.thread_id}`);
      }
    }

    console.log(`Cleanup completed. Processed ${expiredThreads.length} thread(s)`);
  } catch (error) {
    console.error('Error in cleanupExpiredThreads:', error);
    await logError(error as Error, 'cleanupExpiredThreads');
  }
}
