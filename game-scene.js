import {defs, tiny, Cube} from './examples/common.js';
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

        this.up = false;
        this.down = false;
        this.right = false;
        this.left = false;

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

    display(context, program_state) {
        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if (!context.scratchpad.controls) {
            // initialize movement controls
            this.children.push(context.scratchpad.controls = new defs.Movement_Controls());

            // initialize global camera and projection matrices
            program_state.set_camera(Mat4.translation(-18, 15, -44).times(Mat4.rotation(Math.PI/2, 1, 0, 0)));

            // initialize event listener for mouse over to rotate user towards mouse position
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
            });
        }

        // render perspective
        program_state.projection_transform = Mat4.perspective(
            Math.PI / 4, context.width / context.height, 1, 100);

        // render lights
        const light_position = vec4(0, 5, 5, 1);
        program_state.lights = [new Light(light_position, color(1, 1, 1, 1), 1000)];

        // Render the Map every frame
        this.map.renderLevel(context, program_state, 2);

        // render user tank
        let model_transform = Mat4.identity();

        // MOVING_THING STUFF...
        if (this.up === true) {
            this.user_z -= 0.2;
        }
        if (this.down === true) {
            this.user_z += 0.2;
        }
        if (this.right === true) {
            this.user_x += 0.2;
        }
        if (this.left === true) {
            this.user_x -= 0.2;
        }

        let user_transform = model_transform.times(Mat4.translation(this.user_x, 0, this.user_z))
                                            .times(this.user_rotation)
                                            .times(this.user_global_transform);
        this.shapes.tank.draw(context, program_state, user_transform, this.materials.plastic.override({color: hex_color("#6A9956")}));

    }
}

