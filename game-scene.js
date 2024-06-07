import { defs, tiny, Subdivision_Sphere, Cube } from './examples/common.js';
import { Map } from './components/map.js';
import { Tank, TANK_TYPE_ENUM } from './components/tank.js';
import { schematics } from './components/map_schematics.js';
import { Text_Line } from './examples/text-demo.js';
import * as AUDIO from './components/audio.js';

const {
    vec, vec3, vec4, color, hex_color, Mat4, Light, Material, Scene, Texture,
} = tiny;

const INITIAL_USER_X = -10;
const INITIAL_USER_Z = -10;
const INITIAL_USER_ANGLE = Math.PI / 2;
const INITIAL_CURSOR_X = -10;
const INITIAL_CURSOR_Z = -10;
const MAX_LEVELS = schematics.length;
const TANK_SPEED = 5;
const INITIAL_LIVES = 3;

const GAME_STATE_ENUM = {
    TITLE_STATE: 0,
    LEVEL_INFO_STATE: 1,
    LEVEL_START_STATE: 2,
    LEVEL_STATE: 3,
    LEVEL_CLEARED_STATE: 4,
    LEVEL_FAILED_STATE: 5,
    EXTRA_LIFE_STATE: 6,
    LOSE_STATE: 7,
    WIN_STATE: 8,
    DEV_STATE: 9
}

// durations in seconds
const TITLE_STATE_DURATION = 4000;
const LEVEL_INFO_STATE_DURATION = 4000;
const LEVEL_START_STATE_DURATION = 3000;
const LEVEL_CLEARED_STATE_DURATION = 3000;
const LEVEL_FAILED_STATE_DURATION = 3000;
const LEVEL_DURATION = 45000;
const EXTRA_LIFE_STATE_DURATION = 3000;
const BACKGROUND_SPEED = 1.5;

