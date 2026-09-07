import type {
  CampaignTier,
  FillStage,
  SelectStage,
  Stage,
  StageKind,
  I18nText,
} from "../types";
import stagesDocument from "./stages.toml";

export const STAGE_TIME_LIMIT_MS = 30_000;
export const PREVIEW_UNLOCK_KEYWORD = "gofar,gotogether";
export const FOOTER_TAP_THRESHOLD = 10;

type TomlRecord = Record<string, unknown>;

const stageKinds = ["fill", "select"] as const satisfies readonly StageKind[];

const isRecord = (value: unknown): value is TomlRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const expectRecord = (value: unknown, path: string): TomlRecord => {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object.`);
  }

  return value;
};

const expectArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array.`);
  }

  return value;
};

const expectString = (value: unknown, path: string): string => {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string.`);
  }

  return value;
};

const expectI18nText = (value: unknown, path: string): I18nText => {
  const record = expectRecord(value, path);
  return {
    ja: expectString(record.ja, `${path}.ja`),
    en: expectString(record.en, `${path}.en`),
  };
};

const expectStringArray = (value: unknown, path: string): string[] =>
  expectArray(value, path).map((item, index) =>
    expectString(item, `${path}[${index}]`),
  );

const expectOptionalBoolean = (
  value: unknown,
  path: string,
): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean when present.`);
  }

  return value;
};

const expectOptionalPlaygroundUrl = (
  value: unknown,
  path: string,
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  const text = expectString(value, path);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(`${path} must be a valid absolute URL when present.`);
  }

  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "go.dev" ||
    !parsed.pathname.startsWith("/play/")
  ) {
    throw new Error(
      `${path} must be an https://go.dev/play/ URL when present.`,
    );
  }

  return parsed.toString();
};

const expectOneOf = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  path: string,
): T => {
  const text = expectString(value, path);

  if (!allowed.includes(text as T)) {
    throw new Error(`${path} must be one of: ${allowed.join(", ")}.`);
  }

  return text as T;
};

const expectUniqueStrings = (values: string[], path: string) => {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`${path} contains duplicate value "${value}".`);
    }

    seen.add(value);
  }
};

const parseStageBase = <K extends StageKind>(
  record: TomlRecord,
  kind: K,
  path: string,
) => {
  const outputLinesRaw = expectString(
    record.outputLines,
    `${path}.outputLines`,
  );
  const outputLines =
    outputLinesRaw === ""
      ? []
      : outputLinesRaw.replace(/\r?\n$/, "").split(/\r?\n/);

  const playgroundUrl = expectOptionalPlaygroundUrl(
    record.playgroundUrl,
    `${path}.playgroundUrl`,
  );

  return {
    id: expectString(record.id, `${path}.id`),
    kind,
    label: expectI18nText(record.label, `${path}.label`),
    title: expectI18nText(record.title, `${path}.title`),
    prompt: expectI18nText(record.prompt, `${path}.prompt`),
    outputLines,
    ...(playgroundUrl === undefined ? {} : { playgroundUrl }),
    why: expectI18nText(record.why, `${path}.why`),
    takeaway: expectI18nText(record.takeaway, `${path}.takeaway`),
  };
};

const validateFillTemplate = (stage: FillStage, path: string) => {
  const allLines = [...stage.templateLines, ...stage.outputLines];

  const placeholderIndexes = allLines.flatMap((line) =>
    Array.from(line.matchAll(/\[(\d+)\]/g), (match) => Number(match[1])),
  );

  if (placeholderIndexes.length !== stage.correctAnswers.length) {
    throw new Error(
      `${path} must contain exactly ${stage.correctAnswers.length} placeholders across templateLines and outputLines.`,
    );
  }

  const expectedIndexes = Array.from(
    { length: stage.correctAnswers.length },
    (_, index) => index + 1,
  );

  for (const [index, value] of placeholderIndexes.entries()) {
    if (value !== expectedIndexes[index]) {
      throw new Error(
        `${path} placeholders must be numbered [1]...[${stage.correctAnswers.length}] in order across templateLines and outputLines.`,
      );
    }
  }
};

