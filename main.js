import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';


const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight, .01, 100 );
const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

scene.background = new THREE.Color( 'black' );
scene.fog = new THREE.Fog( 0xa0a0a0, 10, 50 );

//Lighting
const hemiLight = new THREE.HemisphereLight( 0xffffff, 0x8d8d8d, 5 );
hemiLight.position.set( 0, 5, 0 );
scene.add( hemiLight );

// Add global lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 1); // Intensity ranges from 0 to 1
scene.add(ambientLight);

// Add a directional light
const directionalLight = new THREE.DirectionalLight(0xffffff, 3); // Intensity ranges from 0 to 1
directionalLight.position.set(1, 1, 1); // Position the light source
scene.add(directionalLight);

let gltfModel;
let selectedObject = null; // Currently selected object

// Load GLTF model
const loader = new GLTFLoader();

loader.load('/SkeletonBowman1.glb', (gltf) => {
    gltfModel = gltf.scene;
    scene.add(gltfModel);
});

// Create an outline pass
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);
const outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
composer.addPass(outlinePass);

// Handle mouse click to select parts
renderer.domElement.addEventListener('click', (event) => {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Calculate mouse position
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    // Set raycaster
    raycaster.setFromCamera(mouse, camera);

    // Find intersected objects
    const intersects = raycaster.intersectObjects(gltfModel.children, true);

   // Process selection
   if (intersects.length > 0) {
	const clickedObject = intersects[0].object;
	
	// If the clicked object is the currently selected object, deselect it
	if (selectedObject === clickedObject) {
		deselectObject(selectedObject);
	} else {
		// Deselect the previous object and select the clicked object
		deselectObject(selectedObject);
		selectObject(clickedObject);
	}
    }
});

// Function to select an object
function selectObject(object) {
    selectedObject = object;
    outlinePass.selectedObjects = [object];
}

// Function to deselect an object
function deselectObject(object) {
    if (object) {
        selectedObject = null;
        outlinePass.selectedObjects = [];
    }
}

// Handle keyboard input
document.addEventListener('keydown', (event) => {
    if (event.key === 'Delete') {
        deleteSelectedObject();
    }
});

/*// Function to delete selected object
function deleteSelectedObject() {
    if (selectedObject) {
        gltfModel.remove(selectedObject);
        deselectObject(selectedObject);
    }
}
*/

//undo history
const deletedObjectsHistory = [];

// Modify the deleteSelectedObject function to store deleted objects in history
function deleteSelectedObject() {
    if (selectedObject) {
        const deletedObject = {
            object: selectedObject,
            position: selectedObject.position.clone(), // Store the position for restoration
        };
        gltfModel.remove(selectedObject);
        deselectObject(selectedObject);
        deletedObjectsHistory.push(deletedObject);
    }
}

// Implement the undoDelete function to restore the last deleted object
function undoDelete() {
    if (deletedObjectsHistory.length > 0) {
        const lastDeletedObject = deletedObjectsHistory.pop();
        gltfModel.add(lastDeletedObject.object);
        lastDeletedObject.object.position.copy(lastDeletedObject.position);
    }
}

// Handle keyboard input for Ctrl+Z (undo)
document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'z') {
        undoDelete();
    }
});

const controls = new OrbitControls( camera, renderer.domElement );

//controls.update() must be called after any manual changes to the camera's transform
camera.position.set( -0.03, 0.02, .06 );
controls.update();

// Set the initial target position (center of the world)
const target = new THREE.Vector3(0, .020, 0); // Adjust the y-coordinate here for height
controls.target.copy(target); // Set the target position for the camera

// Set constraints on OrbitControls
controls.maxDistance = .1; // Maximum distance for zooming out
controls.enablePan = true; // "true" enables, "false" disables panning

// Setup GUI
const gui = new GUI();

// Add a folder for loading GLTF files
const loadFolder = gui.addFolder('Load GLTF');

// Define a list of GLTF file options
const gltfOptions = {
    'Skeleton Bowman 1': '/SkeletonBowman1.glb',  // Path to your existing GLTF file
    'Skeleton Bowman 2': '/SkeletonBowman2.glb',
    'Skeleton Bowman 3': '/SkeletonBowman3.glb',
    'Skeleton Bowman 4': '/SkeletonBowman4.glb',
    'Skeleton Bowman 5': '/SkeletonBowman5.glb',
    // Add more options as needed
};

// Create a dropdown list to select GLTF files
loadFolder.add(gltfOptions, 'Model', Object.keys(gltfOptions)).onChange(loadNewModel);

// Function to load a new GLTF model
function loadNewModel(selectedModel) {
  // Remove the current model from the scene
  if (gltfModel) {
      scene.remove(gltfModel);
  }

  // Load the selected GLTF model
  loader.load(gltfOptions[selectedModel], (gltf) => {
      gltfModel = gltf.scene;
      scene.add(gltfModel);
  });
}


// Add a folder for exporting STL
const exportFolder = gui.addFolder('Export');

// Create a button to trigger STL export
exportFolder.add({ Export: exportSTL }, 'Export').name('STL');

//STL EXPORT
function exportSTL() {
    const exporter = new STLExporter();

    const stlData = exporter.parse(scene, { binary: true });

    const blob = new Blob([stlData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = 'SkeletonBowman.stl';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}



function animate() {
	requestAnimationFrame( animate );

		// required if controls.enableDamping or controls.autoRotate are set to true
		controls.update();

	// Not needed 
	//renderer.render( scene, camera );
	
	composer.render(); // Use the composer to render the scene with effects
}

animate();