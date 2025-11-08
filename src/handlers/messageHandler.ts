/**
 * Message handler for managing support channel messages
 */

import { Message, PermissionsBitField } from 'discord.js';
import { client } from '../bot.js';
import { config } from '../config.js';
import { getActiveThread, createThread, incrementAttempts } from '../database.js';
import { isExemptUser, canKickMembers } from '../utils/permissions.js';
import {
  logThreadCreated,
  logMessageDeleted,
  logUserKicked,
  logError,
} from '../utils/logger.js';

// Track users who are currently having threads created (prevents race conditions)
const threadCreationInProgress = new Map<string, Promise<void>>();

/**
 * Initialize message event handler
 */
export function initializeMessageHandler(): void {
  client.on('messageCreate', handleMessage);
}

/**
 * Verify that a thread is still active (not archived or deleted)
 * @param threadId - Discord thread ID
 * @returns true if thread exists and is not archived, false otherwise
 */
async function verifyThreadIsActive(threadId: string): Promise<boolean> {
  try {
    const thread = await client.channels.fetch(threadId);
    if (!thread || !thread.isThread()) {
      return false; // Thread doesn't exist or is not a thread
    }

    // Check if thread is archived or locked
    if (thread.archived || thread.locked) {
      return false;
    }

    return true;
  } catch (error) {
    // If we can't fetch the thread, assume it's not active
    console.log(`Could not verify thread ${threadId}: ${error}`);
    return false;
  }
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

    // Check if a thread is currently being created for this user
    const inProgressPromise = threadCreationInProgress.get(message.author.id);
    if (inProgressPromise) {
      // Wait for the in-progress creation to complete
      await inProgressPromise;
    }

    // Check database for active thread
    let activeThread = getActiveThread(message.author.id);

    // If we found a thread in the database, verify it's actually active in Discord
    if (activeThread) {
      const isThreadStillActive = await verifyThreadIsActive(activeThread.thread_id);
      if (!isThreadStillActive) {
        // Thread is archived or deleted, mark as inactive in database
        console.log(`Thread ${activeThread.thread_id} is archived/deleted, marking as inactive`);
        const { deactivateThread } = await import('../database.js');
        deactivateThread(activeThread.thread_id);
        activeThread = null; // Treat as if there's no active thread
      }
    }

    if (!activeThread) {
      // No active thread - create a new one
      // Store the promise to prevent concurrent creations
      const creationPromise = createNewThread(message);
      threadCreationInProgress.set(message.author.id, creationPromise);

      try {
        await creationPromise;
      } finally {
        // Always remove from the map when done
        threadCreationInProgress.delete(message.author.id);
      }
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
  let thread;
  try {
    const userName = message.member?.displayName || message.author.username;
    const threadName = `${userName}'s Support Thread`;

    // Create the thread
    thread = await message.startThread({
      name: threadName,
      autoArchiveDuration: 1440, // 24 hours in minutes
      reason: 'New support request',
    });

    // Store in database - if this fails, we need to clean up the Discord thread
    try {
      createThread(message.author.id, thread.id, message.channelId);
    } catch (dbError) {
      console.error('Failed to store thread in database, cleaning up Discord thread:', dbError);
      // Attempt to delete the thread we just created
      try {
        await thread.delete('Database insertion failed');
      } catch (deleteError) {
        console.error('Failed to delete thread during cleanup:', deleteError);
      }
      throw dbError; // Re-throw to be caught by outer catch
    }

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
    // If we have a thread object and it still exists, try to notify the user
    if (thread) {
      try {
        await thread.send('⚠️ An error occurred while setting up this thread. Please contact a moderator.');
      } catch (notifyError) {
        console.error('Failed to notify user of thread creation error:', notifyError);
      }
    }
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

    // Check if bot can delete messages
    const channel = message.channel;
    if (channel.isTextBased() && 'guild' in channel && channel.guild) {
      const botMember = channel.guild.members.me;
      if (botMember && channel.permissionsFor) {
        const permissions = channel.permissionsFor(botMember);
        if (!permissions?.has(PermissionsBitField.Flags.ManageMessages)) {
          console.error(`Cannot delete message: Missing MANAGE_MESSAGES permission in channel ${channel.id}`);
          await logError(new Error('Missing MANAGE_MESSAGES permission'), 'handleExistingThread');
          return;
        }
      }
    }

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

    // Check if user should be kicked (more than 10 attempts = 11th attempt)
    if (newAttemptCount > 10) {
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

    const warningMessage = attemptCount > 10
      ? '\n\n⚠️ **WARNING:** You have exceeded the maximum number of attempts and will be kicked from the server.'
      : attemptCount >= 7
      ? `\n\n⚠️ **WARNING:** You have ${10 - attemptCount} attempt(s) remaining before being kicked.`
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

    // Check if bot has permission to kick members
    if (message.guild && !canKickMembers(message.guild)) {
      console.error('Cannot kick user: Missing KICK_MEMBERS permission');
      await logError(new Error('Missing KICK_MEMBERS permission'), 'kickUser');
      return;
    }

    const userName = message.member.displayName || message.author.username;

    await message.member.kick('Exceeded maximum posting attempts in support channel (more than 10 attempts)');

    // Get the final attempt count for logging
    const thread = getActiveThread(message.author.id);
    const attemptCount = thread?.attempt_count || 0;

    await logUserKicked(
      message.author.id,
      userName,
      attemptCount
    );

    console.log(`Kicked user ${userName} (${message.author.id}) for excessive posting attempts`);
  } catch (error) {
    console.error('Error kicking user:', error);
    await logError(error as Error, 'kickUser');
  }
}
