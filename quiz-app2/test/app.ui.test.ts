import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import App from "../src/App.vue";
import { STAGE_TIME_LIMIT_MS, stages } from "../src/data/stages";

const settle = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

const normalizeText = (value: string) => value.replace(/\s+/g, " ").trim();

const findEnabledButton = (wrapper: ReturnType<typeof mount>, label: string) => {
  const button = wrapper.findAll("button").find((candidate) => !candidate.attributes("disabled") && normalizeText(candidate.text()) === label);

  expect(button, `missing button: ${label}`).toBeTruthy();
  return button!;
};

const hasEnabledButton = (wrapper: ReturnType<typeof mount>, label: string) => wrapper.findAll("button").some((candidate) => !candidate.attributes("disabled") && normalizeText(candidate.text()) === label);

const findEnabledButtonContaining = (wrapper: ReturnType<typeof mount>, snippet: string) => {
  const button = wrapper.findAll("button").find((candidate) => !candidate.attributes("disabled") && candidate.text().includes(snippet));

  expect(button, `missing button containing: ${snippet}`).toBeTruthy();
  return button!;
};

const clickButton = async (wrapper: ReturnType<typeof mount>, label: string) => {
  await findEnabledButton(wrapper, label).trigger("click");
  await settle();
};

const clickButtonContaining = async (wrapper: ReturnType<typeof mount>, snippet: string) => {
  await findEnabledButtonContaining(wrapper, snippet).trigger("click");
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
    expect(wrapper.find("header").exists()).toBe(true);
    expect(wrapper.find("footer").exists()).toBe(true);
    expect(wrapper.text()).toContain("Go Conference 2026 CodeLab");
    expect(hasEnabledButton(wrapper, "問題一覧を見る")).toBe(false);

    await clickButton(wrapper, "クイズを始める");
    expect(shell().attributes("data-screen")).toBe("question");
    expect(wrapper.find("header.header").text()).toContain("CodeLab");
    expect(wrapper.find(".progress-panel").text()).toContain("スコア");
    expect(wrapper.find(".progress-panel").text()).toContain("タイム");
    expect(wrapper.find(".progress-panel").text()).not.toContain("Name / Value / Type");
    expect(wrapper.text()).not.toContain("Name / Value / Type");
    expect(wrapper.text()).not.toContain('Name: "pi", Value: 3.14, Type: float64 を出す 3 か所。');
    expect(wrapper.find(".stage-output-panel").text()).toContain("出力");
    expect(wrapper.find(".stage-output-panel").text()).toContain('Name: "pi", Value: 3.14, Type: float64');
    expect(wrapper.text()).toContain(`${(STAGE_TIME_LIMIT_MS / 1000).toFixed(1)}s`);
    expect(findButton(wrapper, "リセット").classes()).toContain("bg-white");

    await clickButton(wrapper, "%q");
    expect(wrapper.text()).toContain("1/3");
    await clickButton(wrapper, "リセット");
    expect(wrapper.text()).toContain("0/3");
    await clickButton(wrapper, "%q");
    await clickButton(wrapper, "%.2f");
    await clickButton(wrapper, "%T");
    await clickButton(wrapper, "回答する");
    expect(shell().attributes("data-screen")).toBe("result");
    expect(wrapper.text()).toContain("◯ 正解");
    const explanationCodeTokens = wrapper.findAll("code.explanation-inline-code").map((node) => normalizeText(node.text()));
    expect(explanationCodeTokens).toEqual(expect.arrayContaining(["%q", "%.2f", "%T"]));
    const playgroundLink = wrapper.find("a.playground-link-button");
    expect(playgroundLink.exists()).toBe(true);
    expect(playgroundLink.attributes("href")).toBe(stages[0]?.playgroundUrl);
    expect(playgroundLink.text()).toBe("正解コードを実行する");

    await clickButton(wrapper, "つぎへ");
    expect(wrapper.find(".stage-output-panel").text()).toContain("Value: 255, Hex: ff");

    await clickButton(wrapper, "%d");
    await clickButton(wrapper, "%x");
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("◯ 正解");

    await clickButton(wrapper, "つぎへ");
    expect(wrapper.find(".stage-output-panel").text()).toContain("Age: 20, Name: Alice");

    await clickButton(wrapper, "%[2]d");
    await clickButton(wrapper, "%[1]s");
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("◯ 正解");

    await clickButton(wrapper, "つぎへ");
    expect(wrapper.find(".stage-output-panel").text()).toContain("42");

    await clickButton(wrapper, "<-chan");
    await clickButton(wrapper, "<-");
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("◯ 正解");

    await clickButton(wrapper, "つぎへ");
    expect(wrapper.find(".stage-output-panel").text()).toContain("{Name:Gopher Age:10}");

    await clickButton(wrapper, "fmt.Printf");
    await clickButton(wrapper, '"%+v"');
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("◯ 正解");

    await clickButton(wrapper, "つぎへ");
    expect(wrapper.find(".stage-output-panel").exists()).toBe(false);

    await clickButton(wrapper, "result,");
    await clickButton(wrapper, "err");
    await clickButton(wrapper, ":=");
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("◯ 正解");

    await clickButton(wrapper, "つぎへ");
    expect(wrapper.find(".stage-output-panel").exists()).toBe(false);

    await clickButton(wrapper, "_");
    await clickButton(wrapper, '"net/http/pprof"');
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("◯ 正解");

    await clickButton(wrapper, "結果を見る");
    expect(shell().attributes("data-screen")).toBe("score");
    expect(wrapper.text()).toContain("Tier 1 / Warm-up を突破");
    expect(wrapper.text()).toContain("7/7");
    expect(wrapper.text()).toContain("スペシャルページへ");
    expect(wrapper.text()).not.toContain("問題一覧を見る");
    expect(hasEnabledButton(wrapper, "次のレベルへ")).toBe(false);

    await clickButton(wrapper, "同じレベルでもう一度");
    expect(shell().attributes("data-screen")).toBe("question");
    expect(wrapper.text()).not.toContain("Name / Value / Type");
    expect(wrapper.text()).not.toContain('Name: "pi", Value: 3.14, Type: float64 を出す 3 か所。');
    expect(wrapper.find(".progress-panel").text()).not.toContain("Name / Value / Type");
    expect(wrapper.find(".stage-output-panel").text()).toContain('Name: "pi", Value: 3.14, Type: float64');
    expect(wrapper.find("footer").text()).toContain("Go Conference 2026");
  });

  it("unlocks the preview list only through the hidden keyword flow", async () => {
    const wrapper = mount(App);
    await settle();
    const shell = () => wrapper.find("[data-screen]");

    expect(shell().attributes("data-screen")).toBe("home");
    expect(hasEnabledButton(wrapper, "問題一覧を見る")).toBe(false);

    await unlockPreview(wrapper);

    expect(hasEnabledButton(wrapper, "問題一覧を見る")).toBe(true);
    await clickButton(wrapper, "問題一覧を見る");

    expect(shell().attributes("data-screen")).toBe("preview");
    expect(wrapper.find("header").exists()).toBe(true);
    expect(wrapper.find("footer").exists()).toBe(true);
    expect(wrapper.text()).toContain("Tier 1 / Warm-up");
    expect(wrapper.text()).toContain("Name / Value / Type");
    expect(wrapper.text()).toContain("構造体の field 名");
    expect(wrapper.text()).not.toContain("Tier 5 / Advanced Traps");
    expect(wrapper.text()).not.toContain("t.Fatal の場所");
    await clickButtonContaining(wrapper, "閉じる");
    expect(shell().attributes("data-screen")).toBe("home");
  });

  it("shows the retry headline without the tier subtitle on an imperfect clear", async () => {
    const wrapper = mount(App);
    await settle();
    const shell = () => wrapper.find("[data-screen]");

    await clickButton(wrapper, "クイズを始める");

    await clickButton(wrapper, "%q");
    await clickButton(wrapper, "%f");
    await clickButton(wrapper, "%T");
    await clickButton(wrapper, "回答する");
    expect(wrapper.text()).toContain("× 不正解");

    await clickButton(wrapper, "つぎへ");
    await clickButton(wrapper, "%d");
    await clickButton(wrapper, "%x");
    await clickButton(wrapper, "回答する");
    await clickButton(wrapper, "つぎへ");

    await clickButton(wrapper, "%[2]d");
    await clickButton(wrapper, "%[1]s");
    await clickButton(wrapper, "回答する");
    await clickButton(wrapper, "つぎへ");

    await clickButton(wrapper, "<-chan");
    await clickButton(wrapper, "<-");
    await clickButton(wrapper, "回答する");
    await clickButton(wrapper, "つぎへ");

    await clickButton(wrapper, "fmt.Printf");
    await clickButton(wrapper, '"%+v"');
    await clickButton(wrapper, "回答する");
    await clickButton(wrapper, "つぎへ");

    await clickButton(wrapper, "result,");
    await clickButton(wrapper, "err");
    await clickButton(wrapper, ":=");
    await clickButton(wrapper, "回答する");
    await clickButton(wrapper, "つぎへ");

    await clickButton(wrapper, "_");
    await clickButton(wrapper, '"net/http/pprof"');
    await clickButton(wrapper, "回答する");
    await clickButton(wrapper, "結果を見る");

    expect(shell().attributes("data-screen")).toBe("score");
    expect(wrapper.text()).toContain("Tier 1 を再挑戦");
    expect(wrapper.text()).not.toContain("Tier 1 / Warm-up を再挑戦");
  });
});
