<script setup lang="ts">
const route = useRoute()
const { pendingRequests, error: workspaceError } = useSitterWorkspace()

const items = [
  { label: 'Overview', to: '/sitter', icon: 'i-lucide-layout-dashboard', exact: true },
  { label: 'Requests', to: '/sitter/requests', icon: 'i-lucide-inbox' },
  { label: 'Bookings', to: '/sitter/bookings', icon: 'i-lucide-calendar-check' },
  { label: 'Bookers', to: '/sitter/bookers', icon: 'i-lucide-users' },
  { label: 'Availability', to: '/sitter/availability', icon: 'i-lucide-calendar-days' },
  { label: 'Profile', to: '/sitter/profile', icon: 'i-lucide-user-round' },
]

function isCurrent(item: typeof items[number]) {
  return item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<template>
  <div class="min-h-dvh bg-default">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-default focus:px-4 focus:py-3 focus:font-semibold focus:shadow-lg"
    >
      Skip to main content
    </a>

    <header class="sticky top-0 z-30 border-b border-default bg-default/95 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div class="flex min-w-0 items-center gap-3">
          <NuxtLink to="/sitter" class="font-display text-2xl font-semibold text-primary" aria-label="Nesse sitter workspace">
            Nesse
          </NuxtLink>
          <span class="hidden border-l border-default pl-3 text-sm font-semibold text-toned sm:inline">Sitter workspace</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="hidden rounded-full bg-primary/5 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">Sitter workspace</span>
          <ClientOnly><UserButton /></ClientOnly>
        </div>
      </div>
    </header>

    <div class="mx-auto grid max-w-7xl lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside class="hidden border-r border-default px-4 py-8 lg:block">
        <p class="mb-3 px-3 text-xs font-bold uppercase tracking-wide text-muted">Workspace</p>
        <nav aria-label="Sitter workspace" class="space-y-1">
          <NuxtLink
            v-for="item in items"
            :key="item.to"
            :to="item.to"
            :aria-current="isCurrent(item) ? 'page' : undefined"
            class="flex min-h-12 items-center gap-3 rounded-lg px-3 font-semibold transition-colors hover:bg-primary/5 hover:text-primary"
            :class="isCurrent(item) ? 'bg-primary/10 text-primary' : 'text-toned'"
          >
            <UIcon :name="item.icon" class="size-5 shrink-0" aria-hidden="true" />
            <span class="min-w-0 flex-1">{{ item.label }}</span>
            <span
              v-if="item.to === '/sitter/requests' && pendingRequests.length"
              class="rounded-full bg-secondary px-2 py-0.5 text-xs font-bold text-white"
              :aria-label="`${pendingRequests.length} new ${pendingRequests.length === 1 ? 'request' : 'requests'}`"
            >{{ pendingRequests.length }}</span>
          </NuxtLink>
        </nav>
        <div class="mt-8 rounded-xl border border-default bg-elevated p-4">
          <p class="text-sm font-semibold text-default">Private booking details</p>
          <p class="mt-1 text-sm text-muted">Home access and emergency details are shown only after a booking is confirmed.</p>
        </div>
      </aside>

      <main id="main" tabindex="-1" class="min-w-0 px-4 pb-28 pt-6 outline-none sm:px-6 sm:pt-8 lg:px-10 lg:pb-12 lg:pt-10">
        <UAlert
          v-if="workspaceError"
          class="mx-auto mb-6 max-w-5xl"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Sitter workspace could not load"
          :description="workspaceError.message"
        />
        <slot />
      </main>
    </div>

    <nav
      aria-label="Sitter workspace"
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <NuxtLink
        v-for="item in items"
        :key="item.to"
        :to="item.to"
        :aria-current="isCurrent(item) ? 'page' : undefined"
        class="flex min-h-16 flex-col items-center justify-center gap-1 px-1 text-xs font-semibold transition-colors"
        :class="isCurrent(item) ? 'text-primary' : 'text-muted'"
      >
        <span class="relative">
          <UIcon :name="item.icon" class="size-5" aria-hidden="true" />
          <span
            v-if="item.to === '/sitter/requests' && pendingRequests.length"
            class="absolute -right-2 -top-1 size-2 rounded-full bg-secondary"
            aria-label="New requests"
          />
        </span>
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
