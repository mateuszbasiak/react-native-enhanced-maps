// Run against the Debug example on a dedicated Metro port.
import WebSocket from 'ws';
import { mkdirSync, writeFileSync } from 'node:fs';
const port = Number(process.env.METRO_PORT ?? 8090);
const device = process.argv[2];
const targets = await (
  await fetch(`http://localhost:${port}/json/list`)
).json();
const selected = targets.filter(
  (target) => !device || target.reactNative?.logicalDeviceId === device,
);
if (!selected.length)
  throw new Error('No matching Debug example on the test Metro port');
const expression = `(async () => {
  const check = (ok,message) => {if(!ok) throw Error(message);};
  const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
  const wait = async predicate => {for(let i=0;i<200;i++){if(await predicate())return;await sleep(100);}throw Error('Runtime acceptance timed out');};
  const previous = globalThis.__enhancedMapsVerification;
  globalThis.__enhancedMapsScenarios.select('runtime');
  await wait(()=>globalThis.__enhancedMapsVerification && globalThis.__enhancedMapsVerification !== previous && globalThis.__enhancedMapsVerification.snapshot().readyCount>0);
  const api=globalThis.__enhancedMapsVerification;
  const parity=api.parity;
  const ready=api.snapshot().readyCount;
  parity.mountRegion({latitude:54.37,longitude:18.66,latitudeDelta:.1,longitudeDelta:.15},{zoom:14,heading:25});
  await wait(()=>api.snapshot().readyCount>ready);
  let m=parity.map();
  let camera=await m.getCamera();
  check(Math.abs(camera.zoom-14)<.01 && Math.abs(camera.heading-25)<.01,'initialRegion overwrote onMapReady camera');
  await Promise.all([m.setCamera({zoom:13}),m.setCamera({heading:40})]);
  camera=await m.getCamera();
  check(Math.abs(camera.zoom-13)<.01 && Math.abs(camera.heading-40)<.01,'partial updates overwrote fields');
  m.animateCamera({zoom:14},{duration:0});
  camera=await m.getCamera();
  check(Math.abs(camera.zoom-14)<.01,'camera read overtook animateCamera');
  m.animateCamera({center:{latitude:1,longitude:2}},{duration:0});
  const orderedBounds=await m.getMapBoundaries();
  check(orderedBounds.northEast.latitude>=1 && orderedBounds.southWest.latitude<=1,'bounds read overtook animateCamera');
  const points=[{latitude:54.36,longitude:18.64},{latitude:54.39,longitude:18.69}];
  await m.fitToCoordinates(points,{animated:false,edgePadding:{top:20,right:20,bottom:20,left:20}});
  const boundaries=await m.getMapBoundaries();
  check(boundaries.northEast.latitude>=54.39 && boundaries.southWest.latitude<=54.36,'fit did not contain coordinates');
  const beforeFit=parity.snapshot().regions.filter(e=>e.complete).length;
  await m.animateToRegion({latitude:10,longitude:179,latitudeDelta:4,longitudeDelta:6},0);
  await sleep(500);
  const dateline=await m.getCamera();
  check(Math.abs(dateline.center.longitude-179)<.01,'dateline fit took wrong arc');
  const fitCompletions=parity.snapshot().regions.filter(e=>e.complete).length-beforeFit;
  check(fitCompletions===1,'fit emitted intermediate or duplicate completions: '+fitCompletions);
  parity.setRegion({latitude:30,longitude:50,latitudeDelta:1,longitudeDelta:1});
  parity.setCamera({center:{latitude:54.37,longitude:18.66},zoom:12,heading:0,pitch:0});
  await wait(async()=>Math.abs((await m.getCamera()).zoom-12)<.01);
  camera=await m.getCamera();
  check(Math.abs(camera.center.longitude-18.66)<.01,'controlled camera did not take precedence');
  parity.setCamera(undefined);
  parity.setRegion({latitude:54.4,longitude:18.7,latitudeDelta:.03,longitudeDelta:.04});
  await wait(async()=>Math.abs((await m.getCamera()).center.longitude-18.7)<.001);
  await sleep(300);
  const emitted=parity.snapshot().regions.at(-1).region;
  const beforeEcho=parity.snapshot().regions.length;
  parity.setRegion(emitted);
  await sleep(500);
  check(parity.snapshot().regions.length===beforeEcho,'region callback echo refitted the viewport');
  parity.setRegion({latitude:54.4,longitude:18.7,latitudeDelta:.03,longitudeDelta:.04});
  await sleep(500);
  check(parity.snapshot().regions.length>beforeEcho,'re-requesting a region after callback echo was ignored');
  parity.setRegion(undefined);
  await sleep(100);
  await m.setCamera({center:{latitude:54.37,longitude:18.66},zoom:14,heading:0,pitch:0});
  parity.showMarkers(true);
  parity.setShapeLongitude(100);
  await sleep(500);
  await m.fitToElements({animated:false});
  const markersCamera=await m.getCamera();
  check(Math.abs(markersCamera.center.longitude-18.66)<1,'fitToElements included non-marker shapes');
  parity.setShapeLongitude(18.66);
  await m.setCamera({center:{latitude:54.37,longitude:18.66},zoom:14,heading:0,pitch:0});
  check(api.snapshot().errors.length===0,'native error during acceptance');
  return {platform:api.snapshot().platform,passed:['initialRegion/onMapReady ordering','serialized partial camera updates','ordered camera reads','ordered geometry reads','fitToCoordinates/getMapBoundaries','dateline animateToRegion','single fit completion','controlled camera precedence','controlled region','region callback echo','fitToElements marker-only semantics'],camera,dateline,boundaries,regionEvents:parity.snapshot().regions.length};
})()`;
for (const target of selected) {
  const socket = new WebSocket(target.webSocketDebuggerUrl, {
    origin: `http://localhost:${port}`,
  });
  try {
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener(
        'error',
        (event) =>
          reject(
            new Error(
              event.message ?? 'Could not connect to local Metro debugger',
            ),
          ),
        { once: true },
      );
    });
    let sequence = 0;
    const evaluate = (expression) =>
      new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => {
          socket.removeEventListener('message', listener);
          reject(new Error('CDP response timed out'));
        }, 5000);
        const listener = (event) => {
          const message = JSON.parse(String(event.data));
          if (message.id === id) {
            clearTimeout(timer);
            socket.removeEventListener('message', listener);
            if (message.error || message.result?.exceptionDetails)
              reject(new Error(JSON.stringify(message)));
            else resolve(message.result.result.value);
          }
        };
        socket.addEventListener('message', listener);
        socket.send(
          JSON.stringify({
            id,
            method: 'Runtime.evaluate',
            params: { expression, returnByValue: true },
          }),
        );
      });
    // Hermes uses a JS Promise implementation, so CDP awaitPromise is insufficient.
    await evaluate(
      `globalThis.__rnMapsParityRun={status:'running'};${expression}.then(value=>globalThis.__rnMapsParityRun={status:'passed',value},error=>globalThis.__rnMapsParityRun={status:'failed',error:String(error)});undefined`,
    );
    let result;
    for (let attempt = 0; attempt < 400; attempt++) {
      const run = JSON.parse(
        await evaluate('JSON.stringify(globalThis.__rnMapsParityRun)'),
      );
      if (run.status === 'failed') throw new Error(run.error);
      if (run.status === 'passed') {
        result = run.value;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!result?.platform) throw new Error('Runtime acceptance did not finish');
    mkdirSync('artifacts/rn-maps-parity', { recursive: true });
    writeFileSync(
      `artifacts/rn-maps-parity/${result.platform}.json`,
      JSON.stringify(result, null, 2) + '\n',
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    socket.close();
  }
}
