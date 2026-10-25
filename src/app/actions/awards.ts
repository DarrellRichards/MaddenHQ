"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  persistSeasonAwards,
  suggestSeasonAwards,
} from "@/server/awards/season";
import {
  persistWeeklyAwards,
  suggestWeeklyAwards,
} from "@/server/awards/weekly";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

async function requireCommissioner(leagueId: string, userId: string) {
  const membership = await prisma.leagueMembership.findUnique({
    where: { leagueId_userId: { leagueId, userId } },
  });
  if (
    !membership ||
    (membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.COMMISSIONER)
  ) {
    throw new Error("Only commissioners can generate awards");
  }
}

export async function generateWeeklyAwardsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const weekId = String(formData.get("weekId") ?? "");

  try {
    await requireCommissioner(leagueId, session.user.id);
    const suggestions = await suggestWeeklyAwards({ leagueId, weekId });
    await persistWeeklyAwards({ leagueId, weekId, suggestions });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message =
      error instanceof Error ? error.message.slice(0, 280) : "Awards failed";
    redirect(
      `/leagues/${slug}/awards?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/leagues/${slug}/awards`);
  redirect(`/leagues/${slug}/awards?saved=weekly`);
}

export async function generateSeasonAwardsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const seasonId = String(formData.get("seasonId") ?? "");

  try {
    await requireCommissioner(leagueId, session.user.id);
    const suggestions = await suggestSeasonAwards({ leagueId, seasonId });
    await persistSeasonAwards({ leagueId, seasonId, suggestions });
  } catch (error) {
    if (isNextRedirect(error)) throw error;
    const message =
      error instanceof Error ? error.message.slice(0, 280) : "Awards failed";
    redirect(
      `/leagues/${slug}/awards?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/leagues/${slug}/awards`);
  redirect(`/leagues/${slug}/awards?saved=season`);
}
