import { fireEvent, render, screen } from "@testing-library/react";
import { Header } from "@/components/ui";

describe("Header", () => {
  it("renders title and button", () => {
    const onClick = jest.fn();
    render(<Header title="Stage" action={{ type: "button", label: "Next", onClick }} />);
    expect(screen.getByText("Stage")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onClick).toHaveBeenCalled();
  });
});
