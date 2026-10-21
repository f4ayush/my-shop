/** A configured value, or a visible [placeholder] when it hasn't been set yet. */
export function Fill({ value, placeholder }: { value: string | null; placeholder: string }) {
  return value ? <>{value}</> : <mark className="bg-amber-100 px-1">[{placeholder}]</mark>;
}
