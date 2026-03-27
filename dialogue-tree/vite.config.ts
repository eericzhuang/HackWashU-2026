import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  // 手动加载 .env，无前缀限制（第三个参数 ''）
  const env = loadEnv(mode, process.cwd(), '');

  const provider = env.LLM_PROVIDER || 'anthropic';
  const apiKey = env.LLM_API_KEY || '';
  const baseUrl = env.LLM_BASE_URL || 'https://api.anthropic.com';

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    server: {
      proxy: {
        '/api/llm': {
          target: baseUrl,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/llm/, ''),
          headers:
            provider === 'anthropic'
              ? {
                  'x-api-key': apiKey,
                  'anthropic-version': '2023-06-01',
                  'anthropic-dangerous-direct-browser-access': 'true',
                }
              : {
                  Authorization: `Bearer ${apiKey}`,
                },
        },
      },
    },
  };
});
