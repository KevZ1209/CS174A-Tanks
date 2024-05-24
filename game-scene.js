import {defs, tiny, Subdivision_Sphere} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';
import { Map } from './components/map.js';
import { Tank } from './components/tank.js';

const {
    vec, vec3, vec4, color, hex_color, Mat4, Light, Material, Scene, Texture
} = tiny;

const { Textured_Phong } = defs;

const BULLET_SPEED = 0.5;
const MAX_BULLET_COLLISIONS = 2;
const INITIAL_USER_X = 3;
const INITIAL_USER_Z = 3;
const INITIAL_USER_ROTATION = Mat4.identity();
const USER_TANK_COLOR = "#0F65DE";

export class GameScene extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // map
        this.map = new Map();
        this.level = 0;

        // player movement
        this.user = new Tank(INITIAL_USER_X, INITIAL_USER_Z, INITIAL_USER_ROTATION, USER_TANK_COLOR)
        this.direction = {
            up: false,
            down: false,
            right: false,
            left: false
        }

        this.cursor_x = 0;
        this.cursor_z = 0;

        // bullets
        this.animation_queue = [];

        // shapes
        this.shapes = {
            tank: new Shape_From_File("assets/tank.obj"),
            bullet: new Subdivision_Sphere(4),
            square: new defs.Square()

        };

        // materials
        this.materials = {
            plastic: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
            cursor: new Material(new Textured_Phong(), {
                ambient: .4, diffusivity: .8, specularity: 0.1,
                color: hex_color("#FFFFFF"),
                texture: new Texture("assets/cursor.png")
            }),
        };
    }

    make_control_panel() {
        // Up Movement (arrow key up)
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Move Up", ["ArrowUp"], () => {this.direction.up = true},
            "#6E6460", () => {this.direction.up = false});
        this.key_triggered_button("Move Down", ["ArrowDown"], () => {this.direction.down = true},
            "#6E6460", () => {this.direction.down = false});
        this.key_triggered_button("Move Left", ["ArrowLeft"], () => {this.direction.left = true},
            "#6E6460", () => {this.direction.left = false});
        this.key_triggered_button("Move Right", ["ArrowRight"], () => {this.direction.right = true},
            "#6E6460", () => {this.direction.right = false});
        this.new_line();
        this.key_triggered_button("Next Level", ["l"], () => {
            if (this.level < 2) {
                this.level += 1;
                this.user.updatePosition(INITIAL_USER_X, INITIAL_USER_Z);
            }
        })
    }

    // convert screen space position to world space position
    convertSStoWS(pos, program_state) {
        // 1. transform mouse position from screen space to normalized device coordinates (ndc)
        let pos_ndc_near = vec4(pos[0], pos[1], -1.0, 1.0);
        let pos_ndc_far  = vec4(pos[0], pos[1], 1.0, 1.0);

        // 2. transform ndc position to world space
        let P = program_state.projection_transform;
        let V = program_state.camera_inverse;
        let matrix = Mat4.inverse(P.times(V));
        let pos_world_near = matrix.times(pos_ndc_near);
        let pos_world_far  = matrix.times(pos_ndc_far);
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
        this.user.updateRotation(angle)

        // update cursor position
        this.cursor_x = pos_world_cursor[0]
        this.cursor_z = pos_world_cursor[2]
    }

    handleMouseDown(e, program_state, rect) {
        e.preventDefault();

        // get world space position
        let [user_x, user_z] = this.user.getPosition()
        let [pos_world_ground, pos_world_cursor] = this.convertSStoWS(this.getMousePosition(e, rect), program_state, 0);
        let angle = Math.atan2(pos_world_ground[0] - user_x, pos_world_ground[2] - user_z)
        let velocity = vec3(Math.sin(angle) * BULLET_SPEED, 0, Math.cos(angle) * BULLET_SPEED);
        // add animation bullet to queue
        let animation_bullet = {
            position: vec4(user_x, 1, user_z, 1),
            angle: angle,
            velocity: velocity,
            numCollisions: 0
        }
        this.animation_queue.push(animation_bullet);
    }

    checkBulletCollision(bulletPosition) {
        for (let block of this.map.blocks) {
            const bulletMin = bulletPosition.minus(vec3(0.2, 0.2, 0.2)); // Adjust based on bullet size
            const bulletMax = bulletPosition.plus(vec3(0.2, 0.2, 0.2));  // Adjust based on bullet size

            const blockMin = block.position.minus(vec3(block.size * 0.5, block.size *0.5, block.size *0.5));
            const blockMax = block.position.plus(vec3(block.size *0.5, block.size *0.5, block.size *0.5));

            const xOverlap = bulletMin[0] <= blockMax[0] && bulletMax[0] >= blockMin[0];
            const yOverlap = bulletMin[1] <= blockMax[1] && bulletMax[1] >= blockMin[1];
            const zOverlap = bulletMin[2] <= blockMax[2] && bulletMax[2] >= blockMin[2];

            if (xOverlap && yOverlap && zOverlap) {
                // Determine the normal vector of the collision
                let normal = vec3(0, 0, 0);
                if (Math.abs(bulletPosition[0] - block.position[0]) > Math.abs(bulletPosition[2] - block.position[2])) {
                    normal[0] = Math.sign(bulletPosition[0] - block.position[0]);
                } else {
                    normal[2] = Math.sign(bulletPosition[2] - block.position[2]);
                }
                return {block: block, normal: normal};
            }
        }
        return null; // No collision
    }

    display(context, program_state) {
        // ** Setup ** This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            // initialize movement controls
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // initialize global camera and projection matrices
            program_state.set_camera(Mat4.translation(-19, 15, -44).times(Mat4.rotation(Math.PI/(2.5), 1, 0, 0)));

            // initialize event listeners
            let canvas = context.canvas;
            canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e, program_state, canvas.getBoundingClientRect())); // rotate tank towards mouse
            canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e, program_state, canvas.getBoundingClientRect())); // shoot bullets

            // remove default cursor
            canvas.style.cursor = "none";
        }

        // ** Render ** display all set perspective, lights, and models in the scene
        const t = program_state.animation_time;

        // perspective
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // lights
        const light_position = vec4(16, 20, 10, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // map
        this.map.renderLevel(context, program_state, this.level);

        // user cursor
        let cursor_transform = Mat4.identity().times(Mat4.translation(this.cursor_x, 1.1, this.cursor_z))
                                              .times(Mat4.rotation(Math.PI, 0, 1, 0))
                                              .times(Mat4.rotation(Math.PI / 2, 1, 0, 0));
        this.shapes.square.draw(context, program_state, cursor_transform, this.materials.cursor);

        // user tank
        let [new_x, new_z] = this.user.getPosition();
        if (this.direction.up) {
            new_z -= 0.2;
        }
        if (this.direction.down) {
            new_z += 0.2;
        }
        if (this.direction.right) {
            new_x += 0.2;
        }
        if (this.direction.left) {
            new_x -= 0.2;
        }
        this.user.updatePosition(this.map.blocks, this.direction, new_x, new_z);
        this.user.render(context, program_state);

        // animate bullets
        if (this.animation_queue.length > 0) {
            for (let i = this.animation_queue.length - 1; i >= 0; i--) {
                let bullet = this.animation_queue[i];
                bullet.position = bullet.position.plus(bullet.velocity);

                // Check for collision with blocks
                let collision = this.checkBulletCollision(bullet.position.to3());
                if (collision) {
                    let normal = collision.normal;
                    let velocity = bullet.velocity;
                    let dotProduct = velocity.dot(normal);
                    bullet.velocity = velocity.minus(normal.times(2 * dotProduct));
                    bullet.numCollisions += 1;
                }

                // render bullet
                let bullet_transformation = Mat4.translation(bullet.position[0], 0, bullet.position[2])
                                                .times(Mat4.scale(0.5, 0.5, 0.5));
                this.shapes.bullet.draw(context, program_state, bullet_transformation, this.materials.plastic);

                // remove bullet if out of bounds or numCollisions > 2
                if (bullet.position[0] < -50 || 
                    bullet.position[0] > 50 || 
                    bullet.position[2] < -50 || 
                    bullet.position[2] > 50) {
                    this.animation_queue.splice(i, 1);
                } else if (bullet.numCollisions > MAX_BULLET_COLLISIONS) {
                    this.animation_queue.splice(i, 1);
                }
            }
        }
    }
}


