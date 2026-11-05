import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export function findCloudflared(root) {
  const candidates = [
    process.env.WILDSCAN_CLOUDFLARED,
    path.join(root, 'bin', process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared')
  ].filter(Boolean);
  const local = candidates.find((p) => fs.existsSync(p));
  return local || 'cloudflared';
}

export function startTunnel({ binary, port, onUrl, onExit }) {
  let child;
  try {
    child = spawn(binary, ['tunnel', '--no-autoupdate', '--url', `http://localhost:${port}`], { windowsHide: true });
  } catch (err) {
    onExit?.(err);
    return null;
  }
  const scan = (chunk) => {
    const match = String(chunk).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match) onUrl(match[0]);
  };
  child.stdout.on('data', scan);
  child.stderr.on('data', scan);
  child.on('error', (err) => onExit?.(err));
  child.on('exit', (code) => onExit?.(new Error(`cloudflared exited (${code})`)));
  process.once('exit', () => child.kill());
  return child;
}
