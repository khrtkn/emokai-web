import { render, screen } from "@testing-library/react";

import { GalleryView } from "@/components/gallery-view";
import { CREATIONS_KEY } from "@/lib/persistence";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn()
  })
}));

jest.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key
}));

describe("GalleryView", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("shows empty message when there are no creations", () => {
    render(<GalleryView />);
    expect(screen.getByText("emptyTitle")).toBeInTheDocument();
  });

  it("lists creations when available", async () => {
    const creation = {
      stageSelection: { selectedId: "stage-1" },
      characterSelection: { selectedId: "char-1" },
      results: {
        composite: { id: "comp", url: "https://example.com/image.webp" },
        story: { id: "story", locale: "en", content: "Story content" },
        model: { id: "model", url: "model.fbx", polygons: 1000 }
      },
      language: "en",
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(CREATIONS_KEY, JSON.stringify([creation]));

    render(<GalleryView />);

    expect(await screen.findByText("Story content")).toBeInTheDocument();
  });
});
