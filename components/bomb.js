import { Subdivision_Sphere, defs, tiny } from '../examples/common.js';
import { MAP_SCHEMATIC_ENUM } from './map.js';
import { TANK_HEIGHT, TANK_WIDTH, TANK_DEPTH, TANK_TYPE_ENUM } from './tank.js';

const { vec3, hex_color, Mat4, Material, Texture } = tiny;

const BOMB_COLOR_YELLOW = hex_color("#DBC63A");
const BOMB_COLOR_RED = hex_color("#E46969");
const BOMB_LIFETIME = 7; // seconds
const BOMB_RADIUS = 4;
const BOMB_WIDTH = 1;
const BOMB_HEIGHT = 1;
const BOMB_DEPTH = 1;

const EXPLOSION_COLOR = hex_color("#B64D1B");
const EXPLOSION_LIFETIME = 0.5; // seconds
const EXPLOSION_ROTATION_RATE = Math.PI / EXPLOSION_LIFETIME;
const MAX_EXPLOSION_SCALE = 4;

class Bomb {
  constructor(map, x, z, owner) {
    this.x = x;
    this.z = z;
    this.map = map
    this.owner = owner;
    this.age = 0;
    this.active = true;
    this.exploding = false;
    this.explosionAge = 0;
    this.explosionAngle = 0;
    this.explosionScale = MAX_EXPLOSION_SCALE;

    this.materials = {
      bomb: new Material(new defs.Phong_Shader(),
        { ambient: .5, diffusivity: .6, specularity: 1, color: BOMB_COLOR_YELLOW }),
      explosion: new Material(new defs.Textured_Phong(), {
        ambient: .7, diffusivity: .9, specularity: 0.1,
        color: EXPLOSION_COLOR,
        texture: new Texture("assets/explosion.jpg")
      })
    }
    this.shape = new Subdivision_Sphere(4);
  }

  render(context, program_state) {
    const dt = program_state.animation_delta_time / 1000;
    this.age += dt;

    // render active bomb
    if (this.active) {
      if (this.age >= BOMB_LIFETIME) {
        // explode bomb
        this.triggerExplosion()
      } else {
        // bomb timer running
        let bombColor;
        if (this.age > BOMB_LIFETIME - 2) {
          bombColor = this.age % 0.14 < 0.07 ? BOMB_COLOR_YELLOW : BOMB_COLOR_RED;
        } else {
          bombColor = BOMB_COLOR_YELLOW;
        }
        this.shape.draw(context, program_state, Mat4.translation(this.x, -1, this.z), this.materials.bomb.override({ color: bombColor }));
      }
    }

    // render explosion
    if (this.exploding) {
      if (this.explosionAge < EXPLOSION_LIFETIME) {
        this.explosionAge += dt;
        this.explosionAngle += EXPLOSION_ROTATION_RATE * dt;
        this.explosionScale -= dt;
        let explosion_transform = Mat4.translation(this.x, -1, this.z)
          .times(Mat4.rotation(this.explosionAngle, 0, 1, 0))
          .times(Mat4.scale(this.explosionScale, this.explosionScale, this.explosionScale));
        let explosion_material = this.materials.explosion;
        this.shape.draw(context, program_state, explosion_transform, explosion_material);
      } else {
        return false;
      }
    }
    return true;
  }

  triggerExplosion() {
    this.active = false;
    this.exploding = true;
    this.owner.bombActive = false;

    // remove blocks within radius
    this.updateCollisionMap();
    this.updateTanks();
  }

  // returns new collision map without exploded blocks
  updateCollisionMap() {
    let position = vec3(this.x, 1, this.z);
    let newCollisionMap = [];

    for (let elem of this.map.collisionMap) {
      if (elem.type === MAP_SCHEMATIC_ENUM.CORK) {

        const bombMin = position.minus(vec3(BOMB_WIDTH, BOMB_HEIGHT, BOMB_DEPTH));
        const bombMax = position.plus(vec3(BOMB_WIDTH + BOMB_RADIUS, BOMB_HEIGHT + BOMB_RADIUS, BOMB_DEPTH + BOMB_RADIUS));

        const elemMin = elem.position.minus(vec3(elem.size, elem.size, elem.size));
        const elemMax = elem.position.plus(vec3(elem.size, elem.size, elem.size));

        const xOverlap = bombMin[0] <= elemMax[0] && bombMax[0] >= elemMin[0];
        const yOverlap = bombMin[1] <= elemMax[1] && bombMax[1] >= elemMin[1];
        const zOverlap = bombMin[2] <= elemMax[2] && bombMax[2] >= elemMin[2];

        if (!(xOverlap && yOverlap && zOverlap)) {
          newCollisionMap.push(elem); // no overlap
        }
      } else {
        newCollisionMap.push(elem); // push everything other than corks
      }
    }

    this.map.collisionMap = newCollisionMap;
  }

  updateTanks() {
    let position = vec3(this.x, 1, this.z);
    let tanks = [this.map.user, ...this.map.enemies];
    // let newEnemies = [];

    for (let tank of tanks) {
      const bombMin = position.minus(vec3(BOMB_RADIUS, BOMB_RADIUS, BOMB_RADIUS));
      const bombMax = position.plus(vec3(BOMB_RADIUS, BOMB_RADIUS, BOMB_RADIUS));

      let tankPosition = vec3(tank.x, 0, tank.z);
      const tankMin = tankPosition.minus(vec3(TANK_WIDTH / 2, TANK_HEIGHT / 2, TANK_DEPTH / 2));
      const tankMax = tankPosition.plus(vec3(TANK_WIDTH / 2, TANK_HEIGHT / 2, TANK_DEPTH / 2));

      const xOverlap = bombMin[0] <= tankMin[0] && bombMax[0] >= tankMax[0];
      const yOverlap = bombMin[1] <= tankMin[1] && bombMax[1] >= tankMax[1];
      const zOverlap = bombMin[2] <= tankMin[2] && bombMax[2] >= tankMax[2];

      if ((xOverlap && yOverlap && zOverlap)) {
        tank.dead = true;
        if (tank.type === TANK_TYPE_ENUM.USER) {
          console.log("user died :((")
          // TODO: reduce user lives, handle game loop
        } else {
          console.log("enemy died")
        }
      }
    }

    // this.map.enemies = newEnemies;
  }
}

export { Bomb, BOMB_WIDTH, BOMB_HEIGHT, BOMB_DEPTH };