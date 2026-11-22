/* ============================================================
 *  67 CAD — script.js
 *  Логика редактора: состояние, камера, ввод, режимы, история
 * ============================================================ */

/* --- DOM --- */
const canvas = document.getElementById('editorCanvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('canvasContainer');
const resInput = document.getElementById('resistorInput');
const sidebarEl = document.getElementById('sidebar');

/* --- Глобальное состояние --- */
let width, height;

const State = {
    camera: { x: 0, y: 0, zoom: 1 },
    interaction: {
        mode: 'move',
        selectedPin: null,
        currentWirePoints: [],
        selectedComponents: [],
        isDraggingSelection: false,
        dragStartX: 0, dragStartY: 0,
        compStartPositions: [],
        isPanning: false, panStartX: 0, panStartY: 0,
        draggedBend: null,
        pendingHistory: false,
        marquee: null
    },
    ui: {
        currentWireColor: '#4a7c59',
        editingNote: null,
        editingComp: null,
        noteEditSnapshot: null,
        cursorBlink: true,
        cursorTimer: null,
        clipboard: null,
        historyStack: [],
        snapToGrid: false
    }
};

let components = [];
let wires = [];
let nextId = 1;

/* --- Константы --- */
const GRID = 20;
const MAX_COORD = 100000;
const WIRE_COLORS = ['#4a7c59', '#b33a3a', '#3a5ba0', '#c9a227', '#b86b25', '#d1d1d1', '#333333', '#777777'];

/* --- Утилиты --- */
const getCompById = (id) => components.find(c => c.id === id);
const screenToWorld = (x, y) => ({ x: (x - State.camera.x) / State.camera.zoom, y: (y - State.camera.y) / State.camera.zoom });
const snap = (v) => State.ui.snapToGrid ? Math.round(v / GRID) * GRID : v;

function getMousePos(e) {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function getPinPos(id, pi) {
    const comp = getCompById(id);
    if (!comp || !Array.isArray(comp.pins)) return null;

    const pin = comp.pins[pi];
    if (!pin || typeof pin.x !== 'number' || typeof pin.y !== 'number' ||
        !Number.isFinite(pin.x) || !Number.isFinite(pin.y) ||
        Math.abs(pin.x) > MAX_COORD || Math.abs(pin.y) > MAX_COORD) {
        return null;
    }

    const x = comp.x + pin.x;
    const y = comp.y + pin.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x, y };
}

/* --- История --- */
function saveHistory() {
    State.ui.historyStack.push(JSON.stringify({ components, wires, nextId }));
    if (State.ui.historyStack.length > 50) State.ui.historyStack.shift();
}
function undo() {
    if (State.ui.historyStack.length === 0) return;
    const prev = JSON.parse(State.ui.historyStack.pop());
    components = prev.components;
    wires = prev.wires;
    nextId = prev.nextId;
    State.interaction.selectedComponents = [];
    scheduleDraw();
}

/* --- rAF-батчинг отрисовки --- */
let drawScheduled = false;
function scheduleDraw() {
    if (drawScheduled) return;
    drawScheduled = true;
    requestAnimationFrame(() => {
        drawScheduled = false;
        draw();
    });
}

/* --- Курсор записки --- */
function startCursorBlink() {
    stopCursorBlink();
    State.ui.cursorBlink = true;
    State.ui.cursorTimer = setInterval(() => {
        State.ui.cursorBlink = !State.ui.cursorBlink;
        scheduleDraw();
    }, 500);
}
function stopCursorBlink() {
    if (State.ui.cursorTimer) {
        clearInterval(State.ui.cursorTimer);
        State.ui.cursorTimer = null;
    }
    State.ui.cursorBlink = true;
}

/* --- Размер canvas --- */
function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    draw();
}
window.addEventListener('resize', resizeCanvas);
new ResizeObserver(() => resizeCanvas()).observe(container);

