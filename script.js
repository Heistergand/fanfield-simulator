// Dieser Code ist das Ergebnis einer einzigartigen Zusammenarbeit zwischen einem menschlichen Entwickler und künstlicher Intelligenz (OpenAI GPT-3.5). 
// Die initiale Struktur und die grundlegenden Konzepte wurden durch die KI vorgeschlagen und bereitgestellt, während die detaillierte Ausarbeitung, 
// Optimierung und Anpassung an spezifische Anforderungen durch die menschliche Expertise erfolgten. Diese Synergie ermöglichte eine effiziente 
// Problemlösung und die Realisierung kreativer Ideen.

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
    let fields = [];
    let sortClockwise = true;

    function sortPortalsRadially(reverse = false) {
        // debugger;
        if (portals.length === 0)
            return;
        const center = portals[0];
        portals = portals.slice(1).sort((a, b) => {
            const angleA = Math.atan2(a.y - center.y, a.x - center.x);
            const angleB = Math.atan2(b.y - center.y, b.x - center.x);
            return reverse ? angleB - angleA : angleA - angleB;
        });
        portals.unshift(center); // Füge das Zentrum wieder hinzu

        // for (let i = 0; i < portals.length; i++) {
        // portals[i].index = i;
        // };

        // deleteAllLinks();
        // // redrawPortals(); // already done in deleteAllLinks();
        // updateList();
        // const autoConnectCheck = document.getElementById('autoConnectCheck');
        // if (autoConnectCheck.checked) {
        // // Wenn ja, rufe die Funktion zum Verbinden der Portale auf
        // createLinks();
        // }
        updateIndexesAndUI();
        sortClockwise = !reverse;
    }

    function rotatePortalsLeft() {
        if (portals.length > 0) {
            portals.push(portals.shift()); // Verschiebt das erste Element ans Ende
            updateIndexesAndUI();
        }
    }

    function rotatePortalsRight() {
        if (portals.length > 0) {
            portals.unshift(portals.pop()); // Verschiebt das letzte Element an den Anfang
            updateIndexesAndUI();
        }
    }

    function updateIndexesAndUI(force = false) {
        for (let i = 0; i < portals.length; i++) {
            portals[i].index = i;
        }
        deleteAllLinks();
        updateList();
        // Überprüfe, ob Portale sofort verbunden werden sollen
        const autoConnectCheck = document.getElementById('autoConnectCheck');
        if (autoConnectCheck.checked || force) {
            createLinks();
        }
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

    function connectPortalsWithLine(newPortal) {
        for (let i = 0; i < newPortal.index; i++) {
            let intersect = false;

            // Prüfe für jede bestehende Verbindung, ob die geplante Verbindung
            // von Portal i zum neuen Portal eine bestehende Verbindung kreuzen würde.
            for (let link of links) {
                if (intersects(portals[i].x, portals[i].y, newPortal.x, newPortal.y,
                        portals[link.source].x, portals[link.source].y, portals[link.target].x, portals[link.target].y)) {
                    intersect = true;
                    break; // Beende die Schleife, da eine Kreuzung gefunden wurde
                }
            }

            if (!intersect) {
                // Keine Kreuzung gefunden, zeichne die Linie
                ctx.strokeStyle = hexToRGBA(linkColor, linkTransparency);
                ctx.beginPath();
                ctx.moveTo(portals[i].x, portals[i].y);
                ctx.lineTo(newPortal.x, newPortal.y);
                ctx.stroke();
                const newLink = {
                    source: i,
                    target: newPortal.index
                }
                links.push(newLink);
                // debugger;
                // Nachdem der Link erstellt wurde, prüfe auf mögliche Felder
                checkForNewFields(newLink);
            }
        }
    }

    function createLinks() {
        deleteAllLinks(); // Zurücksetzen vorhandener Links


        // Logik zum Verbinden der Portale hier einfügen...
        for (let portal of portals) {
            // Verbinde das neue Portal mit früheren Portalen, ohne Regel §1 zu verletzen
            connectPortalsWithLine(portal);
        };
    }

    function deleteAllLinks() {
        links = []; // Lösche alle Links
        fields = [];
        redrawPortals(); // Neuzeichnen ohne Links
    }

    function deleteAllPortals() {
        links = [];
        portals = [];
        redrawPortals();
        updateList();
    }

    document.getElementById('sortPortals').addEventListener('click', () => sortPortalsRadially(sortClockwise));
    // document.getElementById('reverseSort').addEventListener('click', () => sortPortalsRadially());
    document.getElementById('connectPortals').addEventListener('click', createLinks);
    document.getElementById('deleteLinks').addEventListener('click', deleteAllLinks);
    document.getElementById('deletePortals').addEventListener('click', deleteAllPortals);
    document.getElementById('rotateLeftBtn').addEventListener('click', rotatePortalsLeft);
    document.getElementById('rotateRightBtn').addEventListener('click', rotatePortalsRight);



    // Anpassung der Canvas-Größe
    function resizeCanvas() {
        canvas.width = container.offsetWidth * 0.6; // 60% der Containerbreite
        canvas.height = container.offsetHeight; // Kann auf 100% der Containerhöhe gesetzt werden oder angepasst werden
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
        // drawPortal(newPortal, false);
        updateList();
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
        redrawPortals();
        updateList();
    }

    function drawPortal(portal) {
        // function drawPortal(portal, doDrawLink) {
        // ctx.fillStyle = 0;
        ctx.strokeStyle = hexToRGBA(portalColor, portalTransparency);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(portal.x, portal.y, drawPortalSymbolRadius, 0, Math.PI * 2);
        // ctx.fill();
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
        // ctx.closePath();


        if (portal.index === 0) {
            const highlightRadius = drawPortalSymbolRadius + 4; // 4px größer als der Radius des Portals
            // ctx.strokeStyle = `rgba(255, 255, 255, 0.5)`; // Weiß halbtransparent
            ctx.strokeStyle = hexToRGBA(highlightColor, highlightTransparency);

            ctx.lineWidth = 2; // Die Linienbreite für den Kreis
            ctx.beginPath();
            ctx.arc(portal.x, portal.y, highlightRadius, 0, 2 * Math.PI, false);
            ctx.stroke();
            ctx.closePath();
        };

        // if (doDrawLink) {
        // connectPortalsWithLine(portal);
        // }
    }

    function redrawPortals() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let portal of portals) {
            drawPortal(portal);

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
    // Fields


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
            drawField(newLink.source, newLink.target, bestThirdPointIndex, isLeftSide);
            fields.push([newLink.source, newLink.target, bestThirdPointIndex]); // Speichere das Feld
        }
    }

    function drawField(sourceIndex, targetIndex, thirdPointIndex) {
        // ctx.fillStyle = `rgba(0, 255, 0, ${fieldTransparency})`;
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

    // Event-Listener für Farbauswahl
    document.getElementById('portalColorPicker').addEventListener('change', function () {
        portalColor = this.value;
        // Aktualisiere die Zeichnung oder Teile davon, falls notwendig
        updateIndexesAndUI(true);
    });

    document.getElementById('linkColorPicker').addEventListener('change', function () {
        linkColor = this.value;
        // Aktualisiere die Zeichnung oder Teile davon, falls notwendig#
        updateIndexesAndUI(true);
    });

    document.getElementById('fieldColorPicker').addEventListener('change', function () {
        fieldColor = this.value;
        // Aktualisiere die Zeichnung oder Teile davon, falls notwendig
        updateIndexesAndUI(true);
    });

    document.getElementById('highlightColorPicker').addEventListener('change', function () {
        highlightColor = this.value;
        // Aktualisiere die Zeichnung oder Teile davon, falls notwendig
        updateIndexesAndUI(true);
    });

    // Verwende die Farbvariablen beim Zeichnen
    // Beispiel: ctx.fillStyle = portalColor; beim Zeichnen eines Portals

    document.getElementById('fieldTransparencySlider').addEventListener('input', function () {
        // Aktualisiere die Feld-Transparenz basierend auf dem Slider-Wert
        fieldTransparency = parseFloat(this.value);
        document.getElementById('transparencyValue').textContent = fieldTransparency;

        // Aktualisiere hier die Zeichnung der Felder mit der neuen Transparenz
        // Zum Beispiel könntest du eine Funktion aufrufen, die die Felder neu zeichnet
        // redrawFields();
        updateIndexesAndUI(true);
    });
    // document.getElementById('sortPortals').addEventListener('click', () => sortPortalsRadially(sortClockwise));
    document.getElementById('presetENL').addEventListener('click', () => colorPreset('ENL'));
    document.getElementById('presetRES').addEventListener('click', () => colorPreset('RES'));
    document.getElementById('presetMAC').addEventListener('click', () => colorPreset('MAC'));
    document.getElementById('presetNTR').addEventListener('click', () => colorPreset('NTR'));

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

});
