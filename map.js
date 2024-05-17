import {defs, tiny, Cube} from './examples/common.js';
import { schematics } from './map_schematics.js'

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

class Base_Scene extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();
        this.hover = this.swarm = false;

        // At the beginning of our program, load one of each of these shape definitions onto the GPU.
        this.shapes = {
            'block': new Cube(),
        };

        // *** Materials
        this.materials = {
            block: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .8, specularity: 0.1, color: hex_color("#e1cb8d")}),
        };
    }

    display(context, program_state) {
        // display():  Called once per frame of animation. Here, the base class's display only does
        // some initial setup.
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // Define the global camera and projection matrices, which are stored in program_state.
            let camera_position = Mat4.translation
            program_state.set_camera(Mat4.translation(-18, 15, -44).times(Mat4.rotation(Math.PI/3, 1, 0, 0)));
        }
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // *** Lights: *** Values of vector or point lights.
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];
    }
}

export class Map extends Base_Scene {
    /**
     * This Scene object can be added to any display canvas.
     * We isolate that code so it can be experimented with on its own.
     * This gives you a very small code sandbox for editing a simple scene, and for
     * experimenting with matrix transformations.
     */

    make_control_panel() {

    }


    display(context, program_state) {
        super.display(context, program_state)
        const BLOCK_SIZE = 2;
        const LEVEL_WIDTH = 20;
        const LEVEL_HEIGHT = 16;
        let model_transform = Mat4.identity()

        // Get 1st level
        let level = schematics[1];

        // remove all whitespace/newlines
        level = level.replace(/\D/g, "");

        model_transform = Mat4.translation(0, -BLOCK_SIZE, 0);
        for (let i = 0; i < LEVEL_HEIGHT; i++) {
            for (let j = 0; j < LEVEL_WIDTH; j++) {
                this.shapes.block.draw(context, program_state, model_transform, this.materials.block);
                model_transform = Mat4.translation(BLOCK_SIZE, 0, 0).times(model_transform);
            }
            model_transform = Mat4.translation(0, -BLOCK_SIZE, BLOCK_SIZE * i);
        }

        model_transform = Mat4.identity()

        for (let i = 0; i < LEVEL_HEIGHT; i++) {
            for (let j = 0; j < LEVEL_WIDTH; j++) {
                let curr_index = i*LEVEL_WIDTH + j;

                // if current character is a BLOCK
                if (level[curr_index] === '1') {
                    this.shapes.block.draw(context, program_state, model_transform, this.materials.block);
                    model_transform = Mat4.translation(BLOCK_SIZE, 0, 0).times(model_transform);
                }

                // if current character is BLANK SPACE
                else if (level[curr_index] === '0') {
                    model_transform = Mat4.translation(BLOCK_SIZE, 0, 0).times(model_transform);
                }


            }

            model_transform = Mat4.translation(0, 0, BLOCK_SIZE * i);
        }
    }
}