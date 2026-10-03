<script setup lang="ts">
const props = defineProps<{ status: BookingStatus }>()
const meta = computed(() => BOOKING_STATUS_META[props.status])
</script>

<template>
  <UBadge :color="meta.color" variant="subtle" size="lg" :icon="meta.icon" :label="meta.label" />
</template>
