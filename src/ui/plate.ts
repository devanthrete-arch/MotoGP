// Indian vehicle registration numbers, as typed on a number plate.
// Two shapes are recognised:
//   state series   MH 12 AB 1234   state code, RTO number, optional series letters, four digits
//   Bharat series  22 BH 1234 AA   year, BH, four digits, one or two letters (never I or O)
// Anything else is left for manual entry rather than guessed at.

// States and union territories, including codes that were replaced but still appear on plates.
const stateCodes = new Set([
  "AN", "AP", "AR", "AS", "BR", "CG", "CH", "DD", "DL", "DN", "GA", "GJ", "HP", "HR", "JH", "JK", "KA", "KL",
  "LA", "LD", "MH", "ML", "MN", "MP", "MZ", "NL", "OD", "OR", "PB", "PY", "RJ", "SK", "TN", "TR", "TS", "TG",
  "UA", "UK", "UP", "WB",
]);

export type RegistrationProblem = "empty" | "incomplete" | "unknown-state" | "format";

export type ParsedRegistration =
  | { ok: true; kind: "state" | "bharat"; normalized: string; display: string; stateCode: string | null }
  | { ok: false; problem: RegistrationProblem };

const compact = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

// Spaces between runs of letters and digits, the way a plate is read aloud. Works on partial
// input, so it can format while someone is still typing.
export function formatRegistrationInput(input: string): string {
  return (compact(input).slice(0, 11).match(/[A-Z]+|[0-9]+/g) ?? []).join(" ");
}

export function parseRegistration(input: string): ParsedRegistration {
  const value = compact(input);
  if (!value) return { ok: false, problem: "empty" };

  const bharat = /^([0-9]{2})BH([0-9]{4})([A-HJ-NP-Z]{1,2})$/.exec(value);
  if (bharat) {
    // The series began in 2021 and no register issues the number 0000.
    if (Number(bharat[1]) < 21 || bharat[2] === "0000") return { ok: false, problem: "format" };
    return { ok: true, kind: "bharat", normalized: value, display: `${bharat[1]} BH ${bharat[2]} ${bharat[3]}`, stateCode: null };
  }

  // The number is always four digits on the plate ("0007"), which is also what keeps a
  // half-typed plate such as MH12 from reading as a complete one.
  const state = /^([A-Z]{2})([0-9]{1,2})([A-Z]{0,3})([0-9]{4})$/.exec(value);
  if (state) {
    const [, code, office, series, number] = state;
    if (!stateCodes.has(code)) return { ok: false, problem: "unknown-state" };
    // No RTO is numbered zero and no register issues the number 0000.
    if (Number(office) === 0 || number === "0000") return { ok: false, problem: "format" };
    return {
      ok: true, kind: "state", stateCode: code, normalized: value,
      display: [code, office, series, number].filter(Boolean).join(" "),
    };
  }

  // Still a plausible beginning of either shape: say "keep going", not "wrong".
  const beginning = /^([A-Z]{1,2}([0-9]{1,2}([A-Z]{0,3}[0-9]{0,3})?)?|[0-9]{1,2}(B(H[0-9]{0,4})?)?)$/.test(value);
  if (beginning && /^[A-Z]{2}/.test(value) && !stateCodes.has(value.slice(0, 2))) return { ok: false, problem: "unknown-state" };
  return { ok: false, problem: beginning ? "incomplete" : "format" };
}

export const registrationProblemText: Record<RegistrationProblem, string> = {
  empty: "Enter the registration number from the plate.",
  incomplete: "Keep going — a full number ends in four digits, such as 0007.",
  "unknown-state": "That state code is not one we recognise. Check the first two letters.",
  format: "That does not look like a registration number. Try the format MH 12 AB 1234.",
};
