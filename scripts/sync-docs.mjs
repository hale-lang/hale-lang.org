#!/usr/bin/env node
// Sync the Hale documentation into the Starlight docs collection.
//
//   The Book  (hale/docs/src/*)  → /docs/*        the guided tour (primary)
//   The Spec  (hale/spec/*.md)   → /docs/spec/*   the canonical reference
//
// Injects Starlight frontmatter (title from the first H1, then strips it;
// description from the first paragraph of prose)
// and rewrites in-repo markdown links to site paths (or GitHub for
// non-doc files). Also generates the Starlight sidebar from the Book's
// SUMMARY.md (src/generated/book-sidebar.json, read by astro.config.mjs)
// so the site nav tracks the Book's chapters without hand-editing.
// Idempotent.
//
// Usage: node scripts/sync-docs.mjs [hale-repo-dir]
import { readFile, writeFile, readdir, mkdir, rm, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename, posix } from 'node:path';

const HALE = process.argv[2] || join(process.env.HOME, 'code/hale-lang/hale');
const BOOK = join(HALE, 'docs/src');
const SPEC = join(HALE, 'spec');
const DEST = 'src/content/docs/docs';
const GH = 'https://github.com/hale-lang/hale/blob/main/';

if (!existsSync(BOOK)) { console.error(`book not found: ${BOOK}`); process.exit(1); }

// repo-path ("docs/src/basics/x.md") → site URL, or null if not a doc page.
function repoPathToSite(repoPath) {
  if (repoPath.startsWith('docs/src/') && repoPath.endsWith('.md')) {
    const rel = repoPath.slice('docs/src/'.length);
    return rel === 'introduction.md' ? '/docs' : '/docs/' + rel.replace(/\.md$/, '').replace(/\/index$/, '');
  }
  if (repoPath.startsWith('spec/') && repoPath.endsWith('.md')) {
    return '/docs/spec/' + basename(repoPath, '.md');
  }
  if (repoPath === 'AGENTS.md') return '/agents';
  return null;
}

function rewriteLinks(body, fileRepoPath) {
  return body.replace(/\]\(([^)]+)\)/g, (whole, target) => {
    if (/^(https?:|mailto:|#|\/)/.test(target)) return whole;       // external / anchor / already-absolute
    const [path0, anchor] = target.split('#');
    if (!path0) return whole;
    const abs = posix.normalize(posix.join(posix.dirname(fileRepoPath), path0));
    const site = repoPathToSite(abs);
    const href = site
      ? site + (anchor ? '#' + anchor : '')
      : GH + abs + (anchor ? '#' + anchor : '');                    // grammar.ebnf, notes/*, crates/*, fixtures
    return `](${href})`;
  });
}

// A page's description, the snippet search engines and agents show for it:
// its opening prose as plain text, cut at a word near 160 characters.
// Without one, Starlight gives every docs page the site's single
// description, and every search result for the docs reads the same.
function describe(md, title) {
  const paras = [];
  let para = [], fence = false;
  const flush = () => { if (para.length) { paras.push(para.join(' ')); para = []; } };
  for (const line of md.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; flush(); continue; }
    if (fence) continue;
    // a quoted line counts: a page that opens on a callout is introduced by it
    const t = line.trim().replace(/^>\s?/, '').replace(/^\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i, '').trim();
    // a blank line ends a paragraph; headings, tables, lists, asides,
    // HTML, images, rules and link definitions are not prose
    if (!t || /^(#|\||[-*+] |\d+[.)] |<|!\[|:::|---|\*\*\*|\[[^\]]+\]:)/.test(t)) {
      flush();
      if (paras.join(' ').length >= 80) break;
      continue;
    }
    para.push(t);
  }
  flush();
  let text = '';
  for (const p of paras) { text = text ? `${text} ${p}` : p; if (text.length >= 80) break; }
  text = text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*\s][^*]*)\*/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return `${title}, in the Hale programming language documentation.`;
  if (text.length > 160) {
    const cut = text.slice(0, 157);
    text = cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s(—-]+$/, '') + '…';
  }
  return text;
}

