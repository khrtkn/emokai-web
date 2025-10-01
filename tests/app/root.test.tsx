import { render } from "@testing-library/react";

import HomePage from "@/app/[locale]/page";

describe("HomePage", () => {
  it("redirects to the Emokai flow", () => {
    expect(() => render(<HomePage />)).toThrowError(/NEXT_REDIRECT/i);
  });
});
