import { defs, tiny } from '../examples/common.js';
import { Shape_From_File } from '../examples/obj-file-demo.js';

const { vec3, hex_color, Mat4, Material } = tiny;

export class Tank {
  constructor(initial_x, initial_z, initial_rotation, color) {
    // movement controls
    this.x = initial_x;
    this.z = initial_z;
    this.rotation = initial_rotation
    this.hide = false;

    // material and shape
    this.material = new Material(new defs.Phong_Shader(),
      {ambient: .4, diffusivity: .6, color: hex_color(color)}
    )
    this.shape = new Shape_From_File("assets/tank.obj");
  }

  render(context, program_state) {
    if (!this.hide) {
      let model_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
                                           .times(this.rotation);
      this.shape.draw(context, program_state, model_transform, this.material);
    }
  }

  updatePosition(collisionMap, direction, new_x, new_z) {
    // Update X position
    let potential_new_x = new_x;
    if (direction.right && !this.checkCollision(collisionMap, potential_new_x, this.z)) {
        this.x = potential_new_x;
    } else if (direction.left && !this.checkCollision(collisionMap, potential_new_x, this.z)) {
        this.x = potential_new_x;
    }

    // Update Z position
    let potential_new_z = new_z;
    if (direction.up && !this.checkCollision(collisionMap, this.x, potential_new_z)) {
        this.z = potential_new_z;
    } else if (direction.down && !this.checkCollision(collisionMap, this.x, potential_new_z)) {
        this.z = potential_new_z;
    }
  }

  checkCollision(collisionMap, potential_x, potential_z) {
    let position = vec3(potential_x, 0, potential_z);
    for (let elem of collisionMap) {
      const tankMin = position.minus(vec3(0.5, 0, 0.5)); // Assuming tank size is 1x1x1
      const tankMax = position.plus(vec3(0.5, 1, 0.5));  // Adjust based on tank size

      const elemMin = elem.position.minus(vec3(elem.size *.9, elem.size *.9, elem.size *.9));
      const elemMax = elem.position.plus(vec3(elem.size *.9, elem.size *.9, elem.size *.9));

      const xOverlap = tankMin[0] <= elemMax[0] && tankMax[0] >= elemMin[0];
      const yOverlap = tankMin[1] <= elemMax[1] && tankMax[1] >= elemMin[1];
      const zOverlap = tankMin[2] <= elemMax[2] && tankMax[2] >= elemMin[2];

      if (xOverlap && yOverlap && zOverlap) {
        return true; // Collision detected
      }
    }
    return false; // No collision
  }


  updateRotation(angle) {
    this.rotation = Mat4.rotation(angle, 0, 1, 0);
  }

  getPosition() {
    return [this.x, this.z];
  }

  hide() {
    this.hide = true;
  }

  show() {
    this.hide = false;
  }
}