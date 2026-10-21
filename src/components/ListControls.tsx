import Link from "next/link";
import { RX_LABELS, SORT_LABELS, type ListOptions, type RxFilter, type SortKey } from "@/lib/catalog";

type Props = {
  basePath: string;
  options: ListOptions;
  /** Extra params to keep in every link, e.g. the search query. */
  keep?: Record<string, string>;
  pageCount: number;
};

// Default values are left out of URLs to keep them short and canonical.
const DEFAULTS: Record<string, string> = { sort: "name", rx: "all", page: "1" };

function buildHref(basePath: string, params: Record<string, string | number | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || DEFAULTS[k] === String(v)) continue;
    sp.set(k, String(v));
  }
  const qs = sp.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

const pill = "rounded-full border px-3 py-1 text-sm";
const pillOn = "border-brand bg-brand text-white";
const pillOff = "border-slate-300 bg-white text-slate-700 hover:border-brand";

/** Rx filter + sort links. Changing either resets to page 1. */
export function ListFilters({ basePath, options, keep = {} }: Omit<Props, "pageCount">) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
      <nav aria-label="Filter" className="flex flex-wrap gap-2">
        {(Object.keys(RX_LABELS) as RxFilter[]).map((rx) => (
          <Link
            key={rx}
            href={buildHref(basePath, { ...keep, rx, sort: options.sort })}
            className={`${pill} ${options.rx === rx ? pillOn : pillOff}`}
            aria-current={options.rx === rx ? "true" : undefined}
          >
            {RX_LABELS[rx]}
          </Link>
        ))}
      </nav>
      <nav aria-label="Sort" className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-500">Sort:</span>
        {(Object.keys(SORT_LABELS) as SortKey[]).map((sort) => (
          <Link
            key={sort}
            href={buildHref(basePath, { ...keep, rx: options.rx, sort })}
            className={options.sort === sort ? "font-semibold text-brand" : "text-slate-700 hover:text-brand"}
            aria-current={options.sort === sort ? "true" : undefined}
          >
            {SORT_LABELS[sort]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Pagination({ basePath, options, keep = {}, pageCount }: Props) {
  if (pageCount <= 1) return null;
  const link = (page: number) => buildHref(basePath, { ...keep, rx: options.rx, sort: options.sort, page });
  const { page } = options;
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-4 text-sm">
      {page > 1 ? (
        <Link href={link(page - 1)} className="text-brand hover:underline">
          ← Previous
        </Link>
      ) : (
        <span className="text-slate-400">← Previous</span>
      )}
      <span>
        Page {page} of {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={link(page + 1)} className="text-brand hover:underline">
          Next →
        </Link>
      ) : (
        <span className="text-slate-400">Next →</span>
      )}
    </nav>
  );
}
