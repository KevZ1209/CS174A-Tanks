import { tiny } from '../examples/common.js';
import { Bomb } from './bomb.js';
import { Bullet, BULLET_TYPE_ENUM, BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH, BULLET_SCALE } from "./bullet.js";
import { MAP_SCHEMATIC_ENUM } from "./map.js";
import { GAME_STATE_ENUM } from '../game-scene.js';
import * as AUDIO from "./audio.js";

const { vec3, hex_color, Mat4 } = tiny;

const TANK_SCALE = 0.75;
const TANK_WIDTH = 0.65;
const TANK_HEIGHT = 0.5;
const TANK_DEPTH = 0.65;
const MAX_CLIP_SIZE = 4;
const MOVEMENT_SPEED = 4;
const ROTATION_SPEED = 2;
const DODGE_DISTANCE = 1.8;
const BULLET_CHECK_INTERVAL = 2;
const RANDOM_RELOAD_FACTOR = 1500;

const TANK_TYPE_ENUM = {
  USER: {
    color: hex_color("#0F65DE"),
    can_place_bombs: true,
    bullet_type: BULLET_TYPE_ENUM.USER,
    reload_time: 1500,
    bullet_shoot_sound: AUDIO.BULLET_SHOOT_USER_SOUND
  },
  ENEMY_STATIONARY: {
    color: hex_color("#C68C2F"),
    can_place_bombs: false,
    bullet_type: BULLET_TYPE_ENUM.NORMAL,
    reload_time: 5000,
    bullet_shoot_sound: AUDIO.BULLET_SHOOT_SOUND
  },
  ENEMY_MOVING: {
    color: hex_color("#7A705F"),
    can_place_bombs: false,
    bullet_type: BULLET_TYPE_ENUM.NORMAL,
    reload_time: 4000,
    bullet_shoot_sound: AUDIO.BULLET_SHOOT_SOUND
  },
  ENEMY_MOVING_BOMB: {
    color: hex_color("#DDC436"),
    can_place_bombs: true,
    bullet_type: BULLET_TYPE_ENUM.NORMAL,
    reload_time: 4000,
    bullet_shoot_sound: AUDIO.BULLET_SHOOT_SOUND
  },
  ENEMY_MOVING_FAST_SHOOTING: {
    color: hex_color("#3F7F6F"),
    can_place_bombs: false,
    bullet_type: BULLET_TYPE_ENUM.FAST,
    reload_time: 3000,
    bullet_shoot_sound: AUDIO.BULLET_SHOOT_ENEMY_FAST_SHOOTING_SOUND
  },
  ENEMY_MOVING_FAST_RELOAD: {
    color: hex_color("#99424B"),
    can_place_bombs: false,
    bullet_type: BULLET_TYPE_ENUM.NORMAL,
    reload_time: 1500,
    bullet_shoot_sound: AUDIO.BULLET_SHOOT_SOUND
  }
};

class Tank {
  constructor(initial_x, initial_z, initial_angle, type, map) {
    this.x = initial_x;
    this.z = initial_z;
    this.prev_x = initial_x;
    this.prev_z = initial_z;
    this.angle = initial_angle
    this.render_angle = initial_angle;
    this.map = map;
    this.type = type;
    this.bombActive = false;
    this.clip = MAX_CLIP_SIZE;
    this.last_reload_time = 0;
    this.dead = false;
    this.type = type;
    this.map = map;
    this.body_orientation = Math.PI/2;
    this.pause = true; // pause all shooting & moving before clock starts
    this.user_x = 0;
    this.user_z = 0;
    this.color = this.type.color;
    this.move_random_index = Math.floor(Math.random() * 4);
    this.prev_direction = null;
    // have reload time change on every shot
    this.current_reload_time = this.type.reload_time;

    // AI movement
    this.movementSpeed = MOVEMENT_SPEED;
    this.rotationSpeed = ROTATION_SPEED;
    this.targetPosition = null;
    this.targetBodyOrientation = null;
    this.reachedTarget = true;
    this.movementTimer = 0;
    this.chasePlayer = false;
    this.bulletDodgeTimer = 0;
    this.isDodging = false;
    this.rotationState = "clockwise";
    this.accumulated_rotation = 0;

    this.materials = this.map.materials;
    this.shapes = this.map.shapes;
  }

