import type { Trade, TradeAsset, Player, Team, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TradeEvaluationResult = {
  score: number | null;
  summary: string;
  details?: Record<string, unknown>;
  model: string;
};

type AssetWithRefs = TradeAsset & {
  player: Player | null;
  team: Team | null;
};

function assetValue(asset: AssetWithRefs): number {
  if (asset.player) {
    // Overall is the primary signal until contracts / need models land.
    return asset.player.overall ?? 70;
  }
  if (asset.pickDesc) {
    const roundMatch = asset.pickDesc.match(/(\d)(st|nd|rd|th)/i);
    const round = roundMatch ? Number(roundMatch[1]) : 4;
    // Rough draft capital: 1st≈90, 2nd≈75, 3rd≈60, later≈45
    return Math.max(35, 105 - round * 15);
  }
  return 40;
}

/**
 * Rule-based trade valuation.
 * Positive score = side `to` (receiving from proposer perspective assets labeled "to") is stronger.
 * Convention: assets with side `from` leave the proposer's club; `to` arrive.
 * Score = value(to) - value(from). Near 0 is fair.
 */
export async function evaluateTrade(trade: Trade): Promise<TradeEvaluationResult> {
  const full = await prisma.trade.findUnique({
    where: { id: trade.id },
    include: {
      assets: { include: { player: true, team: true } },
    },
  });

  if (!full) {
    return {
      score: null,
      summary: "Trade not found.",
      model: "rules-v1",
      details: { status: "missing" },
    };
  }

  if (full.assets.length === 0) {
    return {
      score: null,
      summary: "Add players or picks before evaluating.",
      model: "rules-v1",
      details: { status: "empty" },
    };
  }

  let fromValue = 0;
  let toValue = 0;
  const breakdown: Array<{ side: string; label: string; value: number }> = [];

  for (const asset of full.assets) {
    const value = assetValue(asset);
    const label = asset.player
      ? `${asset.player.firstName} ${asset.player.lastName} (${asset.player.position}, OVR ${asset.player.overall ?? "?"})`
      : (asset.pickDesc ?? "Unknown asset");
    breakdown.push({ side: asset.side, label, value });
    if (asset.side === "from") fromValue += value;
    else toValue += value;
  }

  const score = Number((toValue - fromValue).toFixed(1));
  let fairness: string;
  if (Math.abs(score) <= 3) fairness = "essentially even";
  else if (score > 0) fairness = "favors the side receiving `to` assets";
  else fairness = "favors the side receiving `from` assets";

  return {
    score,
    summary: `Rules grade: ${score > 0 ? "+" : ""}${score} (${fairness}). From ${fromValue.toFixed(0)} vs to ${toValue.toFixed(0)}.`,
    details: { fromValue, toValue, breakdown },
    model: "rules-v1",
  };
}

export async function evaluateAndPersistTrade(tradeId: string) {
  const trade = await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } });
  const result = await evaluateTrade(trade);
  const details = (result.details ?? undefined) as Prisma.InputJsonValue | undefined;
  await prisma.tradeEvaluation.upsert({
    where: { tradeId },
    create: {
      tradeId,
      score: result.score,
      summary: result.summary,
      details,
      model: result.model,
    },
    update: {
      score: result.score,
      summary: result.summary,
      details,
      model: result.model,
    },
  });
  return result;
}
