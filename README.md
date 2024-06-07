# CS174A Tanks!
Created by [Alyssa Tadeo](https://github.com/ajtadeo), [Artemis Tran](https://github.com/Artemis-Tran), and [Kevin Zhang](https://github.com/KevZ1209) for UCLA CS174A Spring 2024.

Play now: [https://kevz1209.github.io/CS174A-Tanks/](https://kevz1209.github.io/CS174A-Tanks/)

## Overview
Tanks! is a recreation of the classic Wii Play "Tanks!" game using the Tiny Graphics library. 
This game features a user controled a tank via mouse and keyboard to avoid enemy fire, shooting bullets that ricochet off walls, and placing bombs which explode after a duration or can be exploded by a bullet.
The goal of the game is to eliminate all enemy tanks without getting hit before the level timer ends, and advance through all possible levels to win the game!

## Features
### Modeling
<img src="https://github.com/KevZ1209/CS174A-Tanks/assets/76643809/4c5e5887-d2c2-4295-8236-26cdc0d8c6f4" alt="IMG_2128" width="300"/>
<br/>
<br/>

Tanks are modeled using a 3D object mesh made in Blender which separates the body from the turret for isolated animations.
Basic Cube, Square, and Sphere models from Tiny Graphics are used for all other objects.

### Transformations
<div>
  <img src="https://github.com/KevZ1209/CS174A-Tanks/assets/76643809/8fb23bb9-9b2e-451a-8f19-e73d01ed7b0c" height="200">
  <img src="https://github.com/KevZ1209/CS174A-Tanks/assets/76643809/9706b8c5-4497-4ff3-9694-d0a114189442" height="200">
</div>

Tanks translate and rotate about the game map. Bullets translate in one direction with a given velocity (based on bullet type: Normal, Fast, or User)

### Lighting, Shading, and Textures
The map is lit from above to simulate room lighting.
Tanks, Bullets, and Bombs are shaded with Phong Shaders to simulate a plastic look as if the models were toys.
All other objects such as wood blocks, cork blocks, game banners, dead tank markers, and map holes are shaded with Textured Phong Shaders with graphics designed in Photoshop or textures pulled from the web.

### Particles
Smoke from bullets and collisions are generated through particles which have numerous parameters such as opacity, color, lifetime and scale to mimic realistic physics.
Each particle is created with subdivision_spheres(1) to improve performance.

## Interactivity
* WASD keys control the translation of the user tank body
* Using a mousedown event handler, user shoots a bullet towards the cursor position
* Using a mousemove event handler, the user tank turret rotates to the cursor position and the cursor is replaced with a target
* E key places a bomb at the user’s current position
* Enter key starts the game from the initial loading screen

For our cursor-based interactivity, we had to converting screen space coordinates to world space coordinates to create a seamless connection between the user and the game world.
1. Transform mouse position to normalized device coordinates
2. Transform position to world space: $$(Projection(ModelView)*Object)^{-1}$$
3. Find intersection between WS position and ground plane (y = 4.3 in order to avoid clipping with tall map obstacles)

## Advanced Features
### Game Loop
![image1](https://github.com/KevZ1209/CS174A-Tanks/assets/76643809/b9942327-7af9-4028-b017-230c7ebbbc84)
Every 5 levels, the user gets an extra life!

### Physics-based Collision Detection
Collision detection is accomplished by approximating collision boundaries with AABB via hitboxes for Tanks, Bullets, and Obstacles.
* Tank-Obstacles
* Tank-Tank
* Bullet-Obstacles
* Bullet-Tank
* Bullet-Bullet
* Bullet-Bomb

Bullet ricochet is calculated using the formula for light reflections to get a realistic result.
$$\vec V_{new}=\vec V - \vec N(2(\vec V \cdot \vec N))$$

### Map Generation
Each level map is defined as a text file where each character corresponds to a block type or tank type.
Before each level state in the game loop, the schematic is parsed and the locations, textures, and types of each map element is stored in game memory to be used for collision detection.
| Element                            | Schematic Encoding |
|------------------------------------|--------------------|
| Empty                              | 0                  |
| Block (1 height)                   | 1                  |
| Cork (1 height)                    | 2                  |
| Hole                               | 3                  |
| Block (2 height)                   | 4                  |
| Cork (2 height)                    | 5                  |
| Block (3 height)                   | 6                  |
| Cork (3 height)                    | 7                  |
| User                               | *                  |
| Stationary Enemy (tan)             | s                  |
| Moving Enemy (brown)               | m                  |
| Moving Bomb Enemy (yellow)         | b                  |
| Moving Fast Shooting Enemy (green) | f                  |
| Moving Fast Reload Enemy (red)     | r                  |

### Intelligence Artificial (IA)
<div>
  <img src="https://github.com/KevZ1209/CS174A-Tanks/assets/76643809/2f0c3f49-6664-4f96-bdaa-80405628e625" width="300">
  <img src="https://github.com/KevZ1209/CS174A-Tanks/assets/76643809/d6ac8235-feba-4362-a403-2209b2a54849" width="300">
</div>

#### Movement
* The Tourist: moves in a chosen direction until it hits a wall or randomly changes direction.
* The Pro Gamer: dodges bullets if it gets too close
* The Bestie: follows you if close

#### Shooting
* Shoots random directions if user not detected.	
* Shoots directly at user upon detection.

