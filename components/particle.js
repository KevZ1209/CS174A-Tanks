
export class Particle {
    constructor(position, velocity, lifetime, scale, opacity, fadeRate) {
        this.position = position;
        this.velocity = velocity;
        this.lifetime = lifetime;
        this.scale = scale;
        this.opacity = opacity;
        this.fadeRate = fadeRate;
        this.age = 0;
    }

    update(dt) {
        this.position = this.position.plus(this.velocity.times(dt));
        this.age += dt;
        this.opacity = Math.max(0, this.opacity - this.fadeRate * dt);
    }

    isDead() {
        return this.age >= this.lifetime;
    }
}
