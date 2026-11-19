import { aimHelicopterSearchlight, buildHelicopter } from './police.js';

export const SHOT_SCENES = {
  chase: {
    timeOfDay: 18.6,
    objective: 'LOSE THE POLICE — REACH THE DROP',
    apply(scene, ctx) {
      const point = roadScenePoint(ctx.roads, (road) => {
        const middle = roadMiddle(road);
        return middle.x < -500 && middle.z > -250 && middle.z < 100;
      });
      ctx.setPlayerAt(point, true);
      ctx.setWanted(3);
      ctx.setObjective(ctx.objective);
      ctx.spawnPoliceAt({
        x: point.x + Math.sin(point.heading) * 22 + Math.cos(point.heading) * 1.6,
        z: point.z + Math.cos(point.heading) * 22 - Math.sin(point.heading) * 1.6,
        heading: point.heading + 0.61,
      });
      ctx.spawnPolice(1, { chase: false, distance: 10 });
      ctx.spawnPolice(1, { chase: false, distance: 18 });
      ctx.sprinkleLife({ cars: 0, pedestrians: 10 });
      scene.userData.shotCamera = 'chase';
    }
  },
  surround: {
    timeOfDay: 16.9,
    objective: 'SURROUNDED — ISLAND LOCKDOWN',
    apply(scene, ctx) {
      const point = { x: 530, z: 140, heading: -1.89 };
      ctx.setPlayerAt(point, false);
      ctx.setWanted(5);
      ctx.setObjective(ctx.objective);
      ctx.setExposure(1.35);
      const carPoint = {
        x: point.x + Math.cos(point.heading) * 2.6,
        z: point.z - Math.sin(point.heading) * 2.6,
        heading: point.heading - 0.44,
      };
      ctx.spawnCar('luxury', 0xd90429, carPoint);
      const radius = 9.5;
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2 + 0.2;
        const x = point.x + Math.cos(angle) * radius;
        const z = point.z + Math.sin(angle) * radius;
        ctx.spawnPoliceAt({ x, z, heading: Math.atan2(point.x - x, point.z - z) });
      }
      const heli = buildHelicopter();
      const heliForwardX = Math.sin(point.heading);
      const heliForwardZ = Math.cos(point.heading);
      heli.position.set(point.x + heliForwardX * 30, 13.5, point.z + heliForwardZ * 30);
      heli.lookAt(point.x, 1.2, point.z);
      heli.rotateZ(0.18);
      if (heli.userData.rotor) heli.userData.rotor.rotation.y = 0.7;
      scene.add(heli);
      heli.updateMatrixWorld(true);
      aimHelicopterSearchlight(heli, { x: point.x, y: 0.6, z: point.z });
      if (ctx.camera) {
        ctx.camera.fov = 64;
        ctx.camera.updateProjectionMatrix();
      }
      ctx.sprinkleLife({ cars: 0, pedestrians: 6 });
      scene.userData.shotCamera = { behind: 10, height: 3.5 };
    }
  },
  street: {
    timeOfDay: 9.5,
    objective: '',
    apply(scene, ctx) {
      const road = ctx.roads.find((candidate) => {
        const middle = roadMiddle(candidate);
        return candidate.width === 8
          && middle.x > 200
          && middle.x < 360
          && middle.z > 340
          && middle.z < 380;
      }) ?? ctx.roads[0];
      const heading = Math.atan2(road.x2 - road.x1, road.z2 - road.z1);
      const point = {
        x: roadMiddle(road).x,
        z: roadMiddle(road).z,
        heading,
      };
      ctx.setPlayerAt(point, false);
      ctx.setWanted(0);
      ctx.setExposure(1.2);
      for (const distance of [5.5, 10.5, 14]) {
        ctx.spawnPedestrian({
          x: point.x + Math.sin(heading) * distance + Math.cos(heading) * 4.5,
          z: point.z + Math.cos(heading) * distance - Math.sin(heading) * 4.5,
          heading: heading + Math.PI,
        });
      }
      for (const [kind, color, distance, side, headingBias] of [
        ['sedan', 0xd85563, 6, 2.5, 0],
        ['pickup', 0x2f9e73, 12, 2.5, 0],
        ['van', 0xe7eaf2, 18, 2.5, 0],
        ['sports', 0x9c6ade, 24, 2.5, 0],
      ]) {
        ctx.spawnCar(kind, color, {
          x: point.x + Math.sin(heading) * distance - Math.cos(heading) * side,
          z: point.z + Math.cos(heading) * distance + Math.sin(heading) * side,
          heading: heading + headingBias,
        });
      }
      ctx.spawnCar('sedan', 0x2f9e73, {
        x: point.x + Math.sin(heading) * 7 - Math.cos(heading) * 2.5,
        z: point.z + Math.cos(heading) * 7 + Math.sin(heading) * 2.5,
        heading,
      });
      ctx.spawnCar('pickup', 0xd8543f, {
        x: point.x + Math.sin(heading) * 17 - Math.cos(heading) * 2.5,
        z: point.z + Math.cos(heading) * 17 + Math.sin(heading) * 2.5,
        heading: heading + Math.PI,
      });
      ctx.scene.userData.shotCamera = { behind: 12.5, height: 5 };
    }
  },
  harbor: {
    timeOfDay: 16.8,
    objective: 'DELIVER THE CARGO TO THE PIER',
    apply(scene, ctx) {
      const point = { x: -527, z: 431, heading: 0.78 };
      ctx.setPlayerAt(point, true);
      ctx.setWanted(0);
      ctx.setObjective(ctx.objective);
      ctx.spawnPolice(0);
      for (let index = 0; index < 3; index += 1) {
        ctx.placeCrate({
          x: point.x + Math.sin(point.heading) * (8 + index * 4.5) - Math.cos(point.heading) * 7,
          z: point.z + Math.cos(point.heading) * (8 + index * 4.5) + Math.sin(point.heading) * 7,
        }, 2.2 + index * 0.3);
      }
      ctx.spawnPedestrian({
        x: point.x + Math.sin(point.heading) * 10 - Math.cos(point.heading) * 7,
        z: point.z + Math.cos(point.heading) * 10 + Math.sin(point.heading) * 7,
        heading: point.heading + 0.4,
      });
      ctx.spawnCar('pickup', 0x2f9e73, {
        x: point.x + Math.sin(point.heading) * 18 - Math.cos(point.heading) * 7.5,
        z: point.z + Math.cos(point.heading) * 18 + Math.sin(point.heading) * 7.5,
        heading: point.heading + 0.1,
      });
      ctx.scene.userData.shotCamera = 'chase';
    }
  },
  night: {
    timeOfDay: 22.4,
    objective: '',
    apply(scene, ctx) {
      const club = ctx.SPAWN_POINTS.neonClub;
      const point = { x: club.x - 56, z: club.z - 3, heading: 1.13 };
      const forwardX = Math.sin(point.heading);
      const forwardZ = Math.cos(point.heading);
      ctx.setPlayerAt(point, false);
      ctx.setWanted(0);
      ctx.setExposure(3.0);
      for (const [distance, side, height, text, color] of [
        [28, 11, 18, 'CALIENTE', '#ff4fa3'],
        [28, -11, 16, 'MIRAGE 88', '#58d5ff'],
        [74, 16, 22, 'TINDER PALM', '#ffb347'],
        [74, -16, 20, 'VOLTA CLUB', '#b78dff'],
      ]) {
        ctx.placeNeon(
          point.x + forwardX * distance + forwardZ * side,
          height,
          point.z + forwardZ * distance - forwardX * side,
          point.heading + Math.PI, text, color,
        );
      }
      ctx.spawnPoliceAt({
        x: point.x + 13,
        z: point.z + 5,
        heading: point.heading + 1.0,
      });
      ctx.spawnCar('sedan', 0xe7eaf2, {
        x: point.x + forwardX * 13 + forwardZ * -7,
        z: point.z + forwardZ * 13 - forwardX * -7,
        heading: point.heading + Math.PI,
      });
      ctx.addHeadlight({
        x: point.x + forwardX * 12 + forwardZ * -6,
        z: point.z + forwardZ * 12 - forwardX * -6,
        targetX: point.x + forwardX * 1,
        targetZ: point.z + forwardZ * 1,
      });
      for (const [distance, side] of [[4, 2.1], [8, -2.4], [11, 2.8], [15, -1.7]]) {
        ctx.spawnPedestrian({
          x: point.x + forwardX * distance + forwardZ * side,
          z: point.z + forwardZ * distance - forwardX * side,
          heading: point.heading + (side > 0 ? 0.5 : -0.6),
        });
      }
      ctx.scene.userData.shotCamera = { behind: 5.5, height: 2.3 };
    }
  }
};

