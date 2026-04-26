import type { FeedbackLabel } from "@/lib/voice/feedbackActions";

type FeedbackOutcome = {
  title: string;
  description: string;
  primaryAction: string;
};

const OUTCOMES: Partial<Record<FeedbackLabel, FeedbackOutcome>> = {
  "Sounds like us": {
    title: "Approved example saved",
    description: "This draft was added to approved generated examples in the Voice Skill File.",
    primaryAction: "Generate another batch",
  },
  "Reject draft": {
    title: "Draft rejected",
    description: "This draft was saved as an off-brand counterexample so future generations avoid this direction.",
    primaryAction: "Generate a better batch",
  },
  "Too generic": {
    title: "Specificity rule added",
    description: "The Voice Skill File now prefers concrete examples, concrete nouns, and sharper claims.",
    primaryAction: "Generate another batch",
  },
  "Too polished": {
    title: "Corporate polish blocked",
    description: "The Voice Skill File now avoids polished announcement language and common AI-sounding phrases.",
    primaryAction: "Generate another batch",
  },
  "Too formal": {
    title: "Tone rule added",
    description: "The Voice Skill File now pushes drafts toward plainer, more conversational language.",
    primaryAction: "Generate another batch",
  },
  "Too casual": {
    title: "Credibility rule added",
    description: "The Voice Skill File now preserves credibility and avoids throwaway casual phrasing.",
    primaryAction: "Generate another batch",
  },
  "Too salesy": {
    title: "Sales tone reduced",
    description: "The Voice Skill File now leads with evidence, context, or useful observations before promotion.",
    primaryAction: "Generate another batch",
  },
  "Too long": {
    title: "Compression rule added",
    description: "The Voice Skill File now asks drafts to be tighter, with every sentence earning its place.",
    primaryAction: "Generate another batch",
  },
  "Too much hype": {
    title: "Hype phrases blocked",
    description: "The Voice Skill File now avoids hype-heavy language like revolutionary, supercharge, and cutting-edge.",
    primaryAction: "Generate another batch",
  },
  "Wrong vocabulary": {
    title: "Vocabulary feedback saved",
    description: "The Voice Skill File now treats your note as vocabulary to avoid or revise around.",
    primaryAction: "Generate another batch",
  },
  "Good idea, wrong tone": {
    title: "Tone correction saved",
    description: "The draft was saved as a rejected generated example so future drafts keep the idea but shift the tone.",
    primaryAction: "Generate another batch",
  },
  "Good tone, weak hook": {
    title: "Hook rule added",
    description: "The Voice Skill File now asks for sharper first lines with clearer claims, contrast, or setup.",
    primaryAction: "Generate another batch",
  },
  "Save note only": {
    title: "Note saved to Skill File",
    description: "Your note was saved as a feedback rule without approving or rejecting this draft.",
    primaryAction: "Generate another batch",
  },
};

export function feedbackOutcome(label: FeedbackLabel): FeedbackOutcome {
  return (
    OUTCOMES[label] ?? {
      title: "Feedback saved",
      description: "The Voice Skill File was updated with this feedback.",
      primaryAction: "Generate another batch",
    }
  );
}
