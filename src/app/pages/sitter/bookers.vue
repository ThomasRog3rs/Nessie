<script setup lang="ts">
definePageMeta({ layout: 'sitter' })
useHead({ title: 'Bookers · Nesse' })

const toast = useToast()
const origin = useRequestURL().origin

const { data: invites, refresh: refreshInvites } = await useFetch<BookerInvite[]>('/api/sitters/current/invites', { default: () => [] })
const { data: bookers, refresh: refreshBookers } = await useFetch<LinkedBooker[]>('/api/sitters/current/bookers', { default: () => [] })

const lifetimes = [
  { label: '1 hour', value: 1 },
  { label: '24 hours', value: 24 },
  { label: '7 days', value: 24 * 7 },
  { label: '30 days', value: 24 * 30 },
  { label: '90 days', value: 24 * 90 },
]
const label = ref('')
const expiresInHours = ref(24 * 7)
const creating = ref(false)
const error = ref('')
const created = ref<{ url: string, invite: CreatedBookerInvite }>()

const dateTime = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const statusColor = { active: 'success', used: 'neutral', expired: 'warning', disabled: 'error' } as const

async function createInvite() {
  creating.value = true
  error.value = ''
  try {
    const invite = await $fetch<CreatedBookerInvite>('/api/sitters/current/invites', {
      method: 'POST',
      body: { label: label.value, expiresInHours: expiresInHours.value },
    })
    created.value = { invite, url: `${origin}/join/${invite.token}` }
    label.value = ''
    await refreshInvites()
  }
  catch (e) {
    error.value = apiErrorMessage(e)
  }
  finally {
    creating.value = false
  }
}

async function copy(url: string) {
  await navigator.clipboard.writeText(url)
  toast.add({ title: 'Link copied', icon: 'i-lucide-clipboard-check', color: 'success' })
}

async function disable(invite: BookerInvite) {
  try {
    await $fetch(`/api/sitters/current/invites/${invite.id}/disable`, { method: 'POST' })
    if (created.value?.invite.id === invite.id) created.value = undefined
    toast.add({ title: 'Link disabled', icon: 'i-lucide-circle-check', color: 'success' })
  }
  catch (e) {
    toast.add({ title: apiErrorMessage(e), color: 'error' })
  }
  await Promise.all([refreshInvites(), refreshBookers()])
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-8">
    <div>
      <p class="text-sm font-semibold text-primary">Sitter workspace</p>
      <h1 class="mt-1 text-3xl font-semibold sm:text-4xl">Bookers</h1>
      <p class="mt-2 max-w-2xl text-toned">
        People can only join through a link from you. Each link works once, then stops working, and you can switch it off at any time.
      </p>
    </div>

    <UCard>
      <h2 class="text-xl font-semibold">Create an invite link</h2>
      <form class="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end" @submit.prevent="createInvite">
        <UFormField label="Who is it for?" hint="Optional, only you see this">
          <UInput v-model="label" placeholder="e.g. Sam & Alex" :maxlength="80" size="xl" class="w-full" />
        </UFormField>
        <UFormField label="Link lasts for">
          <USelect v-model="expiresInHours" :items="lifetimes" size="xl" class="w-full" />
        </UFormField>
        <UButton type="submit" size="xl" icon="i-lucide-link" :loading="creating" :disabled="creating">Create link</UButton>
      </form>
      <p v-if="error" role="alert" class="mt-3 font-semibold text-error">{{ error }}</p>

      <UAlert
        v-if="created"
        class="mt-5"
        color="success"
        variant="subtle"
        icon="i-lucide-circle-check"
        title="Link created. Copy it now, it won't be shown again."
      >
        <template #description>
          <div class="mt-2 flex flex-wrap items-center gap-2">
            <code class="min-w-0 flex-1 break-all rounded bg-default px-2 py-1 text-sm">{{ created.url }}</code>
            <UButton type="button" color="neutral" variant="outline" icon="i-lucide-copy" @click="copy(created.url)">Copy</UButton>
          </div>
        </template>
      </UAlert>
    </UCard>

    <section aria-labelledby="links-h">
      <h2 id="links-h" class="text-xl font-semibold">Invite links</h2>
      <p v-if="!invites.length" class="mt-3 rounded-lg border border-dashed border-default p-4 text-muted">No links yet.</p>
      <ul v-else class="mt-3 divide-y divide-default rounded-xl border border-default">
        <li v-for="invite in invites" :key="invite.id" class="flex flex-wrap items-center justify-between gap-3 p-4">
          <div class="min-w-0">
            <p class="font-semibold">
              {{ invite.label || 'Unnamed link' }}
              <UBadge class="ml-2" :color="statusColor[invite.status]" variant="subtle" :label="invite.status" />
            </p>
            <p class="text-sm text-muted">
              Created {{ dateTime.format(new Date(invite.createdAt)) }} ·
              <template v-if="invite.status === 'used'">used by {{ invite.bookerName }} on {{ dateTime.format(new Date(invite.usedAt!)) }}</template>
              <template v-else>{{ invite.status === 'expired' ? 'expired' : 'expires' }} {{ dateTime.format(new Date(invite.expiresAt)) }}</template>
            </p>
          </div>
          <UButton
            v-if="invite.status === 'active'"
            color="error"
            variant="outline"
            icon="i-lucide-ban"
            @click="disable(invite)"
          >Disable</UButton>
        </li>
      </ul>
    </section>

    <section aria-labelledby="bookers-h">
      <h2 id="bookers-h" class="text-xl font-semibold">People who joined</h2>
      <p v-if="!bookers.length" class="mt-3 rounded-lg border border-dashed border-default p-4 text-muted">Nobody has joined through your links yet.</p>
      <ul v-else class="mt-3 divide-y divide-default rounded-xl border border-default">
        <li v-for="booker in bookers" :key="booker.id" class="p-4">
          <p class="font-semibold">{{ booker.name }}</p>
          <p class="text-sm text-muted">
            {{ booker.email }} · {{ booker.phone }} · joined {{ dateTime.format(new Date(booker.joinedAt)) }}
            <template v-if="booker.inviteLabel"> · link “{{ booker.inviteLabel }}”</template>
          </p>
        </li>
      </ul>
    </section>
  </div>
</template>
