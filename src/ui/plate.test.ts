import { describe, expect, it } from "vitest";
import { formatRegistrationInput, parseRegistration, registrationProblemText } from "./plate";

describe("registration number", () => {
  it.each([
    ["mh12ab1234", "MH12AB1234", "MH 12 AB 1234"],
    ["  MH-12 ab 1234 ", "MH12AB1234", "MH 12 AB 1234"],
    ["KA01A1234", "KA01A1234", "KA 01 A 1234"],
    ["DL3CAB1234", "DL3CAB1234", "DL 3 CAB 1234"],
    ["KL011234", "KL011234", "KL 01 1234"],
    ["MH12AB0007", "MH12AB0007", "MH 12 AB 0007"],
    ["tg09xy0001", "TG09XY0001", "TG 09 XY 0001"],
  ])("reads state-series plate %s", (input, normalized, display) => {
    expect(parseRegistration(input)).toEqual({
      ok: true, kind: "state", normalized, display, stateCode: normalized.slice(0, 2),
    });
  });

  it("reads Bharat-series plates and refuses the letters they never use", () => {
    expect(parseRegistration("22bh1234aa")).toEqual({
      ok: true, kind: "bharat", normalized: "22BH1234AA", display: "22 BH 1234 AA", stateCode: null,
    });
    expect(parseRegistration("23 BH 0042 C")).toMatchObject({ ok: true, display: "23 BH 0042 C" });
    expect(parseRegistration("22BH1234AO")).toEqual({ ok: false, problem: "format" });
    expect(parseRegistration("22BH1234IA")).toEqual({ ok: false, problem: "format" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["M", "incomplete"],
    ["MH", "incomplete"],
    ["MH12", "incomplete"],
    ["MH12AB", "incomplete"],
    ["MH12AB7", "incomplete"],
    ["MH12AB123", "incomplete"],
    ["MH1212", "incomplete"],
    ["22", "incomplete"],
    ["22BH12", "incomplete"],
    ["22BH1234", "incomplete"],
    ["ZZ12AB1234", "unknown-state"],
    ["ZZ", "unknown-state"],
    ["MH12ABCD1234", "format"],
    ["MH123AB1234", "format"],
    ["1234567890", "format"],
    ["MH12AB12345", "format"],
    ["MH00AB1234", "format"],
    ["MH12AB0000", "format"],
    ["20BH1234AA", "format"],
    ["22BH0000AA", "format"],
  ])("explains what is wrong with %j", (input, problem) => {
    expect(parseRegistration(input)).toEqual({ ok: false, problem });
    expect(registrationProblemText[problem as keyof typeof registrationProblemText]).toMatch(/\w/);
  });

  it("groups letters and digits while typing and caps the length", () => {
    expect(formatRegistrationInput("m")).toBe("M");
    expect(formatRegistrationInput("mh1")).toBe("MH 1");
    expect(formatRegistrationInput("mh12a")).toBe("MH 12 A");
    expect(formatRegistrationInput("mh 12-ab.1234")).toBe("MH 12 AB 1234");
    expect(formatRegistrationInput("22bh1234aa")).toBe("22 BH 1234 AA");
    expect(formatRegistrationInput("MH12AB1234EXTRA")).toBe("MH 12 AB 1234 E");
    expect(formatRegistrationInput("")).toBe("");
  });

  it("round-trips: formatting a parsed plate parses to the same plate", () => {
    for (const plate of ["MH12AB1234", "DL3CAB1234", "22BH1234AA", "KL011234"]) {
      const parsed = parseRegistration(plate);
      if (!parsed.ok) throw new Error(`${plate} should parse`);
      expect(parseRegistration(formatRegistrationInput(parsed.normalized))).toEqual(parsed);
    }
  });
});
