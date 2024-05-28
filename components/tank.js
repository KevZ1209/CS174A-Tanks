import { defs, tiny } from '../examples/common.js';
import { Shape_From_File } from '../examples/obj-file-demo.js';
import { Bomb } from './bomb.js';

const { vec3, hex_color, Mat4, Material, Texture } = tiny;

const TANK_SCALE = 0.9;
const TANK_WIDTH = 0.5;
const TANK_HEIGHT = 1;
const TANK_DEPTH = 0.5;
const MAX_CLIP_SIZE = 4;
const RELOAD_TIME = 2500;
const MOVEMENT_SPEED = 2;
const ROTATION_SPEED = 1;

const TANK_TYPE_ENUM = {
  USER: {
    color: hex_color("#0F65DE"),
    canPlaceBombs: true
  },
  ENEMY_STATIONARY: {
    color: hex_color("#C68C2F"),
    canPlaceBombs: false
  },
  ENEMY_MOVING: {
    color: hex_color("#7A705F"),
    canPlaceBombs: false
  },
  ENEMY_MOVING_BOMB: {
    color: hex_color("#DDC436"),
    canPlaceBombs: true
  },
  ENEMY_MOVING_FAST_SHOOTING: {
    color: hex_color("#3F7F6F"),
    canPlaceBombs: false
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
    this.dead = false;

    // AI movement
    this.movementSpeed = MOVEMENT_SPEED;
    this.rotationSpeed = ROTATION_SPEED;
    this.targetPosition = null;
    this.targetAngle = null;
    this.reachedTarget = true;
    this.movementTimer = 0;

    this.materials = {
      tank: new Material(new defs.Phong_Shader(),
        { ambient: .4, diffusivity: .6, color: this.type.color }),
      user_x: new Material(new defs.Textured_Phong(), {
        ambient: .3, diffusivity: .3, specularity: 0.0,
        color: this.type.color,
        texture: new Texture("assets/user_x.png")
      }),
      enemy_x: new Material(new defs.Textured_Phong(), {
        ambient: .3, diffusivity: .2, specularity: 0.0,
        color: hex_color("#ffffff"),
        texture: new Texture("assets/enemy_x.png")
      })
    }
    this.shapes = {
      tank: new Shape_From_File("assets/tank.obj"),
      x: new defs.Square()
    }
  }

  render(context, program_state) {
    if (!this.dead) {
      // tank alive
      let model_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
        .times(Mat4.rotation(this.angle, 0, 1, 0));
      this.shapes.tank.draw(context, program_state, model_transform, this.materials.tank);

      const t = program_state.animation_time;
      const dt = program_state.animation_delta_time / 1000;

      // reload bullets
      if (this.clip >= MAX_CLIP_SIZE) {
        this.last_reload_time = t
      } else if (this.clip < MAX_CLIP_SIZE && t - this.last_reload_time > RELOAD_TIME) {
        this.clip++;
        this.last_reload_time = t;
      }

      if (this.type !== TANK_TYPE_ENUM.USER) {
        this.updateAIMovement(dt);
      }

      if (this.targetPosition && !this.reachedTarget) {
        if (this.targetAngle !== null && Math.abs(this.angle - this.targetAngle) > 0.01) {
          this.rotateTowardsTargetAngle(dt);
        } else {
          this.moveTowardsTarget(dt);
        }
      }

    } else {
      // tank dead
      let model_transform = Mat4.translation(this.x, -0.9, this.z)
        .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
        .times(Mat4.scale(1.3, 1.3, 1.3))
      this.shapes.x.draw(context, program_state, model_transform, this.type === TANK_TYPE_ENUM.USER ? this.materials.user_x : this.materials.enemy_x);
    }
  }

  updateAIMovement(dt) {
    switch (this.type) {
      case TANK_TYPE_ENUM.ENEMY_MOVING:
        this.updateMovingEnemy(dt);
        break;
        // other cases for different tank types
      default:
        break;
    }
  }

  updateMovingEnemy(dt) {
    this.movementTimer += dt;
    if (this.movementTimer >= 1) { // Move every second
      this.movementTimer = 0;
      this.moveRandomly();
    }
  }


  moveRandomly() {
    const directions = [
      vec3(2, 0, 0),
      vec3(-2, 0, 0),
      vec3(0, 0, 2),
      vec3(0, 0, -2),
      vec3(2,0,2),
      vec3(-2,0,2),
      vec3(2,0,-2),
      vec3(-2,0,-2),
    ];

    while (directions.length > 0) {
      const randomIndex = Math.floor(Math.random() * directions.length);
      const direction = directions.splice(randomIndex, 1)[0];
      const newX = this.x + direction[0] * TANK_WIDTH * 2;
      const newZ = this.z + direction[2] * TANK_DEPTH * 2;

      if (!this.checkCollision(newX, newZ)) {
        this.setTargetPosition(newX, newZ);
        this.targetAngle = Math.atan2(direction[0], direction[2]);
        break;
      }
    }
  }

  setTargetPosition(new_x, new_z) {
    this.targetPosition = vec3(new_x, 0, new_z);
    this.reachedTarget = false;
  }

  moveTowardsTarget(dt) {
    const direction = this.targetPosition.minus(vec3(this.x, 0, this.z)).normalized();
    const distance = this.targetPosition.minus(vec3(this.x, 0, this.z)).norm();

    if (distance <= this.movementSpeed * dt) {
      this.x = this.targetPosition[0];
      this.z = this.targetPosition[2];
      this.reachedTarget = true;
    } else {
      this.x += direction[0] * this.movementSpeed * dt;
      this.z += direction[2] * this.movementSpeed * dt;
    }
  }

  rotateTowardsTargetAngle(dt) {
    const angleDifference = this.targetAngle - this.angle;
    const rotationSpeed = Math.PI * this.rotationSpeed * dt;

    if (Math.abs(angleDifference) < rotationSpeed) {
      this.angle = this.targetAngle;
    } else {
      this.angle += Math.sign(angleDifference) * rotationSpeed;
    }
  }

  updatePosition(new_x, new_z, direction = null) {
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
    } else {
      // update without collision detection
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
    if (!this.dead && this.type.canPlaceBombs && !this.bombActive) {
      this.bombActive = true;
      let bomb = new Bomb(this.map, this.x, this.z, this);
      this.map.bomb_queue.push(bomb);
    }
  }

  getPosition() {
    return [this.x, this.z];
  }
}

export { Tank, TANK_TYPE_ENUM, TANK_HEIGHT, TANK_WIDTH, TANK_DEPTH }