// The downloadable program: the same assembly the capture script
// verified. A full example you cannot run locally is a brochure.
export async function getStaticPaths() {
  const mods = import.meta.glob('../../examples/full/*.mjs', {
    eager: true,
  });
  return Object.values(mods).map((m: any) => ({
    params: { slug: m.full.slug },
    props: { full: m.full },
  }));
}
export async function GET({ props }: { props: { full: any } }) {
  const program = props.full.sections
    .filter((s: any) => s.code)
    .map((s: any) => s.code)
    .join('\n\n');
  return new Response(program + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
