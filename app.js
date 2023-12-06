var options = {
    framerate:60,
    G:10,
    START_SPEED:0,
    MOVER_COUNT:10,
    TRAILS_DISPLAY:false,
    TRAILS_LENGTH:200,
    MIN_MASS:100,
    MAX_MASS:1000,
    DENSITY:0.1,

};

if (localStorage && localStorage.getItem("options")) options = JSON.parse(localStorage.getItem("options"));

options.RestoreDefaults = function() {
  options = {
    framerate:60,
    G:10,
    START_SPEED:0,
    MOVER_COUNT:10,
    TRAILS_DISPLAY:false,
    TRAILS_LENGTH:200,
    MIN_MASS:100,
    MAX_MASS:1000,
    DENSITY:0.1,
};
  
  if (localStorage) localStorage.setItem("options",JSON.stringify(options));
  reset();
}
options.Restart = function() {
    timeBegin = 0;
    reset();
}
options.Pause = function() {
  pause = !pause;
}

// dat GUI
var gui = new dat.GUI();
var f = gui.addFolder('Environment');
f.open();
//f.add(options, 'framerate', 1, 120);
f.add(options, 'G', 1, 1000);
var fMoverCountE = f.add(options, 'MOVER_COUNT', 1, 1000);
fMoverCountE.onFinishChange(function(value) {
    // Fires when a controller loses focus.
    reset();
});

f = gui.addFolder('Trails');
f.open();
f.add(options, 'TRAILS_DISPLAY');
f.add(options, 'TRAILS_LENGTH', 0, 10000);

f = gui.addFolder('Masses');
f.open();
var fMinMassChangeE = f.add(options, 'MIN_MASS', .00001,10000.0);

fMinMassChangeE.onFinishChange(function(value) {
   reset();
});

var fMaxMassChangeE = f.add(options, 'MAX_MASS', .00001,10000.0);
fMaxMassChangeE.onFinishChange(function(value) {
    reset();
});

f = gui.addFolder('Start');
f.open();

var fDensityE = f.add(options, 'DENSITY', 1e-100,1.0);
fDensityE.onFinishChange(function(value) {
    reset();
});

var fSpeedE = f.add(options, 'START_SPEED', 1e-100,100.0);
fSpeedE.onFinishChange(function(value) {
    reset();
});

f.add(options, 'Pause');
f.add(options, 'Restart');
f.add(options, 'RestoreDefaults');

var timeBegin = new Date();
var lastTimeCalled = new Date();
var countFramesPerSecond=0;
var total_mass = 0;
var lerpLookAt = new THREE.Vector3();
var lookAt = new THREE.Vector3();

var MASS_FACTOR = .01; // for display of size

var SPHERE_SIDES = 12;

var zoom = 1.0;
var translate = new THREE.Vector3();

var movers = [];
var atoms = [];
var now;
var then = Date.now();
var renderInterval = 1000/parseInt(options.framerate);
var renderDelta;

var scene = new THREE.Scene({castShadow:true});
var camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight,0.1,100000000.0);
var renderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias:true });
//var projector = new THREE.Projector();

var isMoverSelected = false;

var controls = new THREE.OrbitControls( camera, renderer.domElement );

// END dat GUI


var lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff
});

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
        console.log(this.mesh.position); 
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

        console.log(this.acceleration_x);
        console.log(this.acceleration_y);
        console.log(this.acceleration_z);
        
        scene.add(this.shockwaveSphere);
        this.createAtom();
        this.createDecayAtom();
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
        for(let i = 0; i < this.decaySphere.length; i++)
        {
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
      

      // Untuk Testing yang aslinya di reset()
    //     var loc = new THREE.Vector3(0,0,0);
    //    const atom = new Atom(0xff0000, 0x0000ff, loc);
    //    atom.startInfiniteShake(5);

//renderer.shadowMapEnabled=true;
document.body.appendChild(renderer.domElement);

// var geometry = new THREE.SphereGeometry(1.0,8,8);
// cube = new THREE.Mesh(geometry, material);
// scene.add(cube);
// var cube;


var basicMaterial =  new THREE.MeshLambertMaterial({
    ambient: 0x111111, diffuse: 0x555555, specular: 0xffffff, shininess: 50
});

var selectedMaterial =  new THREE.MeshLambertMaterial({
    ambient: 0xaaaaaa, diffuse: 0xdddddd, specular: 0xffffff, shininess: 50,emissive:0x000000
});
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
var $movers_alive_count = $("#movers_alive_count");
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
    if(lastTimeCalled && timeNow.getMilliseconds() < lastTimeCalled.getMilliseconds()){
        $real_framerate.html(countFramesPerSecond);
        countFramesPerSecond=1;
    } else {
        countFramesPerSecond += 1;
    }

    var movers_alive_count = 0;
    total_mass = 0;
    var maximum_mass = 0.00;

    if(atoms && atoms.length){
        if (!pause) {
            for(var i = 0; i < atoms.length; i++){

                // logic shockwavenya disini
                if(timeNow - timeBegin >= 5000)
                {
                    //console.log(timeNow - timeBegin);
                    atoms[i].updateShockwave();
                    atoms[i].decayExplode();
                }
                

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


    if (movers && movers.length) {
        if (!pause) {

            for (var i = movers.length-1; i >= 0; i--) {
                var m = movers[i];

                if (m.alive) {
                    for (var j =  movers.length-1; j >= 0; j--) {
                        var a = movers[j];
                        if (movers[i].alive && movers[j].alive && i != j) {
                            var distance = m.location.distanceTo(a.location);

                            var radiusM = Math.pow((m.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/3;
                            var radiusA = Math.pow((a.mass / MASS_FACTOR/MASS_FACTOR / 4* Math.PI), 1/3)/3;

                            if (distance < radiusM + radiusA) {
                                // merge objects
                                a.eat(m);
                            }
                            else
                            {
                               a.attract(m);
                            }
                        }
                    }
                }
            }
        }
        var selectedMover; 
        var totalMassPosition = new THREE.Vector3() ;
        for (var i = movers.length-1; i >= 0; i--) {
            var m = movers[i];
            if (m.alive) {
                movers_alive_count ++;
                total_mass += m.mass;
                totalMassPosition.add(m.location.clone().multiplyScalar(m.mass));
              
                if (m.mass > maximum_mass) maximum_mass = m.mass;
              
                if (!pause) { m.update(); }
                m.display(displayMass);
              
                if (m.selected) {
                  selectedMover = m;
                }

            }

            updateTrails(m);
          
          
        }

        $movers_alive_count.html(movers_alive_count);
        $total_mass.html(total_mass.toFixed(2));
        $maximum_mass.html(maximum_mass.toFixed(2));
        $fps.html((1000/dt).toFixed(0));
        totalMassPosition.divideScalar(total_mass);
    }
    
    if (prevTotalMassPosition) {
      camera.position.add(new THREE.Vector3().subVectors(totalMassPosition,prevTotalMassPosition));
      camera.updateMatrix();
    }
  
  
    prevTotalMassPosition = totalMassPosition;
    if (isMoverSelected && selectedMover) {
      lookAt = selectedMover.location.clone();
    }
    lerpLookAt.lerp(lookAt, .05);
    if (isMoverSelected) {
      var lookAtDiff = controls.target.clone().sub(lerpLookAt);
      camera.position.x -= lookAtDiff.x;
      camera.position.y -= lookAtDiff.y;
      camera.position.z -= lookAtDiff.z;
      camera.updateMatrix();
      controls.target = lerpLookAt.clone();
    }
    
    //console.log("center of mass", totalMassPosition);
   

    controls.update();
    renderer.render(scene, camera);

    lastTimeCalled = new Date();

}
var prevTotalMassPosition; 
function updateTrails(m) {
    if (isMoverSelected) {
        if (m.selected) {
            if (options.TRAILS_DISPLAY) {
                m.showTrails();
            } else {
                m.hideTrails();
            }
            //this.selectionLight.intensity = 2;
            //this.directionalLight.intensity = 0.5;
            //selectionLight.position = m.location;

            selectedMaterial.emissive = m.line.material.color;
            //selectionLight.color = m.line.material.color;
            m.mesh.material = selectedMaterial;

        } else {
            m.mesh.material = m.basicMaterial;
            m.hideTrails();
        }
    } else {
        m.mesh.material = m.basicMaterial;
        if (options.TRAILS_DISPLAY) {
            m.showTrails();
        } else {
            m.hideTrails();
        }
    }
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
    if (movers) {
        for (var i=0;i<movers.length;i=i+1) {
            scene.remove(movers[i].mesh);
            //scene.remove(movers[i].selectionLight);
            scene.remove(movers[i].line);
        }
    }

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
      
    movers = [];
    atoms = [];
    translate.x = 0.0;
    translate.y = 0.0;
    translate.z = 0.0;

    // INI FUNGSI UNTUK GENERATE SEMUA ATOMNYA UNCOMMENT YANG PUSH ATOM
    // generate N movers with random mass (N = MOVER_COUNT)
    for (var i=0;i<parseInt(options.MOVER_COUNT);i=i+1) {
        //console.log(parseInt(options.MOVER_COUNT));
        var mass = random(options.MIN_MASS,options.MAX_MASS);

        var max_distance = parseFloat(1000 / options.DENSITY);
        var max_speed = parseFloat(options.START_SPEED);


        var vel = new THREE.Vector3(random(-max_speed,max_speed),random(-max_speed,max_speed),random(-max_speed,max_speed));
        //var vel = new THREE.Vector3();
        var loc = new THREE.Vector3(random(-max_distance,max_distance),random(-max_distance,max_distance),random(-max_distance,max_distance));

        // Push Atom 
        atoms.push(new Atom(0xff0000, 0x0000ff, loc));
        //atoms[i].startInfiniteShake(10);
        //movers.push(new Mover(mass,vel,loc));
    }


    if (localStorage) localStorage.setItem("options",JSON.stringify(options));
}
function random(min, max) {
    return Math.random() * (max - min) + min;
}


/* MOVER CLASS */
function Mover(m,vel,loc) {
    this.location = loc,
    this.velocity = vel,
    this.acceleration = new THREE.Vector3(0.0,0.0,0.0),
    this.mass = m,
    this.c = 0xffffff,
    this.alive = true;
    this.geometry = new THREE.SphereGeometry(100.0,SPHERE_SIDES,SPHERE_SIDES);

    this.vertices = [];     // PATH OF MOVEMENT

    this.line = new THREE.Line();       // line to display movement

    this.color = this.line.material.color;
    //this.line = THREE.Line(this.lineGeometry, lineMaterial);

    this.basicMaterial =  new THREE.MeshPhongMaterial({
        ambient: 0x111111, color: this.color, specular: this.color, shininess: 10
    });

    //this.selectionLight = new THREE.PointLight(this.color,.1);
    //this.selectionLight.position.copy(this.location);
    this.mesh = new THREE.Mesh(this.geometry,this.basicMaterial);
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;


    this.position = this.location;

    this.index = movers.length;
    this.selected = false;

    scene.add(this.mesh);
    //scene.add(this.selectionLight);
    this.applyForce = function(force) {
        if (!this.mass) this.mass = 1.0;
        var f = force.divideScalar(this.mass);
        this.acceleration.add(f);
    };
    this.update = function() {

        this.velocity.add(this.acceleration);
        this.location.add(this.velocity);
        this.acceleration.multiplyScalar(0);

        //this.selectionLight.position.copy(this.location);
        this.mesh.position.copy(this.location);
        if (this.vertices.length > 10000) this.vertices.splice(0,1);

        this.vertices.push(this.location.clone());
        //this.lineGeometry.verticesNeedUpdate = true;

    };
    this.eat = function(m) { // m => other Mover object
        var newMass = this.mass + m.mass;

        var newLocation = new THREE.Vector3(
            (this.location.x * this.mass + m.location.x * m.mass)/newMass,
            (this.location.y * this.mass + m.location.y * m.mass)/newMass,
            (this.location.z * this.mass + m.location.z * m.mass)/newMass);
        var newVelocity = new THREE.Vector3(
            (this.velocity.x *this.mass + m.velocity.x * m.mass) / newMass,
            (this.velocity.y *this.mass + m.velocity.y * m.mass) / newMass,
            (this.velocity.z *this.mass + m.velocity.z * m.mass) / newMass);

        this.location=newLocation;
        this.velocity=newVelocity;
        this.mass = newMass;

        if (m.selected) this.selected = true;
        this.color.lerpHSL(m.color, m.mass /  (m.mass + this.mass));
      
        m.kill();
    };
    this.kill = function () {
        this.alive=false;
        //this.selectionLight.intensity = 0;
        scene.remove(this.mesh);
    };
    this.attract = function(m) {   // m => other Mover object
        var force = new THREE.Vector3().subVectors(this.location,m.location);         // Calculate direction of force
        var d = force.lengthSq();
        if (d<0) d*=-1;
        force = force.normalize();
        var strength = - (options.G * this.mass * m.mass) / (d);      // Calculate gravitional force magnitude
        force = force.multiplyScalar(strength);                             // Get force vector --> magnitude * direction
        
        this.applyForce(force);
    };
    this.display = function() {
        if (this.alive) {
            var scale = Math.pow((this.mass*MASS_FACTOR/(4*Math.PI)), 1/3);
            this.mesh.scale.x = scale;
            this.mesh.scale.y = scale;
            this.mesh.scale.z = scale;

            var emissiveColor = this.color.getHex().toString(16);vertices
            emissiveColor = 1; 
            this.basicMaterial.emissive.setHex(parseInt(emissiveColor,16));
        } else {
            //this.selectionLight.intensity = 0;
        }
    };


    this.showTrails = function() {
        if (!this.lineDrawn) {
            this.lineDrawn = true;
            scene.add(this.line);
        } else if (this.lineDrawn === true) {
            scene.remove(this.line);
            var newLineGeometry = new THREE.Geometry();
            newLineGeometry.vertices = this.vertices.slice();

            newLineGeometry.verticesNeedUpdate = true;
            if (!pause && !this.alive) {
                if (this.lineDrawn === true) {
                  this.vertices.shift();  
                }
            }
            while (newLineGeometry.vertices.length > parseInt(options.TRAILS_LENGTH)) {
                newLineGeometry.vertices.shift();
            }
            this.line = new THREE.Line(newLineGeometry, this.line.material);
            scene.add(this.line);
        }
    }
    this.hideTrails = function() {
        if (this.lineDrawn) {
            scene.remove(this.line);
            this.lineDrawn = false;
        }
    }
}

function constrain(value,min,max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function setCamera() {
    for (var i = 0; i < movers.length; i=i+1 ) {
        updateTrails(movers[i]);
    }
    camera.position.x = currentRadius * Math.sin( theta * Math.PI / 360 ) * Math.cos( phi * Math.PI / 360 );
    camera.position.y = currentRadius * Math.sin( phi * Math.PI / 360 );
    camera.position.z = currentRadius * Math.cos( theta * Math.PI / 360 ) * Math.cos( phi * Math.PI / 360 );
    // camera.lookAt(mesh.position);
    camera.lookAt(new THREE.Vector3(0,0,0));
    camera.updateMatrix();
}