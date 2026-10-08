// Home: shortcuts into each area.
import { ArrowRight, Bookmark, Car, MessageCircle, Play, Scale } from "lucide-react";
import { useOtofolks } from "../state";

export function HomeView() {
  const { setQuery, setMode, activeView, shouldShowFeatures, handleFeatureNav } = useOtofolks();
  return (
    <section className="home-view" hidden={activeView !== "top"} aria-label="Home">
      <div className="home-heading">
        <p className="eyebrow">Your car companion</p>
        <h1>A little help for every drive.</h1>
        <p>Real owners. Useful advice. Happier kilometres.</p>
      </div>
      <div className="home-shortcuts">
        {[
          { id: "garage", label: "My garage", detail: "Vehicles and maintenance", icon: Car },
          { id: "feed", label: "Ask the community", detail: "Advice from fellow owners", icon: MessageCircle },
          { id: "pit-stop", label: "Take a Pit Stop", detail: "Car stories and inspiration", icon: Play },
          { id: "compare", label: "Find your next car", detail: "Compare your favourites", icon: Scale },
          { id: "feed", label: "Saved advice", detail: "Good tips, kept close", icon: Bookmark },
        ].map(({ id, label, detail, icon: Icon }) => (
          <a className="home-shortcut" href={`#${id}`} key={label} onClick={(event) => {
            handleFeatureNav(event);
            if (id === "feed" && shouldShowFeatures) { setMode(label === "Saved advice" ? "saved" : "latest"); setQuery(""); }
          }}>
            <Icon size={25} aria-hidden="true" />
            <h2>{label}</h2><p>{detail}</p>
            <ArrowRight size={18} aria-hidden="true" className="shortcut-arrow" />
          </a>
        ))}
      </div>
      <div className="owner-topics">
        <h2>What is on your mind?</h2>
        <div className="topic-links">
          {["Service costs", "Tyres", "Mileage", "Road trips"].map((topic) => (
            <a href="#feed" key={topic} onClick={(event) => {
              handleFeatureNav(event);
              if (shouldShowFeatures) { setQuery(topic === "Service costs" ? "service" : topic); setMode("latest"); }
            }}>{topic}<ArrowRight size={16} aria-hidden="true" /></a>
          ))}
        </div>
      </div>
      <div className="service-coming">
        <div><span className="eyebrow">Coming to Otofolks</span><h2>Car care, all together.</h2>
          <p>Service bookings are on the way. Track your vehicles in My garage today.</p></div>
        <div className="service-screens">
          <img src="/app-screens/service-home.png" alt="Preview of the upcoming Otofolks service home" />
          <img src="/app-screens/provider-about.png" alt="Preview of service provider details" />
          <img src="/app-screens/booking-schedule.png" alt="Preview of service scheduling" />
        </div>
      </div>
    </section>
  );
}
