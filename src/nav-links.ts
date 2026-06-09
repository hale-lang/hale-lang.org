// Single source of truth for the primary site nav — shared by the
// marketing Nav and the Starlight docs header override.
export interface NavLink { href: string; label: string; sm?: boolean; }

export const navLinks: NavLink[] = [
  { href: '/why',        label: 'Why Hale' },
  { href: '/docs',       label: 'Docs' },
  { href: '/playground', label: 'Playground', sm: true },
  { href: '/packages',   label: 'Packages', sm: true },
  { href: '/agents',     label: 'Agents' },
];
