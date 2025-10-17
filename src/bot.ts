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
client.once('ready', () => {
  console.log(`Bot logged in as ${client.user?.tag}`);
  console.log(`Ready to manage support threads!`);
});

/**
 * Setup error handler
 */
client.on('error', (error) => {
  console.error('Discord client error:', error);
});
