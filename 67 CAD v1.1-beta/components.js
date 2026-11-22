/* ============================================================
 *  67 CAD — components.js
 *  Фабрика компонентов, рендереры и полифилл
 * ============================================================ */

/* Полифилл roundRect для старых браузеров */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
        const { tl = 0, tr = 0, br = 0, bl = 0 } = r || {};
        this.beginPath();
        this.moveTo(x + tl, y);
        this.lineTo(x + w - tr, y); this.quadraticCurveTo(x + w, y, x + w, y + tr);
        this.lineTo(x + w, y + h - br); this.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
        this.lineTo(x + bl, y + h); this.quadraticCurveTo(x, y + h, x, y + h - bl);
        this.lineTo(x, y + tl); this.quadraticCurveTo(x, y, x + tl, y);
        this.closePath();
    };
}

/* --- Фабрика компонентов --- */
const COMPONENTS_FACTORY = {
    arduino: (x, y) => {
        let pins = [];
        ["", "5V", "RESET", "3.3V", "5V", "GND", "GND", "VIN", "", "A0", "A1", "A2", "A3", "A4", "A5"].forEach((n, i) => { if (n) pins.push({ name: n, x: 0, y: 35 + i * 24, side: 'left' }); });
        ["", "", "AREF", "GND", "D13", "D12", "D11", "D10", "D9", "D8", "D7", "D6", "D5", "D4", "D3", "D2", "D1", "D0"].forEach((n, i) => { if (n) pins.push({ name: n, x: 200, y: 35 + i * 24, side: 'right' }); });
        return { id: nextId++, type: 'arduino', x, y, w: 200, h: 520, pins, color: '#1e5a8a', border: '#2d7bb5', label: 'Arduino Uno R3' };
    },
    display: (x, y) => {
        let pins = [];
        ["D1", "A", "F", "D2", "D3", "B"].forEach((n, i) => pins.push({ name: n, x: 30 + i * 30, y: 0, side: 'top' }));
        ["E", "D", "DP", "C", "G", "D4"].forEach((n, i) => pins.push({ name: n, x: 30 + i * 30, y: 120, side: 'bottom' }));
        return { id: nextId++, type: 'display', x, y, w: 220, h: 120, pins, color: '#1a1a1a', border: '#555', label: '3461BS' };
    },
    resistor: (x, y) => ({ id: nextId++, type: 'resistor', x, y, w: 60, h: 30, pins: [{ name: '1', x: -20, y: 15, side: 'left' }, { name: '2', x: 80, y: 15, side: 'right' }], color: '#e6c229', border: '#fff', value: '220' }),
    capacitor_ceramic: (x, y) => ({ id: nextId++, type: 'cap_ceramic', x, y, w: 40, h: 30, pins: [{ name: '1', x: -15, y: 15, side: 'left' }, { name: '2', x: 55, y: 15, side: 'right' }], color: '#b86b25', border: '#fff', value: '100nF' }),
    capacitor_electrolytic: (x, y) => ({ id: nextId++, type: 'cap_electrolytic', x, y, w: 40, h: 50, pins: [{ name: '+', x: -15, y: 10, side: 'left' }, { name: '-', x: 55, y: 40, side: 'right' }], color: '#3a5ba0', border: '#fff', value: '10uF' }),
    transistor_pnp: (x, y) => ({ id: nextId++, type: 'transistor_pnp', x, y, w: 50, h: 40, pins: [{ name: 'E', x: 0, y: 40, side: 'bottom' }, { name: 'B', x: 25, y: 40, side: 'bottom' }, { name: 'C', x: 50, y: 40, side: 'bottom' }], color: '#2a2a2a', border: '#ff4d4d', label: 'PNP' }),
    transistor_npn: (x, y) => ({ id: nextId++, type: 'transistor_npn', x, y, w: 50, h: 40, pins: [{ name: 'E', x: 0, y: 40, side: 'bottom' }, { name: 'B', x: 25, y: 40, side: 'bottom' }, { name: 'C', x: 50, y: 40, side: 'bottom' }], color: '#2a2a2a', border: '#4d79ff', label: 'NPN' }),
    button: (x, y) => ({ id: nextId++, type: 'button', x, y, w: 50, h: 40, pins: [{ name: '1', x: 25, y: 0, side: 'top' }, { name: '2', x: 25, y: 40, side: 'bottom' }], color: '#555', border: '#aaa', label: 'BTN' }),
    button_4pin: (x, y) => ({
        id: nextId++, type: 'button_4pin', x, y, w: 60, h: 40,
        pins: [{ name: '1', x: 10, y: 0, side: 'top' }, { name: '2', x: 50, y: 0, side: 'top' }, { name: '3', x: 10, y: 40, side: 'bottom' }, { name: '4', x: 50, y: 40, side: 'bottom' }],
        color: '#444', border: '#888', label: 'BTN4'
    }),
    led_red: (x, y) => ({ id: nextId++, type: 'led', x, y, w: 30, h: 30, pins: [{ name: 'A', x: 15, y: 0, side: 'top' }, { name: 'K', x: 15, y: 30, side: 'bottom' }], color: '#222', border: '#f44336', ledColor: '#f44336' }),
    led_yellow: (x, y) => ({ id: nextId++, type: 'led', x, y, w: 30, h: 30, pins: [{ name: 'A', x: 15, y: 0, side: 'top' }, { name: 'K', x: 15, y: 30, side: 'bottom' }], color: '#222', border: '#FFEB3B', ledColor: '#FFEB3B' }),
    led_green: (x, y) => ({ id: nextId++, type: 'led', x, y, w: 30, h: 30, pins: [{ name: 'A', x: 15, y: 0, side: 'top' }, { name: 'K', x: 15, y: 30, side: 'bottom' }], color: '#222', border: '#4CAF50', ledColor: '#4CAF50' }),
    speaker: (x, y) => ({ id: nextId++, type: 'speaker', x, y, w: 50, h: 30, pins: [{ name: '+', x: 15, y: 0, side: 'top' }, { name: '-', x: 35, y: 0, side: 'top' }], color: '#555', border: '#aaa', label: 'SPEAKER' }),
    jumper: (x, y) => ({ id: nextId++, type: 'jumper', x, y, w: 40, h: 10, pins: [{ name: '1', x: 0, y: 5, side: 'left' }, { name: '2', x: 40, y: 5, side: 'right' }], color: '#888', border: '#ccc' }),
    note: (x, y) => ({ id: nextId++, type: 'note', x, y, w: 150, h: 80, pins: [], color: '#ffeb3b', border: '#fbc02d', text: 'Текст...', fontSize: 14 }),
    
    tp4056: (x, y) => ({
        id: nextId++, type: 'tp4056', x, y, w: 110, h: 50,
        pins: [
            { name: 'OUT+', x: 110, y: 7.5, side: 'right' },
            { name: 'B+', x: 110, y: 20, side: 'right' },
            { name: 'B-', x: 110, y: 32.5, side: 'right' },
            { name: 'OUT-', x: 110, y: 45, side: 'right' }
        ],
        color: '#1a237e', border: '#3949ab', label: 'TP4056'
    }),
    arc_generator: (x, y) => ({
        id: nextId++, type: 'arc_generator', x, y, w: 60, h: 50,
        pins: [
            { name: 'E1', x: 15, y: 0, side: 'top' },
            { name: 'E2', x: 45, y: 0, side: 'top' },
            { name: '+', x: 15, y: 50, side: 'bottom' },
            { name: '-', x: 45, y: 50, side: 'bottom' }
        ],
        color: '#111', border: '#ff5252', label: 'ARC'
    }),
    battery_box: (x, y) => ({
        id: nextId++, type: 'battery_box', x, y, w: 70, h: 40,
        pins: [
            { name: '+', x: 0, y: 20, side: 'left' },
            { name: '-', x: 70, y: 20, side: 'right' }
        ],
        color: '#333', border: '#888', value: ''
    }),
    toggle_switch: (x, y) => ({
        id: nextId++, type: 'toggle_switch', x, y, w: 50, h: 30,
        pins: [
            { name: '1', x: 10, y: 30, side: 'bottom' },
            { name: '2', x: 40, y: 30, side: 'bottom' }
        ],
        color: '#555', border: '#ccc', value1: '1', value2: '0'
    }),
    plug: (x, y) => ({
        id: nextId++, type: 'plug', x, y, w: 40, h: 40,
        pins: [
            { name: '', x: 10, y: 40, side: 'bottom' },
            { name: '', x: 20, y: 40, side: 'bottom' },
            { name: '', x: 30, y: 40, side: 'bottom' }
        ],
        color: '#ffffff', border: '#000000', label: ''
    }),

    junction: (x, y) => ({
        id: nextId++, type: 'junction', x, y, w: 24, h: 24,
        pins: [
            { name: '', x: 12, y: 0, side: 'top' },
            { name: '', x: 12, y: 24, side: 'bottom' },
            { name: '', x: 0, y: 12, side: 'left' },
            { name: '', x: 24, y: 12, side: 'right' }
        ],
        color: '#ffd700', border: '#fff'
    }),
    powerBus: (x, y, type) => {
        let pins = [], isVcc = type === 'vcc';
        for (let i = 0; i < 4; i++) {
            pins.push({ name: isVcc ? 'VCC' : 'GND', x: 0, y: 10 + i * 15, side: 'left' });
            pins.push({ name: isVcc ? 'VCC' : 'GND', x: 60, y: 10 + i * 15, side: 'right' });
        }
        return { id: nextId++, type: 'powerBus', x, y, w: 60, h: 70, pins, color: isVcc ? '#4a1a1a' : '#1a3a1a', border: isVcc ? '#ff4d4d' : '#4CAF50', isVcc: isVcc, voltage: isVcc ? '+5V' : 'GND' };
    }
};

