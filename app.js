// import * as THREE from 'three';

var options = {
    TOTAL_ATOMS:10,
    DENSITY:0.5,
    HALF_LIFE:5,

};

options.RestoreDefaults = function() {
  options = {
    TOTAL_ATOMS:10,
    DENSITY:0.5,
    HALF_LIFE:5,
};
  
}
options.Restart = function() {
    reset();
}
options.Pause = function() {
  pause = !pause;
}

// dat GUI
var gui = new dat.GUI();
var f = gui.addFolder('Environment');
f.open();

var fTotalAtomsE = f.add(options, 'TOTAL_ATOMS', 1, 1000);
fTotalAtomsE.onFinishChange(function(value) {
    // Fires when a controller loses focus.
    reset();
});

var fHalfLifeE = f.add(options, 'HALF_LIFE', 1, 10);
fHalfLifeE.onFinishChange(function(value) {
    // Fires when a controller loses focus.
    reset();
});

f = gui.addFolder('Start');
f.open();

var fDensityE = f.add(options, 'DENSITY', 1e-100,1.0);
fDensityE.onFinishChange(function(value) {
    reset();
});


f.add(options, 'Pause');
f.add(options, 'Restart');
f.add(options, 'RestoreDefaults');

var timeBegin = new Date();
var lookAt = new THREE.Vector3();



var SPHERE_SIDES = 12;

var zoom = 1.0;
var translate = new THREE.Vector3();


var atoms = [];
var now;
var then = Date.now();
var renderInterval = 1000/parseInt(options.framerate);
var renderDelta;

var scene = new THREE.Scene({castShadow:true});
var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight,0.1,100000000.0);
var renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias:true });
//var projector = new THREE.Projector();


var controls = new THREE.OrbitControls( camera, renderer.domElement );

// END dat GUI


scene.castShadow=true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClearColor = true;

// Add renderer to set color to white
renderer.setClearColor( 0xffffff );



