// Single source of truth for the primary site nav — shared by the
// marketing Nav and the Starlight docs header override.
export interface NavLink { href: string; label: string; sm?: boolean; }

export const navLinks: NavLink[] = [
  { href: '/model',      label: 'The model' },
  { href: '/docs',       label: 'Docs' },
  { href: '/playground', label: 'Playground' },
  { href: '/proof',      label: 'Proof' },
  { href: '/features',   label: 'Features', sm: true },
  { href: '/examples',   label: 'Examples', sm: true },
  { href: '/articles',   label: 'Articles', sm: true },
];
