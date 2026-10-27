#!/usr/bin/env bun
/**
 * CLI shim for `bun link` / PATH: open a folder like `explorer .`
 *
 * Usage:
 *   x-xp
 *   x-xp .
 *   x-xp C:\Users\Public
 *   x-xp --help
 */
import {spawn} from 'node:child_process'
import {existsSync} from 'node:fs'
import {homedir} from 'node:os'
import {dirname, isAbsolute, join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function printHelp() {
	console.log(`x-xp — open a folder in x-xp (Explorer-like)

Usage:
  x-xp [path]

Examples:
  x-xp
  x-xp .
  x-xp ..
  x-xp C:\\Users\\Public

Environment:
  X_XP_BIN   Absolute path to x-xp.exe (overrides discovery)
`)
}

function candidateBins() {
	const fromEnv = process.env.X_XP_BIN
	const home = homedir()
	const localApp = process.env.LOCALAPPDATA ?? join(home, 'AppData', 'Local')
	const cargoTarget =
		process.env.CARGO_TARGET_DIR ??
		process.env.CARGO_TARGET ??
		join('I:', 'dev', 'cargo-target')

	return [
		fromEnv,
		join(root, 'src-tauri', 'target', 'release', 'x-xp.exe'),
		join(root, 'src-tauri', 'target', 'debug', 'x-xp.exe'),
		join(cargoTarget, 'release', 'x-xp.exe'),
		join(cargoTarget, 'debug', 'x-xp.exe'),
		join(localApp, 'x-xp', 'x-xp.exe'),
		join(process.env.ProgramFiles ?? 'C:\\Program Files', 'x-xp', 'x-xp.exe'),
		'x-xp.exe',
	].filter(Boolean)
}

function findBinary() {
	for (const c of candidateBins()) {
		if (c === 'x-xp.exe') continue
		if (existsSync(c)) return c
	}
	return null
}

function resolveOpenPath(arg) {
	if (!arg) return null
	const abs = isAbsolute(arg) ? arg : resolve(process.cwd(), arg)
	return abs
}

const argv = process.argv.slice(2)
if (argv.includes('-h') || argv.includes('--help')) {
	printHelp()
	process.exit(0)
}

const pathArg = argv.find(a => !a.startsWith('-'))
const openPath = resolveOpenPath(pathArg)
const bin = findBinary()

if (!bin) {
	console.error(
		'x-xp binary not found. Build with `bun run tauri:build` or set X_XP_BIN to x-xp.exe.',
	)
	process.exit(1)
}

const childArgs = openPath ? [openPath] : []
const child = spawn(bin, childArgs, {
	detached: true,
	stdio: 'ignore',
	windowsHide: false,
})
child.unref()
