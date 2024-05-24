import {Cube, defs, tiny} from "../examples/common.js";
import {schematics} from "./map_schematics.js";

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene, Texture
} = tiny;

const { Textured_Phong } = defs;

const BLOCK_SIZE = 2;
const LEVEL_WIDTH = 20;
const LEVEL_HEIGHT = 16;

export class Map {
    constructor() {

        this.shapes = {
            block: new Cube(),
            background: new defs.Square()
        };

        // *** Materials
        this.materials = {
            // block: new Material(new defs.Phong_Shader(),
            //     {ambient: .4, diffusivity: .8, specularity: 0.1, color: hex_color("#e1cb8d")}),
            block1: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: hex_color("#D9AD89"),
                texture: new Texture("assets/wood1.jpg")
            }),
            block2: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: hex_color("#D9AD89"),
                texture: new Texture("assets/wood2.jpg")
            }),
            block3: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: hex_color("#D9AD89"),
                texture: new Texture("assets/wood3.jpg")
            }),
            block4: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: hex_color("#D9AD89"),
                texture: new Texture("assets/wood4.jpg")
            }),
            block5: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: hex_color("#D9AD89"),
                texture: new Texture("assets/wood5.jpg")
            }),
            block6: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: hex_color("#D9AD89"),
                texture: new Texture("assets/wood6.jpg")
            })
        };

        this.backgroundMaterial = new Material(new Textured_Phong(), {
            ambient: .4, diffusivity: .8, specularity: 0.1,
            color: hex_color("#D9AD89"),
            texture: new Texture("assets/map_background.jpg")
        })

        this.blockMaterials = [];
        this.blocks = []; // Add this line
        this.initializeBlockMaterials()
    }

    initializeBlockMaterials() {
        for (let i = 0; i < LEVEL_HEIGHT; i++) {
            this.blockMaterials[i] = [];
            for (let j = 0; j < LEVEL_WIDTH; j++) {
                const materials = Object.values(this.materials);
                let index = Math.floor(Math.random() * materials.length);
                this.blockMaterials[i][j] = materials[index];
            }
        }
    }

    renderLevel(context, program_state, level_num) {
        let model_transform = Mat4.identity()

        let level = schematics[level_num];

        // remove all whitespace/newlines
        level = level.replace(/\D/g, "");

        model_transform = Mat4.identity()

        // draw background
        let background_transform = model_transform.times(Mat4.translation(16, -1, 15))
                                                  .times(Mat4.rotation(-Math.PI/2, 1, 0, 0))
                                                  .times(Mat4.scale(50, 30, 1))
        this.shapes.background.draw(context, program_state, background_transform, this.backgroundMaterial)

        // draw blocks
        for (let i = 0; i < LEVEL_HEIGHT; i++) {
            for (let j = 0; j < LEVEL_WIDTH; j++) {
                let curr_index = i * LEVEL_WIDTH + j;

                // if current character is a BLOCK
                if (level[curr_index] === '1') {
                    let block_position = model_transform.times(vec4(0, 0, 0, 1));
                    this.blocks.push({position: block_position.to3(), size: BLOCK_SIZE});
                    this.shapes.block.draw(context, program_state, model_transform, this.blockMaterials[i][j]);
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