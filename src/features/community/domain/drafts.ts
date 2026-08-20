import { type DraftPost } from "../../../core";

/** The empty owner-note composer. Nothing is pre-filled on the owner's behalf
 * except the default brand the composer's select opens on. */
export const initialPostDraft: DraftPost = {
  title: "",
  author: "",
  brand: "Tata",
  model: "",
  variant: "",
  fuel: "",
  city: "",
  odometerKm: 0,
  label: "Owner note",
  topic: "Ownership review",
  body: "",
};
