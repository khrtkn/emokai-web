import { render, screen } from "@testing-library/react";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn()
  })
}));

jest.mock("@/lib/moderation", () => ({
  moderateText: jest.fn().mockResolvedValue({ allowed: true })
}));

jest.mock("@/lib/character-generation", () => ({
  createCharacterOptions: jest.fn().mockResolvedValue([])
}));

jest.mock("@/lib/generation-jobs", () => ({
  generateModel: jest.fn(),
  generateComposite: jest.fn(),
  generateStory: jest.fn()
}));

jest.mock("@/lib/session-lock", () => ({
  isGenerationLocked: () => false,
  acquireGenerationLock: () => true,
  releaseGenerationLock: jest.fn()
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key
}));

import { CharacterBuilder } from "@/components/character-builder";

describe("CharacterBuilder", () => {
  it("renders instruction banner", () => {
    render(<CharacterBuilder />);

    expect(screen.getByText("instruction")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "generateButton" })).toBeInTheDocument();
  });
});
