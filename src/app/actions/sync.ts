"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

/**
 * Kept in a separate server-actions module from league create so the dashboard
 * does not pull the EA/undici stack into the client module graph.
 */
export async function triggerSyncAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const leagueId = String(formData.get("leagueId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const scopeRaw = String(formData.get("scope") ?? "all");
  const scope = scopeRaw === "week" ? "week" : "all";
  const weekNumberRaw = String(formData.get("weekNumber") ?? "").trim();
  const weekNumber = weekNumberRaw ? Number(weekNumberRaw) : undefined;

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: { leagueId, userId: session.user.id },
    },
  });

  if (
    !membership ||
    (membership.role !== MembershipRole.OWNER &&
      membership.role !== MembershipRole.COMMISSIONER)
  ) {
    throw new Error("Only commissioners can sync");
  }

  try {
    // Dynamic import keeps undici/Blaze out of any shared action module graph.
    const { syncLeagueFromEa } = await import("@/server/ea/sync");
    await syncLeagueFromEa(leagueId, {
      scope,
      weekNumber:
        weekNumber != null && Number.isFinite(weekNumber) ? weekNumber : undefined,
    });
  } catch (error) {
    if (isNextRedirect(error)) {
      throw error;
    }
    const message =
      error instanceof Error
        ? error.message.slice(0, 280)
        : "Sync failed. Try again in a few minutes.";
    redirect(
      `/leagues/${slug}/sync?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/leagues/${slug}`);
  redirect(`/leagues/${slug}/sync`);
}