class Sphere {
    constructor(scene, x, y, z, color) {
        this.scene = scene;
        this.geometry = new THREE.SphereGeometry(90, SPHERE_SIDES, SPHERE_SIDES);
        this.material =  new THREE.MeshPhongMaterial({
            ambient: 0x111111, color: color, specular: color, shininess: 50, emissive:0x000000
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.set(x, y, z);
        this.scene.add(this.mesh);
    }

    position(){   
        //console.log(this.mesh.position); 
        return this.mesh.position;
    }

    delete() {
        this.scene.remove(this.mesh);
    }
}
      


class Atom {
    constructor(color1, color2, loc) {
        this.location = loc;
        this.scene = scene;
        this.color1 = color1;
        this.color2 = color2;
        this.shockwaveSphere = null;
        this.spheres = [];
        this.decay = false;
        this.decaySphere = [];
        this.halflife = false;
        this.shake = true;
        this.alphadecay = false;
        this.done = false;
    
        this.shockwaveMaterial = new THREE.MeshPhongMaterial({
            color: 0xffff00, shininess: 40, 
            opacity: 0.4,     // Semi-transparent
            transparent: true
            });
        
        this.shockwaveSphere = new THREE.Mesh(
            new THREE.SphereGeometry(1000, SPHERE_SIDES, SPHERE_SIDES),
            this.shockwaveMaterial
        );

        this.shockwaveSphere.position.set(this.location.x, this.location.y, this.location.z);
        this.shockwaveSphere.visible = false;

        this.acceleration_x = (Math.random() * (100 - 50) + 50) * (this.getRandomInt(1, 10) % 2 == 0 ? 1 : -1);
        this.acceleration_y = (Math.random() * (100 - 50) + 50) * (this.getRandomInt(1, 10) % 2 == 0 ? 1 : -1);
        this.acceleration_z = (Math.random() * (100 - 50) + 50) * (this.getRandomInt(1, 10) % 2 == 0 ? 1 : -1);


        // // Create a text geometry
        // const textGeometry = new THREE.TextGeometry('211PO', {
        //     font: new THREE.FontLoader().load('path/to/your/font.json'), // Replace with the path to your font file
        //     size: 50,
        //     height: 5,
        //     curveSegments: 6,
        //     bevelEnabled: true,
        //     bevelThickness: 2,
        //     bevelSize: 1,
        //     bevelSegments: 5
        // });

        // const textMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

        // // Create a text mesh
        // const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        // textMesh.position.set(this.location.x, this.location.y + 150, this.location.z); // Adjust the position as needed

        // // Add the text mesh to the scene
        // this.scene.add(textMesh);


        scene.add(this.shockwaveSphere);
        this.createAtom();
        this.createDecayAtom();
    }

    changeColor(){
        for (let i = 0; i < this.spheres.length; i++) {
            const sphere = this.spheres[i];
            const originalColor = sphere.material.color.getHex();

            // Check if the original color is red or blue
            if (originalColor === 0xff0000) { // Red
                // Change red to yellow (0xffff00)
                sphere.material.color.setHex(0xffff00);
            } else if (originalColor === 0x0000ff) { // Blue
                // Change blue to green (0x00ff00)
                sphere.material.color.setHex(0x00ff00);
            }
            this.dead = true;
        }
    }
    
    changeHalfColor(){
        for (let i = 0; i < this.spheres.length/2; i++) {
            const sphere = this.spheres[i];
            const originalColor = sphere.material.color.getHex();

            // Check if the original color is red or blue
            if (originalColor === 0xff0000) { // Red
                // Change red to yellow (0xffff00)
                sphere.material.color.setHex(0xffff00);
            } else if (originalColor === 0x0000ff) { // Blue
                // Change blue to green (0x00ff00)
                sphere.material.color.setHex(0x00ff00);
            }
            this.dead = true;
        }
    }

    createSphere(x, y, z, color) {
        const sphere = new Sphere(this.scene, x, y, z, color);
        this.spheres.push(sphere);
    }
    
    createDecaySphere(x, y, z, color) {
        const sphere = new Sphere(this.scene, x, y, z, color);
        this.decaySphere.push(sphere);
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    decayExplode(){       
        this.shake = false; 
        for(let i = 0; i < this.decaySphere.length; i++)
        {
            if (Math.abs(this.decaySphere[i].position().x - this.location.x) > 6000) {
                this.decay = true;
                this.changeColor();
                return;
            }
            this.decaySphere[i].position().x += this.acceleration_x;
            this.decaySphere[i].position().y += this.acceleration_y;
            this.decaySphere[i].position().z += this.acceleration_z;
        }   
    }
    
    createAtom() {
        for (let i = 0; i < 3; i++) {
        let y = -200 + i * 200;
        let color = this.getRandomInt(1, 10) % 2 == 0 ? this.color1 : this.color2;
        this.createSphere(this.location.x, this.location.y + y, this.location.z, color);
        }
    
        for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = Math.cos(angle) * 200;
        const z = Math.sin(angle) * 200;
        let color = this.getRandomInt(1, 10) % 2 == 0 ? this.color1 : this.color2;
        this.createSphere(this.location.x + x, this.location.y, this.location.z + z, color);
        }
    
        // Add other spheres and their positions here...
    
        for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const x = Math.cos(angle) * 150;
        const z = Math.sin(angle) * 150;
        let color = this.getRandomInt(1, 10) % 2 == 0 ? this.color1 : this.color2;
        this.createSphere(this.location.x + x, this.location.y + 135, this.location.z + z, color);
        }
    
        for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2;
        const x = Math.cos(angle) * 150;
        const z = Math.sin(angle) * 150;
        let color = this.getRandomInt(1, 10) % 2 == 0 ? this.color1 : this.color2;
        this.createSphere(this.location.x + x, this.location.y - 135, this.location.z + z, color);
        }
    }

