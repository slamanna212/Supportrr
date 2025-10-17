/**
 * Message handler for managing support channel messages
 */

import { Message } from 'discord.js';
import { client } from '../bot.js';
import { config } from '../config.js';
import { getActiveThread, createThread, incrementAttempts } from '../database.js';
import { isExemptUser } from '../utils/permissions.js';
import {
  logThreadCreated,
  logMessageDeleted,
  logUserKicked,
  logError,
} from '../utils/logger.js';

/**
 * Initialize message event handler
 */
export function initializeMessageHandler(): void {
  client.on('messageCreate', handleMessage);
}

/**
 * Handle incoming messages
 * @param message - Discord message object
 */
async function handleMessage(message: Message): Promise<void> {
  try {
    // Ignore bot messages
    if (message.author.bot) {
      return;
    }

    // Check if message is in the managed channel
    if (message.channelId !== config.managedChannelId) {
      return;
    }

    // Get guild member
    const member = message.member;
    if (!member) {
      console.error('Could not get member from message');
      return;
    }

    // Check if user has exempt role
    if (isExemptUser(member)) {
      console.log(`User ${member.user.tag} is exempt from thread management`);
      return;
    }

    // Check database for active thread
    const activeThread = getActiveThread(message.author.id);

    if (!activeThread) {
      // No active thread - create a new one
      await createNewThread(message);
    } else {
      // Active thread exists - delete message and notify user
      await handleExistingThread(message, activeThread.thread_id);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await logError(error as Error, 'messageHandler');
  }
}

/**
 * Create a new support thread for the user
 * @param message - Original message from user
 */
async function createNewThread(message: Message): Promise<void> {
  try {
    const userName = message.member?.displayName || message.author.username;
    const threadName = `${userName}'s Support Thread`;

    // Create the thread
    const thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: 1440, // 24 hours in minutes
      reason: 'New support request',
    });

    // Store in database
    createThread(message.author.id, thread.id, message.channelId);

    // Log thread creation
    await logThreadCreated(
      message.author.id,
      userName,
      thread.id,
      threadName
    );

    console.log(`Created new thread for ${userName} (${message.author.id})`);
  } catch (error) {
    console.error('Error creating thread:', error);
    await logError(error as Error, 'createNewThread');
  }
}

/**
 * Handle message when user already has an active thread
 * @param message - Message to delete
 * @param threadId - ID of user's active thread
 */
async function handleExistingThread(message: Message, threadId: string): Promise<void> {
  try {
    const userName = message.member?.displayName || message.author.username;

    // Delete the message
    await message.delete();

    // Increment attempt count
    const newAttemptCount = incrementAttempts(message.author.id);

    // Try to DM the user with thread link
    const threadLink = `https://discord.com/channels/${message.guildId}/${threadId}`;
    const dmSuccess = await sendThreadLinkDM(message.author.id, threadLink, newAttemptCount);

    if (!dmSuccess) {
      console.log(`Could not DM user ${userName} (${message.author.id}) - DMs may be disabled`);
    }

    // Log message deletion
    await logMessageDeleted(
      message.author.id,
      userName,
      threadLink,
      newAttemptCount
    );

    // Check if user should be kicked (10 or more attempts)
    if (newAttemptCount >= 10) {
      await kickUser(message);
    }

    console.log(
      `Deleted message from ${userName} (${message.author.id}). ` +
      `Attempts: ${newAttemptCount}/10`
    );
  } catch (error) {
    console.error('Error handling existing thread:', error);
    await logError(error as Error, 'handleExistingThread');
  }
}

/**
 * Send DM to user with link to their active thread
 * @param userId - Discord user ID
 * @param threadLink - URL to the thread
 * @param attemptCount - Current attempt count
 * @returns true if DM was sent successfully, false otherwise
 */
async function sendThreadLinkDM(
  userId: string,
  threadLink: string,
  attemptCount: number
): Promise<boolean> {
  try {
    const user = await client.users.fetch(userId);

    const warningMessage = attemptCount >= 10
      ? '\n\n⚠️ **WARNING:** You have reached the maximum number of attempts. You will be kicked from the server.'
      : attemptCount >= 7
      ? `\n\n⚠️ **WARNING:** You have ${10 - attemptCount} attempts remaining before being kicked.`
      : '';

    await user.send(
      `You already have an active support thread. Please use your existing thread to continue the conversation:\n\n` +
      `${threadLink}${warningMessage}\n\n` +
      `You can create a new thread in 24 hours.`
    );

    return true;
  } catch (error) {
    // DMs are likely disabled
    return false;
  }
}

/**
 * Kick user from the server
 * @param message - Message object (contains guild and member info)
 */
async function kickUser(message: Message): Promise<void> {
  try {
    if (!message.member) {
      console.error('Cannot kick user: member not found');
      return;
    }

    const userName = message.member.displayName || message.author.username;

    await message.member.kick('Exceeded maximum posting attempts in support channel (10 attempts)');

    await logUserKicked(
      message.author.id,
      userName,
      10
    );

    console.log(`Kicked user ${userName} (${message.author.id}) for excessive posting attempts`);
  } catch (error) {
    console.error('Error kicking user:', error);
    await logError(error as Error, 'kickUser');
  }
}
