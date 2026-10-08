import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parsePrivateWorkspace } from "./cloudWorkspace";
import type { ShortlistItem } from "./domain";
import { loadShortlist, loadVehiclePlates, saveShortlist, saveVehiclePlates, setStorageUser } from "./storage";
import {
  adoptVisitorShortlist, claimTab, forgetPlate, forgetVisitorData, loadOwnerOnboardingDraft, saveOwnerOnboardingDraft,
  type OwnerOnboardingDraft, type KeyValueStorage, loadVisitorShortlist,
  mergeShortlists, readMemberHint, readSigningIn, recallPlate, rememberPlate, saveVisitorShortlist, writeMemberHint,
  writeSigningIn,
} from "./visitor";

const memory = (): KeyValueStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
};
const blocked: KeyValueStorage = {
  getItem: () => { throw new Error("blocked"); },
  setItem: () => { throw new Error("blocked"); },
  removeItem: () => { throw new Error("blocked"); },
};
const car = (brand: string, model: string, extra: Partial<ShortlistItem> = {}): ShortlistItem => ({
  id: `shortlist-${brand}-${model}`.toLowerCase(), brand, model, budget: 900_000, status: "New", notes: "",
  variant: "Base", state: "Maharashtra", ...extra,
});

describe("the registration number a tab remembers", () => {
  it("keeps a whole number and gives it back in normalised form", () => {
    const tab = memory();
    expect(recallPlate(tab)).toBeNull();
    rememberPlate("MH12AB1234", tab);
    expect(recallPlate(tab)).toBe("MH12AB1234");
    forgetPlate(tab);
    expect(recallPlate(tab)).toBeNull();
    expect(tab.values.size).toBe(0);
  });

  it("ignores anything stored that is not a whole registration number", () => {
    const tab = memory();
    for (const stored of ["MH12", "<script>", "XX12AB1234", "", "MH 12 AB 1234 and more"]) {
      tab.values.set("otofolks.pending-plate.v1", stored);
      expect(recallPlate(tab), stored).toBeNull();
    }
    // A number stored with spaces or in lower case still comes back normalised.
    tab.values.set("otofolks.pending-plate.v1", "mh 12 ab 1234");
    expect(recallPlate(tab)).toBe("MH12AB1234");
  });

  it("does nothing, quietly, when storage is missing or blocked", () => {
    for (const storage of [null, blocked]) {
      expect(() => rememberPlate("MH12AB1234", storage)).not.toThrow();
      expect(recallPlate(storage)).toBeNull();
      expect(() => forgetPlate(storage)).not.toThrow();
      expect(() => saveVisitorShortlist([car("Tata", "Nexon")], storage)).not.toThrow();
      expect(loadVisitorShortlist(storage)).toEqual([]);
      expect(readMemberHint(storage)).toBe(false);
      expect(() => writeMemberHint(true, storage)).not.toThrow();
      expect(readSigningIn(storage)).toBe(false);
      expect(() => writeSigningIn(true, storage)).not.toThrow();
      expect(claimTab("member-a", true, storage)).toBe(false);
      expect(claimTab(null, true, storage)).toBe(false);
    }
  });
});

describe("resumable owner setup", () => {
  it("keeps the vehicle choice through a sign-in redirect and clears it when the tab changes hands", () => {
    const tab = memory();
    const draft: OwnerOnboardingDraft = { kind: "two-wheeler", brand: "Honda", model: "Activa 6G", generation: "", variant: "",
      colour: "Blue", fuel: "Petrol", manufactureYear: "2024", registration: "MH12AB1234", manual: true, step: "profile" };
    saveOwnerOnboardingDraft(draft, tab);
    expect(loadOwnerOnboardingDraft(tab)).toEqual(draft);
    forgetVisitorData(tab);
    expect(loadOwnerOnboardingDraft(tab)).toBeNull();
  });
  it("ignores malformed or incomplete tab data", () => {
    const tab = memory();
    tab.values.set("otofolks.owner-onboarding.v1", JSON.stringify({ kind: "car", step: "profile" }));
    expect(loadOwnerOnboardingDraft(tab)).toBeNull();
  });
});

