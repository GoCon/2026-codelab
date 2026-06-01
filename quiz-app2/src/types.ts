export type StageKind = "fill" | "select";

export interface StageBase {
  id: string;
  kind: StageKind;
  label: string;
  title: string;
  prompt: string;
  outputLines: string[];
  playgroundUrl?: string;
  why: string;
  takeaway: string;
}

export interface FillStage extends StageBase {
  kind: "fill";
  templateLines: string[];
  pool: string[];
  correctAnswers: string[];
}

export interface SelectStage extends StageBase {
  kind: "select";
  snippetLines: string[];
  options: string[];
  correctAnswers: string[];
}

export type Stage = FillStage | SelectStage;

export interface CampaignTier {
  id: string;
  title: string;
  difficultyLabel: string;
  description: string;
  unlocksSpecial?: boolean;
  stages: Stage[];
}

export interface StageSubmission {
  correct: boolean;
  selectionSummary?: string;
}
