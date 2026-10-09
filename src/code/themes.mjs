// The two code themes and the Hale grammar, loaded once for every place
// that highlights: the Hale component, article fences, and Starlight's
// Expressive Code in the docs. The themes are the site palette's code
// roles (src/styles/tokens.css), as concrete colours, because Shiki and
// Expressive Code compute contrast from them.
//
// JSON imports rather than reads from disk: this module is evaluated by
// astro.config.mjs and also bundled into the pages, where a path relative
// to the module no longer points at the source tree.
import haleLight from './hale-light.json' with { type: 'json' };
import haleDark from './hale-dark.json' with { type: 'json' };
import haleGrammar from '../grammars/hale.tmLanguage.json' with { type: 'json' };

export { haleLight, haleDark, haleGrammar };
