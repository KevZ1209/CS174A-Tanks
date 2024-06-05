import { defs, tiny } from '../examples/common.js';
import { Shape_From_File } from '../examples/obj-file-demo.js';
import { Bomb } from './bomb.js';

const { vec3, hex_color, Mat4, Material, Texture } = tiny;
const { Textured_Phong } = defs;

const TANK_SCALE = 0.9;
const TANK_WIDTH = 0.5;
const TANK_HEIGHT = 0.5;
const TANK_DEPTH = 0.5;
const MAX_CLIP_SIZE = 4;
const RELOAD_TIME = 2500;

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
    this.body_orientation = Math.PI/2;

    this.materials = {
      tank: new Material(new defs.Phong_Shader(),
        { ambient: 0.3, diffusivity: 1, specularity: 0, color: this.type.color }),
      turret: new Material(new defs.Phong_Shader(),
          { ambient: 0.3, diffusivity: 1, specularity: 0, color: this.type.color }),
      turret_test: new Material(new Textured_Phong(), {
        ambient: .35, diffusivity: .8, specularity: 0.1,
        color: this.type.color,
        texture: new Texture("assets/cork.jpg")
      }),
      tank_test: new Material(new Textured_Phong(), {
        ambient: .4, diffusivity: .8, specularity: 0.1,
        color: this.type.color,
        texture: new Texture("assets/map_background.jpg")
      }),
      user_x: new Material(new defs.Textured_Phong(), {
        ambient: .3, diffusivity: .3, specularity: 0.0,
        color: this.type.color,
        texture: new Texture("assets/user_x.png")
      }),
      enemy_x: new Material(new defs.Textured_Phong(1), {
        ambient: 1, diffusivity: 0, specularity: 0,
        texture: new Texture("assets/enemy_x.png")
      })
    }
    this.shapes = {
      tank: new Shape_From_File("assets/tank.obj"),
      turret: new Shape_From_File("assets/turret.obj"),
      tankbody: new Shape_From_File("assets/tankbody.obj"),
      x: new defs.Square()
    }
  }

  render(context, program_state) {
    if (!this.dead) {
      // tank alive
      let turret_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
        .times(Mat4.rotation(this.angle + Math.PI, 0, 3, 0)
        // extra scale & translation for 3d object
        .times(Mat4.scale(0.4, 0.4, 0.4)
        .times(Mat4.translation(0, 1, -3.5))));

      let tankbody_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
          .times(Mat4.scale(1, 1, 1))
          .times(Mat4.translation(0, 0, 0))
          .times(Mat4.rotation(this.body_orientation, 0, 1, 0));

      this.shapes.turret.draw(context, program_state, turret_transform, this.materials.turret_test);
      this.shapes.tankbody.draw(context, program_state, tankbody_transform, this.materials.tank_test);


      const t = program_state.animation_time;
      const dt = program_state.animation_delta_time / 1000;

      // reload bullets
      if (this.clip >= MAX_CLIP_SIZE) {
        this.last_reload_time = t
      } else if (this.clip < MAX_CLIP_SIZE && t - this.last_reload_time > RELOAD_TIME) {
        this.clip++;
        this.last_reload_time = t;
      }
    } else {
      // tank dead
      let model_transform = Mat4.translation(this.x, -0.9, this.z)
        .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
        .times(Mat4.scale(1.3, 1.3, 1.3))
      this.shapes.x.draw(context, program_state, model_transform, this.type === TANK_TYPE_ENUM.USER ? this.materials.user_x : this.materials.enemy_x);
    }
  }

  updatePosition(new_x, new_z, direction = null) {
    if (direction) {

      // up, down, left, right
      let position_changes = [false, false, false, false]


      // Update X position
      let potential_new_x = new_x;
      if (direction.right && !this.checkCollision(potential_new_x, this.z)) {
        this.x = potential_new_x;
        position_changes[3] = true;
      } else if (direction.left && !this.checkCollision(potential_new_x, this.z)) {
        this.x = potential_new_x;
        position_changes[2] = true;
      }

      // Update Z position
      let potential_new_z = new_z;
      if (direction.up && !this.checkCollision(this.x, potential_new_z)) {
        this.z = potential_new_z;
        position_changes[0] = true;
      } else if (direction.down && !this.checkCollision(this.x, potential_new_z)) {
        this.z = potential_new_z;
        position_changes[1] = true;
      }

      let position_changes_str = JSON.stringify(position_changes)

      // determine correct body orientation based on position_changes
      // RIGHT or LEFT
      if (position_changes_str === "[false,false,true,false]" || position_changes_str === "[false,false,false,true]") {
        this.body_orientation = Math.PI/2;
      }
      // UP-RIGHT or DOWN-LEFT
      if (position_changes_str === "[true,false,false,true]" || position_changes_str === "[false,true,true,false]") {
        this.body_orientation = 3*Math.PI/4;
      }
      // LEFT-RIGHT or DOWN-RIGHT
      if (position_changes_str === "[false,true,false,true]" || position_changes_str === "[true,false,true,false]") {
        this.body_orientation = Math.PI/4;
      }
      if (position_changes_str === "[true,false,false,false]" || position_changes_str === "[false,true,false,false]") {
        this.body_orientation = 0;
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
    return this.checkTankCollision(potential_x,potential_z); // No collision
  }

  checkTankCollision(potential_x, potential_z) {
    let position = vec3(potential_x, 0, potential_z);
    let tanks = [...this.map.enemies];
    for (let tank of tanks) {
      if (!tank.dead) {
        const tankMin = position.minus(vec3(TANK_WIDTH * 3, 0, TANK_DEPTH* 2.2));
        const tankMax = position.plus(vec3(TANK_WIDTH* 3, TANK_HEIGHT, TANK_DEPTH* 2.2));

        const otherTankMin = vec3(tank.x - TANK_WIDTH, 0, tank.z - TANK_DEPTH);
        const otherTankMax = vec3(tank.x + TANK_WIDTH, TANK_HEIGHT, tank.z + TANK_DEPTH);

        const xOverlap = tankMin[0] <= otherTankMax[0] && tankMax[0] >= otherTankMin[0];
        const yOverlap = tankMin[1] <= otherTankMax[1] && tankMax[1] >= otherTankMin[1];
        const zOverlap = tankMin[2] <= otherTankMax[2] && tankMax[2] >= otherTankMin[2];
        if (xOverlap && yOverlap && zOverlap) {
          return true; // Collision detected with another tank
        }
      }
    }
    return false; // No collision with other tanks
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