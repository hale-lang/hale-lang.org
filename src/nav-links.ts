// Single source of truth for the primary site nav — shared by the
// marketing Nav and the Starlight docs header override.
//
// Every link ships at every width. There is no small-screen subset: the
// nav row scrolls on a narrow viewport instead of dropping entries.
export interface NavLink { href: string; label: string; }

export const navLinks: NavLink[] = [
  { href: '/model',      label: 'The model' },
  { href: '/docs',       label: 'Docs' },
  { href: '/playground', label: 'Playground' },
  { href: '/proof',      label: 'Proof' },
  { href: '/features',   label: 'Features' },
  { href: '/examples',   label: 'Examples' },
  { href: '/articles',   label: 'Articles' },
];
