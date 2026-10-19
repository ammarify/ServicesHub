import { describe, expect, it } from "vitest";
import { testUser } from "../test/mockApi";
import { can, canViewPath, PAGE_PERMISSIONS } from "./permissions";

describe("can", () => {
  it("reads the permission list the API sent", () => {
    const user = testUser("finance");
    expect(can(user, "refund.approve")).toBe(true);
    expect(can(user, "booking.reassign")).toBe(false);
  });

  it("denies everything when signed out or when the list is missing", () => {
    expect(can(null, "dashboard.read")).toBe(false);
    expect(can({ role: "super_admin" }, "dashboard.read")).toBe(false);
  });
});

describe("canViewPath", () => {
  const cases = [
    // [role, path, visible]
    ["super_admin", "/settings", true],
    ["manager", "/settings", false],
    ["manager", "/providers", true],
    ["support_agent", "/support", true],
    ["support_agent", "/providers", false],
    ["support_agent", "/customers", false],
    ["finance", "/support", false],
    ["finance", "/refunds", true],
    ["finance", "/bookings/665f1c2e9b1d4a0012345678", true],
  ];

  it.each(cases)("%s on %s -> %s", (role, path, visible) => {
    expect(canViewPath(testUser(role), path)).toBe(visible);
  });

  it("matches whole path segments only", () => {
    // "/supported" is not "/support".
    expect(canViewPath(testUser("finance"), "/supported")).toBe(true);
  });

  it("leaves personal and unknown pages open to any signed-in user", () => {
    expect(canViewPath(testUser("finance"), "/account")).toBe(true);
    expect(canViewPath(testUser("finance"), "/no-such-page")).toBe(true);
  });

  it("guards every page in the sidebar", () => {
    expect(Object.keys(PAGE_PERMISSIONS).sort()).toEqual(
      ["/bookings", "/customers", "/dashboard", "/providers", "/refunds", "/settings", "/support"].sort()
    );
  });
});
