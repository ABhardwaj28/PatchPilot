import { DraftPRCreator } from "./types";
import { MockDraftPRCreator } from "./mock-creator";

/**
 * Factory to obtain the active Draft PR Creator.
 * By default in test and development, uses MockDraftPRCreator.
 */
export function getDraftPRCreator(): DraftPRCreator {
  const creatorType = (process.env.DRAFT_PR_CREATOR || "mock").toLowerCase();

  switch (creatorType) {
    case "mock":
    default:
      return new MockDraftPRCreator();
  }
}
