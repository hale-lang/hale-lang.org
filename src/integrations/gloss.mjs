/*
  Hale's own words, glossed where a reader first meets them.

  After the build, every page outside the docs, the text-only tree and the
  glossary itself gets its first use of each glossary term underlined,
  linked to the glossary entry, and given the short familiar gloss as a
  data-gloss attribute that the stylesheet shows on hover. Running text
  only: code, headings, links, labels, navigation, captions and the
  opening list are left alone.

  Done on the built HTML, like the text-only stripping in astro.config.mjs,
  so the pages' sources stay plain prose and the matching rules live in
  one place (src/data/glossary.mjs).
*/
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { GROUPS, MATCH } from '../data/glossary.mjs';

const GLOSS = Object.fromEntries(GROUPS.flatMap((g) => g.entries).map((e) => [e.id, e.gloss]));
const SKIP_TAG = /^(a|b|strong|pre|code|h1|h2|h3|h4|h5|figure|figcaption|label|th|dt|button|title|svg|style|script|header|nav|footer|aside|select|option|textarea)$/;
const SKIP_CLASS = /\b(releases|cadence|gets|frame-meta|scale-label|rung|path|version|carried|install|listing-foot|states|tag|ev|smap|ptabs|dial|legend|ledger)\b/;
const VOID = /^(br|hr|img|input|meta|link|path|circle|rect|line|use|stop|source|track|wbr|col|area|base|param|embed)$/;
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export function gloss(html) {
  const used = new Set();
  const stack = [];
  let out = '';
  let i = 0;
  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  const body = html.indexOf('<body');
  if (body < 0) return html;
  tag.lastIndex = body;
  out = html.slice(0, body);
  i = body;
  for (let m; (m = tag.exec(html)); ) {
    const text = html.slice(i, m.index);
    out += stack.some((s) => s.skip) ? text : glossText(text, used);
    const [whole, close, name, attrs] = m;
    const lower = name.toLowerCase();
    const selfClosing = /\/\s*$/.test(attrs) || VOID.test(lower);
    if (close) {
      for (let k = stack.length - 1; k >= 0; k--) if (stack[k].name === lower) { stack.splice(k); break; }
    } else if (!selfClosing) {
      stack.push({ name: lower, skip: SKIP_TAG.test(lower) || SKIP_CLASS.test(attrs) });
    }
    out += whole;
    i = m.index + whole.length;
  }
  return out + html.slice(i);
}

function glossText(text, used) {
  if (!/[A-Za-z]/.test(text)) return text;
  // An inserted link is held as a placeholder until every term has been
  // tried, so a later term can never match inside an earlier link's text
  // or its hover attribute.
  const links = [];
  for (const [id, re] of MATCH) {
    if (used.has(id)) continue;
    // A whole word only: never part of a path (std::bus), a member (x.bus) or a name.
    const m = new RegExp(`(?<![:./\\w-])(?:${re.source})(?![:\\w-])`, re.flags).exec(text);
    if (!m) continue;
    used.add(id);
    const g = GLOSS[id] ? ` data-gloss="${attr(GLOSS[id])}"` : '';
    links.push(`<a class="term" href="/glossary#${id}"${g}>${m[0]}</a>`);
    text = `${text.slice(0, m.index)}\u0000${links.length - 1}\u0000${text.slice(m.index + m[0].length)}`;
  }
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]);
}

export default function glossTerms() {
  return {
    name: 'gloss-terms',
    hooks: {
      'astro:build:done': ({ dir, logger }) => {
        const walk = (u) => readdirSync(u, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(new URL(`${e.name}/`, u)) : [new URL(e.name, u)]);
        // The docs are synced markdown, the text tree promises no markup of ours,
        // and an article uses these words in their ordinary sense as often as
        // in Hale's.
        const skip = /\/(docs|text|glossary|articles)\/|\/_astro\//;
        let pages = 0;
        let terms = 0;
        for (const file of walk(dir)) {
          if (!file.pathname.endsWith('.html') || skip.test(file.pathname)) continue;
          const before = readFileSync(file, 'utf8');
          const after = gloss(before);
          if (after !== before) {
            writeFileSync(file, after);
            pages++;
            terms += (after.match(/class="term"/g) || []).length;
          }
        }
        logger.info(`glossed ${terms} first uses across ${pages} pages`);
      },
    },
  };
}
