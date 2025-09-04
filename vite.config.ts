import { fileURLToPath, URL } from 'node:url'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
// https://vitejs.dev/config/
export default defineConfig({
    build: {
        sourcemap: true,
        target: 'esnext',
    },
    optimizeDeps: {
        include: ['vue-logger-plugin'], // Форсируем обработку модуля
        esbuildOptions: {
            format: 'esm', // Указываем ESM-формат для сборки
        },
    },
    plugins: [
        vue(),
        Components({
            resolvers: [PrimeVueResolver()],
        }),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url)),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
})
