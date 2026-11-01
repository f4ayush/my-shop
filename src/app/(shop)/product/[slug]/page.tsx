import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/AddToCartButton";
import { FileIcon } from "@/components/icons";
import { ProductArt, ProductThumb } from "@/components/ProductArt";
import { RxBadge } from "@/components/RxBadge";
import { MAX_QTY_PER_ITEM } from "@/lib/cart";
import { getAlternatives, getProductBySlug } from "@/lib/catalog";
import { discountPercent, formatPrice } from "@/lib/money";
import { artTone } from "@/lib/product-art";
import { whatsappOrders } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug((await params).slug);
  if (!product) return {};
  return {
    title: product.name,
    description: [product.composition, product.packSize, product.manufacturer].filter(Boolean).join(" · "),
  };
}

export default async function ProductPage({ params }: Props) {
  const product = await getProductBySlug((await params).slug);
  if (!product) notFound();

  const alternatives = await getAlternatives(product.id, product.composition);
  const off = discountPercent(product.mrpPaise, product.pricePaise);
  const inStock = product.availableQty > 0;

  return (
    <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-muted">
        <Link href="/" className="text-brand hover:text-brand-dark">
          Home
        </Link>
        <span aria-hidden="true">/</span>
        <Link href={`/category/${product.category.slug}`} className="text-brand hover:text-brand-dark">
          {product.category.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="font-semibold text-ink">
          {product.name}
        </span>
      </nav>

      <div className="flex flex-wrap items-start gap-8 sm:gap-10">
        <div
          className="relative flex aspect-[1/0.86] min-w-0 flex-[1_1_460px] items-center justify-center rounded-[28px]"
          style={{ background: artTone(product.id).tint }}
        >
          {product.requiresRx && <RxBadge onArt className="absolute top-5 left-5 px-3.5 py-2 text-[13px]" />}
          <ProductArt id={product.id} packSize={product.packSize} variant="hero" label={`${product.name} illustration`} />
        </div>

        <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-6">
          <div className="flex flex-col gap-2.5">
            {product.manufacturer && <span className="text-sm font-medium text-muted">By {product.manufacturer}</span>}
            <h1 className="text-[clamp(32px,4vw,48px)] leading-[1.05] font-extrabold tracking-[-0.03em]">{product.name}</h1>
            {product.composition && (
              <span className="text-[15px] text-ink-2">
                Salt composition:{" "}
                <Link
                  href={`/search?q=${encodeURIComponent(product.composition)}`}
                  className="font-bold text-ink underline decoration-line-strong underline-offset-4 hover:text-brand"
                >
                  {product.composition}
                </Link>
              </span>
            )}
          </div>

          {product.requiresRx && (
            <div className="flex gap-3.5 rounded-[18px] bg-amber-tint px-[18px] py-4 text-[#5C3800]">
              <FileIcon size={22} className="mt-0.5 flex-none" />
              <div className="flex flex-col gap-1 text-sm leading-normal">
                <strong className="text-[15px]">Prescription required</strong>
                <span>
                  {whatsappOrders
                    ? "Add it to your cart and send a photo of a valid prescription in the WhatsApp chat when you order."
                    : "Add to cart now and upload a valid prescription at checkout."}{" "}
                  Our pharmacist verifies it before your order is packed.
                </span>
              </div>
            </div>
          )}

          {product.packSize && (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-bold">Pack size</span>
              <span className="flex min-h-14 flex-col justify-center gap-0.5 self-start rounded-[14px] border-2 border-brand bg-mint px-[18px] py-2.5">
                <span className="text-[15px] font-bold">{product.packSize}</span>
                <span className="text-[13px] text-muted">{formatPrice(product.pricePaise)}</span>
              </span>
            </div>
          )}

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="text-4xl font-extrabold tracking-[-0.02em]">{formatPrice(product.pricePaise)}</span>
            {off > 0 && (
              <>
                <span className="text-[17px] text-subtle line-through">MRP {formatPrice(product.mrpPaise)}</span>
                <span className="rounded-full bg-mint px-2.5 py-1 text-[13px] font-bold text-brand-dark">{off}% off</span>
              </>
            )}
            <span className="basis-full text-[13px] text-muted">Inclusive of all taxes</span>
          </div>

          <AddToCartButton
            productId={product.id}
            label={product.name}
            variant="full"
            disabled={!inStock}
            maxQuantity={Math.min(MAX_QTY_PER_ITEM, product.availableQty)}
          />
        </div>
      </div>

      {product.description && (
        <section className="flex flex-col gap-5 rounded-[28px] border border-line bg-white p-[clamp(20px,3vw,36px)]">
          <div className="flex max-w-[760px] flex-col gap-2.5">
            <h2 className="text-[22px] font-bold tracking-[-0.01em]">About this product</h2>
            <p className="text-base leading-[1.7] whitespace-pre-line text-ink-2">{product.description}</p>
          </div>
          <p className="border-t border-line pt-4 text-[13px] text-muted">
            General information only. Follow your doctor’s instructions and read the leaflet in the pack.
          </p>
        </section>
      )}

      {alternatives.length > 0 && (
        <section className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1">
            <h2 className="text-[clamp(24px,3vw,32px)] font-extrabold tracking-[-0.03em]">Same salt, other makers</h2>
            <p className="text-sm text-muted">
              Contain {product.composition}. Ask your doctor or our pharmacist before switching brands.
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            {alternatives.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/product/${a.slug}`}
                  className="flex items-center gap-3.5 rounded-[20px] border border-line bg-white p-4 text-ink hover:border-brand hover:text-ink"
                >
                  <ProductThumb id={a.id} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <strong className="text-[15px]">{a.name}</strong>
                    <span className="text-[13px] text-muted">
                      {[a.manufacturer, a.packSize].filter(Boolean).join(" · ")}
                      {!a.inStock && " · Out of stock"}
                    </span>
                  </span>
                  <strong className="text-base">{formatPrice(a.pricePaise)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
