import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Dev: encaminha /api/* para o BFF (bun run server/server.ts)
    proxy: {
      '/api': `http://localhost:${process.env.CHAT_PORT || 3335}`,
    },
  },
  build: {
    // WHY: por padrão o Vite emite <link rel="modulepreload"> também para
    // imports dinâmicos declarados em chunks do grafo inicial — o
    // import('streamdown') dentro de Markdown.tsx (estático via ChatMessages)
    // faria os ~500kB de markdown baixarem eager no primeiro paint,
    // anulando o lazy. O filtro tira vendor-md/vendor-swiper do preload do
    // HTML; eles passam a carregar sob demanda (com cache + preload do
    // runtime quando o import() executa).
    modulePreload: {
      polyfill: true,
      resolveDependencies: (_filename, deps, context) =>
        context.hostType === 'html'
          ? deps.filter((d) => !/vendor-(md|swiper)/.test(d))
          : deps,
    },
    // WHY: o bundle inicial (ChatPage + Layout) puxa react + motion +
    // streamdown + swiper + supabase + radix + phosphor (~1.3MB juntos).
    // Grupos por vendor quebram em chunks paralelos <500kB (melhor cache
    // e some o warning). Sintaxe Vite 8 (Rolldown): manualChunks foi
    // removido em favor de build.rolldownOptions.output.codeSplitting.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-motion',
              test: /node_modules[\\/](motion|framer-motion)[\\/]/,
              priority: 20,
            },
            {
              // Ecossistema markdown do Streamdown, dividido em duas
              // metades (parse vs. render) para cada chunk ficar <500kB.
              name: 'vendor-md-parse',
              test: /node_modules[\\/](marked|micromark|mdast|remark|decode-named-character-reference|character-entities|character-reference-invalid|longest-streak|trim-lines|ccount)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-md-render',
              test: /node_modules[\\/](streamdown|unified|vfile|trough|zwitch|rehype|hast|hastscript|property-information|comma-separated-tokens|space-separated-tokens|html-url-attributes|html-void-elements|bail|devlop|extend)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-swiper',
              test: /node_modules[\\/]swiper[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-data',
              test: /node_modules[\\/]@supabase[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor-ui',
              test: /node_modules[\\/](radix-ui|@radix-ui|@phosphor-icons|clsx|tailwind-merge|class-variance-authority)[\\/]/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules[\\/]/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})
