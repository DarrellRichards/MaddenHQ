export const metadata = { title: "Donate" };

export default function DonatePage() {
  const sponsors =
    process.env.NEXT_PUBLIC_GITHUB_SPONSORS_URL ??
    "https://github.com/sponsors/DarrellRichards";
  const stripe = process.env.STRIPE_DONATION_URL;

  return (
    <div className="shell stack" style={{ maxWidth: 720 }}>
      <h1 className="display">Support MaddenHQ</h1>
      <p className="muted">
        MaddenHQ is open source and free for leagues. Donations help cover hosting
        (AWS Postgres + compute), AI award/trade features, and community tooling.
      </p>

      <section className="panel stack">
        <h2 className="display" style={{ margin: 0, fontSize: "1.05rem" }}>
          GitHub Sponsors
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          Recurring or one-time support directly on the repository.
        </p>
        <a href={sponsors} className="btn btn--accent" target="_blank" rel="noreferrer">
          Sponsor on GitHub
        </a>
      </section>

      <section className="panel stack">
        <h2 className="display" style={{ margin: 0, fontSize: "1.05rem" }}>
          Site donation
        </h2>
        {stripe ? (
          <>
            <p className="muted" style={{ margin: 0 }}>
              One-time donation via Stripe Payment Link.
            </p>
            <a href={stripe} className="btn btn--primary" target="_blank" rel="noreferrer">
              Donate on the site
            </a>
          </>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Set <code>STRIPE_DONATION_URL</code> to enable an on-site Stripe Payment Link.
            Until then, GitHub Sponsors is the primary way to support the project.
          </p>
        )}
      </section>
    </div>
  );
}
