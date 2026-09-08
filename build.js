import { build } from 'esbuild';

build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/auto-pulse.user.js',
  banner: {
    js: `// ==UserScript==
// @name         Auto Pulse
// @namespace    http://tampermonkey.net/
// @version      8.1.0
// @description  Personalized Discord automation tool (modular)
// @author       You
// @match        https://discord.com/channels/*
// @match        https://discord.com/app
// @icon         https://www.google.com/s2/favicons?sz=64&domain=discord.com
// @grant        none
// ==/UserScript==`
  }
}).catch(() => process.exit(1));
