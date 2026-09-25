import { cp, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
const root = resolve(import.meta.dirname, '..');
const source = join(root, 'supabase/migrations');
const args = process.argv.slice(2);
const targetFlag = args.find((arg) => ['--local', '--db-url'].includes(arg.split('=')[0]));
if (!targetFlag || args.includes('--linked')) {
  console.error(
    `Usage: pnpm migrate:ordered --local | --db-url <URL> (project ${process.env.SUPABASE_PROJECT_REF ?? 'ehoemilzosbzdygqyvzd'})`,
  );
  process.exit(2);
}
const targetProject = 'ehoemilzosbzdygqyvzd';
let drizzleEnv = process.env;
if (targetFlag === '--local') {
  const config = await readFile(join(root, 'supabase/config.toml'), 'utf8');
  const dbSection = config.match(/\[db\]([\s\S]*?)(?=\n\[|$)/)?.[1] ?? '';
  const configuredPort = dbSection.match(/^port\s*=\s*(\d+)\s*$/m)?.[1];
  const port = process.env.SUPABASE_DB_PORT ?? configuredPort;
  if (!port) throw new Error('Could not determine local Supabase database port.');
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('SUPABASE_DB_PORT must be a valid TCP port.');
  }
  const localUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
  drizzleEnv = { ...process.env, DATABASE_URL: localUrl, DIRECT_URL: localUrl };
} else {
  const dbUrlArg =
    args.find((arg) => arg.startsWith('--db-url='))?.slice('--db-url='.length) ??
    args[args.indexOf('--db-url') + 1];
  let database;
  try {
    database = new URL(dbUrlArg);
  } catch {
    throw new Error('A valid --db-url connection URL is required.');
  }
  const isPooler =
    database.hostname === 'aws-0-ap-southeast-2.pooler.supabase.com' &&
    database.username.endsWith(`.${targetProject}`);
  const isDirect = database.hostname === `db.${targetProject}.supabase.co`;
  if (!isPooler && !isDirect) {
    throw new Error(
      `Refusing remote migration: URL does not target Supabase project ${targetProject}.`,
    );
  }
  drizzleEnv = { ...process.env, DATABASE_URL: dbUrlArg, DIRECT_URL: dbUrlArg };
}
const run = (cmd, argv, label) =>
  new Promise((res, rej) => {
    console.log(`[migrate] ${label}`);
    const child = spawn(cmd, argv, {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      env: cmd === 'pnpm' ? drizzleEnv : process.env,
    });
    child.once('error', rej);
    child.once('exit', (code) =>
      code === 0 ? res() : rej(new Error(`${label} failed (exit ${code})`)),
    );
  });
const files = (await readdir(source)).filter((f) => f.endsWith('.sql')).sort();
const first = files.filter((f) => /^20260101000[0-4]00_/.test(f));
const last = files.filter((f) => /^20260101000[5-7]00_/.test(f));
if (files.length !== 8 || first.length !== 5 || last.length !== 3)
  throw new Error('Unexpected Supabase migration set; expected 000000-00700.');
const workspace = await mkdtemp(join(tmpdir(), 'snapbox-migrations-'));
const phase = join(workspace, 'supabase/migrations');
try {
  await cp(join(root, 'supabase/config.toml'), join(workspace, 'supabase/config.toml'));
  await cp(source, phase, { recursive: true });
  await Promise.all(last.map((f) => rm(join(phase, f))));
  await run(
    'supabase',
    ['db', 'push', '--workdir', workspace, '--include-all', '--yes', ...args],
    'Supabase 000000-00400',
  );
  await run('pnpm', ['--filter', '@snapbox/db', 'migrate'], 'Drizzle 0000-0004');
  await cp(source, phase, { recursive: true });
  await run(
    'supabase',
    ['db', 'push', '--workdir', workspace, '--include-all', '--yes', ...args],
    'Supabase 00500-00700',
  );
} catch (error) {
  console.error(`[migrate] ${error.message}`);
  process.exitCode = 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