/* --- Отрисовка провода --- */
function drawWirePath(points, color, isDashed = false) {
    if (!Array.isArray(points)) return;

    const safe = points.filter(p =>
        p && typeof p.x === 'number' && typeof p.y === 'number' &&
        Number.isFinite(p.x) && Number.isFinite(p.y) &&
        Math.abs(p.x) <= MAX_COORD && Math.abs(p.y) <= MAX_COORD
    );
    if (safe.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = color;
    ctx.shadowBlur = 4;
    if (isDashed) ctx.setLineDash([5, 5]); else ctx.setLineDash([]);
    ctx.moveTo(safe[0].x, safe[0].y);
    for (let i = 1; i < safe.length; i++) ctx.lineTo(safe[i].x, safe[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    safe.forEach((p, i) => {
        if (i > 0 && i < safe.length - 1) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    });
}

/* --- Главная отрисовка --- */
function draw() {
    ctx.clearRect(0, 0, width, height);
    const isLight = document.body.classList.contains('light-theme');

    ctx.save();
    ctx.translate(State.camera.x, State.camera.y);
    ctx.scale(State.camera.zoom, State.camera.zoom);

    // Сетка
    ctx.strokeStyle = isLight ? '#e0e0e0' : '#222';
    ctx.lineWidth = 1 / State.camera.zoom;
    const sx = Math.floor(-State.camera.x / State.camera.zoom / GRID) * GRID;
    const sy = Math.floor(-State.camera.y / State.camera.zoom / GRID) * GRID;
    const ex = sx + width / State.camera.zoom + GRID * 2;
    const ey = sy + height / State.camera.zoom + GRID * 2;
    for (let i = sx; i < ex; i += GRID) { ctx.beginPath(); ctx.moveTo(i, sy); ctx.lineTo(i, ey); ctx.stroke(); }
    for (let i = sy; i < ey; i += GRID) { ctx.beginPath(); ctx.moveTo(sx, i); ctx.lineTo(ex, i); ctx.stroke(); }

    // Провода
    wires.forEach(w => {
        if (!w || !Array.isArray(w.bends)) return;
        const p1 = getPinPos(w.c1, w.p1);
        const p2 = getPinPos(w.c2, w.p2);
        if (p1 && p2) {
            const fullPath = [p1, ...w.bends, p2];
            drawWirePath(fullPath, w.color || '#777');
        }
    });

    // Компоненты
    const renderOptions = {
        editingNote: State.ui.editingNote,
        cursorBlink: State.ui.cursorBlink,
        selectedComponents: State.interaction.selectedComponents,
        selectedPin: State.interaction.selectedPin
    };
    components.forEach(comp => {
        if (!comp || !Array.isArray(comp.pins)) return;
        try {
            renderComponent(comp, ctx, isLight, renderOptions);
        } catch (err) {
            console.warn('Ошибка рендера компонента', comp && comp.id, err);
        }
    });

    // Предпросмотр провода
    if (State.interaction.selectedPin) {
        const start = getPinPos(State.interaction.selectedPin.id, State.interaction.selectedPin.pi);
        if (start) {
            const end = screenToWorld(mouseScreen.x, mouseScreen.y);
            drawWirePath([start, ...State.interaction.currentWirePoints, end], '#ffeb3b', true);

            const hoverPin = findPinAt(end.x, end.y);
            if (hoverPin && (hoverPin.comp.id !== State.interaction.selectedPin.id || hoverPin.pi !== State.interaction.selectedPin.pi)) {
                const p = hoverPin.comp.pins[hoverPin.pi];
                ctx.beginPath();
                ctx.arc(hoverPin.comp.x + p.x, hoverPin.comp.y + p.y, 9, 0, Math.PI * 2);
                ctx.strokeStyle = '#00e676';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
        }
    }

    // Marquee
    if (State.interaction.marquee) {
        const m = State.interaction.marquee;
        const x1 = Math.min(m.x0, m.x1), y1 = Math.min(m.y0, m.y1);
        const w = Math.abs(m.x1 - m.x0), h = Math.abs(m.y1 - m.y0);
        ctx.fillStyle = 'rgba(0,188,212,0.1)';
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeStyle = '#00BCD4';
        ctx.lineWidth = 1 / State.camera.zoom;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x1, y1, w, h);
        ctx.setLineDash([]);
    }

    ctx.restore();
}

/* --- Поиск пина под точкой --- */
function findPinAt(wx, wy) {
    for (const comp of components) {
        if (!comp || !Array.isArray(comp.pins)) continue;
        for (let pi = 0; pi < comp.pins.length; pi++) {
            const pin = comp.pins[pi];
            if (!pin || typeof pin.x !== 'number' || typeof pin.y !== 'number') continue;
            if (Math.hypot(comp.x + pin.x - wx, comp.y + pin.y - wy) < 12) {
                return { comp, pi };
            }
        }
    }
    return null;
}

/* --- Координаты мыши в экранных (для предпросмотра) --- */
let mouseScreen = { x: 0, y: 0 };

/* --- Редактор значений (floating input) --- */
function openEditor(comp) {
    State.ui.editingComp = comp;
    const sx = comp.x * State.camera.zoom + State.camera.x;
    const sy = comp.y * State.camera.zoom + State.camera.y;

    resInput.style.display = 'block';
    resInput.style.left = (sx + (comp.w * State.camera.zoom) / 2 - 35) + 'px';
    resInput.style.top = (sy - 40) + 'px';

    if (comp.type === 'battery_box') resInput.value = comp.value || '';
    else if (comp.type === 'toggle_switch') resInput.value = (comp.value1 || '1') + ',' + (comp.value2 || '0');
    else if (comp.value !== undefined) resInput.value = comp.value;
    else if (comp.voltage !== undefined) resInput.value = comp.voltage;
    else if (comp.label !== undefined) resInput.value = comp.label;

    resInput.focus();
    resInput.select();
}
function closeEditor() {
    const comp = State.ui.editingComp;
    if (comp) {
        if (comp.type === 'resistor' || comp.type === 'cap_ceramic' || comp.type === 'cap_electrolytic') comp.value = resInput.value || '220';
        if (comp.type === 'battery_box') comp.value = resInput.value;
        if (comp.type === 'toggle_switch') {
            const parts = resInput.value.split(',');
            comp.value1 = parts[0] || '';
            comp.value2 = parts[1] || '';
        }
        if (comp.type === 'powerBus') comp.voltage = resInput.value || (comp.isVcc ? '+5V' : 'GND');
        if (comp.type === 'button' || comp.type === 'button_4pin') comp.label = resInput.value || 'BTN';
        State.ui.editingComp = null;
    }
    resInput.style.display = 'none';
    scheduleDraw();
}
resInput.addEventListener('blur', closeEditor);
resInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') closeEditor();
    if (e.key === 'Escape') {
        resInput.style.display = 'none';
        State.ui.editingComp = null;
        scheduleDraw();
    }
});

/* --- Горячие клавиши --- */
document.addEventListener('keydown', (e) => {
    if (resInput.style.display === 'block') return;

    if (State.ui.editingNote) {
        if (e.key === 'Escape') {
            State.ui.editingNote.text = State.ui.noteEditSnapshot;
            State.ui.editingNote = null;
            State.ui.noteEditSnapshot = null;
            stopCursorBlink();
            scheduleDraw();
            return;
        }
        if (e.key === 'Backspace') {
            State.ui.editingNote.text = State.ui.editingNote.text.slice(0, -1);
            scheduleDraw();
            e.preventDefault();
            return;
        }
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                State.ui.editingNote.text += '\n';
                scheduleDraw();
                e.preventDefault();
                return;
            } else {
                State.ui.editingNote = null;
                State.ui.noteEditSnapshot = null;
                stopCursorBlink();
                scheduleDraw();
                return;
            }
        }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            State.ui.editingNote.text += e.key;
            scheduleDraw();
            e.preventDefault();
        }
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
        e.preventDefault();
        undo();
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC' && State.interaction.selectedComponents.length > 0) {
        e.preventDefault();
        const ids = new Set(State.interaction.selectedComponents);
        const compsToCopy = components.filter(c => ids.has(c.id));
        const wiresToCopy = wires.filter(w => ids.has(w.c1) && ids.has(w.c2));
        State.ui.clipboard = {
            comps: JSON.parse(JSON.stringify(compsToCopy)),
            wires: JSON.parse(JSON.stringify(wiresToCopy))
        };
    }

    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyV' && State.ui.clipboard) {
        e.preventDefault();
        saveHistory();
        const newIdMap = {};
        const offset = 20;

        State.ui.clipboard.comps.forEach(c => {
            const oldId = c.id;
            const newComp = JSON.parse(JSON.stringify(c));
            newComp.id = nextId++;
            newComp.x += offset;
            newComp.y += offset;
            components.push(newComp);
            newIdMap[oldId] = newComp.id;
        });

        State.ui.clipboard.wires.forEach(w => {
            wires.push({
                c1: newIdMap[w.c1], p1: w.p1,
                c2: newIdMap[w.c2], p2: w.p2,
                bends: (w.bends || []).map(b => ({ x: b.x + offset, y: b.y + offset })),
                color: w.color
            });
        });

        State.interaction.selectedComponents = Object.values(newIdMap);
        scheduleDraw();
    }

    if (e.key === 'Escape') {
        State.interaction.selectedPin = null;
        State.interaction.currentWirePoints = [];
        scheduleDraw();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && State.interaction.selectedComponents.length > 0) {
        saveHistory();
        const ids = new Set(State.interaction.selectedComponents);
        components = components.filter(c => !ids.has(c.id));
        wires = wires.filter(w => !ids.has(w.c1) && !ids.has(w.c2));
        State.interaction.selectedComponents = [];
        scheduleDraw();
    }
});

