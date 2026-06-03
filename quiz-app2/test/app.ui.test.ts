import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import App from "../src/App.vue";
import { STAGE_TIME_LIMIT_MS, stages, campaignTiers } from "../src/data/stages";

const settle = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

// 【修正】attributes("disabled") が存在しない（undefined である）ことを正しく判定
const findEnabledButton = (wrapper: ReturnType<typeof mount>, label: string) => {
  const button = wrapper.findAll("button").find((candidate) => candidate.attributes("disabled") === undefined && normalizeText(candidate.text()) === label);

  expect(button, `missing button: ${label}`).toBeTruthy();
  return button!;
};

// 【修正】attributes("disabled") が存在しない（undefined である）ことを正しく判定
const hasEnabledButton = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll("button").some((candidate) => candidate.attributes("disabled") === undefined && normalizeText(candidate.text()) === label);

const clickButton = async (wrapper: ReturnType<typeof mount>, label: string) => {
  await findEnabledButton(wrapper, label).trigger("click");
  await settle();
};

const findButton = (wrapper: ReturnType<typeof mount>, label: string) => {
  const button = wrapper.findAll("button").find((candidate) => normalizeText(candidate.text()) === label);

  expect(button, `missing button: ${label}`).toBeTruthy();
  return button!;
};

const unlockPreview = async (wrapper: ReturnType<typeof mount>) => {
  const footer = wrapper.find("footer");
  expect(footer.exists()).toBe(true);

  for (let i = 0; i < 10; i += 1) {
    await footer.trigger("click");
  }
  await settle();

  const keywordInput = wrapper.find('input[placeholder="合言葉を入力"]');
  expect(keywordInput.exists()).toBe(true);
  await keywordInput.setValue("gofar,gotogether");
  await settle();
  await clickButton(wrapper, "開く");
};

describe("quiz-app2 campaign flow", () => {
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps preview gated while a perfect Tier 1 clear unlocks the special page", async () => {
    vi.useFakeTimers();

    const wrapper = mount(App);
    await settle();
    const shell = () => wrapper.find("[data-screen]");

    expect(shell().attributes("data-screen")).toBe("home");
    expect(hasEnabledButton(wrapper, "問題一覧を見る")).toBe(false);

    await clickButton(wrapper, "クイズを始める");
    expect(shell().attributes("data-screen")).toBe("question");
    expect(findButton(wrapper, "リセット").classes()).toContain("bg-white");

    // すべての登録問題を動的に全問正解していくループ
    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      if (!stage) continue;

      if (i === 0) {
        await clickButton(wrapper, stage.correctAnswers[0]!);
        await clickButton(wrapper, "リセット");
      }

      for (const answer of stage.correctAnswers) {
        await clickButton(wrapper, answer);
      }
      await clickButton(wrapper, "回答する");
      expect(shell().attributes("data-screen")).toBe("result");
      expect(wrapper.text()).toContain("◯ 正解");

      if (i === stages.length - 1) {
        await clickButton(wrapper, "結果を見る");
      } else {
        await clickButton(wrapper, "つぎへ");
      }
    }

    expect(shell().attributes("data-screen")).toBe("score");
    expect(wrapper.text()).toContain(`${stages.length}/${stages.length}`);
    expect(wrapper.text()).toContain("スペシャルページへ");

    await clickButton(wrapper, "同じレベルでもう一度");
    expect(shell().attributes("data-screen")).toBe("question");
  });

  it("unlocks the preview list only through the hidden keyword flow", async () => {
    const wrapper = mount(App);
    await settle();
    const shell = () => wrapper.find("[data-screen]");

    expect(hasEnabledButton(wrapper, "問題一覧を見る")).toBe(false);
    await unlockPreview(wrapper);
    expect(hasEnabledButton(wrapper, "問題一覧を見る")).toBe(true);

    await clickButton(wrapper, "問題一覧を見る");
    expect(shell().attributes("data-screen")).toBe("preview");

    if (stages[0]) {
      expect(wrapper.text()).toContain(stages[0].prompt);
    }

    const closeBtn = wrapper.findAll("button").find((c) => c.text().includes("閉じる"));
    if (closeBtn) {
      await closeBtn.trigger("click");
      await settle();
    }
    expect(shell().attributes("data-screen")).toBe("home");
  });

  it("shows the retry headline without the tier subtitle on an imperfect clear", async () => {
    const wrapper = mount(App);
    await settle();
    const shell = () => wrapper.find("[data-screen]");

    await clickButton(wrapper, "クイズを始める");

    // 1問目はあえて間違った選択肢でスロットを全て埋めて有効化し、不合格にする
    const firstStage = stages[0];
    if (firstStage) {
      const wrongTokens = firstStage.pool.filter((token) => !firstStage.correctAnswers.includes(token));
      let tokensToClick = [...wrongTokens];

      while (tokensToClick.length < firstStage.correctAnswers.length) {
        tokensToClick.push(firstStage.pool[0]!);
      }
      tokensToClick = tokensToClick.slice(0, firstStage.correctAnswers.length);

      for (const token of tokensToClick) {
        await clickButton(wrapper, token);
      }
    }

    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("× 不正解");

    // 2問目以降は最後まで正解を選んで進める
    for (let i = 0; i < stages.length; i++) {
      if (i === 0) {
        await clickButton(wrapper, "つぎへ");
        continue;
      }

      const stage = stages[i];
      if (!stage) continue;

      for (const answer of stage.correctAnswers) {
        await clickButton(wrapper, answer);
      }
      await clickButton(wrapper, "回答する");

      if (i === stages.length - 1) {
        await clickButton(wrapper, "結果を見る");
      } else {
        await clickButton(wrapper, "つぎへ");
      }
    }

    expect(shell().attributes("data-screen")).toBe("score");

    const tierTitle = campaignTiers[0]?.title || "";
    const compactTitle = tierTitle.split(" / ")[0]?.trim() || "";

    expect(wrapper.text()).toContain(`${compactTitle} を再挑戦`);

    if (tierTitle.includes("/")) {
      expect(wrapper.text()).not.toContain(`${tierTitle} を再挑戦`);
    }
  });
});
