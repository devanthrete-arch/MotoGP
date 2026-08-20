/**
 * Identity rules for the two things the whole product keys on: a model and a
 * city. Follows, playbooks, city circles, share links and the hosted tables all
 * agree because they all call these, so they live in `core` where every layer
 * can reach them.
 */
export function modelKeyFor(brand: string, model: string): string {
  return `${brand}-${model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function slugifyCity(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
