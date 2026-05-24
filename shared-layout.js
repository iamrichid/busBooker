class PcgPageHeader extends HTMLElement {
  connectedCallback() {
    const eyebrow = this.getAttribute("eyebrow") || "";
    const title = this.getAttribute("title") || "";
    const topbarClass = this.getAttribute("topbar-class") || "";

    this.innerHTML = `
      <section class="member-brand-strip">
        <img src="/pcglogo.png" alt="Presbyterian Church of Ghana logo" class="member-brand-strip-logo" />
        <div class="member-brand-strip-copy">
          <p class="member-brand-strip-name">Presbyterian Church of Ghana</p>
          <p class="member-brand-strip-role">Christ Congregation Adentan</p>
        </div>
      </section>

      <section class="request-topbar ${topbarClass}">
        <div>
          <p class="eyebrow">${escapeHtml(eyebrow)}</p>
          <h1 class="font-display">${escapeHtml(title)}</h1>
        </div>
      </section>
    `;
  }
}

class PcgSiteFooter extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <footer class="site-footer">
        <div class="site-footer-inner">
          <div>
            <p class="site-footer-kicker">Contact</p>
            <h2>Presbyterian Church of Ghana, Christ Congregation Adentan</h2>
            <div class="site-footer-contact-list">
              <p class="site-footer-contact-row">
                <span>Church office</span>
                <a href="tel:+233262247767">026 224 7767</a>
                <a href="tel:+233242638289">024 263 8289</a>
                <a href="mailto:office.adentapresby@gmail.com">office.adentapresby@gmail.com</a>
              </p>
              <p class="site-footer-contact-row">
                <span>Transport desk</span>
                <a href="tel:+233243612760">+233 24 361 2760</a>
                <a href="mailto:adentapresby@gmail.com">adentapresby@gmail.com</a>
              </p>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

customElements.define("pcg-page-header", PcgPageHeader);
customElements.define("pcg-site-footer", PcgSiteFooter);