async function convert(srcFile, repoPath, destFile, note) {
  let raw = await readFile(srcFile, 'utf8');
  const m = raw.match(/^#\s+(.+)$/m);
  const title = (m ? m[1] : basename(srcFile, '.md')).replace(/"/g, '\\"');
  // drop the first H1 (Starlight renders the frontmatter title)
  raw = raw.replace(/^#\s+.+\n/m, '');
  // The hale repo tags some fences `hale,fragment` / `hale,refused` /
  // `hale,ignore` for its own doc tests (a partial program, a program
  // the compiler refuses on purpose). Expressive Code reads the whole
  // token as the language name, finds none, and renders the block
  // plain; here the tag is meaningless, so the fence becomes `hale`.
  let body = rewriteLinks(raw, repoPath).replace(/^(\s*```)hale(?:,[\w-]+)+[ \t]*$/gm, '$1hale');
  // Convert GitHub-style alert blockquotes (> [!NOTE], > [!IMPORTANT], etc.)
  // into Starlight's native :::note / :::tip / :::caution / :::danger blocks.
  body = body.replace(
    /^>[ \t]*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\][ \t]*\n((?:>[ \t]?.*\n?)+)/gm,
    (_, kind, content) => {
      const map = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note', WARNING: 'caution', CAUTION: 'danger' };
      const inner = content.replace(/^>[ \t]?/gm, '').trimEnd();
      return `:::${map[kind] || 'note'}\n${inner}\n:::\n`;
    },
  );
  // Replace inline math spans ($O(1)$, $\to$, $\Sigma$, etc.) with clean Unicode
  // since Starlight does not load a LaTeX math renderer.
  body = body
    .replace(/\$O\(1\)\$/g, '`O(1)`')
    .replace(/\$\\to\$/g, '→')
    .replace(/\$\\Sigma\\text\{-proto\}\$/g, '`Σ-proto`')
    .replace(/\$\\Sigma\$/g, 'Σ')
    .replace(/\$\\Delta\$/g, 'Δ')
    .replace(/\$\\Pi\$/g, 'Π')
    .replace(/\$\\perp\$/g, '⊥')
    .replace(/\$\\bowtie\$/g, '⋈')
    .replace(/\$K\$/g, '`K`');
  const description = JSON.stringify(describe(raw, title.replace(/\\"/g, '"')));
  const fm = `---\ntitle: "${title}"\ndescription: ${description}\n---\n\n${note ? note + '\n\n' : ''}`;
  await mkdir(dirname(destFile), { recursive: true });
  await writeFile(destFile, fm + body);
}

async function walk(dir, base = dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, base));
    else if (e.name.endsWith('.md') && e.name !== 'SUMMARY.md') out.push(p);
  }
  return out;
}

// SUMMARY.md → Starlight sidebar groups. Part headers (`# Getting started`)
// open a group; the unheaded list after the `---` rule becomes "Reference";
// the prefix chapter (Introduction) is folded into the first group, matching
// the old hand-written sidebar. Labels come from SUMMARY, so the site nav
// reads exactly like the Book's.
async function buildSidebar(bookFiles) {
  const raw = await readFile(join(BOOK, 'SUMMARY.md'), 'utf8');
  const groups = [];
  const prefix = [];
  const inNav = new Set();
  let current = null;
  for (const line of raw.split('\n')) {
    const h = line.match(/^#\s+(.+)$/);
    if (h) {
      if (h[1].trim() !== 'Summary') groups.push(current = { label: h[1].trim(), items: [] });
      continue;
    }
    if (/^-{3,}\s*$/.test(line)) { groups.push(current = { label: 'Reference', items: [] }); continue; }
    const m = line.match(/^\s*(?:-\s*)?\[([^\]]+)\]\(\.\/(.+?)\.md\)\s*$/);
    if (!m) continue;
    const [, label, rel] = m;
    inNav.add(rel + '.md');
    // a chapter named index.md is its directory's page (Starlight collapses the slug)
    const slug = rel === 'introduction' ? 'docs' : 'docs/' + rel.replace(/\/index$/, '');
    const item = { label: label.replace(/`/g, ''), slug };
    (current ? current.items : prefix).push(item);
  }
  if (groups.length) groups[0].items.unshift(...prefix);
  const orphans = bookFiles.filter((f) => !inNav.has(f));
  if (orphans.length) console.log(`note: synced but not in SUMMARY.md (reachable by URL only): ${orphans.join(', ')}`);
  return groups;
}

async function main() {
  await rm(DEST, { recursive: true, force: true });

  // ---- the Book → /docs/* ----
  const bookRels = [];
  for (const f of await walk(BOOK)) {
    const rel = f.slice(BOOK.length + 1);                 // e.g. basics/values.md
    const repoPath = 'docs/src/' + rel;
    const dest = rel === 'introduction.md'
      ? join(DEST, 'index.md')
      : join(DEST, rel);
    await convert(f, repoPath, dest);
    bookRels.push(rel);
  }
  const nBook = bookRels.length;

  // ---- SUMMARY.md → the sidebar ----
  const sidebar = await buildSidebar(bookRels);
  await mkdir('src/generated', { recursive: true });
  await writeFile('src/generated/book-sidebar.json', JSON.stringify(sidebar, null, 2) + '\n');

  // ---- the release facts → src/generated/release.json ----
  //
  // The site used to state its own version and platform support in prose,
  // which is how the install guide came to advertise two platforms while
  // releases shipped three. Read both from the compiler checkout that is
  // already here: the workspace version, and the pre-1.0 rule that
  // release.yml applies when it tags (`startsWith(ref, 'v0.')`).
  const cargo = await readFile(join(HALE, 'Cargo.toml'), 'utf8');
  const version = cargo.match(/^\s*version\s*=\s*"([^"]+)"/m)?.[1];
  if (!version) { console.error('could not read workspace version from hale/Cargo.toml'); process.exit(1); }
  const release = {
    version,
    minor: version.split('.').slice(0, 2).join('.'),
    prerelease: version.startsWith('0.') || version.includes('-'),
  };
  await writeFile('src/generated/release.json', JSON.stringify(release, null, 2) + '\n');

  // ---- the release history → src/generated/releases.json ----
  //
  // The homepage and the community page show the project's recent releases
  // and how often they ship, read from the compiler's CHANGELOG headings
  // ("## vX.Y.Z — title (YYYY-MM-DD)") so the record cannot go stale.
  const changelog = await readFile(join(HALE, 'CHANGELOG.md'), 'utf8');
  const releases = [...changelog.matchAll(/^## v(\d+\.\d+\.\d+)\s+—\s+(.+?)\s+\((\d{4}-\d{2}-\d{2})\)\s*$/gm)]
    .map((m) => ({ version: m[1], title: m[2], date: m[3] }));
  if (!releases.length) { console.error('no release headings found in hale/CHANGELOG.md'); process.exit(1); }
  await writeFile('src/generated/releases.json', JSON.stringify(releases, null, 2) + '\n');

  // ---- the performance grid → src/generated/performance.json ----
  //
  // The README states where Hale is faster and where it is slower than Go,
  // with the version, date and machine. The site shows the same table, read
  // from the README, so the two cannot disagree.
  const readme = await readFile(join(HALE, 'README.md'), 'utf8');
  const perfAt = readme.indexOf('**Performance, scoped honestly:**');
  if (perfAt < 0) { console.error('no performance section in hale/README.md'); process.exit(1); }
  const perfText = readme.slice(perfAt);
  const intro = perfText.slice(0, perfText.indexOf('\n\n')).replace(/\s+/g, ' ');
  const provenance = intro.match(/at\s+(v\d+\.\d+\.\d+)\s+\((\d{4}-\d{2}-\d{2}),\s*([^,]+?),\s*the same/);
  const tableLines = perfText.slice(perfText.indexOf('\n|')).split('\n').slice(1).filter((l, i, a) => l.startsWith('|') && a.slice(0, i).every((x) => x.startsWith('|')));
  const rows = tableLines.slice(2).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .map(([bench, hale, go, vs]) => ({
      bench: bench.replace(/^`([^`]+)`\s*/, '$1 ').trim(),
      hale, go,
      verdict: vs.replace(/\*\*/g, '').replace(/\\\*$/, '').trim(),
      footnote: /\\\*$/.test(vs),
    }));
  if (!provenance || !rows.length) { console.error('could not read the performance table in hale/README.md'); process.exit(1); }
  const performance = {
    version: provenance[1], date: provenance[2], machine: provenance[3].trim(),
    rows,
    source: 'https://github.com/hale-lang/hale#readme',
    grid: 'https://github.com/hale-lang/bench',
  };
  await writeFile('src/generated/performance.json', JSON.stringify(performance, null, 2) + '\n');

  // ---- the Spec → /docs/spec/* ----
  let nSpec = 0;
  const note = '> Reference material, synced from the compiler repo\'s `spec/`. The [guide](/docs) is the gentler path in.';
  for (const e of await readdir(SPEC)) {
    if (!e.endsWith('.md')) continue;
    await convert(join(SPEC, e), 'spec/' + e, join(DEST, 'spec', e), note);
    nSpec++;
  }

  console.log(`synced ${nBook} book page(s) → /docs/* and ${nSpec} spec page(s) → /docs/spec/*; sidebar: ${sidebar.length} group(s)`);
  console.log(`release: v${release.version}${release.prerelease ? ' (prerelease)' : ''}; ${releases.length} releases in the changelog; performance grid at ${performance.version}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
