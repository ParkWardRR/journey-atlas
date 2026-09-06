// Make sure a dev server is serving the map before we screenshot it. If the URL
// is already reachable (someone ran `npm run dev`), we reuse it and leave it
// running. Otherwise we spawn Vite ourselves and shut it down when done — so
// `npm run render` works from a clean checkout with no second terminal.

import { spawn } from 'node:child_process';

async function reachable(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

async function waitFor(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await reachable(url)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Resolve a server at `url`, starting Vite if needed.
// Returns { url, stop() }. stop() is a no-op when we reused an existing server.
export async function ensureServer(url, { timeoutMs = 60000 } = {}) {
  if (await reachable(url)) {
    console.log(`• reusing server at ${url}`);
    return { url, stop: async () => {} };
  }

  console.log('• no server up — starting `vite dev`…');
  const port = new URL(url).port || '5173';
  const child = spawn('npx', ['vite', 'dev', '--port', port, '--strictPort'], {
    stdio: ['ignore', 'ignore', 'inherit'],
    detached: false,
  });

  const ok = await waitFor(url, timeoutMs);
  if (!ok) {
    child.kill('SIGTERM');
    throw new Error(`vite dev did not become reachable at ${url} within ${timeoutMs}ms`);
  }
  console.log(`• server ready at ${url}`);

  return {
    url,
    stop: async () => {
      child.kill('SIGTERM');
      await new Promise((r) => setTimeout(r, 300));
      if (!child.killed) child.kill('SIGKILL');
    },
  };
}
