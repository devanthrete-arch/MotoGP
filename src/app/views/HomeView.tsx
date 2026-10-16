import { lazy, Suspense } from "react";
import { ArrowRight, Bike, BookOpen, Box, CarFront, CirclePlus, Fuel, MessageCircle, Scale, ShieldCheck, Wrench } from "lucide-react";
import { Link } from "react-router";
import { isSharedPost } from "../../communityCloud";
import guideCatalog from "../../../content/guides/catalog.json";
import { formatMoney } from "../../insights";
import { viewPaths } from "../model";
import { useOtofolks } from "../state";
import "./HomeView.css";

const HomeGarageScene = lazy(() => import("../../vehicles/HomeGarageScene"));

export function HomeView() {
  const { garage, garageReminders, garageCostLedger, timeline, feedPosts, handleFeatureNav, setMode, setQuery } = useOtofolks();
  const vehicle = garage[0];
  const loggedSpend = garageCostLedger.reduce((total, item) => total + item.totalSpend, 0);
  const latestSharedPosts = feedPosts.filter((post) => isSharedPost(post.id)).slice(0, 2);
  const tools = [
    { href: `${viewPaths.garage}#garage-reminders`, label: "Service & reminders", detail: "Keep important dates in view", icon: Wrench },
    { href: `${viewPaths.garage}#garage-costs`, label: "Fuel & expenses", detail: "Know what your vehicle costs", icon: Fuel },
    { href: viewPaths["find-car"], label: "Find a vehicle", detail: "Explore options for your needs", icon: CarFront },
    { href: viewPaths.compare, label: "Compare vehicles", detail: "See the details side by side", icon: Scale },
    { href: viewPaths.showroom, label: "Virtual showroom", detail: "Walk around cars in 3D", icon: Box },
  ];

  return (
    <section className="home-view member-home" aria-label="Home">
      <header className="member-home__intro">
        <div><p className="eyebrow">YOUR OTOFOLKS</p><h1>Your journey, made easier.</h1><p>Simple tools and helpful advice for every day of vehicle ownership.</p></div>
        <Link className="ui-button ui-button--primary" to={viewPaths["owner-onboarding"]} onClick={handleFeatureNav}>
          <CirclePlus size={18} aria-hidden="true" /> Add a vehicle
        </Link>
      </header>

      <section className={`member-home__garage-hero${vehicle ? " has-vehicle" : ""}`} aria-labelledby="home-garage-title">
        <div className="member-home__garage-copy">
          <p className="member-home__kicker"><span /> MY GARAGE</p>
          <h2 id="home-garage-title">{vehicle ? vehicle.nickname || `${vehicle.brand} ${vehicle.model}` : "Your garage starts here."}</h2>
          <p>{vehicle ? `${vehicle.brand} ${vehicle.model}${vehicle.manufactureYear ? ` · ${vehicle.manufactureYear}` : ""} · Your vehicle, care history and reminders in one place.` : "Add your car or bike to keep its details, service history and reminders together."}</p>
          <Link to={vehicle ? viewPaths.garage : viewPaths["owner-onboarding"]} onClick={handleFeatureNav}>
            {vehicle ? "Vehicle details" : "Add your vehicle"}<ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="member-home__garage-stage" aria-label={vehicle ? `Interactive generic 3D ${vehicle.kind === "two-wheeler" ? "motorcycle" : "car"} preview for ${vehicle.brand} ${vehicle.model}` : "Empty garage"}>
          {vehicle ? <>
            <Suspense fallback={<div className="member-home__scene-loading" role="status"><span />Preparing your garage</div>}>
              <HomeGarageScene kind={vehicle.kind === "two-wheeler" ? "two-wheeler" : "car"} paint={vehicle.colour} />
            </Suspense>
            <span className="member-home__model-note">Original generic 3D shape · not a model replica</span>
            <div className="member-home__stage-actions" aria-label="Garage shortcuts">
              <Link to={viewPaths.garage} onClick={handleFeatureNav}><CarFront size={15} aria-hidden="true" /> Details</Link>
              <Link to={`${viewPaths.garage}#garage-reminders`} onClick={handleFeatureNav}><Wrench size={15} aria-hidden="true" /> Service history</Link>
            </div>
          </> : <div className="member-home__empty-stage">
            <span className="member-home__empty-orbit" aria-hidden="true"><CarFront size={72} strokeWidth={1} /></span>
            <Link to={viewPaths["owner-onboarding"]} onClick={handleFeatureNav}><CirclePlus size={17} aria-hidden="true" /> Add your vehicle</Link>
          </div>}
        </div>
        {garage.length > 1 ? <div className="member-home__garage-summary">
          {garage.slice(0, 2).map((vehicle) => {
            const Icon = vehicle.kind === "two-wheeler" ? Bike : CarFront;
            const latest = timeline.find((entry) => entry.vehicleId === vehicle.id);
            return <Link to={viewPaths.garage} onClick={handleFeatureNav} className="member-home__vehicle" key={vehicle.id}>
              <span className="member-home__vehicle-icon"><Icon size={22} aria-hidden="true" /></span>
              <span className="member-home__vehicle-name"><small>{vehicle.brand}</small><strong>{vehicle.nickname || `${vehicle.brand} ${vehicle.model}`}</strong><small>{vehicle.odometerKm.toLocaleString("en-IN")} km{latest ? ` · ${latest.kind} logged` : ""}</small></span>
              <ArrowRight size={17} aria-hidden="true" />
            </Link>;
          })}
          {garage.length > 2 ? <Link className="member-home__more" to={viewPaths.garage} onClick={handleFeatureNav}>See all {garage.length} vehicles</Link> : null}
        </div> : null}
        {!garage.length ? <span className="member-home__hero-note"><ShieldCheck size={16} aria-hidden="true" /> Your vehicle details stay in your account</span> : null}
      </section>

      <section className="member-home__tools" aria-labelledby="home-tools-title">
        <div className="member-home__section-head"><div><p className="eyebrow">HERE WHEN YOU NEED THEM</p><h2 id="home-tools-title">Quick ownership tools</h2></div></div>
        <div className="member-home__tool-list">{tools.map(({ href, label, detail, icon: Icon }) =>
          <Link to={href} onClick={handleFeatureNav} key={label}>
            <span className="member-home__tool-icon"><Icon size={21} aria-hidden="true" /></span>
            <span><strong>{label}</strong><small>{detail}</small></span><ArrowRight size={17} aria-hidden="true" />
          </Link>)}</div>
      </section>

      {garage.length ? <section className="member-home__snapshot" aria-label="Garage overview">
        <Link to={`${viewPaths.garage}#garage-reminders`} onClick={handleFeatureNav}><span className="member-home__snapshot-icon"><Wrench size={19} aria-hidden="true" /></span><span><strong>{garageReminders.length}</strong><small>Reminders</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
        <Link to={`${viewPaths.garage}#garage-costs`} onClick={handleFeatureNav}><span className="member-home__snapshot-icon"><Fuel size={19} aria-hidden="true" /></span><span><strong>{formatMoney(loggedSpend)}</strong><small>Logged expenses</small></span><ArrowRight size={16} aria-hidden="true" /></Link>
      </section> : null}

      <section className="member-home__guides" aria-labelledby="home-guides-title">
        <div className="member-home__section-head"><div><p className="eyebrow">GOOD TO KNOW</p><h2 id="home-guides-title">Care for your vehicle</h2></div><Link to={viewPaths.guides} onClick={handleFeatureNav}>All guides <ArrowRight size={16} aria-hidden="true" /></Link></div>
        <div className="member-home__guide-list">{guideCatalog.slice(0, 3).map((guide) =>
          <Link className="member-home__guide" to={`${viewPaths.guides}/${guide.slug}`} key={guide.slug} onClick={handleFeatureNav}>
            {"image" in guide && guide.image ? <img src={guide.image} alt="" loading="lazy" width="1600" height="900" /> : <span className="member-home__guide-mark"><BookOpen size={25} aria-hidden="true" /></span>}
            <span className="member-home__guide-meta">{guide.topic} <i /> {guide.minutes} min</span><strong>{guide.title}</strong><span className="member-home__guide-desc">{guide.description}</span>
          </Link>)}</div>
      </section>

      <section className="member-home__community" aria-labelledby="home-community-title">
        <div className="member-home__section-head"><div><p className="eyebrow">BETTER, TOGETHER</p><h2 id="home-community-title">From the community</h2></div>
          <Link to={viewPaths.feed} onClick={(event) => { handleFeatureNav(event); setMode("latest"); setQuery(""); }}>Visit community <ArrowRight size={16} aria-hidden="true" /></Link></div>
        {latestSharedPosts.length ? <div className="member-home__post-list">{latestSharedPosts.map((post) => <article key={post.id}><span>{post.label} · {post.brand} {post.model}</span><h3>{post.title}</h3><p>{post.body}</p></article>)}</div> : <Link className="member-home__community-empty" to={viewPaths.feed} onClick={handleFeatureNav}><MessageCircle size={23} aria-hidden="true" /><span><strong>Real experiences from vehicle owners</strong><small>Browse practical tips, reviews and helpful answers.</small></span><ArrowRight size={17} aria-hidden="true" /></Link>}
      </section>
    </section>
  );
}
