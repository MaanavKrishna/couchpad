<script setup lang="ts">
import { withBase } from 'vitepress';
</script>

<template>
  <section class="cp-cadabra" aria-labelledby="cp-cadabra-h">
    <div class="cp-wrap cp-cadabra-grid">
      <div>
        <h2 id="cp-cadabra-h" class="cp-h2">Used by Cadabra</h2>
        <p>
          <a href="https://github.com/MaanavKrishna/cadabra">Cadabra</a> is a Fire TV party game where the room
          invents the game and then plays it. Every phone joins by QR and becomes the controller through couchpad.
        </p>
        <p>
          It carries input from up to 4 phones to a Fire TV Stick HD, measured at 13 to 16 ms on a home network.
          Its production signaling runs on API Gateway WebSocket, Lambda and DynamoDB, which is where the
          28 KB chunking came from.
        </p>
        <a class="cp-cta ghost" href="https://github.com/MaanavKrishna/cadabra">See Cadabra on GitHub</a>
      </div>
      <figure class="cp-shot">
        <img :src="withBase('/phone-join-play.jpg')" width="1590" height="844" decoding="async"
          alt="A phone that has joined a Cadabra room, showing couchpad's joystick and buttons, next to the TV game it controls." />
        <figcaption>A phone joined to Cadabra, playing as the controller.</figcaption>
      </figure>
    </div>
  </section>
</template>
