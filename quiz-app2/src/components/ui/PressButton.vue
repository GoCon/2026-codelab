<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
    defineProps<{
        tone?: "primary" | "secondary" | "success" | "danger";
        size?: "md" | "sm";
        block?: boolean;
        disabled?: boolean;
    }>(),
    {
        tone: "primary",
        size: "md",
        block: false,
        disabled: false,
    },
);

const toneClasses = {
    primary: "border-[#fd7045] bg-[#fd7045] text-white shadow-[0_2px_0_0_rgba(16,57,114,0.08)] hover:opacity-90 active:shadow-none",
    secondary: "border-[#103972] bg-white text-[#103972] shadow-[0_2px_0_0_rgba(16,57,114,0.08)] hover:bg-[#edfcff] active:shadow-none",
    success: "border-[#55d3c2] bg-[#55d3c2] text-[#103972] shadow-[0_2px_0_0_rgba(16,57,114,0.08)] hover:opacity-90 active:shadow-none",
    danger: "border-[#fd7045] bg-[#fff4f1] text-[#fd7045] shadow-[0_2px_0_0_rgba(16,57,114,0.08)] hover:bg-[#ffe7df] active:shadow-none",
} as const;

const sizeClasses = {
    md: "min-h-12 px-4 py-3 text-sm",
    sm: "min-h-11 px-3 py-2 text-sm",
} as const;

const buttonClass = computed(() => ["pressable", toneClasses[props.tone], sizeClasses[props.size], props.block ? "w-full" : ""]);
</script>

<template>
    <button type="button" :disabled="disabled" :class="buttonClass">
        <slot />
    </button>
</template>
