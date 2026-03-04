import { Octokit } from "@octokit/rest";
import type { HolderWeight } from "@/types";

const required = (name: string): string => {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing env: ${name}`);
  }
  return v;
};

export async function uploadSnapshotToGist(snapshot: HolderWeight[]): Promise<{
  gistUrl: string;
  rawUrl: string;
}> {
  const token = required("GITHUB_TOKEN");
  const octokit = new Octokit({ auth: token });

  const filename = `jackpotex-snapshot-${Date.now()}.json`;
  const content = JSON.stringify(snapshot, null, 2);

  const res = await octokit.gists.create({
    public: true,
    description: "JackpotEx holder snapshot for weighted draw verification",
    files: {
      [filename]: { content }
    }
  });

  const fileObj = res.data.files?.[filename];
  const rawUrl = fileObj?.raw_url;
  const gistUrl = res.data.html_url;
  if (!rawUrl) {
    throw new Error("No raw gist URL returned");
  }
  if (!gistUrl) {
    throw new Error("No gist URL returned");
  }

  return {
    gistUrl,
    rawUrl
  };
}
