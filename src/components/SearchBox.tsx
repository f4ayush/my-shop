// Plain GET form: works without JavaScript and gives shareable /search?q= URLs.
export function SearchBox({ defaultValue = "" }: { defaultValue?: string }) {
  return (
    <form action="/search" method="get" role="search" className="flex w-full max-w-xl">
      <label htmlFor="site-search" className="sr-only">
        Search medicines
      </label>
      <input
        id="site-search"
        name="q"
        type="search"
        defaultValue={defaultValue}
        maxLength={100}
        placeholder="Search by medicine, salt or brand"
        className="w-full rounded-l-md border-0 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
      />
      <button type="submit" className="rounded-r-md bg-brand-dark px-4 py-2 font-medium hover:bg-slate-900">
        Search
      </button>
    </form>
  );
}
