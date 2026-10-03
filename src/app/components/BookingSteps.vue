<script setup lang="ts">
defineProps<{ current: 1 | 2 | 3 }>()
const steps = ['Dates', 'Details', 'Review']
</script>

<template>
  <nav aria-label="Booking progress" class="mb-6">
    <ol class="flex items-center gap-2">
      <li
        v-for="(label, i) in steps"
        :key="label"
        class="flex items-center gap-2"
        :aria-current="current === i + 1 ? 'step' : undefined"
      >
        <span
          class="grid size-8 place-items-center rounded-full text-sm font-bold"
          :class="current > i + 1 ? 'bg-primary text-inverted' : current === i + 1 ? 'bg-primary text-inverted ring-4 ring-primary/20' : 'bg-elevated text-muted'"
        >
          <UIcon v-if="current > i + 1" name="i-lucide-check" class="size-4" aria-hidden="true" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="text-sm font-semibold" :class="current === i + 1 ? 'text-highlighted' : 'text-muted'">
          {{ label }}<span class="sr-only">{{ current > i + 1 ? ' (completed)' : current === i + 1 ? ' (current step)' : '' }}</span>
        </span>
        <span v-if="i < steps.length - 1" class="mx-1 h-px w-5 bg-border sm:w-10" aria-hidden="true" />
      </li>
    </ol>
  </nav>
</template>