/* Отрисовка сегментов индикатора */
function drawDisplaySegments(comp, ctx) {
    const padding = 15, digitWidth = 30, gap = 12, digitHeight = 65;
    const startX = comp.x + padding, startY = comp.y + 38;
    const onColor = '#ff3333', chamfer = 5, hThick = 6, vThick = 6;
    for (let i = 0; i < 4; i++) {
        let dx = startX + i * (digitWidth + gap);
        ctx.fillStyle = onColor;
        ctx.beginPath(); ctx.moveTo(dx + chamfer, startY); ctx.lineTo(dx + digitWidth - chamfer, startY); ctx.lineTo(dx + digitWidth - chamfer - 1, startY + hThick); ctx.lineTo(dx + chamfer + 1, startY + hThick); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx, startY + chamfer); ctx.lineTo(dx + vThick, startY + chamfer + 1); ctx.lineTo(dx + vThick, startY + (digitHeight / 2) - chamfer - 1); ctx.lineTo(dx, startY + (digitHeight / 2) - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + digitWidth, startY + chamfer); ctx.lineTo(dx + digitWidth - vThick, startY + chamfer + 1); ctx.lineTo(dx + digitWidth - vThick, startY + (digitHeight / 2) - chamfer - 1); ctx.lineTo(dx + digitWidth, startY + (digitHeight / 2) - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + vThick, startY + (digitHeight / 2) - hThick / 2); ctx.lineTo(dx + digitWidth - vThick, startY + (digitHeight / 2) - hThick / 2); ctx.lineTo(dx + digitWidth - chamfer, startY + (digitHeight / 2) + hThick / 2); ctx.lineTo(dx + chamfer, startY + (digitHeight / 2) + hThick / 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx, startY + (digitHeight / 2) + chamfer); ctx.lineTo(dx + vThick, startY + (digitHeight / 2) + chamfer + 1); ctx.lineTo(dx + vThick, startY + digitHeight - chamfer - 1); ctx.lineTo(dx, startY + digitHeight - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + digitWidth, startY + (digitHeight / 2) + chamfer); ctx.lineTo(dx + digitWidth - vThick, startY + (digitHeight / 2) + chamfer + 1); ctx.lineTo(dx + digitWidth - vThick, startY + digitHeight - chamfer - 1); ctx.lineTo(dx + digitWidth, startY + digitHeight - chamfer); ctx.fill();
        ctx.beginPath(); ctx.moveTo(dx + chamfer, startY + digitHeight); ctx.lineTo(dx + digitWidth - chamfer, startY + digitHeight); ctx.lineTo(dx + digitWidth - chamfer - 1, startY + digitHeight - hThick); ctx.lineTo(dx + chamfer + 1, startY + digitHeight - hThick); ctx.fill();
        ctx.beginPath(); ctx.arc(dx + digitWidth + 4, startY + digitHeight - 2, 4, 0, Math.PI * 2); ctx.fill();
    }
}

