import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
for (const file of readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort()) {
  const r = spawnSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      'DB',
      '--local',
      '--config',
      'wrangler.local.json',
      '--file',
      `drizzle/${file}`,
    ],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: 'false',
        WRANGLER_LOG_PATH: '.wrangler/logs',
        MINIFLARE_REGISTRY_PATH: '.wrangler/registry',
      },
    },
  );
  if (r.status) process.exit(r.status);
}