  render(context, program_state, user_x=0, user_z=0) {
    this.user_x = user_x;
    this.user_z = user_z;
    if (!this.dead) {
      // tank alive
      let turret_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
        .times(Mat4.rotation(this.render_angle + Math.PI, 0, 3, 0)
        // extra scale & translation for 3d object
        .times(Mat4.scale(0.4, 0.4, 0.4)
        .times(Mat4.translation(0, 1, -3.5))));

      let tankbody_transform = Mat4.identity().times(Mat4.translation(this.x, 0, this.z))
          .times(Mat4.translation(0, 0, 0))
          .times(Mat4.rotation(this.body_orientation, 0, 1, 0))
          .times(Mat4.scale(1, 1, 1));

      this.shapes.turret.draw(context, program_state, turret_transform, this.materials.turret_test.override({color: this.color}));
      this.shapes.tankbody.draw(context, program_state, tankbody_transform, this.materials.tank_test.override({color: this.color}));
      const t = program_state.animation_time;
      const dt = program_state.animation_delta_time / 1000;

      // reload bullets
      if (this.clip < MAX_CLIP_SIZE && t - this.last_reload_time > this.type.reload_time) {
        this.clip++;
        this.last_reload_time = t;
      }

      // enemy tank AI
      if (this.type !== TANK_TYPE_ENUM.USER && 
          (this.map.state === GAME_STATE_ENUM.LEVEL_STATE || this.map.state === GAME_STATE_ENUM.DEV_STATE) &&
          !this.map.user.dead
        ) {
        // update movement
        this.updateAIMovement(dt);

        // rotate tank turret
        const target_angle = this.calculateAngleToUser();
        this.angle = target_angle;
        if (!this.wallsInFront()) {
          this.rotateTurretTowardsTargetAngle(target_angle, dt);
        } else {
          this.rotatePeriodically(dt);
        }

        // move and rotate tank body
        if (this.targetPosition && !this.reachedTarget) {
          if (this.targetBodyOrientation !== null && Math.abs(this.body_orientation - this.targetBodyOrientation) > 0.01) {
            this.rotateBodyTowardsTargetAngle(dt);
          } else {
            this.moveTowardsTarget(dt);
          }
        }

        // shoot user if in view
        if (t - this.last_reload_time > this.current_reload_time) {
          if (!this.wallsInFront()) {
            this.shootBullet(this.x, this.z, this.angle, this.type.bullet_type, false, false, false);
            this.last_reload_time = t;
            this.current_reload_time = this.current_reload_time + (1000 * Math.random()) - 500;
          }
          else {
            this.shootBullet(this.x, this.z, this.render_angle, this.type.bullet_type, false, false, false);
            this.last_reload_time = t;
            this.current_reload_time = this.current_reload_time + (RANDOM_RELOAD_FACTOR * Math.random()) - RANDOM_RELOAD_FACTOR / 2;
          }
        }
      }

    } else {
      // tank dead
      let model_transform = Mat4.translation(this.x, -0.9, this.z)
        .times(Mat4.rotation(-Math.PI / 2, 1, 0, 0))
        .times(Mat4.scale(1.3, 1.3, 1.3))
      this.shapes.x.draw(context, program_state, model_transform, this.type === TANK_TYPE_ENUM.USER ? this.materials.user_x.override({color: this.color}) : this.materials.enemy_x.override({color: this.color}));
    }
  }

  calculateAngleToUser() {
    let dz = this.user_z - this.z;
    let dx = this.user_x - this.x;
    return Math.atan2(dx, dz);
  }

