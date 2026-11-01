import Link from "next/link";
import { CategoryPills } from "@/components/CategoryPills";
import {
  ChatIcon,
  CheckIcon,
  ChevronRightIcon,
  LockIcon,
  RefreshIcon,
  ShieldCheckIcon,
  TruckIcon,
  UploadIcon,
  UserIcon,
} from "@/components/icons";
import { PrescriptionUploadForm } from "@/components/PrescriptionUploadForm";
import { ProductThumb } from "@/components/ProductArt";
import { ProductGrid } from "@/components/ProductCard";
import { SearchBox } from "@/components/SearchBox";
import { btn, sectionTitle } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { BUSINESS } from "@/lib/business";
import { firstParam, getCategories, listProducts, type RawSearchParams } from "@/lib/catalog";
import { progressSteps } from "@/lib/order-flow";
import { getActiveOrder, ORDER_STATUS_LABEL } from "@/lib/orders";
import { PRESCRIPTION_MESSAGE, whatsappOrders, whatsappUrl } from "@/lib/whatsapp";

type Props = { searchParams: Promise<RawSearchParams> };

const TRUST = [
  { Icon: ShieldCheckIcon, title: "Genuine medicines", text: "From licensed distributors" },
  { Icon: UserIcon, title: "Pharmacist support", text: "Ask about dosage or substitutes" },
  { Icon: TruckIcon, title: "Pickup or delivery", text: whatsappOrders ? "Arranged on WhatsApp" : "Status updates by SMS" },
  { Icon: LockIcon, title: "Private by default", text: "Discreet, sealed packaging" },
];

const STEPS = whatsappOrders
  ? [
      {
        title: "Pick your medicines",
        text: "Find a medicine by brand or salt name and add it to your cart. No account or sign-up needed.",
      },
      {
        title: "Order on WhatsApp",
        text: "Tap “Order on WhatsApp” in your cart and your list is sent to us. Add a photo of your prescription if you need one.",
      },
      {
        title: "We confirm, then pack",
        text: "Our pharmacist checks your order and confirms the price and pickup or delivery with you in the chat.",
      },
    ]
  : [
      {
        title: "Search or upload",
        text: "Find a medicine by brand or salt name, and upload your prescription once — it stays on file for checkout.",
      },
      {
        title: "Pharmacist verifies",
        text: "A registered pharmacist checks the prescription, dosage and quantities before anything is packed.",
      },
      {
        title: "Packed, on its way",
        text: "Your order is sealed and packed for pickup or delivery. Follow each step in My orders and by SMS.",
      },
    ];