const parseFillStage = (record: TomlRecord, path: string): FillStage => {
  const templateLinesRaw = expectString(
    record.templateLines,
    `${path}.templateLines`,
  );
  const templateLines = templateLinesRaw.replace(/\r?\n$/, "").split(/\r?\n/);

  const stage = {
    ...parseStageBase(record, "fill", path),
    templateLines,
    pool: expectStringArray(record.pool, `${path}.pool`),
    correctAnswers: expectStringArray(
      record.correctAnswers,
      `${path}.correctAnswers`,
    ),
  };

  validateFillTemplate(stage, path);

  for (const answer of stage.correctAnswers) {
    if (!stage.pool.includes(answer)) {
      throw new Error(
        `${path}.correctAnswers contains "${answer}" that is not in ${path}.pool.`,
      );
    }
  }

  return stage;
};

const parseSelectStage = (record: TomlRecord, path: string): SelectStage => {
  const stage = {
    ...parseStageBase(record, "select", path),
    snippetLines: expectStringArray(
      record.snippetLines,
      `${path}.snippetLines`,
    ),
    options: expectStringArray(record.options, `${path}.options`),
    correctAnswers: expectStringArray(
      record.correctAnswers,
      `${path}.correctAnswers`,
    ),
  };

  expectUniqueStrings(stage.options, `${path}.options`);
  expectUniqueStrings(stage.correctAnswers, `${path}.correctAnswers`);

  if (stage.correctAnswers.length === 0) {
    throw new Error(`${path}.correctAnswers must contain at least one item.`);
  }

  for (const answer of stage.correctAnswers) {
    if (!stage.options.includes(answer)) {
      throw new Error(
        `${path}.correctAnswers contains "${answer}" that is not in ${path}.options.`,
      );
    }
  }

  return stage;
};

const parseStage = (value: unknown, path: string): Stage => {
  const record = expectRecord(value, path);
  const kind = expectOneOf(record.kind, stageKinds, `${path}.kind`);

  switch (kind) {
    case "fill":
      return parseFillStage(record, path);
    case "select":
      return parseSelectStage(record, path);
  }
};

const parseCampaignTier = (value: unknown, path: string): CampaignTier => {
  const record = expectRecord(value, path);
  const stages = expectArray(record.stages, `${path}.stages`).map(
    (stage, index) => parseStage(stage, `${path}.stages[${index}]`),
  );
  const unlocksSpecial = expectOptionalBoolean(
    record.unlocksSpecial,
    `${path}.unlocksSpecial`,
  );

  return {
    id: expectString(record.id, `${path}.id`),
    title: expectI18nText(record.title, `${path}.title`),
    difficultyLabel: expectI18nText(
      record.difficultyLabel,
      `${path}.difficultyLabel`,
    ),
    description: expectI18nText(record.description, `${path}.description`),
    ...(unlocksSpecial === undefined ? {} : { unlocksSpecial }),
    stages,
  };
};

const loadCampaignTiers = (): CampaignTier[] => {
  const root = expectRecord(stagesDocument, "src/data/stages.toml");
  const tiers = expectArray(
    root.campaignTiers,
    "src/data/stages.toml.campaignTiers",
  ).map((tier, index) => parseCampaignTier(tier, `campaignTiers[${index}]`));
  const tierIds = tiers.map((tier) => tier.id);
  const stageIds = tiers.flatMap((tier) =>
    tier.stages.map((stage) => stage.id),
  );

  expectUniqueStrings(tierIds, "campaignTiers");
  expectUniqueStrings(stageIds, "campaignTiers[].stages");

  return tiers;
};

export const campaignTiers: CampaignTier[] = loadCampaignTiers();
export const stages: Stage[] = campaignTiers.flatMap((tier) => tier.stages);
