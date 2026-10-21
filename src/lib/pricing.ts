// Shelf prices in India are GST-inclusive, so GST is the tax *contained in* each line, not added on top.

export type PricedLine = { unitPricePaise: number; quantity: number; gstRate: number };

export function lineTotalPaise(line: PricedLine): number {
  return line.unitPricePaise * line.quantity;
}

/** GST contained in a GST-inclusive amount, e.g. ₹105 at 5% contains ₹5. */
export function includedGstPaise(inclusivePaise: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0;
  return Math.round((inclusivePaise * ratePercent) / (100 + ratePercent));
}

export function orderTotals(lines: PricedLine[], deliveryFeePaise: number) {
  const subtotalPaise = lines.reduce((sum, l) => sum + lineTotalPaise(l), 0);
  const gstPaise = lines.reduce((sum, l) => sum + includedGstPaise(lineTotalPaise(l), l.gstRate), 0);
  return { subtotalPaise, gstPaise, deliveryFeePaise, totalPaise: subtotalPaise + deliveryFeePaise };
}
