import { getPersistedList, saveCreation, CREATIONS_KEY } from "@/lib/persistence";

describe("persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("returns empty list when nothing saved", () => {
    expect(getPersistedList()).toEqual([]);
  });

  it("saves creation when data present", () => {
    const payload = {
      stageSelection: { selectedId: "stage-1" },
      characterSelection: { selectedId: "char-1" },
      results: { story: { content: "hello" }, composite: { url: "image" }, model: { url: "model" } }
    };

    sessionStorage.setItem("stage-selection", JSON.stringify(payload.stageSelection));
    sessionStorage.setItem("character-selection", JSON.stringify(payload.characterSelection));
    sessionStorage.setItem("generation-results", JSON.stringify(payload.results));

    const result = saveCreation();
    expect(result.success).toBe(true);
    expect(localStorage.getItem(CREATIONS_KEY)).not.toBeNull();
  });
});