/* --- Зум --- */
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const ms = getMousePos(e);
    const mw = screenToWorld(ms.x, ms.y);
    State.camera.zoom = Math.max(0.1, Math.min(State.camera.zoom * (1 + delta), 5));
    const nmw = screenToWorld(ms.x, ms.y);
    State.camera.x += (nmw.x - mw.x) * State.camera.zoom;
    State.camera.y += (nmw.y - mw.y) * State.camera.zoom;
    scheduleDraw();
}, { passive: false });

/* --- Mousedown --- */
canvas.addEventListener('mousedown', (e) => {
    const sp = getMousePos(e);
    const wp = screenToWorld(sp.x, sp.y);
    mouseScreen = sp;

    if (resInput.style.display === 'block') { closeEditor(); return; }
    if (State.ui.editingNote) {
        State.ui.editingNote = null;
        State.ui.noteEditSnapshot = null;
        stopCursorBlink();
        scheduleDraw();
        return;
    }

    if (e.button === 1 || e.button === 2) {
        State.interaction.isPanning = true;
        State.interaction.panStartX = sp.x - State.camera.x;
        State.interaction.panStartY = sp.y - State.camera.y;
        return;
    }
    if (e.button !== 0) return;

    /* РЕЖИМ УДАЛЕНИЯ */
    if (State.interaction.mode === 'delete') {
        for (let wi = wires.length - 1; wi >= 0; wi--) {
            const w = wires[wi];
            const p1 = getPinPos(w.c1, w.p1);
            const p2 = getPinPos(w.c2, w.p2);
            if (!p1 || !p2) continue;

            const fullPath = [p1, ...(w.bends || []), p2];
            for (let j = 0; j < fullPath.length - 1; j++) {
                const a = fullPath[j], b = fullPath[j + 1];
                const A = wp.x - a.x, B = wp.y - a.y, C = b.x - a.x, D = b.y - a.y;
                const param = (A * C + B * D) / (C * C + D * D || 1);
                const xx = param < 0 ? a.x : (param > 1 ? b.x : a.x + param * C);
                const yy = param < 0 ? a.y : (param > 1 ? b.y : a.y + param * D);
                if (Math.hypot(wp.x - xx, wp.y - yy) < 10) {
                    saveHistory();
                    wires.splice(wi, 1);
                    scheduleDraw();
                    return;
                }
            }
        }
        for (let ci = components.length - 1; ci >= 0; ci--) {
            const comp = components[ci];
            if (wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
                saveHistory();
                components.splice(ci, 1);
                wires = wires.filter(w => w.c1 !== comp.id && w.c2 !== comp.id);
                State.interaction.selectedComponents = [];
                scheduleDraw();
                return;
            }
        }
        return;
    }

    /* РЕЖИМ ТРАССИРОВКИ */
    if (State.interaction.mode === 'draw') {
        if (e.detail === 2) {
            for (let ci = components.length - 1; ci >= 0; ci--) {
                const comp = components[ci];
                if (comp.type === 'note' && wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
                    saveHistory();
                    State.ui.editingNote = comp;
                    State.ui.noteEditSnapshot = comp.text;
                    startCursorBlink();
                    scheduleDraw();
                    return;
                }
            }
        }

        for (let wi = 0; wi < wires.length; wi++) {
            const w = wires[wi];
            if (!Array.isArray(w.bends)) continue;
            for (let bi = 0; bi < w.bends.length; bi++) {
                const b = w.bends[bi];
                if (!b || typeof b.x !== 'number' || typeof b.y !== 'number') continue;
                if (Math.hypot(b.x - wp.x, b.y - wp.y) < 10 / State.camera.zoom) {
                    State.interaction.draggedBend = { wi, bi };
                    State.interaction.pendingHistory = true;
                    return;
                }
            }
        }

        const hoverPin = findPinAt(wp.x, wp.y);
        if (hoverPin) {
            const { comp, pi } = hoverPin;
            if (State.interaction.selectedPin) {
                if (State.interaction.selectedPin.id !== comp.id || State.interaction.selectedPin.pi !== pi) {
                    saveHistory();
                    wires.push({
                        c1: State.interaction.selectedPin.id,
                        p1: State.interaction.selectedPin.pi,
                        c2: comp.id,
                        p2: pi,
                        bends: [...State.interaction.currentWirePoints],
                        color: State.ui.currentWireColor
                    });
                }
                State.interaction.selectedPin = null;
                State.interaction.currentWirePoints = [];
            } else {
                State.interaction.selectedPin = { id: comp.id, pi };
                State.interaction.currentWirePoints = [];
            }
            scheduleDraw();
            return;
        }

        if (State.interaction.selectedPin) {
            State.interaction.currentWirePoints.push(wp);
            scheduleDraw();
            return;
        }
    }

    /* РЕЖИМ РЕДАКТОРА */
    let clickedComp = null;
    for (let ci = components.length - 1; ci >= 0; ci--) {
        const comp = components[ci];
        if (wp.x > comp.x && wp.x < comp.x + comp.w && wp.y > comp.y && wp.y < comp.y + comp.h) {
            clickedComp = comp;
            break;
        }
    }

    if (clickedComp) {
        if (clickedComp.type === 'note' &&
            wp.x > clickedComp.x + clickedComp.w - 15 && wp.x < clickedComp.x + clickedComp.w + 5 &&
            wp.y > clickedComp.y + clickedComp.h - 15 && wp.y < clickedComp.y + clickedComp.h + 5) {
            State.interaction.isDraggingSelection = 'resize-note';
            State.interaction.draggedBend = clickedComp;
            State.interaction.dragStartX = wp.x;
            State.interaction.dragStartY = wp.y;
            State.interaction.pendingHistory = true;
            return;
        }

        if (e.shiftKey) {
            const idx = State.interaction.selectedComponents.indexOf(clickedComp.id);
            if (idx > -1) State.interaction.selectedComponents.splice(idx, 1);
            else State.interaction.selectedComponents.push(clickedComp.id);
            scheduleDraw();
            return;
        }

        if (!State.interaction.selectedComponents.includes(clickedComp.id)) {
            State.interaction.selectedComponents = [clickedComp.id];
        }
        State.interaction.isDraggingSelection = true;
        State.interaction.dragStartX = wp.x;
        State.interaction.dragStartY = wp.y;
        State.interaction.pendingHistory = true;
        State.interaction.compStartPositions = State.interaction.selectedComponents.map(id => {
            const c = getCompById(id);
            return { id: c.id, x: c.x, y: c.y };
        });
        scheduleDraw();
        return;
    }

    if (!e.shiftKey) {
        State.interaction.selectedComponents = [];
        State.interaction.marquee = { x0: wp.x, y0: wp.y, x1: wp.x, y1: wp.y };
        scheduleDraw();
    }
});

