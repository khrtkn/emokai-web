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
  it("shows unsupported message", () => {
    render(<ARLauncher />);
    expect(screen.getByText("support.unsupported")).toBeInTheDocument();
  });

  it("allows fallback launch when unsupported", () => {
    render(<ARLauncher />);
    expect(screen.getByRole("button", { name: "openViewer" })).toBeEnabled();
  });
});
