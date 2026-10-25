"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

export async function createLeagueAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim() || null;

  if (!name) {
    throw new Error("League name is required");
  }

  const baseSlug = slugify(name) || "league";
  const league = await createLeagueWithUniqueSlug({
    baseSlug,
    name,
    description: description || null,
    platform,
    userId: session.user.id,
  });

  revalidatePath("/dashboard");
  redirect(`/leagues/${league.slug}`);
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function createLeagueWithUniqueSlug(input: {
  baseSlug: string;
  name: string;
  description: string | null;
  platform: string | null;
  userId: string;
}) {
  const year = new Date().getFullYear();

  for (let attempt = 0; attempt < 8; attempt++) {
    const slug =
      attempt === 0
        ? input.baseSlug
        : `${input.baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    try {
      return await prisma.league.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          platform: input.platform,
          memberships: {
            create: {
              userId: input.userId,
              role: MembershipRole.OWNER,
            },
          },
          seasons: {
            create: {
              year,
              label: `${year} Season`,
              isCurrent: true,
            },
          },
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        continue;
      }
      throw error;
    }
  }

  throw new Error("Could not allocate a unique league slug");
}
