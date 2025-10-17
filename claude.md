# Claude Context File - Discord Support Thread Bot

## Project Overview

This is a Discord bot built with TypeScript and discord.js v14 that manages support channels by automatically creating individual threads for users. It enforces a 24-hour cooldown period between thread creations and includes moderation features.

## Technology Stack

- **Runtime**: Node.js 24
- **Language**: TypeScript (strict mode enabled)
- **Discord Library**: discord.js v14
- **Database**: SQLite (better-sqlite3)
- **Development**: tsx for hot reload
- **Deployment**: Docker with multi-stage builds

## Architecture

### Directory Structure

```
src/
├── index.ts              # Application entry point, startup, shutdown handlers
├── config.ts             # Environment variable validation (no dotenv - uses process.env)
├── database.ts           # SQLite operations and schema
├── bot.ts                # Discord client initialization
├── handlers/
│   ├── messageHandler.ts # Message event handling and thread creation
│   └── threadHandler.ts  # Thread lifecycle and cleanup jobs
└── utils/
    ├── logger.ts         # Logging to Discord channel with embeds
    └── permissions.ts    # Role-based permission checking
```

### Key Design Decisions

1. **No dotenv**: Uses native `process.env` to avoid supply chain vulnerabilities
2. **Synchronous SQLite**: Uses better-sqlite3 (sync) for simpler error handling
3. **Module System**: CommonJS with `.js` extensions in imports (TypeScript requirement)
4. **Strict TypeScript**: All strict flags enabled for type safety
5. **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT signals

## Core Functionality Flow

### New Message Flow
1. User posts in managed channel
2. Check if user has exempt role → skip if true
3. Query database for active thread
4. **If no thread**: Create thread, store in DB, log event
5. **If thread exists**: Delete message, DM user, increment attempts, check for kick

### Thread Lifecycle
1. Thread created with 24-hour expiry timestamp
2. Cleanup job runs every 5 minutes
3. Expired threads are locked, archived, and marked inactive
4. Manual deletions trigger threadDelete event → deactivate in DB

### Database Schema

```sql
user_threads:
- id (INTEGER PRIMARY KEY)
- user_id (TEXT) - Discord user ID
- thread_id (TEXT) - Discord thread ID
- channel_id (TEXT) - Discord channel ID
- created_at (INTEGER) - Unix timestamp ms
- expires_at (INTEGER) - Unix timestamp ms (created_at + 24h)
- attempt_count (INTEGER) - Number of posting attempts
- is_active (INTEGER) - Boolean flag (1=active, 0=inactive)
```

## Important Patterns

### Error Handling
- All async functions wrapped in try-catch
- Errors logged to both console and Discord logging channel
- Graceful degradation (e.g., DM failures don't crash the bot)

### Logging
- Structured logging with color-coded embeds
- All major events logged to LOGGING_CHANNEL_ID
- Console fallback if Discord channel unavailable

### Database Access
- Synchronous operations (better-sqlite3)
- No ORM - direct SQL with prepared statements
- Indexes on user_id, thread_id, is_active, expires_at

## Environment Variables

**Required:**
- `DISCORD_TOKEN` - Bot authentication token
- `MANAGED_CHANNEL_ID` - Channel to manage
- `LOGGING_CHANNEL_ID` - Channel for event logs

**Optional:**
- `EXEMPT_ROLE_IDS` - Comma-separated role IDs (bypass all logic)
- `DATABASE_PATH` - SQLite file path (default: ./data/bot.db)

## Discord Configuration

### Required Intents
- Guilds
- GuildMessages
- GuildMembers (privileged)
- MessageContent (privileged)

### Required Permissions
- Read Messages/View Channels
- Send Messages
- Manage Messages (delete)
- Manage Threads
- Create Public Threads
- Kick Members
- Read Message History

## Development Guidelines

### Adding New Features

1. **New Event Handler**: Add to handlers/ directory, initialize in index.ts
2. **New Database Table**: Update database.ts schema and add CRUD functions
3. **New Logger Type**: Add to LogType enum in utils/logger.ts
4. **New Config**: Add validation in config.ts requireEnv()

### Common Modifications

**Change cooldown period:**
- Update `createThread()` in database.ts (line calculating expires_at)
- Update thread autoArchiveDuration in messageHandler.ts

**Change kick threshold:**
- Modify the `>= 10` check in messageHandler.ts handleExistingThread()
- Update DM warning thresholds in sendThreadLinkDM()

**Change cleanup frequency:**
- Modify CLEANUP_INTERVAL in handlers/threadHandler.ts

### Testing Locally

```bash
# Development with hot reload
npm run dev

# Production build
npm run build
npm start

# Docker
docker-compose up -d
docker-compose logs -f
```

## Important Notes

### Module Resolution
- All imports from local files must use `.js` extension (not `.ts`)
- This is required for TypeScript's CommonJS output
- Example: `import { config } from './config.js'`

### Database Persistence
- Database file created in `data/` directory
- Docker volume mounted for persistence across container restarts
- No migrations system - schema created on first run

### Thread Naming
- Format: `{Username}'s Support Thread`
- Uses displayName if available, falls back to username
- Thread names are NOT unique (multiple users can have same display name)

### Kick Behavior
- Users kicked after 10th attempt (not 9th)
- Attempt count incremented BEFORE checking for kick
- Kicked users can rejoin immediately (no ban applied)

### Edge Cases Handled
- DMs disabled → logged to console, continues
- Thread manually deleted → deactivated in DB via threadDelete event
- Bot missing permissions → errors logged, graceful failure
- Database locked → sync operations throw, caught by try-catch

## Troubleshooting

### Bot doesn't create threads
- Check MessageContent intent is enabled (privileged)
- Verify bot has Create Public Threads permission
- Ensure MANAGED_CHANNEL_ID is correct

### Cleanup job not running
- Check console for "Thread handler initialized" message
- Verify no errors in cleanupExpiredThreads function
- Check expires_at timestamps in database

### Database issues
- Ensure data/ directory exists and is writable
- For Docker: verify volume mount in docker-compose.yml
- Check DATABASE_PATH environment variable

## Future Enhancement Ideas

- Add commands for manual thread closure
- Support for private threads
- Configurable cooldown periods per user/role
- Thread categories or tagging
- Analytics/statistics tracking
- Web dashboard for configuration
- Multiple managed channels support

## Security Considerations

- Bot token stored in environment (never committed)
- No user input sanitization needed (Discord handles this)
- SQLite injection prevented by prepared statements
- No authentication system (relies on Discord permissions)

## Docker Build

Multi-stage build process:
1. **Builder stage**: Install all deps, compile TypeScript
2. **Production stage**: Copy dist/, install production deps only

Final image size optimized by:
- Using alpine base images
- Excluding node_modules from context (.dockerignore)
- Only installing production dependencies in final stage
