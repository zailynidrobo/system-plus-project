import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Aviso de privacidad del sistema (Ley 1581 de 2012). Se puede leer sin iniciar sesión. */
@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  template: `
    <main class="aviso">
      <a class="volver" routerLink="/login">← Volver al inicio de sesión</a>
      <h1>Aviso de privacidad y tratamiento de datos</h1>
      <p class="sub">System Plus · Intranet de guías académicas de System Plus Piendamó</p>

      <section>
        <h2>Qué datos se recogen</h2>
        <ul>
          <li>Nombre completo, correo electrónico y rol de cada usuario.</li>
          <li>Registro de las acciones en el sistema: quién, qué, cuándo, desde qué equipo y con qué resultado.</li>
          <li>El contenido académico que cada persona crea: guías, versiones y sugerencias.</li>
        </ul>
        <p>No se recogen datos sensibles. Las contraseñas las guarda cifradas el servidor de identidad y nunca quedan en los registros.</p>
      </section>

      <section>
        <h2>Para qué se usan</h2>
        <p>Para dar acceso según el rol, gestionar las guías de aprendizaje del programa y dejar trazabilidad de los cambios para el seguimiento institucional.</p>
      </section>

      <section>
        <h2>Quién los consulta y dónde están</h2>
        <p>
          Los datos de acceso y la auditoría los consulta solo el administrador del sistema; el contenido académico, la coordinación y los docentes asignados.
          La información se guarda en el servidor de la intranet de la sede y no se comparte con terceros.
        </p>
      </section>

      <section>
        <h2>Tus derechos</h2>
        <p>De acuerdo con la Ley 1581 de 2012, puedes conocer, actualizar y rectificar tus datos, pedir prueba de la autorización, solicitar su supresión cuando proceda y presentar quejas ante la Superintendencia de Industria y Comercio.</p>
        <p>Para ejercerlos, comunícate con el administrador del sistema de la sede.</p>
      </section>

      <p class="nota">Este aviso complementa la política de tratamiento de datos personales de la institución.</p>
    </main>
  `,
  styles: `
    :host { display: block; min-height: 100vh; background: var(--color-surface-2, #f6f7fb); }
    .aviso { max-width: 760px; margin: 0 auto; padding: 40px 24px 56px; color: var(--color-text-figma, #1f2235); line-height: 1.6; }
    .volver { color: var(--color-primary, #3b3b98); font-size: 14px; text-decoration: none; }
    h1 { margin: 20px 0 4px; font-size: 30px; font-weight: 500; color: var(--color-primary, #3b3b98); }
    .sub { margin: 0 0 28px; color: var(--color-muted-figma, #5f6175); }
    section { margin-bottom: 22px; padding: 20px 22px; background: #fff; border: 1px solid var(--color-border-figma, #e3e5ee); border-radius: 14px; }
    h2 { margin: 0 0 8px; font-size: 16px; }
    p { margin: 0 0 8px; font-size: 14px; }
    ul { margin: 0 0 8px; padding-left: 20px; font-size: 14px; }
    .nota { font-size: 13px; color: var(--color-muted-figma, #5f6175); }
  `,
})
export class Privacy {}
