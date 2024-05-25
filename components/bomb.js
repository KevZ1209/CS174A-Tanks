import { Subdivision_Sphere, defs, tiny } from '../examples/common.js';
import { MAP_SCHEMATIC_ENUM } from './map.js';

const { vec3, hex_color, Mat4, Material } = tiny;

const BOMB_COLOR = hex_color("#DBC63A");
const BOMB_LIFETIME = 5; // 5 seconds
const BOMB_RADIUS = 4;
const BOMB_WIDTH = 1;
const BOMB_HEIGHT = 1;
const BOMB_DEPTH = 1;

export class Bomb {
  constructor(map) {
    this.x = -10;
    this.z = -10;
    this.lifetime = BOMB_LIFETIME;
    this.age = 0;
    this.active = false;
    this.map = map

    this.material = new Material(new defs.Phong_Shader(),
      { ambient: .5, diffusivity: .6, specularity: 1, color: BOMB_COLOR });
    this.shape = new Subdivision_Sphere(4);
  }

  render(context, program_state) {
    if (this.active) {
      const dt = program_state.animation_delta_time / 1000;
      this.age += dt;

      if (this.age >= this.lifetime) {
        // bomb exploded
        console.log("BOOM!!!!");
        this.active = false;

        // remove blocks within radius
        let newCollisionMap = this.explode();
        this.map.updateCollisionMap(newCollisionMap);
      } else {
        // bomb timer running
        this.shape.draw(context, program_state, Mat4.translation(this.x, -1, this.z), this.material);
      }
    }
  }

  placeBomb(x, z) {
    if (!this.active) {
      this.x = x;
      this.z = z;
      this.age = 0;
      this.active = true;
    }
  }

  // returns new collision map without exploded blocks
  explode() {
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

    return newCollisionMap;
  }
}