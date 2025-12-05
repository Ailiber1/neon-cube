import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { CUBE_COLORS, playClickSound } from '../constants';
import { Vector3Tuple, GameState, Move } from '../types';

interface Cube3DProps {
  gameState: GameState;
  onSolve: () => void;
  scramble: boolean;
}

// Helper to round vector for precision issues
const round = (v: number) => Math.round(v);

export const Cube3D: React.FC<Cube3DProps> = ({ gameState, onSolve, scramble }) => {
  // Logical State: 27 Cubes
  // Each cube has a current position (x,y,z) in -1, 0, 1 space.
  // And a rotation quaternion/euler.
  // Visuals: We use a group for the animation.

  // Initial State Generation
  const initialCubelets = useMemo(() => {
    const cubes = [];
    let id = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          cubes.push({
            id: id++,
            initialPos: [x, y, z] as Vector3Tuple,
            currentPos: [x, y, z] as Vector3Tuple,
            rotation: new THREE.Quaternion(), // Identity
            colorMap: {
               // Determine face colors based on initial position
               right: x === 1 ? CUBE_COLORS.R : CUBE_COLORS.CORE,
               left: x === -1 ? CUBE_COLORS.L : CUBE_COLORS.CORE,
               up: y === 1 ? CUBE_COLORS.U : CUBE_COLORS.CORE,
               down: y === -1 ? CUBE_COLORS.D : CUBE_COLORS.CORE,
               front: z === 1 ? CUBE_COLORS.F : CUBE_COLORS.CORE,
               back: z === -1 ? CUBE_COLORS.B : CUBE_COLORS.CORE,
            }
          });
        }
      }
    }
    return cubes;
  }, []);

  const [cubelets, setCubelets] = useState(initialCubelets);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Refs for 3D objects to manipulate directly without full React re-renders during animation
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Group>(null); // The pivot for rotating a slice
  const cubieRefs = useRef<(THREE.Object3D | null)[]>([]);

  // Drag Interaction State
  const interactRef = useRef({
    startFaceNormal: new THREE.Vector3(),
    startPoint: new THREE.Vector3(),
    intersectedCubieId: -1,
    isDragging: false
  });

  // Animation Queue
  const animationQueue = useRef<Move[]>([]);

  // Check Solved State
  const checkSolved = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;
    
    // Solved if every cubie is at initial position and identity rotation
    // Note: We track rotation via quaternions in the refs.
    let solved = true;
    
    // We need to check the LOGICAL state (currentPos) against initialPos.
    // AND check orientation.
    // For simplicity in this demo: we only check if the logical positions match. 
    // Checking orientation is tricky without tracking specific face normals. 
    // However, for a 3x3, if all pieces are in correct position, orientation is usually correct unless we have specific parity, 
    // but in a virtual cube where we only do 90deg turns, matching position AND quaternion roughly equals identity is the check.

    // Let's use the refs world rotation.
    for (let i = 0; i < 27; i++) {
        const c = cubelets[i];
        const ref = cubieRefs.current[c.id];
        if (!ref) continue;

        // Position Check
        if (round(c.currentPos[0]) !== c.initialPos[0] ||
            round(c.currentPos[1]) !== c.initialPos[1] ||
            round(c.currentPos[2]) !== c.initialPos[2]) {
            solved = false;
            break;
        }
        
        // Rotation Check (World Quaternion should be close to Identity)
        // Note: The center (0,0,0) orientation defines the "Identity". 
        // If the user rotated the WHOLE cube (camera move), the mesh rotation is still 0 relative to parent group.
        // But we are rotating SLICES. So mesh rotations change.
        
        // Simplified check: Use a small epsilon for rotation check or strictly tracking logical orientation.
        // For this demo, let's trust the Position check mostly, but adding a check that Up vector points Up is good.
        const up = new THREE.Vector3(0, 1, 0);
        up.applyQuaternion(ref.quaternion);
        if (Math.abs(up.y - 1) > 0.1) {
            solved = false; break;
        }
        
        const front = new THREE.Vector3(0,0,1);
        front.applyQuaternion(ref.quaternion);
        if (Math.abs(front.z - 1) > 0.1) {
             solved = false; break;
        }
    }

    if (solved) {
        onSolve();
    }
  }, [cubelets, gameState, onSolve]);


  // Execute Rotation
  const rotateSlice = useCallback((axis: 'x'|'y'|'z', sliceIndex: number, direction: 1 | -1, duration = 300) => {
    if (!pivotRef.current || !groupRef.current) return Promise.resolve();
    
    setIsAnimating(true);
    playClickSound();

    // 1. Identify affected cubies
    const activeCubies = cubelets.filter(c => round(c.currentPos[axis === 'x' ? 0 : axis === 'y' ? 1 : 2]) === sliceIndex);
    
    // 2. Attach to pivot
    // We need to parent them to the pivot object, preserving world transforms
    pivotRef.current.rotation.set(0,0,0);
    pivotRef.current.position.set(0,0,0);
    pivotRef.current.updateMatrixWorld();

    activeCubies.forEach(c => {
        const mesh = cubieRefs.current[c.id];
        if (mesh) {
            pivotRef.current!.attach(mesh);
        }
    });

    // 3. Animate Pivot
    const startRot = { val: 0 };
    const targetRot = (Math.PI / 2) * direction * -1; // -1 because ThreeJS rotation direction vs Logical direction
    
    return new Promise<void>((resolve) => {
        const startTime = Date.now();
        
        const animate = () => {
            const now = Date.now();
            const progress = Math.min((now - startTime) / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            
            const currentAngle = targetRot * ease;
            
            if (axis === 'x') pivotRef.current!.rotation.x = currentAngle;
            if (axis === 'y') pivotRef.current!.rotation.y = currentAngle;
            if (axis === 'z') pivotRef.current!.rotation.z = currentAngle;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Finish
                if (axis === 'x') pivotRef.current!.rotation.x = targetRot;
                if (axis === 'y') pivotRef.current!.rotation.y = targetRot;
                if (axis === 'z') pivotRef.current!.rotation.z = targetRot;
                
                pivotRef.current!.updateMatrixWorld();
                
                // Detach and update logical state
                activeCubies.forEach(c => {
                    const mesh = cubieRefs.current[c.id];
                    if (mesh) {
                        groupRef.current!.attach(mesh);
                        
                        // Round positions to integers to prevent drift
                        mesh.position.x = round(mesh.position.x);
                        mesh.position.y = round(mesh.position.y);
                        mesh.position.z = round(mesh.position.z);
                        mesh.updateMatrixWorld();
                        
                        // Update logical state
                        // We also need to update the rotation logic if we were tracking it purely logically,
                        // but since we rely on mesh position for the next grab, we update currentPos.
                        c.currentPos = [mesh.position.x, mesh.position.y, mesh.position.z];
                    }
                });
                
                setIsAnimating(false);
                checkSolved();
                resolve();
            }
        };
        animate();
    });
  }, [cubelets, checkSolved]);

  // Scramble Effect
  useEffect(() => {
    if (scramble && !isAnimating) {
      const axes: ('x'|'y'|'z')[] = ['x', 'y', 'z'];
      const slices = [-1, 0, 1];
      const dirs: (1|-1)[] = [1, -1];
      
      const runScramble = async () => {
        for (let i = 0; i < 20; i++) {
             const axis = axes[Math.floor(Math.random() * 3)];
             const slice = slices[Math.floor(Math.random() * 3)];
             const dir = dirs[Math.floor(Math.random() * 2)];
             await rotateSlice(axis, slice, dir, 100); // Fast scramble
        }
      };
      runScramble();
    }
  }, [scramble]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interaction Handlers
  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    if (gameState !== GameState.PLAYING || isAnimating) return;
    
    // Prevent camera move if we clicked the cube
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    if (e.face?.normal) {
        interactRef.current.startFaceNormal.copy(e.face.normal);
        // Transform normal to world space if object is rotated (though cubies rotate, so local normal is face normal)
        // e.face.normal is local to the geometry. The mesh is rotated. 
        // We need world normal.
        const normalMatrix = new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld);
        const worldNormal = e.face.normal.clone().applyMatrix3(normalMatrix).normalize();
        
        // Snap world normal to nearest axis to avoid slight angle issues
        const maxComp = Math.max(Math.abs(worldNormal.x), Math.abs(worldNormal.y), Math.abs(worldNormal.z));
        if (Math.abs(worldNormal.x) === maxComp) worldNormal.set(Math.sign(worldNormal.x), 0, 0);
        else if (Math.abs(worldNormal.y) === maxComp) worldNormal.set(0, Math.sign(worldNormal.y), 0);
        else worldNormal.set(0, 0, Math.sign(worldNormal.z));

        interactRef.current.startFaceNormal.copy(worldNormal);
        interactRef.current.startPoint.copy(e.point);
        interactRef.current.isDragging = true;
        
        // Find which cubie was clicked
        // e.object is the mesh. We can find it in our refs or by user data.
        // But simpler: we know the mesh from the event.
        const obj = e.object;
        const index = cubieRefs.current.indexOf(obj);
        interactRef.current.intersectedCubieId = index;
    }
  };

  const handlePointerUp = (e: ThreeEvent<PointerEvent>) => {
     if (!interactRef.current.isDragging) return;
     interactRef.current.isDragging = false;
     (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactRef.current.isDragging || isAnimating || interactRef.current.intersectedCubieId === -1) return;

    const moveVector = e.point.clone().sub(interactRef.current.startPoint);
    
    // Threshold to trigger move
    if (moveVector.length() < 0.25) return; // Wait for significant drag
    
    interactRef.current.isDragging = false; // Trigger once per drag

    const normal = interactRef.current.startFaceNormal;
    const cubie = cubelets[interactRef.current.intersectedCubieId];
    
    // Determine drag direction relative to camera/world
    // We have the normal of the face we clicked. 
    // The move vector is in world space.
    // We project the move vector onto the plane defined by the normal? 
    // Actually, Rubik's moves are perpendicular to the normal.
    
    let axis: 'x'|'y'|'z' = 'x';
    let direction: 1 | -1 = 1;
    let slice = 0;

    // Logic to determine axis of rotation based on normal and drag vector.
    // If Normal is X (Left/Right face), we can rotate around Y or Z.
    // Drag has Y and Z components.
    
    const absX = Math.abs(moveVector.x);
    const absY = Math.abs(moveVector.y);
    const absZ = Math.abs(moveVector.z);

    if (Math.abs(normal.x) > 0.5) {
       // Clicked side face. Drag mostly Y -> Rotate Z. Drag mostly Z -> Rotate Y.
       if (absY > absZ) {
          // Dragging Vertical (Y) on Side Face -> Rotating around Z axis.
          axis = 'z';
          slice = round(cubie.currentPos[2]);
          // Direction logic: Up (Y+) on Right Face (X+) -> Z Rotation? 
          // Right Hand Rule. Z axis points out. 
          // If X=1, Drag Y+, Rotate Z (-1 direction?)
          // Let's rely on vector cross products or simple heuristics.
          // Cross(Normal, Move) gives roughly the axis of rotation.
          direction = (moveVector.y * normal.x > 0) ? -1 : 1;
       } else {
          // Dragging Horizontal (Z) -> Rotating around Y axis.
          axis = 'y';
          slice = round(cubie.currentPos[1]);
          direction = (moveVector.z * normal.x > 0) ? 1 : -1;
       }
    } else if (Math.abs(normal.y) > 0.5) {
       // Clicked Top/Bottom.
       if (absX > absZ) {
          // Drag X -> Rotate Z
          axis = 'z';
          slice = round(cubie.currentPos[2]);
          direction = (moveVector.x * normal.y > 0) ? 1 : -1;
       } else {
          // Drag Z -> Rotate X
          axis = 'x';
          slice = round(cubie.currentPos[0]);
          direction = (moveVector.z * normal.y > 0) ? -1 : 1; 
       }
    } else {
       // Clicked Front/Back (Z)
       if (absX > absY) {
          // Drag X -> Rotate Y
          axis = 'y';
          slice = round(cubie.currentPos[1]);
          direction = (moveVector.x * normal.z > 0) ? -1 : 1; 
       } else {
          // Drag Y -> Rotate X
          axis = 'x';
          slice = round(cubie.currentPos[0]);
          direction = (moveVector.y * normal.z > 0) ? 1 : -1;
       }
    }

    rotateSlice(axis, slice, direction);
  };

  return (
    <group ref={groupRef}>
        <group ref={pivotRef} />
        {cubelets.map((c, i) => (
            <Cubie 
                key={c.id} 
                data={c} 
                ref={(el) => (cubieRefs.current[c.id] = el)}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
                onPointerMove={handlePointerMove}
            />
        ))}
    </group>
  );
};

