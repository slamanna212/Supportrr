/**
 * Logging utility for the Discord Support Bot
 * Sends formatted log messages to a designated logging channel
 */

import { TextChannel, EmbedBuilder, ColorResolvable } from 'discord.js';
import { client } from '../bot.js';
import { config } from '../config.js';

export enum LogType {
  THREAD_CREATED = 'THREAD_CREATED',
  USER_KICKED = 'USER_KICKED',
  MESSAGE_DELETED = 'MESSAGE_DELETED',
  THREAD_EXPIRED = 'THREAD_EXPIRED',
  THREAD_DELETED = 'THREAD_DELETED',
  ERROR = 'ERROR',
  INFO = 'INFO',
}

const LOG_COLORS: Record<LogType, ColorResolvable> = {
  [LogType.THREAD_CREATED]: 0x00FF00, // Green
  [LogType.USER_KICKED]: 0xFF0000, // Red
  [LogType.MESSAGE_DELETED]: 0xFFA500, // Orange
  [LogType.THREAD_EXPIRED]: 0x808080, // Gray
  [LogType.THREAD_DELETED]: 0x808080, // Gray
  [LogType.ERROR]: 0xFF0000, // Red
  [LogType.INFO]: 0x0099FF, // Blue
};

/**
 * Send a log message to the logging channel
 * @param type - Type of log event
 * @param message - Log message content
 * @param details - Optional additional details
 */
export async function log(type: LogType, message: string, details?: string): Promise<void> {
  try {
    const loggingChannel = await client.channels.fetch(config.loggingChannelId);

    if (!loggingChannel || !(loggingChannel instanceof TextChannel)) {
      console.error('Logging channel not found or is not a text channel');
      console.log(`[${type}] ${message}${details ? `\n${details}` : ''}`);
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(LOG_COLORS[type])
      .setTitle(`📋 ${type.replace(/_/g, ' ')}`)
      .setDescription(message)
      .setTimestamp();

    if (details) {
      embed.addFields({ name: 'Details', value: details });
    }

    await loggingChannel.send({ embeds: [embed] });
  } catch (error) {
    console.error('Failed to send log to Discord channel:', error);
    console.log(`[${type}] ${message}${details ? `\n${details}` : ''}`);
  }
}

/**
 * Log thread creation event
 * @param userId - User ID
 * @param userName - User display name
 * @param threadId - Thread ID
 * @param threadName - Thread name
 */
export async function logThreadCreated(
  userId: string,
  userName: string,
  threadId: string,
  threadName: string
): Promise<void> {
  await log(
    LogType.THREAD_CREATED,
    `New support thread created for <@${userId}>`,
    `**User:** ${userName} (${userId})\n**Thread:** ${threadName}\n**Thread ID:** ${threadId}`
  );
}

/**
 * Log user kick event
 * @param userId - User ID
 * @param userName - User display name
 * @param attemptCount - Number of attempts made
 */
export async function logUserKicked(
  userId: string,
  userName: string,
  attemptCount: number
): Promise<void> {
  await log(
    LogType.USER_KICKED,
    `User <@${userId}> kicked for excessive posting attempts`,
    `**User:** ${userName} (${userId})\n**Attempts:** ${attemptCount}`
  );
}

/**
 * Log message deletion event
 * @param userId - User ID
 * @param userName - User display name
 * @param threadLink - Link to existing thread
 * @param attemptCount - Current attempt count
 */
export async function logMessageDeleted(
  userId: string,
  userName: string,
  threadLink: string,
  attemptCount: number
): Promise<void> {
  await log(
    LogType.MESSAGE_DELETED,
    `Message deleted from <@${userId}>`,
    `**User:** ${userName} (${userId})\n**Active Thread:** ${threadLink}\n**Attempts:** ${attemptCount}/10`
  );
}

/**
 * Log thread expiration event
 * @param threadId - Thread ID
 * @param threadName - Thread name
 */
export async function logThreadExpired(threadId: string, threadName: string): Promise<void> {
  await log(
    LogType.THREAD_EXPIRED,
    `Thread expired and closed after 24 hours`,
    `**Thread:** ${threadName}\n**Thread ID:** ${threadId}`
  );
}

/**
 * Log thread manual deletion event
 * @param threadId - Thread ID
 */
export async function logThreadDeleted(threadId: string): Promise<void> {
  await log(
    LogType.THREAD_DELETED,
    `Thread manually deleted`,
    `**Thread ID:** ${threadId}`
  );
}

/**
 * Log error event
 * @param error - Error object or message
 * @param context - Context where the error occurred
 */
export async function logError(error: Error | string, context: string): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : error;
  const stackTrace = error instanceof Error ? error.stack : undefined;

  await log(
    LogType.ERROR,
    `Error occurred in ${context}`,
    `**Error:** ${errorMessage}${stackTrace ? `\n**Stack:**\n\`\`\`\n${stackTrace.substring(0, 1000)}\n\`\`\`` : ''}`
  );
}

/**
 * Log informational event
 * @param message - Info message
 * @param details - Optional details
 */
export async function logInfo(message: string, details?: string): Promise<void> {
  await log(LogType.INFO, message, details);
}