/* --- Mousemove --- */
canvas.addEventListener('mousemove', (e) => {
    const sp = getMousePos(e);
    const wp = screenToWorld(sp.x, sp.y);
    mouseScreen = sp;

    if (State.interaction.isPanning) {
        State.camera.x = sp.x - State.interaction.panStartX;
        State.camera.y = sp.y - State.interaction.panStartY;
        scheduleDraw();
        return;
    }

    if (State.interaction.isDraggingSelection === 'resize-note') {
        const comp = State.interaction.draggedBend;
        if (State.interaction.pendingHistory) {
            if (Math.hypot(wp.x - State.interaction.dragStartX, wp.y - State.interaction.dragStartY) > 2) {
                saveHistory();
                State.interaction.pendingHistory = false;
            }
        }
        comp.w = Math.max(100, snap(wp.x - comp.x));
        comp.h = Math.max(50, snap(wp.y - comp.y));
        scheduleDraw();
        return;
    }

    if (State.interaction.draggedBend) {
        if (State.interaction.pendingHistory) {
            saveHistory();
            State.interaction.pendingHistory = false;
        }
        const db = State.interaction.draggedBend;
        const w = wires[db.wi];
        if (w && Array.isArray(w.bends) && w.bends[db.bi]) {
            w.bends[db.bi].x = wp.x;
            w.bends[db.bi].y = wp.y;
        }
        scheduleDraw();
        return;
    }

    if (State.interaction.isDraggingSelection === true) {
        const dx = wp.x - State.interaction.dragStartX;
        const dy = wp.y - State.interaction.dragStartY;
        if (State.interaction.pendingHistory && Math.hypot(dx, dy) > 2) {
            saveHistory();
            State.interaction.pendingHistory = false;
        }
        State.interaction.compStartPositions.forEach(start => {
            const comp = getCompById(start.id);
            if (comp) {
                comp.x = snap(start.x + dx);
                comp.y = snap(start.y + dy);
            }
        });
        scheduleDraw();
    } else if (State.interaction.marquee) {
        State.interaction.marquee.x1 = wp.x;
        State.interaction.marquee.y1 = wp.y;
        scheduleDraw();
    } else if (State.interaction.selectedPin) {
        scheduleDraw();
    }
});

