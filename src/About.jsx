function About() {
  return (
    <section className="page-shell about-page">
      <p className="section-kicker">WHY NETWISE EXISTS</p>
      <h1>The internet is easier to understand when you can <span>see it.</span></h1>
      <p className="about-copy">
        Netwise is a small, approachable space to explore computer networking. No jargon-heavy lectures or complicated setup—just clear explanations and a hands-on simulator to help the ideas click.
      </p>
      <a className="button button-primary" href="/simulator">Explore the simulator <span aria-hidden="true">→</span></a>
    </section>
  );
}

export default About;
