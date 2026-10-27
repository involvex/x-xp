import js from '@eslint/js'
import {defineConfig} from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
	{
		ignores: ['dist/**', 'node_modules/**', 'src-tauri/**'],
	},
	{
		files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}'],
		plugins: {js},
		extends: ['js/recommended'],
		languageOptions: {
			globals: {...globals.browser, ...globals.node},
			parserOptions: {
				ecmaFeatures: {jsx: true},
			},
		},
	},
	tseslint.configs.recommended,
])
