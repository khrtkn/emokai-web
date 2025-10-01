import { checkDailyLimit, incrementDailyLimit } from "@/lib/rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("allows up to three saves", () => {
    expect(checkDailyLimit().allowed).toBe(true);
    incrementDailyLimit();
    incrementDailyLimit();
    expect(checkDailyLimit().remaining).toBe(1);
    incrementDailyLimit();
    expect(checkDailyLimit().allowed).toBe(false);
  });
});
