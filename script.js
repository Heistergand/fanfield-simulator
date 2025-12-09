// This code was initially generated with the assistance of OpenAI's GPT-3.5, a powerful language model, and subsequently 
// reviewed and refined by a developer to ensure functionality, efficiency, and adherence to best practices.

document.addEventListener("DOMContentLoaded", function () {
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const listBody = document.getElementById('listBody');
    const container = document.getElementById('container');
    const drawPortalSymbolRadius = 10;

    // Globale Variablen für Farbeinstellungen

    let portalColor = '#FFFF00'; // Standardfarbe für Portale
    let portalTransparency = 1;

    let linkColor = '#FFFF00'; // Standardfarbe für Links
    let linkTransparency = 1;

    let fieldColor = '#FFFF00'; // Standardfarbe für Felder
    let fieldTransparency = 0.15;

    let highlightColor = '#FFFFFF'; // Standardfarbe für Felder
    let highlightTransparency = 0.5;

    let portals = [];
    let links = [];
    let fields = []; // array of [a,b,c] triplets
    let sortClockwise = true;

    // History for undo/redo
    const history = [];
    let historyIndex = -1;
    const HISTORY_LIMIT = 200;

    // UI elements we'll create dynamically (field list and undo/redo)
    let fieldListContainer = null;
    let undoBtn = null;
    let redoBtn = null;

    // Index of highlighted field (for hover), -1 = none
    let highlightedFieldIndex = -1;

    // animation flags
    let isSimulating = false;
    let simulationFastForward = false;
    
    let visibleLinksCount = null;
    let visibleFieldsCount = null;
    
    let delayPerObjectSeconds = 1.0; // wird vom UI gesetzt

    const simulateButton = document.getElementById('btn-simulate');
    const speedSelect = document.getElementById('select-speed');
    
    speedSelect.addEventListener('change', (e) => {
      const value = parseFloat(e.target.value);
      delayPerObjectSeconds = isNaN(value) ? 1.0 : value;
    });
    
    function setSimulationUiState(isRunning) {
      const allControls = document.querySelectorAll('button, input, select');
    
      allControls.forEach(el => {
        // Simulation-Button wird speziell behandelt
        if (el === simulateButton) {
          el.disabled = false; // bleibt klickbar
          el.textContent = isRunning ? 'Stop' : 'Simulate';
        } else {
          el.disabled = isRunning;
        }
      });
    }


    // Ensure UI parts exist (create field list + undo/redo buttons)
    function ensureUIExtras() {
        // find controls area (first child div inside container that holds buttons)
        const controls = container.querySelector('div');
        if (!controls) return;

        // Create Undo/Redo buttons if missing
        if (!undoBtn) {
            undoBtn = document.createElement('button');
            undoBtn.textContent = 'Undo';
            undoBtn.id = 'undoBtn';
            undoBtn.className = 'small-btn';
            undoBtn.disabled = true;
            undoBtn.addEventListener('click', undo);
            controls.insertBefore(undoBtn, controls.firstChild);
        }
        if (!redoBtn) {
            redoBtn = document.createElement('button');
            redoBtn.textContent = 'Redo';
            redoBtn.id = 'redoBtn';
            redoBtn.className = 'small-btn';
            redoBtn.disabled = true;
            redoBtn.addEventListener('click', redo);
            controls.insertBefore(redoBtn, controls.firstChild);
        }

        // Field list container
        if (!fieldListContainer) {
            fieldListContainer = document.createElement('div');
            fieldListContainer.id = 'fieldListContainer';
            fieldListContainer.style.maxHeight = '200px';
            fieldListContainer.style.overflowY = 'auto';
            fieldListContainer.style.marginTop = '8px';

            const title = document.createElement('div');
            title.innerHTML = '<strong>Fields (hover to highlight)</strong>';
            title.style.marginBottom = '6px';
            fieldListContainer.appendChild(title);

            const list = document.createElement('div');
            list.id = 'fieldList';
            fieldListContainer.appendChild(list);

            controls.appendChild(fieldListContainer);
        }
    }

    ensureUIExtras();

    function sortPortalsRadially(reverse = false) {
        if (portals.length === 0)
            return;
        const center = portals[0];
        portals = portals.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - center.y, a.x - center.x);
            const angleB = Math.atan2(b.y - center.y, b.x - center.x);
            return reverse ? angleB - angleA : angleA - angleB;
        });
        portals.unshift(center); // Füge das Zentrum wieder hinzu
        updateIndexesAndUI();
        sortClockwise = !reverse;
        pushState('sortPortalsRadially');
    }

    function rotatePortalsLeft() {
        if (portals.length > 0) {
            portals.push(portals.shift()); // Verschiebt das erste Element ans Ende
            updateIndexesAndUI();
            pushState('rotateLeft');
        }
    }

    function rotatePortalsRight() {
        if (portals.length > 0) {
            portals.unshift(portals.pop()); // Verschiebt das letzte Element an den Anfang
            updateIndexesAndUI();
            pushState('rotateRight');
        }
    }

    function updateIndexesAndUI(force = false) {
        for (let i = 0; i < portals.length; i++) {
            portals[i].index = i;
        }
        deleteAllLinks(false); // clear links & fields and redraw portals; false => don't push state again here
        updateList();
        // Überprüfe, ob Portale sofort verbunden werden sollen
        const autoConnectCheck = document.getElementById('autoConnectCheck');
        if (autoConnectCheck && (autoConnectCheck.checked || force)) {
            createLinks();
        }
        // We don't push state here in every call; callers do push where appropriate
    }

    // returns true if the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
    function intersects(a, b, c, d, p, q, r, s) {
        var det,
        gamma,
        lambda;
        det = (c - a) * (s - q) - (r - p) * (d - b);
        if (det === 0) {
            return false;
        } else {
            lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
            gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
            return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
        }
    };

    function distance(p, q) {
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    
    function connectPortalsWithLine(newPortal) {
      // Kein Vorgänger -> keine Links
      if (newPortal.index === 0) return;

      const anchor = portals[0];
      const newIndex = newPortal.index;

      // 1. Kandidaten sammeln: alle früheren Portale mit index < newPortal.index
      const candidates = [];

      for (let i = 0; i < newIndex; i++) {
        const p = portals[i];
        if (!p) continue;

        // Anker speziell behandeln, alle anderen bekommen eine Distanz-Metrik
        if (i === 0) {
          candidates.push({
            portalIndex: i,
            isAnchor: true,
            metric: Infinity // damit er sicher als erster dran ist
          });
        } else {
          const d = distance(newPortal, p); // "Größe" ~ Entfernung vom Anker
          candidates.push({
            portalIndex: i,
            isAnchor: false,
            metric: d
          });
        }
      }

      // 2. Kandidaten sortieren:
      //    - Anchor (metric = Infinity) kommt automatisch zuerst
      //    - die übrigen nach absteigender Distanz zum Anker
      candidates.sort((a, b) => b.metric - a.metric);

      // 3. In dieser Reihenfolge Links versuchen (mit Crosslink-Check wie bisher)
      for (const cand of candidates) {
        const i = cand.portalIndex;
        const p = portals[i];
        if (!p) continue;

        let intersectsExisting = false;

        for (const link of links) {
          const s = portals[link.source];
          const t = portals[link.target];
          if (!s || !t) continue;

          if (
            intersects(
              p.x,
              p.y,
              newPortal.x,
              newPortal.y,
              s.x,
              s.y,
              t.x,
              t.y
            )
          ) {
            intersectsExisting = true;
            break;
          }
        }

        if (!intersectsExisting) {
          const newLink = { source: i, target: newIndex };
          links.push(newLink);
          checkForNewFields(newLink);
        }
      }
    }


    function createLinks() {
        deleteAllLinks(false); // Zurücksetzen vorhandener Links (no history push here)
        for (let portal of portals) {
            connectPortalsWithLine(portal);
        };
        // Nach dem Erstellen aller Links: Feldanzahl aktualisieren und redraw
        updateFieldCount();
        redrawAll();
        pushState('createLinks');
    }

    function deleteAllLinks(pushHistory = true) {
        links = []; // Lösche alle Links
        fields = [];
        redrawAll(); // Neuzeichnen ohne Links
        updateFieldCount();
        updateFieldList();
        if (pushHistory) pushState('deleteAllLinks');
    }

    function deleteAllPortals() {
        links = [];
        portals = [];
        fields = [];
        redrawAll();
        updateList();
        updateFieldCount();
        updateFieldList();
        pushState('deleteAllPortals');
    }

    document.getElementById('sortPortals').addEventListener('click', () => { sortPortalsRadially(sortClockwise); });
    document.getElementById('connectPortals').addEventListener('click', createLinks);
    document.getElementById('deleteLinks').addEventListener('click', () => deleteAllLinks(true));
    document.getElementById('deletePortals').addEventListener('click', deleteAllPortals);
    document.getElementById('rotateLeftBtn').addEventListener('click', rotatePortalsLeft);
    document.getElementById('rotateRightBtn').addEventListener('click', rotatePortalsRight);


    // Anpassung der Canvas-Größe
    function resizeCanvas() {
        canvas.width = container.offsetWidth * 0.6; // 60% der Containerbreite
        canvas.height = container.offsetHeight; // Kann auf 100% der Containerhöhe gesetzt werden oder angepasst werden
        redrawAll();
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    canvas.addEventListener('mousedown', function (event) {
        if (event.button === 0) { // Linksklick
            addPortal(event.offsetX, event.offsetY);
        } else if (event.button === 2) { // Rechtsklick
            removePortal(event.offsetX, event.offsetY);
        }
    });

    // Kontextmenü bei Rechtsklick auf dem Canvas verhindern
    canvas.addEventListener('contextmenu', function (event) {
        event.preventDefault();
    });

    function addPortal(x, y) {

        const newPortalIndex = portals.length;
        const newPortal = {
            index: newPortalIndex,
            x: x,
            y: y
        };

        // Füge das neue Portal zu deiner Liste hinzu
        portals.push(newPortal);

        drawPortal(newPortal);
        updateList();
        pushState('addPortal');
    }

    function removePortal(x, y) {
        for (let i = portals.length - 1; i >= 0; i--) {
            const dx = x - portals[i].x;
            const dy = y - portals[i].y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < (drawPortalSymbolRadius + 2)) { // drawPortalSymbolRadius + Linienstärke
                portals.splice(i, 1);
                break;
            }
        }
        redrawAll();
        updateList();
        pushState('removePortal');
    }

    function drawPortal(portal) {
        ctx.strokeStyle = hexToRGBA(portalColor, portalTransparency);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, drawPortalSymbolRadius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 4;
        ctx.strokeText(portal.index, portal.x, portal.y);
        ctx.fillStyle = hexToRGBA(portalColor, portalTransparency);
        ctx.fillText(portal.index, portal.x, portal.y);
        ctx.lineWidth = 2;

        if (portal.index === 0) {
            const highlightRadius = drawPortalSymbolRadius + 4; // 4px größer als der Radius des Portals
            ctx.strokeStyle = hexToRGBA(highlightColor, highlightTransparency);
            ctx.lineWidth = 2; // Die Linienbreite für den Kreis
            ctx.beginPath();
            ctx.arc(portal.x, portal.y, highlightRadius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.closePath();
        };
    }

    function redrawAll() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // draw fields first (so portals and links are on top if needed)
        drawAllFields();
        // draw links
        drawAllLinks();
        // draw portals on top
        for (let portal of portals) {
            drawPortal(portal);
        }
    }

    function drawAllLinks() {
        ctx.strokeStyle = hexToRGBA(linkColor, linkTransparency);
        ctx.lineWidth = 2;
        for (let link of links) {
            const s = portals[link.source];
            const t = portals[link.target];
            if (!s || !t) continue; // safety
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(t.x, t.y);
            ctx.stroke();
        }
    }

    function drawAllFields() {
        for (let i = 0; i < fields.length; i++) {
            const f = fields[i];
            const [a, b, c] = f;
            // if highlighted, draw differently
            if (!portals[a] || !portals[b] || !portals[c]) continue; // safety
            if (i === highlightedFieldIndex) {
                // draw highlight fill + border
                ctx.fillStyle = hexToRGBA(fieldColor, Math.min(1, fieldTransparency + 0.35));
                ctx.beginPath();
                ctx.moveTo(portals[a].x, portals[a].y);
                ctx.lineTo(portals[b].x, portals[b].y);
                ctx.lineTo(portals[c].x, portals[c].y);
                ctx.closePath();
                ctx.fill();

                ctx.strokeStyle = hexToRGBA(highlightColor, 1);
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(portals[a].x, portals[a].y);
                ctx.lineTo(portals[b].x, portals[b].y);
                ctx.lineTo(portals[c].x, portals[c].y);
                ctx.closePath();
                ctx.stroke();
            } else {
                ctx.fillStyle = hexToRGBA(fieldColor, fieldTransparency);
                ctx.beginPath();
                ctx.moveTo(portals[a].x, portals[a].y);
                ctx.lineTo(portals[b].x, portals[b].y);
                ctx.lineTo(portals[c].x, portals[c].y);
                ctx.closePath();
                ctx.fill();
            }
        }
    }

    function updateList() {
        listBody.innerHTML = ''; // Bereinige die bestehende Liste
        portals.forEach(portal => {
            const row = document.createElement('tr'); // Erstelle eine neue Zeile

            const indexCell = document.createElement('td');
            indexCell.textContent = portal.index;
            row.appendChild(indexCell);

            const xCell = document.createElement('td');
            xCell.textContent = portal.x;
            row.appendChild(xCell);

            const yCell = document.createElement('td');
            yCell.textContent = portal.y;
            row.appendChild(yCell);

            listBody.appendChild(row); // Füge die Zeile zum Tabellenkörper hinzu
        });
    }

    // Fields helpers

    function pointIsOnLeftSideOfLine(x1, y1, x2, y2, px, py) {
        return ((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) > 0;
    }

    function calculateTriangleArea(x1, y1, x2, y2, x3, y3) {
        return Math.abs((x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2)) / 2.0);
    }

    function checkForNewFields(newLink) {
        let sourceLinks = links.filter(link => link.source === newLink.source || link.target === newLink.source);
        let targetLinks = links.filter(link => link.source === newLink.target || link.target === newLink.target);

        let potentialFields = [];

        sourceLinks.forEach(sLink => {
            targetLinks.forEach(tLink => {
                let sharedPortal = sLink.source === newLink.source ? sLink.target : sLink.source;
                if ((tLink.source === newLink.target && tLink.target === sharedPortal) || (tLink.target === newLink.target && tLink.source === sharedPortal)) {
                    if (!potentialFields.includes(sharedPortal)) {
                        potentialFields.push(sharedPortal);
                    }
                }
            });
        });

        let potentialFieldsLeft = [];
        let potentialFieldsRight = [];

        potentialFields.forEach(portalIndex => {
            if (pointIsOnLeftSideOfLine(portals[newLink.source].x, portals[newLink.source].y, portals[newLink.target].x, portals[newLink.target].y, portals[portalIndex].x, portals[portalIndex].y)) {
                potentialFieldsLeft.push(portalIndex);
            } else {
                potentialFieldsRight.push(portalIndex);
            }
        });

        // Bestimme und zeichne das größte Feld für die linke Seite
        determineAndDrawLargestField(newLink, potentialFieldsLeft, true);

        // Bestimme und zeichne das größte Feld für die rechte Seite
        determineAndDrawLargestField(newLink, potentialFieldsRight, false);
    }

    function sameFieldExists(triplet) {
        // compare ignoring order
        const sortedNew = triplet.slice().sort((a,b)=>a-b).join(',');
        for (let f of fields) {
            if (f.slice().sort((a,b)=>a-b).join(',') === sortedNew) return true;
        }
        return false;
    }

    function determineAndDrawLargestField(newLink, potentialFields, isLeftSide) {
        let largestArea = 0;
        let bestThirdPointIndex = -1;

        potentialFields.forEach(pointIndex => {
            let area = calculateTriangleArea(
                    portals[newLink.source].x, portals[newLink.source].y,
                    portals[newLink.target].x, portals[newLink.target].y,
                    portals[pointIndex].x, portals[pointIndex].y);

            if (area > largestArea) {
                largestArea = area;
                bestThirdPointIndex = pointIndex;
            }
        });

        if (bestThirdPointIndex !== -1) {
            const triplet = [newLink.source, newLink.target, bestThirdPointIndex];
            if (!sameFieldExists(triplet)) {
                fields.push(triplet); // Speichere das Feld (order-preserving)
                updateFieldCount();
                updateFieldList();
                // draw only the new field on top without clearing
                redrawAll();
            }
        }
    }

    function drawField(sourceIndex, targetIndex, thirdPointIndex) {
        ctx.fillStyle = hexToRGBA(fieldColor, fieldTransparency);
        ctx.beginPath();
        ctx.moveTo(portals[sourceIndex].x, portals[sourceIndex].y);
        ctx.lineTo(portals[targetIndex].x, portals[targetIndex].y);
        ctx.lineTo(portals[thirdPointIndex].x, portals[thirdPointIndex].y);
        ctx.closePath();
        ctx.fill();
    }

    //colors

    // Funktion, die eine HEX-Farbe (#RRGGBB) und einen Alpha-Wert (0-1) akzeptiert
    // und die entsprechende RGBA-Farbe als String zurückgibt
    function hexToRGBA(hex, alpha = 1) {
        // Entferne das # am Anfang, falls vorhanden
        hex = hex.replace(/^#/, '');

        // Parse die Hexadezimal-Werte
        let r = parseInt(hex.substring(0, 2), 16);
        let g = parseInt(hex.substring(2, 4), 16);
        let b = parseInt(hex.substring(4, 6), 16);

        // Rückgabe der RGBA-Farbe
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    // Neue Funktion: aktualisiert die Feldanzahl in der UI
    function updateFieldCount() {
        const el = document.getElementById('fieldCount');
        if (el) {
            el.textContent = fields.length;
        }
        if (undoBtn) {
            undoBtn.disabled = historyIndex <= 0;
        }
        if (redoBtn) {
            redoBtn.disabled = historyIndex >= history.length - 1;
        }
    }

    function updateFieldList() {
        ensureUIExtras();
        const list = document.getElementById('fieldList');
        if (!list) return;
        list.innerHTML = '';
        fields.forEach((f, idx) => {
            const row = document.createElement('div');
            row.className = 'fieldRow';
            row.style.padding = '4px';
            row.style.borderBottom = '1px solid #ddd';
            row.style.cursor = 'pointer';
            row.textContent = `#${idx}: ${f[0]}, ${f[1]}, ${f[2]}`;
            row.addEventListener('mouseenter', () => {
                highlightedFieldIndex = idx;
                redrawAll();
            });
            row.addEventListener('mouseleave', () => {
                highlightedFieldIndex = -1;
                redrawAll();
            });
            list.appendChild(row);
        });
    }

    // Event-Listener für Farbauswahl
    document.getElementById('portalColorPicker').addEventListener('change', function () {
        portalColor = this.value;
        updateIndexesAndUI(true);
        pushState('portalColorChange');
    });

    document.getElementById('linkColorPicker').addEventListener('change', function () {
        linkColor = this.value;
        updateIndexesAndUI(true);
        pushState('linkColorChange');
    });

    document.getElementById('fieldColorPicker').addEventListener('change', function () {
        fieldColor = this.value;
        updateIndexesAndUI(true);
        pushState('fieldColorChange');
    });

    document.getElementById('highlightColorPicker').addEventListener('change', function () {
        highlightColor = this.value;
        updateIndexesAndUI(true);
        pushState('highlightColorChange');
    });

    // Verwende die Farbvariablen beim Zeichnen
    // Beispiel: ctx.fillStyle = portalColor; beim Zeichnen eines Portals

    document.getElementById('fieldTransparencySlider').addEventListener('input', function () {
        // Aktualisiere die Feld-Transparenz basierend auf dem Slider-Wert
        fieldTransparency = parseFloat(this.value);
        document.getElementById('transparencyValue').textContent = fieldTransparency;
        updateIndexesAndUI(true);
        pushState('fieldTransparencyChange');
    });

    document.getElementById('presetENL').addEventListener('click', () => { colorPreset('ENL'); pushState('presetENL'); });
    document.getElementById('presetRES').addEventListener('click', () => { colorPreset('RES'); pushState('presetRES'); });
    document.getElementById('presetMAC').addEventListener('click', () => { colorPreset('MAC'); pushState('presetMAC'); });
    document.getElementById('presetNTR').addEventListener('click', () => { colorPreset('NTR'); pushState('presetNTR'); });

    function colorPreset(faction) {
      let color;
        switch (faction) {
        case 'ENL':
            color = '#00FF00';
            break;
        case 'RES':
            color = '#0000FF';
            break;
        case 'MAC':
            color = '#FF0000';
            break;
        case 'NTR':
            color = '#FFFFFF';
            break;
        default:
            // abort
            return;
        };
        portalColor = color;
        document.getElementById('portalColorPicker').value = color;
        
        linkColor = color;
        document.getElementById('linkColorPicker').value = color;
        
        fieldColor = color;
        document.getElementById('fieldColorPicker').value = color;
        
        updateIndexesAndUI(true);
    }

    // History functions (undo/redo)

    function getStateSnapshot() {
        // lightweight deep clone using JSON since structures are simple ints + coords + colors
        return JSON.parse(JSON.stringify({
            portals,
            links,
            fields,
            portalColor,
            linkColor,
            fieldColor,
            fieldTransparency,
            highlightColor,
            highlightTransparency,
            sortClockwise
        }));
    }

    function restoreState(snapshot) {
        portals = snapshot.portals || [];
        links = snapshot.links || [];
        fields = snapshot.fields || [];
        portalColor = snapshot.portalColor || portalColor;
        linkColor = snapshot.linkColor || linkColor;
        fieldColor = snapshot.fieldColor || fieldColor;
        fieldTransparency = typeof snapshot.fieldTransparency === 'number' ? snapshot.fieldTransparency : fieldTransparency;
        highlightColor = snapshot.highlightColor || highlightColor;
        highlightTransparency = typeof snapshot.highlightTransparency === 'number' ? snapshot.highlightTransparency : highlightTransparency;
        sortClockwise = typeof snapshot.sortClockwise === 'boolean' ? snapshot.sortClockwise : sortClockwise;

        // restore UI controls values if present
        const pc = document.getElementById('portalColorPicker');
        if (pc) pc.value = portalColor;
        const lc = document.getElementById('linkColorPicker');
        if (lc) lc.value = linkColor;
        const fc = document.getElementById('fieldColorPicker');
        if (fc) fc.value = fieldColor;
        const hC = document.getElementById('highlightColorPicker');
        if (hC) hC.value = highlightColor;
        const ft = document.getElementById('fieldTransparencySlider');
        if (ft) ft.value = fieldTransparency;
        const tv = document.getElementById('transparencyValue');
        if (tv) tv.textContent = fieldTransparency;

        // reindex portals
        for (let i = 0; i < portals.length; i++) portals[i].index = i;

        highlightedFieldIndex = -1;
        redrawAll();
        updateList();
        updateFieldCount();
        updateFieldList();
    }

    function pushState(description) {
        // remove any redo states
        if (historyIndex < history.length - 1) {
            history.splice(historyIndex + 1);
        }
        history.push(getStateSnapshot());
        if (history.length > HISTORY_LIMIT) history.shift();
        historyIndex = history.length - 1;
        updateFieldCount();
    }

    function undo() {
        if (historyIndex <= 0) return;
        historyIndex--;
        const snapshot = history[historyIndex];
        if (snapshot) {
            restoreState(snapshot);
            updateFieldCount();
        }
    }

    function redo() {
        if (historyIndex >= history.length - 1) return;
        historyIndex++;
        const snapshot = history[historyIndex];
        if (snapshot) {
            restoreState(snapshot);
            updateFieldCount();
        }
    }

    // initialize history with initial empty state
    pushState('initial');

});
