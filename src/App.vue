<script setup lang="ts">
import { watch } from 'vue'
import { useCentrifugeStore } from '@/refactoring/modules/centrifuge/stores/centrifugeStore'
import { useAuthStore } from '@/refactoring/modules/authStore/stores/authStore'

import ToastMessage from '@/refactoring/modules/feedback/components/ToastMessage.vue'
import LoaderOverlay from '@/refactoring/modules/feedback/components/LoaderOverlay.vue'
import PinUnlockForm from '@/refactoring/modules/feedback/components/PinUnlockForm.vue'


const centrifugeStore = useCentrifugeStore()
const authStore = useAuthStore()


/*watch(() => authStore.isAuthenticated, (isAuthenticated) => {
    if (isAuthenticated) {
        centrifugeStore.initCentrifuge();
    } else {
        centrifugeStore.client?.disconnect();
    }
}, { immediate: true });*/
</script>

<template>
    <pin-unlock-form />
    <loader-overlay />
    <app-confirm-dialog />
    <toast-message />
    <router-view />
</template>

<style scoped></style>
