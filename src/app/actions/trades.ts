"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole, TradeStatus } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { evaluateAndPersistTrade } from "@/server/trades/evaluate";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function createTradeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const fromTeamId = String(formData.get("fromTeamId") ?? "");
  const toTeamId = String(formData.get("toTeamId") ?? "");
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const fromPlayerIds = formData.getAll("fromPlayerIds").map(String).filter(Boolean);
  const toPlayerIds = formData.getAll("toPlayerIds").map(String).filter(Boolean);
  const fromPick = String(formData.get("fromPick") ?? "").trim();
  const toPick = String(formData.get("toPick") ?? "").trim();

  try {
    const membership = await prisma.leagueMembership.findUnique({
      where: {
        leagueId_userId: { leagueId, userId: session.user.id },
      },
    });
    if (!membership) {
      throw new Error("Join this league before proposing trades");
    }

    if (!fromTeamId || !toTeamId || fromTeamId === toTeamId) {
      throw new Error("Pick two different teams");
    }
    if (
      fromPlayerIds.length === 0 &&
      toPlayerIds.length === 0 &&
      !fromPick &&
      !toPick
    ) {
      throw new Error("Add at least one player or pick");
    }

    const trade = await prisma.trade.create({
      data: {
        leagueId,
        proposerId: session.user.id,
        status: TradeStatus.PROPOSED,
        notes,
        assets: {
          create: [
            ...fromPlayerIds.map((playerId) => ({
              side: "from",
              teamId: fromTeamId,
              playerId,
            })),
            ...toPlayerIds.map((playerId) => ({
              side: "to",
              teamId: toTeamId,
              playerId,
            })),
            ...(fromPick
              ? [{ side: "from", teamId: fromTeamId, pickDesc: fromPick }]
              : []),
            ...(toPick
              ? [{ side: "to", teamId: toTeamId, pickDesc: toPick }]
              : []),
          ],
        },
      },
    });

    await evaluateAndPersistTrade(trade.id);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message =
      error instanceof Error ? error.message.slice(0, 280) : "Trade failed";
    redirect(
      `/leagues/${slug}/trades?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/leagues/${slug}/trades`);
  redirect(`/leagues/${slug}/trades?created=1`);
}

export async function reevaluateTradeAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const tradeId = String(formData.get("tradeId") ?? "");

  try {
    const membership = await prisma.leagueMembership.findUnique({
      where: {
        leagueId_userId: { leagueId, userId: session.user.id },
      },
    });
    if (
      !membership ||
      (membership.role !== MembershipRole.OWNER &&
        membership.role !== MembershipRole.COMMISSIONER &&
        membership.role !== MembershipRole.MEMBER)
    ) {
      throw new Error("Not a league member");
    }
    await evaluateAndPersistTrade(tradeId);
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message =
      error instanceof Error ? error.message.slice(0, 280) : "Re-evaluate failed";
    redirect(
      `/leagues/${slug}/trades?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/leagues/${slug}/trades`);
  redirect(`/leagues/${slug}/trades`);
}
