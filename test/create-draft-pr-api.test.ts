import { describe, it, expect } from "vitest";
import { POST as createDraftPRPOST } from "@/app/api/create-draft-pr/route";
import { NextRequest } from "next/server";

describe("Stage 7: POST /api/create-draft-pr Route Handler", () => {
  const validPayload = {
    owner: "facebook",
    repo: "react",
    issueNumber: 28000,
    issueTitle: "Memory leak in strict mode",
    targetPath: "packages/react/src/ReactSharedInternals.js",
    unifiedDiff: "--- a/index.js\n+++ b/index.js\n@@ -1 +1 @@\n+// fix",
    verificationStatus: "passed",
    userConfirmed: true,
  };

  it("successfully creates a draft PR when human confirmation is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/create-draft-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const res = await createDraftPRPOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.draftPR).toBeDefined();
    expect(data.draftPR.isDraft).toBe(true);
    expect(data.draftPR.humanConfirmed).toBe(true);
    expect(data.draftPR.prUrl).toContain("https://github.com/facebook/react/pull/");
  });

  it("strictly rejects draft PR creation when userConfirmed is false", async () => {
    const unconfirmedPayload = {
      ...validPayload,
      userConfirmed: false,
    };

    const req = new NextRequest("http://localhost:3000/api/create-draft-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(unconfirmedPayload),
    });

    const res = await createDraftPRPOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Explicit human approval is strictly required");
  });

  it("rejects attempt to push to protected branch 'main'", async () => {
    const protectedBranchPayload = {
      ...validPayload,
      branchName: "main",
    };

    const req = new NextRequest("http://localhost:3000/api/create-draft-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(protectedBranchPayload),
    });

    const res = await createDraftPRPOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toContain("Cannot push directly to a protected or primary branch");
  });

  it("redacts secrets present in issue title before creating PR", async () => {
    const payloadWithSecret = {
      ...validPayload,
      issueTitle: "Bug with ghp_1234567890abcdefghijklmnopqrstuvwxyzAB in header",
    };

    const req = new NextRequest("http://localhost:3000/api/create-draft-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadWithSecret),
    });

    const res = await createDraftPRPOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.draftPR.title).not.toContain("ghp_1234567890abcdefghijklmnopqrstuvwxyzAB");
    expect(data.draftPR.title).toContain("ghp_[REDACTED_GH_TOKEN]");
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/create-draft-pr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await createDraftPRPOST(req);
    expect(res.status).toBe(400);
  });
});
