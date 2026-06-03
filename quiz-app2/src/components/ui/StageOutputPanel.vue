<script setup lang="ts">
defineProps<{
    lines: string[];
}>();
</script>

<template>
    <section class="stage-output-panel space-y-3">
        <div class="flex items-center justify-between text-quiz-muted text-xs">
            <span>出力</span>
            <span>正解イメージ</span>
        </div>

        <div class="code-surface space-y-2">
            <div v-for="(line, lineIndex) in lines" :key="lineIndex" class="whitespace-pre-wrap">
                {{ line }}
            </div>
        </div>
    </section>
</template>
