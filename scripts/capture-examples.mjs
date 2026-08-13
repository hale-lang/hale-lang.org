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
import { readdir } from 'node:fs/promises';
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

/*
  Full (literate) examples: each src/examples/full/<slug>.mjs is a
  sectioned page whose code fields concatenate to one program. The
  contract here is stricter than the panels': the assembled program
  must check AND run; every section break must FAIL check; the
  session (record → replay) runs live when the compiler supports
  it. A page section that drifts from the working program fails the
  build — that is the entire reason the page can afford to be big.
*/
out.fulls = {};
const fullDir = new URL('../src/examples/full/', import.meta.url);
for (const f of (await readdir(fullDir)).filter((f) => f.endsWith('.mjs'))) {
  const { full } = await import(new URL(f, fullDir));
  // Group section code by file (single-file examples leave
  // section.file unset and inherit full.file).
  const byFile = new Map();
  for (const sec of full.sections) {
    if (!sec.code) continue;
    const fname = sec.file ?? full.file;
    byFile.set(fname, [...(byFile.get(fname) ?? []), sec.code]);
  }
  const programs = new Map(
    [...byFile].map(([k, v]) => [k, v.join('\n\n')]),
  );
  for (const [fname, prog] of programs) {
    await writeFile(join(dir, fname), prog + '\n');
    if (!fname.endsWith('.hl')) continue;
    const check = await hale(['check', join(dir, fname)]);
    if (!check.ok) {
      fail(`${full.slug}/${fname}: does not typecheck:\n${check.stderr}`);
    }
  }
  const program = programs.get(full.file);
  const file = join(dir, full.file);
  const entry = { sections: {} };
  for (const sec of full.sections) {
    const se = {};
    if (sec.brk) {
      const bad = join(dir, 'broken-' + full.file);
      await writeFile(bad, applyBreak(program, sec.brk) + '\n');
      const r = await hale(['check', bad]);
      if (r.ok) fail(`${full.slug}/${sec.id}: broken variant still typechecks`);
      se.brk = {
        output: scrub(r.stderr || r.stdout, dir, 'broken-' + full.file, full.file),
      };
    }
    for (const cap of sec.captures ?? []) {
      if (cap.kind === 'run') {
        const outs = [];
        for (let i = 0; i < (cap.runs ?? 1); i++) {
          const r = await hale(['run', file]);
          if (!r.ok) fail(`${full.slug}: run failed:\n${r.stderr}`);
          outs.push(scrub(r.stdout, dir, full.file, full.file));
        }
        se.run = { outputs: outs };
      } else if (cap.kind === 'session') {
        if (hasReplay) {
          const rec = join(dir, full.slug + '.halerec');
          const recRun = await hale(['run', file], {
            env: { ...process.env, LOTUS_OBS_RECORD: rec },
          });
          if (!recRun.ok) fail(`${full.slug}: recorded run failed:\n${recRun.stderr}`);
          const rp = await hale(['replay', rec, file, '--allow-live-effects', '--diff']);
          if (!rp.ok) fail(`${full.slug}: replay diverged:\n${rp.stderr}`);
          se.session = {
            output: scrub(rp.stderr + rp.stdout, dir, full.file, full.file),
            source: 'live',
          };
        } else if (cap.pinned) {
          se.session = {
            output: cap.pinned.output,
            source: 'pinned',
            label: cap.pinned.label,
          };
          console.error(
            `capture-examples: ${full.slug}: no \`hale replay\`; pinned (${cap.pinned.label})`,
          );
        } else {
          fail(`${full.slug}/${sec.id}: no replay support and no pinned capture`);
        }
      } else if (cap.kind === 'fleet' || cap.kind === 'fleet-break') {
        // Compose the fleet: dump a topology artifact per binary
        // (breaking one binary first for fleet-break), then run
        // `hale fleet check` against the plan. The break must FAIL.
        const broken = cap.kind === 'fleet-break';
        for (const [fname, prog] of programs) {
          if (!fname.endsWith('.hl')) continue;
          let src = prog;
          if (broken && fname === cap.file) {
            src = applyBreak(prog, cap);
          }
          const p = join(dir, fname);
          await writeFile(p, src + '\n');
          const art = p.replace(/\.hl$/, '.topology.json');
          const c = await hale(['check', p, `--dump-topology=${art}`]);
          if (!c.ok) fail(`${full.slug}: topology dump failed:\n${c.stderr}`);
        }
        const planName = [...programs.keys()].find((k) =>
          k.endsWith('.json'),
        );
        const planPath = join(dir, planName);
        const planBody = programs
          .get(planName)
          .replaceAll(/"artifact":\s*"([^"]+)\.hl"/g, '"artifact": "$1"');
        await writeFile(planPath, planBody + '\n');
        const r = await hale(['fleet', 'check', planPath]);
        if (broken === r.ok) {
          fail(
            `${full.slug}/${sec.id}: fleet check ${broken ? 'passed on the broken build' : 'failed'}:\n${r.stderr || r.stdout}`,
          );
        }
        se[broken ? 'fleetBreak' : 'fleet'] = {
          output: scrub(
            (r.stdout + r.stderr).trim(),
            dir,
            planName,
            planName,
          ),
        };
        if (broken) {
          // restore the honest sources for later captures
          for (const [fname, prog] of programs) {
            await writeFile(join(dir, fname), prog + '\n');
          }
        }
      }
    }
    if (Object.keys(se).length) entry.sections[sec.id] = se;
  }
  entry.lines = program.split('\n').length;
  out.fulls[full.slug] = entry;
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
