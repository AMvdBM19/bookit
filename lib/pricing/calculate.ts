export interface PricingSnapshot {
  baseRatePer30: number;
  tagExtrasTotal: number;
  totalPrice: number;
  staffPayout: number;
  agencyShare: number;
}

export interface PricingInput {
  baseRatePer30min: number;
  staffPayoutPct: number;
  agencySharePct: number;
  durationMinutes: number;
  tagExtras: number[];
}

export function calculatePricing(input: PricingInput): PricingSnapshot {
  const slots30 = input.durationMinutes / 30;
  const baseTotal = input.baseRatePer30min * slots30;
  const tagExtrasTotal = input.tagExtras.reduce((sum, e) => sum + e, 0);
  const totalPrice = baseTotal + tagExtrasTotal;
  const staffPayout = totalPrice * (input.staffPayoutPct / 100);
  const agencyShare = totalPrice - staffPayout;

  return {
    baseRatePer30: input.baseRatePer30min,
    tagExtrasTotal: round2(tagExtrasTotal),
    totalPrice: round2(totalPrice),
    staffPayout: round2(staffPayout),
    agencyShare: round2(agencyShare),
  };
}

export interface PayoutSummary {
  grossRevenue: number;
  staffPayout: number;
  agencyShare: number;
  taxAmount: number;
  netRevenue: number;
}

export function calculatePayout(
  totalPrice: number,
  staffPayoutPct: number,
  taxRatePct: number,
  btwExempt: boolean
): PayoutSummary {
  const staffPayout = round2(totalPrice * (staffPayoutPct / 100));
  const agencyShare = round2(totalPrice - staffPayout);
  const taxAmount = btwExempt ? 0 : round2(agencyShare * (taxRatePct / 100));
  const netRevenue = round2(agencyShare - taxAmount);

  return {
    grossRevenue: totalPrice,
    staffPayout,
    agencyShare,
    taxAmount,
    netRevenue,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
