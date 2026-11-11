import { describe, it, expect } from "vitest";
import { POST as verifyPatchPOST } from "@/app/api/verify-patch/route";
import { NextRequest } from "next/server";

describe("Stage 6: POST /api/verify-patch Route Handler", () => {
  const validPayload = {
    owner: "facebook",
    repo: "react",
    targetPath: "packages/react/src/ReactSharedInternals.js",
    unifiedDiff: [
      "--- a/packages/react/src/ReactSharedInternals.js",
      "+++ b/packages/react/src/ReactSharedInternals.js",
      "@@ -10,3 +10,4 @@",
      " export default ReactSharedInternals;",
      "+// patched safely",
    ].join("\n"),
    command: "npx vitest run",
  };

  it("successfully validates payload and runs isolated verification job", async () => {
    const req = new NextRequest("http://localhost:3000/api/verify-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validPayload),
    });

    const res = await verifyPatchPOST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.result).toBeDefined();
    expect(data.result.status).toBe("passed");
    expect(data.result.exitCode).toBe(0);
    expect(data.result.securityAudit.networkIsolated).toBe(true);
    expect(data.result.securityAudit.nonRootUser).toBe(true);
    expect(data.result.securityAudit.credentialsMounted).toBe(false);
  });

  it("returns 400 when command violates security allowlist", async () => {
    const maliciousPayload = {
      ...validPayload,
      command: "npm test; rm -rf /",
    };

    const req = new NextRequest("http://localhost:3000/api/verify-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(maliciousPayload),
    });

    const res = await verifyPatchPOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Security check failed/i);
  });

  it("returns 400 when request body contains invalid JSON", async () => {
    const req = new NextRequest("http://localhost:3000/api/verify-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    const res = await verifyPatchPOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Invalid JSON/i);
  });

  it("returns 400 when schema validation fails (e.g. path traversal in targetPath)", async () => {
    const badPathPayload = {
      ...validPayload,
      targetPath: "../../etc/shadow",
    };

    const req = new NextRequest("http://localhost:3000/api/verify-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(badPathPayload),
    });

    const res = await verifyPatchPOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Validation error/i);
  });

  it("returns 400 when missing required fields", async () => {
    const req = new NextRequest("http://localhost:3000/api/verify-patch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner: "facebook" }),
    });

    const res = await verifyPatchPOST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toMatch(/Validation error/i);
  });
});
