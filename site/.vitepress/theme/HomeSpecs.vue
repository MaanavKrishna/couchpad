<script setup lang="ts">
// Every number below is a constant in src/ (file and name noted for each row).
const rows = [
  { n: '4 s', what: 'to open WebRTC, then relay', how: 'If both DataChannels are not open within OPEN_TIMEOUT_MS, the peer fails over to the WebSocket relay for good. Input is relayed while it waits, so nothing blocks.', src: 'peer.ts: OPEN_TIMEOUT_MS' },
  { n: '28 KB', what: 'relay chunk size', how: 'Relay payloads above RELAY_CHUNK_BYTES are split into ~chunk envelopes that fit 32 KB API Gateway frames, and reassembled per sender. Partials expire after 10 s.', src: 'util.ts: RELAY_CHUNK_BYTES' },
  { n: '30 Hz', what: 'continuous input', how: 'Stick, tilt and held buttons go on an unordered, no-retransmit channel. Button presses skip the throttle so an edge is never late.', src: 'client.ts: INPUT_HZ' },
  { n: '100 ms', what: 'held-input keepalive', how: 'While anything is held the latest frame is resent. A release is sent twice, 30 ms apart, and blur or a hidden tab sends a zeroed frame.', src: 'client.ts: KEEPALIVE_MS' },
  { n: '2 s', what: 'ping and ICE grace', how: 'A ping every 2 s measures round-trip time. A disconnected ICE state gets 2 s to recover before the link drops to relay.', src: 'client.ts: PING_INTERVAL_MS' },
  { n: '250 ms–8 s', what: 'reconnect backoff', how: 'Socket drops retry with ±30% jitter. Backoff only resets after a socket stays open for 3 s, so flapping links keep backing off.', src: 'signaling.ts: BACKOFF_MS' },
  { n: '64', what: 'queued reliable messages', how: 'While no path is up, reliable sends wait in a bounded queue and flush in order when the link returns.', src: 'client.ts: RELIABLE_QUEUE_MAX' },
  { n: '200 KB', what: 'largest drawing', how: 'The draw pad exports a JPEG of at most 256 px, lowering quality until it fits 25 KB. Anything over 200 KB is dropped before send.', src: 'util.ts: MAX_DRAW_BYTES' },
];
</script>

<template>
  <section class="cp-specs" aria-labelledby="cp-specs-h">
    <div class="cp-wrap">
      <h2 id="cp-specs-h" class="cp-h2">Built for phones on a couch</h2>
      <p class="cp-sub-lede">Phones lock, refresh and wander between rooms. These are the numbers couchpad uses to keep a seat alive, straight from the source.</p>
      <dl class="cp-spec-list">
        <div v-for="r in rows" :key="r.src" class="cp-spec">
          <dt><span class="cp-spec-n">{{ r.n }}</span><span class="cp-spec-what">{{ r.what }}</span></dt>
          <dd>{{ r.how }}<code class="cp-spec-src">{{ r.src }}</code></dd>
        </div>
      </dl>
      <ul class="cp-facts">
        <li><strong>1</strong> runtime dependency (zod)</li>
        <li><strong>8</strong> widget kinds</li>
        <li><strong>34</strong> tests, no browser needed</li>
        <li><strong>13–16 ms</strong> phone to Fire TV in Cadabra</li>
      </ul>
    </div>
  </section>
</template>
