# Discord Support Thread Bot - Implementation Plan

## Project Overview
A Discord bot that manages a support channel by creating individual threads for users and enforcing a 24-hour cooldown period between new threads.

## Technology Stack
- Node.js 24
- TypeScript
- discord.js
- better-sqlite3 (for persistence)
- Docker (multi-stage build)

## Environment Variables
```
DISCORD_TOKEN=your_bot_token_here
MANAGED_CHANNEL_ID=channel_id_to_manage
EXEMPT_ROLE_IDS=role_id_1,role_id_2,role_id_3
LOGGING_CHANNEL_ID=channel_id_for_logs
```

## Required Bot Permissions
- Read Messages/View Channels
- Send Messages
- Manage Messages (to delete user messages)
- Manage Threads
- Create Public Threads
- Kick Members
- Read Message History

## Required Intents
- Guilds
- GuildMessages
- GuildMembers
- MessageContent

---

## Implementation Steps

### 1. Project Initialization
- [ ] Initialize npm project with `npm init`
- [ ] Install production dependencies:
  - `discord.js`
  - `better-sqlite3`
- [ ] Install dev dependencies:
  - `typescript`
  - `@types/node`
  - `@types/better-sqlite3`
  - `tsx` (for development)
- [ ] Create directory structure:
  ```
  src/
    ├── index.ts (main entry point)
    ├── config.ts (environment variable validation)
    ├── database.ts (SQLite setup and queries)
    ├── bot.ts (Discord client initialization)
    ├── handlers/
    │   ├── messageHandler.ts
    │   └── threadHandler.ts
    └── utils/
        ├── logger.ts
        └── permissions.ts
  ```
- [ ] Create `tsconfig.json` with appropriate settings
- [ ] Add scripts to `package.json`:
  - `dev`: run with tsx
  - `build`: compile TypeScript
  - `start`: run compiled code

### 2. TypeScript Configuration
- [ ] Configure `tsconfig.json`:
  - Target ES2022 or later
  - Module: NodeNext or ESNext
  - Output directory: `dist/`
  - Enable strict mode
  - Include source maps for debugging

### 3. Environment Configuration
- [ ] Create `.env.example` file with all required variables
- [ ] Create `src/config.ts`:
  - Read from `process.env`
  - Validate all required variables at startup
  - Export typed config object
  - Throw descriptive errors if variables missing

### 4. Database Setup
- [ ] Design SQLite schema in `src/database.ts`:
  ```sql
  CREATE TABLE IF NOT EXISTS user_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    attempt_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1
  )
  ```
- [ ] Create database initialization function
- [ ] Implement CRUD functions:
  - `getActiveThread(userId: string)` - Check if user has active thread
  - `createThread(userId, threadId, channelId)` - Store new thread
  - `incrementAttempts(userId)` - Increment attempt count
  - `getAttemptCount(userId)` - Get current attempt count
  - `deactivateThread(threadId)` - Mark thread as inactive when deleted
  - `getExpiredThreads()` - Find threads past 24 hours
  - `closeThread(threadId)` - Mark thread as closed
- [ ] Add database connection management
- [ ] Ensure database file location is configurable for Docker volumes

### 5. Bot Initialization
- [ ] Create `src/bot.ts`:
  - Initialize Discord Client with required intents
  - Export client instance
- [ ] Create `src/index.ts`:
  - Import config validation
  - Import database initialization
  - Import event handlers
  - Login bot
  - Handle ready event
  - Log successful connection

### 6. Logging System
- [ ] Create `src/utils/logger.ts`:
  - Function to send formatted messages to logging channel
  - Console fallback if logging channel unavailable
  - Log types: THREAD_CREATED, USER_KICKED, MESSAGE_DELETED, THREAD_EXPIRED, ERROR
  - Include timestamps and user mentions where applicable

### 7. Permission Utilities
- [ ] Create `src/utils/permissions.ts`:
  - `isExemptUser(member: GuildMember)` - Check if user has exempt role
  - Parse EXEMPT_ROLE_IDS from config
  - Handle multiple role IDs

