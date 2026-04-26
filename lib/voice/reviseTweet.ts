export function buildRevisionContext({
  originalPrompt,
  originalTweet,
  feedbackNotes,
}: {
  originalPrompt: string;
  originalTweet: string;
  feedbackNotes: string[];
}) {
  return `Original request:
${originalPrompt}

Draft to revise:
${originalTweet}

Feedback already applied to the latest Skill File:
${feedbackNotes.length > 0 ? feedbackNotes.map((note, index) => `${index + 1}. ${note}`).join("\n") : "No explicit feedback notes found."}

Return one improved replacement for the draft. Keep the same underlying idea, apply the latest Voice Skill File, and do not introduce fake claims.`;
}
