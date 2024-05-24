import {defs, tiny, Subdivision_Sphere} from './examples/common.js';
import { Map } from './components/map.js';
import { Shape_From_File } from './examples/obj-file-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

export class GameScene extends Scene {
    constructor() {
        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        super();

        // map
        this.map = new Map();
        
        // player movement
        this.user_x = 2;
        this.user_z = 2;
        this.user_rotation = Mat4.identity();

        // global positioning
        this.user_global_transform =  Mat4.identity();

        // animation queue
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
        this.key_triggered_button("Up", ['ArrowUp'], () => {
            if(!(this.paused)){
                this.user_z -= 1;
            }
        });
        // Down Movement (arrow key down)
        this.key_triggered_button("Down", ['ArrowDown'], () => {
            if(!(this.paused)){
                this.user_z += 1; 
            }
        });
        
        // Left Movement (arrow key left)
        this.key_triggered_button("Left", ['ArrowLeft'], () => {
            if(!(this.paused)){
                this.user_x -= 1; 
            }
        });

        // Right Movement (arrow key right)
        this.key_triggered_button("Right", ['ArrowRight'], () => {
            if(!(this.paused)){
                this.user_x += 1;
            } 
        });
    }

    // convert screen space position to world space position
    convertSStoWS(pos, program_state) {
        // 1. transform mouse position from screen space to normalized device coordinates (ndc)
        let pos_ndc_near = vec4(pos[0], pos[1], -1.0, 1.0);
        let pos_ndc_far  = vec4(pos[0], pos[1],  1.0, 1.0);
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

        // console.log("near: ", pos_world_near);
        // console.log("far: ", pos_world_far);
        // console.log("center: ", center_world_near);
        return [pos_world_near, pos_world_far, center_world_near];
    }

    getMousePosition(e, rect) {
        return vec((e.clientX - (rect.left + rect.right) / 2) / ((rect.right - rect.left) / 2),
                   (e.clientY - (rect.bottom + rect.top) / 2) / ((rect.top - rect.bottom) / 2));
    }

    handleMouseMove(e, program_state, rect) {
        e.preventDefault();
            
        // get world space position
        let [pos_world_near, pos_world_far, center_world_near] = this.convertSStoWS(this.getMousePosition(e, rect), program_state);

        // calculate the angle between user position and mouse position and update rotation
        let angle = Math.atan2(pos_world_far[0] - this.user_x, pos_world_far[2] - this.user_z);
        this.user_rotation = Mat4.rotation(angle, 0, 1, 0);
    }

    handleMouseDown(e, program_state, rect) {
        e.preventDefault();

        // get world space position
        let [pos_world_near, pos_world_far, center_world_near] = this.convertSStoWS(this.getMousePosition(e, rect), program_state);

        // add animation bullet to queue
        let animation_bullet = {
            from: vec4(this.user_x, 0, this.user_z, 1),
            to: pos_world_far,
            angle: Math.atan2(pos_world_far[0] - this.user_x, pos_world_far[2] - this.user_z),
            start_time: program_state.animation_time,
            end_time: program_state.animation_time + 5000 // 5 seconds
        }
        console.log(animation_bullet);
        this.animation_queue.push(animation_bullet);
    }

    display(context, program_state) {
        // ** Setup ** This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            // initialize movement controls
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // initialize global camera and projection matrices
            program_state.set_camera(Mat4.translation(-18, 15, -44).times(Mat4.rotation(Math.PI/2, 1, 0, 0)));

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
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // map
        this.map.renderLevel(context, program_state, 2);

        // user tank
        let model_transform = Mat4.identity();
        let user_transform = model_transform.times(Mat4.translation(this.user_x, 0, this.user_z))
                                            .times(this.user_rotation)
                                            .times(this.user_global_transform);
        this.shapes.tank.draw(context, program_state, user_transform, this.materials.plastic.override({color: hex_color("#6A9956")}));

        // animate bullets
        if (this.animation_queue.length > 0) {
            for (let i = 0; i < this.animation_queue.length; i++) {
                let bullet = this.animation_queue[i];
                let animation_process = (t - bullet.start_time) / (bullet.end_time - bullet.start_time);
                let position = bullet.to.times(animation_process).plus(bullet.from.times(1 - animation_process));

                let bullet_transformation = Mat4.translation(position[0], 0, position[2]).times(Mat4.scale(0.5, 0.5, 0.5));
                this.shapes.bullet.draw(context, program_state, bullet_transformation, this.materials.plastic);
            }
        }

        // remove finished bullets
        while (this.animation_queue.length > 0) {
            if (t > this.animation_queue[0].end_time) {
                this.animation_queue.shift();
            } else {
                break;
            }
        }

    }
}

