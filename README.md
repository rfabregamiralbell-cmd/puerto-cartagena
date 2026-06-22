# ⚓ Puerto Cartagena — v0.2 (React + Vite + Leaflet)

Juego de gestión naval colonial sobre el **mapa real de Cartagena de Indias**. Los distritos se construyen como polígonos GeoJSON encima de tiles reales de OpenStreetMap. El terreno importa: agua, costa, elevación y pasos estratégicos afectan dónde puedes construir y la defensa.

---

## 🚀 Ejecutar en local

Requiere **Node.js 18+**.

```bash
npm install      # instala React, Vite, Leaflet, React-Leaflet
npm run dev      # abre http://localhost:5173
```

Para probar el build de producción:

```bash
npm run build    # genera /dist
npm run preview  # sirve /dist en local
```

---

## 🌐 Desplegar en GitHub Pages

El repo incluye `.github/workflows/deploy.yml`, que **compila** con Vite y publica `/dist` en Pages en cada push a `main`.

Pasos (una sola vez):

1. Sube el repo a GitHub con el nombre **`puerto-cartagena`**.
   > Si usas OTRO nombre, edita `base` en `vite.config.js` para que coincida (`base: '/tu-repo/'`), o el CSS/JS no cargará en Pages.
2. En el repo → **Settings → Pages → Source: GitHub Actions**.
3. Push a `main`. El workflow compila y despliega.
4. URL: `https://TU_USUARIO.github.io/puerto-cartagena/`

---

## 🎮 Cómo se juega

1. Pulsa **🏗️ Construir** (barra inferior) y elige un distrito.
2. **Toca el mapa** donde quieras colocarlo: aparece un polígono de vista previa (verde = válido, rojo = inválido).
3. El panel de colocación muestra terreno, área y, en el caso de la **Fortaleza**, la valoración defensiva del terreno (posición excelente / aceptable / débil).
4. **Confirmar construcción**.
5. Toca un distrito para ver su panel (mejorar / demoler).
6. **🗺️ Capas** activa/desactiva: distritos, edificios, cobertura defensiva, rutas comerciales.

Reglas de terreno (validación en `visualWaterValidator.js`):
- **Puerto** → debe tocar la costa.
- **Hacienda** → tierra abierta (no costa ni agua).
- **Fortaleza** → mejor en alto o costa (puntúa con el modelo tipo LiDAR).
- Nada se puede construir sobre el agua.

---

## 📁 Estructura

```
src/
  main.jsx                 # entrada React
  App.jsx                  # layout: mapa + HUD + nav + sheets
  state/
    initialState.js        # estado inicial
    gameReducer.js         # todas las transiciones (placement, upgrade, tick...)
    GameContext.jsx        # provider + tick 1s + autosave
  components/
    map/GameMap.jsx        # Leaflet: tiles, polígonos, marcadores, capas, preview
    ui/                    # TopHUD, BottomNav, BottomSheet, Notifications
    panels/                # BuildPanel, DistrictPanel, PlacementConfirm,
                           # LayersPanel, CorePanels (Shipyard/Defense/Port)
  engines/
    defense/terrainDefenseEngine.js   # modelo LiDAR simplificado (ACTIVO)
    defense/portDefenseEngine.js      # (Fase 2, no conectado)
    naval/*  trade/*                  # (Fase 2, no conectado)
  utils/
    geoUtils.js            # polígonos, área, centroide, point-in-polygon
    visualWaterValidator.js# agua/costa/tierra
  config/
    districts_config.json  # tipos de distrito + requisitos de terreno
    map_config.json        # Cartagena: centro, zonas de agua, alturas, pasos
    ships/routes/events/... # configs navales
  systems/
    GameState.js           # SHIM de compatibilidad para engines de Fase 2
```

---

## ✅ Fase actual (v0.3 — Fase A: Ciudad viva)

- [x] Mapa real de Cartagena (Leaflet + OSM)
- [x] Distritos como polígonos GeoJSON con marcadores emoji
- [x] Colocación: toca el mapa → preview → validar → confirmar
- [x] Validación de terreno (agua/costa/tierra/abierta/defensiva)
- [x] **Economía semi-activa**: los distritos acumulan producción en su propio almacén; tócalos para **recoger** (badge 📦 en el mapa)
- [x] **Almacenes con límite real**: cada Almacén amplía la capacidad máxima de recursos; demolerlo la reduce
- [x] **Logística de caminos**: un distrito productor debe estar conectado al Puerto (directo o a través de Caminos Interiores) para poder exportar; si no, avisa
- [x] **Sinergias por adyacencia**: distritos complementarios cercanos dan bonus de producción (hasta +40%)
- [x] **Capa de logística** en el mapa: dibuja los enlaces entre distritos y el puerto
- [x] Modelo de defensa tipo LiDAR + valoración de Fortaleza
- [x] Capas conmutables (distritos, edificios, defensa, logística, rutas)
- [x] UI mobile-first con bottom-sheets
- [x] Progresión por nivel de Cabildo + autosave (localStorage) + migración de saves
- [x] Suite de tests (Vitest): geoUtils, validación de terreno, defensa, logística, reducer

## 🔮 Siguiente (Fase B — El comercio respira)

- [ ] Rutas dibujadas en el mapa mundial con barcos
- [ ] Zarpe automático + oro al volver
- [ ] Vientos/corrientes como modificadores de tiempo/riesgo
- [ ] Primeras notificaciones de evento (autorresueltas)

---

> Diseño: **el mapa es el juego**. La geografía crea las decisiones estratégicas, no es decoración.
