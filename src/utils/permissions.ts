/**
 * Permission utilities for checking user roles and exemptions
 */

import { GuildMember } from 'discord.js';
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
