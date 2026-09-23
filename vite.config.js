import { defineConfig } from 'vite';

export default defineConfig({
  // Reaching the studio server by IP means the URL changes with every network,
  // which breaks a Home Screen shortcut the moment you move. The Mac's Bonjour
  // name (<LocalHostName>.local) follows the machine instead, but Vite's host
  // check rejects it by default and answers 403.
  preview: {
    allowedHosts: ['.local'],
  },
  server: {
    allowedHosts: ['.local'],
  },
});
