// 웹 앱 ESLint 설정 — any 금지 등 타입 안정성 규칙 강제 (AGENTS.md 규칙 19)
import tseslint from 'typescript-eslint';

export default tseslint.config(...tseslint.configs.recommended, {
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
  },
}, {
  ignores: ['.next/**', 'next-env.d.ts'],
});
