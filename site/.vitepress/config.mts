import { defineConfig } from 'vitepress';

const SITE = 'https://maanavkrishna.github.io/couchpad/';
const DESC = 'Turn any phone into a game controller with no app. QR join, WebRTC DataChannels with a WebSocket relay fallback, and touch widgets for TV and web games.';

export default defineConfig({
  title: 'couchpad',
  description: DESC,
  base: '/couchpad/',
  lang: 'en',
  appearance: 'force-dark',
  cleanUrls: true,
  ignoreDeadLinks: 'localhostLinks',
  lastUpdated: false,
  head: [
    ['link', { rel: 'icon', href: '/couchpad/favicon.svg', type: 'image/svg+xml' }],
    ['meta', { name: 'theme-color', content: '#0d0f1e' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'couchpad' }],
    ['meta', { property: 'og:title', content: 'couchpad: phones as game controllers, no app' }],
    ['meta', { property: 'og:description', content: DESC }],
    ['meta', { property: 'og:url', content: SITE }],
    ['meta', { property: 'og:image', content: SITE + 'og.png' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'couchpad: phones as game controllers, no app' }],
    ['meta', { name: 'twitter:description', content: DESC }],
    ['meta', { name: 'twitter:image', content: SITE + 'og.png' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' }],
  ],
  themeConfig: {
    logo: { src: '/favicon.svg', alt: '' },
    nav: [
      { text: 'Guide', link: '/docs/getting-started', activeMatch: '/docs/(getting-started|concepts|example-server|testing|faq)' },
      { text: 'API', link: '/docs/api', activeMatch: '/docs/(api|widgets|protocol)' },
      { text: 'Changelog', link: '/docs/changelog' },
      { text: 'Cadabra', link: 'https://github.com/MaanavKrishna/cadabra' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/docs/getting-started' },
          { text: 'Concepts', link: '/docs/concepts' },
          { text: 'Running the example server', link: '/docs/example-server' },
          { text: 'Testing', link: '/docs/testing' },
          { text: 'FAQ and troubleshooting', link: '/docs/faq' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API reference', link: '/docs/api' },
          { text: 'Widgets', link: '/docs/widgets' },
          { text: 'Protocol messages', link: '/docs/protocol' },
          { text: 'Changelog', link: '/docs/changelog' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/MaanavKrishna/couchpad' }],
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    editLink: { pattern: 'https://github.com/MaanavKrishna/couchpad/edit/main/site/:path', text: 'Edit this page on GitHub' },
    footer: { message: 'MIT licensed. Extracted from the Fire TV party game Cadabra.', copyright: 'Copyright 2026 Maanav Krishna' },
  },
});
