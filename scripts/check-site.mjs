#!/usr/bin/env node
/*
  Fail the storefront build when the site's description of the system
  becomes false.

  This exists because the homepage shipped a fleet plan that routed a topic
  to a `gw-0` the plan never declared — an artifact `hale fleet check`
  rejects, on a page whose whole argument is that a compiler should catch
  exactly that. Nothing checked it, because the deploy workflow only ever
  ran `astro build`. The site was making claims about a compiler it never
  invoked.

  What it checks:

    1. every Hale snippet compiles      — `hale check`
    2. every fleet plan is coherent     — referential integrity + `hale fleet check`
    3. every internal link resolves     — including #anchors
    4. the package catalogue is complete — diffed against the pond tree
    5. "lotus" is not used for the language — only the runtime substrate
    6. evidence words carry a scope     — "model-checked", "proves", "certifies"

  Usage: node scripts/check-site.mjs [--hale <bin>] [--pond <dir>] [--skip-hale]

  Exit 0 clean, 1 with findings. Findings print as `file: message` so they
  read like the compiler diagnostics the rest of the site is about.
*/
import { readFile, readdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, extname, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const run = promisify(execFile);

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const HALE = flag('--hale', process.env.HALE_BIN || 'hale');
const POND = flag('--pond', join(process.env.HOME || '', 'code/hale-lang/pond'));
const SKIP_HALE = argv.includes('--skip-hale');
const DIST = 'dist';

const findings = [];
const fail = (where, msg) => findings.push(`${where}: ${msg}`);
const notes = [];
const note = (msg) => notes.push(msg);

async function walk(dir, pred = () => true) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p, pred)));
    else if (pred(p)) out.push(p);
  }
  return out;
}

/* ------------------------------------------------------------------
   Snippet extraction

   Two shapes carry code on this site, and both are template literals:
     const NAME = `…`;              rendered as <Hale code={NAME} title="…" />
     { title: '…', code: `…` }      the Unfold panels array

   Scanning for the closing backtick by hand rather than by regex, because
   several snippets contain an escaped one (proof.astro's witness quotes a
   claim name in backticks).
------------------------------------------------------------------ */
function readTemplate(src, openIdx) {
  let i = openIdx + 1, out = '';
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      const n = src[i + 1];
      // Only these are meaningful inside the literals we care about.
      out += n === '`' ? '`' : n === '$' ? '$' : n === '\\' ? '\\' : '\\' + n;
      i += 2;
      continue;
    }
    if (c === '`') return { text: out, end: i };
    out += c;
    i++;
  }
  return null;
}

