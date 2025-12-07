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
    // satelliteId of highlighted portal when hovering list (null = none)
    let highlightedPortalSatelliteId = null;

    // persistent nextSatelliteId to avoid duplicates after deletes
    let nextSatelliteId = 0;

    // Ensure UI parts exist (create field list + undo/redo)
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

        // Add UI improvements: Next Satellite ID display/input and Reset Satellite IDs button
        let nsContainer = document.getElementById('nextSatContainer');
        if (!nsContainer) {
            nsContainer = document.createElement('div');
            nsContainer.id = 'nextSatContainer';
            nsContainer.style.display = 'flex';
            nsContainer.style.alignItems = 'center';
            nsContainer.style.gap = '6px';
            nsContainer.style.marginTop = '6px';

            const label = document.createElement('label');
            label.textContent = 'Next Satellite ID:';
            label.htmlFor = 'nextSatInput';
            nsContainer.appendChild(label);

            const input = document.createElement('input');
            input.type = 'number';
            input.id = 'nextSatInput';
            input.style.width = '60px';
            input.value = nextSatelliteId;
            input.addEventListener('change', () => {
                const v = parseInt(input.value, 10);
                if (!isNaN(v) && v >= 0) nextSatelliteId = v;
            });
            nsContainer.appendChild(input);

            const resetBtn = document.createElement('button');
            resetBtn.textContent = 'Reset Satellite IDs';
            resetBtn.addEventListener('click', () => {
                for (let i = 0; i < portals.length; i++) {
                    portals[i].satelliteId = i;
                    portals[i].orderId = i;
                }
                nextSatelliteId = portals.length;
                const ns = document.getElementById('nextSatInput');
                if (ns) ns.value = nextSatelliteId;
                updateList();
                deleteAllLinks(false);
                const autoConnectCheck = document.getElementById('autoConnectCheck');
                if (autoConnectCheck && autoConnectCheck.checked) createLinks();
                pushState('resetSatelliteIds');
            });
            nsContainer.appendChild(resetBtn);

            controls.appendChild(nsContainer);
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

        // Nach Sortierung: satelliteId und orderId neu zuweisen (wieder in Einklang bringen)
        for (let i = 0; i < portals.length; i++) {
            portals[i].satelliteId = i;
            portals[i].orderId = i;
        }
        nextSatelliteId = portals.length;

        updateList();
        deleteAllLinks(false);
        // Nach Sort evtl. Links neu erstellen (updateList -> createLinks if autoconnect)
        const autoConnectCheck = document.getElementById('autoConnectCheck');
        if (autoConnectCheck && autoConnectCheck.checked) {
            createLinks();
        }

        sortClockwise = !reverse;
        pushState('sortPortalsRadially');
    }

    function rotatePortalsLeft() {
        if (portals.length > 0) {
            portals.push(portals.shift()); // Verschiebt das erste Element ans Ende
            // Nach Rotation: satelliteId und orderId neu zuweisen (wieder in Einklang bringen)
            for (let i = 0; i < portals.length; i++) {
                portals[i].satelliteId = i;
                portals[i].orderId = i;
            }
            nextSatelliteId = portals.length;
            updateList();
            deleteAllLinks(false);
            const autoConnectCheck = document.getElementById('autoConnectCheck');
            if (autoConnectCheck && autoConnectCheck.checked) {
                createLinks();
            }
            pushState('rotateLeft');
        }
    }

    function rotatePortalsRight() {
        if (portals.length > 0) {
            portals.unshift(portals.pop()); // Verschiebt das letzte Element an den Anfang
            // Nach Rotation: satelliteId und orderId neu zuweisen (wieder in Einklang bringen)
            for (let i = 0; i < portals.length; i++) {
                portals[i].satelliteId = i;
                portals[i].orderId = i;
            }
            nextSatelliteId = portals.length;
            updateList();
            deleteAllLinks(false);
            const autoConnectCheck = document.getElementById('autoConnectCheck');
            if (autoConnectCheck && autoConnectCheck.checked) {
                createLinks();
            }
            pushState('rotateRight');
        }
    }

    function updateIndexesAndUI(force = false) {
        // Order-Id entspricht immer der aktuellen Arrayposition (0-basiert)
        for (let i = 0; i < portals.length; i++) {
            portals[i].orderId = i;
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

    // Helper to connect newPortal against earlierPortals sequence,
    // considering already existing links (to avoid intersections)
    function connectPortalAgainstSequence(newPortal, earlierSequence) {
        // for each earlier portal in the provided sequence, attempt to add link
        for (let p of earlierSequence) {
            const sourceIndex = portals.findIndex(x => x.satelliteId === p.satelliteId);
            const targetIndex = portals.findIndex(x => x.satelliteId === newPortal.satelliteId);
            if (sourceIndex === -1 || targetIndex === -1) continue; // safety

            let intersect = false;
            for (let link of links) {
                if (intersects(portals[sourceIndex].x, portals[sourceIndex].y, portals[targetIndex].x, portals[targetIndex].y,
                        portals[link.source].x, portals[link.source].y, portals[link.target].x, portals[link.target].y)) {
                    intersect = true;
                    break;
                }
            }

            if (!intersect) {
                const newLink = {
                    source: sourceIndex,
                    target: targetIndex
                };
                links.push(newLink);
                checkForNewFields(newLink);
            }
        }
    }

    function createLinks() {
        deleteAllLinks(false); // Zurücksetzen vorhandener Links (no history push here)

        // FIRST PASS: work by satelliteId ordering (ascending)
        const satelliteOrder = portals.slice().sort((a, b) => a.satelliteId - b.satelliteId);
        for (let i = 0; i < satelliteOrder.length; i++) {
            const newPortal = satelliteOrder[i];
            const earlier = satelliteOrder.slice(0, i);
            connectPortalAgainstSequence(newPortal, earlier);
        }

        // SECOND PASS: work by orderId ordering (array/list order)
        const orderSequence = portals.slice().sort((a, b) => a.orderId - b.orderId);
        for (let i = 0; i < orderSequence.length; i++) {
            const newPortal = orderSequence[i];
            const earlier = orderSequence.slice(0, i);
            connectPortalAgainstSequence(newPortal, earlier);
        }

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
        // satelliteId automatically from nextSatelliteId (persistent)
        const newSatelliteId = nextSatelliteId++;
        const newPortal = {
            satelliteId: newSatelliteId,
            orderId: portals.length, // initial position at end
            x: x,
            y: y
        };

        // Update nextSat input if present
        const ns = document.getElementById('nextSatInput');
        if (ns) ns.value = nextSatelliteId;

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
        // After removal, recalc orderIds and update UI
        updateIndexesAndUI();
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
        // Beschriftung zeigt satelliteId (sichtbare ID)
        ctx.strokeText(portal.satelliteId, portal.x, portal.y);
        ctx.fillStyle = hexToRGBA(portalColor, portalTransparency);
        ctx.fillText(portal.satelliteId, portal.x, portal.y);
        ctx.lineWidth = 2;

        // Highlighting when it's the "center" (satelliteId==0) OR when hovered in the list
        if (portal.satelliteId === 0) {
            const highlightRadius = drawPortalSymbolRadius + 4; // 4px größer als der Radius des Portals
            ctx.strokeStyle = hexToRGBA(highlightColor, highlightTransparency);
            ctx.lineWidth = 2; // Die Linienbreite für den Kreis
            ctx.beginPath();
            ctx.arc(portal.x, portal.y, highlightRadius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.closePath();
        };

        if (highlightedPortalSatelliteId !== null && portal.satelliteId === highlightedPortalSatelliteId) {
            const highlightRadius = drawPortalSymbolRadius + 6;
            ctx.strokeStyle = hexToRGBA(highlightColor, Math.min(1, highlightTransparency + 0.3));
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(portal.x, portal.y, highlightRadius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.closePath();
        }
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
        portals.forEach((portal, idx) => {
            const row = document.createElement('tr'); // Erstelle eine neue Zeile
            row.draggable = true;

            const orderCell = document.createElement('td');
            orderCell.textContent = portal.orderId;
            row.appendChild(orderCell);

            const satCell = document.createElement('td');
            satCell.textContent = portal.satelliteId;
            row.appendChild(satCell);

            const xCell = document.createElement('td');
            xCell.textContent = portal.x;
            row.appendChild(xCell);

            const yCell = document.createElement('td');
            yCell.textContent = portal.y;
            row.appendChild(yCell);

            // Hover -> highlight portal on canvas
            row.addEventListener('mouseenter', () => {
                highlightedPortalSatelliteId = portal.satelliteId;
                redrawAll();
            });
            row.addEventListener('mouseleave', () => {
                highlightedPortalSatelliteId = null;
                redrawAll();
            });

            // Drag&Drop handlers
            row.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', portal.satelliteId.toString());
                e.dataTransfer.effectAllowed = 'move';
                try {
                    e.dataTransfer.setDragImage(row, 0, 0);
                } catch (err) {
                    // ignore if not supported
                }
                // visual cue
                row.style.opacity = '0.5';
                row.classList.add('dragging');
            });
            row.addEventListener('dragend', (e) => {
                row.classList.remove('dragging');
                row.style.opacity = '';
            });

            row.addEventListener('dragover', (e) => {
                e.preventDefault(); // allow drop
                row.classList.add('dragover');
                row.style.background = '#f0f8ff';
            });
            row.addEventListener('dragleave', (e) => {
                row.classList.remove('dragover');
                row.style.background = '';
            });
            row.addEventListener('drop', (e) => {
                e.preventDefault();
                row.classList.remove('dragover');
                row.style.background = '';
                const draggedSat = parseInt(e.dataTransfer.getData('text/plain'), 10);
                const targetSat = portal.satelliteId;
                if (isNaN(draggedSat) || draggedSat === targetSat) return;

                // Reorder portals array: move dragged portal to position of target (before target)
                const draggedIndex = portals.findIndex(p => p.satelliteId === draggedSat);
                const targetIndex = portals.findIndex(p => p.satelliteId === targetSat);
                if (draggedIndex === -1 || targetIndex === -1) return;

                const [draggedPortal] = portals.splice(draggedIndex, 1);
                // if draggedIndex < targetIndex after splice targetIndex decreases by 1
                let insertIndex = targetIndex;
                if (draggedIndex < targetIndex) insertIndex = targetIndex;
                portals.splice(insertIndex, 0, draggedPortal);

                // After reorder, update orderId for all
                for (let i = 0; i < portals.length; i++) portals[i].orderId = i;

                updateList();
                redrawAll();

                // Recreate links only if autoconnect is enabled
                const autoConnectCheck = document.getElementById('autoConnectCheck');
                if (autoConnectCheck && autoConnectCheck.checked) {
                    createLinks();
                }

                pushState('reorderPortals');
            });

            listBody.appendChild(row); // Füge die Zeile zum Tabellenkörper hinzu
        });

        // update nextSat input
        const ns = document.getElementById('nextSatInput');
        if (ns) ns.value = nextSatelliteId;
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
        const el = document.getElementBy
