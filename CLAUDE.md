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

Tutte le milestone della specifica sono fatte, dalla 1 alla 9.

Struttura:
- `src/core/` — matematica pura, coperta al 100% dai test.
- `src/sensors/` — sorgenti di orientamento e wake lock.
- `src/store/` — stato reattivo, veicolo, postazioni, persistenza.
- `src/ui/` — schermate; `format.ts` è l'unico posto dove metri e radianti
  diventano centimetri e gradi.
- `android/` — guscio Capacitor opzionale per l'APK (sezione 9.3).

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

Note su cose che non si vedono dal codice:
- `AppState` ha tre campi in più rispetto alla specifica (`toleranceDeg`,
  `nightMode`, `beep`), richiesti dalla UI ma non elencati nel modello dati.
  La migrazione li completa sui salvataggi che non li hanno.
- Il `base` di Vite è `/LivellaVanWeb/` per Pages e va azzerato con
  `APP_BASE=/` per l'APK, altrimenti dentro il guscio nativo gli asset danno
  404 e si vede una pagina bianca.
- Nella tabella 3.6 della specifica il caso combinato riporta PD = 1,0 cm:
  è un refuso, il valore giusto è 12,0 cm. Il test lo annota.
