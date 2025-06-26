import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  target: 'es2020',
  external: ['cross-fetch'],
  banner: {
    js: '// ValidKit TypeScript SDK - AI Agent Optimized',
  },
})