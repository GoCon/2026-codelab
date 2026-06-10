import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { nextTick } from "vue";
import App from "../src/App.vue";
import { PREVIEW_UNLOCK_KEYWORD } from "../src/data/stages";

const settle = async () => {
  await nextTick();
  await flushPromises();
  await nextTick();
};

const setViewport = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

const clickExactButton = async (
  wrapper: ReturnType<typeof mount>,
  label: string,
) => {
  const button = wrapper
    .findAll("button")
    .find(
      (candidate) => candidate.text().replace(/\s+/g, " ").trim() === label,
    );

  expect(button, `missing button: ${label}`).toBeTruthy();
  await button!.trigger("click");
  await settle();
};

const unlockPreview = async (wrapper: ReturnType<typeof mount>) => {
  const footer = wrapper.find("footer");
  for (let i = 0; i < 10; i += 1) {
    await footer.trigger("click");
  }
  await settle();

  const keywordInput = wrapper.find('input[placeholder="合言葉を入力"]');
  expect(keywordInput.exists()).toBe(true);
  // ハードコードされていたキーワードをデータから参照
  await keywordInput.setValue(PREVIEW_UNLOCK_KEYWORD);
  await settle();
  await clickExactButton(wrapper, "開く");
};

describe("quiz-app layout shell", () => {
  it("keeps header and footer intact on smartphone screens", async () => {
    setViewport(390);

    const wrapper = mount(App);
    await settle();
    const shell = wrapper.find("[data-screen]");

    expect(shell.exists()).toBe(true);
    expect(shell.classes()).toContain("mx-auto");
    expect(shell.classes()).toContain("max-w-[760px]");
    expect(wrapper.find("header.header").exists()).toBe(true);
    expect(wrapper.find("#language-switch").exists()).toBe(true);
    expect(wrapper.find("#footer-copyright").exists()).toBe(true);
    expect(wrapper.find("#home-card").exists()).toBe(true);
    expect(wrapper.find("#home-chip").text()).toBe("WELCOME");

    await clickExactButton(wrapper, "クイズを始める");

    expect(shell.attributes("data-screen")).toBe("question");
    expect(shell.classes()).toContain("max-w-[448px]");
    expect(shell.classes()).toContain("quiz-shell-wide-panels");
    expect(wrapper.find("header.header").text()).toContain("CodeLab");
    expect(wrapper.find("#header-tagline").text()).toBe(
      "Go の知識を試してみよう！",
    );
    expect(wrapper.find("footer").text()).toContain("Go Conference 2026");
    expect(wrapper.find("footer").text()).toContain("Renée French");
  });

  it("keeps the same bounded shell on desktop screens and preview view", async () => {
    setViewport(1280);

    const wrapper = mount(App);
    await settle();
    const shell = wrapper.find("[data-screen]");
    await unlockPreview(wrapper);
    await clickExactButton(wrapper, "問題一覧を見る");

    expect(shell.attributes("data-screen")).toBe("preview");
    expect(shell.classes()).toContain("max-w-[430px]");
    expect(shell.classes()).toContain("mx-auto");
    expect(wrapper.find("header.header").exists()).toBe(true);
    expect(wrapper.find("#language-switch").exists()).toBe(true);
    expect(wrapper.find("#footer-copyright").exists()).toBe(true);
    expect(wrapper.find("header.header").text()).toContain("CodeLab");
  });
});
