import axios from 'axios';
import polyline from '@mapbox/polyline';
import {
  toMinutes,
  classifyRoute,
  buildInstruction,
  isNear,
  calculateWalkingDistance,
  calculateWalkingMinutes,
  countTransitSegments,
  countTransfers
} from './P2PHelper';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g';
const LTA_ACCOUNT_KEY        = 'CetOCVT4SmqDrAHkHLrf5g==';
const GOOGLE_GEOCODE_URL    = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_DIRECTIONS_URL = 'https://maps.googleapis.com/maps/api/directions/json';
const LTA_BUS_STOPS_API     = 'https://datamall2.mytransport.sg/ltaodataservice/BusStops';
const LTA_BUS_ROUTES_API    = 'https://datamall2.mytransport.sg/ltaodataservice/BusRoutes';
const TRAIN_ALERTS_URL      = 'https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts';
const BUS_ARRIVAL_URL       = 'https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival';
const TRAFFIC_INCIDENTS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents';
const ROAD_WORKS_URL        = 'https://datamall2.mytransport.sg/ltaodataservice/RoadWorks';
const stationExits          = require('./MRTStationExit.json');

async function getCoordinates(address) {
  if (/^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  const formatted = address.toLowerCase().includes('singapore')
    ? address
    : `${address}, Singapore`;
  const { data } = await axios.get(
    `${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(formatted)}&key=${GOOGLE_MAPS_API_KEY}`
  );
  if (data.status !== 'OK' || !data.results.length) {
    throw new Error(`Could not find location: ${address}`);
  }
  const result = data.results[0];
  if (result.partial_match) {
    const types = result.types || [];
    if (!types.includes('transit_station') && !types.includes('route') && !types.includes('establishment')) {
      throw new Error(`Uncertain match for: ${address}`);
    }
  }
  return result.geometry.location;
}

async function fetchTrainAlerts() {
  try {
    const { data } = await axios.get(
      `${TRAIN_ALERTS_URL}?$top=50`,
      { headers: { AccountKey: LTA_ACCOUNT_KEY } }
    );
    return Array.isArray(data.value)
      ? data.value.map(x => x.Line)
      : [];
  } catch {
    return [];
  }
}

async function fetchBusLoad(stopCode, serviceNo) {
  if (!stopCode || !serviceNo) return null;
  try {
    const { data } = await axios.get(
      `${BUS_ARRIVAL_URL}?BusStopCode=${stopCode}&ServiceNo=${serviceNo}`,
      { headers: { AccountKey: LTA_ACCOUNT_KEY } }
    );
    const svc = Array.isArray(data.Services) && data.Services[0];
    return svc?.Load || null;
  } catch {
    return null;
  }
}

async function fetchTrafficIncidents() {
  try {
    const { data } = await axios.get(
      `${TRAFFIC_INCIDENTS_URL}?$top=100`,
      { headers: { AccountKey: LTA_ACCOUNT_KEY } }
    );
    return data.value || [];
  } catch {
    return [];
  }
}

async function fetchRoadWorks() {
  try {
    const { data } = await axios.get(
      `${ROAD_WORKS_URL}?$top=100`,
      { headers: { AccountKey: LTA_ACCOUNT_KEY } }
    );
    return data.value || [];
  } catch {
    return [];
  }
}

async function getAllBusStops() {
  try {
    const { data } = await axios.get(LTA_BUS_STOPS_API, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return data.value || [];
  } catch {
    return [];
  }
}

function findNearestBusStop(lat, lng, stops) {
  let nearest = null;
  let minDist = Infinity;
  for (const s of stops) {
    const d = (s.Latitude - lat) ** 2 + (s.Longitude - lng) ** 2;
    if (d < minDist) { nearest = s; minDist = d; }
  }
  return nearest;
}

function buildExitLookup() {
  const lookup = {};
  for (const feature of stationExits.features) {
    const { Description } = feature.properties;
    const nm = Description.match(/<th>STATION_NA<\/th>\s*<td>([^<]+)<\/td>/);
    const ex = Description.match(/<th>EXIT_CODE<\/th>\s*<td>([^<]+)<\/td>/);
    if (nm && ex) {
      const key = nm[1].replace(/\s*MRT STATION$/i, '').trim().toUpperCase();
      lookup[key] = ex[1].trim();
    }
  }
  return lookup;
}

const stationExitLookup = buildExitLookup();

async function findDirectBusGroup(startCode, endCode) {
  try {
    const { data } = await axios.get(LTA_BUS_ROUTES_API, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    const startMap = {}, endMap = {};
    for (const r of data.value) {
      if (r.BusStopCode === startCode) startMap[r.ServiceNo] = r.StopSequence;
      if (r.BusStopCode === endCode)   endMap[r.ServiceNo]   = r.StopSequence;
    }
    return Object.keys(startMap).filter(svc => endMap[svc] && startMap[svc] < endMap[svc]);
  } catch {
    return [];
  }
}

async function findGoogleTransitRoute(origin, destination, filters = {}) {
  const url = `${GOOGLE_DIRECTIONS_URL}?origin=${origin}&destination=${destination}&mode=transit&alternatives=true` +
    (filters.transitMode ? `&transit_mode=${filters.transitMode}` : '') +
    `&key=${GOOGLE_MAPS_API_KEY}`;
  try {
    const { data } = await axios.get(url);
    return data.status === 'OK' ? data.routes : [];
  } catch {
    return [];
  }
}

const P2PPublicTrans = async (startLocation, endLocation) => {
  const [startCoords, endCoords] = await Promise.all([
    getCoordinates(startLocation),
    getCoordinates(endLocation)
  ]);
  if (startCoords.lat === endCoords.lat && startCoords.lng === endCoords.lng) {
    throw new Error('Origin and destination cannot be the same.');
  }

  const busStops     = await getAllBusStops();
  const nearestStart = findNearestBusStop(startCoords.lat, startCoords.lng, busStops);
  const nearestEnd   = findNearestBusStop(endCoords.lat, endCoords.lng, busStops);
  const directBuses  = await findDirectBusGroup(nearestStart.BusStopCode, nearestEnd.BusStopCode);
  const origin       = `${startCoords.lat},${startCoords.lng}`;
  const destination  = `${endCoords.lat},${endCoords.lng}`;
  const allRoutes = [];
  const seen      = new Set();

  if (directBuses.length) {
    const key = `${nearestStart.Description}->${nearestEnd.Description}`;
    seen.add(key);
    allRoutes.push({
      summary: 'Bus Only',
      type:    'Bus Only',
      distance: 'Varies',
      duration: 'Estimate',
      durationValue: 30 * 60,
      steps: [
        { instruction: `Walk to ${nearestStart.Description}`, travelMode: 'WALKING', distance: 'Varies' },
        { instruction: `Take Bus ${directBuses.join(' / ')} to ${nearestEnd.Description}`, travelMode: 'TRANSIT', distance: 'Varies', transitInfo: {
          lineNames: directBuses,
          lineName:  directBuses[0],
          departureStop: nearestStart.Description,
          arrivalStop:   nearestEnd.Description,
          headsign:      nearestEnd.Description,
          numStops:      directBuses.length,
          vehicleType:   'BUS'
        }},
        { instruction: 'Walk to your destination', travelMode: 'WALKING', distance: 'Varies' }
      ],
      markers: [
        { latitude: startCoords.lat, longitude: startCoords.lng, title: 'Start' },
        { latitude: nearestStart.Latitude, longitude: nearestStart.Longitude, title: nearestStart.Description },
        { latitude: nearestEnd.Latitude, longitude: nearestEnd.Longitude, title: nearestEnd.Description },
        { latitude: endCoords.lat, longitude: endCoords.lng, title: 'Destination' }
      ],
      polyline: [
        { latitude: startCoords.lat, longitude: startCoords.lng },
        { latitude: nearestStart.Latitude, longitude: nearestStart.Longitude },
        { latitude: nearestEnd.Latitude, longitude: nearestEnd.Longitude },
        { latitude: endCoords.lat, longitude: endCoords.lng }
      ]
    });
  }

 	const variants = [
    { label: 'Fastest', filters: {} },
    { label: 'Bus Only', filters: { transitMode: 'bus' } },
    { label: 'MRT Only', filters: { transitMode: 'subway' } }
  ];

  for (const v of variants) {
    const routes = await findGoogleTransitRoute(origin, destination, v.filters);
    for (const r of routes) {
      const decoded = polyline.decode(r.overview_polyline.points).map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
      const leg = r.legs[0];
      const steps = await Promise.all(leg.steps.map(async step => {
        let transitInfo = null;
        let instr = step.html_instructions.replace(/<[^>]+>/g, '');
        if (step.travel_mode === 'TRANSIT' && step.transit_details) {
          const t = step.transit_details;
          const stop = t.arrival_stop.name;
          const key  = stop.replace(/\s*MRT STATION$/i, '').trim().toUpperCase();
          const exit = stationExitLookup[key] || null;
          let names    = [t.line.short_name || t.line.name || 'Unknown'];
          let type     = t.line.vehicle.type.toUpperCase();
          if (type === 'RAIL' && ['BP','SE','PE'].some(p => names[0].startsWith(p))) type = 'SUBWAY';
          transitInfo = {
            lineNames: names,
            lineName:  names[0],
            departureStop: t.departure_stop.name,
            arrivalStop:   stop,
            headsign:      t.headsign,
            numStops:      t.num_stops,
            exitNumber:    exit,
            vehicleType:   type
          };
          instr = buildInstruction(transitInfo);
        }
        return {
          instruction: instr,
          distance:    step.distance?.text || 'Varies',
          duration:    step.duration?.text || 'Varies',
          travelMode:  step.travel_mode,
          transitInfo,
          startLocation: step.start_location,
          endLocation:   step.end_location
        };
      }));

      const merged = [];
      for (const s of steps) {
        const last = merged[merged.length - 1];
        if (
          last && last.travelMode==='TRANSIT' &&
          s.travelMode==='TRANSIT' &&
          last.transitInfo.lineName===s.transitInfo.lineName &&
          last.transitInfo.vehicleType===s.transitInfo.vehicleType &&
          last.transitInfo.headsign===s.transitInfo.headsign &&
          last.transitInfo.arrivalStop===s.transitInfo.departureStop
        ) continue;
        merged.push(s);
      }

      const type = classifyRoute(merged);
      if (type==='Walking Only') continue;

      const hash = merged.map(s => s.instruction).join('|');
      if (seen.has(hash)) continue;
      seen.add(hash);

      if ((v.label==='Bus Only' && type!=='Bus Only') ||
          (v.label==='MRT Only' && type!=='MRT Only')) continue;

      allRoutes.push({
        summary: v.label,
        type,
        distance: leg.distance.text,
        duration: leg.duration.text,
        durationValue: leg.duration.value,
        steps: merged,
        markers: [
          { latitude: startCoords.lat, longitude: startCoords.lng, title: 'Start' },
          { latitude: endCoords.lat, longitude: endCoords.lng, title: 'Destination' }
        ],
        polyline: decoded,
        fareInfo: r.fare
      });
    }
  }

  // Merge similar bus-only routes
  const mergedRoutes = [];
  const groups = {};
  for (const route of allRoutes) {
    if (route.type==='Bus Only' && route.steps[1]?.transitInfo) {
      const info = route.steps[1].transitInfo;
      const key = `${info.departureStop}|${info.arrivalStop}`;
      if (!groups[key]) {
        const copy = { ...info, lineNames: [...info.lineNames] };
        copy.lineName = copy.lineNames.join(' / ');
        groups[key] = { ...route, steps: [route.steps[0], { ...route.steps[1], transitInfo: copy }, route.steps[2]] };
        mergedRoutes.push(groups[key]);
      } else {
        const existing = groups[key].steps[1].transitInfo;
        existing.lineNames = Array.from(new Set([...existing.lineNames, ...info.lineNames]));
        existing.lineName = existing.lineNames.join(' / ');
        groups[key].steps[1].instruction = buildInstruction(existing);
      }
    } else {
      mergedRoutes.push(route);
    }
  }

  mergedRoutes.sort((a,b) => toMinutes(a.duration) - toMinutes(b.duration));

  const [railDown, incidents, works] = await Promise.all([
    fetchTrainAlerts(),
    fetchTrafficIncidents(),
    fetchRoadWorks()
  ]);
  const codeByDesc = Object.fromEntries(busStops.map(s => [s.Description, s.BusStopCode]));

  await Promise.all(mergedRoutes.map(async route => {
    const issues = [];
    if (route.steps.some(s => s.transitInfo?.vehicleType==='SUBWAY' && railDown.includes(s.transitInfo.lineName))) {
      issues.push('train delays');
    }
    for (const s of route.steps) {
      const ti = s.transitInfo;
      if (ti?.vehicleType==='BUS') {
        const load = await fetchBusLoad(codeByDesc[ti.departureStop], ti.lineName);
        if (load==='SDA' || load==='LSD') { issues.push('crowded bus'); break; }
      }
    }
    if (route.steps.some(s => s.transitInfo?.vehicleType==='BUS')) {
      if (incidents.some(inc => route.polyline.some(pt => isNear(pt, inc)))) issues.push('traffic incident');
      if (works.some(w => route.polyline.some(pt => isNear(pt, w))))   issues.push('road works');
    }
    route.issues = issues;
    route.reliabilityScore = 100 - (issues.length * 15);
    route.walkingDistance = calculateWalkingDistance(route.steps);
    route.walkingMinutes  = calculateWalkingMinutes(route.steps);
    route.transitCount     = countTransitSegments(route.steps);
    route.transferCount    = countTransfers(route.steps);
  }));

  return mergedRoutes;
};

export default P2PPublicTrans;
