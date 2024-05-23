import {defs, tiny} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const NORTH = "NORTH";
const EAST = "EAST";
const SOUTH = "SOUTH";
const WEST = "WEST";

class Base_Scene extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        super();

        // gameplay
        this.paused = false;
        this.time = 0;

        // player movement
        this.user_x = 0;
        this.user_z = 0;
        this.user_direction = SOUTH;
        this.user_rotation = Mat4.rotation(0, 0, 1, 0); // initially facing south
        this.user_target_rotation = Mat4.identity();
        this.user_rotation_start_time = 0;
        this.user_rotation_end_time = 0;
        this.user_rotation_duration = 0.1; // Rotation duration in seconds
        this.user_rotating = false;

        // global positioning
        this.user_global_transform =  Mat4.identity();

        // shapes
        this.shapes = {
            'tank': new Shape_From_File("assets/tank.obj")
        };

        // materials
        this.materials = {
            plastic: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
        };
    }

    display(context, program_state) {
        // display():  Called once per frame of animation. Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            program_state.set_camera(Mat4.translation(5, -10, -30));
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // *** Lights: *** Values of vector or point lights.
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];
    }
}

export class tankTest extends Base_Scene {
    make_control_panel() {
        // Up Movement (arrow key up)
        this.key_triggered_button("Up", ['ArrowUp'], () => {
            if(!(this.paused)){
                this.user_z -= 1;
                this.initiateRotation(NORTH);
            }
        });
        // Down Movement (arrow key down)
        this.key_triggered_button("Down", ['ArrowDown'], () => {
            if(!(this.paused)){
                this.user_z += 1; 
                this.initiateRotation(SOUTH);
            }
        });
        
        // Left Movement (arrow key left)
        this.key_triggered_button("Left", ['ArrowLeft'], () => {
            if(!(this.paused)){
                this.user_x -= 1; 
                this.initiateRotation(WEST);
            }
        });

        // Right Movement (arrow key right)
        this.key_triggered_button("Right", ['ArrowRight'], () => {
            if(!(this.paused)){
                this.user_x += 1;
                this.initiateRotation(EAST);
            } 
        });
    }

    initiateRotation(direction) {
        const t = this.time;
        this.user_target_rotation = this.getUserRotation(direction);
        this.user_direction = direction;
        this.user_rotation_start_time = t;
        this.user_rotation_end_time = t + this.user_rotation_duration;
        this.user_rotating = true;
        // console.log("start time: ", this.user_rotation_start_time);
        // console.log("end time: ", this.user_rotation_end_time);
    }

    getUserRotation(direction) {
        let rotation_matrix = Mat4.identity();

        if (direction === NORTH) {
            if (this.user_direction === SOUTH) {
                rotation_matrix = Mat4.rotation(Math.PI, 0, 1, 0);
            } else if (this.user_direction === WEST) {
                rotation_matrix = Mat4.rotation(-Math.PI / 2, 0, 1, 0);
            } else if (this.user_direction === EAST) {
                rotation_matrix = Mat4.rotation(Math.PI / 2, 0, 1, 0);
            }
        } else if (direction === SOUTH) {
            if (this.user_direction === NORTH) {
                rotation_matrix = Mat4.rotation(Math.PI, 0, 1, 0);
            } else if (this.user_direction === WEST) {
                rotation_matrix = Mat4.rotation(Math.PI / 2, 0, 1, 0);
            } else if (this.user_direction === EAST) {
                rotation_matrix = Mat4.rotation(-Math.PI / 2, 0, 1, 0);
            }
        } else if (direction === WEST) {
            if (this.user_direction === EAST) {
                rotation_matrix = Mat4.rotation(Math.PI, 0, 1, 0);
            } else if (this.user_direction === NORTH) {
                rotation_matrix = Mat4.rotation(Math.PI / 2, 0, 1, 0);
            } else if (this.user_direction === SOUTH) {
                rotation_matrix = Mat4.rotation(-Math.PI / 2, 0, 1, 0);
            }
        } else if (direction === EAST) {
            if (this.user_direction === WEST) {
                rotation_matrix = Mat4.rotation(Math.PI, 0, 1, 0);
            } else if (this.user_direction === NORTH) {
                rotation_matrix = Mat4.rotation(-Math.PI / 2, 0, 1, 0);
            } else if (this.user_direction === SOUTH) {
                rotation_matrix = Mat4.rotation(Math.PI / 2, 0, 1, 0);
            }
        }

        return rotation_matrix.times(this.user_rotation);
    }

    // get next rotation transformation based on current animation time
    interpolateRotation(start_rotation, end_rotation, t, start_time, end_time) {
        const factor = (t - start_time) / (end_time - start_time);
        if (factor >= 1) return end_rotation;

        const interpolated_rotation = start_rotation.map((row, rowIndex) =>
            row.map((val, colIndex) => val + factor * (end_rotation[rowIndex][colIndex] - val))
        );

        return interpolated_rotation;
    }

    display(context, program_state) {
        super.display(context, program_state);
        const SCALE_AMT = 1.5
        let model_transform = Mat4.identity();
        const t = program_state.animation_time / 1000; // time in seconds
        this.time = t;

        // rotate user
        if (this.user_rotating) {
            if (t < this.user_rotation_end_time) {
                this.user_rotation = this.interpolateRotation(this.user_rotation, this.user_target_rotation, this.time, this.user_rotation_start_time, this.user_rotation_end_time);
            } else {
                this.user_rotation = this.user_target_rotation;
                this.user_rotating = false;
            }
        }

        // display user
        let user_transform = model_transform.times(Mat4.translation(this.user_x, 0, this.user_z))
                                            .times(this.user_rotation)
                                            .times(this.user_global_transform);
        this.shapes.tank.draw(context, program_state, user_transform, this.materials.plastic.override({color: hex_color("#6A9956")}));

    }
}