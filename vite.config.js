import { defineConfig } from 'vite';

export default defineConfig({
  // Reaching the studio server by IP means the URL changes with every network,
  // which breaks a Home Screen shortcut the moment you move. The Mac's Bonjour
  // name (<LocalHostName>.local) follows the machine instead, but Vite's host
  // check rejects it by default and answers 403.
  // '.local' is the Mac's Bonjour name; '.ts.net' is its Tailscale name, which
  // works from any network. Vite answers 403 for any host it was not told about.
  preview: {
    allowedHosts: ['.local', '.ts.net'],
  },
  server: {
    allowedHosts: ['.local', '.ts.net'],
  },
});