export default async function HomePage({ searchParams }: Props) {
  const [categories, user, sp] = await Promise.all([getCategories(), getCurrentUser(), searchParams]);
  const requested = firstParam(sp.category);
  const category = categories.find((c) => c.slug === requested) ?? null;
  const [products, activeOrder] = await Promise.all([
    listProducts(category ? { category: { slug: category.slug } } : {}, { sort: "name", rx: "all", page: 1 }),
    user ? getActiveOrder(user.id) : null,
  ]);
  const rxHref = user ? "#rx" : "/login?next=%2Faccount%2Fprescriptions";
  const rxWhatsappHref = whatsappOrders ? whatsappUrl(PRESCRIPTION_MESSAGE) : null;

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-wrap items-center gap-8 rounded-[28px] bg-mint p-6 sm:gap-12 sm:rounded-[32px] sm:p-[clamp(28px,5vw,64px)]">
        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-5 sm:gap-6">
          {BUSINESS.drugLicence && (
            <span className="flex items-center gap-2 self-start rounded-full bg-white px-3.5 py-2 text-[13px] font-semibold text-brand-dark">
              <ShieldCheckIcon size={16} strokeWidth={2.2} />
              Licensed online pharmacy
            </span>
          )}
          <h1 className="text-[clamp(36px,5.6vw,68px)] leading-[1.02] font-extrabold tracking-[-0.035em]">
            Your medicines,
            <br />
            delivered with care.
          </h1>
          <p className="max-w-[520px] text-base leading-relaxed text-ink-2 sm:text-lg">
            Order prescription and everyday health products in a few taps. A pharmacist checks every order before it
            leaves.
          </p>
          <div className="max-sm:hidden">
            <SearchBox variant="hero" />
          </div>
          <div className="flex flex-wrap gap-3">
            {rxWhatsappHref ? (
              <QuickLink href={rxWhatsappHref} external tone="bg-amber-tint text-amber-ink" Icon={ChatIcon} label="Send prescription on WhatsApp" />
            ) : (
              <>
                <QuickLink href={rxHref} tone="bg-amber-tint text-amber-ink" Icon={UploadIcon} label="Upload prescription" />
                <QuickLink href="/account/orders" tone="bg-[#E7EEFB] text-[#1E3A8A]" Icon={RefreshIcon} label="Reorder past medicines" />
              </>
            )}
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_360px] justify-center max-sm:hidden">
          {activeOrder ? <ActiveOrderCard order={activeOrder} /> : <HowItMovesCard />}
        </div>
      </section>

      {/* On phones the order card follows the hero, compact. */}
      {activeOrder && (
        <div className="mt-4 sm:hidden">
          <ActiveOrderCard order={activeOrder} />
        </div>
      )}

      {/* Trust strip */}
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:mt-7 sm:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] sm:gap-4">
        {TRUST.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-center gap-3 rounded-[18px] border border-line bg-white p-3.5 sm:gap-3.5 sm:px-5 sm:py-[18px]">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-mint text-brand-dark sm:size-11">
              <Icon size={22} />
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <strong className="text-sm sm:text-[15px]">{title}</strong>
              <span className="text-[13px] text-muted max-sm:hidden">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      {/* Shop by category */}
      <section id="shop" className="mt-14 flex scroll-mt-6 flex-col gap-5 sm:mt-[72px] sm:gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className={sectionTitle}>Shop by category</h2>
            <p className="text-muted sm:text-base">Pick a category to filter the products below.</p>
          </div>
          <Link href={category ? `/category/${category.slug}` : "/search"} className="text-[15px] font-bold text-brand hover:text-brand-dark">
            View all {category ? category.name.toLowerCase() : "products"} →
          </Link>
        </div>
        <CategoryPills categories={categories} active={category?.slug ?? null} mode="filter" />
        {products.items.length > 0 ? (
          <ProductGrid products={products.items.slice(0, 8)} />
        ) : (
          <p className="rounded-3xl border border-line bg-white p-6 text-muted">No products in this category yet.</p>
        )}
      </section>

      {/* How it works */}
      <section className="mt-16 flex flex-col gap-5 sm:mt-[88px] sm:gap-7">
        <h2 className={sectionTitle}>Three steps to your door</h2>
        <ol className="grid gap-4 sm:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] sm:gap-5">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-3.5 rounded-3xl border border-line bg-white p-6 sm:p-7">
              <span className="text-sm font-extrabold text-brand-dark">{String(i + 1).padStart(2, "0")}</span>
              <strong className="text-xl tracking-[-0.01em]">{s.title}</strong>
              <p className="text-[15px] leading-relaxed text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Prescription band */}
      <section
        id="rx"
        className="mt-16 flex scroll-mt-6 flex-wrap items-center gap-10 rounded-[28px] bg-forest p-6 text-white sm:mt-[88px] sm:rounded-[32px] sm:p-[clamp(28px,5vw,64px)]"
      >
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-4">
          <h2 className="text-[clamp(28px,3.4vw,44px)] leading-[1.08] font-extrabold tracking-[-0.03em]">
            Have a prescription?
            <br />
            Keep it ready.
          </h2>
          <p className="max-w-[460px] text-[17px] leading-relaxed text-mist">
            {rxWhatsappHref
              ? "Send a clear photo of it on WhatsApp. Our pharmacist checks it and confirms your order with you in the chat."
              : "Upload a clear photo or PDF once. Choose it at checkout, and our pharmacist verifies it before your order is packed."}
          </p>
        </div>
        <div className="min-w-0 flex-[1_1_380px]">
          {rxWhatsappHref ? (
            <RxDropZone Icon={ChatIcon} title="Send your prescription" note="Photo or PDF · only our pharmacists see it">
              <a href={rxWhatsappHref} target="_blank" rel="noopener noreferrer" className={`${btn("light")} mt-1.5`}>
                Send on WhatsApp
              </a>
            </RxDropZone>
          ) : user ? (
            <PrescriptionUploadForm variant="dark" />
          ) : (
            <RxDropZone Icon={UploadIcon} title="Upload your prescription" note="JPG, PNG or PDF · only our pharmacists can see it">
              <Link href="/login?next=%2Faccount%2Fprescriptions" className={`${btn("light")} mt-1.5`}>
                Log in to upload
              </Link>
            </RxDropZone>
          )}
        </div>
      </section>
    </div>
  );
}

function QuickLink({
  href,
  external = false,
  tone,
  Icon,
  label,
}: {
  href: string;
  /** Opens in a new tab (the WhatsApp chat). */
  external?: boolean;
  tone: string;
  Icon: typeof UploadIcon;
  label: string;
}) {
  return (
    <Link
      href={href}
      {...(external && { target: "_blank", rel: "noopener noreferrer" })}
      className="flex items-center gap-3 rounded-2xl bg-white py-3 pr-[18px] pl-3 text-[15px] font-semibold text-ink hover:text-ink hover:shadow-[0_4px_16px_rgba(16,32,30,.08)]"
    >
      <span className={`flex size-10 items-center justify-center rounded-xl ${tone}`}>
        <Icon />
      </span>
      {label}
    </Link>
  );
}