/* Перенос текста для записок */
function wrapText(ctx, text, maxWidth) {
    const out = [];
    for (const para of String(text).split('\n')) {
        if (para === '') { out.push(''); continue; }
        let line = '';
        for (const word of para.split(' ')) {
            const test = line ? line + ' ' + word : word;
            if (ctx.measureText(test).width > maxWidth && line) {
                out.push(line);
                line = word;
            } else {
                line = test;
            }
        }
        out.push(line);
    }
    return out;
}

/* --- Полиморфные рендереры --- */
const COMPONENT_RENDERERS = {
    _default(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 6);
        ctx.fill(); ctx.stroke();
    },

    arduino(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.label, comp.x + comp.w / 2, comp.y + 25);
    },

    display(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 6);
        ctx.fill(); ctx.stroke();
        drawDisplaySegments(comp, ctx);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.label, comp.x + comp.w / 2, comp.y + 20);
    },

    resistor(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 6);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(comp.value, comp.x + comp.w / 2, comp.y + 21);
    },

    cap_ceramic(comp, ctx) {
        ctx.beginPath();
        ctx.fillStyle = '#d6a25b';
        ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(comp.value, comp.x + comp.w / 2, comp.y + comp.h / 2 + 4);
    },

    cap_electrolytic(comp, ctx) {
        ctx.beginPath();
        ctx.fillStyle = '#2c3e50';
        ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
        ctx.fillStyle = '#fff';
        ctx.fillRect(comp.x + comp.w - 10, comp.y, 10, comp.h);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(comp.value, comp.x + comp.w / 2 - 5, comp.y + comp.h / 2 + 4);
        ctx.fillStyle = '#ff4d4d';
        ctx.fillText('+', comp.x + 5, comp.y + 10);
    },

    transistor_pnp(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff8a80';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.label, comp.x + comp.w / 2, comp.y + comp.h / 2 + 5);
    },

    transistor_npn(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#8ab4f8';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.label, comp.x + comp.w / 2, comp.y + comp.h / 2 + 5);
    },

    button(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.label || 'BTN', comp.x + comp.w / 2, comp.y + comp.h / 2 + 3);
    },

    button_4pin(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.moveTo(comp.x + 15, comp.y + 10); ctx.lineTo(comp.x + comp.w - 15, comp.y + comp.h - 10);
        ctx.moveTo(comp.x + comp.w - 15, comp.y + 10); ctx.lineTo(comp.x + 15, comp.y + comp.h - 10);
        ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(comp.label || 'BTN', comp.x + comp.w / 2, comp.y + comp.h / 2 + 3);
    },

    speaker(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SPEAKER', comp.x + comp.w / 2, comp.y + comp.h / 2 + 4);
    },

    jumper(comp, ctx) {
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = comp.color;
        ctx.moveTo(comp.x, comp.y + 5);
        ctx.lineTo(comp.x + comp.w, comp.y + 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.fillStyle = '#e6c229';
        ctx.arc(comp.x, comp.y + 5, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath();
        ctx.arc(comp.x + comp.w, comp.y + 5, 6, 0, Math.PI * 2); ctx.fill();
    },

    led(comp, ctx) {
        const cx = comp.x + comp.w / 2;
        const cy = comp.y + comp.h / 2;
        const r = comp.w / 2;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.fillStyle = comp.ledColor;
        ctx.shadowColor = comp.ledColor;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.shadowColor = comp.ledColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = comp.border;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    },

    tp4056(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('TP4056', comp.x + 30, comp.y + comp.h / 2);
        
        ctx.fillStyle = '#ffca28';
        const pinYs = [7.5, 20, 32.5, 45];
        const pinNames = ['OUT+', 'B+', 'B-', 'OUT-'];
        
        pinYs.forEach((y, index) => {
            ctx.fillRect(comp.x + comp.w - 15, comp.y + y - 2, 10, 4);
            
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(pinNames[index], comp.x + comp.w - 20, comp.y + y);
            ctx.fillStyle = '#ffca28';
        });
    },

    arc_generator(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(comp.x + comp.w / 2 + 5, comp.y + 12);
        ctx.lineTo(comp.x + comp.w / 2 - 5, comp.y + 25);
        ctx.lineTo(comp.x + comp.w / 2 + 5, comp.y + 25);
        ctx.lineTo(comp.x + comp.w / 2 - 5, comp.y + 38);
        ctx.stroke();
    },

    battery_box(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = '#222';
        ctx.fillRect(comp.x + 5, comp.y + 8, comp.w - 10, comp.h - 16);
        ctx.strokeStyle = '#aaa';
        ctx.lineWidth = 1;
        ctx.strokeRect(comp.x + 5, comp.y + 8, comp.w - 10, comp.h - 16);
        
        if (comp.value) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(comp.value, comp.x + comp.w / 2, comp.y + comp.h / 2);
        }
    },

    toggle_switch(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = '#222';
        ctx.fillRect(comp.x + 5, comp.y + 5, comp.w - 10, comp.h - 10);
        
        ctx.fillStyle = '#ccc';
        ctx.fillRect(comp.x + comp.w / 2 - 4, comp.y + 8, 8, comp.h - 16);
        
        ctx.fillStyle = '#222';
        ctx.fillRect(comp.x + 7, comp.y + 8, 12, comp.h - 16);
        ctx.fillRect(comp.x + comp.w - 19, comp.y + 8, 12, comp.h - 16);
        
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.strokeRect(comp.x + 7, comp.y + 8, 12, comp.h - 16);
        ctx.strokeRect(comp.x + comp.w - 19, comp.y + 8, 12, comp.h - 16);
        
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (comp.value1) ctx.fillText(comp.value1, comp.x + 13, comp.y + comp.h / 2);
        if (comp.value2) ctx.fillText(comp.value2, comp.x + comp.w - 13, comp.y + comp.h / 2);
    },

    plug(comp, ctx) {
        const isLight = document.body.classList.contains('light-theme');
        const borderColor = isLight ? '#000000' : '#ffffff';

        ctx.beginPath();
        ctx.roundRect(comp.x + 5, comp.y + 10, comp.w - 10, comp.h - 15, 2);
        ctx.fillStyle = comp.color;
        ctx.fill();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 3;
        ctx.lineCap = 'butt';
        ctx.moveTo(comp.x + 13, comp.y + 10);
        ctx.lineTo(comp.x + 13, comp.y - 10);
        ctx.moveTo(comp.x + comp.w - 13, comp.y + 10);
        ctx.lineTo(comp.x + comp.w - 13, comp.y - 10);
        ctx.stroke();
    },

    junction(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
    },

    powerBus(comp, ctx) {
        ctx.beginPath();
        ctx.roundRect(comp.x, comp.y, comp.w, comp.h, 4);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = comp.isVcc ? '#ff8a80' : '#8bc34a';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(comp.voltage, comp.x + comp.w / 2, comp.y + comp.h / 2 + 4);
    },

    note(comp, ctx, isLight, editingNote, cursorBlink) {
        ctx.beginPath();
        ctx.fillStyle = comp.color;
        ctx.fillRect(comp.x, comp.y, comp.w, comp.h);
        ctx.strokeStyle = comp.border;
        ctx.strokeRect(comp.x, comp.y, comp.w, comp.h);

        ctx.fillStyle = '#000';
        ctx.font = `${comp.fontSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        ctx.save();
        ctx.beginPath();
        ctx.rect(comp.x, comp.y, comp.w, comp.h);
        ctx.clip();

        const lines = wrapText(ctx, comp.text, comp.w - 20);
        lines.forEach((line, i) => {
            ctx.fillText(line, comp.x + 10, comp.y + 10 + comp.fontSize + i * (comp.fontSize + 4));
        });

        if (editingNote === comp && cursorBlink) {
            const lastLine = lines[lines.length - 1] || '';
            const lastY = comp.y + 10 + comp.fontSize + (lines.length - 1) * (comp.fontSize + 4);
            const textWidth = ctx.measureText(lastLine).width;
            ctx.fillStyle = '#000';
            ctx.fillRect(comp.x + 10 + textWidth + 2, lastY - comp.fontSize + 2, 2, comp.fontSize);
        }
        ctx.restore();

        ctx.fillStyle = '#fbc02d';
        ctx.beginPath();
        ctx.moveTo(comp.x + comp.w, comp.y + comp.h);
        ctx.lineTo(comp.x + comp.w - 12, comp.y + comp.h);
        ctx.lineTo(comp.x + comp.w, comp.y + comp.h - 12);
        ctx.fill();
    }
};

/* --- Универсальный рендер одного компонента --- */
function renderComponent(comp, ctx, isLight, options) {
    const { editingNote, cursorBlink, selectedComponents } = options;

    ctx.shadowColor = isLight ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    let compColor = comp.color;
    if (isLight && comp.type === 'arduino') compColor = '#2d7bb5';

    if (editingNote === comp || selectedComponents.includes(comp.id)) {
        ctx.strokeStyle = '#00BCD4';
        ctx.lineWidth = 3;
    } else {
        ctx.strokeStyle = comp.border;
        ctx.lineWidth = 1.5;
    }

    ctx.fillStyle = compColor;

    const renderer = COMPONENT_RENDERERS[comp.type] || COMPONENT_RENDERERS._default;
    renderer(comp, ctx, isLight, editingNote, cursorBlink);

    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    comp.pins.forEach((pin, pi) => {
        const px = comp.x + pin.x, py = comp.y + pin.y;
        
        if (comp.type !== 'jumper') {
            ctx.beginPath();
            ctx.arc(px, py, 4.5, 0, Math.PI * 2);
            
            if (options.selectedPin && options.selectedPin.id === comp.id && options.selectedPin.pi === pi) {
                ctx.fillStyle = '#ffeb3b';
            } else if (comp.type === 'powerBus') {
                ctx.fillStyle = comp.isVcc ? '#ff4d4d' : '#4CAF50';
            } else if (comp.type === 'junction') {
                ctx.fillStyle = '#ffd700';
            } else {
                ctx.fillStyle = '#e6c229';
            }
            
            ctx.fill();
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (pin.name && comp.type !== 'powerBus' && comp.type !== 'plug' && comp.type !== 'tp4056') {
            ctx.fillStyle = isLight ? '#333' : '#ddd';
            ctx.font = 'bold 11px monospace';
            let tx = px, ty = py - 8;

            if (comp.type === 'arduino') {
                if (pin.side === 'left') { tx = px + 15; ty = py + 3; }
                if (pin.side === 'right') { tx = px - 15; ty = py + 3; }
                ctx.textAlign = pin.side === 'left' ? 'left' : 'right';
            } else {
                if (pin.side === 'right') { tx = px + 12; ty = py + 3; ctx.textAlign = 'left'; }
                if (pin.side === 'left') { tx = px - 12; ty = py + 3; ctx.textAlign = 'right'; }
                if (pin.side === 'top') { tx = px; ty = py - 8; ctx.textAlign = 'center'; }
                if (pin.side === 'bottom') { tx = px; ty = py + 14; ctx.textAlign = 'center'; }
            }
            ctx.fillText(pin.name, tx, ty);
        }
    });
}