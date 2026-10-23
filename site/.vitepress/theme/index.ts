import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import LinkDiagram from './LinkDiagram.vue';
import HomeHero from './HomeHero.vue';
import HomeSpecs from './HomeSpecs.vue';
import HomeCadabra from './HomeCadabra.vue';
import HomePlayground from './HomePlayground.vue';
import HomeSession from './HomeSession.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('LinkDiagram', LinkDiagram);
    app.component('HomeHero', HomeHero);
    app.component('HomeSpecs', HomeSpecs);
    app.component('HomeCadabra', HomeCadabra);
    app.component('HomePlayground', HomePlayground);
    app.component('HomeSession', HomeSession);
  },
} satisfies Theme;
