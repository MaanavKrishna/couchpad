<script setup lang="ts">
import { withBase } from 'vitepress';
</script>

<template>
  <section class="cp-hero">
    <div class="cp-wrap cp-hero-grid">
      <div class="cp-hero-copy">
        <p class="cp-kicker">A small TypeScript library for TV and web games</p>
        <h1 class="cp-title">Turn any phone into a game controller. No app.</h1>
        <p class="cp-lede">
          Players scan a QR code on the TV and their phone becomes a gamepad. Input streams over a
          WebRTC DataChannel, and when the network blocks that, a WebSocket relay carries it instead.
          Your game never has to know which one it got.
        </p>
        <div class="cp-actions">
          <a class="cp-cta" :href="withBase('/docs/getting-started')">Get started</a>
          <a class="cp-cta ghost" :href="withBase('/docs/api')">API reference</a>
          <a class="cp-cta ghost" href="https://github.com/MaanavKrishna/couchpad">GitHub</a>
        </div>
        <pre class="cp-install" aria-label="Install command"><span aria-hidden="true">$ </span>npm install github:MaanavKrishna/couchpad</pre>
      </div>
      <LinkDiagram />
    </div>
  </section>
</template>
