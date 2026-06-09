#!/usr/bin/env node
// Sync the Hale documentation into the Starlight docs collection.
//
//   The Book  (hale/docs/src/*)  → /docs/*        the guided tour (primary)
//   The Spec  (hale/spec/*.md)   → /docs/spec/*   the canonical reference
//
// Injects Starlight frontmatter (title from the first H1, then strips it)
// and rewrites in-repo markdown links to site paths (or GitHub for
// non-doc files). Idempotent.
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
    return rel === 'introduction.md' ? '/docs' : '/docs/' + rel.replace(/\.md$/, '');
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

async function convert(srcFile, repoPath, destFile, note) {
  let raw = await readFile(srcFile, 'utf8');
  const m = raw.match(/^#\s+(.+)$/m);
  const title = (m ? m[1] : basename(srcFile, '.md')).replace(/"/g, '\\"');
  // drop the first H1 (Starlight renders the frontmatter title)
  raw = raw.replace(/^#\s+.+\n/m, '');
  const body = rewriteLinks(raw, repoPath);
  const fm = `---\ntitle: "${title}"\n---\n\n${note ? note + '\n\n' : ''}`;
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

async function main() {
  await rm(DEST, { recursive: true, force: true });

  // ---- the Book → /docs/* ----
  let nBook = 0;
  for (const f of await walk(BOOK)) {
    const rel = f.slice(BOOK.length + 1);                 // e.g. basics/values.md
    const repoPath = 'docs/src/' + rel;
    const dest = rel === 'introduction.md'
      ? join(DEST, 'index.md')
      : join(DEST, rel);
    await convert(f, repoPath, dest);
    nBook++;
  }

  // ---- the Spec → /docs/spec/* ----
  let nSpec = 0;
  const note = '> Reference material, synced from the compiler repo\'s `spec/`. The [guide](/docs) is the gentler path in.';
  for (const e of await readdir(SPEC)) {
    if (!e.endsWith('.md')) continue;
    await convert(join(SPEC, e), 'spec/' + e, join(DEST, 'spec', e), note);
    nSpec++;
  }

  console.log(`synced ${nBook} book page(s) → /docs/* and ${nSpec} spec page(s) → /docs/spec/*`);
}

main().catch((e) => { console.error(e); process.exit(1); });
