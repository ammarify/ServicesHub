import { describe, expect, it } from "vitest";
import { testUser } from "../../test/mockApi";
import { buildTourSteps } from "./tourSteps";

const ids = (role) => buildTourSteps(testUser(role)).map((step) => step.id);

describe("guided tour steps", () => {
  it("greets the person by first name and names their role", () => {
    const [welcome] = buildTourSteps({ ...testUser("finance"), name: "Jessica Nguyen" });
    expect(welcome.title).toBe("Welcome to ServiHub, Jessica");
    expect(welcome.body).toContain("Finance role");
  });

  it("only points at pages the role can open", () => {
    expect(ids("super_admin")).toEqual(expect.arrayContaining(["bookings", "support", "refunds", "team"]));
    expect(ids("manager")).not.toContain("team");
    expect(ids("finance")).not.toContain("support");
    expect(ids("finance")).not.toContain("bookings");
    expect(ids("support_agent")).toContain("support");
  });

  it("describes refunds by what the role can do with them", () => {
    const finance = buildTourSteps(testUser("finance")).find((step) => step.id === "refunds");
    const agent = buildTourSteps(testUser("support_agent")).find((step) => step.id === "refunds");
    expect(finance.title).toBe("Decide on refunds");
    expect(agent.title).toBe("Request refunds");
  });
});
