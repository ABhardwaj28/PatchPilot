import { DraftPRCreator, DraftPRRequest, DraftPRResult } from "./types";
import { generateSafeBranchName, generateDraftPRBody } from "./branch-helper";

/**
 * Deterministic Mock Draft PR Creator for local development, automated testing,
 * and environments without GitHub write tokens.
 */
export class MockDraftPRCreator implements DraftPRCreator {
  public readonly name = "MockDraftPRCreator";
  public readonly isMock = true;

  public async createDraftPR(req: DraftPRRequest): Promise<DraftPRResult> {
    const branchName = req.branchName || generateSafeBranchName(req.issueNumber);
    const title = `fix(issue-${req.issueNumber}): ${req.issueTitle}`;
    const body = generateDraftPRBody({
      owner: req.owner,
      repo: req.repo,
      issueNumber: req.issueNumber,
      issueTitle: req.issueTitle,
      targetPath: req.targetPath,
      verificationStatus: req.verificationStatus,
    });

    const mockPrNumber = req.issueNumber + 100;
    const prUrl = `https://github.com/${req.owner}/${req.repo}/pull/${mockPrNumber}`;

    return {
      prNumber: mockPrNumber,
      prUrl,
      branchName,
      isDraft: true,
      isMock: true,
      title,
      body,
      targetRepo: `${req.owner}/${req.repo}`,
      baseBranch: "main",
      createdAt: new Date().toISOString(),
      humanConfirmed: true,
    };
  }
}
