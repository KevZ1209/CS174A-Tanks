import {defs, tiny, Subdivision_Sphere} from './examples/common.js';
import { Map } from './components/map.js';
import { Shape_From_File } from './examples/obj-file-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

const BULLET_SPEED = 0.5;

export class GameScene extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // map
        this.map = new Map();

        // player movement
        this.user_x = 3;
        this.user_z = 3;
        this.user_rotation = Mat4.identity();

        this.up = false;
        this.down = false;
        this.right = false;
        this.left = false;

        // bullets
        this.animation_queue = [];

        // shapes
        this.shapes = {
            'tank': new Shape_From_File("assets/tank.obj"),
            'bullet': new Subdivision_Sphere(4)
        };

        // materials
        this.materials = {
            plastic: new Material(new defs.Phong_Shader(),
                {ambient: .4, diffusivity: .6, color: hex_color("#ffffff")}),
        };
    }

    make_control_panel() {
        // Up Movement (arrow key up)
        // Draw the scene's buttons, setup their actions and keyboard shortcuts, and monitor live measurements.
        this.key_triggered_button("Move Up", ["ArrowUp"], () => {this.up = true},
            "#6E6460", () => {this.up = false});
        this.key_triggered_button("Move Down", ["ArrowDown"], () => {this.down = true},
            "#6E6460", () => {this.down = false});
        this.key_triggered_button("Move Left", ["ArrowLeft"], () => {this.left = true},
            "#6E6460", () => {this.left = false});
        this.key_triggered_button("Move Right", ["ArrowRight"], () => {this.right = true},
            "#6E6460", () => {this.right = false});
        this.new_line();
    }

    // convert screen space position to world space position
    convertSStoWS(pos, program_state) {
        // 1. transform mouse position from screen space to normalized device coordinates (ndc)
        let pos_ndc_near = vec4(pos[0], pos[1], -1.0, 1.0);
        let pos_ndc_far  = vec4(pos[0], pos[1], 1.0, 1.0);
        let center_ndc_near = vec4(0.0, 0.0, -1.0, 1.0);

        // 2. transform ndc position to world space
        let P = program_state.projection_transform;
        let V = program_state.camera_inverse;
        let pos_world_near = Mat4.inverse(P.times(V)).times(pos_ndc_near);
        let pos_world_far  = Mat4.inverse(P.times(V)).times(pos_ndc_far);
        let center_world_near  = Mat4.inverse(P.times(V)).times(center_ndc_near);
        pos_world_near.scale_by(1 / pos_world_near[3]);
        pos_world_far.scale_by(1 / pos_world_far[3]);
        center_world_near.scale_by(1 / center_world_near[3]);
        
        // 3. find intersection with the ground plane (y = 0)
        let t = -pos_world_near[1] / (pos_world_far[1] - pos_world_near[1]);
        let pos_world_ground = pos_world_near.plus(pos_world_far.minus(pos_world_near).times(t));

        return pos_world_ground;
    }

    getMousePosition(e, rect) {
        return vec((e.clientX - (rect.left + rect.right) / 2) / ((rect.right - rect.left) / 2),
                   (e.clientY - (rect.bottom + rect.top) / 2) / ((rect.top - rect.bottom) / 2));
    }

    handleMouseMove(e, program_state, rect) {
        e.preventDefault();
            
        // get world space position
        let pos_world_ground = this.convertSStoWS(this.getMousePosition(e, rect), program_state);

        // calculate the angle between user position and mouse position and update rotation
        let angle = Math.atan2(pos_world_ground[0] - this.user_x, pos_world_ground[2] - this.user_z);
        this.user_rotation = Mat4.rotation(angle, 0, 1, 0);
    }

    handleMouseDown(e, program_state, rect) {
        e.preventDefault();

        // get world space position
        let pos_world_ground = this.convertSStoWS(this.getMousePosition(e, rect), program_state);
        let angle = Math.atan2(pos_world_ground[0] - this.user_x, pos_world_ground[2] - this.user_z)
        let velocity = vec3(Math.sin(angle) * BULLET_SPEED, 0, Math.cos(angle) * BULLET_SPEED);
        // add animation bullet to queue
        let animation_bullet = {
            position: vec4(this.user_x, 1, this.user_z, 1),
            angle: angle,
            velocity: velocity,
        }
        this.animation_queue.push(animation_bullet);
    }

    checkCollision(tankPosition) {
        for (let block of this.map.blocks) {
            const tankMin = tankPosition.minus(vec3(0.5, 0, 0.5)); // Assuming tank size is 1x1x1
            const tankMax = tankPosition.plus(vec3(0.5, 1, 0.5));  // Adjust based on tank size

            const blockMin = block.position.minus(vec3(block.size *.9, block.size *.9, block.size *.9));
            const blockMax = block.position.plus(vec3(block.size *.9, block.size *.9, block.size *.9));

            const xOverlap = tankMin[0] <= blockMax[0] && tankMax[0] >= blockMin[0];
            const yOverlap = tankMin[1] <= blockMax[1] && tankMax[1] >= blockMin[1];
            const zOverlap = tankMin[2] <= blockMax[2] && tankMax[2] >= blockMin[2];

            if (xOverlap && yOverlap && zOverlap) {
                return true; // Collision detected
            }
        }
        return false; // No collision
    }
