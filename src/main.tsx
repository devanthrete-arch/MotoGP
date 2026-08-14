import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PremiumAutoflex } from "./PremiumAutoflex";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PremiumAutoflex />
  </StrictMode>,
);