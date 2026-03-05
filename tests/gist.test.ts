import { beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(() => ({
    gists: {
      create: createMock
    }
  }))
}));

describe("gist upload", () => {
  beforeEach(() => {
    createMock.mockReset();
    process.env.GITHUB_TOKEN = "test-token";
  });

  it("returns gist and raw urls", async () => {
    createMock.mockResolvedValue({
      data: {
        html_url: "https://gist.github.com/x/1",
        files: {
          "jackpotex-snapshot-1.json": {
            raw_url: "https://gist.githubusercontent.com/x/raw"
          }
        }
      }
    });

    vi.spyOn(Date, "now").mockReturnValue(1);
    const { uploadSnapshotToGist } = await import("@/lib/gist");
    const out = await uploadSnapshotToGist([{ owner: "abc", amountRaw: "1" }]);

    expect(out.gistUrl).toContain("gist.github.com");
    expect(out.rawUrl).toContain("gist.githubusercontent.com");
    expect(createMock).toHaveBeenCalledOnce();
  });
});
