import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwind from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'react-runtime',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            },
            {
              name: 'charts',
              test: /node_modules[\\/](recharts|victory-vendor|d3-[^\\/]+)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
