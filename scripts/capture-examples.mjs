#!/usr/bin/env node
/*
  Produce src/generated/examples.json by invoking the compiler over
  src/examples/manifest.mjs. Guarantees, per example:

    - the shown program COMPILES (`hale check`);
    - the break-it variant FAILS `hale check`, and the diagnostic on
      the page is the compiler's actual stderr (paths scrubbed to the
      display filename);
    - `run: true` programs execute and their stdout is captured;
    - `session` examples (record → replay) run end to end when the
      compiler supports `hale replay`; otherwise the manifest's
      `pinned` capture is used, carrying its provenance label.

  This is the same posture as check-site.mjs: the site never asserts
  something about the compiler that the build didn't make the
  compiler demonstrate.

  Usage: node scripts/capture-examples.mjs [--hale <bin>]
*/
import { writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { examples } from '../src/examples/manifest.mjs';

const run = promisify(execFile);
const argv = process.argv.slice(2);
const flagIx = argv.indexOf('--hale');
const HALE = flagIx >= 0 ? argv[flagIx + 1] : 'hale';

const fail = (msg) => {
  console.error(`capture-examples: ${msg}`);
  process.exit(1);
};

const hale = async (args, opts = {}) => {
  try {
    const r = await run(HALE, args, { timeout: 60_000, ...opts });
    return { ok: true, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
  } catch (e) {
    return { ok: false, stdout: e.stdout ?? '', stderr: e.stderr ?? '' };
  }
};

// Scrub machine paths so diagnostics read `workers.hl:3:1`, and drop
// blank tail lines.
const scrub = (text, dir, file, shown) =>
  text
    .replaceAll(join(dir, file), shown)
    .replaceAll(dir + '/', '')
    .replaceAll(dir, '')
    .split('\n')
    .filter(
      (l) =>
        // The env-redaction notice is policy boilerplate, not part of
        // any example's story; every other line stays verbatim.
        !l.includes('withholds env VALUES'),
    )
    .join('\n')
    .trim();

const applyBreak = (program, brk) => {
  if (!program.includes(brk.find)) fail(`break.find not in program`);
  let out = program.replace(brk.find, brk.replace);
  if (brk.extraFind) {
    if (!out.includes(brk.extraFind)) fail(`break.extraFind not in program`);
    out = out.replace(brk.extraFind, brk.extraReplace);
  }
  return out;
};

const dir = await mkdtemp(join(tmpdir(), 'hale-site-examples-'));
const out = { hale: '', examples: {} };
{
  const v = await hale(['--version']);
  out.hale = (v.stdout || v.stderr).trim();
}
const replayProbe = await hale(['replay']);
const hasReplay = !(replayProbe.stderr + replayProbe.stdout).includes(
  'unknown command',
);

for (const ex of examples) {
  const file = join(dir, ex.file);
  await writeFile(file, ex.program + '\n');
  const entry = {};

  const check = await hale(['check', file]);
  if (!check.ok) {
    fail(`${ex.id}: program does not typecheck:\n${check.stderr}`);
  }

  if (ex.run) {
    const r = await hale(['run', file]);
    if (!r.ok) fail(`${ex.id}: program failed to run:\n${r.stderr}`);
    entry.run = { output: scrub(r.stdout, dir, ex.file, ex.file) };
  }

  if (ex.brk) {
    const bad = join(dir, 'broken-' + ex.file);
    await writeFile(bad, applyBreak(ex.program, ex.brk) + '\n');
    const r = await hale(['check', bad]);
    if (r.ok) fail(`${ex.id}: the broken variant still typechecks`);
    entry.brk = {
      output: scrub(r.stderr || r.stdout, dir, 'broken-' + ex.file, ex.file),
      source: 'live',
    };
  }

  if (ex.session) {
    if (hasReplay) {
      const rec = join(dir, ex.id + '.halerec');
      const recRun = await hale(['run', file], {
        env: { ...process.env, LOTUS_OBS_RECORD: rec },
      });
      if (!recRun.ok) fail(`${ex.id}: recorded run failed:\n${recRun.stderr}`);
      const rp = await hale([
        'replay',
        rec,
        file,
        '--allow-live-effects',
        '--diff',
      ]);
      if (!rp.ok) fail(`${ex.id}: replay diverged:\n${rp.stderr}`);
      entry.session = {
        output: scrub(rp.stderr + rp.stdout, dir, ex.file, ex.file),
        source: 'live',
      };
    } else if (ex.pinned?.session) {
      entry.session = {
        output: ex.pinned.session,
        source: 'pinned',
        label: ex.pinned.label,
      };
      console.error(
        `capture-examples: ${ex.id}: compiler lacks \`hale replay\`; ` +
          `using pinned capture (${ex.pinned.label})`,
      );
    } else {
      fail(`${ex.id}: no replay support and no pinned capture`);
    }
  }

  out.examples[ex.id] = entry;
}

await rm(dir, { recursive: true, force: true });
await mkdir('src/generated', { recursive: true });
await writeFile(
  'src/generated/examples.json',
  JSON.stringify(out, null, 2) + '\n',
);
console.log(
  `capture-examples: ${examples.length} examples captured against ${out.hale}`,
);
