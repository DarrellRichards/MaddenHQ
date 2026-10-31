import Image from "next/image";
import Link from "next/link";

const steps = [
  {
    n: "01",
    title: "Connect EA",
    copy: "Commissioners link Companion OAuth. Rosters, schedules, and scores sync into your league HQ.",
  },
  {
    n: "02",
    title: "Invite owners",
    copy: "Members sign in with Discord, claim a team, and see standings, box scores, and trade history.",
  },
  {
    n: "03",
    title: "Advance the week",
    copy: "Pull the latest week. Rule-based awards and trade grades update — AI hooks ready when you want them.",
  },
] as const;

const features = [
  {
    title: "Live scores & boxes",
    copy: "Week-by-week results with box scores pulled from EA sync.",
  },
  {
    title: "Leaderboards",
    copy: "Passing, rushing, receiving, defense, and fantasy-style leaders.",
  },
  {
    title: "Trade grades",
    copy: "Rule-based fairness scores with a stable API for future AI models.",
  },
  {
    title: "Weekly awards",
    copy: "Player and game of the week from real stats — Discord-ready announcements.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="landing">
      <section className="landing-hero" aria-label="MaddenHQ">
        <div className="landing-hero__glow" aria-hidden />
        <div className="landing-hero__inner">
          <Image
            src="/brand/maddenhq-logo.png"
            alt="MaddenHQ"
            width={840}
            height={180}
            className="landing-hero__logo"
            priority
          />
          <h1 className="landing-hero__headline">
            Your league.
            <br />
            Your data.
            <br />
            Your community.
          </h1>
          <p className="landing-hero__support">
            Open-source CFM HQ — EA sync, standings, trade grades, and weekly awards
            built for commissioners.
          </p>
          <div className="landing-hero__ctas">
            <Link href="/login" className="btn btn--accent">
              Get started
            </Link>
            <a
              href="https://github.com/DarrellRichards/MaddenHQ"
              className="btn btn--ghost"
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section--light" aria-labelledby="how-heading">
        <div className="landing-section__inner">
          <p className="landing-kicker">Up and running</p>
          <h2 id="how-heading" className="landing-title">
            Three steps. No spreadsheets.
          </h2>
          <ol className="landing-steps">
            {steps.map((step) => (
              <li key={step.n} className="landing-step">
                <span className="landing-step__n">{step.n}</span>
                <h3 className="landing-step__title">{step.title}</h3>
                <p className="landing-step__copy">{step.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="landing-section landing-section--soft" aria-labelledby="features-heading">
        <div className="landing-section__inner">
          <p className="landing-kicker">Built for CFM</p>
          <h2 id="features-heading" className="landing-title">
            Everything after the whistle.
          </h2>
          <p className="landing-lede">
            Scores, leaders, awards, and trades in one open-source HQ — not a locked
            spreadsheet.
          </p>
          <ul className="landing-features">
            {features.map((feature) => (
              <li key={feature.title} className="landing-feature">
                <h3 className="landing-feature__title">{feature.title}</h3>
                <p className="landing-feature__copy">{feature.copy}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="landing-closer" aria-labelledby="closer-heading">
        <div className="landing-closer__inner">
          <h2 id="closer-heading" className="landing-closer__title">
            Ready to run a better league?
          </h2>
          <p className="landing-closer__copy">
            Free and open source. Donations keep hosting and AI features going.
          </p>
          <div className="landing-closer__ctas">
            <Link href="/login" className="btn btn--accent">
              Start your league
            </Link>
            <Link href="/donate" className="btn btn--outline">
              Support the project
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