/* --- Mouseup --- */
canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1 || e.button === 2) {
        State.interaction.isPanning = false;
        return;
    }
    if (e.button !== 0) return;

    if (State.interaction.isDraggingSelection === 'resize-note') {
        State.interaction.isDraggingSelection = false;
        State.interaction.draggedBend = null;
        State.interaction.pendingHistory = false;
        scheduleDraw();
        return;
    }
    if (State.interaction.draggedBend) {
        State.interaction.draggedBend = null;
        State.interaction.pendingHistory = false;
        scheduleDraw();
        return;
    }

    if (State.interaction.marquee) {
        const m = State.interaction.marquee;
        const dist = Math.hypot(m.x1 - m.x0, m.y1 - m.y0);
        if (dist > 5) {
            const x1 = Math.min(m.x0, m.x1), y1 = Math.min(m.y0, m.y1);
            const x2 = Math.max(m.x0, m.x1), y2 = Math.max(m.y0, m.y1);
            State.interaction.selectedComponents = components
                .filter(c => c.x < x2 && c.x + c.w > x1 && c.y < y2 && c.y + c.h > y1)
                .map(c => c.id);
        }
        State.interaction.marquee = null;
        scheduleDraw();
        return;
    }

    if (State.interaction.isDraggingSelection === true && State.interaction.compStartPositions.length === 1) {
        const comp = getCompById(State.interaction.compStartPositions[0].id);
        const sp = getMousePos(e);
        const wp = screenToWorld(sp.x, sp.y);
        const dist = Math.hypot(wp.x - State.interaction.dragStartX, wp.y - State.interaction.dragStartY);
        
        if (dist < 5 && comp && (
            comp.type === 'resistor' || comp.type === 'cap_ceramic' ||
            comp.type === 'cap_electrolytic' || comp.type === 'powerBus' ||
            comp.type === 'button' || comp.type === 'button_4pin' ||
            comp.type === 'battery_box' || comp.type === 'toggle_switch'
        )) {
            openEditor(comp);
        }
    }
    State.interaction.isDraggingSelection = false;
    State.interaction.compStartPositions = [];
    State.interaction.pendingHistory = false;
    scheduleDraw();
});

