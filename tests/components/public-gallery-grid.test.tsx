import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import PublicGalleryGrid, { type GalleryCardData } from "@/components/public-gallery-grid";

describe("PublicGalleryGrid", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  const initialItems: GalleryCardData[] = [
    {
      slug: "first",
      characterName: "First Emokai",
      story: "A recorded story",
      thumbnail: null,
      publishedAt: "2025-10-08T00:00:00Z"
    }
  ];

  it("loads additional cards when load more is clicked", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            slug: "second",
            characterName: "Second Emokai",
            story: "Another tale",
            publishedAt: "2025-10-09T00:00:00Z",
            assets: { thumbnail: null }
          }
        ],
        nextCursor: null
      })
    });

    render(
      <PublicGalleryGrid locale="en" initialItems={initialItems} initialCursor="cursor-1" pageSize={1} />
    );

    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(screen.getByText("Second Emokai")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/gallery/public?locale=en&limit=1&cursor=cursor-1",
      { cache: "no-store" }
    );
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 500
    });

    render(
      <PublicGalleryGrid locale="en" initialItems={initialItems} initialCursor="cursor-2" pageSize={1} />
    );

    const loadMoreButton = screen.getByRole("button", { name: /load more/i });
    fireEvent.click(loadMoreButton);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load more creations. Please try again in a moment.")
      ).toBeInTheDocument();
    });
  });
});
