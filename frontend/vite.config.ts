import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  if (mode === 'production' && !env.VITE_API_BASE_URL) {
    throw new Error('VITE_API_BASE_URL is required for production builds.');
  }

  return {};
});
