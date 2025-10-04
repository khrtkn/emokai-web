import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key
}));

jest.mock("@/lib/device", () => ({
  detectDeviceType: () => "unknown",
  checkARCapability: () => "unsupported"
}));

import ARLauncher from "@/components/ar-launcher";

describe("ARLauncher", () => {
  it("shows unsupported message", async () => {
    render(<ARLauncher />);
    const matches = await screen.findAllByText("support.unsupported");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("allows fallback launch when unsupported", async () => {
    render(<ARLauncher />);
    const button = await screen.findByRole("button", { name: "openViewer" });
    expect(button).toBeEnabled();
  });
});
