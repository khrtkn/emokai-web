import { render, screen } from "@testing-library/react";
import { InstructionBanner } from "@/components/ui";

describe("InstructionBanner", () => {
  it("marks error tone as alert", () => {
    render(<InstructionBanner tone="error">Error message</InstructionBanner>);
    expect(screen.getByRole("alert")).toHaveTextContent("Error message");
  });

  it("renders marquee content", () => {
    render(<InstructionBanner marquee>Scroll text</InstructionBanner>);
    expect(screen.getByText("Scroll text")).toBeInTheDocument();
  });
});
