<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type Component } from "vue";
import ChoiceSelectGame from "./components/games/ChoiceSelectGame.vue";
import FillBlankTapGame from "./components/games/FillBlankTapGame.vue";
import PressButton from "./components/ui/PressButton.vue";
import {
    FOOTER_TAP_THRESHOLD,
    PREVIEW_UNLOCK_KEYWORD,
    SPECIAL_PAGE_URL,
    STAGE_TIME_LIMIT_MS,
    campaignTiers,
} from "./data/stages";
import type { CampaignTier, Stage, StageSubmission } from "./types";

type Screen = "home" | "question" | "result" | "score" | "preview";

interface StageResult {
    stageId: string;
    correct: boolean;
    score: number;
    timeBonus: number;
    timedOut: boolean;
    feedbackText: string;
    selectionSummary?: string;
}

interface InlineTextPart {
    value: string;
    isCode: boolean;
}

const PREVIEW_STORAGE_KEY = "quiz-app2-preview-unlocked";
const conferenceLogoUrl = new URL(
    "./assets/go-conference-2026-logo.svg",
    import.meta.url,
).href;
const correctFeedbackPhrases = [
    "その調子！",
    "素晴らしい！",
    "完璧！",
    "へえ、やるじゃん",
    "おみごと！",
    "パーフェクト！",
    "ナイスアンサー！",
    "正解！",
] as const;
const timeoutFeedbackPhrases = [
    "時間切れだよ！",
    "チクタク、チクタク...あーあ、時間切れ！",
    "はい、そこまで",
    "ピーッ！試合終了！タイムアップだ！",
    "惜しい！あと少し！",
    "あれ、もう時間？",
    "あー！タイムアップ！",
] as const;
const incorrectFeedbackPhrases = [
    "おっと、違うよ！",
    "ブッブー、残念",
    "不正解！",
    "ブー、ハズレ",
    "ドンマイ！",
    "オーノー！だが気にするな！",
    "ナイストライ！",
    "ん？違うみたい",
    "ざんねーん！",
    "ぶっぶー、違うよ",
] as const;

const pickRandomPhrase = (phrases: readonly string[]) =>
    phrases[Math.floor(Math.random() * phrases.length)] ?? phrases[0] ?? "";

const compactTierTitle = (title: string) =>
    title.split(" / ")[0]?.trim() || title;

const splitInlineCode = (text: string): InlineTextPart[] =>
    text
        .split("`")
        .map((value, index) => ({
            value,
            isCode: index % 2 === 1,
        }))
        .filter((part) => part.value.length > 0);

const componentMap: Record<Stage["kind"], Component> = {
    fill: FillBlankTapGame,
    select: ChoiceSelectGame,
};

const loadPreviewUnlocked = () => {
    try {
        return window.localStorage.getItem(PREVIEW_STORAGE_KEY) === "1";
    } catch {
        return false;
    }
};

