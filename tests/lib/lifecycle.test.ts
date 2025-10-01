import { cleanupExpired, scheduleTemporary, scheduleRetention } from "@/lib/lifecycle";

describe("lifecycle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("removes expired keys", () => {
    localStorage.setItem("temp", "value");
    scheduleTemporary("temp", { tempTimeoutMinutes: 0, sessionTimeoutHours: 24, retentionDays: 7 });
    cleanupExpired({ tempTimeoutMinutes: 0, sessionTimeoutHours: 24, retentionDays: 7 });
    expect(localStorage.getItem("temp")).toBeNull();
  });

  it("keeps keys that are not expired", () => {
    localStorage.setItem("keep", "value");
    scheduleRetention("keep", { tempTimeoutMinutes: 30, sessionTimeoutHours: 24, retentionDays: 7 });
    cleanupExpired();
    expect(localStorage.getItem("keep")).toBe("value");
  });
});