/* --- Sidebar: toggle --- */
document.getElementById('toggleSidebar').onclick = () => {
    document.body.classList.toggle('sidebar-collapsed');
    document.getElementById('toggleSidebar').textContent = document.body.classList.contains('sidebar-collapsed') ? '▶' : '◀';
    setTimeout(resizeCanvas, 310);
};

/* --- Sidebar: режимы --- */
const btnMove = document.getElementById('modeMove');
const btnDraw = document.getElementById('modeDraw');
const btnDelete = document.getElementById('modeDelete');

function updateModeButtons() {
    btnMove.classList.remove('active');
    btnDraw.classList.remove('active');
    btnDelete.classList.remove('active');
    if (State.interaction.mode === 'move') btnMove.classList.add('active');
    else if (State.interaction.mode === 'draw') btnDraw.classList.add('active');
    else if (State.interaction.mode === 'delete') btnDelete.classList.add('active');
}
btnMove.onclick = () => { State.interaction.mode = 'move'; updateModeButtons(); };
btnDraw.onclick = () => { State.interaction.mode = 'draw'; updateModeButtons(); };
btnDelete.onclick = () => { State.interaction.mode = 'delete'; updateModeButtons(); };

/* --- Snap --- */
document.getElementById('btnSnap').onclick = (e) => {
    State.ui.snapToGrid = !State.ui.snapToGrid;
    e.target.textContent = 'Привязка к сетке: ' + (State.ui.snapToGrid ? 'ВКЛ' : 'ВЫКЛ');
};

