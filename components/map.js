import {Cube, defs, tiny} from "../examples/common.js";
import {schematics} from "./map_schematics.js";

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class Map {
    constructor() {

        this.shapes = {
            'block': new Cube(),
        };

        // *** Materials
        this.materials = {
            block: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .8, specularity: 0.1, color: hex_color("#e1cb8d")}),
        };
    }

    renderLevel(context, program_state, level_num) {
        const BLOCK_SIZE = 2;
        const LEVEL_WIDTH = 20;
        const LEVEL_HEIGHT = 16;
        let model_transform = Mat4.identity()

        let level = schematics[level_num];

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
                let curr_index = i * LEVEL_WIDTH + j;

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