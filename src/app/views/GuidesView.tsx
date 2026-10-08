import DOMPurify from "dompurify";
import { marked } from "marked";
import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import guideCatalog from "../../../content/guides/catalog.json";
import { viewPaths } from "../model";

type Guide = (typeof guideCatalog)[number];
const guideBodies = import.meta.glob<string>("/content/guides/*.md", { query: "?raw", import: "default" });

export function GuidesView() {
  const { slug } = useParams();
  const guide = guideCatalog.find((entry) => entry.slug === slug);
  const [body, setBody] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = guide ? `${guide.title} · Otofolks` : "Care guides · Otofolks";
  }, [guide]);

  useEffect(() => {
    setBody("");
    setFailed(false);
    if (!guide) return;
    const load = guideBodies[`/content/guides/${guide.slug}.md`];
    if (!load) {
      setFailed(true);
      return;
    }
    let active = true;
    void load().then((markdown) => {
      if (active) setBody(DOMPurify.sanitize(marked.parse(markdown, { async: false })));
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [guide]);

  if (slug && !guide) return (
    <section className="guide-page" aria-labelledby="guide-missing-title">
      <h1 id="guide-missing-title">We could not find that guide</h1>
      <Link className="guide-back" to={viewPaths.guides}><ArrowLeft size={16} aria-hidden="true" /> All guides</Link>
    </section>
  );

  if (guide) return <GuideArticle guide={guide} body={body} failed={failed} />;

  return (
    <section className="guide-page" aria-labelledby="guide-index-title">
      <header className="guide-head">
        <p className="eyebrow"><BookOpen size={15} aria-hidden="true" /> Otofolks guides</p>
        <h1 id="guide-index-title">Care guides</h1>
        <p>Small, useful steps for looking after a vehicle in India.</p>
      </header>
      <div className="guide-list">
        {guideCatalog.map((item) => (
          <article className="guide-list-item" key={item.slug}>
            {"image" in item && item.image ? <Link className="guide-list-item__image" to={`${viewPaths.guides}/${item.slug}`} tabIndex={-1} aria-hidden="true">
              <img src={item.image} alt="" width="1600" height="900" fetchPriority="high" />
            </Link> : null}
            <div className="guide-list-item__body">
              <p className="guide-topic">{item.topic} · {item.minutes} min read</p>
              <h2><Link to={`${viewPaths.guides}/${item.slug}`}>{item.title}</Link></h2>
              <p>{item.description}</p>
              <Link className="guide-read" to={`${viewPaths.guides}/${item.slug}`}>Read guide <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>
          </article>
        ))}
      </div>
      <div className="guide-next">
        <Link className="ui-button ui-button--secondary" to={viewPaths.compare}>Compare cars</Link>
        <Link className="ui-button ui-button--ghost" to={viewPaths.top}>Home</Link>
      </div>
    </section>
  );
}

function GuideArticle({ guide, body, failed }: { guide: Guide; body: string; failed: boolean }) {
  return (
    <section className="guide-page" aria-labelledby="guide-title">
      <Link className="guide-back" to={viewPaths.guides}><ArrowLeft size={16} aria-hidden="true" /> All guides</Link>
      {"image" in guide && guide.image ? <img className="guide-hero" src={guide.image} alt={guide.imageAlt} width="1600" height="900" fetchPriority="high" /> : null}
      <header className="guide-article-head">
        <p className="guide-topic">{guide.topic} · {guide.minutes} min read</p>
        <h1 id="guide-title">{guide.title}</h1>
        <p>{guide.description}</p>
        <time dateTime={guide.publishedOn}>{new Date(`${guide.publishedOn}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</time>
      </header>
      {failed ? <p role="alert">This guide is unavailable right now. Try again when you are online.</p>
        : body ? <article className="guide-prose" dangerouslySetInnerHTML={{ __html: body }} />
          : <p role="status" aria-live="polite">Opening guide…</p>}
      <aside className="guide-next" aria-label="More from Otofolks">
        <p>Keep exploring</p>
        <Link className="ui-button ui-button--secondary" to={viewPaths.compare}>Compare cars</Link>
        <Link className="ui-button ui-button--ghost" to={viewPaths.guides}>More guides</Link>
      </aside>
    </section>
  );
}