describe("a visitor's shortlist", () => {
  it("round-trips through the tab and leaves nothing behind when emptied", () => {
    const tab = memory();
    const list = [car("Tata", "Nexon"), car("Honda", "Elevate", { priceSource: "Your dealer quote" })];
    saveVisitorShortlist(list, tab);
    expect(loadVisitorShortlist(tab)).toEqual(list);
    saveVisitorShortlist([], tab);
    expect(tab.values.size).toBe(0);
  });

  it("drops stored entries the account copy would refuse", () => {
    const tab = memory();
    const good = car("Tata", "Nexon");
    for (const stored of ["not json", "{}", "null", "42"]) {
      tab.values.set("otofolks.visitor-shortlist.v1", stored);
      expect(loadVisitorShortlist(tab), stored).toEqual([]);
    }
    tab.values.set("otofolks.visitor-shortlist.v1", JSON.stringify([
      good, null, "car", { ...good, id: "" }, { ...good, id: " " }, { ...good, budget: -1 }, { ...good, budget: "9" },
      { ...good, status: "Bought" }, { ...good, notes: "x".repeat(10_001) }, { ...good, variant: 7 }, { ...good, brand: "b".repeat(501) },
    ]));
    expect(loadVisitorShortlist(tab)).toEqual([good]);
  });

  it("merges in front of the account's cars, without duplicates and with unique ids", () => {
    const nexon = car("Tata", "Nexon");
    const elevate = car("Honda", "Elevate");
    const creta = car("Hyundai", "Creta");
    // Same car as the account's Nexon under another id; a new car whose id collides with the Elevate's.
    const merged = mergeShortlists(
      [{ ...nexon, id: "visitor-nexon", notes: "visitor's" }, { ...creta, id: elevate.id }, { ...creta, id: "creta-again" }],
      [nexon, elevate],
    );
    expect(merged.map((item) => item.model)).toEqual(["Creta", "Nexon", "Elevate"]);
    expect(merged[1]).toBe(nexon);
    expect(new Set(merged.map((item) => item.id)).size).toBe(3);
    expect(merged[0].id).toBe(`${elevate.id}-2`);
    // A different variant or state is a different car.
    expect(mergeShortlists([{ ...nexon, id: "other", variant: "Top" }], [nexon])).toHaveLength(2);
    expect(mergeShortlists([], [nexon])).toEqual([nexon]);
    // Whatever comes out is something "Save to account" accepts.
    const workspace = { version: 1 as const, profile: { displayName: "", city: "", garageRole: "Owner" as const },
      garage: [], timeline: [], shortlist: merged, follows: { models: [], topics: [] }, saved: [] };
    expect(parsePrivateWorkspace(workspace).shortlist).toEqual(merged);
  });
});

