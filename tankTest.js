import {defs, tiny} from './examples/common.js';
import { Shape_From_File } from './examples/obj-file-demo.js';

const {
    Vector, Vector3, vec, vec3, vec4, color, hex_color, Matrix, Mat4, Light, Shape, Material, Scene,
} = tiny;

class Base_Scene extends Scene {
    /**
     *  **Base_scene** is a Scene that can be added to any display canvas.
     *  Setup the shapes, materials, camera, and lighting here.
     */
    constructor() {
        super();

        // gameplay
        this.paused = false;

        // player movement
        this.user_x = 0;
        this.user_z = 0;
        this.user_rotation = Mat4.identity();

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

    // called once per animation frame
    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            // movement controls
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());
            // global camera and projection matrices
            program_state.set_camera(Mat4.translation(-18, 15, 44).times(Mat4.rotation(Math.PI/2, 1, 0, 0)));

            // event listener for mouse over to rotate user towards mouse position
            let canvas = context.canvas;
            const mouse_position = (e, rect = canvas.getBoundingClientRect()) =>
                vec((e.clientX - (rect.left + rect.right) / 2) / ((rect.right - rect.left) / 2),
                    (e.clientY - (rect.bottom + rect.top) / 2) / ((rect.top - rect.bottom) / 2));
            canvas.addEventListener("mousemove", (e) => {
                e.preventDefault();
            
                // get world space position
                const rect = canvas.getBoundingClientRect();
                let [pos_world_near, pos_world_far, center_world_near] = this.convertSStoWS(mouse_position(e), program_state);

                // calculate the angle between user position and mouse position and update rotation
                let angle = Math.atan2(pos_world_far[0] - this.user_x, pos_world_far[2] - this.user_z);
                this.user_rotation = Mat4.rotation(angle, 0, 1, 0);
            })
        }

        // perspective
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // lights
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // animation time
        const t = program_state.animation_time / 1000; // time in seconds
        this.time = t;

        // display models
        let model_transform = Mat4.identity();
        let user_transform = model_transform.times(Mat4.translation(this.user_x, 0, this.user_z))
                                            .times(this.user_rotation)
                                            .times(this.user_global_transform);
        this.shapes.tank.draw(context, program_state, user_transform, this.materials.plastic.override({color: hex_color("#6A9956")}));

    }
}