import { FORMOSA } from '@/lib/formosa'

export function Methodology() {
  return (
    <section aria-labelledby="titulo-metodo" className="flex flex-col gap-3 border-t border-border pt-5">
      <h2 id="titulo-metodo" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Cómo se calcula
      </h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
        <p className="text-pretty">
          Se descarga el relieve de la ciudad (≈ 17 m por píxel) y se calcula, para cada punto, la altura mínima que
          debe alcanzar el río para llegar hasta ahí por terreno conectado. Un bajo detrás de una loma no se inunda
          hasta que el agua supera esa loma.
        </p>
        <p className="text-pretty">
          La altura del hidrómetro se convierte a cota con un cero estimado de{' '}
          <span className="font-mono text-foreground">{FORMOSA.hidrometro.cotaCero.toFixed(1)} m s.n.m.</span>,
          calibrado con la superficie del río en el modelo de elevación.
        </p>
        <p className="text-pretty">
          Es una aproximación: el relieve satelital no representa con precisión la defensa costera (cota{' '}
          {FORMOSA.umbrales.defensa} m), bombeos ni desagües. No reemplaza los avisos oficiales de Defensa Civil.
        </p>
      </div>
      <ul className="flex flex-col gap-1 text-sm">
        {FORMOSA.fuentes.map((f) => (
          <li key={f.url}>
            <a
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-4 hover:underline"
            >
              {f.nombre}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
