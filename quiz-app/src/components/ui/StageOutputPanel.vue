<script setup lang="ts">
import { inject, ref, type Ref } from "vue";
import type { Locale } from "../../types";

const props = defineProps<{
    lines: string[];
    isFill?: boolean;
    slots?: any[];
    locked?: boolean;
}>();

const emit = defineEmits<{
    (e: "remove-token", index: number): void;
}>();

const locale = inject("locale", ref("ja")) as Ref<Locale>;

// プレースホルダーの解析ロジック
const splitLine = (line: string) => line.split(/(\[\d+\])/).filter(Boolean);
const isSlot = (part: string) => /^\[\d+\]$/.test(part);
const slotIndex = (part: string) =>
    parseInt(part.replace(/[\[\]]/g, ""), 10) - 1;
</script>

<template>
    <section class="stage-output-panel space-y-3">
        <div class="flex items-center justify-between text-quiz-muted text-xs">
            <span>{{ locale === "en" ? "Output" : "出力" }}</span>
            <span>{{
                locale === "en" ? "Expected Result" : "正解イメージ"
            }}</span>
        </div>

        <div class="code-surface space-y-2">
            <div
                v-for="(line, lineIndex) in lines"
                :key="lineIndex"
                class="flex flex-wrap items-center gap-2 whitespace-pre-wrap"
            >
                <template v-if="isFill">
                    <template
                        v-for="(part, partIndex) in splitLine(line)"
                        :key="partIndex"
                    >
                        <button
                            v-if="isSlot(part)"
                            type="button"
                            class="code-slot"
                            :class="{
                                'is-filled': slots && slots[slotIndex(part)],
                            }"
                            :disabled="
                                locked || !slots || !slots[slotIndex(part)]
                            "
                            @click="emit('remove-token', slotIndex(part))"
                        >
                            {{
                                slots && slots[slotIndex(part)]
                                    ? slots[slotIndex(part)].label
                                    : part
                            }}
                        </button>
                        <span v-else>{{ part }}</span>
                    </template>
                </template>
                <template v-else>
                    {{ line }}
                </template>
            </div>
        </div>
    </section>
</template>