class GameScene extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        this.initialized = false;
        this.startGame = false;
        this.state = GAME_STATE_ENUM.DEV_STATE; // TODO: change this to TITLE_STATE for production
        this.continue = false;
        this.stateStart = 0;
        this.levelTimeRemaining = 45;
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
        this.bannerPlainTransform = Mat4.translation(-5, 4.1, 15)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-60, 6, 1));
        this.backgroundTransform = Mat4.translation(12, 0.9, 16)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-40, 20, 20));
        this.bannerGreenTransform = Mat4.translation(-5, 1, 15)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-60, 10, 1));

        // map
        this.map = new Map(this.state);
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
        this.lives = INITIAL_LIVES;

        // cursor
        this.cursor_x = INITIAL_CURSOR_X;
        this.cursor_z = INITIAL_CURSOR_Z;

        this.lastShotTime = 0;
        this.shotCooldown = 100;
        this.haveUnlimitedBullets = false;
        this.hitboxOn = false;

        // shapes
        this.shapes = {
            square: new defs.Square(),
            ammo: new Subdivision_Sphere(4),
            text: new Text_Line(35),
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
            banner_red: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/banner_red.png")
            }),
            banner_plain: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/banner_plain.png")
            }),
            banner_green: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/banner_green.png")
            }),
            text_image: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/text.png")
            }),
            background: new Material(new defs.Textured_Phong(1), {
                ambient: 1, diffusivity: 0, specularity: 0,
                texture: new Texture("assets/background.png")
            })
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
            if (this.startGame) {
                if (this.state === GAME_STATE_ENUM.DEV_STATE) {
                    this.state = GAME_STATE_ENUM.TITLE_STATE;
                } else {
                    this.state = GAME_STATE_ENUM.DEV_STATE;
                    this.map.initializeLevel(0);
                }
                this.stopRestartMusic();
                AUDIO.THEME_MUSIC.play();
            }
            
        },
            "#6E6460", () => { this.direction.right = false });
        this.new_line();
        this.key_triggered_button("Unlimited Bullets", ["u"], () => {
            this.haveUnlimitedBullets = !this.haveUnlimitedBullets;
        },
            "#6E6460", () => { this.direction.right = false});
        this.new_line();
        this.key_triggered_button("Hitbox on", ["h"], () => {
                this.hitboxOn = !this.hitboxOn;
            },
            "#6E6460", () => { this.direction.right = false });
        this.key_triggered_button("Start Game", ["Enter"], () => {
                this.startGame = true;
                this.stopRestartMusic();
                AUDIO.THEME_MUSIC.play();
            },
            "#6E6460", () => { this.direction.right = false });
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
        let t_cursor = (4.3 - pos_world_near[1]) / (pos_world_far[1] - pos_world_near[1]);
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
        this.user.render_angle = angle;

        // update cursor position
        this.cursor_x = pos_world_cursor[0]
        this.cursor_z = pos_world_cursor[2]
    }

    handleMouseDown(e, program_state, rect) {
        e.preventDefault();
        const t = program_state.animation_time;

        if ((this.state === GAME_STATE_ENUM.LEVEL_STATE || this.state === GAME_STATE_ENUM.DEV_STATE) && !this.user.dead && (t - this.lastShotTime >= this.shotCooldown)) {
            if (this.user.clip <= 0) {
                return;
            }

            // get world space position
            let [user_x, user_z] = this.user.getPosition()
            let [pos_world_ground, pos_world_cursor] = this.convertSStoWS(this.getMousePosition(e, rect), program_state, 0);
            let angle = Math.atan2(pos_world_ground[0] - user_x, pos_world_ground[2] - user_z)

            this.user.shootBullet(user_x, user_z, angle, this.user.type.bullet_type, this.hitboxOn, this.haveUnlimitedBullets, true);
        } else if (this.state === GAME_STATE_ENUM.LOSE_STATE) {
            this.continue = true;
        }
        this.lastShotTime = t;
    }

    handleBomb() {
        if ((this.state === GAME_STATE_ENUM.LEVEL_STATE || this.state === GAME_STATE_ENUM.DEV_STATE) && !this.user.dead) {
            this.user.placeBomb()
        }
    }

    moveUser(dt) {
        let [new_x, new_z] = this.user.getPosition();

        // count how many trues there are. If >= 2, reduce speed by a factor of sqrt(2)
        const trueCount = Object.values(this.direction).reduce((count, value) => count + (value ? 1 : 0), 0);

        const ADJUSTED_TANK_SPEED = trueCount >= 2 ? TANK_SPEED / Math.sqrt(2) : TANK_SPEED;

        if (this.direction.up) {
            new_z -= ADJUSTED_TANK_SPEED * dt;
        }
        if (this.direction.down) {
            new_z += ADJUSTED_TANK_SPEED * dt;
        }
        if (this.direction.right) {
            new_x += ADJUSTED_TANK_SPEED * dt;
        }
        if (this.direction.left) {
            new_x -= ADJUSTED_TANK_SPEED * dt;
        }
        this.user.updatePosition(new_x, new_z, this.direction);
    }

    display(context, program_state) {
        // ** Setup ** This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!this.initialized) {
            // flag initialized
            this.initialized = true;

            // initialize global camera and projection matrices
            program_state.set_camera(Mat4.translation(-19, 15, -44).times(Mat4.rotation(Math.PI / 2.4, 1, 0, 0)));

            // initialize event listeners
            let canvas = context.canvas;
            canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e, program_state, canvas.getBoundingClientRect())); // rotate tank towards mouse
            canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e, program_state, canvas.getBoundingClientRect())); // shoot bullets

            // remove default cursor
            canvas.style.cursor = "none";

            if (this.state === GAME_STATE_ENUM.DEV_STATE) {
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
        let cursor_transform = Mat4.identity().times(Mat4.translation(this.cursor_x, 4.3, this.cursor_z))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.square.draw(context, program_state, cursor_transform, this.materials.cursor);

        // ** Game Loop **
        if (this.startGame) {
            if (this.state === GAME_STATE_ENUM.TITLE_STATE) {
                let text_transform = Mat4.translation(14, 1.1, 16).times(this.textTransform)
                this.shapes.text.set_string("Tanks!", context.context);
                this.shapes.text.draw(context, program_state, text_transform, this.materials.text_image);
                this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
                this.displayBackground(context, program_state);

                if (t - this.stateStart >= TITLE_STATE_DURATION) {
                    console.log("title state --> info state level " + this.level)
                    this.level = 1;
                    this.state = GAME_STATE_ENUM.LEVEL_INFO_STATE;
                    this.stateStart = t;
                    this.map.initializeLevel(this.level);

                    this.stopRestartMusic();
                    AUDIO.LEVEL_START_MUSIC.play();
                }
            } else if (this.state === GAME_STATE_ENUM.LEVEL_INFO_STATE) {
                let model_transform = Mat4.translation(12, 1.1, 12).times(this.textTransform)
                this.shapes.text.set_string(`Level ${this.level}`, context.context);
                this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);

                let model_transform2 = Mat4.translation(9, 1.2, 16).times(this.subtextTransform)
                this.shapes.text.set_string(`Enemy tanks: ${this.map.enemies.length}`, context.context);
                this.shapes.text.draw(context, program_state, model_transform2, this.materials.text_image);

                let model_transform3 = Mat4.translation(13.5, 1.2, 18.7).times(this.subtextTransform)
                this.shapes.text.set_string(`Lives: ${this.lives}`, context.context);
                this.shapes.text.draw(context, program_state, model_transform3, this.materials.text_image);

                this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
                this.displayBackground(context, program_state);

                if (t - this.stateStart >= LEVEL_INFO_STATE_DURATION) {
                    console.log(`info for level ${this.level} --> starting level ${this.level}`)
                    this.state = GAME_STATE_ENUM.LEVEL_START_STATE;
                    this.map.state = GAME_STATE_ENUM.LEVEL_START_STATE;
                    this.stateStart = t;
                    this.levelTimeRemaining = 45;

                    this.stopRestartMusic();
                    AUDIO.LEVEL_VARIATION_1_MUSIC.play();
                }
            } else if (this.state === GAME_STATE_ENUM.LEVEL_START_STATE) {
                this.map.render(context, program_state, false);
                this.map.clearBulletQueue();
                this.user.render(context, program_state);
                this.renderUserInfo(context, program_state);

                if (t - this.stateStart >= LEVEL_START_STATE_DURATION) {
                    console.log(`starting level ${this.level} --> level ${this.level}`)
                    this.state = GAME_STATE_ENUM.LEVEL_STATE;
                    this.map.state = GAME_STATE_ENUM.LEVEL_STATE;
                    this.stateStart = t;
                }
            } else if (this.state === GAME_STATE_ENUM.LEVEL_STATE) {
                if (t <= this.stateStart + 1000) {
                    this.startOpacity -= dt;
                    let model_transform = Mat4.translation(14, 4.2, 16).times(this.textTransform);
                    this.shapes.text.set_string(`Start!`, context.context);
                    this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);
                }

                if (t > this.stateStart + LEVEL_DURATION) {
                    // level timeout
                    console.log(`level ${this.level} --> failed level ${this.level} due to timeout`)
                    this.lives--;
                    this.state = GAME_STATE_ENUM.LEVEL_FAILED_STATE;
                    this.stateStart = t;

                    this.stopRestartMusic();
                    AUDIO.LEVEL_FAILURE_MUSIC.play();
                } else {
                    if (!this.user.dead) {
                        this.moveUser(dt)
                        this.levelTimeRemaining -= dt;
                        this.map.render(context, program_state, true);
                        this.user.render(context, program_state);
                        this.renderUserInfo(context, program_state);

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
                            this.state = GAME_STATE_ENUM.LEVEL_CLEARED_STATE;
                            this.stateStart = t;

                            this.stopRestartMusic();
                            AUDIO.LEVEL_SUCCESS_MUSIC.play();
                        }
                    } else {
                        // user died
                        console.log(`level ${this.level} --> failed level ${this.level} due to user death`);
                        this.lives--;
                        this.state = GAME_STATE_ENUM.LEVEL_FAILED_STATE;
                        this.stateStart = t;

                        this.stopRestartMusic();
                        AUDIO.LEVEL_FAILURE_MUSIC.play();
                    }
                }
            } else if (this.state === GAME_STATE_ENUM.LEVEL_CLEARED_STATE) {
                this.map.clearBulletQueue();
                if (t - this.stateStart >= 1000) {
                    let model_transform = Mat4.translation(5, 4.2, 15).times(this.textTransform)
                    this.shapes.text.set_string(`Level Cleared!`, context.context);
                    this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);
                    this.shapes.square.draw(context, program_state, this.bannerPlainTransform, this.materials.banner_plain);
                }

                this.map.render(context, program_state);
                this.user.render(context, program_state);
                this.renderUserInfo(context, program_state);

                if (t - this.stateStart >= LEVEL_CLEARED_STATE_DURATION) {
                    // does not add an extra life if we already won!
                    if (this.level >= MAX_LEVELS) {
                        console.log(`cleared level ${this.level} --> win`)
                        this.state = GAME_STATE_ENUM.WIN_STATE;
                        this.stateStart = t;

                        this.stopRestartMusic();
                        AUDIO.THEME_MUSIC.play();
                    } else if (this.level % 5 === 0) {
                        console.log(`cleared level ${this.level} --> extra life`)
                        this.state = GAME_STATE_ENUM.EXTRA_LIFE_STATE;
                        this.stateStart = t;
                        this.lives++;

                        this.stopRestartMusic();
                        AUDIO.EXTRA_LIFE_MUSIC.play();
                    } else {
                        console.log(`cleared level ${this.level} --> starting level ${this.level}`)
                        this.state = GAME_STATE_ENUM.LEVEL_INFO_STATE;
                        this.stateStart = t;
                        this.map.initializeLevel(this.level);

                        this.stopRestartMusic();
                        AUDIO.LEVEL_START_MUSIC.play();
                    }
                }
            } else if (this.state === GAME_STATE_ENUM.LEVEL_FAILED_STATE) {
                this.map.clearBulletQueue();
                if (t - this.stateStart >= 500) {
                    let model_transform = Mat4.translation(5, 4.2, 15).times(this.textTransform)
                    this.shapes.text.set_string(`Level Failed`, context.context);
                    this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);
                    this.shapes.square.draw(context, program_state, this.bannerPlainTransform, this.materials.banner_plain);
                }

                this.map.render(context, program_state, false);
                this.user.render(context, program_state);
                this.renderUserInfo(context, program_state);

                if (t - this.stateStart >= LEVEL_FAILED_STATE_DURATION) {
                    if (this.lives === 0) {
                        console.log(`failed level ${this.level} --> lose`)
                        this.state = GAME_STATE_ENUM.LOSE_STATE;
                        this.stateStart = t;

                        this.stopRestartMusic();
                        AUDIO.GAME_OVER_MUSIC.play();
                    } else {
                        console.log(`failed level ${this.level} --> info for level ${this.level}`)
                        this.state = GAME_STATE_ENUM.LEVEL_INFO_STATE;
                        this.stateStart = t;
                        this.map.initializeLevel(this.level);

                        this.stopRestartMusic();
                        AUDIO.LEVEL_START_MUSIC.play();
                    }
                }
            } else if (this.state === GAME_STATE_ENUM.LOSE_STATE) {
                let model_transform1 = Mat4.translation(4, 1.2, 13).times(this.textTransform)
                this.shapes.text.set_string(`Mission Failed`, context.context);
                this.shapes.text.draw(context, program_state, model_transform1, this.materials.text_image);

                let model_transform2 = Mat4.translation(1, 1.2, 17).times(this.subtextTransform)
                this.shapes.text.set_string(`Click anywhere to restart`, context.context);
                this.shapes.text.draw(context, program_state, model_transform2, this.materials.text_image);

                this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
                this.displayBackground(context, program_state);

                if (this.continue) {
                    console.log(`lose --> info for level 1`)
                    this.level = 1;
                    this.state = GAME_STATE_ENUM.TITLE_STATE;
                    this.stateStart = t;
                    this.lives = INITIAL_LIVES;
                    this.user.dead = false;

                    this.stopRestartMusic();
                    AUDIO.LEVEL_START_MUSIC.play();
                }
            } else if (this.state === GAME_STATE_ENUM.WIN_STATE) {
                let model_transform = Mat4.translation(12, 1.2, 13).times(this.textTransform)
                this.shapes.text.set_string(`You Win!`, context.context);
                this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);

                let model_transform2 = Mat4.translation(7, 1.2, 17).times(this.subtextTransform)
                this.shapes.text.set_string(`Thanks for playing`, context.context);
                this.shapes.text.draw(context, program_state, model_transform2, this.materials.text_image);

                this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
                this.displayBackground(context, program_state);
            } else if (this.state === GAME_STATE_ENUM.EXTRA_LIFE_STATE) {
                let model_transform = Mat4.translation(8, 1.2, 13).times(this.textTransform)
                this.shapes.text.set_string(`Bonus Tank!`, context.context);
                this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);

                let model_transform2 = Mat4.translation(9, 1.2, 17).times(this.subtextTransform)
                this.shapes.text.set_string(`Lives: ${this.lives-1} -> ${this.lives}`, context.context);
                this.shapes.text.draw(context, program_state, model_transform2, this.materials.text_image);

                this.shapes.square.draw(context, program_state, this.bannerGreenTransform, this.materials.banner_green);
                this.displayBackground(context, program_state);

                if (t - this.stateStart >= EXTRA_LIFE_STATE_DURATION) {
                    console.log(`extra life --> info for level ${this.level}`)
                    this.state = GAME_STATE_ENUM.LEVEL_INFO_STATE;
                    this.stateStart = t;
                    this.map.initializeLevel(this.level);

                    this.stopRestartMusic();
                    AUDIO.LEVEL_START_MUSIC.play();
                }
            } else if (this.state === GAME_STATE_ENUM.DEV_STATE) {
                if (!this.user.dead) {
                    this.moveUser(dt);
                }
                this.map.render(context, program_state);
                this.user.render(context, program_state);
                this.renderUserInfo(context, program_state);
                this.stateStart = t;
            }
        } else {
            // pressing a button is required to make audio work in javascript code
            let model_transform = Mat4.translation(-3, 1.2, 16).times(this.textTransform)
            this.shapes.text.set_string(`Click Enter to start`, context.context);
            this.shapes.text.draw(context, program_state, model_transform, this.materials.text_image);

            this.shapes.square.draw(context, program_state, this.bannerRedTransform, this.materials.banner_red);
            this.displayBackground(context, program_state);

            // DEV: uncomment the following lines and set initializeLevel(n) in display setup() to test map layouts
            // if (!this.user.dead) {
            //     this.moveUser(dt);
            // }
            // this.map.render(context, program_state);
            // this.user.render(context, program_state);
            // this.renderUserInfo(context, program_state)
        }
    }

    displayBackground(context, program_state) {
        const t = program_state.animation_time / 1000;  // Convert to seconds

        const translate_x = (t * BACKGROUND_SPEED) % 5;  // Wrap around using modulus
        const translate_z = -(t * BACKGROUND_SPEED) % 5;  // Wrap around using modulus

        let background_transform = Mat4.translation(translate_x, 0, translate_z).times(this.backgroundTransform)
        this.shapes.square.draw(context, program_state, background_transform, this.materials.background);
    }

    renderUserInfo(context, program_state) {
        // level
        let level_transform = Mat4.translation(-3, 1.2, 27.8)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-0.6, 0.6, 0.6));
        this.shapes.text.set_string(`Level ${this.level}`, context.context);
        this.shapes.text.draw(context, program_state, level_transform, this.materials.text_image);

        // time remaining
        let time_transform = Mat4.translation(-3, 1.2, 29)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-0.6, 0.6, 0.6));
        this.shapes.text.set_string(`00:${Math.floor(this.levelTimeRemaining)}`, context.context);
        this.shapes.text.draw(context, program_state, time_transform, this.materials.text_image);

        // banner left
        let banner_left_transform = Mat4.translation(-5, 1.1, 28.3)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-12, 2, 1));
        this.shapes.square.draw(context, program_state, banner_left_transform, this.materials.banner_red);

        // lives remaining
        let lives_transform = Mat4.translation(35, 1.2, 27.8)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-0.6, 0.6, 0.6));
        this.shapes.text.set_string(`Lives: ${this.lives}`, context.context);
        this.shapes.text.draw(context, program_state, lives_transform, this.materials.text_image);

        // ammo
        const bullet_spacing = 1.3;
        for (let i = 0; i < this.user.clip; i++) {
            let bullet_transform = Mat4.identity()
                .times(Mat4.translation(34.3 + i * bullet_spacing, 3, 29)) // Position bullets in front of the camera
                .times(Mat4.scale(0.45, 0.45, 0.45)); // Adjust bullet size
            this.shapes.ammo.draw(context, program_state, bullet_transform, this.materials.ammo);
        }

        // banner right
        let banner_right_transform = Mat4.translation(45, 1.1, 28.3)
            .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
            .times(Mat4.rotation(Math.PI, 0, 1, 0))
            .times(Mat4.scale(-12, 2, 1));
        this.shapes.square.draw(context, program_state, banner_right_transform, this.materials.banner_red);
    }

    stopRestartMusic() {
        AUDIO.THEME_MUSIC.pause();
        AUDIO.THEME_MUSIC.currentTime = 0;
        AUDIO.LEVEL_START_MUSIC.pause();
        AUDIO.LEVEL_START_MUSIC.currentTime = 0;
        AUDIO.LEVEL_SUCCESS_MUSIC.pause();
        AUDIO.LEVEL_SUCCESS_MUSIC.currentTime = 0;
        AUDIO.LEVEL_FAILURE_MUSIC.pause();
        AUDIO.LEVEL_FAILURE_MUSIC.currentTime = 0;
        AUDIO.LEVEL_VARIATION_1_MUSIC.pause();
        AUDIO.LEVEL_VARIATION_1_MUSIC.currentTime = 0;
        AUDIO.GAME_OVER_MUSIC.pause();
        AUDIO.GAME_OVER_MUSIC.currentTime = 0;  
        AUDIO.EXTRA_LIFE_MUSIC.pause();
        AUDIO.EXTRA_LIFE_MUSIC.currentTime = 0;  
    }
}

export { GameScene, GAME_STATE_ENUM }