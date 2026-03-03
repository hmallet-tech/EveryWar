// js/engine/Input.js – Unified keyboard + mouse input manager
export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = {};
        this.keysDown = {};  // fired once per press
        this.keysUp = {};
        this.mousePos = { x: 0, y: 0 };
        this.mouseWorld = { x: 0, y: 0 };
        this.mouseInCanvas = false;
        this.buttons = [false, false, false]; // LMB, MMB, RMB
        this.buttonsDown = [false, false, false];
        this.buttonsUp = [false, false, false];
        this.dragStart = null;  // {x,y} LMB drag start (canvas coords)
        this.isDragging = false;
        this.dragThreshold = 6;

        this._bind();
    }

    _bind() {
        window.addEventListener('keydown', e => {
            if (this.keys[e.code]) return; // auto-repeat → skip keysDown
            this.keys[e.code] = true;
            this.keysDown[e.code] = true;
        });
        window.addEventListener('keyup', e => {
            this.keys[e.code] = false;
            this.keysUp[e.code] = true;
        });

        this.canvas.addEventListener('mousemove', e => {
            const r = this.canvas.getBoundingClientRect();
            this.mousePos = { x: e.clientX - r.left, y: e.clientY - r.top };
            if (this.dragStart && !this.isDragging) {
                const dx = this.mousePos.x - this.dragStart.x;
                const dy = this.mousePos.y - this.dragStart.y;
                if (Math.sqrt(dx * dx + dy * dy) > this.dragThreshold) this.isDragging = true;
            }
        });
        this.canvas.addEventListener('mouseenter', () => this.mouseInCanvas = true);
        this.canvas.addEventListener('mouseleave', () => { this.mouseInCanvas = false; });

        this.canvas.addEventListener('mousedown', e => {
            e.preventDefault();
            this.buttons[e.button] = true;
            this.buttonsDown[e.button] = true;
            if (e.button === 0) {
                this.dragStart = { ...this.mousePos };
                this.isDragging = false;
            }
        });

        this.canvas.addEventListener('mouseup', e => {
            e.preventDefault();
            this.buttons[e.button] = false;
            this.buttonsUp[e.button] = true;
            if (e.button === 0) {
                if (!this.isDragging) this.dragStart = null;
                // isDragging will be cleared by game after it reads it
            }
        });

        this.canvas.addEventListener('contextmenu', e => e.preventDefault());

        // Double click tracking
        this._lastClick = 0;
        this._dblClick = false;
        this.canvas.addEventListener('dblclick', () => { this._dblClick = true; });
    }

    /** Call at end of each frame to clear one-shot events */
    flush() {
        this.keysDown = {};
        this.keysUp = {};
        this.buttonsDown = [false, false, false];
        this.buttonsUp = [false, false, false];
        this._dblClick = false;
    }

    isKey(code) { return !!this.keys[code]; }
    isKeyDown(code) { return !!this.keysDown[code]; }
    isKeyUp(code) { return !!this.keysUp[code]; }

    isLMB() { return this.buttons[0]; }
    isRMB() { return this.buttons[2]; }
    isLMBDown() { return this.buttonsDown[0]; }
    isRMBDown() { return this.buttonsDown[2]; }
    isLMBUp() { return this.buttonsUp[0]; }
    isDblClick() { return this._dblClick; }

    clearDrag() {
        this.isDragging = false;
        this.dragStart = null;
    }

    getDragRect() {
        if (!this.isDragging || !this.dragStart) return null;
        const x = Math.min(this.dragStart.x, this.mousePos.x);
        const y = Math.min(this.dragStart.y, this.mousePos.y);
        const w = Math.abs(this.mousePos.x - this.dragStart.x);
        const h = Math.abs(this.mousePos.y - this.dragStart.y);
        return { x, y, w, h };
    }
}