ds
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

    updateTankPosition(new_x, new_z) {
        // Update X position
        let potential_new_x = new_x;
        if (this.right && !this.checkCollision(vec3(potential_new_x, 0, this.user_z))) {
            this.user_x = potential_new_x;
        } else if (this.left && !this.checkCollision(vec3(potential_new_x, 0, this.user_z))) {
            this.user_x = potential_new_x;
        }

        // Update Z position
        let potential_new_z = new_z;
        if (this.up && !this.checkCollision(vec3(this.user_x, 0, potential_new_z))) {
            this.user_z = potential_new_z;
        } else if (this.down && !this.checkCollision(vec3(this.user_x, 0, potential_new_z))) {
            this.user_z = potential_new_z;
        }
    }

    display(context, program_state) {
        // ** Setup ** This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            // initialize movement controls
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // initialize global camera and projection matrices
            program_state.set_camera(Mat4.translation(-19, 15, -44).times(Mat4.rotation(Math.PI/3, 1, 0, 0)));

            // initialize event listeners
            let canvas = context.canvas;
            canvas.addEventListener("mousemove", (e) => this.handleMouseMove(e, program_state, canvas.getBoundingClientRect())); // rotate tank towards mouse
            canvas.addEventListener("mousedown", (e) => this.handleMouseDown(e, program_state, canvas.getBoundingClientRect())); // shoot bullets
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
        this.map.renderLevel(context, program_state, 2);

        // user tank
        let model_transform = Mat4.identity();

        // moving thingz stuff part 2
        let new_x = this.user_x;
        let new_z = this.user_z;

        if (this.up) {
            new_z -= 0.2;
        }
        if (this.down) {
            new_z += 0.2;
        }
        if (this.right) {
            new_x += 0.2;
        }
        if (this.left) {
            new_x -= 0.2;
        }

        this.updateTankPosition(new_x,new_z);

        let user_transform = model_transform.times(Mat4.translation(this.user_x, 0, this.user_z))
                                            .times(this.user_rotation);
        this.shapes.tank.draw(context, program_state, user_transform, this.materials.plastic.override({color: hex_color("#6A9956")}));

        // animate bullets
        if (this.animation_queue.length > 0) {
            for (let i = 0; i < this.animation_queue.length; i++) {
                let bullet = this.animation_queue[i];
                bullet.position = bullet.position.plus(bullet.velocity);

                // Check for collision with blocks
                let collision = this.checkBulletCollision(bullet.position.to3());
                if (collision) {
                    let normal = collision.normal;
                    let velocity = bullet.velocity;
                    let dotProduct = velocity.dot(normal);
                    bullet.velocity = velocity.minus(normal.times(2 * dotProduct));
                }
                let bullet_transformation = Mat4.translation(bullet.position[0], 0, bullet.position[2])
                                                .times(Mat4.scale(0.5, 0.5, 0.5));
                this.shapes.bullet.draw(context, program_state, bullet_transformation, this.materials.plastic);
            }
        }

        // remove finished bullets
        while (this.animation_queue.length > 0) {
            if (this.animation_queue[0].position[0] < -50 || 
                this.animation_queue[0].position[0] > 50 || 
                this.animation_queue[0].position[2] < -50 || 
                this.animation_queue[0].position[2] > 50) {
                    this.animation_queue.shift();
            } else {
                break;
            }
        }

    }
}