    createDecayAtom(){
        // for (let i = 0; i < 2; i++) {
        //     let color =  this.color1;
        //     this.createDecaySphere(this.location.x, this.location.y, this.location.z, color);
        // }
        // for (let i = 0; i < 2; i++) {
        //     let color =  this.color2;
        //     this.createDecaySphere(this.location.x, this.location.y, this.location.z, color);
        // }
        for (let i = 0; i < 2; i++) {
            let color =  this.color1;
            let x = i * 200;
            this.createDecaySphere(this.location.x + x, this.location.y, this.location.z, color);
        }
        for (let i = 0; i < 2; i++) {
            let color =  this.color2;
            let y = -100 + (i * 200);
            this.createDecaySphere(this.location.x + 100, this.location.y + y, this.location.z, color);
        }
    }

    shakeAtom() {
        const shakeIntensity = 7; // Adjust the intensity of the shake as needed
        for (let i = 0; i < this.spheres.length; i++) {
            //console.log("hello");
            const sphere = this.spheres[i];
            const offsetX = (Math.random() - 0.5) * shakeIntensity;
            const offsetY = (Math.random() - 0.5) * shakeIntensity;
            const offsetZ = (Math.random() - 0.5) * shakeIntensity;
    
            const newPosition = new THREE.Vector3(
            sphere.mesh.position.x + offsetX,
            sphere.mesh.position.y + offsetY,
            sphere.mesh.position.z + offsetZ
            );
    
            sphere.mesh.position.copy(newPosition);
        }
    }




    updateShockwave() {
        // Increase the scale of the shockwave
        this.shockwaveSphere.visible = true;
        this.shockwaveSphere.scale.x += 0.1;
        this.shockwaveSphere.scale.y += 0.1;
        this.shockwaveSphere.scale.z += 0.1;

        // Make the shockwave disappear
        this.shockwaveSphere.material.opacity -= 0.01;

        // Reset the shockwave after a certain scale and opacity
        if (this.shockwaveSphere.scale.x > 6) {
            this.shockwaveSphere.scale.x = 0;
            this.shockwaveSphere.scale.y = 0;
            this.shockwaveSphere.scale.z = 0;
        }
    }
    
    startInfiniteShake(intervalTime) {
        //console.log("im here");
        this.infiniteShakeInterval = setInterval(() => {
            this.shakeAtom();
        }, intervalTime);
    }
    
    stopInfiniteShake() {
        //console.log("hello");
        clearInterval(this.infiniteShakeInterval);
    }
    
    
    moveSphere(index, x, y, z) {
        if (index >= 0 && index < this.spheres.length) {
        this.spheres[index].position.set(this.location.x, this.location.y, this.location.z);
        }
    }
}
      


//renderer.shadowMapEnabled=true;
document.body.appendChild(renderer.domElement);



// add subtle ambient lighting
// directional lighting
var ambientLight = new THREE.AmbientLight(0x222222);
scene.add(ambientLight);

// var selectionLight = new THREE.PointLight(0xff0000,0);
// selectionLight.castShadow = true;
// scene.add(selectionLight);

var redLight = new THREE.DirectionalLight(0xff9922);
redLight.position.set(1, 2, 0);
scene.add(redLight);


var blueLight = new THREE.DirectionalLight(0x2288ff);
blueLight.position.set(0,-1, -1);
scene.add(blueLight);

// var greenLight = new THREE.DirectionalLight(0x00aa00);
// greenLight.position.set(0, 1, 1);
// scene.add(greenLight);

var $real_framerate = $("#real_framerate");
var $framerate = $("#framerate");
$framerate.bind("change keyup mouseup",function() {
    var v = parseInt(this.value);
    if (v > 0) {
        //options.framerate = v;
        renderInterval = 1000/parseInt(options.framerate);
    }
}).change();
var $total_mass = $("#total_mass");
var $maximum_mass = $("#maximum_mass");
var $fps = $("#fps");
var displayMass = false;
reset();

var pause = false;

