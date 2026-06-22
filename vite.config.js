import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// IMPORTANT: `base` must match your GitHub repo name so assets resolve
// correctly on GitHub Pages (https://USER.github.io/puerto-cartagena/).
// For local dev (`npm run dev`) Vite ignores base, so it just works.
export default defineConfig({
  plugins: [react()],
  base: '/puerto-cartagena/',
});
