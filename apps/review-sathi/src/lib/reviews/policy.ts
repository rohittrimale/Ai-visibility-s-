export type ReplyMode = "manual" | "auto_positive" | "auto_all";

export type ReviewDecisionInput = {
  starRating: number;
  hasExistingReply: boolean;
  replyMode: ReplyMode;
  negativeThreshold: number;
};

export type ReviewDecision = {
  /** Status to store for a newly seen review. */
  status: "new" | "replied_elsewhere";
  /** Whether to ask the AI for a draft. */
  draft: boolean;
  /** Whether the draft may go live on Google without the owner's approval. */
  autoPost: boolean;
  /** Whether to send the owner an urgent alert. */
  alert: boolean;
};

export function isNegative(starRating: number, negativeThreshold: number): boolean {
  return starRating <= negativeThreshold;
}

/**
 * What to do with a review we have not seen before.
 * Negative reviews never post automatically: a person should read them first.
 */
export function decideForNewReview(input: ReviewDecisionInput): ReviewDecision {
  const negative = isNegative(input.starRating, input.negativeThreshold);
  if (input.hasExistingReply) {
    return { status: "replied_elsewhere", draft: false, autoPost: false, alert: false };
  }
  let autoPost = false;
  if (!negative) {
    if (input.replyMode === "auto_all") autoPost = true;
    if (input.replyMode === "auto_positive") autoPost = input.starRating >= 4;
  }
  return { status: "new", draft: true, autoPost, alert: negative };
}

/** Google allows up to 4,096 characters in a reply. */
export const MAX_REPLY_CHARS = 4000;
/** Google allows up to 1,500 characters in a post. */
export const MAX_POST_CHARS = 1500;

export function validateReplyText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Reply cannot be empty.";
  if (trimmed.length > MAX_REPLY_CHARS) return `Reply must be under ${MAX_REPLY_CHARS} characters.`;
  return null;
}

export function validatePostText(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "Post cannot be empty.";
  if (trimmed.length > MAX_POST_CHARS) return `Post must be under ${MAX_POST_CHARS} characters.`;
  // Google rejects posts that contain phone numbers in the text.
  if (/(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/.test(trimmed)) {
    return "Google rejects posts with phone numbers in the text. Remove the number and use the Call button on your profile instead.";
  }
  return null;
}

/** Monday of the week containing `date`, as YYYY-MM-DD (IST). */
export function weekStartIST(date: Date): string {
  const ist = new Date(date.getTime() + 5.5 * 3_600_000);
  const day = ist.getUTCDay(); // 0 Sunday
  const diff = (day + 6) % 7;
  ist.setUTCDate(ist.getUTCDate() - diff);
  return ist.toISOString().slice(0, 10);
}
