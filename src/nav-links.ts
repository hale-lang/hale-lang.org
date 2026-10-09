// Single source of truth for the primary site nav, shared by the
// marketing pages and the Starlight docs header override.
//
// Every link ships at every width. There is no small-screen subset: the
// nav row scrolls on a narrow viewport instead of dropping entries.
//
// DNA is in the nav: the homepage states it as one of the things Hale
// does for an application, so its page is reachable from every page. Text
// is in the nav because the plain-HTML rendering of the whole site is a
// first-class way to read it, not a footnote.
export interface NavLink { href: string; label: string; }

export const navLinks: NavLink[] = [
  { href: '/features',   label: 'Language' },
  { href: '/docs',       label: 'Docs' },
  { href: '/examples',   label: 'Examples' },
  { href: '/packages',   label: 'Packages' },
  { href: '/proof',      label: 'Proof' },
  { href: '/dna',        label: 'DNA' },
  { href: '/playground', label: 'Playground' },
  { href: '/text',       label: 'Text' },
];
