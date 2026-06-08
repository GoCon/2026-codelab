<script setup lang="ts">
import { ref, watch, watchEffect } from "vue";
import type { FillStage, StageSubmission } from "../../types";
import PressButton from "../ui/PressButton.vue";
import StageOutputPanel from "../ui/StageOutputPanel.vue";

interface PoolItem {
    id: string;
    label: string;
}

const props = defineProps<{
    stage: FillStage;
    locked: boolean;
    resetSignal: number;
    submitSignal: number;
}>();

const emit = defineEmits<{
    (event: "ready-change", value: boolean): void;
    (event: "dirty-change", value: boolean): void;
    (event: "submit", value: StageSubmission): void;
}>();

const slots = ref<(PoolItem | null)[]>(
    Array.from({ length: props.stage.correctAnswers.length }, () => null),
);
const poolItems = ref<PoolItem[]>([]);

const splitLine = (line: string) => line.split(/(\[\d+\])/).filter(Boolean);
const isSlot = (part: string) => /^\[\d+\]$/.test(part);
const slotIndex = (part: string) => Number(part.slice(1, -1)) - 1;

const shuffle = <T,>(values: T[]): T[] => {
    const next = [...values];

    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
};

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

const slotIsFilled = (item: PoolItem) =>
    slots.value.some((slot) => slot?.id === item.id);

const clearSelection = () => {
    slots.value = Array.from(
        { length: props.stage.correctAnswers.length },
        () => null,
    );
};

const addToken = (item: PoolItem) => {
    if (props.locked || slotIsFilled(item)) {
        return;
    }

    const firstEmpty = slots.value.findIndex((value) => value === null);
    if (firstEmpty === -1) {
        return;
    }

    slots.value[firstEmpty] = item;
};

const removeToken = (index: number) => {
    if (props.locked) {
        return;
    }

    slots.value[index] = null;
};

watch(
    () => props.stage.id,
    () => {
        resetState();
    },
    { immediate: true },
);

watchEffect(() => {
    emit(
        "ready-change",
        slots.value.every((slot) => slot !== null),
    );
    emit(
        "dirty-change",
        slots.value.some((slot) => slot !== null),
    );
});

watch(
    () => props.submitSignal,
    () => {
        if (props.locked || slots.value.some((slot) => slot === null)) {
            return;
        }

        const answer = slots.value.map((slot) => slot!.label);
        emit("submit", {
            correct: answer.every(
                (token, index) => token === props.stage.correctAnswers[index],
            ),
            selectionSummary: answer.join(" "),
        });
    },
);

watch(
    () => props.resetSignal,
    () => {
        if (props.locked) {
            return;
        }

        clearSelection();
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
            <span>コード表示エリア</span>
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
                <span>選択肢プール</span>
                <span>タップで左から挿入</span>
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
