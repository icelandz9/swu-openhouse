import { execSync } from 'node:child_process';

export function freePort(targetPort = 3000, silent = false) {
  try {
    if (process.platform === 'win32') {
      // Find PID on Windows
      const out = execSync(`netstat -ano -p tcp`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const lines = out.split('\n');
      const pids = new Set();
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[0].toUpperCase() === 'TCP') {
          const localAddr = parts[1];
          const state = parts[3];
          const pid = parts[4];
          if ((localAddr.endsWith(`:${targetPort}`) || localAddr === `[::]:${targetPort}`) && state === 'LISTENING') {
            const numPid = parseInt(pid, 10);
            if (numPid && numPid !== process.pid) {
              pids.add(numPid);
            }
          }
        }
      }

      if (pids.size > 0) {
        for (const pid of pids) {
          try {
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            if (!silent) console.log(`[kill-port] Cleared stale process PID ${pid} on port ${targetPort}`);
          } catch {}
        }
        return true;
      }
    } else {
      // macOS / Linux
      const pid = execSync(`lsof -ti tcp:${targetPort}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (pid) {
        execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        if (!silent) console.log(`[kill-port] Cleared process PID ${pid} on port ${targetPort}`);
        return true;
      }
    }
  } catch (err) {
    // Port was free or command failed silently
  }
  return false;
}

// Direct execution from CLI
if (process.argv[1]?.endsWith('kill-port.mjs')) {
  const argPort = process.argv[2] ? parseInt(process.argv[2], 10) : 3000;
  if (isNaN(argPort)) {
    console.error('[kill-port] Invalid port number');
    process.exit(1);
  }
  const killed = freePort(argPort);
  if (!killed) {
    console.log(`[kill-port] Port ${argPort} is already free.`);
  }
}
