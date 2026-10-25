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
 * does not pull the EA Blaze transport into the shared action module graph.
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
    // Dynamic import keeps Blaze transport out of any shared action module graph.
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
    const raw =
      error instanceof Error
        ? error.message
        : "Sync failed. Try again in a few minutes.";
    const message = /1073807360|ERR_SYSTEM|unusually high server load/i.test(raw)
      ? "EA Blaze is under high load (roster/stats export). Wait a minute and try Sync current week, or retry full season later."
      : raw.slice(0, 280);
    redirect(
      `/leagues/${slug}/sync?error=${encodeURIComponent(message)}`,
    );
  }

  revalidatePath(`/leagues/${slug}`);
  redirect(`/leagues/${slug}/sync`);
}
