import DefaultTheme from 'vitepress/theme';
import type { Theme } from 'vitepress';
import LinkDiagram from './LinkDiagram.vue';
import HomeHero from './HomeHero.vue';
import HomeSpecs from './HomeSpecs.vue';
import HomeCadabra from './HomeCadabra.vue';
import HomePlayground from './HomePlayground.vue';
import HomeSession from './HomeSession.vue';
import ConceptFig from './ConceptFig.vue';
import WidgetGallery from './WidgetGallery.vue';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    if (typeof window !== 'undefined') {
      // Clicking a heading's # copies its deep link, and still jumps to it.
      document.addEventListener('click', (e) => {
        const a = (e.target as HTMLElement | null)?.closest?.('a.header-anchor') as HTMLAnchorElement | null;
        if (!a || !navigator.clipboard) return;
        navigator.clipboard.writeText(a.href).then(() => {
          a.dataset.copied = '';
          setTimeout(() => { delete a.dataset.copied; }, 1400);
        }, () => {});
      });
    }
    app.component('LinkDiagram', LinkDiagram);
    app.component('HomeHero', HomeHero);
    app.component('HomeSpecs', HomeSpecs);
    app.component('HomeCadabra', HomeCadabra);
    app.component('HomePlayground', HomePlayground);
    app.component('HomeSession', HomeSession);
    app.component('ConceptFig', ConceptFig);
    app.component('WidgetGallery', WidgetGallery);
  },
} satisfies Theme;
