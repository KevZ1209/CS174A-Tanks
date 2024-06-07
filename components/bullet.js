import { tiny } from '../examples/common.js';
import { MAP_SCHEMATIC_ENUM } from './map.js';
import { Particle } from "./particle.js";
import { TANK_HEIGHT, TANK_WIDTH, TANK_DEPTH, TANK_TYPE_ENUM } from './tank.js';
import { BOMB_WIDTH, BOMB_HEIGHT, BOMB_DEPTH } from './bomb.js';
import * as AUDIO from "./audio.js";

const { vec3, vec4, hex_color, Mat4, color } = tiny;

const BULLET_SCALE = 0.51;
const BULLET_SPHERE_SCALE = 0.25;
const BULLET_WIDTH = 0.3;
const BULLET_HEIGHT = 0.3;
const BULLET_DEPTH = 0.3;
const MAX_BULLET_COLLISIONS = 2;
const MAX_MAP_DISTANCE = 50;
const INVINCIBILITY_FRAMES = 0;
const BULLET_OFFSET = 2;
const BULLET_REMOVAL_DELAY = 450;
// Delay before bullet can hit a tank
const BULLET_COLLISION_DELAY = 0.08;

const PARTICLE_SPAWN_RATE = 0.001;
const PARTICLE_LIFETIME = 0.95;
const PARTICLE_INITIAL_SCALE = 0.2;
const PARTICLE_MAX_SCALE = .7;
const PARTICLE_INITIAL_OPACITY = 0.37;
const PARTICLE_MAX_OPACITY = 0.6;
const PARTICLE_FADE_RATE = 0.2;

const SMOKE_BURST_PARTICLE_COUNT = 50;
const SMOKE_BURST_SIZE = 1.6;
const SMOKE_TRAIL_DENSITY = 0.5;
const SMOKE_TRAIL_PARTICLE_COUNT = 2;

const BULLET_TYPE_ENUM = {
  USER: {
    speed: 9,
    color: hex_color("#ffffff")
  },
  NORMAL: {
    speed: 9,
    color: hex_color("#7A705F")
  },
  FAST: {
    speed: 14,
    color: hex_color("#ff7f7f")
  }
}

class Bullet {
  static activeBullets = [];
  constructor(x, z, angle, map, type, hitboxOn, hits_enemies) {
    this.type = type;
    this.position = vec4(x + BULLET_OFFSET * Math.sin(angle), -0.5, z + BULLET_OFFSET * Math.cos(angle), 1);
    this.velocity = vec3(Math.sin(angle) * this.type.speed, 0, Math.cos(angle) * this.type.speed);
    this.numCollisions = 0;
    this.invinciblity = 0;
    this.shapes = map.shapes;
    this.materials = map.materials;
    this.map = map;
    this.lastCollidedBlock = null;
    this.hitboxOn = hitboxOn;
    this.hits_enemies = hits_enemies;

    this.timeSinceStoppedRendering = 0;
    this.shouldRenderBullet = true;
    this.timeSinceFired = 0;
    // smoke
    this.particles = [];
    this.particleSpawnRate = PARTICLE_SPAWN_RATE;
    this.timeSinceLastSpawn = 0;

    this.burstCount = 0;

    Bullet.activeBullets.push(this);
  }

