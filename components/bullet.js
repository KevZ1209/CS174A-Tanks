import { defs, tiny, Subdivision_Sphere } from '../examples/common.js';

const { vec3, hex_color, Mat4, Material } = tiny;

const BULLET_SCALE = 0.5;
const BULLET_WIDTH = 0.25;
const BULLET_HEIGHT = 0.25;
const BULLET_DEPTH = 0.25;
const MAX_BULLET_COLLISIONS = 2;
const MAX_MAP_DISTANCE = 50;
const INVINCIBILITY_FRAMES = 4;

export class Bullet {
  constructor(initial_position, angle, initial_velocity, collisionMap) {
    this.position = initial_position;
    this.angle = angle;
    this.velocity = initial_velocity;
    this.numCollisions = 0;
    this.collisionMap = collisionMap;
    this.invinciblity = 0;
    this.shape = new Subdivision_Sphere(4);
    this.material = new Material(new defs.Phong_Shader(), { ambient: .4, diffusivity: .6, color: hex_color("#ffffff") });
  }

  // returns true if bullet was successfully rendered
  // returns false if bullet was not rendered and should be deleted from animation queue
  render(context, program_state) {
    // update position
    this.position = this.position.plus(this.velocity);

    // check for collision with blocks
    let collision = this.checkCollision();
    // if it collides
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
      return false;
    } else if (this.numCollisions > MAX_BULLET_COLLISIONS) {
      return false;
    }

    // draw bullet
    let model_transform = Mat4.translation(this.position[0], 0, this.position[2])
      .times(Mat4.scale(BULLET_SCALE, BULLET_SCALE, BULLET_SCALE));
    this.shape.draw(context, program_state, model_transform, this.material);
    return true;
  }

  checkCollision() {
    let position = this.position.to3();
    for (let elem of this.collisionMap) {
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
        return { block: elem, normal: normal };
      }
    }
    return null; // No collision
  }
}