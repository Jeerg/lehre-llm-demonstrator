/* Der Bedeutungsraum in drei Dimensionen — drehbar, zoombar, anfassbar.
 *
 * Der echte Raum des Modells hat 2 048 Achsen. Zeigen laesst er sich nur in
 * dreien. Gesucht werden deshalb die drei Richtungen, in denen die
 * ausgewaehlten Vektoren am staerksten streuen (Hauptkomponenten, gerechnet
 * auf dem Server aus den echten Embedding-Vektoren). Wieviel davon
 * uebrigbleibt, steht als "erklaerte Streuung" dabei — ehrlicher, als eine
 * huebsche Wolke ohne Massstab zu zeigen.
 *
 * Dies ist ein ES-Modul; es laeuft, weil der Demonstrator ueber einen
 * lokalen Server ausgeliefert wird. three.js und OrbitControls liegen unter
 * vendor/, es wird nichts nachgeladen.
 */

import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

// Die Farben dieses Bildes haengen an der Fassung (hell/dunkel) und stehen
// in palette.js. Als Funktion, nicht als Konstante: der Raum wird bei jedem
// Fassungswechsel neu aufgebaut und liest die Werte dann erneut.
function raumfarben() { return PALETTE.zeichner("raum"); }
function z(name) { return PALETTE.zahl(raumfarben()[name]); }

const FARBEN = {
  get satz() { return z("satz"); },
  get nachbar() { return z("nachbar"); },
  get hintergrund() { return z("hintergrund"); }
};

function beschriftung(text, farbe, groesse) {
  const c = document.createElement("canvas");
  const s = 4;                       // Ueberabtastung, damit die Schrift traegt
  const ctx = c.getContext("2d");
  ctx.font = `${13 * s}px Consolas, monospace`;
  const breite = Math.ceil(ctx.measureText(text).width) + 12 * s;
  c.width = breite; c.height = 22 * s;
  const g = c.getContext("2d");
  g.font = `${13 * s}px Consolas, monospace`;
  g.textBaseline = "middle";
  g.fillStyle = "rgba(13,17,23,0.72)";
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = farbe;
  g.fillText(text, 6 * s, c.height / 2);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true,
                                         depthWrite: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set((breite / s) * groesse / 22, groesse, 1);
  return sp;
}

