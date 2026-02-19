const WebSocket = require('ws');
const { spawn, execSync } = require('child_process');
const os = require('os');

const TOKEN = process.env.DEVYNTRA_AGENT_TOKEN || process.argv.find((a, i, arr) => arr[i - 1] === '--token' && a);
const BACKEND_URL = process.env.DEVYNTRA_BACKEND_URL || process.argv.find((a, i, arr) => arr[i - 1] === '--backend' && a) || 'wss://devyntra-backend-api-production.up.railway.app';
const INSTALL_MODE = process.argv.includes('--install');

if (!TOKEN) {
  console.error('Missing DEVYNTRA_AGENT_TOKEN');
  process.exit(1);
}

// Handle installation mode - setup screen session and run agent
if (INSTALL_MODE) {
  try {
    console.log('Installing Devyntra Agent...');
    
    // Check if screen is installed
    try {
      execSync('which screen', { stdio: 'ignore' });
    } catch (e) {
      console.log('Installing screen...');
      execSync('sudo apt-get update && sudo apt-get install -y screen', { stdio: 'inherit' });
    }
    
    // Get the current script path
    const scriptPath = process.argv[1];
    const nodeCmd = process.execPath;
    
    // Build the command to run in screen
    const agentCmd = `${nodeCmd} ${scriptPath} --token ${TOKEN} --backend ${BACKEND_URL}`;
    
    // Check if session already exists
    try {
      execSync('screen -list | grep devyntra-agent', { stdio: 'ignore' });
      console.log('Devyntra agent session already running. Use "screen -r devyntra-agent" to attach.');
      process.exit(0);
    } catch (e) {
      // Session doesn't exist, create it
      console.log('Starting agent in detached screen session...');
      execSync(`screen -dmS devyntra-agent ${agentCmd}`);
      console.log('✓ Agent started successfully in screen session "devyntra-agent"');
      console.log('  To view agent logs: screen -r devyntra-agent');
      console.log('  To detach from session: Press Ctrl+A then D');
      process.exit(0);
    }
  } catch (error) {
    console.error('Installation failed:', error.message);
    process.exit(1);
  }
}

const WS_URL = `${BACKEND_URL.replace(/^http/, 'ws')}/agent/connect?token=${TOKEN}`;

let ws = null;
let reconnectTimer = null;
const RECONNECT_DELAY = 5000;

function connect() {
  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('Connected to Devyntra backend');
    ws.send(JSON.stringify({
      type: 'hello',
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      uptime: os.uptime()
    }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data);
      handleMessage(msg);
    } catch (e) {
      console.error('Invalid message:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('Disconnected, reconnecting...');
    scheduleReconnect();
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
    ws.close();
  });
}

function handleMessage(msg) {
  if (msg.type === 'exec' && msg.command) {
    execCommand(msg.id, msg.command);
  } else if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
  }
}

function execCommand(id, command) {
  const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
  const args = process.platform === 'win32' ? ['/c', command] : ['-c', command];

  const child = spawn(shell, args, {
    env: { ...process.env, FORCE_COLOR: '0', TERM: 'dumb' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => stdout += d.toString());
  child.stderr.on('data', (d) => stderr += d.toString());

  child.on('close', (code) => {
    ws.send(JSON.stringify({
      type: 'exec_result',
      id,
      stdout: stdout.slice(0, 50000),
      stderr: stderr.slice(0, 50000),
      code: code ?? 0
    }));
  });

  child.on('error', (err) => {
    ws.send(JSON.stringify({
      type: 'exec_result',
      id,
      stdout: '',
      stderr: err.message,
      code: 1
    }));
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY);
}

console.log('Devyntra Agent starting...');
connect();

process.on('SIGINT', () => {
  console.log('Shutting down...');
  ws?.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  ws?.close();
  process.exit(0);
});
