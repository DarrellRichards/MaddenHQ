import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <section className="hero">
      <div className="hero__content">
        <Image
          src="/brand/maddenhq-logo.png"
          alt="MaddenHQ"
          width={840}
          height={180}
          className="hero__logo"
          priority
        />
        <h1>Your league. Your data. Your community.</h1>
        <p>
          Track every CFM across seasons, sync from EA, grade trades with AI, and
          crown weekly and yearly awards — open source and built for commissioners.
        </p>
        <div className="hero__ctas">
          <Link href="/login" className="btn btn--accent">
            Get started
          </Link>
          <Link href="/donate" className="btn btn--ghost">
            Donate
          </Link>
          <a
            href="https://github.com/DarrellRichards/MaddenHQ"
            className="btn btn--ghost"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </div>
    </section>
  );
}
