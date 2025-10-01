import { fireEvent, render, screen } from "@testing-library/react";
import { ImageOption } from "@/components/ui";

describe("ImageOption", () => {
  it("calls onSelect when clicked", () => {
    const onSelect = jest.fn();
    render(
      <ImageOption
        id="option-1"
        label="Option 1"
        image={<div data-testid="image" />}
        onSelect={onSelect}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Option 1/ }));
    expect(onSelect).toHaveBeenCalledWith("option-1");
  });
});
