module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'e2e', '.eslintrc.cjs'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: 'detect' },
  },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    // This app renders react-three-fiber's custom scenegraph reconciler
    // (<mesh>, <boxGeometry>, position/args/attach/emissive/etc.), not the
    // DOM. eslint-plugin-react's DOM/SVG attribute whitelist has no notion
    // of three.js props, so react/no-unknown-property fires wall-to-wall
    // false positives on every R3F element. Disabling it here is scoping
    // the rule to the renderer it actually understands (DOM), matching the
    // standard community guidance for react-three-fiber projects — it does
    // not suppress any of the real checks below (unused vars, prop-types,
    // hooks deps, etc.).
    'react/no-unknown-property': 'off',
  },
}