/** The dashed prescription panel on the dark band, for visitors who can't upload here. */
function RxDropZone({
  Icon,
  title,
  note,
  children,
}: {
  Icon: typeof UploadIcon;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-3xl border-2 border-dashed border-[#4F8F86] bg-forest-2 px-7 py-9 text-center">
      <span className="flex size-14 items-center justify-center rounded-[18px] bg-white text-forest">
        <Icon size={26} />
      </span>
      <strong className="text-lg">{title}</strong>
      <span className="text-sm text-mist">{note}</span>
      {children}
    </div>
  );
}

const orderCard =
  "flex w-full max-w-[420px] flex-col gap-[22px] rounded-[28px] bg-white p-6 shadow-[0_24px_60px_rgba(11,59,55,.12)] sm:p-7";

type StepState = "done" | "current" | "todo";

function StepList({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <ol className="flex flex-col gap-3.5">
      {steps.map((s) => (
        <li
          key={s.label}
          aria-current={s.state === "current" ? "step" : undefined}
          className={`flex items-center gap-3 text-[15px] ${s.state === "current" ? "font-bold" : s.state === "done" ? "font-medium" : "font-medium text-muted"}`}
        >
          {s.state === "done" ? (
            <span className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand text-white">
              <CheckIcon size={14} strokeWidth={3} />
            </span>
          ) : (
            <span
              className={`flex size-[26px] shrink-0 items-center justify-center rounded-full border-2 ${s.state === "current" ? "border-brand" : "border-[#C9D8D5]"}`}
            >
              {s.state === "current" && <span className="size-2.5 rounded-full bg-brand" />}
            </span>
          )}
          {s.label}
        </li>
      ))}
    </ol>
  );
}

type ActiveOrder = NonNullable<Awaited<ReturnType<typeof getActiveOrder>>>;

/** The signed-in customer's newest order in progress: three steps around where it is now. */
function ActiveOrderCard({ order }: { order: ActiveOrder }) {
  const { steps, current } = progressSteps(order.status, order.fulfilmentMode, Boolean(order.prescriptionId));
  const start = Math.max(0, Math.min(current - 1, steps.length - 3));
  const shown = steps.slice(start, start + 3).map((s, i) => ({
    label: s.label,
    state: (start + i < current ? "done" : start + i === current ? "current" : "todo") as StepState,
  }));
  const more = order.itemCount - order.items.length;

  return (
    <Link href={`/account/orders/${order.orderNumber}`} className={`${orderCard} text-ink hover:text-ink hover:shadow-[0_24px_60px_rgba(11,59,55,.2)]`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-muted">Order {order.orderNumber}</span>
          <span className="text-xl font-bold">{ORDER_STATUS_LABEL[order.status]}</span>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-brand-dark">
          <TruckIcon size={24} />
        </span>
      </div>
      <StepList steps={shown} />
      <div className="h-px bg-line" />
      <ul className="flex flex-col gap-3">
        {order.items.map((i) => (
          <li key={i.productId} className="flex items-center gap-3">
            <ProductThumb id={i.productId} className="size-11 rounded-xl" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold">{i.name}</span>
              <span className="text-[13px] text-muted">Qty {i.quantity}</span>
            </span>
          </li>
        ))}
      </ul>
      <span className="flex items-center gap-1 text-sm font-bold text-brand">
        {more > 0 ? `+${more} more · ` : ""}Track this order
        <ChevronRightIcon size={16} strokeWidth={2.4} />
      </span>
    </Link>
  );
}

/** For visitors without an order in progress: how any order moves, no order details. */
function HowItMovesCard() {
  return (
    <div className={orderCard}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-medium text-muted">Every order</span>
          <span className="text-xl font-bold">From our pharmacy to you</span>
        </div>
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-mint text-brand-dark">
          <TruckIcon size={24} />
        </span>
      </div>
      <StepList
        steps={[
          { label: "Prescription verified by pharmacist", state: "done" },
          { label: "Packed in a sealed pouch", state: "done" },
          { label: "Ready for pickup or out for delivery", state: "current" },
        ]}
      />
      <div className="h-px bg-line" />
      <p className="text-sm leading-relaxed text-muted">
        {whatsappOrders ? (
          <>
            Send your cart on <span className="font-semibold text-ink">WhatsApp</span> and we confirm everything with you
            in the chat.
          </>
        ) : (
          <>
            Track every step from <span className="font-semibold text-ink">My orders</span>, with an SMS at each update.
          </>
        )}
      </p>
    </div>
  );
}
