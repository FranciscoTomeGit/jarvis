class JarvisOrb {
    constructor(canvasElement) {
        this._canvas   = canvasElement;
        this._ctx      = canvasElement.getContext('2d');
        this._time     = 0;
        this._intensity       = 0.08;
        this._targetIntensity = 0.08;
        this._particles = [];
        this._ripples   = [];

        this._resize();
        new ResizeObserver(() => this._resize()).observe(canvasElement.parentElement);
        requestAnimationFrame(() => this._tick());
    }

    setState(state) {
        const intensityByState = {
            idle:      0.08,
            thinking:  0.30,
            listening: 0.55,
            speaking:  1.00,
            error:     0.12,
        };
        this._targetIntensity = intensityByState[state] ?? 0.08;
        if (state === 'speaking') this._addRipple();
    }

    // ── Private: loop ─────────────────────────────────────────────────────────

    _tick() {
        this._time      += 0.016;
        this._intensity += (this._targetIntensity - this._intensity) * 0.04;

        if (this._intensity > 0.6 && Math.random() < 0.035) this._addRipple();

        this._draw();
        requestAnimationFrame(() => this._tick());
    }

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

        this._width      = width;
        this._height     = height;
        this._cx         = width  / 2;
        this._cy         = height / 2;
        this._baseRadius = Math.min(width, height) * 0.21;

        this._initParticles();
    }

    _initParticles() {
        this._particles = Array.from({ length: 55 }, () => ({
            angle:        Math.random() * Math.PI * 2,
            orbitRadius:  this._baseRadius * (1.3 + Math.random() * 2.5),
            angularSpeed: (Math.random() - 0.5) * 0.007,
            size:         0.6 + Math.random() * 1.6,
            opacity:      0.15 + Math.random() * 0.55,
        }));
    }

    _addRipple() {
        this._ripples.push({
            radius:  this._baseRadius * 1.05,
            opacity: 0.55,
        });
    }

    // ── Private: draw ─────────────────────────────────────────────────────────

    _draw() {
        const { _ctx: ctx, _cx: cx, _cy: cy, _baseRadius: radius, _time: time, _intensity: intensity } = this;

        ctx.clearRect(0, 0, this._width, this._height);

        this._drawAmbientGlow(ctx, cx, cy, radius, intensity);
        this._drawRipples(ctx, cx, cy);
        this._drawOuterRings(ctx, cx, cy, radius, time, intensity);
        this._drawInnerRings(ctx, cx, cy, radius, time, intensity);
        this._drawCoreSphere(ctx, cx, cy, radius, time, intensity);
        this._drawParticles(ctx, cx, cy, time, intensity);
    }

    _drawAmbientGlow(ctx, cx, cy, radius, intensity) {
        const glowRadius = radius * (3.5 + intensity * 2.5);
        const gradient   = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius);
        gradient.addColorStop(0,   this._rgba(0.05 + intensity * 0.1));
        gradient.addColorStop(0.5, this._rgba(0.02 + intensity * 0.04));
        gradient.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawCoreSphere(ctx, cx, cy, radius, time, intensity) {
        const breathe = Math.sin(time * (1.5 + intensity * 5)) * (0.02 + intensity * 0.055);
        const coreRadius = radius * (1 + breathe);

        // Halo
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius * 2.2);
        halo.addColorStop(0,   this._rgba(0.12 + intensity * 0.25));
        halo.addColorStop(0.6, this._rgba(0.04 + intensity * 0.08));
        halo.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius * 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Core sphere with specular highlight
        const sphere = ctx.createRadialGradient(
            cx - coreRadius * 0.25, cy - coreRadius * 0.25, coreRadius * 0.05,
            cx, cy, coreRadius
        );
        sphere.addColorStop(0,   `rgba(220, 245, 255, ${0.85 + intensity * 0.15})`);
        sphere.addColorStop(0.3, this._rgba(0.9));
        sphere.addColorStop(0.7, this._rgba(0.6 + intensity * 0.2));
        sphere.addColorStop(1,   this._rgba(0.2 + intensity * 0.15));
        ctx.fillStyle = sphere;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
        ctx.fill();
    }

    _drawInnerRings(ctx, cx, cy, radius, time, intensity) {
        const deformAmp = radius * (0.03 + intensity * 0.2);

        this._drawRing(ctx, cx, cy,
            radius * 1.3, deformAmp,
            time * 1.6, time * 0.45, 0,
            1.2 + intensity * 0.6,
            this._rgba(0.55 + intensity * 0.35)
        );
        this._drawRing(ctx, cx, cy,
            radius * 1.5, deformAmp * 0.7,
            time * 0.9, time * -0.3, 55,
            0.8 + intensity * 0.4,
            this._rgba(0.4 + intensity * 0.25)
        );
    }

    _drawOuterRings(ctx, cx, cy, radius, time, intensity) {
        const deformAmp = radius * (0.04 + intensity * 0.28);

        this._drawRing(ctx, cx, cy,
            radius * 2.1, deformAmp,
            time * 0.7, time * 0.28, 25,
            0.8,
            this._rgba(0.2 + intensity * 0.3)
        );
        this._drawRing(ctx, cx, cy,
            radius * 2.8, deformAmp * 0.55,
            time * 0.45, time * -0.18, -40,
            0.6,
            this._rgba(0.12 + intensity * 0.2)
        );
    }

    _drawRing(ctx, cx, cy, radius, deformAmp, phase, rotation, tiltDegrees, lineWidth, color) {
        const tilt       = tiltDegrees * (Math.PI / 180);
        const resolution = 240;

        ctx.beginPath();
        for (let index = 0; index <= resolution; index++) {
            const theta = (index / resolution) * Math.PI * 2;

            const deform =
                Math.sin(theta * 3 + phase)        * deformAmp        +
                Math.sin(theta * 5 + phase * 1.35) * deformAmp * 0.4  +
                Math.sin(theta * 2 + phase * 0.65) * deformAmp * 0.28 +
                Math.sin(theta * 7 + phase * 0.9)  * deformAmp * 0.15;

            const r = radius + deform;
            const rotatedTheta = theta + rotation;
            const x = cx + Math.cos(rotatedTheta) * r;
            const y = cy + Math.sin(rotatedTheta) * r * Math.cos(tilt);

            index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth   = lineWidth;
        ctx.stroke();
    }

    _drawParticles(ctx, cx, cy, time, intensity) {
        const speedMultiplier = 1 + intensity * 3.5;

        for (const particle of this._particles) {
            particle.angle += particle.angularSpeed * speedMultiplier;

            if (intensity > 0.65 && Math.random() < 0.004) {
                particle.orbitRadius += 0.8;
                if (particle.orbitRadius > this._baseRadius * 4.5) {
                    particle.orbitRadius = this._baseRadius * (1.2 + Math.random() * 0.3);
                    particle.angle = Math.random() * Math.PI * 2;
                }
            }

            const x = cx + Math.cos(particle.angle) * particle.orbitRadius;
            const y = cy + Math.sin(particle.angle) * particle.orbitRadius;
            const particleAlpha = particle.opacity * (0.25 + intensity * 0.75);

            ctx.beginPath();
            ctx.arc(x, y, particle.size, 0, Math.PI * 2);
            ctx.fillStyle = this._rgba(particleAlpha);
            ctx.fill();
        }
    }

    _drawRipples(ctx, cx, cy) {
        this._ripples = this._ripples.filter(ripple => ripple.opacity > 0.015);
        for (const ripple of this._ripples) {
            ctx.beginPath();
            ctx.arc(cx, cy, ripple.radius, 0, Math.PI * 2);
            ctx.strokeStyle = this._rgba(ripple.opacity);
            ctx.lineWidth   = 1.2;
            ctx.stroke();
            ripple.radius  += 2.8;
            ripple.opacity *= 0.94;
        }
    }

    // ── Private: helpers ──────────────────────────────────────────────────────

    _rgba(alpha) {
        const intensity = this._intensity;
        // Idle: cyan (0, 212, 255) → Speaking: cyan-green (0, 255, 160)
        const green = Math.round(212 + intensity * 43);
        const blue  = Math.round(255 - intensity * 95);
        return `rgba(0, ${green}, ${blue}, ${alpha.toFixed(3)})`;
    }
}
