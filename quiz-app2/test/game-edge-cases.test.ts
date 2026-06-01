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
    expect(campaignTiers[0]?.stages).toHaveLength(7);
    expect(stages).toHaveLength(7);
    expect(stages.filter((stage) => stage.kind === "fill")).toHaveLength(7);
    expect(stages.filter((stage) => stage.kind === "select")).toHaveLength(0);
    expect(stages.find((stage) => stage.id === "fill-fmt-pi-report")?.kind).toBe("fill");
    expect(stages.find((stage) => stage.id === "select-struct-plusv")?.kind).toBe("fill");
    expect(campaignTiers[0]?.title).toBe("Tier 1 / Warm-up");

    const printfStage = stages.find((stage) => stage.id === "fill-fmt-pi-report");
    expect(printfStage?.kind).toBe("fill");
    if (printfStage?.kind === "fill") {
      expect(printfStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
      expect(printfStage.templateLines).toEqual(["pi := 3.14159", 'name := "pi"', "fmt.Printf(", "  strings.Join([]string{", '    "Name: [1], ",', '    "Value: [2], ",', '    "Type: [3]",', '  }, ""),', "  name,", "  pi,", "  pi,", ")"]);
    }

    const channelStage = stages.find((stage) => stage.id === "fill-channel-recv-only");
    expect(channelStage?.kind).toBe("fill");
    if (channelStage?.kind === "fill") {
      expect(channelStage.outputLines).toEqual(["42"]);
      expect(channelStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
      expect(channelStage.templateLines).toEqual(["func show_ch(ch [1] int) {", "  println([2]ch)", "}", "", "func main() {", "  ch := make(chan int, 1)", "  ch <- 42", "  show_ch(ch)", "}"]);
    }

    const structStage = stages.find((stage) => stage.id === "select-struct-plusv");
    expect(structStage?.kind).toBe("fill");
    if (structStage?.kind === "fill") {
      expect(structStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
      expect(structStage.outputLines).toEqual(["{Name:Gopher Age:10}"]);
      expect(structStage.templateLines).toEqual(['gopher := Gopher{Name: "Gopher", Age: 10}', "[1]([2], gopher)"]);
      expect(structStage.pool).toEqual(["fmt.Printf", "fmt.Print", "fmt.Println", '"%v"', '"%T"', '"%+v"']);
      expect(structStage.correctAnswers).toEqual(["fmt.Printf", '"%+v"']);
    }

    const errStage = stages.find((stage) => stage.id === "select-result-error-shortdecl");
    expect(errStage?.kind).toBe("fill");
    if (errStage?.kind === "fill") {
      expect(errStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
      expect(errStage.outputLines).toEqual([]);
      expect(errStage.templateLines).toEqual(["[1] [2] [3] calc(a, b)", "if err != nil {", "  fmt.Println(err)", "}", "fmt.Println(result)"]);
      expect(errStage.pool).toEqual(["result,", "err", ":=", "=", "panic(err)"]);
    }

    const importStage = stages.find((stage) => stage.id === "select-blank-import-pprof");
    expect(importStage?.kind).toBe("fill");
    if (importStage?.kind === "fill") {
      expect(importStage.playgroundUrl).toMatch(/^https:\/\/go\.dev\/play\//);
      expect(importStage.outputLines).toEqual([]);
      expect(importStage.templateLines).toEqual(["import [1] [2]"]);
      expect(importStage.pool).toEqual(["_", '"net/http/pprof"', '"runtime/pprof"', "."]);
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
