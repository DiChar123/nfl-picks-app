import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/nfl-picks-app/', // ensures correct paths when deployed
  plugins: [react()],
});
