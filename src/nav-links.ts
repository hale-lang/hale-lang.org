// Single source of truth for the primary site nav — shared by the
// marketing Nav and the Starlight docs header override.
//
// Every link ships at every width. There is no small-screen subset: the
// nav row scrolls on a narrow viewport instead of dropping entries.
//
// Six items, chosen to state the category (general-purpose language
// site) to a first-time visitor. "The model" left the nav on purpose:
// the homepage's why-Hale section, the final CTA, and the footer all
// hand it to the reader at the moment the narrative earns it, which is
// the repositioning working as designed. Articles is return-visitor
// depth; it lives in the footer and the credibility section.
export interface NavLink { href: string; label: string; }

export const navLinks: NavLink[] = [
  { href: '/features',   label: 'Language' },
  { href: '/docs',       label: 'Learn' },
  { href: '/examples',   label: 'Examples' },
  { href: '/packages',   label: 'Packages' },
  { href: '/proof',      label: 'Proof' },
  { href: '/playground', label: 'Playground' },
];
