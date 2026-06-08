<script setup lang="ts">
import { ref, computed, watch, inject, type Ref } from "vue";
import type { FillStage, Locale } from "../../types";
import PressButton from "../ui/PressButton.vue";
import StageOutputPanel from "../ui/StageOutputPanel.vue";

const props = defineProps<{
    stage: FillStage;
    locked: boolean;
    resetSignal: number;
    submitSignal: number;
}>();

const emit = defineEmits<{
    (e: "dirty-change", dirty: boolean): void;
    (e: "ready-change", ready: boolean): void;
    (
        e: "submit",
        payload: { correct: boolean; selectionSummary: string },
    ): void;
}>();

const locale = inject<Ref<Locale>>("locale") ?? ref("ja");

interface PoolItem {
    id: string;
    label: string;
}

const slots = ref<(PoolItem | null)[]>([]);
const poolItems = ref<PoolItem[]>([]);

const shuffle = <T,>(array: T[]): T[] => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
};

const splitLine = (line: string) => line.split(/(\[\d+\])/).filter(Boolean);
const isSlot = (part: string) => /^\[\d+\]$/.test(part);
const slotIndex = (part: string) =>
    parseInt(part.replace(/[\[\]]/g, ""), 10) - 1;

// ステージの初期化処理
const resetState = () => {
    slots.value = Array.from(
        { length: props.stage.correctAnswers.length },
        () => null,
    );
    poolItems.value = shuffle(props.stage.pool).map((label, index) => ({
        id: `${props.stage.id}:${index}:${label}`,
        label,
    }));
};

// 選択状態のリセット
const clearSelection = () => {
    slots.value = Array.from(
        { length: props.stage.correctAnswers.length },
        () => null,
    );
};

// ワードが既にスロットに入っているか判定
const slotIsFilled = (item: PoolItem) =>
    slots.value.some((slot) => slot?.id === item.id);

// プールからワードを選んでスロットに追加
const addToken = (item: PoolItem) => {
    if (props.locked) return;
    const index = slots.value.findIndex((s) => s === null);
    if (index !== -1) {
        slots.value[index] = item;
    }
};

// スロットからワードを外す
const removeToken = (index: number) => {
    if (props.locked) return;
    slots.value[index] = null;
};

watch(
    () => props.stage,
    () => {
        resetState();
    },
    { immediate: true },
);

const isDirty = computed(() => slots.value.some((s) => s !== null));
const isReady = computed(() => slots.value.every((s) => s !== null));

watch([isDirty, isReady], ([dirty, ready]) => {
    emit("dirty-change", dirty);
    emit("ready-change", ready);
});

watch(
    () => props.resetSignal,
    () => {
        clearSelection();
    },
);

watch(
    () => props.submitSignal,
    () => {
        const answer = slots.value.map((slot) => slot?.label ?? "");
        emit("submit", {
            correct: answer.every(
                (token, index) => token === props.stage.correctAnswers[index],
            ),
            selectionSummary: answer.join(" "),
        });
    },
);
</script>

<template>
    <section class="surface-card space-y-4 px-3 py-4">
        <StageOutputPanel
            v-if="stage.outputLines.length > 0"
            :lines="stage.outputLines"
        />

        <div class="flex items-center justify-between text-quiz-muted text-xs">
            <span>{{
                locale === "en" ? "Code Display Area" : "コード表示エリア"
            }}</span>
            <span
                >{{ slots.filter(Boolean).length }}/{{
                    stage.correctAnswers.length
                }}</span
            >
        </div>

        <div class="code-surface">
            <div
                v-for="(line, lineIndex) in stage.templateLines"
                :key="lineIndex"
                class="flex flex-wrap items-center gap-2 whitespace-pre-wrap"
            >
                <template
                    v-for="(part, partIndex) in splitLine(line)"
                    :key="`${lineIndex}:${partIndex}`"
                >
                    <button
                        v-if="isSlot(part)"
                        type="button"
                        class="code-slot"
                        :class="{ 'is-filled': slots[slotIndex(part)] }"
                        :disabled="locked || !slots[slotIndex(part)]"
                        @click="removeToken(slotIndex(part))"
                    >
                        {{ slots[slotIndex(part)]?.label ?? part }}
                    </button>
                    <span v-else class="whitespace-pre-wrap">{{ part }}</span>
                </template>
            </div>
        </div>

        <div class="space-y-3">
            <div
                class="flex items-center justify-between text-quiz-muted text-xs"
            >
                <span>{{
                    locale === "en" ? "Word Pool" : "選択肢プール"
                }}</span>
                <span>{{
                    locale === "en"
                        ? "Tap to insert from left"
                        : "タップで左から挿入"
                }}</span>
            </div>

            <div class="flex flex-wrap gap-3">
                <PressButton
                    v-for="item in poolItems"
                    :key="item.id"
                    tone="secondary"
                    :disabled="slotIsFilled(item) || locked"
                    class="px-4 py-3 font-mono text-[13px]"
                    @click="addToken(item)"
                >
                    {{ item.label }}
                </PressButton>
            </div>
        </div>
    </section>
</template>