describe("carrying a visitor's data into an account", () => {
  let device: Map<string, string>;

  beforeEach(() => {
    device = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => device.get(key) ?? null,
      setItem: (key: string, value: string) => { device.set(key, value); },
      removeItem: (key: string) => { device.delete(key); },
    });
  });
  afterEach(() => {
    setStorageUser(null);
    vi.unstubAllGlobals();
  });

  it("moves the tab's shortlist into the account once, and never reads the shared signed-out list", () => {
    const tab = memory();
    // Left in the browser's shared storage by whoever used it before accounts existed.
    saveShortlist([car("Maruti Suzuki", "Swift")]);
    saveVisitorShortlist([car("Tata", "Nexon"), car("Honda", "Elevate")], tab);

    setStorageUser("member-a");
    saveShortlist([car("Tata", "Nexon")]);
    expect(adoptVisitorShortlist(tab).map((item) => item.model)).toEqual(["Elevate", "Nexon"]);
    expect(loadShortlist().map((item) => item.model)).toEqual(["Elevate", "Nexon"]);
    expect(loadVisitorShortlist(tab)).toEqual([]);
    // Again (a second mount, a reload): nothing more happens.
    expect(adoptVisitorShortlist(tab)).toHaveLength(2);
    expect(loadShortlist()).toHaveLength(2);

    // Another account on the same device gets none of it, and the shared list is untouched.
    setStorageUser("member-b");
    adoptVisitorShortlist(tab);
    expect(loadShortlist()).toEqual([]);
    setStorageUser(null);
    expect(loadShortlist().map((item) => item.model)).toEqual(["Swift"]);
  });

  it("keeps the cars in the tab, and on screen, when the account's storage cannot take them", () => {
    const tab = memory();
    saveVisitorShortlist([car("Tata", "Nexon"), car("Honda", "Elevate")], tab);
    setStorageUser("member-a");
    saveShortlist([car("Hyundai", "Creta")]);
    // The device's storage is full: reads still work, writes do not.
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => device.get(key) ?? null,
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: (key: string) => { device.delete(key); },
    });
    expect(adoptVisitorShortlist(tab).map((item) => item.model)).toEqual(["Nexon", "Elevate", "Creta"]);
    expect(loadVisitorShortlist(tab)).toHaveLength(2);
    expect(loadShortlist().map((item) => item.model)).toEqual(["Creta"]);
  });

  it("keeps registration numbers per account and out of the signed-out namespace", () => {
    setStorageUser("member-a");
    saveVehiclePlates({ "tata-nexon-1": "MH12AB1234" });
    expect(loadVehiclePlates()).toEqual({ "tata-nexon-1": "MH12AB1234" });
    setStorageUser("member-b");
    expect(loadVehiclePlates()).toEqual({});
    setStorageUser(null);
    expect(loadVehiclePlates()).toEqual({});
    // Anything stored that is not a plain map of text is ignored.
    setStorageUser("member-a");
    device.set("autoflex.user.member-a:autoflex.web.vehicle-plates.v1", JSON.stringify(["MH12AB1234"]));
    expect(loadVehiclePlates()).toEqual({});
    device.set("autoflex.user.member-a:autoflex.web.vehicle-plates.v1", JSON.stringify({ a: "MH12AB1234", b: 7, c: null }));
    expect(loadVehiclePlates()).toEqual({ a: "MH12AB1234" });
  });

  it("forgets everything the tab holds at sign-out", () => {
    const tab = memory();
    rememberPlate("MH12AB1234", tab);
    saveVisitorShortlist([car("Tata", "Nexon")], tab);
    forgetVisitorData(tab);
    expect(tab.values.size).toBe(0);
  });

  it("hands a visitor's tab to the first member to sign in, and to nobody after that", () => {
    const tab = memory();
    const holds = () => recallPlate(tab);
    rememberPlate("MH12AB1234", tab);
    // A visitor, however often the app renders: nothing changes.
    expect(claimTab(null, true, tab)).toBe(false);
    expect(claimTab(null, false, tab)).toBe(false);
    expect(holds()).toBe("MH12AB1234");
    // Member A signs in: what the visitor typed comes along, and stays through A's own reloads,
    // which always begin with a moment in which nobody is known to be signed in.
    expect(claimTab("member-a", true, tab)).toBe(false);
    expect(claimTab("member-a", true, tab)).toBe(false);
    expect(claimTab(null, false, tab)).toBe(false);
    expect(claimTab("member-a", true, tab)).toBe(false);
    expect(holds()).toBe("MH12AB1234");
    // The tab is then seen signed out for certain, however that came about: it is emptied, once.
    expect(claimTab(null, true, tab)).toBe(true);
    expect(holds()).toBeNull();
    expect(claimTab(null, true, tab)).toBe(false);
    expect(tab.values.size).toBe(0);
    // The next visitor's number goes to whoever signs in next, as before.
    rememberPlate("KA01AB1234", tab);
    expect(claimTab("member-b", true, tab)).toBe(false);
    expect(holds()).toBe("KA01AB1234");
    // A switch straight to another account inherits nothing.
    saveVisitorShortlist([car("Tata", "Nexon")], tab);
    expect(claimTab("member-c", true, tab)).toBe(true);
    expect(holds()).toBeNull();
    expect(loadVisitorShortlist(tab)).toEqual([]);
    expect(claimTab("member-c", true, tab)).toBe(false);
  });

  it("remembers that a sign-in was started in this tab until it is cleared", () => {
    const tab = memory();
    expect(readSigningIn(tab)).toBe(false);
    writeSigningIn(true, tab);
    expect(readSigningIn(tab)).toBe(true);
    writeSigningIn(false, tab);
    expect(tab.values.size).toBe(0);
  });

  it("remembers that the device was signed in, and nothing else", () => {
    const hint = memory();
    expect(readMemberHint(hint)).toBe(false);
    writeMemberHint(true, hint);
    expect(readMemberHint(hint)).toBe(true);
    expect([...hint.values.values()]).toEqual(["1"]);
    writeMemberHint(false, hint);
    expect(hint.values.size).toBe(0);
  });
});
