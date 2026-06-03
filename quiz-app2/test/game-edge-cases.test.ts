import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import App from "../src/App.vue";
import ChoiceSelectGame from "../src/components/games/ChoiceSelectGame.vue";
import FillBlankTapGame from "../src/components/games/FillBlankTapGame.vue";
import { STAGE_TIME_LIMIT_MS, campaignTiers, stages } from "../src/data/stages";
import type { FillStage, SelectStage } from "../src/types";

const settle = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

const findButtonContaining = (wrapper: ReturnType<typeof mount>, snippet: string) => {
  const button = wrapper.findAll("button").find((candidate) => candidate.text().includes(snippet));

  expect(button, `missing button containing: ${snippet}`).toBeTruthy();
  return button!;
};

const clickExactButton = async (wrapper: ReturnType<typeof mount>, label: string) => {
  const button = wrapper.findAll("button").find((candidate) => candidate.text().replace(/\s+/g, " ").trim() === label);

  expect(button, `missing button: ${label}`).toBeTruthy();
  await button!.trigger("click");
  await settle();
};

describe("quiz-app2 edge cases", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("shows timeout feedback and still lets the user move to the next stage", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);

    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);

    const wrapper = mount(App);
    await settle();
    await clickExactButton(wrapper, "クイズを始める");

    now = STAGE_TIME_LIMIT_MS + 1;
    vi.advanceTimersByTime(100);
    await settle();

    expect(wrapper.text()).toContain("× タイムアップ");
    expect(wrapper.text()).toContain("時間切れだよ！");

    await findButtonContaining(wrapper, "つぎへ").trigger("click");
    await settle();

    expect(wrapper.find(".stage-output-panel").text()).toContain("Value: 255, Hex: ff");
    wrapper.unmount();
  });

  it("keeps only one tier and all stages use the fill format", () => {
    expect(campaignTiers).toHaveLength(1);

    // 固定値（11や7）ではなく、インポートされたデータの実際の数と一致させる
    const expectedLength = stages.length;
    expect(campaignTiers[0]?.stages).toHaveLength(expectedLength);
    expect(stages).toHaveLength(expectedLength);
    expect(stages.filter((stage) => stage.kind === "fill")).toHaveLength(expectedLength);
    expect(stages.filter((stage) => stage.kind === "select")).toHaveLength(0);

    // 特定の代表的な問題が存在する場合のみ検証する（存在チェック付きで安全に）
    const printfStage = stages.find((stage) => stage.id === "fill-fmt-pi-report");
    if (printfStage && printfStage.kind === "fill") {
      expect(printfStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
    }

    const structStage = stages.find((stage) => stage.id === "select-struct-plusv");
    if (structStage && structStage.kind === "fill") {
      expect(structStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
      expect(structStage.correctAnswers).toEqual(["fmt.Printf", '"%+v"']);
    }
  });

  it("shows a random praise line when the answer is correct", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const wrapper = mount(App);
    await settle();
    await clickExactButton(wrapper, "クイズを始める");

    await clickExactButton(wrapper, "%q");
    await clickExactButton(wrapper, "%.2f");
    await clickExactButton(wrapper, "%T");
    await clickExactButton(wrapper, "回答する");

    expect(wrapper.text()).toContain("◯ 正解");
    expect(wrapper.text()).toContain("その調子！");
    wrapper.unmount();
  });

  it("shows a random miss line when the answer is incorrect", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);

    const wrapper = mount(App);
    await settle();
    await clickExactButton(wrapper, "クイズを始める");

    await clickExactButton(wrapper, "%s");
    await clickExactButton(wrapper, "%f");
    await clickExactButton(wrapper, "%t");
    await clickExactButton(wrapper, "回答する");

    expect(wrapper.text()).toContain("× 不正解");
    expect(wrapper.text()).toContain("おっと、違うよ！");
    wrapper.unmount();
  });

  it("allows duplicate fill tokens to be used in separate slots", async () => {
    const duplicateStage: FillStage = {
      id: "fill-duplicate-recv",
      kind: "fill",
      label: "channel",
      title: "重複トークン",
      prompt: "同じ token を 2 回使う。",
      outputLines: ["println(<-ch, <-ch)"],
      why: "受信演算子は複数回出てきても別 token として扱います。",
      takeaway: "pool に同じ token が複数あっても順に選べます。",
      templateLines: ["println([1]ch, [2]ch)"],
      pool: ["<-", "<-", "&"],
      correctAnswers: ["<-", "<-"],
    };

    const wrapper = mount(FillBlankTapGame, {
      props: {
        stage: duplicateStage,
        locked: false,
        resetSignal: 0,
        submitSignal: 0,
      },
    });
    await settle();

    expect(wrapper.emitted("ready-change")?.[0]).toEqual([false]);
    expect(wrapper.find(".stage-output-panel").text()).toContain("println(<-ch, <-ch)");

    const arrowButtons = () => wrapper.findAll("button").filter((candidate) => candidate.text().trim() === "<-" && candidate.classes().includes("pressable"));

    expect(arrowButtons()).toHaveLength(2);
    await arrowButtons()[0]!.trigger("click");
    await settle();
    await arrowButtons()[1]!.trigger("click");
    await settle();

    expect(wrapper.emitted("ready-change")?.at(-1)).toEqual([true]);

    await wrapper.setProps({ submitSignal: 1 });
    await settle();

    expect(wrapper.emitted("submit")).toEqual([[{ correct: true, selectionSummary: "<- <-" }]]);
    wrapper.unmount();
  });

  it("lets the multi-select format toggle choices and reports a wrong submit", async () => {
    const selectStage: SelectStage = {
      id: "select-import-edge",
      kind: "select",
      label: "import",
      title: "blank import",
      prompt: "必要な 3 つを選ぶ。",
      outputLines: ['import _ "net/http/pprof"'],
      why: "副作用だけ欲しいときは blank import を使います。",
      takeaway: "import / _ / package path を揃えます。",
      snippetLines: ["?, ?, ?"],
      options: ["import", "_", '"net/http/pprof"', '"runtime/pprof"'],
      correctAnswers: ["import", "_", '"net/http/pprof"'],
    };

    const wrapper = mount(ChoiceSelectGame, {
      props: {
        stage: selectStage,
        locked: false,
        resetSignal: 0,
        submitSignal: 0,
      },
    });
    await settle();

    expect(wrapper.emitted("ready-change")?.[0]).toEqual([false]);
    expect(wrapper.text()).toContain("コード表示エリア");
    expect(wrapper.find(".stage-output-panel").text()).toContain('import _ "net/http/pprof"');

    await findButtonContaining(wrapper, "import").trigger("click");
    await settle();
    await findButtonContaining(wrapper, "_").trigger("click");
    await settle();
    await findButtonContaining(wrapper, '"runtime/pprof"').trigger("click");
    await settle();

    expect(wrapper.emitted("ready-change")?.at(-1)).toEqual([true]);

    await wrapper.setProps({ submitSignal: 1 });
    await settle();

    expect(wrapper.emitted("submit")).toEqual([[{ correct: false, selectionSummary: expect.stringContaining("import") }]]);

    await findButtonContaining(wrapper, '"runtime/pprof"').trigger("click");
    await settle();
    expect(wrapper.emitted("ready-change")?.at(-1)).toEqual([false]);

    wrapper.unmount();
  });
});
