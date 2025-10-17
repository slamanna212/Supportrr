# Discord Support Thread Bot

A Discord bot that automatically manages support channels by creating individual threads for users and enforcing a 24-hour cooldown period between new threads.

## Features

- **Automatic Thread Creation**: When a user posts in the managed channel, a dedicated thread is created for them
- **24-Hour Cooldown**: Users can only create one thread per 24 hours
- **Message Deletion & DM Notification**: If a user tries to post again, their message is deleted and they receive a DM with a link to their active thread
- **Kick Protection**: Users who attempt to post 10 times are automatically kicked from the server
- **Role Exemptions**: Certain roles (e.g., moderators) can be exempt from thread management
- **Thread Expiry**: Threads are automatically locked and archived after 24 hours
- **Comprehensive Logging**: All bot actions are logged to a designated channel
- **Persistent Storage**: SQLite database ensures state is maintained across restarts

## Prerequisites

- Node.js 24 or higher
- npm or yarn
- Docker (optional, for containerized deployment)
- A Discord bot token and proper permissions

## Required Bot Permissions

The bot requires the following Discord permissions:

- **Read Messages/View Channels**
- **Send Messages**
- **Manage Messages** (to delete user messages)
- **Manage Threads**
- **Create Public Threads**
- **Kick Members**
- **Read Message History**

## Required Intents

Enable these intents in the Discord Developer Portal:

- **Guilds**
- **Guild Messages**
- **Guild Members** (Privileged)
- **Message Content** (Privileged)

## Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/discord-support-bot.git
   cd discord-support-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and fill in your values:
   ```env
   DISCORD_TOKEN=your_bot_token_here
   MANAGED_CHANNEL_ID=1234567890123456789
   EXEMPT_ROLE_IDS=role_id_1,role_id_2
   LOGGING_CHANNEL_ID=1234567890123456789
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   npm start
   ```

### Docker Deployment

1. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

2. **Build and run with Docker Compose**
   ```bash
   docker-compose up -d
   ```

3. **View logs**
   ```bash
   docker-compose logs -f
   ```

4. **Stop the bot**
   ```bash
   docker-compose down
   ```

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_TOKEN` | Yes | Your Discord bot token from the Developer Portal |
| `MANAGED_CHANNEL_ID` | Yes | The channel ID where the bot manages support threads |
| `EXEMPT_ROLE_IDS` | No | Comma-separated role IDs that bypass thread management |
| `LOGGING_CHANNEL_ID` | Yes | Channel ID where the bot logs all events |
| `DATABASE_PATH` | No | Path to SQLite database (default: `./data/bot.db`) |

### Getting Discord IDs

1. **Enable Developer Mode** in Discord:
   - User Settings → Advanced → Developer Mode

2. **Get Channel IDs**:
   - Right-click any channel → Copy ID

3. **Get Role IDs**:
   - Server Settings → Roles → Right-click role → Copy ID

4. **Get Bot Token**:
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application or select existing
   - Go to "Bot" section
   - Click "Reset Token" to get your bot token

## How It Works

### First Message
1. User posts a message in the managed channel
2. Bot creates a thread with the user's name
3. Thread is stored in the database with a 24-hour expiry
4. Event is logged to the logging channel

### Subsequent Messages (within 24 hours)
1. User tries to post another message
2. Bot deletes the message immediately
3. User receives a DM with a link to their active thread
4. Attempt count is incremented
5. Event is logged

### Excessive Attempts
1. If user reaches 10 attempts, they are kicked from the server
2. Kick event is logged

### Thread Expiry
1. After 24 hours, the cleanup job runs
2. Expired threads are locked and archived
3. Thread is marked as closed in the database
4. User can now create a new thread

### Exempt Users
- Users with exempt roles bypass all thread management
- They can post freely in the managed channel

## Project Structure

```
Supportrr/
├── src/
│   ├── index.ts              # Main entry point
│   ├── config.ts             # Environment configuration
│   ├── database.ts           # SQLite database operations
│   ├── bot.ts                # Discord client initialization
│   ├── handlers/
│   │   ├── messageHandler.ts # Message event handling
│   │   └── threadHandler.ts  # Thread lifecycle management
│   └── utils/
│       ├── logger.ts         # Logging utilities
│       └── permissions.ts    # Permission checking
├── data/                     # SQLite database storage
├── dist/                     # Compiled JavaScript (generated)
├── Dockerfile                # Multi-stage Docker build
├── docker-compose.yml        # Docker Compose configuration
├── package.json              # Node.js dependencies
├── tsconfig.json             # TypeScript configuration
└── .env                      # Environment variables (not in git)
```

## Development

### Scripts

- `npm run dev` - Run in development mode with hot reload (using tsx)
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run the compiled production build

### Database Schema

The bot uses SQLite with the following schema:

```sql
CREATE TABLE user_threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1
);
```

## Troubleshooting

### Bot doesn't respond to messages
- Verify `MANAGED_CHANNEL_ID` is correct
- Ensure bot has proper permissions in the channel
- Check that Message Content intent is enabled

### DMs not being sent
- This is normal if users have DMs disabled
- The bot logs this to console and continues

### Database errors
- Ensure the `data/` directory exists and is writable
- For Docker, verify the volume is mounted correctly

### Bot crashes on startup
- Verify all required environment variables are set
- Check the console logs for specific errors
- Ensure bot token is valid

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC

## Support

For issues and questions, please open an issue on GitHub