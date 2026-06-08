<script setup lang="ts">
import { ref, watch, watchEffect } from "vue";
import type { SelectStage, StageSubmission } from "../../types";
import PressButton from "../ui/PressButton.vue";
import StageOutputPanel from "../ui/StageOutputPanel.vue";

interface OptionItem {
    id: string;
    label: string;
}

const props = defineProps<{
    stage: SelectStage;
    locked: boolean;
    resetSignal: number;
    submitSignal: number;
}>();

const emit = defineEmits<{
    (event: "ready-change", value: boolean): void;
    (event: "dirty-change", value: boolean): void;
    (event: "submit", value: StageSubmission): void;
}>();

const optionItems = ref<OptionItem[]>([]);
const selectedIds = ref<string[]>([]);

const shuffle = <T,>(values: T[]): T[] => {
    const next = [...values];

    for (let index = next.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }

    return next;
};

const resetState = () => {
    selectedIds.value = [];
    optionItems.value = shuffle(props.stage.options).map((label, index) => ({
        id: `${props.stage.id}:${index}:${label}`,
        label,
    }));
};

const selectedCount = () => selectedIds.value.length;
const clearSelection = () => {
    selectedIds.value = [];
};

const isSelected = (item: OptionItem) => selectedIds.value.includes(item.id);

const selectedLabels = () =>
    selectedIds.value
        .map((id) => optionItems.value.find((item) => item.id === id)?.label)
        .filter((label): label is string => Boolean(label));

const toggleOption = (item: OptionItem) => {
    if (props.locked) {
        return;
    }

    if (isSelected(item)) {
        selectedIds.value = selectedIds.value.filter((id) => id !== item.id);
        return;
    }

    if (selectedCount() >= props.stage.correctAnswers.length) {
        return;
    }

    selectedIds.value = [...selectedIds.value, item.id];
};

watch(
    () => props.stage.id,
    () => {
        resetState();
    },
    { immediate: true },
);

watchEffect(() => {
    emit("ready-change", selectedCount() === props.stage.correctAnswers.length);
    emit("dirty-change", selectedCount() > 0);
});

watch(
    () => props.submitSignal,
    () => {
        if (
            props.locked ||
            selectedCount() !== props.stage.correctAnswers.length
        ) {
            return;
        }

        const chosen = selectedLabels();
        const correct = props.stage.correctAnswers.every((answer) =>
            chosen.includes(answer),
        );

        emit("submit", {
            correct,
            selectionSummary: chosen.join(" / "),
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
            <span> コード表示エリア</span>
            <span
                >{{ selectedIds.length }}/{{
                    stage.correctAnswers.length
                }}</span
            >
        </div>

        <div class="code-surface space-y-2">
            <div
                v-for="(line, lineIndex) in stage.snippetLines"
                :key="`${stage.id}:${lineIndex}`"
                class="whitespace-pre-wrap"
            >
                {{ line }}
            </div>
        </div>

        <div class="space-y-3">
            <div
                class="flex items-center justify-between text-quiz-muted text-xs"
            >
                <span>選択肢</span>
                <span>{{ stage.correctAnswers.length }} 個選ぶ</span>
            </div>

            <div class="flex flex-wrap gap-3">
                <PressButton
                    v-for="item in optionItems"
                    :key="item.id"
                    tone="secondary"
                    class="px-4 py-3 font-mono text-[13px]"
                    :class="{ 'ring-2 ring-sky-400': isSelected(item) }"
                    :disabled="locked"
                    :aria-pressed="isSelected(item) ? 'true' : 'false'"
                    @click="toggleOption(item)"
                >
                    {{ item.label }}
                </PressButton>
            </div>
        </div>
    </section>
</template>
