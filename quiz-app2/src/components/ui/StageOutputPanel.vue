<script setup lang="ts">
import { inject, ref, type Ref } from "vue";
import type { Locale } from "../../types";

defineProps<{
    lines: string[];
}>();

// App.vue から言語設定を受け取る
const locale = inject<Ref<Locale>>("locale") ?? ref("ja");
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
                class="whitespace-pre-wrap"
            >
                {{ line }}
            </div>
        </div>
    </section>
</template>
