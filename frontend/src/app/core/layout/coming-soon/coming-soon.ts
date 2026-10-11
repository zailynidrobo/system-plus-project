import { Component } from '@angular/core';

// Temporal: inicio del Coordinador y del Docente mientras se construyen las fases 1 y 3.
@Component({
  selector: 'app-coming-soon',
  template: `<p class="state">Esta sección se construye en la siguiente fase.</p>`,
  styles: `.state { margin: 40px 0; color: var(--color-muted-figma); }`,
})
export class ComingSoon {}