  rotateTurretTowardsTargetAngle(target_angle, dt) {
    let angle_difference = target_angle - this.render_angle;

    // Normalize the angle_difference to the range [-π, π] without using modulus
    while (angle_difference > Math.PI) angle_difference -= 2 * Math.PI;
    while (angle_difference < -Math.PI) angle_difference += 2 * Math.PI;

    const max_rotation = Math.PI * 2 * dt;
    if (Math.abs(angle_difference) < max_rotation) {
      this.render_angle = target_angle;
    } else {
      this.render_angle += Math.sign(angle_difference) * max_rotation;
    }
  }

  rotatePeriodically(dt) {
    const rotation_increment = Math.PI / 2; // 45 degrees
    const max_rotation = Math.PI/4 * dt;

    if (this.rotationState === 'clockwise') {
      this.render_angle += max_rotation;
      this.accumulated_rotation += max_rotation;
      if (this.accumulated_rotation >= rotation_increment) {
        this.rotationState = 'counterclockwise';
        this.accumulated_rotation = 0;
      }
    } else {
      this.render_angle -= max_rotation;
      this.accumulated_rotation += max_rotation;
      if (this.accumulated_rotation >= rotation_increment) {
        this.rotationState = 'clockwise';
        this.accumulated_rotation = 0;
      }
    }

    this.render_angle = (this.render_angle + 2 * Math.PI) % (2 * Math.PI); // Normalize angle to [0, 2π]
  }

  shootBullet(x, z, angle, bullet_type, hitboxOn, haveUnlimitedBullets, hits_enemies) {
    let bullet = new Bullet(
      x,
      z,
      angle,
      this.map,
      bullet_type,
      hitboxOn,
      hits_enemies
    )
    this.map.bullet_queue.push(bullet);
    bullet.spawnSmokeBurst();
    if (!haveUnlimitedBullets) {
      this.clip--;
    }
    this.type.bullet_shoot_sound.cloneNode().play();
  }

