import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { Button, Panel } from "@/components/ui";

export const metadata = { title: "Sign in" };

async function discordSignIn() {
  "use server";
  try {
    await signIn("discord", { redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=discord");
    }
    throw error;
  }
}

async function devSignIn(formData: FormData) {
  "use server";
  try {
    await signIn("dev-credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=credentials");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const discordConfigured = Boolean(
    process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET,
  );
  const devLogin =
    process.env.ENABLE_DEV_LOGIN === "true" || process.env.NODE_ENV !== "production";

  return (
    <div className="shell stack" style={{ maxWidth: 560 }}>
      <header className="stack" style={{ gap: "0.5rem" }}>
        <h1 className="display" style={{ margin: 0 }}>
          Sign in
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          Discord is the primary login for MaddenHQ. After you sign in, create a league,
          then connect EA to sync Madden data.
        </p>
      </header>

      {params.error ? (
        <p className="panel" style={{ borderColor: "var(--accent)", color: "var(--accent)" }}>
          Sign-in failed. Check your credentials or Discord app settings.
        </p>
      ) : null}

      <Panel>
        {discordConfigured ? (
          <form action={discordSignIn}>
            <Button type="submit" variant="accent" style={{ width: "100%" }}>
              Continue with Discord
            </Button>
          </form>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Discord OAuth is not configured. Set <code>DISCORD_CLIENT_ID</code> and{" "}
            <code>DISCORD_CLIENT_SECRET</code> in <code>.env</code>.
          </p>
        )}

        {devLogin ? (
          <>
            <hr style={{ border: 0, borderTop: "1px solid var(--primary-border)", margin: 0 }} />
            <p className="muted" style={{ margin: 0 }}>
              Local/dev credentials (seeded by <code>npm run db:seed</code>):
            </p>
            <form action={devSignIn} className="form-grid">
              <label>
                Email
                <input
                  name="email"
                  type="email"
                  defaultValue={process.env.DEV_LOGIN_EMAIL ?? "dev@maddenhq.local"}
                  required
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <Button type="submit" variant="primary">
                Dev sign in
              </Button>
            </form>
          </>
        ) : null}
      </Panel>
    </div>
  );
}
