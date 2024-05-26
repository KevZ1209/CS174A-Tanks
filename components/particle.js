
export class Particle {
    constructor(position, velocity, lifetime, initialScale, maxScale, opacity,maxOpacity, isFading, fadeRate) {
        this.position = position;
        this.velocity = velocity;
        this.lifetime = lifetime;
        this.initialScale = initialScale;
        this.maxScale = maxScale;
        this.opacity = opacity;
        this.maxOpacity = maxOpacity;
        this.isFading = isFading;
        this.fadeRate = fadeRate;
        this.age = 0;
    }

    update(dt) {
        this.position = this.position.plus(this.velocity.times(dt));
        this.age += dt;
        const lifeRatio = this.age / this.lifetime;
        this.scale = this.initialScale + lifeRatio * (this.maxScale - this.initialScale);
        if (this.isFading) {
            this.opacity = this.opacity - lifeRatio * this.opacity *this.fadeRate;
        } else {
            this.opacity = this.opacity + lifeRatio * (this.maxOpacity - this.opacity) *this.fadeRate;
        }

    }

    isDead() {
        return this.age >= this.lifetime;
    }
}