  update(dt) {
    this.timeSinceFired += dt;
    if (this.shouldRenderBullet) {
      this.position = this.position.plus(this.velocity.times(dt));
      this.timeSinceLastSpawn += dt;

      // Spawn new particles
      if (this.timeSinceLastSpawn > this.particleSpawnRate) {
        this.spawnSmokeTrail()
        this.timeSinceLastSpawn = 0;
      }
    } else {
      this.timeSinceStoppedRendering += dt;
    }

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (this.particles[i].isDead()) {
        this.particles.splice(i, 1);
      }
    }
    if (!this.shouldRenderBullet) {
      // Remove the bullet from the active bullets list when it stops rendering
      const index = Bullet.activeBullets.indexOf(this);
      if (index > -1) {
        Bullet.activeBullets.splice(index, 1);
      }
    }
  }

  spawnParticle(offset, isFading) {
    const particlePosition = this.position.plus(vec3(
        (Math.random() - 0.5) * offset,
        0,
        (Math.random() - 0.5) * offset,
    ));

    const particleVelocity = vec3(Math.random() * 0.1 - 0.05, Math.random() * 0.1 - 0.05, Math.random() * 0.1 - 0.05);
    const particle = new Particle(
        particlePosition,
        particleVelocity,
        PARTICLE_LIFETIME,
        PARTICLE_INITIAL_SCALE,
        PARTICLE_MAX_SCALE,
        PARTICLE_INITIAL_OPACITY,
        PARTICLE_MAX_OPACITY,
        isFading,
        PARTICLE_FADE_RATE,
    );
    this.particles.push(particle);
  }

  spawnSmokeTrail() {
    for (let i = 0; i < SMOKE_TRAIL_PARTICLE_COUNT; i++ ) {
      this.spawnParticle(SMOKE_TRAIL_DENSITY, true);
    }
  }
  spawnSmokeBurst() {
    if (this.burstCount < 2) {
      for (let i = 0; i < SMOKE_BURST_PARTICLE_COUNT; i++) {
        this.spawnParticle(SMOKE_BURST_SIZE, true);
      }
      this.burstCount++;
    }
  }

  updateAndCheckExistence(dt) {
    this.update(dt);
    return this.shouldRenderBullet || this.particles.length > 0;
  }

  drawHitbox(context, program_state, min, max, color) {
    const center = min.plus(max).times(0.5);
    const size = max.minus(min).times(0.5);
    let model_transform = Mat4.translation(center[0], center[1], center[2])
        .times(Mat4.scale(size[0], size[1], size[2]));

    const material = this.materials.hitbox.override({ color: color });
    this.shapes.cube.draw(context, program_state, model_transform, material);
  }

  renderBlockHitboxes(context, program_state) {
    for (let elem of this.map.collisionMap) {
      if (elem.type !== MAP_SCHEMATIC_ENUM.HOLE) {
        const elemMin = elem.position.minus(vec3(elem.size * BULLET_SCALE, elem.size * BULLET_SCALE, elem.size * BULLET_SCALE));
        const elemMax = elem.position.plus(vec3(elem.size * BULLET_SCALE, elem.size * BULLET_SCALE, elem.size * BULLET_SCALE));
        this.drawHitbox(context, program_state, elemMin, elemMax, hex_color("#00FF00")); // Green color for block hitboxes
      }
    }
  }


  // returns true if bullet was successfully rendered
  // returns false if bullet was not rendered and should be deleted from animation queue
  renderBullet(context, program_state) {
    if (!this.shouldRenderBullet) return;

    // check for collision with blocks
    let collision = this.checkCollision();
    if (collision) {
      if (this.invinciblity <= 0) {
        this.invinciblity = INVINCIBILITY_FRAMES;
        let normal = collision.normal;
        let dotProduct = this.velocity.dot(normal);
        this.velocity = this.velocity.minus(normal.times(2 * dotProduct));
        this.numCollisions += 1;

        this.lastCollidedBlock = collision.block
      }
    }

    if (this.timeSinceFired >= BULLET_COLLISION_DELAY) {
      this.checkTankCollision(true);
      this.checkBombCollision();
      this.checkBulletCollision()
    }
    // decrease invincibility frame
    this.invinciblity = this.invinciblity > 0 ? this.invinciblity - 1 : 0;

    // return false if out of bounds or numCollisions > 2
    if (this.position[0] < -MAX_MAP_DISTANCE ||
      this.position[0] > MAX_MAP_DISTANCE ||
      this.position[2] < -MAX_MAP_DISTANCE ||
      this.position[2] > MAX_MAP_DISTANCE) {
      this.shouldRenderBullet = false;
    } else if (this.numCollisions > MAX_BULLET_COLLISIONS) {
      this.spawnSmokeBurst();
      this.shouldRenderBullet = false;
      AUDIO.BULLET_HIT_DONE_SOUND.cloneNode().play();
    }

    // draw bullet
    if (this.shouldRenderBullet) {
      let model_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
          .times(Mat4.scale(BULLET_SPHERE_SCALE, BULLET_SPHERE_SCALE, BULLET_SPHERE_SCALE));
      if (!this.hitboxOn) {
        this.shapes.bullet.draw(context, program_state, model_transform, this.materials.bulletMaterial.override({ color: this.type.color }));
      } else {
        // draw bullet hitbox
        const bulletMin = this.position.to3().minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
        const bulletMax = this.position.to3().plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
        this.drawHitbox(context, program_state, bulletMin, bulletMax, hex_color("#FF0000"));
        this.renderBlockHitboxes(context, program_state);
      }

    }

  }

  renderSmoke(context,program_state) {
    // draw smoke
    for (const particle of this.particles) {
      const particle_transform = Mat4.translation(particle.position[0], particle.position[1], particle.position[2])
          .times(Mat4.scale(particle.scale, particle.scale, particle.scale)); // Adjust particle size
      const particleMaterial = this.materials.smoke.override({ color: color(0.4, 0.4, 0.4, particle.opacity) });
      this.shapes.sphere.draw(context, program_state, particle_transform, particleMaterial);
    }
  }

  checkBulletCollision() {
    let position = this.position.to3();
    for (let bullet of Bullet.activeBullets) {
      if (bullet !== this && bullet.shouldRenderBullet) { // Avoid self-collision and ensure the other bullet is active
        let bulletPosition = bullet.position.to3();
        const bulletMin = bulletPosition.minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
        const bulletMax = bulletPosition.plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));

        const thisBulletMin = position.minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
        const thisBulletMax = position.plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));

        const xOverlap = thisBulletMin[0] <= bulletMax[0] && thisBulletMax[0] >= bulletMin[0];
        const yOverlap = thisBulletMin[1] <= bulletMax[1] && thisBulletMax[1] >= bulletMin[1];
        const zOverlap = thisBulletMin[2] <= bulletMax[2] && thisBulletMax[2] >= bulletMin[2];

        if (xOverlap && yOverlap && zOverlap) {
          this.shouldRenderBullet = false;
          bullet.shouldRenderBullet = false;
          AUDIO.BULLET_HIT_DONE_SOUND.cloneNode().play();
          const index = Bullet.activeBullets.indexOf(this);
          if (index > -1) {
            Bullet.activeBullets.splice(index, 1);
          }

          this.spawnSmokeBurst();

        }
      }
    }
  }

  checkTankCollision(flag) {
    let position = this.position.to3();
    let tanks = [this.map.user, ...this.map.enemies];
    for (let i = 0; i < tanks.length; i++) {
      let tank = tanks[i];
      let tankPosition = vec3(tank.x, 0, tank.z);
      const tankMin = tankPosition.minus(vec3(TANK_WIDTH*1.9, TANK_HEIGHT*1.9, TANK_DEPTH*1.9 ));
      const tankMax = tankPosition.plus(vec3(TANK_WIDTH*1.9, TANK_HEIGHT *1.9, TANK_DEPTH*1.9));

      const bulletMin = position.minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
      const bulletMax = position.plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));

      const xOverlap = bulletMin[0] <= tankMax[0] && bulletMax[0] >= tankMin[0];
      const yOverlap = bulletMin[1] <= tankMax[1] && bulletMax[1] >= tankMin[1];
      const zOverlap = bulletMin[2] <= tankMax[2] && bulletMax[2] >= tankMin[2];

      if (xOverlap && yOverlap && zOverlap && !tank.dead) {
        if (tank.type === TANK_TYPE_ENUM.USER || tank.type !== TANK_TYPE_ENUM.USER && this.hits_enemies === true) {
          AUDIO.TANK_DESTROYED_SOUND.cloneNode().play();
          tank.dead = true;
          this.shouldRenderBullet = false;
          this.spawnSmokeBurst();
          if (tank.type === TANK_TYPE_ENUM.USER) {
            console.log("User died :((");
          } else {
            console.log("Enemy died");
          }
        }
      }
    }
  }

  checkBombCollision() {
    let position = this.position.to3();
    for (let bomb of this.map.bomb_queue) {
      let bombPosition = vec3(bomb.x, 0, bomb.z);
      const bombMin = bombPosition.minus(vec3(BOMB_WIDTH*.75, BOMB_HEIGHT*.75, BOMB_DEPTH*.75));
      const bombMax = bombPosition.plus(vec3(BOMB_WIDTH*.75, BOMB_HEIGHT*.75, BOMB_DEPTH*.75));

      const bulletMin = position.minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
      const bulletMax = position.plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));

      const xOverlap = bulletMin[0] <= bombMax[0] && bulletMax[0] >= bombMin[0];
      const yOverlap = bulletMin[1] <= bombMax[1] && bulletMax[1] >= bombMin[1];
      const zOverlap = bulletMin[2] <= bombMax[2] && bulletMax[2] >= bombMin[2];

      if (xOverlap && yOverlap && zOverlap) {
        bomb.triggerExplosion();
        this.shouldRenderBullet = false;
        this.spawnSmokeBurst();
      }
    }
  }

  checkCollision() {
    let position = this.position.to3();
    const candidate_blocks = [];

    for (let elem of this.map.collisionMap) {
      if (elem.type !== MAP_SCHEMATIC_ENUM.HOLE) {
        const bulletMin = position.minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
        const bulletMax = position.plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));

        const elemMin = elem.position.minus(vec3(elem.size * BULLET_SCALE, elem.size * BULLET_SCALE, elem.size * BULLET_SCALE));
        const elemMax = elem.position.plus(vec3(elem.size * BULLET_SCALE, elem.size * BULLET_SCALE, elem.size * BULLET_SCALE));

        const xOverlap = bulletMin[0] <= elemMax[0] && bulletMax[0] >= elemMin[0];
        const yOverlap = bulletMin[1] <= elemMax[1] && bulletMax[1] >= elemMin[1];
        const zOverlap = bulletMin[2] <= elemMax[2] && bulletMax[2] >= elemMin[2];

        if (xOverlap && yOverlap && zOverlap) {
          // Determine the normal vector of the collision
          let normal = vec3(0, 0, 0);
          if (Math.abs(position[0] - elem.position[0]) > Math.abs(position[2] - elem.position[2])) {
            normal[0] = Math.sign(position[0] - elem.position[0]);
          } else {
            normal[2] = Math.sign(position[2] - elem.position[2]);
          }
          candidate_blocks.push({ block: elem, normal: normal });
        }
      }
    }
    if (candidate_blocks.length === 0) {
      return null; // No collision
    } else {
      AUDIO.BULLET_HIT_RICOCHET_SOUND.cloneNode().play();

      function calc_distance(x1, z1, x2, z2) {
        return Math.sqrt((Math.pow(x1-x2,2))+(Math.pow(z1-z2,2)));
      }

      let min_distance = 1000;
      let min_index = 0;
      let bullet_position = this.position.to3();
      for (let i = 0; i < candidate_blocks.length; i++) {
        const block_x = candidate_blocks[i].block.position[0];
        const block_z = candidate_blocks[i].block.position[2];

        const bullet_x = bullet_position[0];
        const bullet_z = bullet_position[2];

        const curr_distance = calc_distance(block_x, block_z, bullet_x, bullet_z);
        if (curr_distance < min_distance) {
          min_distance = curr_distance;
          min_index = i;
        }
      }

      const closestBlock = candidate_blocks[min_index];

      // Check if the closest block is the same as the last collided block
      if (this.lastCollidedBlock === closestBlock.block) {
        return null; // Ignore collision with the same block
      }

      return candidate_blocks[min_index];
    }
  }
}

export { Bullet, BULLET_TYPE_ENUM, BULLET_HEIGHT, BULLET_WIDTH, BULLET_DEPTH, BULLET_SCALE }