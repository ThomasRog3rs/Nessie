<script setup lang="ts">
const items = [
  { label: 'Book', to: '/book', icon: 'i-lucide-calendar-plus' },
  { label: 'My bookings', to: '/bookings', icon: 'i-lucide-calendar-check' },
  { label: 'My details', to: '/account', icon: 'i-lucide-user-round' },
]
</script>

<template>
  <div class="min-h-dvh">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-default focus:px-4 focus:py-3 focus:font-semibold focus:shadow-lg"
    >
      Skip to main content
    </a>

    <header class="sticky top-0 z-30 border-b border-default bg-default/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <NuxtLink to="/" class="font-display text-2xl font-semibold text-primary" aria-label="Nesse home">
          Nesse
        </NuxtLink>
        <nav aria-label="Main" class="hidden gap-1 sm:flex">
          <NuxtLink
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            active-class="bg-primary/10 text-primary"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg px-4 font-semibold text-toned transition-colors duration-200 hover:bg-primary/10"
          >
            <UIcon :name="item.icon" class="size-5" aria-hidden="true" />
            {{ item.label }}
          </NuxtLink>
        </nav>
        <ClientOnly><UserButton /></ClientOnly>
      </div>
    </header>

    <main id="main" tabindex="-1" class="mx-auto max-w-5xl px-4 pb-28 pt-6 outline-none sm:px-6 sm:pb-12 sm:pt-10">
      <slot />
    </main>

    <nav
      aria-label="Main"
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        active-class="text-primary font-bold"
        class="flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-semibold text-muted"
      >
        <UIcon :name="item.icon" class="size-6" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
