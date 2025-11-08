/**
 * Permission utilities for checking user roles and exemptions
 */

import { GuildMember, PermissionsBitField, Guild, GuildChannel } from 'discord.js';
import { config } from '../config.js';

/**
 * Check if a user has any of the exempt roles
 * @param member - Guild member to check
 * @returns true if user has an exempt role, false otherwise
 */
export function isExemptUser(member: GuildMember): boolean {
  // If no exempt roles configured, no one is exempt
  if (config.exemptRoleIds.length === 0) {
    return false;
  }

  // Check if the member has any of the exempt roles
  return config.exemptRoleIds.some(roleId => member.roles.cache.has(roleId));
}

/**
 * Get the list of exempt role IDs
 * @returns Array of exempt role IDs
 */
export function getExemptRoleIds(): string[] {
  return config.exemptRoleIds;
}

/**
 * Check if the bot has all required permissions in a channel
 * @param channel - The channel to check permissions in
 * @returns Object containing missing permissions
 */
export function checkBotPermissions(channel: GuildChannel): {
  hasAll: boolean;
  missing: string[];
} {
  const me = channel.guild.members.me;
  if (!me) {
    return { hasAll: false, missing: ['Bot member not found in guild'] };
  }

  const requiredPermissions = [
    PermissionsBitField.Flags.ViewChannel,
    PermissionsBitField.Flags.SendMessages,
    PermissionsBitField.Flags.ManageMessages,
    PermissionsBitField.Flags.ManageThreads,
    PermissionsBitField.Flags.CreatePublicThreads,
    PermissionsBitField.Flags.ReadMessageHistory,
  ];

  const permissions = channel.permissionsFor(me);
  if (!permissions) {
    return { hasAll: false, missing: ['Cannot read permissions'] };
  }

  const missing: string[] = [];
  for (const perm of requiredPermissions) {
    if (!permissions.has(perm)) {
      const permName = Object.keys(PermissionsBitField.Flags).find(
        key => PermissionsBitField.Flags[key as keyof typeof PermissionsBitField.Flags] === perm
      );
      if (permName) {
        missing.push(permName);
      }
    }
  }

  return {
    hasAll: missing.length === 0,
    missing,
  };
}

/**
 * Check if the bot can kick members in a guild
 * @param guild - The guild to check permissions in
 * @returns true if bot can kick members, false otherwise
 */
export function canKickMembers(guild: Guild): boolean {
  const me = guild.members.me;
  if (!me) {
    return false;
  }

  return me.permissions.has(PermissionsBitField.Flags.KickMembers);
}
