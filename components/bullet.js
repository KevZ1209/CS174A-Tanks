import { defs, tiny, Subdivision_Sphere } from '../examples/common.js';
import { MAP_SCHEMATIC_ENUM } from './map.js';
import { Particle } from "./particle.js";

const { vec3, vec4, hex_color, Mat4, Material, color, Texture } = tiny;
const { Textured_Phong } = defs;

const BULLET_SCALE = 0.5;
const BULLET_SPHERE_SCALE = 0.25;
const BULLET_WIDTH = 0.3;
const BULLET_HEIGHT = 0.3;
const BULLET_DEPTH = 0.3;
const MAX_BULLET_COLLISIONS = 2;
const MAX_MAP_DISTANCE = 50;
const INVINCIBILITY_FRAMES = 0;
const BULLET_OFFSET = 1; // how far the bullet should be initialized in front of tank
const BULLET_SPEED = 15;
const BULLET_REMOVAL_DELAY = 650;

const PARTICLE_SPAWN_RATE = 0.001;
const PARTICLE_LIFETIME = 0.95;
const PARTICLE_INITIAL_SCALE = 0.2;
const PARTICLE_MAX_SCALE = .5;
const PARTICLE_INITIAL_OPACITY = 0.3; // 0.4
const PARTICLE_MAX_OPACITY = 0.4; // 0.46
const PARTICLE_OFFSET = 0.3;

export class Bullet {
  constructor(x, z, angle, collisionMap) {
    this.position = vec4(x + BULLET_OFFSET * Math.sin(angle), 1, z + BULLET_OFFSET * Math.cos(angle), 1);
    this.angle = angle;
    this.velocity = vec3(Math.sin(angle) * BULLET_SPEED, 0, Math.cos(angle) * BULLET_SPEED);
    this.numCollisions = 0;
    this.collisionMap = collisionMap;
    this.invinciblity = 0;
    this.shapes = {
      bullet: new Subdivision_Sphere(4),
      sphere: new Subdivision_Sphere(3),
    };

    this.timeSinceStoppedRendering = 0;
    this.shouldRenderBullet = true;
    // smoke
    this.particles = [];
    this.particleSpawnRate = PARTICLE_SPAWN_RATE;
    this.timeSinceLastSpawn = 0;

    this.materials = {
      bulletMaterial: new Material(new defs.Phong_Shader(), {
        ambient: .4, diffusivity: .6, color: hex_color("#ffffff")
      }),
      smoke: new Material(new defs.Phong_Shader(), {
        ambient: .4, diffusivity: .6, color: hex_color("#d2d0d0"), specularity: 0.1
      }),
      smokeCloud: new Material(new Textured_Phong(), {
        ambient: .35, diffusivity: .8, specularity: 0.1,
        color: hex_color("#d2d0d0"),
        texture: new Texture("../assets/smoke_trail.png")
      })
    };
  }

  update(dt) {
    if (this.shouldRenderBullet) {
      this.position = this.position.plus(this.velocity.times(dt));
      this.timeSinceLastSpawn += dt;

      // Spawn new particles
      if (this.timeSinceLastSpawn > this.particleSpawnRate) {
        this.spawnParticle();
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
  }

  spawnParticle() {
    const particlePosition = this.position.plus(vec3(
        (Math.random() - 0.5) * PARTICLE_OFFSET,
        0,
        (Math.random() - 0.5) * PARTICLE_OFFSET
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
    );
    this.particles.push(particle);
  }

  updateAndCheckExistence(dt) {
    this.update(dt);
    return this.timeSinceStoppedRendering < BULLET_REMOVAL_DELAY;
  }
  // returns true if bullet was successfully rendered
  // returns false if bullet was not rendered and should be deleted from animation queue
  renderBullet(context, program_state) {
    if (!this.shouldRenderBullet) return;
    const dt = program_state.animation_delta_time / 1000;

    // check for collision with blocks
    let collision = this.checkCollision();
    if (collision) {
      if (this.invinciblity <= 0) {
        this.invinciblity = INVINCIBILITY_FRAMES;
        let normal = collision.normal;
        let dotProduct = this.velocity.dot(normal);
        this.velocity = this.velocity.minus(normal.times(2 * dotProduct));
        this.numCollisions += 1;
      }
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
      this.shouldRenderBullet = false;
    }

    // draw bullet
    if (this.shouldRenderBullet) {
      let model_transform = Mat4.translation(this.position[0], this.position[1], this.position[2])
          .times(Mat4.scale(BULLET_SPHERE_SCALE, BULLET_SPHERE_SCALE, BULLET_SPHERE_SCALE));
      this.shapes.bullet.draw(context, program_state, model_transform, this.materials.bulletMaterial);
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
  checkCollision() {
    let position = this.position.to3();
    const candidate_blocks = [];

    for (let elem of this.collisionMap) {
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
    }
    else {
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

      return candidate_blocks[min_index];

    }
  }
}