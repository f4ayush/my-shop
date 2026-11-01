import { SearchIcon } from "./icons";

type Props = { variant?: "header" | "hero"; defaultValue?: string };

// Plain GET form: works without JavaScript and gives shareable /search?q= URLs.
export function SearchBox({ variant = "header", defaultValue = "" }: Props) {
  const id = `search-${variant}`;
  const input = (placeholder: string, className: string) => (
    <input
      id={id}
      name="q"
      type="search"
      defaultValue={defaultValue}
      maxLength={100}
      placeholder={placeholder}
      className={`min-w-0 flex-1 bg-transparent text-ink focus:outline-none ${className}`}
    />
  );

  if (variant === "hero") {
    return (
      <form
        action="/search"
        method="get"
        role="search"
        className="flex max-w-[560px] flex-wrap gap-2.5 rounded-[18px] bg-white p-2 shadow-[0_1px_2px_rgba(16,32,30,.06),0_8px_24px_rgba(16,32,30,.06)]"
      >
        <label htmlFor={id} className="flex flex-[1_1_240px] items-center gap-2.5 px-3 text-muted">
          <SearchIcon />
          <span className="sr-only">Medicine name</span>
          {input("Try “Paracetamol” or “Vitamin D”", "h-12 text-base")}
        </label>
        <button
          type="submit"
          className="h-[52px] rounded-xl bg-brand px-[26px] text-[15px] font-bold text-white hover:bg-brand-dark max-sm:w-full"
        >
          Search
        </button>
      </form>
    );
  }

  return (
    <form action="/search" method="get" role="search" className="w-full">
      <label
        htmlFor={id}
        className="flex h-12 items-center gap-2.5 rounded-[14px] border border-line bg-field px-4 text-muted focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20"
      >
        <SearchIcon />
        <span className="sr-only">Search medicines</span>
        {input("Search medicines, salts or health products", "text-[15px]")}
      </label>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