function extractSnippets(src, file) {
  const found = [];

  // A file-level `const _prelude = `…`` applies to every snippet in the
  // file — for pages where the panels are variations on one system and
  // would otherwise repeat the same offstage declarations five times.
  let filePrelude = '';
  const fp = /\bconst\s+_prelude\s*=\s*`/.exec(src);
  if (fp) {
    const t = readTemplate(src, fp.index + fp[0].length - 1);
    if (t) filePrelude = t.text;
  }

  // { title: 'x.hl', code: `…` }, optionally with a `prelude:` between the
  // two — declarations the panel does not show but the snippet needs to
  // typecheck for real. See Unfold.astro's claims panel.
  const panel = /\{\s*title:\s*['"]([^'"]+)['"]\s*,\s*(?:prelude:\s*`)?/g;
  for (let m; (m = panel.exec(src)); ) {
    let prelude = '';
    let cursor = panel.lastIndex;
    if (m[0].includes('prelude')) {
      const p = readTemplate(src, cursor - 1);
      if (!p) continue;
      prelude = p.text;
      cursor = p.end + 1;
    }
    const codeAt = src.indexOf('`', src.indexOf('code:', cursor));
    if (codeAt < 0) continue;
    const t = readTemplate(src, codeAt);
    if (t) found.push({ file, title: m[1], code: t.text, prelude: filePrelude + prelude });
    panel.lastIndex = t ? t.end : cursor;
  }

  // const NAME = `…`;  → title comes from the <Hale …> that renders it.
  //
  // Deliberately two steps: find the whole <Hale …> tag first, then read
  // its title. A single pattern with an optional title group and a lazy
  // run in front of it matches the EMPTY title every time, which silently
  // defaulted almost every snippet on the site to the name "hale" — and
  // "hale …" is the rule below for "this panel is compiler output, don't
  // re-check it". The gate reported itself clean while checking a
  // quarter of the snippets.
  const decl = /\bconst\s+(\w+)\s*=\s*`/g;
  for (let m; (m = decl.exec(src)); ) {
    const t = readTemplate(src, decl.lastIndex - 1);
    if (!t) continue;
    const name = m[1];
    const tag = new RegExp(`<Hale\\b[^>]*\\bcode=\\{${name}\\}[^>]*>`).exec(src);
    // No <Hale> renders it → not a code panel (page copy, a class list, …).
    if (!tag) continue;
    const title = /\btitle=["']([^"']+)["']/.exec(tag[0]);
    if (!title) {
      fail(`${file} (${name})`, 'rendered by <Hale> with no title — the gate uses the title to tell source from compiler output, so give it one');
      continue;
    }
    // A panel that shows an excerpt declares its offstage context as
    // `const NAME_prelude` — prepended before checking, never rendered.
    // Same idea as the `prelude:` field on the Unfold panels.
    let prelude = '';
    const pre = new RegExp(`\\bconst\\s+${name}_prelude\\s*=\\s*\``).exec(src);
    if (pre) {
      const pt = readTemplate(src, pre.index + pre[0].length - 1);
      if (pt) prelude = pt.text;
    }
    found.push({ file, title: title[1], code: t.text, prelude: filePrelude + prelude });
  }
  return found;
}

/* Output samples, not input: these panels show what the compiler PRINTS.
   Feeding a diagnostic back to the compiler proves nothing. Every skip is
   reported, so this can never quietly become "we checked nothing". */
const isCompilerOutput = (title) => /^hale\b/.test(title) || title === 'toolchain';

