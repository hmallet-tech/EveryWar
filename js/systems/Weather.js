// js/systems/Weather.js – Dynamic weather system (rain, fog)
import { startRain, stopRain } from '../engine/Audio.js';

export const WEATHER_TYPE = { NONE: 'none', RAIN: 'rain', FOG: 'fog' };

export class WeatherSystem {
    constructor(canvas) {
        this.canvas = canvas;
        this.type = WEATHER_TYPE.NONE;
        this.intensity = 0;     // 0-1
        this.targetIntensity = 0;
        this.timer = 0;
        this.duration = 0;
        this.particles = [];    // rain drops
        this._fogOpacity = 0;

        // Rain overlay canvas
        this._rainCanvas = document.createElement('canvas');
        this._rainCtx = this._rainCanvas.getContext('2d');
        this._resizeRain();
    }

    _resizeRain() {
        this._rainCanvas.width = this.canvas.width || window.innerWidth;
        this._rainCanvas.height = this.canvas.height || window.innerHeight;
    }

    /** Start a weather event */
    setWeather(type, intensity = 0.7, duration = 45) {
        if (this.type === type) return;
        this.type = type;
        this.targetIntensity = intensity;
        this.duration = duration;
        this.timer = 0;
        this._resizeRain();

        if (type === WEATHER_TYPE.RAIN) {
            startRain();
            this._initRain();
        } else if (type === WEATHER_TYPE.FOG) {
            stopRain();
        } else {
            stopRain();
        }
    }

    clearWeather() {
        stopRain();
        this.targetIntensity = 0;
        this.type = WEATHER_TYPE.NONE;
        this.timer = 0;
    }

    _initRain() {
        const w = this._rainCanvas.width, h = this._rainCanvas.height;
        const count = Math.floor(this.targetIntensity * 400);
        this.particles = [];
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                len: 8 + Math.random() * 14,
                speed: 300 + Math.random() * 200,
                opacity: 0.3 + Math.random() * 0.4,
            });
        }
    }

    update(dt) {
        if (this.type === WEATHER_TYPE.NONE && this.intensity === 0) return;

        // Lerp intensity
        this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 0.8);
        if (this.intensity < 0.001) this.intensity = 0;

        // Duration countdown
        if (this.duration > 0) {
            this.timer += dt;
            if (this.timer >= this.duration) {
                this.clearWeather();
            }
        }

        // Rain particles update
        if (this.type === WEATHER_TYPE.RAIN) {
            const w = this._rainCanvas.width, h = this._rainCanvas.height;
            for (const p of this.particles) {
                p.y += p.speed * dt;
                p.x += p.speed * 0.2 * dt; // slight wind
                if (p.y > h) { p.y = -p.len; p.x = Math.random() * w; }
                if (p.x > w) { p.x = 0; }
            }
        }
    }

    /**
     * Returns speed multiplier for units (rain slows by up to 30%)
     * and vision multiplier for fog (fog reduces sight by up to 40%)
     */
    getEffects() {
        if (this.type === WEATHER_TYPE.RAIN) {
            return { speedMult: 1 - this.intensity * 0.30, sightMult: 1 };
        } else if (this.type === WEATHER_TYPE.FOG) {
            return { speedMult: 1, sightMult: 1 - this.intensity * 0.40 };
        }
        return { speedMult: 1, sightMult: 1 };
    }

    /** Render weather overlay over game canvas */
    render(ctx) {
        if (this.intensity < 0.005) return;

        if (this.type === WEATHER_TYPE.RAIN) {
            this._renderRain(ctx);
        } else if (this.type === WEATHER_TYPE.FOG) {
            this._renderFog(ctx);
        }
    }

    _renderRain(ctx) {
        const rctx = this._rainCtx;
        const w = this._rainCanvas.width, h = this._rainCanvas.height;
        rctx.clearRect(0, 0, w, h);
        rctx.strokeStyle = `rgba(140,160,200,${this.intensity * 0.55})`;
        rctx.lineWidth = 1;
        for (const p of this.particles) {
            rctx.globalAlpha = p.opacity * this.intensity;
            rctx.beginPath();
            rctx.moveTo(p.x, p.y);
            rctx.lineTo(p.x + p.len * 0.2, p.y + p.len);
            rctx.stroke();
        }
        rctx.globalAlpha = 1;
        ctx.drawImage(this._rainCanvas, 0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    _renderFog(ctx) {
        const opacity = this.intensity * 0.45;
        ctx.fillStyle = `rgba(200,210,220,${opacity})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
}
