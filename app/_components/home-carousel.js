"use client";

import { useEffect, useState } from "react";

const slides = [
  "https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=2200&q=90",
  "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=2200&q=90",
  "https://images.unsplash.com/photo-1564694202779-bc908c327862?auto=format&fit=crop&w=2200&q=90",
];

export default function HomeCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="hero-carousel home-hero-carousel" aria-label="Church bus image carousel">
      <div
        id="heroCarouselTrack"
        className="hero-carousel-track"
        style={{ backgroundImage: `url('${slides[index]}')` }}
        data-slides={JSON.stringify(slides)}
      >
        <div className="home-glass-card">
          <div className="home-brand">
            <img src="/pcglogo.png" alt="Presbyterian Church of Ghana logo" className="home-brand-logo" />
            <div>
              <p className="home-kicker">Christ Congregation Adenta</p>
              <p className="home-subbrand">Church transport desk</p>
            </div>
          </div>

          <div className="home-card-copy">
            <p className="home-label">Bus reservation</p>
            <h1>Bus Reservation.</h1>
          </div>

          <a className="home-check-button" href="/availability">
            Check Booking Availability
          </a>

          <p className="home-footnote">
            Dependable transport for ministry, outreach, fellowship and approved external events.
          </p>

          <div id="pageNotice" className="form-message page-notice" aria-live="polite" hidden />
        </div>
      </div>
    </section>
  );
}
