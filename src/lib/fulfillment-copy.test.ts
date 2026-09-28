import { describe, expect, it } from "vitest";
import {
  customerDisplayName,
  fulfillmentCardTitle,
  mailingLabel,
  normalizeAddressLines,
} from "./fulfillment-copy";

describe("fulfillment address copy", () => {
  it("titles the card with order number and customer name, never a street fragment", () => {
    expect(fulfillmentCardTitle("S-2WNFUR", "Ada Lovelace")).toBe("S-2WNFUR · Ada Lovelace");
    expect(fulfillmentCardTitle("S-2WNFUR", "132 main street")).toBe("S-2WNFUR");
  });

  it("dedupes conflicting street lines before clipboard copy", () => {
    expect(normalizeAddressLines("132 main street, 123 main st, Dallas, TX, 75252, US")).toEqual([
      "132 main street",
      "123 main st",
      "Dallas",
      "TX",
      "75252",
      "US",
    ]);
    expect(mailingLabel("Ada Lovelace", "123 main st, Dallas, TX, 75252, US")).toBe(
      "Ada Lovelace\n123 main st, Dallas, TX, 75252, US",
    );
    expect(mailingLabel("132 main street", "123 main st, Dallas, TX, 75252, US")).toBe(
      "123 main st, Dallas, TX, 75252, US",
    );
  });

  it("never uses a street line as the customer name", () => {
    expect(customerDisplayName("132 main street", "ada@example.com")).toBe("Ada");
    expect(customerDisplayName("Ada Lovelace", "ada@example.com")).toBe("Ada Lovelace");
  });
});
