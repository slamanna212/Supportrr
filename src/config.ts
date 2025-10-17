/**
 * Configuration module for the Discord Support Bot
 * Validates and exports environment variables
 */

export interface Config {
  discordToken: string;
  managedChannelId: string;
  exemptRoleIds: string[];
  loggingChannelId: string;
  databasePath: string;
}

/**
 * Validates that a required environment variable exists
 * @param name - Name of the environment variable
 * @param value - Value of the environment variable
 * @returns The validated value
 * @throws Error if the value is undefined or empty
 */
function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `Missing required environment variable: ${name}\n` +
      `Please ensure ${name} is set in your environment or .env file.`
    );
  }
  return value.trim();
}

/**
 * Parses comma-separated role IDs from environment variable
 * @param value - Comma-separated string of role IDs
 * @returns Array of role IDs (empty array if value is empty)
 */
function parseRoleIds(value: string | undefined): string[] {
  if (!value || value.trim() === '') {
    return [];
  }
  return value
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const config: Config = {
    discordToken: requireEnv('DISCORD_TOKEN', process.env.DISCORD_TOKEN),
    managedChannelId: requireEnv('MANAGED_CHANNEL_ID', process.env.MANAGED_CHANNEL_ID),
    exemptRoleIds: parseRoleIds(process.env.EXEMPT_ROLE_IDS),
    loggingChannelId: requireEnv('LOGGING_CHANNEL_ID', process.env.LOGGING_CHANNEL_ID),
    databasePath: process.env.DATABASE_PATH || './data/bot.db',
  };

  return config;
}

// Export the validated configuration
export const config = loadConfig();
