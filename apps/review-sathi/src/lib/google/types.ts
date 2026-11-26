export type StarRatingEnum = "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE" | "STAR_RATING_UNSPECIFIED";

const STAR_MAP: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

/** Google sends star ratings as words. Unknown values become 0, which callers skip. */
export function starRatingToNumber(value: string | undefined | null): number {
  return value ? (STAR_MAP[value] ?? 0) : 0;
}

/** A Google review in the shape the rest of the app uses. */
export type GbpReview = {
  name: string; // accounts/{a}/locations/{l}/reviews/{r}
  reviewerName: string | null;
  starRating: number; // 1..5
  comment: string | null;
  createTime: string;
  updateTime: string | null;
  reply: { comment: string; updateTime: string | null } | null;
};

export type GbpLocation = {
  name: string; // locations/{l}
  accountName: string; // accounts/{a}
  title: string;
  address: string | null;
  placeId: string | null;
  /** Link that opens Google's "write a review" box for this place. */
  reviewUrl: string | null;
};

export type GbpAccount = { name: string; accountName: string | null };

/**
 * Google adds machine translations to some reviews:
 * "(Translated by Google) Great food\n\n(Original)\nबहुत अच्छा खाना"
 * Replies should answer the original words, so keep only the original.
 */
export function originalReviewText(comment: string | null | undefined): string | null {
  if (!comment) return null;
  const marker = "(Original)";
  const idx = comment.indexOf(marker);
  if (comment.startsWith("(Translated by Google)") && idx !== -1) {
    return comment.slice(idx + marker.length).trim() || null;
  }
  return comment.trim() || null;
}

type RawReview = {
  name?: string;
  reviewer?: { displayName?: string; isAnonymous?: boolean };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

export function normalizeReview(raw: RawReview): GbpReview | null {
  const stars = starRatingToNumber(raw.starRating);
  if (!raw.name || !raw.createTime || stars === 0) return null;
  return {
    name: raw.name,
    reviewerName: raw.reviewer?.isAnonymous ? null : (raw.reviewer?.displayName ?? null),
    starRating: stars,
    comment: originalReviewText(raw.comment),
    createTime: raw.createTime,
    updateTime: raw.updateTime ?? null,
    reply: raw.reviewReply?.comment
      ? { comment: raw.reviewReply.comment, updateTime: raw.reviewReply.updateTime ?? null }
      : null,
  };
}

type RawAddress = {
  addressLines?: string[];
  locality?: string;
  administrativeArea?: string;
  postalCode?: string;
};

export function formatAddress(address: RawAddress | undefined): string | null {
  if (!address) return null;
  const parts = [...(address.addressLines ?? []), address.locality, address.administrativeArea, address.postalCode].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.length ? parts.join(", ") : null;
}

/** Google's "write a review" link: metadata.newReviewUri if present, else built from the place ID. */
export function reviewUrlFor(metadata: { placeId?: string; newReviewUri?: string } | undefined): string | null {
  if (metadata?.newReviewUri?.startsWith("https://")) return metadata.newReviewUri;
  if (metadata?.placeId) return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(metadata.placeId)}`;
  return null;
}
