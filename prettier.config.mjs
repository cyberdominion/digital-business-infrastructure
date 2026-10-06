/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  arrowParens: 'always',
  plugins: ['prettier-plugin-tailwindcss'],
  tailwindStylesheet: './apps/web/src/app/globals.css',
};

export default config;