---
title: Overview
---

# couchpad docs

couchpad turns phones into game controllers for a TV or web game. Players scan a QR code, the phone page joins a room, and input reaches the TV over a WebRTC DataChannel or, when the network blocks that, a WebSocket relay. These docs cover the whole path, from your first input frame to running your own server.

## Start here

<ol class="dx-path">
  <li><a href="./getting-started#_1-install"><span class="dx-step">1</span><strong>Install</strong><span>Add couchpad from GitHub</span></a></li>
  <li><a href="./getting-started#_3-create-a-room-on-the-tv"><span class="dx-step">2</span><strong>Host</strong><span>Create a room on the TV</span></a></li>
  <li><a href="./getting-started#_4-join-from-the-phone"><span class="dx-step">3</span><strong>Phone</strong><span>Join and draw controls</span></a></li>
  <li><a href="./getting-started#_5-read-the-first-input"><span class="dx-step">4</span><strong>First input</strong><span>See frames arrive</span></a></li>
</ol>

The whole path takes about five minutes with the example server.

## Explore

<div class="dx-cards">
  <a class="dx-card" href="./getting-started">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
    <strong>Getting started</strong>
    <span>A step-by-step tutorial: install, run a server, create a room, join from a phone.</span>
  </a>
  <a class="dx-card" href="./concepts">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M9 11l6-4M9 13l6 4"/></svg>
    <strong>Concepts</strong>
    <span>Signaling, the two DataChannels, relay fallback, chunking, rejoin and resume.</span>
  </a>
  <a class="dx-card" href="./guides/paddle-game">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="7" width="2.5" height="10" rx="1"/><rect x="18.5" y="7" width="2.5" height="10" rx="1"/><circle cx="12" cy="12" r="1.8"/></svg>
    <strong>Paddle game guide</strong>
    <span>A complete two-player game in about 50 lines of TypeScript.</span>
  </a>
  <a class="dx-card" href="./guides/deploy-server">
    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/></svg>
    <strong>Deploy the server</strong>
    <span>Run the signaling server on Node, and notes for Cloudflare and AWS.</span>
  </a>
  <a class="dx-card" href="./guides/debugging">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v3M5 6l2 2M19 6l-2 2"/><rect x="7" y="8" width="10" height="12" rx="5"/><path d="M12 12v4"/></svg>
    <strong>Debugging connections</strong>
    <span>What to check when WebRTC fails, and how to force the relay.</span>
  </a>
  <a class="dx-card" href="./api">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6"/></svg>
    <strong>API reference</strong>
    <span>Every export with its signature, parameters, return value and an example.</span>
  </a>
  <a class="dx-card" href="./widgets">
    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="14" r="4"/><circle cx="17" cy="9" r="2.5"/><circle cx="17" cy="16" r="2"/></svg>
    <strong>Widgets</strong>
    <span>Joystick, buttons, tilt, swipe, draw, vote and text, with theming.</span>
  </a>
  <a class="dx-card" href="./protocol">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h12l-3-3M20 17H8l3 3"/></svg>
    <strong>Protocol</strong>
    <span>Every message between phone, server and TV, if you write your own server.</span>
  </a>
  <a class="dx-card" href="./errors">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>
    <strong>Error codes</strong>
    <span>What each rejection and server error means, and what to do about it.</span>
  </a>
</div>

## What couchpad does for you

| You write | couchpad handles |
|---|---|
| A TV page that creates a room and reads input | Room codes, WebRTC offers and answers, ICE candidates |
| A phone page that renders controls | Touch widgets with haptics and accessible roles |
| A WebSocket server (or the example one) | Relay fallback, 28 KB chunking, reconnect with backoff |
| Game logic | Rejoin tokens, TV resume, held-button keepalive, stale frame dropping |