function draw(atoms) {
    requestAnimationFrame(draw);
    now = Date.now();
    renderDelta = now - then;    
    render(renderDelta);
    then = now;
}
draw(atoms);

function render(dt) {

    var timeNow = new Date();

    if(atoms && atoms.length){
        if (!pause) {
            for(var i = 0; i < atoms.length; i++){
                let p;
                let elapsedTime = timeNow - timeBegin;
                if(elapsedTime >= 100000)
                {
                    p = 100;
                }
                else if(elapsedTime >= 100000)
                {
                    p = 25;
                }
                else if(elapsedTime >= 5000)
                {
                    p = 20;
                }
                else if(elapsedTime >= 4000)
                {
                    p = 15;
                }
                else if(elapsedTime >= 3000)
                {
                    p = 10;
                }
                else if(elapsedTime >= 2000)
                {
                    p = 5;
                }
                else if(elapsedTime >= 1000)
                {
                    p = 1;
                }

                let randomNumber = Math.floor(Math.random() * (3000)) + 1;
                if(!atoms[i].done && (p >= randomNumber || atoms[i].alphadecay))
                {
                    //console.log(timeNow - timeBegin);
                    atoms[i].alphadecay = true;
                    if(!atoms[i].decay)
                    {
                        atoms[i].updateShockwave();
                        atoms[i].decayExplode();
                        atoms[i].changeColor();
                    }
                    else
                    {
                        if(atoms[i].decaySphere)
                        {
                            for(let j = 0; j < atoms[i].decaySphere.length; j++)
                            {
                                atoms[i].decaySphere[j].delete(); 
                            }
                            atoms[i].done = true;
                        }
                    }
                   
                }

                if(elapsedTime >= (1000 * parseInt(options.HALF_LIFE)))
                {
                    //sudah halflife
                    if(!atoms[i].halflife)
                    {
                        atoms[i].halflife = true;
                        atoms[i].changeHalfColor();
                    }
                }
                
                if(atoms[i].shake)
                {
                    const shakeIntensity = 7; // Adjust the intensity of the shake as needed
                    for (let j = 0; j < atoms[i].spheres.length; j++) {
                        //console.log("hello");
                        //console.log(j);
                        const sphere = atoms[i].spheres[j];
                        const offsetX = (Math.random() - 0.5) * shakeIntensity;
                        const offsetY = (Math.random() - 0.5) * shakeIntensity;
                        const offsetZ = (Math.random() - 0.5) * shakeIntensity;
                
                        const newPosition = new THREE.Vector3(
                            sphere.mesh.position.x + offsetX,
                            sphere.mesh.position.y + offsetY,
                            sphere.mesh.position.z + offsetZ
                        );
                
                        sphere.mesh.position.copy(newPosition);
                    }
                }
            }
        }
    }

    controls.update();
    renderer.render(scene, camera);
}


window.onmousemove = function(e) {
    if (onMouseDown) onMouseDown.moved=true;

    var vector = new THREE.Vector3( ( e.clientX / window.innerWidth ) * 2 - 1, - ( e.clientY / window.innerHeight ) * 2 + 1, 0.5 );
    //projector.unprojectVector( vector, camera );

    vector.unproject(camera);

    var raycaster = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );

    var intersects = raycaster.intersectObjects( scene.children );

    if ( intersects.length > 0 ) {
        $("body").css("cursor","pointer");
    } else {
        $("body").css("cursor","default");
    }

}

