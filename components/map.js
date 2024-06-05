import { Cube, defs, tiny } from "../examples/common.js";
import { schematics } from "./map_schematics.js";
import { Tank, TANK_TYPE_ENUM } from "./tank.js";

const { vec4, hex_color, Mat4, Material, Texture } = tiny;

const { Textured_Phong } = defs;

const BLOCK_SIZE = 2;
const LEVEL_WIDTH = 20;
const LEVEL_HEIGHT = 16;

const MAP_SCHEMATIC_ENUM = {
    EMPTY: '0',
    BLOCK: '1',
    CORK: '2',
    HOLE: '3',
    USER: '*',
    ENEMY_STATIONARY: 's',
    ENEMY_MOVING: 'm',
    ENEMY_MOVING_BOMB: 'b',
    ENEMY_MOVING_FAST_SHOOTING: 'f'
}

const BLOCK_COLOR = hex_color("#D9AD89");
const CORK_COLOR = hex_color("#BC8953");

class Map {
    constructor(state) {
        this.collisionMap = [];
        this.enemies = [];
        this.userPosition = Mat4.identity();
        this.user = null;
        this.level = 0;
        this.bullet_queue = [];
        this.bomb_queue = [];
        this.state = state;

        this.shapes = {
            block: new Cube(),
            square: new defs.Square(),
        };

        this.materials = {
            block: [],
            cork: new Material(new Textured_Phong(), {
                ambient: .35, diffusivity: .8, specularity: 0.1,
                color: CORK_COLOR,
                texture: new Texture("assets/cork.jpg")
            }),
            background: new Material(new Textured_Phong(), {
                ambient: .4, diffusivity: .8, specularity: 0.1,
                color: BLOCK_COLOR,
                texture: new Texture("assets/map_background.jpg")
            }),
            hole: new Material(new Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/hole.png")
            })
        }
        this.files = [
            "assets/block1.jpg",
            "assets/block2.jpg",
            "assets/block3.jpg",
            "assets/block4.jpg",
            "assets/block5.jpg",
            "assets/block6.jpg"
        ];
        for (let file of this.files) {
            this.materials.block.push(
                new Material(new Textured_Phong(), {
                    ambient: .35, diffusivity: .8, specularity: 0.1,
                    color: BLOCK_COLOR,
                    texture: new Texture(file)
                })
            );
        }
    }

    initializeLevel(level) {
        // reset member variables
        this.collisionMap = [];
        this.enemies = [];
        this.bomb_queue = []
        this.bullet_queue = []
        this.user.dead = false;

        // parse schematic
        this.level = level;
        let schematic = schematics[this.level].replace(/\s/g, ""); // remove all whitespace/newlines
        let model_transform = Mat4.identity()

        for (let i = 0; i < LEVEL_HEIGHT; i++) {
            for (let j = 0; j < LEVEL_WIDTH; j++) {
                let curr_index = i * LEVEL_WIDTH + j;
                let x = j * BLOCK_SIZE; // j corresponds to x in WS
                let z = i * BLOCK_SIZE; // i corresponse to z in WS

                if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.BLOCK) {
                    // if current character is a BLOCK
                    let block_position = model_transform.times(vec4(0, 0, 0, 1));
                    this.collisionMap.push({
                        position: block_position.to3(),
                        model_transform: model_transform,
                        size: BLOCK_SIZE,
                        type: MAP_SCHEMATIC_ENUM.BLOCK,
                        material: this.getRandomBlockMaterial()
                    });
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.CORK) {
                    // if current character is a CORK
                    let cork_position = model_transform.times(vec4(0, 0, 0, 1));
                    this.collisionMap.push({
                        position: cork_position.to3(),
                        model_transform: model_transform,
                        size: BLOCK_SIZE,
                        type: MAP_SCHEMATIC_ENUM.CORK,
                        material: this.materials.cork
                    });
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.HOLE) {
                    // if current character is a HOLE
                    let hole_position = model_transform.times(vec4(0, 0, 0, 1))
                    let hole_model_transform = model_transform.times(Mat4.translation(0, -0.9, 0))
                        .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
                    this.collisionMap.push({
                        position: hole_position.to3(),
                        model_transform: hole_model_transform,
                        size: BLOCK_SIZE,
                        type: MAP_SCHEMATIC_ENUM.HOLE,
                        material: this.materials.hole
                    });
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.USER) {
                    // if current character is an USER
                    this.userPosition = vec4(x, 0, z, 1);
                    this.user.updatePosition(x, z);
                    this.user.angle = Math.PI / 2;
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.ENEMY_STATIONARY) {
                    // if current character is an ENEMY_STATIONARY
                    let enemy = new Tank(x, z, Math.PI / 2, TANK_TYPE_ENUM.ENEMY_STATIONARY, this);
                    enemy.angle = -Math.PI / 2;
                    this.enemies.push(enemy);
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.ENEMY_MOVING) {
                    // if current character is an ENEMY_MOVING
                    let enemy = new Tank(x, z, Math.PI / 2, TANK_TYPE_ENUM.ENEMY_MOVING, this);
                    enemy.angle = -Math.PI / 2;
                    this.enemies.push(enemy);
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.ENEMY_MOVING_BOMB) {
                    // if current character is an ENEMY_MOVING_BOMB
                    let enemy = new Tank(x, z, Math.PI / 2, TANK_TYPE_ENUM.ENEMY_MOVING_BOMB, this);
                    enemy.angle = -Math.PI / 2;
                    this.enemies.push(enemy);
                } else if (schematic[curr_index] === MAP_SCHEMATIC_ENUM.ENEMY_MOVING_FAST_SHOOTING) {
                    // if current character is an ENEMY_MOVING_FAST_SHOOTING
                    let enemy = new Tank(x, z, Math.PI / 2, TANK_TYPE_ENUM.ENEMY_MOVING_FAST_SHOOTING, this);
                    enemy.angle = -Math.PI / 2;
                    this.enemies.push(enemy);
                } else if (schematic[curr_index] !== MAP_SCHEMATIC_ENUM.EMPTY) {
                    // immediately error and stop the program
                    throw `Invalid schematic: found unknown character ${schematic[curr_index]}`;
                }

                model_transform = Mat4.translation(BLOCK_SIZE, 0, 0).times(model_transform); // next cell in row
            }
            model_transform = Mat4.translation(0, 0, BLOCK_SIZE * i); // next row
        }
    }

    getRandomBlockMaterial() {
        let index = Math.floor(Math.random() * this.materials.block.length);
        return this.materials.block[index];
    }

    render(context, program_state) {
        const dt = program_state.animation_delta_time / 1000;
        // draw background
        let background_transform = Mat4.identity().times(Mat4.translation(16, -1, 15))
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.scale(40, 20, 1))
        this.shapes.square.draw(context, program_state, background_transform, this.materials.background)

        //  draw elements
        for (let elem of this.collisionMap) {
            if (elem.type === MAP_SCHEMATIC_ENUM.BLOCK) {
                this.shapes.block.draw(context, program_state, elem.model_transform, elem.material);
            } else if (elem.type === MAP_SCHEMATIC_ENUM.CORK) {
                this.shapes.block.draw(context, program_state, elem.model_transform, elem.material);
            } else if (elem.type === MAP_SCHEMATIC_ENUM.HOLE) {
                this.shapes.square.draw(context, program_state, elem.model_transform, elem.material);
            }
        }

        // draw enemies
        for (let enemy of this.enemies) {
            enemy.render(context, program_state);
        }

        // draw bullets
        for (let i = this.bullet_queue.length - 1; i >= 0; i--) {
            const bullet = this.bullet_queue[i];
            const stillExists = bullet.updateAndCheckExistence(dt);

            bullet.renderBullet(context, program_state);
            bullet.renderSmoke(context, program_state);

            if (!stillExists) {
                this.bullet_queue.splice(i, 1); // Remove the bullet from the array
            }
        }

        // draw bombs
        if (this.bomb_queue.length > 0) {
            for (let i = this.bomb_queue.length - 1; i >= 0; i--) {
                let result = this.bomb_queue[i].render(context, program_state);
                if (!result) {
                    delete this.bomb_queue[i]; // cleanup bomb
                    this.bomb_queue.splice(i, 1);
                }
            }
        }
    }
}

export { Map, MAP_SCHEMATIC_ENUM }