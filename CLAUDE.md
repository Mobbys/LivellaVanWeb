# Livella camper

App web (PWA) che misura l'inclinazione del camper e calcola i cm di rialzo
per ruota. Svelte 5 + TypeScript + Vite. Nessuna dipendenza runtime oltre
Svelte.

## Comandi
- `npm run dev` — server di sviluppo
- `npm test` — Vitest, deve essere verde prima di ogni commit
- `npm run test:coverage` — copertura di `src/core/`, soglia 100%
- `npm run typecheck` — svelte-check
- `npm run build` — build di produzione in dist/

## Regole
- `src/core/` è TypeScript puro: niente window, navigator, DOM o Svelte.
  Tutta la matematica sta qui ed è coperta da test.
- Ogni modifica alla matematica parte da un test che fallisce.
- Le convenzioni degli assi (camper: X destra, Y muso, Z alto) sono fissate
  nella specifica e non si cambiano.
- Unità SI internamente (metri, radianti). La conversione a cm e gradi
  avviene solo al confine con la UI.
- Niente librerie di UI, niente framework CSS, niente icon pack.
- Nessuna chiamata di rete. La app deve funzionare in aereo.

## Convenzioni
- Nomi in inglese nel codice, testi dell'interfaccia in italiano.
- Commenti solo dove la matematica non è ovvia.

## Stato

Milestone completate: 1 (setup), 2 (matematica in `src/core/`), 3 (sensori +
pagina di debug). Prossima: 4 (livella grezza con due bolle e calibrazione
fittizia). `src/store/` non esiste ancora; in `src/ui/` c'è solo
`SensorDebug.svelte`, che è la schermata montata da `App.svelte`.

Convenzioni fissate in `src/core/`:
- Matrici `Mat3` row-major, vettori `Vec3` come tuple readonly.
- `R` mappa telefono→mondo; il verticale in coordinate telefono è la terza
  riga di `R`.
- La matrice di postazione `M` soddisfa `u_c = M · u_p`.

Convenzioni fissate in `src/sensors/`:
- `OrientationSource` si interroga, non emette eventi: la UI legge le proprietà
  in un `requestAnimationFrame`, così disegna al ritmo dello schermo e non a
  quello del sensore.
- `createOrientationSource()` prova Generic Sensor API e poi
  `DeviceOrientationEvent`, e restituisce anche l'elenco dei tentativi falliti.
- Una sorgente che non produce letture entro 3 s è un errore, non un successo
  silenzioso.