var onMouseDown = false;
var theta= 0,phi=0;
var currentRadius = 15000.0;
setCamera();
window.onmousedown = function(e) {
    if (e.target.tagName === "CANVAS") {
        onMouseDown = {moved:false};
    }
}
window.onmouseup = function(e) {
    if (e.target.tagName === "CANVAS") {
        if (!onMouseDown.moved) {
            var vector = new THREE.Vector3( ( e.clientX / window.innerWidth ) * 2 - 1, - ( e.clientY / window.innerHeight ) * 2 + 1, 0.5 );
            vector.unproject(camera);
            var raycaster = new THREE.Raycaster( camera.position, vector.sub( camera.position ).normalize() );
            var intersects = raycaster.intersectObjects( scene.children );
            if ( intersects.length > 0 ) {
                var clickedObj = (intersects[0].object);
                isMoverSelected = false;
                for  (var i = 0; i<movers.length; i=i+1) {
                    if (movers[i].mesh == clickedObj) {
                        movers[i].selected = !movers[i].selected;
                        isMoverSelected = movers[i].selected;
                        console.log("SELECTED p#"+i);
                    } else {
                        movers[i].selected = false;
                    }
                }

            }else {
                isMoverSelected = false;
            }
        }
    }
    onMouseDown = false;
}

window.onresize = function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
};
var holdLeft = false,holdRight = false,holdUp = false,holdDown = false;

console.log("window addEventListener");
window.addEventListener("keydown", function(e) {
  console.log("keydown ", e.which);
  if (e.which == 37) {
        holdLeft = true;
    } else if (e.which == 38) {
        holdUp = true;      
    } else if (e.which == 39) {
        holdRight = true;
    } else if (e.which == 40) {
        holdDown = true;
//    } else if (e.which === 82) {
//        reset();
    } else if (e.which === 84) {        // [T]rails
        $activate_trails.prop("checked", !$activate_trails.prop("checked")).change();

    } else if (e.which === 32) {
        pause = !pause;
      console.log("pause", pause);  
        e.preventDefault();
        return false;
    } else {
       console.log(e.which);
    }
});

window.addEventListener("keyup", function(e) {
    if (e.which == 37) {
        holdLeft = false;
    } else if (e.which == 38) {    
        holdUp = false;
    } else if (e.which == 39) {
        holdRight = false;
    } else if (e.which == 40) {
        holdDown = false;
    }
});


function reset() {
    timeBegin = new Date();

    // if there is atom, delete all mesh
    if (atoms) {
        // console.log("hello");
        // console.log(atoms.length);
        for (var i = 0; i < atoms.length; i = i + 1) {
          let spheres = atoms[i].spheres;
          let decaySpheres = atoms[i].decaySphere;
          //console.log(decaySpheres);
          for (var j = 0; j < decaySpheres.length; j = j + 1) {
            decaySpheres[j].delete(); // Corrected the loop variable and method invocation
          }
          for (var j = 0; j < spheres.length; j = j + 1) {
            spheres[j].delete(); // Corrected the loop variable and method invocation
          }
          scene.remove(atoms[i].shockwaveSphere);
        }
      }
      
    atoms = [];
    translate.x = 0.0;
    translate.y = 0.0;
    translate.z = 0.0;

    // INI FUNGSI UNTUK GENERATE SEMUA ATOMNYA UNCOMMENT YANG PUSH ATOM
    // generate N movers with random mass (N = TOTAL_ATOMS)
    for (var i=0;i<parseInt(options.TOTAL_ATOMS);i=i+1) {

        var max_distance = parseFloat(1000 / options.DENSITY);

        var loc = new THREE.Vector3(random(-max_distance,max_distance),random(-max_distance,max_distance),random(-max_distance,max_distance));

        atoms.push(new Atom(0xff0000, 0x0000ff, loc));
    }
}
function random(min, max) {
    return Math.random() * (max - min) + min;
}
function constrain(value,min,max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function setCamera() {

    camera.position.x = currentRadius * Math.sin( theta * Math.PI / 360 ) * Math.cos( phi * Math.PI / 360 );
    camera.position.y = currentRadius * Math.sin( phi * Math.PI / 360 );
    camera.position.z = currentRadius * Math.cos( theta * Math.PI / 360 ) * Math.cos( phi * Math.PI / 360 );
    // camera.lookAt(mesh.position);
    camera.lookAt(new THREE.Vector3(0,0,0));
    camera.updateMatrix();
}