/** Baut den Raum in `wurzel`. Rueckgabe: Steuerung zum Aktualisieren. */
export function bauen(wurzel, beiAuswahl) {
  const breite = wurzel.clientWidth || 1100;
  const hoehe = Math.round(Math.min(720, Math.max(420, breite * 0.58)));

  const szene = new THREE.Scene();
  szene.background = new THREE.Color(z("grund"));
  szene.fog = new THREE.FogExp2(z("grund"), 0.012);

  const kamera = new THREE.PerspectiveCamera(46, breite / hoehe, 0.1, 400);
  kamera.position.set(17, 12, 20);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(breite, hoehe);
  wurzel.appendChild(renderer.domElement);

  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.enableDamping = true;
  steuerung.dampingFactor = 0.08;
  steuerung.rotateSpeed = 0.75;
  steuerung.zoomSpeed = 0.9;

  szene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const licht = new THREE.DirectionalLight(0xffffff, 0.6);
  licht.position.set(1, 1, 1);
  szene.add(licht);

  // Achsenkreuz: die drei Hauptrichtungen des Raums
  const achsen = new THREE.Group();
  [[1, 0, 0, PALETTE.zahl(PALETTE.token("--magenta"))],
   [0, 1, 0, PALETTE.zahl(PALETTE.token("--gruen"))],
   [0, 0, 1, PALETTE.zahl(PALETTE.token("--cyan"))]]
    .forEach(([x, y, z, farbe]) => {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-11 * x, -11 * y, -11 * z),
        new THREE.Vector3(11 * x, 11 * y, 11 * z)]);
      achsen.add(new THREE.Line(geo,
        new THREE.LineBasicMaterial({ color: farbe, transparent: true,
                                      opacity: 0.32 })));
    });
  szene.add(achsen);

  const gitter = new THREE.GridHelper(24, 12, z("gitter"), z("gitter2"));
  gitter.material.transparent = true;
  gitter.material.opacity = 0.35;
  gitter.position.y = -11;
  szene.add(gitter);

  let punkteGruppe = new THREE.Group();
  let schriftGruppe = new THREE.Group();
  let pfeilGruppe = new THREE.Group();
  szene.add(punkteGruppe, schriftGruppe, pfeilGruppe);

  const strahl = new THREE.Raycaster();
  strahl.params.Points.threshold = 0.42;
  const maus = new THREE.Vector2();
  let daten = null, kugeln = null, zeigeAlleNamen = false;

  renderer.domElement.addEventListener("pointerdown", (ev) => {
    if (!kugeln || !daten) { return; }
    const r = renderer.domElement.getBoundingClientRect();
    maus.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    maus.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
    strahl.setFromCamera(maus, kamera);
    const treffer = strahl.intersectObject(kugeln);
    if (treffer.length && beiAuswahl) {
      beiAuswahl(daten.punkte[treffer[0].index]);
    }
  });

  function leeren(g) {
    while (g.children.length) {
      const k = g.children.pop();
      if (k.geometry) { k.geometry.dispose(); }
      if (k.material) {
        if (k.material.map) { k.material.map.dispose(); }
        k.material.dispose();
      }
    }
  }

  function setzen(neu, opt) {
    daten = neu;
    opt = opt || {};
    zeigeAlleNamen = !!opt.alleNamen;
    leeren(punkteGruppe); leeren(schriftGruppe); leeren(pfeilGruppe);

    const n = daten.punkte.length;
    const lagen = new Float32Array(n * 3);
    const farben = new Float32Array(n * 3);
    const groessen = new Float32Array(n);
    const f = new THREE.Color();

    daten.punkte.forEach((p, i) => {
      lagen[i * 3] = p.x; lagen[i * 3 + 1] = p.y; lagen[i * 3 + 2] = p.z;
      f.setHex(FARBEN[p.gruppe] || FARBEN.hintergrund);
      farben[i * 3] = f.r; farben[i * 3 + 1] = f.g; farben[i * 3 + 2] = f.b;
      groessen[i] = p.gruppe === "satz" ? 0.55
        : (p.gruppe === "nachbar" ? 0.34 : 0.15);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(lagen, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(farben, 3));
    geo.setAttribute("groesse", new THREE.BufferAttribute(groessen, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `
        attribute float groesse;
        varying vec3 vFarbe;
        void main() {
          vFarbe = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = groesse * 320.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vFarbe;
        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.5) { discard; }
          float rand = smoothstep(0.5, 0.34, r);
          gl_FragColor = vec4(vFarbe, rand);
        }`,
      vertexColors: true
    });
    kugeln = new THREE.Points(geo, mat);
    punkteGruppe.add(kugeln);

    // Vektoren der Satzstuecke: vom Ursprung zum Punkt. Erst dadurch wird
    // sichtbar, dass es Vektoren sind und nicht nur Punkte.
    daten.punkte.forEach((p) => {
      if (p.gruppe !== "satz") { return; }
      const ziel = new THREE.Vector3(p.x, p.y, p.z);
      const geoL = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0), ziel]);
      pfeilGruppe.add(new THREE.Line(geoL,
        new THREE.LineBasicMaterial({ color: FARBEN.satz, transparent: true,
                                      opacity: 0.5 })));
    });

    // Schriftgroesse: die erste Fassung war mit 0.78 Welteinheiten so
    // gross, dass die Namen den Raum zustellten — bei zehn Punkten ging
    // das, bei vierhundert nicht. Der Grundwert ist deshalb kleiner UND
    // einstellbar: der Demonstrator laeuft auch am Beamer, wo groesser
    // richtig ist.
    const sk = opt.schrift === undefined ? 1 : opt.schrift;
    // Die Schrift steht in WELT-Einheiten und waechst deshalb beim
    // Heranzoomen mit. Wird auf eine enge Nachbarschaft gefiltert und die
    // Kamera zieht nach, waeren die Namen sonst wieder riesig. Also mit dem
    // gezeigten Ausschnitt skalieren.
    let sx0 = Infinity, sx1 = -Infinity;
    daten.punkte.forEach((p) => {
      sx0 = Math.min(sx0, p.x, p.y, p.z);
      sx1 = Math.max(sx1, p.x, p.y, p.z);
    });
    const anteil = Math.max(0.12, Math.min(1, (sx1 - sx0) / 20));

    daten.punkte.forEach((p) => {
      if (!zeigeAlleNamen && p.gruppe === "hintergrund") { return; }
      if (!zeigeAlleNamen && p.gruppe === "nachbar" && !opt.nachbarNamen) { return; }
      const f = raumfarben();
      const farbe = p.gruppe === "satz" ? f.satzText
        : (p.gruppe === "nachbar" ? f.nachbarText : f.hintergrundText);
      const hoch = (p.gruppe === "satz" ? 0.42 : 0.30) * sk * anteil;
      const sp = beschriftung(p.text.replace(/ /g, "·"), farbe, hoch);
      sp.position.set(p.x, p.y + hoch * 0.95 + 0.12, p.z);
      schriftGruppe.add(sp);
    });
  }

  // Markierung der gewaehlten Stelle des Satzes.
  //
  // Ein Klick auf ein Stueck oben muss AUCH hier ankommen — sonst ist der
  // Raum das einzige Bild der Seite, das die Wahl ignoriert. Gezeigt wird
  // ein gelbes Drahtgitter um den Punkt; es bleibt aus jeder Blickrichtung
  // sichtbar, anders als ein flacher Ring.
  const markeGruppe = new THREE.Group();
  szene.add(markeGruppe);

  function markieren(tokenId) {
    leeren(markeGruppe);
    if (!daten || tokenId === null || tokenId === undefined) { return null; }
    let p = null;
    daten.punkte.forEach((q) => { if (q.id === tokenId) { p = q; } });
    if (!p) { return null; }
    // Der Ring waechst mit dem gezeigten Ausschnitt: im ganzen Raum muss er
    // auffallen, in einer engen Nachbarschaft darf er die Nachbarn nicht
    // verdecken.
    let spanne = 0;
    daten.punkte.forEach((q) => {
      spanne = Math.max(spanne, Math.abs(q.x - p.x), Math.abs(q.y - p.y),
                        Math.abs(q.z - p.z));
    });
    // Grob geteiltes Drahtgitter: es soll ein Kaefig um den Punkt sein, kein
    // gelber Klumpen. Mit 20x14 Segmenten wird das Netz so dicht, dass es
    // den Punkt und seinen Namen verdeckt.
    const r = Math.max(0.10, Math.min(0.45, spanne * 0.05));
    const kugel = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 6),
      new THREE.MeshBasicMaterial({
        color: PALETTE.zahl(PALETTE.token("--wahl")), wireframe: true,
                                    transparent: true, opacity: 0.7 }));
    kugel.position.set(p.x, p.y, p.z);
    markeGruppe.add(kugel);
    return p;
  }

  function ausrichten() {
    kamera.position.set(17, 12, 20);
    steuerung.target.set(0, 0, 0);
    steuerung.update();
  }

  /** Die Kamera auf die SICHTBAREN Punkte legen.
   *
   *  Wird auf die Nachbarschaft eines Wortes gefiltert, bleiben von 529
   *  Punkten neun uebrig — und die liegen als winziger Klumpen irgendwo im
   *  Bild, weil die Ansicht noch den ganzen Raum umfasst. Ein Filter, nach
   *  dem man erst suchen und zoomen muss, nimmt einem die Arbeit nicht ab.
   */
  function einpassen() {
    if (!daten || !daten.punkte.length) { return; }
    let x0 = Infinity, y0 = Infinity, z0 = Infinity;
    let x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    daten.punkte.forEach((p) => {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    });
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, mz = (z0 + z1) / 2;
    const spanne = Math.max(x1 - x0, y1 - y0, z1 - z0, 1.2);
    const abstand = spanne * 1.9 + 2;
    steuerung.target.set(mx, my, mz);
    // Blickrichtung beibehalten, nur Abstand und Ziel anpassen — sonst
    // springt die Drehung, die man sich gerade eingestellt hat.
    const richtung = kamera.position.clone()
      .sub(new THREE.Vector3(mx, my, mz));
    if (richtung.lengthSq() < 1e-6) { richtung.set(1, 0.7, 1.2); }
    richtung.normalize().multiplyScalar(abstand);
    kamera.position.set(mx + richtung.x, my + richtung.y, mz + richtung.z);
    steuerung.update();
    return spanne;
  }

  let laeuft = true;
  function bild() {
    if (!laeuft) { return; }
    requestAnimationFrame(bild);
    steuerung.update();
    renderer.render(szene, kamera);
  }
  bild();

  function groesseAnpassen() {
    const b = wurzel.clientWidth || breite;
    const h = Math.round(Math.min(720, Math.max(420, b * 0.58)));
    kamera.aspect = b / h;
    kamera.updateProjectionMatrix();
    renderer.setSize(b, h);
  }
  window.addEventListener("resize", groesseAnpassen);

  /** Stand der Kamera — gerundet, damit ein Vergleich stabil ist.
   *  Wird von `pruefe_diagramme.js` gelesen: „bleibt der Blickwinkel bei
   *  einer neuen Auswahl stehen?“ laesst sich sonst nicht pruefen. */
  function stand() {
    const r = (v) => Math.round(v * 100) / 100;
    return {
      kamera: [r(kamera.position.x), r(kamera.position.y), r(kamera.position.z)],
      ziel: [r(steuerung.target.x), r(steuerung.target.y), r(steuerung.target.z)]
    };
  }

  return {
    setzen: setzen,
    markieren: markieren,
    einpassen: einpassen,
    stand: stand,
    ausrichten: ausrichten,
    achsenZeigen: (an) => { achsen.visible = an; gitter.visible = an; },
    beenden: () => { laeuft = false; renderer.dispose(); }
  };
}

window.RAUM3D = { bauen: bauen };
