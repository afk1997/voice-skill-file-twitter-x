import type { FEEDBACK_LABELS } from "@/lib/constants";

export type FeedbackLabel = (typeof FEEDBACK_LABELS)[number];

export const NOTE_ONLY_FEEDBACK_LABEL = "Save note only" satisfies FeedbackLabel;

export type FeedbackAction = {
  label: FeedbackLabel;
  title: string;
  description: string;
};

export const FEEDBACK_ACTIONS: FeedbackAction[] = [
  {
    label: "Sounds like us",
    title: "Approve voice",
    description: "Teach the Skill File to use this as a positive example.",
  },
  {
    label: "Too generic",
    title: "Make it more specific",
    description: "Push future drafts toward concrete nouns, sharper claims, and examples.",
  },
  {
    label: "Too formal",
    title: "Make it less formal",
    description: "Use plainer language without losing clarity.",
  },
  {
    label: "Too casual",
    title: "Make it more credible",
    description: "Keep the tone natural, but remove throwaway casual phrasing.",
  },
  {
    label: "Too salesy",
    title: "Reduce sales tone",
    description: "Lead with evidence or a useful observation before the CTA.",
  },
  {
    label: "Too polished",
    title: "Make it less corporate",
    description: "Avoid polished announcement language and generic launch copy.",
  },
  {
    label: "Too long",
    title: "Shorten it",
    description: "Compress the draft until each line earns its place.",
  },
  {
    label: "Too much hype",
    title: "Remove hype",
    description: "Cut inflated claims, superlatives, and AI-sounding excitement.",
  },
  {
    label: "Wrong vocabulary",
    title: "Fix vocabulary",
    description: "Use the note to mark words or phrasing the brand should avoid.",
  },
  {
    label: "Good idea, wrong tone",
    title: "Keep idea, change tone",
    description: "Save this as a counterexample for tone while preserving the concept.",
  },
  {
    label: "Good tone, weak hook",
    title: "Keep tone, sharpen hook",
    description: "Preserve the feel, but make the first line stronger.",
  },
];
