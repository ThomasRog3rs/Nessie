<script setup lang="ts">
defineProps<{ sitter: Sitter }>()
</script>

<template>
  <UCard>
    <div class="flex items-start gap-4">
      <UAvatar :alt="sitter.name" size="xl" />
      <div class="min-w-0">
        <p class="text-sm text-muted">Your sitter</p>
        <h2 class="text-xl font-semibold">{{ sitter.name }}</h2>
        <p class="mt-1 text-toned">{{ sitter.bio }}</p>
        <p class="mt-2 font-semibold">
          {{ formatMoney(sitter.rate) }}
          <span class="font-normal text-muted">{{ sitter.rateBasis === 'per_night' ? 'per night' : 'per day' }}</span>
        </p>
      </div>
    </div>
  </UCard>
</template>