### 8. Message Handler
- [ ] Create `src/handlers/messageHandler.ts`:
  - Listen for `messageCreate` event
  - Ignore bot messages
  - Check if message is in managed channel
  - Check if user has exempt role (skip logic if true)
  - Query database for active thread
  - **If no active thread:**
    - Create thread with username as title
    - Store in database with 24-hour expiry
    - Log thread creation
  - **If active thread exists:**
    - Delete the message
    - Increment attempt count in database
    - Try to DM user with thread link
    - If DM fails (disabled DMs), log to console
    - If attempt count >= 10:
      - Kick user from server
      - Log kick event
    - Otherwise, log message deletion

### 9. Thread Handler
- [ ] Create `src/handlers/threadHandler.ts`:
  - Listen for `threadDelete` event
  - Check if deleted thread is in database
  - If yes, deactivate it in database
  - Log thread deletion
- [ ] Implement periodic cleanup job:
  - Run every 5-10 minutes
  - Query expired threads from database
  - For each expired thread:
    - Fetch thread from Discord
    - Lock thread (set `locked: true`)
    - Archive thread (set `archived: true`)
    - Mark as closed in database
    - Log thread closure

### 10. Error Handling
- [ ] Wrap all async operations in try-catch
- [ ] Handle common Discord API errors:
  - Missing permissions
  - Unknown thread/channel/member
  - Rate limiting
- [ ] Log all errors to logging channel
- [ ] Console log errors for debugging
- [ ] Graceful degradation when possible

### 11. Graceful Shutdown
- [ ] Listen for SIGTERM and SIGINT
- [ ] Close database connection
- [ ] Destroy Discord client
- [ ] Log shutdown event

### 12. Docker Configuration
- [ ] Create `.dockerignore`:
  ```
  node_modules/
  dist/
  .git/
  .env
  *.md
  .gitignore
  src/
  tsconfig.json
  ```
- [ ] Create multi-stage `Dockerfile`:
  - **Stage 1 - Builder:**
    - FROM node:24-alpine
    - Copy package*.json
    - Install all dependencies
    - Copy src/ and tsconfig.json
    - Run build command
  - **Stage 2 - Production:**
    - FROM node:24-alpine
    - Create app directory
    - Copy package*.json
    - Install production dependencies only
    - Copy compiled dist/ from builder stage
    - Create data directory for SQLite
    - Set NODE_ENV=production
    - Expose any necessary ports (not needed for Discord bot)
    - CMD to run the bot
- [ ] Create `docker-compose.yml`:
  - Define bot service
  - Mount volume for SQLite database persistence
  - Environment variables from .env file
  - Restart policy

### 13. Documentation
- [ ] Create comprehensive `README.md`:
  - Project description
  - Features list
  - Prerequisites
  - Installation steps (local)
  - Environment variable documentation
  - Docker setup instructions
  - Required bot permissions and intents
  - How to create Discord bot and get token
  - How to get channel IDs and role IDs
  - Troubleshooting section
- [ ] Add inline code comments for complex logic
- [ ] Document database schema

### 14. Additional Files
- [ ] Create `.gitignore`:
  - node_modules/
  - dist/
  - .env
  - *.db
  - *.db-journal
- [ ] Create `.env.example` with placeholders

### 15. Testing & Validation
- [ ] Test bot locally with tsx
- [ ] Test all scenarios:
  - First message creates thread
  - Subsequent messages get deleted and DM sent
  - 10th attempt kicks user
  - Exempt roles bypass all logic
  - Thread expiry after 24 hours
  - Thread manual deletion
  - DMs disabled scenario
  - Missing permissions handling
- [ ] Build Docker image
- [ ] Test Docker container
- [ ] Verify database persistence across container restarts

---

## File Structure (Final)
```
Supportrr/
├── .dockerignore
├── .env
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
├── plan.md
├── data/
│   └── bot.db (created at runtime)
├── src/
│   ├── index.ts
│   ├── config.ts
│   ├── database.ts
│   ├── bot.ts
│   ├── handlers/
│   │   ├── messageHandler.ts
│   │   └── threadHandler.ts
│   └── utils/
│       ├── logger.ts
│       └── permissions.ts
└── dist/ (generated by build)
```

---

## Development Workflow
1. Create and configure `.env` file
2. Run `npm install`
3. Run `npm run dev` for development with hot reload
4. Make changes and test
5. Run `npm run build` to compile
6. Run `npm start` to test production build
7. Build Docker image and test containerized version

## Notes
- Database file will be stored in `data/bot.db`
- Use volumes in Docker to persist database
- Logging channel must be accessible by the bot
- Bot must have all required permissions in the guild
- Ensure bot's role is high enough to kick members
