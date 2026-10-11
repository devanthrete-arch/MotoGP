import { useEffect, useState } from "react";
import VehicleViewer from "./VehicleViewer";

type Props = { kind: "car" | "two-wheeler"; paint?: string };

export default function HomeGarageScene({ kind, paint }: Props) {
  const [motionAllowed, setMotionAllowed] = useState(false);
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setMotionAllowed(!preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  return <VehicleViewer
    paint={paint || "#5f8278"}
    shape={kind === "two-wheeler" ? "motorcycle" : "crossover"}
    autoRotate={motionAllowed}
    showControls={false}
  />;
}
