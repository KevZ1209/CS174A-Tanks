import { defs, tiny } from '../examples/common.js';
import { Shape_From_File } from '../examples/obj-file-demo.js';
import { Bomb } from './bomb.js';

const { vec3, hex_color, Mat4, Material } = tiny;

const TANK_SCALE = 0.9;
const TANK_WIDTH = 0.5;
const TANK_HEIGHT = 1;
const TANK_DEPTH = 0.5;
const MAX_CLIP_SIZE = 4;
const RELOAD_TIME = 2500;

const TANK_TYPE_ENUM = {
  USER: {
    color: hex_color("#0F65DE")
  },
  ENEMY_STATIONARY: {
    color: hex_color("#C68C2F")
  },
  ENEMY_MOVING: {
    color: hex_color("#7A705F")
  },
  ENEMY_MOVING_BOMB: {
    color: hex_color("#DDC436")
  },
  ENEMY_MOVING_FAST_SHOOTING: {
    color: hex_color("#3F7F6F")
  }
};

class Tank {
  constructor(initial_x, initial_z, initial_angle, type, map) {
    this.x = initial_x;
    this.z = initial_z;
    this.angle = initial_angle
    this.map = map;
    this.type = type;
    this.bombActive = false;
    this.clip = MAX_CLIP_SIZE;
    this.last_reload_time = 0;

    this.material = new Material(new defs.Phong_Shader(),
      { ambient: .4, diffusivity: .6, color: type.color }
    )
    this.shape = new Shape_From_File("assets/tank.obj");
  }

  render(context, program_state) {
    let model_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
      .times(Mat4.rotation(this.angle, 0, 1, 0));
    this.shape.draw(context, program_state, model_transform, this.material);

    const t = program_state.animation_time;
    const dt = program_state.animation_delta_time / 1000;

    // reload bullets
    if(this.clip >= MAX_CLIP_SIZE) {
      this.last_reload_time = t
    } else if (this.clip < MAX_CLIP_SIZE && t - this.last_reload_time > RELOAD_TIME) {
      this.clip++;
      this.last_reload_time = t;
    }
  }

  updatePosition(new_x, new_z, direction = null) {
    // update with collision detection
    if (direction) {
      // Update X position
      let potential_new_x = new_x;
      if (direction.right && !this.checkCollision(potential_new_x, this.z)) {
        this.x = potential_new_x;
      } else if (direction.left && !this.checkCollision(potential_new_x, this.z)) {
        this.x = potential_new_x;
      }

      // Update Z position
      let potential_new_z = new_z;
      if (direction.up && !this.checkCollision(this.x, potential_new_z)) {
        this.z = potential_new_z;
      } else if (direction.down && !this.checkCollision(this.x, potential_new_z)) {
        this.z = potential_new_z;
      }

      // update without collision detection
    } else {
      this.x = new_x;
      this.z = new_z;
    }
  }

  checkCollision(potential_x, potential_z) {
    let position = vec3(potential_x, 0, potential_z);
    for (let elem of this.map.collisionMap) {
      const tankMin = position.minus(vec3(TANK_WIDTH, 0, TANK_DEPTH));
      const tankMax = position.plus(vec3(TANK_WIDTH, TANK_HEIGHT, TANK_DEPTH));

      const elemMin = elem.position.minus(vec3(elem.size * TANK_SCALE, elem.size * TANK_SCALE, elem.size * TANK_SCALE));
      const elemMax = elem.position.plus(vec3(elem.size * TANK_SCALE, elem.size * TANK_SCALE, elem.size * TANK_SCALE));

      const xOverlap = tankMin[0] <= elemMax[0] && tankMax[0] >= elemMin[0];
      const yOverlap = tankMin[1] <= elemMax[1] && tankMax[1] >= elemMin[1];
      const zOverlap = tankMin[2] <= elemMax[2] && tankMax[2] >= elemMin[2];

      if (xOverlap && yOverlap && zOverlap) {
        return true; // Collision detected
      }
    }
    return false; // No collision
  }

  placeBomb() {
    if (!this.bombActive) {
      this.bombActive = true;
      let bomb = new Bomb(this.map, this.x, this.z, this);
      this.map.bomb_queue.push(bomb);
    }
  }

  getPosition() {
    return [this.x, this.z];
  }
}

export { Tank, TANK_TYPE_ENUM }