import { withRetry, GenerationError } from "@/lib/errors";

describe("withRetry", () => {
  it("retries the given number of times", async () => {
    let attempts = 0;
    const fn = jest.fn(async () => {
      attempts += 1;
      if (attempts < 3) {
        throw new Error("fail");
      }
      return "success";
    });

    const result = await withRetry(fn, { retries: 5, delayMs: 10 });
    expect(result).toBe("success");
    expect(attempts).toBe(3);
  });

  it("throws the last error when retries exhausted", async () => {
    const fn = jest.fn(async () => {
      throw new Error("fail");
    });

    await expect(withRetry(fn, { retries: 2, delayMs: 10 })).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
