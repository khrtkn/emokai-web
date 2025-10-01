import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key
}));

jest.mock("@/lib/session-lock", () => ({
  releaseGenerationLock: jest.fn()
}));

import ResultViewer from "@/components/result-viewer";

function clearSession() {
  sessionStorage.clear();
  localStorage.clear();
}

describe("ResultViewer", () => {
  beforeEach(() => {
    clearSession();
  });

  it("shows missing message when no results", () => {
    render(<ResultViewer />);
    expect(screen.getByText("missing")).toBeInTheDocument();
  });
});
