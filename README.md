# Devyntra Agent

Lightweight server agent for connecting Linux servers to Devyntra.

## Features

- WebSocket-based connection to Devyntra backend
- Remote command execution
- Automatic reconnection on disconnect
- Runs in background using screen sessions
- Minimal resource footprint

## Installation

### Quick Install (Recommended)

Run the install command generated from your Devyntra desktop app. The agent will automatically:
- Install screen if not present
- Create a detached screen session
- Run in the background
- Reconnect automatically on disconnect

```bash
# Example (use the actual command from your Devyntra app)
curl -fsSL https://raw.githubusercontent.com/sohan20051519/devyntra-agent/main/install.sh | bash -s -- --token YOUR_TOKEN --backend wss://your-backend.com --install
```

### Manual Installation

1. Clone the repository:
```bash
git clone https://github.com/sohan20051519/devyntra-agent.git
cd devyntra-agent
```

2. Install dependencies:
```bash
npm install
```

3. Run with --install flag for automatic screen setup:
```bash
node agent.js --token YOUR_TOKEN --backend wss://your-backend.com --install
```

Or run directly (without screen):
```bash
node agent.js --token YOUR_TOKEN --backend wss://your-backend.com
```

## Usage

### View Agent Logs

To attach to the running agent session:
```bash
screen -r devyntra-agent
```

To detach from the session (without stopping the agent):
Press `Ctrl+A` then `D`

### Stop Agent

```bash
screen -X -S devyntra-agent quit
```

Or attach to the session and press `Ctrl+C`

### Check if Agent is Running

```bash
screen -list | grep devyntra-agent
```

## Environment Variables

- `DEVYNTRA_AGENT_TOKEN` - Authentication token (required)
- `DEVYNTRA_BACKEND_URL` - Backend WebSocket URL (default: wss://devyntra-backend-api-production.up.railway.app)

## Command Line Arguments

- `--token` - Authentication token (required)
- `--backend` - Backend WebSocket URL (optional)
- `--install` - Install screen and run agent in detached session (recommended)

## Requirements

- Node.js >= 18
- Linux server (Ubuntu/Debian recommended)
- screen (automatically installed with --install flag)

## How It Works

1. Agent connects to Devyntra backend via WebSocket
2. Sends system information (hostname, platform, architecture)
3. Listens for commands from the backend
4. Executes commands and returns results
5. Automatically reconnects if connection is lost

## Security

- All communication is encrypted via WSS (WebSocket Secure)
- Token-based authentication
- Commands run with the permissions of the user running the agent
- Output is truncated to prevent memory issues

## License

MIT
