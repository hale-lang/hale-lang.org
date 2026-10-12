// JSON-LD for the homepage: what Hale is, who makes it, and where else it
// lives. `sameAs` is the field that tells a crawler this is the Hale
// language and no other Hale; add any social accounts to it once they
// exist.
const SITE = 'https://hale-lang.org/';
const GITHUB_ORG = 'https://github.com/hale-lang';
const GITHUB_REPO = 'https://github.com/hale-lang/hale';
// The Wikidata item is the language, not the organization.
const WIKIDATA = 'https://www.wikidata.org/wiki/Q141713684';

export const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'ComputerLanguage',
      '@id': `${SITE}#language`,
      name: 'Hale',
      alternateName: ['hale-lang', 'Hale language', 'Hale programming language'],
      description:
        'Hale is a compiled, general-purpose programming language. Every piece of state has one owner, and the parts of a program talk only over declared, typed message channels, so the compiler checks a program\'s architecture the way it checks its types. It runs natively with no garbage collector.',
      url: SITE,
      // Hale source files end in .hl
      identifier: { '@type': 'PropertyValue', propertyID: 'file extension', value: '.hl' },
      sameAs: [WIKIDATA, GITHUB_REPO, GITHUB_ORG],
    },
    {
      '@type': 'SoftwareSourceCode',
      '@id': `${SITE}#compiler`,
      name: 'Hale compiler and runtime',
      about: { '@id': `${SITE}#language` },
      codeRepository: GITHUB_REPO,
      license: 'https://www.apache.org/licenses/LICENSE-2.0',
      url: GITHUB_REPO,
      author: { '@id': `${SITE}#organization` },
    },
    {
      '@type': 'Organization',
      '@id': `${SITE}#organization`,
      name: 'Hale programming language',
      alternateName: 'hale-lang',
      url: SITE,
      logo: `${SITE}og.png`,
      sameAs: [GITHUB_ORG],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}#website`,
      name: 'Hale',
      alternateName: ['Hale programming language', 'hale-lang.org'],
      url: SITE,
      publisher: { '@id': `${SITE}#organization` },
      about: { '@id': `${SITE}#language` },
    },
  ],
};
