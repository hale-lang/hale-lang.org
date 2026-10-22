// Single source of truth for the primary site nav, shared by the
// marketing pages and the Starlight docs header override.
//
// Every link ships at every width. There is no small-screen subset: the
// nav row scrolls on a narrow viewport instead of dropping entries.
export interface NavLink { href: string; label: string; }

export const navLinks: NavLink[] = [
  { href: '/features',   label: 'Language' },
  { href: '/docs',       label: 'Docs' },
  { href: '/examples',   label: 'Examples' },
  { href: '/packages',   label: 'Packages' },
  { href: '/playground', label: 'Playground' },
  { href: '/text',       label: 'Text' },
];