/* --- Фильтр компонентов --- */
document.getElementById('compFilter').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll('.btn-add').forEach(b => {
        b.style.display = b.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
});

/* --- Сворачивание секций --- */
document.querySelectorAll('.section-title').forEach(title => {
    title.onclick = () => {
        const content = title.nextElementSibling;
        const icon = title.querySelector('.toggle-icon');
        if (!content || !icon) return;
        content.classList.toggle('collapsed');
        icon.style.transform = content.classList.contains('collapsed') ? 'rotate(-90deg)' : 'rotate(0)';
    };
});

/* --- Палитра цветов --- */
const paletteContainer = document.getElementById('colorPalette');
paletteContainer.innerHTML = '';
paletteContainer.style.pointerEvents = 'auto';

WIRE_COLORS.forEach((hex, index) => {
    const dot = document.createElement('div');
    dot.className = 'color-dot' + (index === 0 ? ' active' : '');
    dot.style.backgroundColor = hex;

    dot.onmousedown = (e) => { e.stopPropagation(); e.preventDefault(); };
    dot.onclick = function (e) {
        e.stopPropagation();
        e.preventDefault();
        State.ui.currentWireColor = hex;
        const dots = paletteContainer.children;
        for (let i = 0; i < dots.length; i++) dots[i].classList.remove('active');
        dot.classList.add('active');
    };
    paletteContainer.appendChild(dot);
});

/* --- Блокировка кликов в сайдбаре --- */
sidebarEl.onmousedown = (e) => e.stopPropagation();
sidebarEl.onclick = (e) => e.stopPropagation();

/* --- Добавление компонентов --- */
document.querySelectorAll('.btn-add').forEach(btn => {
    btn.onclick = () => {
        const type = btn.getAttribute('data-type');
        const center = screenToWorld(width / 2, height / 2);
        saveHistory();
        const newComp = COMPONENTS_FACTORY[type](center.x, center.y);
        components.push(newComp);
        State.interaction.selectedComponents = [newComp.id];
        scheduleDraw();
    };
});

