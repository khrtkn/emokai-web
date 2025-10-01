import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

jest.mock("@/lib/moderation", () => ({
  moderateText: jest.fn().mockResolvedValue({ allowed: true })
}));

jest.mock("@/lib/image", () => ({
  processStageReference: jest.fn()
}));

jest.mock("@/lib/stage-generation", () => ({
  createStageOptions: jest.fn().mockResolvedValue([])
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key
}));

import { StageBuilder } from "@/components/stage-builder";

describe("StageBuilder", () => {
  it("renders instruction banner", () => {
    render(<StageBuilder />);

    expect(screen.getByText("instruction")).toBeInTheDocument();
  });
});
