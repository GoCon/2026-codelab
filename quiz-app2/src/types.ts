export type Locale = "ja" | "en";

export interface I18nText {
  ja: string;
  en: string;
}

export type StageKind = "fill" | "select";

export interface StageBase {
  id: string;
  kind: StageKind;
  label: I18nText;
  title: I18nText;
  prompt: I18nText;
  outputLines: string[];
  playgroundUrl?: string;
  why: I18nText;
  takeaway: I18nText;
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
  title: I18nText;
  difficultyLabel: I18nText;
  description: I18nText;
  unlocksSpecial?: boolean;
  stages: Stage[];
}

export interface StageSubmission {
  correct: boolean;
  selectionSummary?: string;
}