function roadMiddle(road) {
  return { x: (road.x1 + road.x2) / 2, z: (road.z1 + road.z2) / 2 };
}

function roadLength(road) {
  return Math.hypot(road.x2 - road.x1, road.z2 - road.z1);
}

function roadScenePoint(roads, matches, rank) {
  const candidates = (roads ?? []).filter((road) => roadLength(road) >= 70 && matches(road));
  if (!candidates.length) throw new Error('No suitable shot road found');
  const road = rank
    ? candidates.reduce((best, road) => (rank(road, roadMiddle(road)) < rank(best, roadMiddle(best)) ? road : best))
    : candidates.reduce((best, road) => (roadLength(road) > roadLength(best) ? road : best));
  return {
    x: road.x1,
    z: road.z1,
    heading: Math.atan2(road.x2 - road.x1, road.z2 - road.z1),
  };
}

export function applyShotScene(name, ctx) {
  const shot = SHOT_SCENES[name];
  if (!shot) {
    throw new Error(`Unknown shot scene: ${name}`);
  }
  ctx.setTimeOfDay(shot.timeOfDay);
  shot.objective && ctx.setObjective(shot.objective);
  shot.apply(ctx.scene, {
    ...ctx,
    objective: shot.objective,
    camera: ctx.camera
  });
}
