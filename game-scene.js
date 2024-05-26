import { defs, tiny, Subdivision_Sphere } from './examples/common.js';
import { Map } from './components/map.js';
import { Tank, TANK_TYPE_ENUM } from './components/tank.js';
import { Bullet } from './components/bullet.js';
import { schematics } from './components/map_schematics.js';
import { Text_Line } from './examples/text-demo.js';

const {
    vec, vec3, vec4, color, hex_color, Mat4, Light, Material, Scene, Texture,
} = tiny;

const INITIAL_USER_X = -10;
const INITIAL_USER_Z = -10;
const INITIAL_USER_ANGLE = Math.PI / 2;
const INITIAL_CURSOR_X = -10;
const INITIAL_CURSOR_Z = -10;
const MAX_LEVELS = schematics.length;
const TANK_SPEED = 0.15;

const TITLE_STATE = 0;
const LEVEL_INFO_STATE = 1;
const LEVEL_START_STATE = 2;
const LEVEL_STATE = 3;
const LEVEL_CLEARED_STATE = 4;
const PAUSED_STATE = 5;
const LOSE_STATE = 6;
const WIN_STATE = 7;
const DEV_STATE = 8;

// durations in seconds
const TITLE_STATE_DURATION = 4000;
const LEVEL_INFO_STATE_DURATION = 4000;
const LEVEL_START_STATE_DURATION = 3000;
const LEVEL_CLEARED_STATE_DURATION = 3000;
const BACKGROUND_SPEED = 1.5;

