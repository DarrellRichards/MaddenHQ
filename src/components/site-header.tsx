import Image from "next/image";
import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui";

export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="site-header__brand" aria-label="MaddenHQ home">
          <Image
            src="/brand/maddenhq-logo.png"
            alt="MaddenHQ"
            width={180}
            height={40}
            className="site-header__logo"
            priority
          />
        </Link>
        <nav className="site-header__nav" aria-label="Primary">
          <Link href="/dashboard">Leagues</Link>
          <Link href="/donate">Donate</Link>
          <a
            href="https://github.com/DarrellRichards/MaddenHQ"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
          {session?.user ? (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <Button type="submit" variant="ghost">
                Sign out
              </Button>
            </form>
          ) : (
            <Link href="/login" className="btn btn--accent">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