  wallsInFront() {
    // check for walls
    const GAP = 1;
    let check_x = this.x;
    let check_z = this.z;
    let wall_in_front = false;

    let distance_from_player = Math.sqrt(Math.pow(this.x - this.user_x, 2) + Math.pow(this.z - this.user_z, 2))

    for (let i = 0; i < distance_from_player; i++) {
      check_x += Math.sin(this.angle) * GAP;
      check_z += Math.cos(this.angle) * GAP;
      let position = vec3(check_x, 0, check_z);
      for (let elem of this.map.collisionMap) {
        if (elem.type !== MAP_SCHEMATIC_ENUM.HOLE) {
          const bulletMin = position.minus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));
          const bulletMax = position.plus(vec3(BULLET_WIDTH, BULLET_HEIGHT, BULLET_DEPTH));

          const elemMin = elem.position.minus(vec3(elem.size * BULLET_SCALE, elem.size * BULLET_SCALE, elem.size * BULLET_SCALE));
          const elemMax = elem.position.plus(vec3(elem.size * BULLET_SCALE, elem.size * BULLET_SCALE, elem.size * BULLET_SCALE));

          const xOverlap = bulletMin[0] <= elemMax[0] && bulletMax[0] >= elemMin[0];
          const yOverlap = bulletMin[1] <= elemMax[1] && bulletMax[1] >= elemMin[1];
          const zOverlap = bulletMin[2] <= elemMax[2] && bulletMax[2] >= elemMin[2];
          if (xOverlap && yOverlap && zOverlap) {
            wall_in_front = true;
          }
        }
      }
    }
    return wall_in_front;
  }

  updateAIMovement(dt) {
    switch (this.type) {
      case TANK_TYPE_ENUM.ENEMY_MOVING:
        this.updateMovingEnemy(dt);
        break;
      case TANK_TYPE_ENUM.ENEMY_MOVING_BOMB:
        this.updateMovingBombEnemy(dt);
        break;
      case TANK_TYPE_ENUM.ENEMY_MOVING_FAST_SHOOTING:
        this.detectAndDodgeBullets(dt);
        break;
        // other cases for different tank types
      default:
        break;
    }
  }

  updateMovingEnemy(dt) {
    this.movementTimer += dt;
    let timer = 1;
    if (this.type === TANK_TYPE_ENUM.ENEMY_MOVING_BOMB) {
      timer = 0.5;
    }
    if (this.movementTimer >= timer) { // Move every second
      this.movementTimer = 0;
      this.moveRandomly_v2();
    }
  }

  updateMovingBombEnemy(dt) {
    const playerPosition = this.map.user.getPosition();
    const distanceToPlayer = vec3(this.x, 0, this.z).minus(vec3(playerPosition[0], 0, playerPosition[1])).norm();

    if (distanceToPlayer < 22 && !this.wallsInFront()) { // Chase player if within 10 units
      this.setTargetPosition(playerPosition[0], playerPosition[1]);
      this.targetBodyOrientation = Math.atan2(playerPosition[0] - this.x, playerPosition[1] - this.z);
      this.chasePlayer = true;
    } else {
      // Random movement if player is not nearby
      this.updateMovingEnemy(dt);
      this.chasePlayer = false;
    }
    if(distanceToPlayer < 5) {
      this.placeBomb();
    }
  }

  moveRandomly() {
    const directions = [
      vec3(2, 0, 0),
      vec3(-2, 0, 0),
      vec3(0, 0, 2),
      vec3(0, 0, -2),
      vec3(2,0,2),
      vec3(-2,0,2),
      vec3(2,0,-2),
      vec3(-2,0,-2),
    ];

    const randomIndex = Math.floor(Math.random() * directions.length);
    const direction = directions[randomIndex];
    const newX = this.x + direction[0] * TANK_WIDTH * 4;
    const newZ = this.z + direction[2] * TANK_DEPTH * 4;

    this.setTargetPosition(newX, newZ);
    this.targetBodyOrientation = Math.atan2(direction[0], direction[2]);

  }

  moveRandomly_v2() {
    this.prev_move_index = this.move_random_index;

    const directions = [
      vec3(2, 0, 0),
      vec3(-2, 0, 0),
      vec3(0, 0, 2),
      vec3(0, 0, -2),
      vec3(2, 0, 0),
      vec3(-2, 0, 0),
      vec3(0, 0, 2),
      vec3(0, 0, -2), // higher probability of horizontal/vertical movement

      vec3(2,0,2),
      vec3(-2,0,2),
      vec3(2,0,-2),
      vec3(-2,0,-2),
    ];
    // console.log(this.prev_x, this.x, this.prev_z, this.z)
    if (this.x === this.prev_x && this.z === this.prev_z) {
      this.move_random_index = Math.floor(Math.random() * directions.length);
      while (this.move_random_index % 4 === this.prev_move_index % 4) {
        this.move_random_index = Math.floor(Math.random() * directions.length);
      }
    }
    else {
      // random movement just cuz...
      const RANDOM_PROB = 0.25;
      if (Math.random() <= RANDOM_PROB) {
        this.move_random_index = Math.floor(Math.random() * directions.length);
      }
    }

    let randomIndex = this.move_random_index;
    let direction = directions[randomIndex];

    const newX = this.x + direction[0] * TANK_WIDTH * 4;
    const newZ = this.z + direction[2] * TANK_DEPTH * 4;

    this.setTargetPosition(newX, newZ);
    this.targetBodyOrientation = Math.atan2(direction[0], direction[2]);
  }

  setTargetPosition(new_x, new_z) {
    this.targetPosition = vec3(new_x, 0, new_z);
    this.reachedTarget = false;
  }

  moveTowardsTarget(dt) {
    this.prev_x = this.x;
    this.prev_z = this.z;

    const direction = this.targetPosition.minus(vec3(this.x, 0, this.z)).normalized();
    const distance = this.targetPosition.minus(vec3(this.x, 0, this.z)).norm();
    let slowFactor = 700;
    if (this.chasePlayer) {
      slowFactor = 700;
    } else if (this.isDodging){
      slowFactor = 600;
    }


    if (distance <= this.movementSpeed * dt) {
      this.x = this.targetPosition[0];
      this.z = this.targetPosition[2];
      this.reachedTarget = true;
    } else {
      for(let i = 0; i <50; i++) {
        let newX = this.x + direction[0]/slowFactor;
        let newZ = this.z + direction[2]/slowFactor;
        if (!this.checkCollision(newX,newZ)) {
          this.x = newX;
          this.z = newZ;
        } else {
          break;
        }
      }
    }
  }

  dodgeBullet(bullet) {
    const bulletPosition = bullet.position.to3();
    const deltaX = bulletPosition[0] - this.x;
    const deltaZ = bulletPosition[2] - this.z;

    let dodgeDirection;

    if (Math.abs(deltaX) > Math.abs(deltaZ)) {
      // Dodge vertically (up or down) if bullet is more horizontal
      dodgeDirection = deltaZ > 0 ? vec3(0, 0, -2) : vec3(0, 0, 2); // Up or down
    } else {
      // Dodge horizontally (left or right) if bullet is more vertical
      dodgeDirection = deltaX > 0 ? vec3(-2, 0, 0) : vec3(2, 0, 0); // Left or right
    }

    const newX = this.x + dodgeDirection[0] * 1.5;
    const newZ = this.z + dodgeDirection[2] * 1.5;

    this.setTargetPosition(newX, newZ);
    this.targetBodyOrientation = Math.atan2(dodgeDirection[0], dodgeDirection[2]);
  }

  detectAndDodgeBullets(dt) {
    this.bulletDodgeTimer += dt;

    if (this.bulletDodgeTimer >= BULLET_CHECK_INTERVAL) {

      for (let bullet of Bullet.activeBullets) {
        if (bullet.hits_enemies) {
          let futurePosition = bullet.position.to3();
          const stepCount = 50; // Number of steps to predict bullet's future position
          const stepSize = BULLET_CHECK_INTERVAL / (stepCount*2);

          for (let i = 0; i < stepCount; i++) {
            futurePosition = futurePosition.plus(bullet.velocity.times(stepSize));
            if (this.willBulletHitTank(futurePosition)) {

              this.isDodging = true;
              this.bulletDodgeTimer = 0;
              this.dodgeBullet(bullet);
              return;
            }
          }
        }
      }
    }

  }

  willBulletHitTank(futurePosition) {
    const tankPosition = vec3(this.x, 0, this.z);
    const distance = futurePosition.minus(tankPosition).norm();
    return distance < DODGE_DISTANCE;
  }

  rotateBodyTowardsTargetAngle(dt) {
    const angleDifference = this.targetBodyOrientation - this.body_orientation;
    let rotationSpeed = Math.PI * this.rotationSpeed * dt;
    if (this.chasePlayer) rotationSpeed=rotationSpeed * 2;

    if (Math.abs(angleDifference) < rotationSpeed) {
      this.body_orientation = this.targetBodyOrientation;
    } else {
      this.body_orientation += Math.sign(angleDifference) * rotationSpeed;
    }
  }

  updatePosition(new_x, new_z, direction = null) {
    this.prev_x = this.x;
    this.prev_z = this.z;

    if (this.type === TANK_TYPE_ENUM.ENEMY_MOVING) {
      console.log(this.prev_x, this.x, this.prev_z, this.z);
    }

    if (direction) {

      // up, down, left, right
      let position_changes = [false, false, false, false]


      // Update X position
      let potential_new_x = new_x;
      if (direction.right && !this.checkCollision(potential_new_x, this.z)) {
        this.x = potential_new_x;
        position_changes[3] = true;
      } else if (direction.left && !this.checkCollision(potential_new_x, this.z)) {
        this.x = potential_new_x;
        position_changes[2] = true;
      }

      // Update Z position
      let potential_new_z = new_z;
      if (direction.up && !this.checkCollision(this.x, potential_new_z)) {
        this.z = potential_new_z;
        position_changes[0] = true;
      } else if (direction.down && !this.checkCollision(this.x, potential_new_z)) {
        this.z = potential_new_z;
        position_changes[1] = true;
      }

      let position_changes_str = JSON.stringify(position_changes)

      // determine correct body orientation based on position_changes
      // RIGHT or LEFT
      if (position_changes_str === "[false,false,true,false]" || position_changes_str === "[false,false,false,true]") {
        this.body_orientation = Math.PI/2;
      }
      // UP-RIGHT or DOWN-LEFT
      if (position_changes_str === "[true,false,false,true]" || position_changes_str === "[false,true,true,false]") {
        this.body_orientation = 3*Math.PI/4;
      }
      // LEFT-RIGHT or DOWN-RIGHT
      if (position_changes_str === "[false,true,false,true]" || position_changes_str === "[true,false,true,false]") {
        this.body_orientation = Math.PI/4;
      }
      if (position_changes_str === "[true,false,false,false]" || position_changes_str === "[false,true,false,false]") {
        this.body_orientation = 0;
      }

    } else {
      // update without collision detection
      this.x = new_x;
      this.z = new_z;
    }
  }

  checkCollision(potential_x, potential_z) {
    let position = vec3(potential_x, 0, potential_z);
    for (let elem of this.map.collisionMap) {
      const tankMin = position.minus(vec3(TANK_WIDTH, 0, TANK_DEPTH));
      const tankMax = position.plus(vec3(TANK_WIDTH, TANK_HEIGHT, TANK_DEPTH));

      const elemMin = elem.position.minus(vec3(elem.size * TANK_SCALE, elem.size * TANK_SCALE, elem.size * TANK_SCALE));
      const elemMax = elem.position.plus(vec3(elem.size * TANK_SCALE, elem.size * TANK_SCALE, elem.size * TANK_SCALE));

      const xOverlap = tankMin[0] <= elemMax[0] && tankMax[0] >= elemMin[0];
      const yOverlap = tankMin[1] <= elemMax[1] && tankMax[1] >= elemMin[1];
      const zOverlap = tankMin[2] <= elemMax[2] && tankMax[2] >= elemMin[2];

      if (xOverlap && yOverlap && zOverlap) {
        return true; // Collision detected
      }
    }
    return this.checkTankCollision(potential_x,potential_z); // No collision
  }

  checkTankCollision(potential_x, potential_z) {
    let position = vec3(potential_x, 0, potential_z);
    let tanks = [this.map.user,...this.map.enemies];
    for (let tank of tanks) {
      if (!tank.dead && tank !== this) {
        const tankMin = position.minus(vec3(TANK_WIDTH * 3, 0, TANK_DEPTH* 2.2));
        const tankMax = position.plus(vec3(TANK_WIDTH* 3, TANK_HEIGHT, TANK_DEPTH* 2.2));

        const otherTankMin = vec3(tank.x - TANK_WIDTH, 0, tank.z - TANK_DEPTH);
        const otherTankMax = vec3(tank.x + TANK_WIDTH, TANK_HEIGHT, tank.z + TANK_DEPTH);

        const xOverlap = tankMin[0] <= otherTankMax[0] && tankMax[0] >= otherTankMin[0];
        const yOverlap = tankMin[1] <= otherTankMax[1] && tankMax[1] >= otherTankMin[1];
        const zOverlap = tankMin[2] <= otherTankMax[2] && tankMax[2] >= otherTankMin[2];
        // console.log("tankMin X: ", tankMin[0], "--- otherTankMax X: ", otherTankMax[0]);
        // console.log("tankMin Z: ", tankMin[2], "--- otherTankMax Z: ", otherTankMax[2]);
        if (xOverlap && yOverlap && zOverlap) {
          return true; // Collision detected with another tank
        }
      }
    }
    return false; // No collision with other tanks
  }

  placeBomb() {
    if (!this.dead && this.type.can_place_bombs && !this.bombActive) {
      this.bombActive = true;
      let bomb = new Bomb(this.map, this.x, this.z, this);
      this.map.bomb_queue.push(bomb);
      AUDIO.BOMB_PLACE_SOUND.cloneNode().play();
    }
  }

  getPosition() {
    return [this.x, this.z];
  }
}

export { Tank, TANK_TYPE_ENUM, TANK_HEIGHT, TANK_WIDTH, TANK_DEPTH }