const WebSocket = require('ws');
const { spawn } = require('child_process');
const os = require('os');

const TOKEN = process.env.DEVYNTRA_AGENT_TOKEN || process.argv.find((a, i, arr) => arr[i - 1] === '--token' && a);
const BACKEND_URL = process.env.DEVYNTRA_BACKEND_URL || process.argv.find((a, i, arr) => arr[i - 1] === '--backend' && a) || 'wss://devyntra-backend-api-production.up.railway.app';

if (!TOKEN) {
  console.error('Missing DEVYNTRA_AGENT_TOKEN');
  process.exit(1);
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
