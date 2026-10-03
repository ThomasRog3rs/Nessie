<template>
  <div class="min-h-dvh bg-default">
    <header class="border-b border-default">
      <div class="mx-auto flex h-16 max-w-3xl items-center px-4 sm:px-6">
        <NuxtLink to="/" class="inline-flex items-center gap-2 font-display text-2xl font-semibold text-primary" aria-label="Nesse home">
          <img src="/favicon.png" alt="" width="36" height="36" class="size-9 shrink-0 object-contain">
          Nesse
        </NuxtLink>
      </div>
    </header>
    <main id="main" tabindex="-1" class="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 outline-none sm:px-6">
      <slot />
    </main>
  </div>
</template>
