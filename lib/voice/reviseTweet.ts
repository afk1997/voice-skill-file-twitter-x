export function buildRevisionContext({
  originalPrompt,
  originalTweet,
  feedbackNotes,
  revisionNotes = [],
}: {
  originalPrompt: string;
  originalTweet: string;
  feedbackNotes: string[];
  revisionNotes?: string[];
}) {
  const revisionNoteBlock = revisionNotes.map((note) => note.trim()).filter(Boolean);

  return `Original request:
${originalPrompt}

Draft to revise:
${originalTweet}

Feedback already applied to the latest Skill File:
${feedbackNotes.length > 0 ? feedbackNotes.map((note, index) => `${index + 1}. ${note}`).join("\n") : "No explicit feedback notes found."}

Revision note for this run:
${revisionNoteBlock.length > 0 ? revisionNoteBlock.map((note, index) => `${index + 1}. ${note}`).join("\n") : "No one-off revision note provided."}

Return one improved replacement for the draft. Keep the same underlying idea, apply the latest Voice Skill File, and do not introduce fake claims.`;
}
