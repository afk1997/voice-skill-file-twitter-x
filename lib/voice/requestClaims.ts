const AVAILABILITY_CLAIM_PATTERN =
  /\b(?:live now|now live|is live|are live|available now|now available|coming soon|now supports?|launch(?:ed|ing)? today|launch update)\b/i;

const AVAILABILITY_SUPPORT_PATTERN =
  /\b(?:live|launch|launched|launching|available|availability|coming soon|now supports?|rollout|released|release|shipped)\b/i;

export function hasAvailabilityClaim(text: string) {
  return AVAILABILITY_CLAIM_PATTERN.test(text);
}

export function requestSupportsAvailabilityClaim({
  context,
  tweetType,
  notes,
}: {
  context: string;
  tweetType: string;
  notes?: string;
}) {
  return AVAILABILITY_SUPPORT_PATTERN.test([context, tweetType, notes].filter(Boolean).join(" "));
}
