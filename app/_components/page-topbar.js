export default function PageTopbar({ eyebrow, title, action }) {
  return (
    <section className="request-topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="font-display">{title}</h1>
      </div>
      {action || null}
    </section>
  );
}
