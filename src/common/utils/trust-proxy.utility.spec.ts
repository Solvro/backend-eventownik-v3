import { parseTrustProxy } from "./trust-proxy.utility";

describe("parseTrustProxy", () => {
  it.each([undefined, "", "  ", "false"])("returns false for %p", (value) => {
    expect(parseTrustProxy(value)).toBe(false);
  });

  it("parses true", () => {
    expect(parseTrustProxy("true")).toBe(true);
  });

  it("parses hop counts", () => {
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy(" 2 ")).toBe(2);
  });

  it("passes address lists through", () => {
    expect(parseTrustProxy("loopback, 10.0.0.0/8")).toBe(
      "loopback, 10.0.0.0/8",
    );
  });
});