async function checkSnippets() {
  const files = await walk('src', (p) => p.endsWith('.astro'));
  const snippets = [];
  for (const f of files) snippets.push(...extractSnippets(await readFile(f, 'utf8'), f));

  const source = snippets.filter((s) => !isCompilerOutput(s.title) && extname(s.title) !== '.json');
  const plans = snippets.filter((s) => extname(s.title) === '.json');
  const skipped = snippets.filter((s) => isCompilerOutput(s.title));

  note(`snippets: ${source.length} Hale, ${plans.length} fleet plan(s), ` +
       `${skipped.length} compiler-output panel(s) not re-checked ` +
       `(${[...new Set(skipped.map((s) => s.title))].join(', ') || 'none'})`);

  // ---- 1. every Hale snippet compiles ----
  if (SKIP_HALE) {
    note('hale check: SKIPPED (--skip-hale) — snippets were not compiled');
  } else {
    const dir = await mkdtemp(join(tmpdir(), 'hale-site-'));
    try {
      for (const [n, s] of source.entries()) {
        const base = `${n}-${s.title.replace(/[^\w.-]/g, '_')}`;
        const target = join(dir, base.endsWith('.hl') ? base : base + '.hl');
        await writeFile(target, (s.prelude || '') + s.code.trim() + '\n');
        try {
          await run(HALE, ['check', target]);
        } catch (e) {
          const out = `${e.stdout || ''}${e.stderr || ''}`.trim();
          fail(`${s.file} (${s.title})`, `hale check rejected this snippet:\n${out}`);
        }
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  // ---- 2. every fleet plan is coherent ----
  for (const s of plans) {
    let plan;
    try {
      plan = JSON.parse(s.code);
    } catch (e) {
      fail(`${s.file} (${s.title})`, `not valid JSON: ${e.message}`);
      continue;
    }
    /*
      Referential integrity, checked here rather than by shelling out:
      `hale fleet check` composes real topology ARTIFACTS, and the page's
      plan references artifacts/*.json that only exist in a deployment.
      Standing those up to check a five-line illustration is
      disproportionate — but this is the exact defect that shipped, and
      the compiler's own rule for it is one line (fleet.rs: "names
      instance `{}`, which the plan does not declare"), so it is mirrored.
    */
    const declared = new Set((plan.instances || []).map((i) => i.id));
    for (const r of plan.routes || []) {
      for (const ep of [...(r.publishers || []), ...(r.subscribers || [])]) {
        if (!declared.has(ep.instance)) {
          fail(
            `${s.file} (${s.title})`,
            `route \`${r.id}\` names instance \`${ep.instance}\`, which the plan ` +
              `does not declare — hale fleet check rejects this`
          );
        }
      }
    }
    if (!plan.instances?.length) fail(`${s.file} (${s.title})`, 'plan declares no instances');
  }
}

/* ------------------------------------------------------------------
   3. internal links, including anchors
------------------------------------------------------------------ */
async function checkLinks() {
  if (!existsSync(DIST)) {
    note('links: SKIPPED — no dist/, run `npm run build` first');
    return;
  }
  const pages = await walk(DIST, (p) => p.endsWith('.html'));
  const ids = new Map();   // route → Set(ids)
  const routes = new Set();

  const routeOf = (p) => {
    const r = '/' + p.slice(DIST.length + 1).replace(/index\.html$/, '').replace(/\.html$/, '');
    return r.replace(/\/+$/, '') || '/';
  };

  for (const p of pages) {
    const html = await readFile(p, 'utf8');
    routes.add(routeOf(p));
    const set = new Set();
    for (const m of html.matchAll(/\sid=["']([^"']+)["']/g)) set.add(m[1]);
    ids.set(routeOf(p), set);
  }
  // Non-HTML assets are legitimate link targets too (/install.sh, /og.png).
  for (const p of await walk(DIST, (p) => !p.endsWith('.html'))) routes.add(routeOf(p));

  for (const p of pages) {
    const html = await readFile(p, 'utf8');
    const from = routeOf(p);
    for (const m of html.matchAll(/\shref=["']([^"']+)["']/g)) {
      const href = m[1];
      if (/^(https?:|mailto:|#|data:|\/\/)/.test(href) || !href.startsWith('/')) continue;
      const [pathPart, anchor] = href.split('#');
      const target = (pathPart.replace(/\/+$/, '') || '/');
      if (!routes.has(target)) {
        fail(from, `broken internal link → ${href}`);
        continue;
      }
      if (anchor && ids.has(target) && !ids.get(target).has(anchor)) {
        fail(from, `link → ${href} but #${anchor} exists on no element there`);
      }
    }
  }
  note(`links: crawled ${pages.length} page(s)`);
}

/* ------------------------------------------------------------------
   3b. words run into the inline element after them

   Astro drops the whitespace between a word and an inline tag when a
   newline separates them, so prose that reads fine in the editor ships as
   "read thespecification". Source-invisible and easy to miss in review,
   which is why it had accumulated on seven pages.

   Checked against the BUILT html, because the bug is in what the build
   does to the source rather than in the source itself.
------------------------------------------------------------------ */
async function checkTypography() {
  if (!existsSync(DIST)) return;
  // Only our own pages: /docs/* is Starlight rendering synced markdown.
  const pages = (await walk(DIST, (p) => p.endsWith('.html')))
    .filter((p) => !p.includes(`${DIST}/docs/`) && !p.includes(`${DIST}/text/`));

  for (const p of pages) {
    const html = await readFile(p, 'utf8');
    for (const m of html.matchAll(/([a-z,;:])<(a\s|code[\s>]|strong[\s>]|em[\s>])/g)) {
      const at = Math.max(0, m.index - 55);
      const context = html.slice(at, m.index + 40).replace(/<[^>]*>/g, '');
      fail(p, `no space before the inline element: "…${context.trim()}…"`);
    }
  }
}

/* ------------------------------------------------------------------
   4. the package catalogue matches the pond tree
------------------------------------------------------------------ */
async function checkPackages() {
  if (!existsSync(POND)) {
    note(`packages: SKIPPED — no pond checkout at ${POND}`);
    return;
  }
  const src = await readFile('src/pages/packages.astro', 'utf8');
  const listed = new Set();
  for (const m of src.matchAll(/\['([^']+)',\s*'/g)) {
    for (const n of m[1].split(' · ')) listed.add(n.split('/')[0].replace(/\*$/, ''));
  }
  const onDisk = (await readdir(POND, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);

  for (const pkg of onDisk) {
    // heron is a tombstone pointing at tree-sitter-hale, not a package.
    if (pkg === 'heron') continue;
    if (!listed.has(pkg)) {
      fail('src/pages/packages.astro', `pond ships \`${pkg}\` but the catalogue omits it`);
    }
  }
  note(`packages: ${onDisk.length - 1} pond package(s) checked against the catalogue`);
}

/* ------------------------------------------------------------------
   5 & 6. prose discipline

   "lotus" is the runtime substrate; the language is Hale and its
   construct is the locus. And an evidence word with no scope beside it
   is the failure mode this whole gate exists to prevent — "model-checked"
   on its own reads as "the runtime is verified", which is a claim about
   hand-written transcriptions, not about the shipped C.
------------------------------------------------------------------ */
const SCOPE_NEAR = /model|transcri|audit|proof|substrate|claim|artifact|boundary|specif|advisor|verify|witness|correspond/i;

async function checkProse() {
  // Only prose we author. src/content/docs is synced from the compiler
  // repo — its terminology is that repo's gate to keep, not ours.
  const files = await walk('src', (p) =>
    (p.endsWith('.astro') || p.endsWith('.md')) && !p.includes('src/content/docs'));

  for (const f of files) {
    const text = await readFile(f, 'utf8');
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      const at = `${f}:${i + 1}`;
      // 5. lotus-as-language
      if (/\blotus\b/i.test(line) &&
          !/runtime|substrate|lotus_|C-runtime|accent|mark|pond|--lotus/i.test(line)) {
        fail(at, `"lotus" names the runtime substrate; the language construct is "locus"`);
      }
      // 6. an evidence word with nothing scoping it.
      //
      // The trigger phrase is stripped from the context before testing.
      // Without that, "model-checked" satisfies its own scope rule via the
      // word "model" and the lint can never fire — which is exactly what
      // it did until a probe re-introduced a bare claim and the gate
      // stayed green.
      for (const word of ['model-checked', 'model checked']) {
        if (!line.toLowerCase().includes(word)) continue;
        const context = lines
          .slice(Math.max(0, i - 2), i + 3)
          .join(' ')
          .replace(/model[- ]check(ed|s|ing)?/gi, '');
        if (!SCOPE_NEAR.test(context)) {
          fail(at, `"${word}" with no scope nearby — say what was modeled, and what that leaves in the trusted base`);
        }
      }
    });
  }
  note(`prose: ${files.length} authored file(s) scanned`);
}

/* ------------------------------------------------------------------ */
async function main() {
  await checkSnippets();
  await checkLinks();
  await checkTypography();
  await checkPackages();
  await checkProse();

  for (const n of notes) console.log(`  · ${n}`);
  if (findings.length) {
    console.error(`\ncheck-site: ${findings.length} finding(s)\n`);
    for (const f of findings) console.error(`  ${f}\n`);
    process.exit(1);
  }
  console.log('\ncheck-site: clean');
}

main().catch((e) => { console.error(e); process.exit(1); });
