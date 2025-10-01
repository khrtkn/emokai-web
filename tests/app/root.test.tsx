import { render, screen } from "@testing-library/react";

import HomePage from "@/app/[locale]/page";

describe("HomePage", () => {
  it("renders language selection", () => {
    render(<HomePage />);
    expect(screen.getByText(/Start in English/i)).toBeInTheDocument();
    expect(screen.getByText(/日本語で始める/)).toBeInTheDocument();
  });
});
