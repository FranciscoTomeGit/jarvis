class JarvisOrb {
    constructor(canvasElement) {
        this._canvas    = canvasElement;
        this._ctx       = canvasElement.getContext('2d');
        this._time      = 0;
        this._intensity        = 0.08;
        this._targetIntensity  = 0.08;
        this._rotationX = 0;
        this._rotationY = 0;
        this._arcs      = [];
        this._nodes     = [];
        this._pulses    = [];
        this._paused    = false;

        this._resize();
        new ResizeObserver(() => this._resize()).observe(canvasElement.parentElement);

        // Pause rendering when the window is hidden (fixes CPU/GPU drain in tray)
        document.addEventListener('visibilitychange', () => {
            this._paused = document.hidden;
        });

        requestAnimationFrame(() => this._tick());
    }

    setState(state) {
        const intensityByState = {
            idle:      0.08,
            thinking:  0.35,
            listening: 0.60,
            speaking:  1.00,
            error:     0.12,
        };
        this._targetIntensity = intensityByState[state] ?? 0.08;
        if (state === 'speaking' || state === 'listening') this._spawnPulses(2);
    }

    // ── Loop ──────────────────────────────────────────────────────────────────

    _tick() {
        requestAnimationFrame(() => this._tick());
        if (this._paused) return;

        this._time      += 0.016;
        this._intensity += (this._targetIntensity - this._intensity) * 0.04;

        const speed = 0.18 + this._intensity * 0.45;
        this._rotationY += 0.0028 * speed;
        this._rotationX += 0.0010 * speed;

        if (this._intensity > 0.35 && Math.random() < 0.06 * this._intensity) {
            this._spawnPulses(1);
        }

        this._draw();
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    _resize() {
        const parent = this._canvas.parentElement;
        const dpr    = window.devicePixelRatio || 1;
        const width  = parent.clientWidth;
        const height = parent.clientHeight;

        this._canvas.width  = width  * dpr;
        this._canvas.height = height * dpr;
        this._canvas.style.width  = `${width}px`;
        this._canvas.style.height = `${height}px`;
        this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        this._width  = width;
        this._height = height;
        this._cx     = width  / 2;
        this._cy     = height / 2;
        this._radius = Math.min(width, height) * 0.30;

        this._generateScene();
    }

    _generateScene() {
        // Great circle arcs across the sphere surface
        this._arcs = Array.from({ length: 52 }, () => {
            const poleTheta = Math.random() * Math.PI * 2;
            const polePhi   = Math.acos(2 * Math.random() - 1);
            const poleX = Math.sin(polePhi) * Math.cos(poleTheta);
            const poleY = Math.sin(polePhi) * Math.sin(poleTheta);
            const poleZ = Math.cos(polePhi);
            return {
                poleX, poleY, poleZ,
                startAngle:  Math.random() * Math.PI * 2,
                arcLength:   Math.PI * (0.2 + Math.random() * 1.7),
                baseOpacity: 0.12 + Math.random() * 0.40,
                lineWidth:   0.3  + Math.random() * 0.9,
            };
        });

        // Nodes: random points on the sphere surface
        this._nodes = Array.from({ length: 80 }, () => {
            const theta = Math.random() * Math.PI * 2;
            const phi   = Math.acos(2 * Math.random() - 1);
            return {
                x: Math.sin(phi) * Math.cos(theta),
                y: Math.sin(phi) * Math.sin(theta),
                z: Math.cos(phi),
                size:        0.8  + Math.random() * 2.8,
                pulsePhase:  Math.random() * Math.PI * 2,
                pulseSpeed:  0.4  + Math.random() * 2.0,
                brightness:  0.25 + Math.random() * 0.75,
            };
        });
    }

    _spawnPulses(count) {
        for (let i = 0; i < count; i++) {
            this._pulses.push({
                arcIndex: Math.floor(Math.random() * this._arcs.length),
                progress: 0,
                speed:    0.008 + Math.random() * 0.016,
                opacity:  0.85 + Math.random() * 0.15,
            });
        }
    }

    // ── Render ────────────────────────────────────────────────────────────────

    _draw() {
        const { _ctx: ctx, _cx: cx, _cy: cy, _radius: radius, _time: time, _intensity: intensity } = this;

        ctx.clearRect(0, 0, this._width, this._height);

        this._drawAmbientGlow(ctx, cx, cy, radius, intensity);
        this._drawCoreSphere(ctx, cx, cy, radius, time, intensity);
        this._drawArcs(ctx, intensity);
        this._drawPulses(ctx);
        this._drawNodes(ctx, time, intensity);
    }

    _drawAmbientGlow(ctx, cx, cy, radius, intensity) {
        const outerRadius = radius * (2.2 + intensity * 1.5);
        const gradient    = ctx.createRadialGradient(cx, cy, radius * 0.3, cx, cy, outerRadius);
        gradient.addColorStop(0,   `rgba(0, 120, 220, ${(0.10 + intensity * 0.15).toFixed(3)})`);
        gradient.addColorStop(0.4, `rgba(0,  60, 160, ${(0.04 + intensity * 0.07).toFixed(3)})`);
        gradient.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawCoreSphere(ctx, cx, cy, radius, time, intensity) {
        const breathe  = Math.sin(time * (1.2 + intensity * 4)) * (0.015 + intensity * 0.04);
        const coreSize = radius * (1 + breathe);

        // Inner glow
        const innerGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize);
        innerGlow.addColorStop(0,   `rgba(80, 190, 255, ${(0.18 + intensity * 0.30).toFixed(3)})`);
        innerGlow.addColorStop(0.5, `rgba(0,  100, 200, ${(0.06 + intensity * 0.10).toFixed(3)})`);
        innerGlow.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = innerGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
        ctx.fill();

        // Sphere outline
        ctx.beginPath();
        ctx.arc(cx, cy, coreSize, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 160, 255, ${(0.12 + intensity * 0.20).toFixed(3)})`;
        ctx.lineWidth   = 0.8;
        ctx.stroke();
    }

    _drawArcs(ctx, intensity) {
        for (const arc of this._arcs) {
            this._drawArc(ctx, arc, intensity);
        }
    }

    _drawArc(ctx, arc, intensity) {
        const { ux, uy, uz, vx, vy, vz } = this._getBasisVectors(arc.poleX, arc.poleY, arc.poleZ);
        const segments = 55;

        // Sample a few points to estimate average depth for opacity
        let totalDepth = 0;
        const sampleStep = Math.floor(segments / 6);
        for (let sample = 0; sample <= segments; sample += sampleStep) {
            const t = arc.startAngle + (sample / segments) * arc.arcLength;
            const rotated = this._rotate(
                Math.cos(t) * ux + Math.sin(t) * vx,
                Math.cos(t) * uy + Math.sin(t) * vy,
                Math.cos(t) * uz + Math.sin(t) * vz,
            );
            totalDepth += rotated.z;
        }
        const avgDepth   = totalDepth / (Math.ceil(segments / sampleStep) + 1);
        const depthAlpha = 0.25 + 0.75 * ((avgDepth + 1) / 2);
        const alpha      = arc.baseOpacity * depthAlpha * (0.35 + intensity * 0.65);

        ctx.beginPath();
        for (let index = 0; index <= segments; index++) {
            const t       = arc.startAngle + (index / segments) * arc.arcLength;
            const rotated = this._rotate(
                Math.cos(t) * ux + Math.sin(t) * vx,
                Math.cos(t) * uy + Math.sin(t) * vy,
                Math.cos(t) * uz + Math.sin(t) * vz,
            );
            const screenX = this._cx + rotated.x * this._radius;
            const screenY = this._cy + rotated.y * this._radius;
            index === 0 ? ctx.moveTo(screenX, screenY) : ctx.lineTo(screenX, screenY);
        }
        ctx.strokeStyle = `rgba(0, 175, 255, ${alpha.toFixed(3)})`;
        ctx.lineWidth   = arc.lineWidth;
        ctx.stroke();
    }

    _drawNodes(ctx, time, intensity) {
        for (const node of this._nodes) {
            const rotated  = this._rotate(node.x, node.y, node.z);
            const depth    = (rotated.z + 1) / 2;
            const pulse    = 0.55 + 0.45 * Math.sin(time * node.pulseSpeed + node.pulsePhase);
            const alpha    = node.brightness * pulse * depth * (0.3 + intensity * 0.7);
            const nodeSize = node.size * (0.4 + depth * 0.6);
            const screenX  = this._cx + rotated.x * this._radius;
            const screenY  = this._cy + rotated.y * this._radius;

            // Dot
            ctx.beginPath();
            ctx.arc(screenX, screenY, nodeSize, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(120, 220, 255, ${alpha.toFixed(3)})`;
            ctx.fill();

            // Halo for bright front-facing nodes
            if (alpha > 0.35 && depth > 0.55) {
                const halo = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, nodeSize * 4);
                halo.addColorStop(0,   `rgba(160, 230, 255, ${(alpha * 0.35).toFixed(3)})`);
                halo.addColorStop(1,   'rgba(0,0,0,0)');
                ctx.fillStyle = halo;
                ctx.beginPath();
                ctx.arc(screenX, screenY, nodeSize * 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    _drawPulses(ctx) {
        this._pulses = this._pulses.filter(pulse => pulse.progress < 1 && pulse.opacity > 0.05);

        for (const pulse of this._pulses) {
            const arc               = this._arcs[pulse.arcIndex];
            const { ux, uy, uz, vx, vy, vz } = this._getBasisVectors(arc.poleX, arc.poleY, arc.poleZ);
            const pulseHalfWidth    = 0.12;
            const centerAngle       = arc.startAngle + pulse.progress * arc.arcLength;
            const segments          = 12;

            ctx.beginPath();
            for (let index = 0; index <= segments; index++) {
                const t       = (centerAngle - pulseHalfWidth) + (index / segments) * pulseHalfWidth * 2;
                const rotated = this._rotate(
                    Math.cos(t) * ux + Math.sin(t) * vx,
                    Math.cos(t) * uy + Math.sin(t) * vy,
                    Math.cos(t) * uz + Math.sin(t) * vz,
                );
                const screenX = this._cx + rotated.x * this._radius;
                const screenY = this._cy + rotated.y * this._radius;
                index === 0 ? ctx.moveTo(screenX, screenY) : ctx.lineTo(screenX, screenY);
            }
            ctx.strokeStyle = `rgba(180, 240, 255, ${pulse.opacity.toFixed(3)})`;
            ctx.lineWidth   = 2.5;
            ctx.stroke();

            pulse.progress += pulse.speed;
            pulse.opacity  *= 0.985;
        }
    }

    // ── Maths ─────────────────────────────────────────────────────────────────

    _rotate(x, y, z) {
        // Rotate around Y axis
        const cosY = Math.cos(this._rotationY);
        const sinY = Math.sin(this._rotationY);
        const rx   = x * cosY + z * sinY;
        const ry   = y;
        const rz   = -x * sinY + z * cosY;

        // Rotate around X axis
        const cosX = Math.cos(this._rotationX);
        const sinX = Math.sin(this._rotationX);
        return {
            x: rx,
            y: ry * cosX - rz * sinX,
            z: ry * sinX + rz * cosX,
        };
    }

    _getBasisVectors(poleX, poleY, poleZ) {
        // u = perpendicular to pole; v = cross(pole, u)
        let ux, uy, uz;
        if (Math.abs(poleZ) < 0.9) {
            const len = Math.sqrt(poleX * poleX + poleY * poleY);
            ux = -poleY / len;
            uy =  poleX / len;
            uz =  0;
        } else {
            const len = Math.sqrt(poleY * poleY + poleZ * poleZ);
            ux = 0;
            uy = -poleZ / len;
            uz =  poleY / len;
        }
        return {
            ux, uy, uz,
            vx: poleY * uz - poleZ * uy,
            vy: poleZ * ux - poleX * uz,
            vz: poleX * uy - poleY * ux,
        };
    }
}
