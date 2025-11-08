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
 * Validates that a string is a valid Discord snowflake ID
 * @param id - The ID to validate
 * @returns true if valid, false otherwise
 */
function isValidSnowflake(id: string): boolean {
  // Discord snowflakes are numeric strings of 17-19 digits
  return /^\d{17,19}$/.test(id);
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
 * Validates and requires a Discord snowflake ID
 * @param name - Name of the environment variable
 * @param value - Value to validate
 * @returns The validated snowflake ID
 * @throws Error if invalid
 */
function requireSnowflake(name: string, value: string | undefined): string {
  const validated = requireEnv(name, value);
  if (!isValidSnowflake(validated)) {
    throw new Error(
      `Invalid Discord ID for ${name}: "${validated}"\n` +
      `Discord IDs should be numeric strings of 17-19 digits.\n` +
      `Please check your configuration and ensure you're copying the ID correctly from Discord.`
    );
  }
  return validated;
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
  const roleIds = value
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0);

  // Validate each role ID is a valid snowflake
  for (const roleId of roleIds) {
    if (!isValidSnowflake(roleId)) {
      throw new Error(
        `Invalid role ID in EXEMPT_ROLE_IDS: "${roleId}"\n` +
        `Discord IDs should be numeric strings of 17-19 digits.\n` +
        `Please check your configuration.`
      );
    }
  }

  return roleIds;
}

/**
 * Load and validate configuration from environment variables
 */
function loadConfig(): Config {
  const config: Config = {
    discordToken: requireEnv('DISCORD_TOKEN', process.env.DISCORD_TOKEN),
    managedChannelId: requireSnowflake('MANAGED_CHANNEL_ID', process.env.MANAGED_CHANNEL_ID),
    exemptRoleIds: parseRoleIds(process.env.EXEMPT_ROLE_IDS),
    loggingChannelId: requireSnowflake('LOGGING_CHANNEL_ID', process.env.LOGGING_CHANNEL_ID),
    databasePath: process.env.DATABASE_PATH || './data/bot.db',
  };

  return config;
}

// Export the validated configuration
export const config = loadConfig();