export class GameScene extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.initialized = false;
        this.state = DEV_STATE; // TODO: change this to TITLE_STATE for production
        this.continue = false;
        this.stateStart = 0;
        this.startOpacity = 1;
        this.startScale = 1;
        this.textTransform = Mat4.rotation(-Math.PI / 2, 1, 0, 0)
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-1.5, 1.5, 1.5));
        this.subtextTransform = Mat4.rotation(-Math.PI / 2, 1, 0, 0)
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-1, 1, 1));
        this.bannerRedTransform = Mat4.translation(-5, 1, 15)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-60, 10, 1));
        this.bannerPlainTransform = Mat4.translation(-5, 1.1, 15)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-60, 6, 1));
        this.backgroundTransform = Mat4.translation(12, 0.9, 16)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-40, 20, 20));

        // map
        this.map = new Map();
        this.level = 0;

        // player movement
        this.user = new Tank(INITIAL_USER_X, INITIAL_USER_Z, INITIAL_USER_ANGLE, TANK_TYPE_ENUM.USER, this.map);
        this.direction = {
            up: false,
            down: false,
            right: false,
            left: false
        }
        this.map.user = this.user;

        // cursor
        this.cursor_x = INITIAL_CURSOR_X;
        this.cursor_z = INITIAL_CURSOR_Z;

        // shapes
        this.shapes = {
            square: new defs.Square(),
            ammo: new Subdivision_Sphere(4),
            bullet: new Subdivision_Sphere(4),
            sphere: new Subdivision_Sphere(1),
            text: new Text_Line(35)
        };

        // materials
        this.materials = {
            plastic: new Material(new defs.Phong_Shader(),
                { ambient: .4, diffusivity: .6, color: hex_color("#ffffff") }),
            cursor: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/cursor.png")
            }),
            ammo: new Material(new defs.Phong_Shader(), {
                ambient: .4, diffusivity: .6, color: hex_color("#ffffff")
            }),
            bulletMaterial: new Material(new defs.Phong_Shader(), {
                ambient: .4, diffusivity: .6, color: hex_color("#ffffff")
            }),
            smoke: new Material(new defs.Phong_Shader(), {
                ambient: .4, diffusivity: .6, color: hex_color("#d2d0d0"), specularity: 0.1
            }),
            banner_red: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/banner_red.png")
            }),
            banner_plain: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/banner_plain.png")
            }),
            text_image: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),
            background: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/background.png")
            }),
        };
    }

    make_control_panel() {
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Move Up", ["w"], () => { this.direction.up = true },
            "#6E6460", () => { this.direction.up = false });
        this.new_line();
        this.key_triggered_button("Move Down", ["s"], () => { this.direction.down = true },
            "#6E6460", () => { this.direction.down = false });
        this.new_line();
        this.key_triggered_button("Move Left", ["a"], () => { this.direction.left = true },
            "#6E6460", () => { this.direction.left = false });
        this.new_line();
        this.key_triggered_button("Move Right", ["d"], () => { this.direction.right = true },
            "#6E6460", () => { this.direction.right = false });
        this.new_line();
        this.key_triggered_button("Place Bomb", ["e"], () => this.handleBomb(),
            "#6E6460", () => { this.direction.right = false });
        this.new_line();
        this.key_triggered_button("Toggle Dev Mode", ["l"], () => {
            if (this.state === DEV_STATE) {
                this.state = TITLE_STATE;
            } else {
                this.state = DEV_STATE;
                this.map.initializeLevel(0);
            }
        },
            "#6E6460", () => { this.direction.right = false });
        this.new_line();
    }

    // convert screen space position to world space position
    convertSStoWS(pos, program_state) {
        // 1. transform mouse position from screen space to normalized device coordinates (ndc)
        let pos_ndc_near = vec4(pos[0], pos[1], -1.0, 1.0);
        let pos_ndc_far = vec4(pos[0], pos[1], 1.0, 1.0);

        // 2. transform ndc position to world space
        let P = program_state.projection_transform;
        let V = program_state.camera_inverse;
        let matrix = Mat4.inverse(P.times(V));
        let pos_world_near = matrix.times(pos_ndc_near);
        let pos_world_far = matrix.times(pos_ndc_far);
        pos_world_near.scale_by(1 / pos_world_near[3]);
        pos_world_far.scale_by(1 / pos_world_far[3]);

        // 3. find intersection with the given plane (y = yWS)
        let t_ground = -pos_world_near[1] / (pos_world_far[1] - pos_world_near[1]);
        let t_cursor = (1.1 - pos_world_near[1]) / (pos_world_far[1] - pos_world_near[1]);
        let pos_world_ground = pos_world_near.plus(pos_world_far.minus(pos_world_near).times(t_ground));
        let pos_world_cursor = pos_world_near.plus(pos_world_far.minus(pos_world_near).times(t_cursor));

        return [pos_world_ground, pos_world_cursor];
    }

    getMousePosition(e, rect) {
        return vec((e.clientX - (rect.left + rect.right) / 2) / ((rect.right - rect.left) / 2),
            (e.clientY - (rect.bottom + rect.top) / 2) / ((rect.top - rect.bottom) / 2));
    }

    handleMouseMove(e, program_state, rect) {
        e.preventDefault();

        // get world space position
        let [pos_world_ground, pos_world_cursor] = this.convertSStoWS(this.getMousePosition(e, rect), program_state);

        // calculate the angle between user position and mouse position and update rotation
        let [user_x, user_z] = this.user.getPosition()
        let angle = Math.atan2(pos_world_ground[0] - user_x, pos_world_ground[2] - user_z);
        this.user.angle = angle;

        // update cursor position
        this.cursor_x = pos_world_cursor[0]
        this.cursor_z = pos_world_cursor[2]
    }

    handleMouseDown(e, program_state, rect) {
        e.preventDefault();

        if ((this.state === LEVEL_STATE || this.state === DEV_STATE) && !this.user.dead) {
            if (this.user.clip <= 0) {
                return;
            }

            // get world space position
            let [user_x, user_z] = this.user.getPosition()
            let [pos_world_ground, pos_world_cursor] = this.convertSStoWS(this.getMousePosition(e, rect), program_state, 0);
            let angle = Math.atan2(pos_world_ground[0] - user_x, pos_world_ground[2] - user_z)

            // add bullet to animation queue
            let bullet = new Bullet(
                user_x,
                user_z,
                angle,
                this.shapes,
                this.materials,
                this.map
            )
            this.map.bullet_queue.push(bullet);
            this.user.clip--
        } else if (this.state === LOSE_STATE) {
            this.continue = true;
        }
    }

    handleBomb() {
        if ((this.state === LEVEL_STATE || this.state === DEV_STATE) && !this.user.dead) {
            this.user.placeBomb()
        }
    }

    renderAmmoIndicator(context, program_state) {
        const bullet_spacing = 1.3;
        const start_x = -2;
        const start_z = 29.5;

        for (let i = 0; i < this.user.clip; i++) {
            let bullet_transform = Mat4.identity()
                .times(Mat4.translation(start_x + i * bullet_spacing, 5, start_z)) // Position bullets in front of the camera
                .times(Mat4.scale(0.45, 0.45, 0.45)); // Adjust bullet size
            this.shapes.ammo.draw(context, program_state, bullet_transform, this.materials.ammo);
        }
    }

    moveUser() {
        let [new_x, new_z] = this.user.getPosition();
        if (this.direction.up) {
            new_z -= TANK_SPEED;
        }
        if (this.direction.down) {
            new_z += TANK_SPEED;
        }
        if (this.direction.right) {
            new_x += TANK_SPEED;
        }
        if (this.direction.left) {
            new_x -= TANK_SPEED;
        }
        this.user.updatePosition(new_x, new_z, this.direction);
    }

    display(context, program_state) {
        // ** Setup ** This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!this.initialized) {
            // flag initialized
            this.initialized = true;

            // initialize global camera and projection matrices
            program_state.set_camera(Mat4.translation(-19, 15, -44).times(Mat4.rotation(Math.PI / (2.5), 1, 0, 0)));

            // initialize event listeners
            let canvas = context.canvas;
            canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e, program_state, canvas.getBoundingClientRect())); // rotate tank towards mouse
            canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e, program_state, canvas.getBoundingClientRect())); // shoot bullets

            // remove default cursor
            canvas.style.cursor = "none";

            if (this.state === DEV_STATE) {
                this.map.initializeLevel(0)
            }
        }

        // ** Render ** display all set perspective, lights, and models in the scene
        const t = program_state.animation_time;
        const dt = program_state.animation_delta_time / 1000;

        // perspective
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // lights
        const light_position = vec4(16, 20, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // user cursor
        let cursor_transform = Mat4.identity().times(Mat4.translation(this.cursor_x, 1.3, this.cursor_z))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.square.draw(context, program_state, cursor_transform, this.materials.cursor);

        // ** Game Loop **
        if (this.state === TITLE_STATE) {
            let text_transform = Mat4.translation(14, 1.1, 16).times(this.textTransform)
            this.shapes.text.set_string("Tanks!", context.context);
            this.shapes.text.draw(context, program_state, text_transform, this.materials.text_image);
            this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
            this.displayBackground(context, program_state);

            if (t - this.stateStart >= TITLE_STATE_DURATION) {
                console.log("title state --> info state level " + this.level)
                this.level = 1;
                this.state = LEVEL_INFO_STATE;
                this.stateStart = t;
            }
        } else if (this.state === LEVEL_INFO_STATE) {
            let model_transform = Mat4.translation(12, 1.1, 16).times(this.textTransform)
            this.shapes.text.set_string(`Level ${this.level}`, context.context);
            this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);
            this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
            this.displayBackground(context, program_state);

            if (t - this.stateStart >= LEVEL_INFO_STATE_DURATION) {
                console.log(`info for level ${this.level} --> starting level ${this.level}`)
                this.map.initializeLevel(this.level);
                this.state = LEVEL_START_STATE;
                this.stateStart = t;
            }
        } else if (this.state === LEVEL_START_STATE) {
            this.map.render(context, program_state);
            this.user.render(context, program_state);
            this.renderAmmoIndicator(context, program_state);

            if (t - this.stateStart >= LEVEL_START_STATE_DURATION) {
                console.log(`starting level ${this.level} --> level ${this.level}`)
                this.state = LEVEL_STATE;
                this.stateStart = t;
            }
        } else if (this.state === LEVEL_STATE) {
            if (t <= this.stateStart + 1000) {
                this.startOpacity -= dt;
                let model_transform = Mat4.translation(14, 1.1, 16).times(this.textTransform);
                this.shapes.text.set_string(`Start!`, context.context);
                this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);
            }

            if (!this.user.dead) {
                this.moveUser()
                this.map.render(context, program_state);
                this.user.render(context, program_state);
                this.renderAmmoIndicator(context, program_state);

                // if all enemies are dead, continue to the next level
                let nextLevel = true;
                for (let enemy of this.map.enemies) {
                    if (enemy.dead) {
                        nextLevel = nextLevel & true;
                    } else {
                        nextLevel = nextLevel & false;
                    }
                }

                if (nextLevel) {
                    console.log(`level ${this.level} --> cleared level ${this.level}`)
                    this.level += 1;
                    this.state = LEVEL_CLEARED_STATE;
                    this.stateStart = t;
                }
            } else {
                console.log(`level ${this.level} --> lose`)
                this.state = LOSE_STATE;
                this.stateStart = t;
            }
        } else if (this.state === LEVEL_CLEARED_STATE) {
            let model_transform = Mat4.translation(5, 1.2, 15).times(this.textTransform)
            this.shapes.text.set_string(`Level Cleared!`, context.context);
            this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);
            this.shapes.square.draw(context, program_state, this.bannerPlainTransform, this.materials.banner_plain);

            this.moveUser()
            this.map.render(context, program_state);
            this.user.render(context, program_state);
            this.renderAmmoIndicator(context, program_state);

            if (t - this.stateStart >= LEVEL_CLEARED_STATE_DURATION) {
                if (this.level >= MAX_LEVELS) {
                    console.log(`cleared level ${this.level} --> win`)
                    this.state = WIN_STATE;
                    this.stateStart = t;
                } else {
                    console.log(`cleared level ${this.level} --> starting level ${this.level}`)
                    this.map.initializeLevel(this.level);
                    this.state = LEVEL_START_STATE;
                    this.stateStart = t;
                }
            }
        } else if (this.state === LOSE_STATE) {
            let model_transform1 = Mat4.translation(4, 1.2, 13).times(this.textTransform)
            this.shapes.text.set_string(`Mission Failed`, context.context);
            this.shapes.text.draw(context, program_state, model_transform1, this.materials.text_image);

            let model_transform2 = Mat4.translation(1, 1.2, 17).times(this.subtextTransform)
            this.shapes.text.set_string(`Click anywhere to restart`, context.context);
            this.shapes.text.draw(context, program_state, model_transform2, this.materials.text_image);

            this.shapes.square.draw(context, program_state, this.bannerPlainTransform, this.materials.banner_plain);

            this.map.render(context, program_state);
            this.user.render(context, program_state);
            this.renderAmmoIndicator(context, program_state);

            if (this.continue) {
                this.level = 1;
                this.state = LEVEL_INFO_STATE;
                this.stateStart = t;
            }
        } else if (this.state === WIN_STATE) {
            let model_transform = Mat4.translation(12, 1.2, 13).times(this.textTransform)
            this.shapes.text.set_string(`You Win!`, context.context);
            this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);

            let model_transform2 = Mat4.translation(7, 1.2, 17).times(this.subtextTransform)
            this.shapes.text.set_string(`Thanks for playing`, context.context);
            this.shapes.text.draw(context, program_state, model_transform2, this.materials.text_image);

            this.shapes.square.draw(context, program_state, this.bannerPlainTransform, this.materials.banner_red);
            this.displayBackground(context, program_state);
        } else if (this.state === DEV_STATE) {
            if (!this.user.dead) {
                this.moveUser();
            }
            this.map.render(context, program_state);
            this.user.render(context, program_state);
            this.renderAmmoIndicator(context, program_state);
            this.stateStart = t;
        }
    }

    displayBackground(context, program_state) {
        const t = program_state.animation_time / 1000;  // Convert to seconds

        const translate_x = (t * BACKGROUND_SPEED) % 5;  // Wrap around using modulus
        const translate_z = -(t * BACKGROUND_SPEED) % 5;  // Wrap around using modulus

        let background_transform = Mat4.translation(translate_x, 0, translate_z).times(this.backgroundTransform)
        this.shapes.square.draw(context, program_state, background_transform, this.materials.background);
    }
}


