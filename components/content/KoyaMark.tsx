// The Koya logomark — extracted from assets/koya_logo_concept.svg (the "K" made of two
// interlocking ribbon shapes, in ink + terracotta). Inline so it can be sized/colored via
// className anywhere the logo appears, with no extra network request for such a small asset.
export function KoyaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 250 260" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Koya" className={className}>
      <path
        d="M40 0 L100 0 L100 90 L180 0 L250 0 L150 120 L140 130 L250 260 L180 260 L100 165 L100 260 L40 260 Z"
        fill="#232323"
      />
      <path d="M0 0 L60 0 L60 260 L0 260 Z" fill="#c1622e" />
      <path d="M150 120 L250 0 L195 0 L100 112 Z" fill="#c1622e" fillOpacity="0.55" />
    </svg>
  );
}