// Individual Cubie Component
const Cubie = React.forwardRef<THREE.Mesh, { 
    data: any, 
    onPointerDown: any,
    onPointerUp: any,
    onPointerMove: any
}>(({ data, onPointerDown, onPointerUp, onPointerMove }, ref) => {
    // A Cubie is a rounded box with 6 materials
    const materials = [
        new THREE.MeshStandardMaterial({ color: data.colorMap.right, roughness: 0.1, metalness: 0.1 }), // +x
        new THREE.MeshStandardMaterial({ color: data.colorMap.left, roughness: 0.1, metalness: 0.1 }), // -x
        new THREE.MeshStandardMaterial({ color: data.colorMap.up, roughness: 0.1, metalness: 0.1 }), // +y
        new THREE.MeshStandardMaterial({ color: data.colorMap.down, roughness: 0.1, metalness: 0.1 }), // -y
        new THREE.MeshStandardMaterial({ color: data.colorMap.front, roughness: 0.1, metalness: 0.1 }), // +z
        new THREE.MeshStandardMaterial({ color: data.colorMap.back, roughness: 0.1, metalness: 0.1 }), // -z
    ];

    return (
        <RoundedBox
            ref={ref}
            args={[0.95, 0.95, 0.95]} // Slightly smaller than 1 to show gaps
            radius={0.05}
            smoothness={4}
            position={data.initialPos}
            material={materials}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerMove={onPointerMove}
            castShadow
            receiveShadow
        />
    )
});
Cubie.displayName = "Cubie";
