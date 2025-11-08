/**
 * Discord bot initialization and client setup
 */

import { Client, GatewayIntentBits, Partials } from 'discord.js';

/**
 * Create and configure the Discord client with required intents
 */
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
  ],
});

/**
 * Setup ready event handler
 */
client.once('ready', async () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
  console.log(`Ready to manage support threads!`);

  // Verify permissions on startup
  await verifyPermissions();
});

/**
 * Verify bot has required permissions in configured channels
 */
async function verifyPermissions(): Promise<void> {
  try {
    const { config } = await import('./config.js');
    const { checkBotPermissions, canKickMembers } = await import('./utils/permissions.js');
    const { GuildChannel } = await import('discord.js');

    // Check managed channel permissions
    const managedChannel = await client.channels.fetch(config.managedChannelId);
    if (!managedChannel) {
      console.error(`⚠️  WARNING: Could not find managed channel: ${config.managedChannelId}`);
      return;
    }

    if (managedChannel instanceof GuildChannel) {
      const { hasAll, missing } = checkBotPermissions(managedChannel);
      if (!hasAll) {
        console.error(`⚠️  WARNING: Missing permissions in managed channel (${config.managedChannelId}):`);
        console.error(`   Missing: ${missing.join(', ')}`);
        console.error(`   The bot may not function correctly without these permissions.`);
      } else {
        console.log(`✓ All required permissions present in managed channel`);
      }

      // Check kick permission
      if (!canKickMembers(managedChannel.guild)) {
        console.error(`⚠️  WARNING: Bot does not have KICK_MEMBERS permission`);
        console.error(`   Users who exceed attempt limits cannot be kicked.`);
      } else {
        console.log(`✓ Kick members permission present`);
      }
    }

    // Check logging channel permissions
    const loggingChannel = await client.channels.fetch(config.loggingChannelId);
    if (!loggingChannel) {
      console.error(`⚠️  WARNING: Could not find logging channel: ${config.loggingChannelId}`);
      return;
    }

    if (loggingChannel instanceof GuildChannel) {
      const permissions = loggingChannel.permissionsFor(loggingChannel.guild.members.me!);
      if (!permissions?.has(['ViewChannel', 'SendMessages'])) {
        console.error(`⚠️  WARNING: Missing permissions in logging channel (${config.loggingChannelId})`);
        console.error(`   The bot may not be able to send log messages.`);
      } else {
        console.log(`✓ Logging channel permissions present`);
      }
    }
  } catch (error) {
    console.error('Error verifying permissions:', error);
  }
}

/**
 * Setup error handler
 */
client.on('error', (error) => {
  console.error('Discord client error:', error);
});