const persistPreviewUnlocked = (value: boolean) => {
    try {
        if (value) {
            window.localStorage.setItem(PREVIEW_STORAGE_KEY, "1");
            return;
        }

        window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch {
        // Ignore storage failures and keep the current in-memory state.
    }
};

const screen = ref<Screen>("home");
const currentTierIndex = ref(0);
const highestUnlockedTierIndex = ref(0);
const currentQuestionIndex = ref(0);
const canSubmit = ref(false);
const canReset = ref(false);
const resetSignal = ref(0);
const submitSignal = ref(0);
const currentResult = ref<StageResult | null>(null);
const runResults = ref<StageResult[]>([]);
const remainingMs = ref(STAGE_TIME_LIMIT_MS);
const previewUnlocked = ref(loadPreviewUnlocked());
const specialUnlocked = ref(false);
const keywordModalOpen = ref(false);
const keywordValue = ref("");
const keywordMessage = ref("");
const languageMenuOpen = ref(false);
const selectedLanguage = ref<"ja" | "en">("ja");
const footerTapCount = ref(0);

let timerId: number | null = null;
let startedAt = 0;

const currentTier = computed<CampaignTier | null>(
    () => campaignTiers[currentTierIndex.value] ?? null,
);
const currentStage = computed<Stage | null>(
    () => currentTier.value?.stages[currentQuestionIndex.value] ?? null,
);
const stageWhyParts = computed(() =>
    splitInlineCode(currentStage.value?.why ?? ""),
);
const stageTakeawayParts = computed(() =>
    splitInlineCode(currentStage.value?.takeaway ?? ""),
);
const stageComponent = computed(() =>
    currentStage.value ? componentMap[currentStage.value.kind] : null,
);
const requiresManualSubmit = computed(() => Boolean(currentStage.value));
const tierSize = computed(() => currentTier.value?.stages.length ?? 0);
const runScore = computed(() =>
    runResults.value.reduce((sum, result) => sum + result.score, 0),
);
const runCorrectCount = computed(
    () => runResults.value.filter((result) => result.correct).length,
);
const timerLabel = computed(() => `${(remainingMs.value / 1000).toFixed(1)}s`);
const currentRunPerfect = computed(
    () => tierSize.value > 0 && runCorrectCount.value === tierSize.value,
);
const nextTier = computed(() => {
    const nextIndex = currentTierIndex.value + 1;
    if (highestUnlockedTierIndex.value < nextIndex) {
        return null;
    }

    return campaignTiers[nextIndex] ?? null;
});
const actionHint = computed(() =>
    currentStage.value?.kind === "select"
        ? `必要な選択肢を ${currentStage.value.correctAnswers.length} 個選んでから確定します。`
        : "単語を左から選んでコードを完成させてから確定します。",
);
const feedbackLabel = computed(() => {
    if (!currentResult.value) {
        return "";
    }

    if (currentResult.value.correct) {
        return "◯ 正解";
    }

    return currentResult.value.timedOut ? "× タイムアップ" : "× 不正解";
});
const feedbackTitle = computed(() => {
    if (!currentResult.value) {
        return "";
    }

    return currentResult.value.feedbackText;
});
const resultButtonLabel = computed(() =>
    currentQuestionIndex.value === tierSize.value - 1 ? "結果を見る" : "つぎへ",
);
const manualCtaLabel = computed(() => "回答する");
const headerTagline = computed(() =>
    selectedLanguage.value === "en"
        ? "Test your Go knowledge!"
        : "Go の知識を試してみよう！",
);
const languageToggleLabel = computed(() =>
    selectedLanguage.value === "en" ? "Display language" : "表示言語",
);
const scoreHeadline = computed(() => {
    if (!currentTier.value) {
        return "";
    }

    return currentRunPerfect.value
        ? `${currentTier.value.title} を突破`
        : `${compactTierTitle(currentTier.value.title)} を再挑戦`;
});
const scoreLead = computed(() => {
    if (!currentTier.value) {
        return "";
    }

    if (nextTier.value) {
        return `${nextTier.value.title} が解放されました。次のStageへ進めます。`;
    }

    if (currentRunPerfect.value) {
        return "問題を全て解き切りました。ホームからすぐに再挑戦できます。";
    }

    return "今回の気づきを確認して、同じ問題でもう一度挑戦しましょう。";
});
const summaryRows = computed(
    () =>
        currentTier.value?.stages.map((stage) => ({
            stage,
            result:
                runResults.value.find(
                    (result) => result.stageId === stage.id,
                ) ?? null,
        })) ?? [],
);

const stopTimer = () => {
    if (timerId !== null) {
        window.clearInterval(timerId);
        timerId = null;
    }
};

const resetRunState = () => {
    stopTimer();
    currentQuestionIndex.value = 0;
    runResults.value = [];
    currentResult.value = null;
    canSubmit.value = false;
    canReset.value = false;
    resetSignal.value = 0;
    submitSignal.value = 0;
    remainingMs.value = STAGE_TIME_LIMIT_MS;
};

const syncResult = (result: StageResult) => {
    const existingIndex = runResults.value.findIndex(
        (entry) => entry.stageId === result.stageId,
    );

    if (existingIndex === -1) {
        runResults.value = [...runResults.value, result];
        return;
    }

    const next = [...runResults.value];
    next[existingIndex] = result;
    runResults.value = next;
};

const beginStageTimer = () => {
    stopTimer();

    if (!currentStage.value) {
        return;
    }

    canSubmit.value = false;
    remainingMs.value = STAGE_TIME_LIMIT_MS;
    startedAt = performance.now();
    timerId = window.setInterval(() => {
        const elapsed = performance.now() - startedAt;
        const nextRemaining = Math.max(0, STAGE_TIME_LIMIT_MS - elapsed);

        remainingMs.value = nextRemaining;
        if (nextRemaining === 0) {
            handleTimeout();
        }
    }, 100);
};

const finalizeStage = (submission: StageSubmission, timedOut = false) => {
    if (!currentStage.value || currentResult.value) {
        return;
    }

    stopTimer();

    const timeBonus = submission.correct
        ? Math.round((remainingMs.value / STAGE_TIME_LIMIT_MS) * 600)
        : 0;
    const score = submission.correct ? 400 + timeBonus : 0;
    const feedbackText = submission.correct
        ? pickRandomPhrase(correctFeedbackPhrases)
        : timedOut
          ? pickRandomPhrase(timeoutFeedbackPhrases)
          : pickRandomPhrase(incorrectFeedbackPhrases);
    const result: StageResult = {
        stageId: currentStage.value.id,
        correct: submission.correct,
        score,
        timeBonus,
        timedOut,
        feedbackText,
        selectionSummary: submission.selectionSummary,
    };

    syncResult(result);
    currentResult.value = result;
    canSubmit.value = false;
    screen.value = "result";
};

const handleStageSubmit = (submission: StageSubmission) => {
    finalizeStage(submission, false);
};

const handleTimeout = () => {
    if (currentResult.value || !currentStage.value) {
        return;
    }

    remainingMs.value = 0;
    finalizeStage({ correct: false, selectionSummary: "タイムアップ" }, true);
};

const beginTierRun = (tierIndex: number) => {
    const boundedIndex = Math.max(
        0,
        Math.min(
            tierIndex,
            highestUnlockedTierIndex.value,
            campaignTiers.length - 1,
        ),
    );

    currentTierIndex.value = boundedIndex;
    resetRunState();
    keywordModalOpen.value = false;
    keywordValue.value = "";
    keywordMessage.value = "";
    footerTapCount.value = 0;
    screen.value = "question";
};

const startFromHome = () => {
    beginTierRun(highestUnlockedTierIndex.value);
};

const returnHome = () => {
    resetRunState();
    screen.value = "home";
};

const restartCurrentTier = () => {
    beginTierRun(currentTierIndex.value);
};

const startNextTier = () => {
    if (!nextTier.value) {
        return;
    }

    beginTierRun(currentTierIndex.value + 1);
};

const finishTierRun = () => {
    stopTimer();

    if (currentRunPerfect.value) {
        specialUnlocked.value =
            specialUnlocked.value || Boolean(currentTier.value?.unlocksSpecial);
        if (currentTierIndex.value < campaignTiers.length - 1) {
            highestUnlockedTierIndex.value = Math.max(
                highestUnlockedTierIndex.value,
                currentTierIndex.value + 1,
            );
        }
    }

    screen.value = "score";
};

const goToNextStage = () => {
    if (!currentResult.value) {
        return;
    }

    if (currentQuestionIndex.value === tierSize.value - 1) {
        finishTierRun();
        return;
    }

    currentQuestionIndex.value += 1;
    currentResult.value = null;
    screen.value = "question";
};

const requestStageSubmit = () => {
    if (
        !requiresManualSubmit.value ||
        !canSubmit.value ||
        screen.value !== "question"
    ) {
        return;
    }

    submitSignal.value += 1;
};

const requestStageReset = () => {
    if (
        !requiresManualSubmit.value ||
        !canReset.value ||
        screen.value !== "question"
    ) {
        return;
    }

    resetSignal.value += 1;
};

const openPreviewScreen = () => {
    if (!previewUnlocked.value) {
        return;
    }

    stopTimer();
    screen.value = "preview";
};

const openKeywordModal = () => {
    footerTapCount.value = 0;
    keywordValue.value = "";
    keywordMessage.value = "";
    keywordModalOpen.value = true;
};

const closeKeywordModal = () => {
    keywordModalOpen.value = false;
    keywordValue.value = "";
    keywordMessage.value = "";
};

const submitKeyword = () => {
    if (keywordValue.value.trim() !== PREVIEW_UNLOCK_KEYWORD) {
        keywordMessage.value = "合言葉が違います。";
        return;
    }

    previewUnlocked.value = true;
    persistPreviewUnlocked(true);
    closeKeywordModal();
};

const toggleLanguageMenu = () => {
    languageMenuOpen.value = !languageMenuOpen.value;
};

const selectLanguage = (locale: "ja" | "en") => {
    selectedLanguage.value = locale;
    languageMenuOpen.value = false;
};

const registerFooterTap = () => {
    footerTapCount.value += 1;
    if (footerTapCount.value >= FOOTER_TAP_THRESHOLD) {
        openKeywordModal();
    }
};

watch(screen, () => {
    languageMenuOpen.value = false;
});

watch(
    [screen, currentStage],
    () => {
        if (screen.value === "question" && currentStage.value) {
            beginStageTimer();
            return;
        }

        stopTimer();
        if (screen.value !== "question") {
            canSubmit.value = false;
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => {
    stopTimer();
});
</script>

<template>
    <div class="quiz-theme min-h-[100svh]">
        <header class="header">
            <div class="header-logo">
                <div class="header-brand">
                    <img
                        class="header-conference-logo"
                        :src="conferenceLogoUrl"
                        alt="Go Conference 2026"
                    />
                    <span class="header-product-mark">CodeLab</span>
                </div>
                <span class="header-tagline" id="header-tagline">{{
                    headerTagline
                }}</span>
            </div>
            <div class="header-actions">
                <div
                    class="language-switch"
                    :class="{ open: languageMenuOpen }"
                    id="language-switch"
                >
                    <button
                        class="language-toggle"
                        id="language-toggle-btn"
                        type="button"
                        :aria-label="languageToggleLabel"
                        aria-haspopup="true"
                        aria-controls="language-menu"
                        :aria-expanded="languageMenuOpen ? 'true' : 'false'"
                        :title="languageToggleLabel"
                        @click="toggleLanguageMenu"
                    >
                        <svg
                            class="language-toggle-icon"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                            focusable="false"
                        >
                            <path
                                d="M12 2.75c5.108 0 9.25 4.142 9.25 9.25S17.108 21.25 12 21.25 2.75 17.108 2.75 12 6.892 2.75 12 2.75Zm0 0c1.98 0 3.75 4.142 3.75 9.25S13.98 21.25 12 21.25 8.25 17.108 8.25 12 10.02 2.75 12 2.75Zm-8.9 6.5h17.8M3.1 14.75h17.8M12 2.75V21.25"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            />
                        </svg>
                        <span class="sr-only" id="language-toggle-label">{{
                            languageToggleLabel
                        }}</span>
                    </button>
                    <div
                        class="language-menu"
                        :class="{ open: languageMenuOpen }"
                        id="language-menu"
                    >
                        <button
                            class="language-menu-item"
                            :class="{ active: selectedLanguage === 'ja' }"
                            id="lang-ja-btn"
                            type="button"
                            @click="selectLanguage('ja')"
                        >
                            日本語
                        </button>
                        <button
                            class="language-menu-item"
                            :class="{ active: selectedLanguage === 'en' }"
                            id="lang-en-btn"
                            type="button"
                            @click="selectLanguage('en')"
                        >
                            English
                        </button>
                    </div>
                </div>
            </div>
        </header>

        <div
            class="quiz-shell mx-auto flex min-h-[100svh] w-full flex-col"
            :class="
                screen === 'home'
                    ? 'max-w-[760px]'
                    : screen === 'question' || screen === 'result'
                      ? 'max-w-[448px] quiz-shell-wide-panels'
                      : 'max-w-[430px]'
            "
            :data-screen="screen"
        >
            <template v-if="screen === 'home'">
                <main class="top-page-main">
                    <div class="card" id="home-card">
                        <div class="chip" id="home-chip">WELCOME</div>
                        <h1 class="home-title">Go Conference 2026 CodeLab</h1>
                        <p class="home-lead" id="home-lead">
                            Go Conference 2026 CodeLabへようこそ！<br />
                            さあ、レッスンを始めよう！難しく考えずに、ピンときた答えを選んでみてね！
                        </p>

                        <div class="home-actions">
                            <button
                                class="c-button"
                                id="start-btn"
                                type="button"
                                @click="startFromHome"
                            >
                                クイズを始める
                            </button>
                        </div>

                        <div v-if="previewUnlocked" id="preview-entry">
                            <button
                                class="c-button"
                                data-variant="tertiary"
                                id="preview-btn"
                                type="button"
                                @click="openPreviewScreen"
                            >
                                問題一覧を見る
                            </button>
                            <p class="unlock-note" id="unlock-note">
                                このブラウザでは問題一覧モードが解放されています。
                            </p>
                        </div>
                    </div>
                </main>
            </template>

            <template v-else-if="screen === 'preview'">
                <div class="flex flex-1 flex-col gap-4">
                    <section class="surface-card p-5">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <span class="info-pill">問題一覧</span>
                                <h1
                                    class="display-title mt-4 text-[30px] leading-tight"
                                >
                                    問題一覧
                                </h1>
                                <p
                                    class="mt-3 text-quiz-body text-sm leading-6"
                                >
                                    問題一覧は hidden keyword
                                    でのみ開きます。今回の 7 問と 2
                                    種類の出題形式を 先に確認できます。
                                </p>
                            </div>
                            <PressButton
                                tone="secondary"
                                size="sm"
                                @click="returnHome"
                            >
                                閉じる
                            </PressButton>
                        </div>
                    </section>

                    <section
                        v-for="tier in campaignTiers"
                        :key="tier.id"
                        class="surface-card p-4"
                    >
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <span class="info-pill">{{
                                    tier.difficultyLabel
                                }}</span>
                                <h2
                                    class="mt-3 text-lg font-semibold text-quiz-strong"
                                >
                                    {{ tier.title }}
                                </h2>
                                <p
                                    class="mt-2 text-quiz-body text-sm leading-6"
                                >
                                    {{ tier.description }}
                                </p>
                            </div>
                            <div class="surface-subpanel px-3 py-3 text-center">
                                <p
                                    class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                >
                                    問題数
                                </p>
                                <p
                                    class="mt-1 text-2xl font-semibold text-quiz-strong"
                                >
                                    {{ tier.stages.length }}
                                </p>
                            </div>
                        </div>

                        <div class="mt-4 space-y-3">
                            <article
                                v-for="stage in tier.stages"
                                :key="stage.id"
                                class="surface-subpanel px-4 py-4"
                            >
                                <div
                                    class="flex items-start justify-between gap-3"
                                >
                                    <div class="min-w-0">
                                        <p
                                            class="text-quiz-strong text-sm font-semibold"
                                        >
                                            {{ stage.title }}
                                        </p>
                                        <p class="mt-1 text-quiz-muted text-xs">
                                            {{ stage.label }}
                                        </p>
                                    </div>
                                    <span
                                        class="text-quiz-muted text-xs uppercase tracking-[0.2em]"
                                    >
                                        {{ stage.kind }}
                                    </span>
                                </div>
                                <p class="problem-copy mt-3">
                                    {{ stage.prompt }}
                                </p>
                                <p
                                    class="mt-3 text-quiz-body text-xs leading-5"
                                >
                                    {{ stage.takeaway }}
                                </p>
                            </article>
                        </div>
                    </section>
                </div>
            </template>

            <template
                v-else-if="
                    (screen === 'question' || screen === 'result') &&
                    currentTier &&
                    currentStage &&
                    stageComponent
                "
            >
                <header>
                    <section class="progress-panel px-3 py-1.5">
                        <div class="grid grid-cols-2 gap-1">
                            <div class="progress-metric px-2 py-1 text-left">
                                <p
                                    class="text-quiz-muted text-[8px] uppercase tracking-[0.18em]"
                                >
                                    スコア
                                </p>
                                <p
                                    class="mt-0 text-lg font-semibold leading-none text-quiz-strong"
                                >
                                    {{ runScore }}
                                </p>
                            </div>

                            <div class="progress-metric px-2 py-1 text-right">
                                <p
                                    class="text-quiz-muted text-[8px] uppercase tracking-[0.18em]"
                                >
                                    タイム
                                </p>
                                <p
                                    class="mt-0 text-lg font-semibold leading-none text-quiz-strong"
                                >
                                    {{ timerLabel }}
                                </p>
                            </div>
                        </div>

                        <div class="mt-1 flex gap-1">
                            <span
                                v-for="(stage, index) in currentTier.stages"
                                :key="stage.id"
                                class="h-1 flex-1 rounded-full transition-all duration-200"
                                :class="
                                    index < runResults.length
                                        ? 'bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.35)]'
                                        : index === currentQuestionIndex
                                          ? 'bg-white/60'
                                          : 'bg-white/10'
                                "
                            />
                        </div>
                    </section>
                </header>

                <main class="mt-4 flex flex-1 flex-col gap-4">
                    <Transition name="stage" mode="out-in">
                        <component
                            :is="stageComponent"
                            :key="currentStage.id"
                            :stage="currentStage"
                            :locked="screen === 'result'"
                            :reset-signal="resetSignal"
                            :submit-signal="submitSignal"
                            @dirty-change="canReset = $event"
                            @ready-change="canSubmit = $event"
                            @submit="handleStageSubmit"
                        />
                    </Transition>

                    <Transition name="drawer">
                        <section
                            v-if="screen === 'result' && currentResult"
                            class="surface-card p-4"
                        >
                            <div class="flex items-start justify-between gap-3">
                                <div class="min-w-0">
                                    <span
                                        class="feedback-chip"
                                        :class="
                                            currentResult.correct
                                                ? 'feedback-chip-success'
                                                : 'feedback-chip-danger'
                                        "
                                    >
                                        {{ feedbackLabel }}
                                    </span>
                                    <h2
                                        class="mt-3 text-lg font-semibold text-quiz-strong"
                                    >
                                        {{ feedbackTitle }}
                                    </h2>
                                    <p
                                        class="mt-2 text-quiz-body text-sm leading-6"
                                    >
                                        <template
                                            v-for="(
                                                part, index
                                            ) in stageWhyParts"
                                            :key="`why:${currentStage.id}:${index}`"
                                        >
                                            <code
                                                v-if="part.isCode"
                                                class="explanation-inline-code"
                                            >
                                                {{ part.value }}
                                            </code>
                                            <span v-else>{{ part.value }}</span>
                                        </template>
                                    </p>
                                </div>

                                <div
                                    class="surface-subpanel min-w-[88px] px-3 py-3 text-center"
                                >
                                    <p
                                        class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                    >
                                        Gain
                                    </p>
                                    <p
                                        class="mt-1 text-2xl font-semibold text-quiz-strong"
                                    >
                                        {{ currentResult.score }}
                                    </p>
                                </div>
                            </div>

                            <div class="surface-subpanel mt-4 p-4">
                                <p
                                    class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                >
                                    ポイント
                                </p>
                                <p
                                    class="mt-2 text-quiz-body text-sm leading-6"
                                >
                                    <template
                                        v-for="(
                                            part, index
                                        ) in stageTakeawayParts"
                                        :key="`takeaway:${currentStage.id}:${index}`"
                                    >
                                        <code
                                            v-if="part.isCode"
                                            class="explanation-inline-code"
                                        >
                                            {{ part.value }}
                                        </code>
                                        <span v-else>{{ part.value }}</span>
                                    </template>
                                </p>
                            </div>

                            <div
                                v-if="currentStage.playgroundUrl"
                                class="surface-subpanel mt-4 p-4"
                            >
                                <p
                                    class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                >
                                    Go Playground
                                </p>
                                <p
                                    class="mt-2 text-quiz-body text-sm leading-6"
                                >
                                    正解コードを Go Playground
                                    で開いて、そのまま実行できます。
                                </p>
                                <a
                                    :href="currentStage.playgroundUrl"
                                    target="_blank"
                                    rel="noreferrer noopener"
                                    class="primary-link-button playground-link-button mt-4"
                                >
                                    正解コードを実行する
                                </a>
                            </div>
                        </section>
                    </Transition>

                    <div class="mt-auto">
                        <section class="surface-card p-3">
                            <PressButton
                                v-if="screen === 'result' && currentResult"
                                block
                                tone="primary"
                                @click="goToNextStage"
                            >
                                {{ resultButtonLabel }}
                            </PressButton>

                            <template v-else-if="requiresManualSubmit">
                                <div class="grid grid-cols-2 gap-3">
                                    <PressButton
                                        block
                                        tone="secondary"
                                        :disabled="!canReset"
                                        @click="requestStageReset"
                                    >
                                        リセット
                                    </PressButton>
                                    <PressButton
                                        block
                                        tone="primary"
                                        :disabled="!canSubmit"
                                        @click="requestStageSubmit"
                                    >
                                        {{ manualCtaLabel }}
                                    </PressButton>
                                </div>
                                <p
                                    class="mt-3 px-2 text-center text-quiz-body text-xs leading-5"
                                >
                                    {{ actionHint }}
                                </p>
                            </template>

                            <div
                                v-else
                                class="surface-subpanel px-4 py-3 text-center text-quiz-body text-sm leading-6"
                            >
                                {{ actionHint }}
                            </div>
                        </section>
                    </div>
                </main>
            </template>

            <template v-else-if="screen === 'score' && currentTier">
                <div class="flex flex-1 flex-col gap-4">
                    <section class="surface-card p-5">
                        <span class="info-pill">{{
                            currentTier.difficultyLabel
                        }}</span>
                        <h1
                            class="display-title mt-4 text-[32px] leading-tight"
                        >
                            {{ scoreHeadline }}
                        </h1>
                        <p class="mt-3 text-quiz-body text-sm leading-6">
                            {{ scoreLead }}
                        </p>

                        <div class="mt-5 grid grid-cols-3 gap-3">
                            <div class="surface-subpanel px-3 py-4 text-center">
                                <p
                                    class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                >
                                    スコア
                                </p>
                                <p
                                    class="mt-2 text-2xl font-semibold text-quiz-strong"
                                >
                                    {{ runScore }}
                                </p>
                            </div>
                            <div class="surface-subpanel px-3 py-4 text-center">
                                <p
                                    class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                >
                                    正解
                                </p>
                                <p
                                    class="mt-2 text-2xl font-semibold text-quiz-strong"
                                >
                                    {{ runCorrectCount }}/{{ tierSize }}
                                </p>
                            </div>
                            <div class="surface-subpanel px-3 py-4 text-center">
                                <p
                                    class="text-quiz-muted text-[10px] uppercase tracking-[0.24em]"
                                >
                                    次
                                </p>
                                <p
                                    class="mt-2 text-quiz-strong text-sm font-semibold"
                                >
                                    {{
                                        nextTier
                                            ? nextTier.difficultyLabel
                                            : "完了"
                                    }}
                                </p>
                            </div>
                        </div>
                    </section>

                    <section v-if="specialUnlocked" class="surface-card p-4">
                        <span class="info-pill">スペシャル解放</span>
                        <h2 class="mt-3 text-lg font-semibold text-quiz-strong">
                            7 問を全問正解しました
                        </h2>
                        <p class="mt-2 text-quiz-body text-sm leading-6">
                            このセットを全問正解するとスペシャルページへ進めます。
                        </p>
                        <a
                            :href="SPECIAL_PAGE_URL"
                            target="_blank"
                            rel="noreferrer"
                            class="primary-link-button mt-4"
                        >
                            スペシャルページへ
                        </a>
                    </section>

                    <section class="surface-card p-4">
                        <div class="space-y-3">
                            <article
                                v-for="{ stage, result } in summaryRows"
                                :key="stage.id"
                                class="surface-subpanel flex items-center justify-between gap-3 px-4 py-3"
                            >
                                <div class="min-w-0">
                                    <p
                                        class="text-quiz-strong text-sm font-semibold"
                                    >
                                        {{ stage.title }}
                                    </p>
                                    <p class="mt-1 text-quiz-muted text-xs">
                                        {{ stage.label }}
                                    </p>
                                </div>

                                <div class="text-right">
                                    <p
                                        class="text-sm font-semibold"
                                        :class="
                                            result?.correct
                                                ? 'text-quiz-success'
                                                : 'text-quiz-danger'
                                        "
                                    >
                                        {{ result?.correct ? "正解" : "未達" }}
                                    </p>
                                    <p class="mt-1 text-quiz-muted text-xs">
                                        {{ result?.score ?? 0 }} pt
                                    </p>
                                </div>
                            </article>
                        </div>
                    </section>

                    <section class="surface-card p-3">
                        <div class="space-y-3">
                            <PressButton
                                v-if="nextTier"
                                block
                                tone="primary"
                                @click="startNextTier"
                            >
                                次のレベルへ
                            </PressButton>
                            <PressButton
                                v-else
                                block
                                tone="primary"
                                @click="restartCurrentTier"
                            >
                                同じレベルでもう一度
                            </PressButton>
                            <PressButton
                                v-if="nextTier"
                                block
                                tone="secondary"
                                @click="restartCurrentTier"
                            >
                                このレベルを再挑戦
                            </PressButton>
                            <PressButton
                                block
                                tone="secondary"
                                @click="returnHome"
                            >
                                ホームへ戻る
                            </PressButton>
                            <PressButton
                                v-if="previewUnlocked"
                                block
                                tone="secondary"
                                @click="openPreviewScreen"
                            >
                                問題一覧を見る
                            </PressButton>
                        </div>
                    </section>
                </div>
            </template>
        </div>

        <div class="footer-gradient"></div>
        <footer id="footer-copyright" @click="registerFooterTap">
            <div class="footer-info">
                <div class="logo-container">
                    <img
                        class="footer-logo"
                        :src="conferenceLogoUrl"
                        alt="Go Conference 2026"
                    />
                    <span>Go Conference 2026</span>
                </div>
                <p class="copyright" id="footer-attribution">
                    The Go gopher was designed by
                    <a href="https://reneefrench.blogspot.com/">Renée French</a
                    >. Illustrations by
                    <a href="https://x.com/avocadoneko">avocadoneko</a>.
                </p>
            </div>
        </footer>

        <Transition name="drawer">
            <div
                v-if="keywordModalOpen"
                class="fixed inset-0 z-50 flex items-end bg-slate-950/80 backdrop-blur-sm sm:items-center sm:justify-center"
            >
                <div
                    class="app-modal-card w-full max-w-[430px] rounded-b-none p-5 sm:rounded-[16px]"
                >
                    <span class="info-pill">合言葉</span>
                    <h2 class="mt-4 text-quiz-strong text-xl font-semibold">
                        問題一覧を開く
                    </h2>
                    <p class="mt-2 text-quiz-body text-sm leading-6">
                        正しい合言葉を入力したときだけ preview /
                        問題一覧が解放されます。
                    </p>

                    <label
                        class="mt-4 block text-quiz-muted text-xs uppercase tracking-[0.24em]"
                    >
                        合言葉
                    </label>
                    <input
                        v-model="keywordValue"
                        type="text"
                        autocomplete="off"
                        spellcheck="false"
                        placeholder="合言葉を入力"
                        class="quiz-input mt-2 text-sm"
                        @keydown.enter.prevent="submitKeyword"
                    />

                    <p
                        v-if="keywordMessage"
                        class="mt-3 text-quiz-danger text-sm"
                    >
                        {{ keywordMessage }}
                    </p>

                    <div class="mt-4 grid gap-3">
                        <PressButton
                            block
                            tone="primary"
                            @click="submitKeyword"
                        >
                            開く
                        </PressButton>
                        <PressButton
                            block
                            tone="secondary"
                            @click="closeKeywordModal"
                        >
                            閉じる
                        </PressButton>
                    </div>
                </div>
            </div>
        </Transition>
    </div>
</template>
