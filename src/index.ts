/**
 * Discord Support Thread Bot
 * Main entry point
 */

import { config } from './config.js';
import { initializeDatabase, closeDatabase } from './database.js';
import { client } from './bot.js';
import { initializeMessageHandler } from './handlers/messageHandler.js';
import { initializeThreadHandler, stopCleanupJob } from './handlers/threadHandler.js';
import { logInfo, logError } from './utils/logger.js';
import { checkBotPermissions, canKickMembers } from './utils/permissions.js';
import { GuildChannel } from 'discord.js';

/**
 * Main function to start the bot
 */
async function main(): Promise<void> {
  try {
    console.log('Starting Discord Support Thread Bot...');
    console.log('Configuration loaded successfully');

    // Initialize database
    console.log('Initializing database...');
    initializeDatabase();

    // Initialize event handlers
    console.log('Initializing event handlers...');
    initializeMessageHandler();
    initializeThreadHandler();

    // Login to Discord
    console.log('Logging in to Discord...');
    await client.login(config.discordToken);

    // Log successful startup
    await logInfo(
      'Bot started successfully',
      `Managing channel: ${config.managedChannelId}\n` +
      `Logging to channel: ${config.loggingChannelId}\n` +
      `Exempt roles: ${config.exemptRoleIds.length > 0 ? config.exemptRoleIds.join(', ') : 'None'}`
    );

    console.log('Bot is now running!');
  } catch (error) {
    console.error('Failed to start bot:', error);
    await logError(error as Error, 'startup');
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  try {
    // Stop cleanup job
    stopCleanupJob();

    // Log shutdown
    await logInfo('Bot shutting down', `Received signal: ${signal}`);

    // Destroy Discord client
    client.destroy();
    console.log('Discord client disconnected');

    // Close database connection
    closeDatabase();

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  // Use a promise to ensure async operations complete before exit
  (async () => {
    try {
      await logError(error, 'uncaughtException');
      await shutdown('uncaughtException');
    } catch (shutdownError) {
      console.error('Error during shutdown after uncaught exception:', shutdownError);
      process.exit(1);
    }
  })();
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  // Use a promise to ensure async operations complete
  (async () => {
    try {
      await logError(
        reason instanceof Error ? reason : new Error(String(reason)),
        'unhandledRejection'
      );
      // Don't shutdown on unhandled rejection, just log it
    } catch (logErrorError) {
      console.error('Error logging unhandled rejection:', logErrorError);
    }
  })();
});

// Start the bot
main();
