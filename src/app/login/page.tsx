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
    <div className="shell shell--narrow stack">
      <header className="stack stack--tight">
        <h1 className="display page-title">Sign in</h1>
        <p className="muted">
          Discord is the primary login for MaddenHQ. After you sign in, create a league,
          then connect EA to sync Madden data.
        </p>
      </header>

      {params.error ? (
        <Panel tone="alert">
          Sign-in failed. Check your credentials or Discord app settings.
        </Panel>
      ) : null}

      <Panel>
        {discordConfigured ? (
          <form action={discordSignIn}>
            <Button type="submit" variant="accent" className="btn--block">
              Continue with Discord
            </Button>
          </form>
        ) : (
          <p className="muted">
            Discord OAuth is not configured. Set <code>DISCORD_CLIENT_ID</code> and{" "}
            <code>DISCORD_CLIENT_SECRET</code> in <code>.env</code>.
          </p>
        )}

        {devLogin ? (
          <>
            <hr className="rule" />
            <p className="muted">
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
