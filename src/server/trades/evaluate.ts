import type { Trade } from "@prisma/client";

export type TradeEvaluationResult = {
  score: number | null;
  summary: string;
  details?: Record<string, unknown>;
  model: string;
};

/**
 * AI trade valuation stub.
 * Future: score assets using ratings, contract, age, positional need, and draft capital.
 */
export async function evaluateTrade(trade: Trade): Promise<TradeEvaluationResult> {
  void trade;
  return {
    score: null,
    summary: "Trade evaluation AI is not enabled yet. Hook your model into evaluateTrade().",
    details: { status: "stub" },
    model: "stub",
  };
}