document.getElementById('btnAddVcc').onclick = () => {
    const center = screenToWorld(width / 2, height / 2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.powerBus(center.x, center.y, 'vcc');
    components.push(newComp);
    State.interaction.selectedComponents = [newComp.id];
    scheduleDraw();
};
document.getElementById('btnAddGnd').onclick = () => {
    const center = screenToWorld(width / 2, height / 2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.powerBus(center.x, center.y, 'gnd');
    components.push(newComp);
    State.interaction.selectedComponents = [newComp.id];
    scheduleDraw();
};
document.getElementById('btnAddJunction').onclick = () => {
    const center = screenToWorld(width / 2, height / 2);
    saveHistory();
    const newComp = COMPONENTS_FACTORY.junction(center.x, center.y);
    components.push(newComp);
    State.interaction.selectedComponents = [newComp.id];
    scheduleDraw();
};

/* ============================================================
 *  МИГРАЦИЯ СТАРЫХ ФАЙЛОВ
 * ============================================================ */

function migrateComponentType(c) {
    if (c.type === 'led_red' || c.type === 'led_yellow' || c.type === 'led_green') {
        if (!c.ledColor) c.ledColor = c.type === 'led_red' ? '#f44336' : (c.type === 'led_yellow' ? '#FFEB3B' : '#4CAF50');
        c.type = 'led';
    }
    if (c.type === 'capacitor_ceramic') c.type = 'cap_ceramic';
    if (c.type === 'capacitor_electrolytic') c.type = 'cap_electrolytic';
    if (c.type === 'led' && !c.ledColor) c.ledColor = '#f44336';
}

function validateSchema(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.components) || !Array.isArray(data.wires)) return false;

    const compIds = new Set();
    let maxFoundId = 0;

    for (const c of data.components) {
        if (typeof c.id !== 'number' || typeof c.type !== 'string') return false;
        if (typeof c.x !== 'number' || typeof c.y !== 'number') return false;
        if (typeof c.w !== 'number' || typeof c.h !== 'number') return false;
        if (!Array.isArray(c.pins)) return false;

        migrateComponentType(c);

        if (c.type === 'led') {
            c.pins = [
                { name: 'A', x: c.w / 2, y: 0, side: 'top' },
                { name: 'K', x: c.w / 2, y: c.h, side: 'bottom' }
            ];
        }

        compIds.add(c.id);
        if (c.id > maxFoundId) maxFoundId = c.id;
    }

    const pinCounts = {};
    for (const c of data.components) pinCounts[c.id] = c.pins.length;

    data.wires = data.wires.filter(w => {
        if (!w || typeof w !== 'object') return false;
        if (!compIds.has(w.c1) || !compIds.has(w.c2)) return false;
        if (typeof w.p1 !== 'number' || typeof w.p2 !== 'number') return false;
        if (!Number.isInteger(w.p1) || w.p1 < 0 || w.p1 >= (pinCounts[w.c1] || 0)) return false;
        if (!Number.isInteger(w.p2) || w.p2 < 0 || w.p2 >= (pinCounts[w.c2] || 0)) return false;

        if (!Array.isArray(w.bends)) {
            w.bends = [];
        } else {
            w.bends = w.bends.filter(b => {
                if (!b || typeof b.x !== 'number' || typeof b.y !== 'number' ||
                    !Number.isFinite(b.x) || !Number.isFinite(b.y) ||
                    Math.abs(b.x) > MAX_COORD || Math.abs(b.y) > MAX_COORD) return false;
                
                const c1 = data.components.find(c => c.id === w.c1);
                const c2 = data.components.find(c => c.id === w.c2);
                if (c1 && c1.type === 'led' && Math.hypot(b.x - (c1.x + c1.w/2), b.y - (c1.y + c1.h/2)) < 20) return false;
                if (c2 && c2.type === 'led' && Math.hypot(b.x - (c2.x + c2.w/2), b.y - (c2.y + c2.h/2)) < 20) return false;
                
                return true;
            });
        }
        return true;
    });

    if (typeof data.nextId !== 'number' || data.nextId <= maxFoundId) {
        data.nextId = maxFoundId + 1;
    }
    return true;
}

/* --- Экспорт / Импорт / PNG / тема / очистка --- */
document.getElementById('btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify({ components, wires, nextId }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '67cad.json';
    a.click();
    URL.revokeObjectURL(url);
};

document.getElementById('btnImport').onclick = () => document.getElementById('fileInput').click();
document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            if (!validateSchema(data)) {
                alert('Файл повреждён или несовместим.');
                return;
            }
            saveHistory();
            components = data.components.map(c => {
                if (c.type === 'arduino') { c.color = '#1e5a8a'; c.border = '#2d7bb5'; }
                if (c.type === 'powerBus' && !c.isVcc) { c.color = '#1a3a1a'; c.border = '#4CAF50'; }
                return c;
            });
            wires = data.wires;
            nextId = data.nextId;
            State.interaction.selectedComponents = [];
            scheduleDraw();
            alert('Схема загружена!');
        } catch (err) {
            console.error('Ошибка импорта:', err);
            alert('Ошибка чтения файла: ' + err.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
});

document.getElementById('btnSave').onclick = () => {
    const isLight = document.body.classList.contains('light-theme');
    const scale = 2;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    const tCtx = tempCanvas.getContext('2d');
    tCtx.scale(scale, scale);
    tCtx.fillStyle = isLight ? '#fafafa' : '#121212';
    tCtx.fillRect(0, 0, width, height);
    tCtx.drawImage(canvas, 0, 0, width, height);
    const link = document.createElement('a');
    link.download = '67cad.png';
    link.href = tempCanvas.toDataURL('image/png');
    link.click();
};

document.getElementById('btnTheme').onclick = () => {
    document.body.classList.toggle('light-theme');
    scheduleDraw();
};

document.getElementById('btnClear').onclick = () => {
    if (confirm('Очистить всю схему?')) {
        saveHistory();
        components = [];
        wires = [];
        State.interaction.selectedPin = null;
        State.interaction.currentWirePoints = [];
        State.interaction.selectedComponents = [];
        nextId = 1;
        scheduleDraw();
    }
};

/* --- Инициализация --- */
resizeCanvas();
State.interaction.mode = 'move';
updateModeButtons();
draw();