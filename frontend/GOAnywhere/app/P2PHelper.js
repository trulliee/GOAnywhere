import axios from 'axios';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g';
const LTA_ACCOUNT_KEY     = 'CetOCVT4SmqDrAHkHLrf5g==';
const GOOGLE_GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const TRAFFIC_INCIDENTS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents';
const ROAD_WORKS_URL = 'https://datamall2.mytransport.sg/ltaodataservice/RoadWorks';

export async function getCoordinates(address) {
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
    if (
      !types.includes('transit_station') &&
      !types.includes('route') &&
      !types.includes('establishment')
    ) {
      throw new Error(`Uncertain match for: ${address}`);
    }
  }
  return result.geometry.location;
}

export async function fetchTrafficIncidents() {
  try {
    const { data } = await axios.get(`${TRAFFIC_INCIDENTS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value : [];
  } catch {
    return [];
  }
}

export async function fetchRoadWorks() {
  try {
    const { data } = await axios.get(`${ROAD_WORKS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value : [];
  } catch {
    return [];
  }
}

export function toMinutes(txt) {
  let hours = 0, mins = 0;
  const hMatch = txt.match(/(\d+)\s*(?:h|hour)/i);
  const mMatch = txt.match(/(\d+)\s*(?:m|min)/i);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  if (mMatch) mins = parseInt(mMatch[1], 10);
  if (!hMatch && !mMatch) {
    const n = parseFloat(txt);
    return isNaN(n) ? Infinity : n;
  }
  return hours * 60 + mins;
}

export function cleanInstruction(text) {
  if (!text) return '';
  return text.replace(/<[^>]+>/g, '').replace(/([a-z])([A-Z])/g, '$1, $2');
}

export function shortenText(text, maxLength = 30) {
  if (!text) return '';
  return text.length > maxLength
    ? text.slice(0, maxLength - 3) + '...'
    : text;
}

export function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

export function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isNear(pt, inc, threshold = 0.0001) {
  return (
    Math.abs(pt.latitude  - inc.Latitude)  < threshold &&
    Math.abs(pt.longitude - inc.Longitude) < threshold
  );
}

export function classifyRoute(steps) {
  let bus = 0, mrt = 0;
  for (const step of steps) {
    if (step.travelMode === 'TRANSIT') {
      const t = step.transitInfo?.vehicleType;
      if (t === 'BUS') bus++;
      if (t === 'SUBWAY') mrt++;
    }
  }
  if (bus > 0 && mrt === 0) return 'Bus Only';
  if (mrt > 0 && bus === 0) return 'MRT Only';
  if (bus + mrt === 0) return 'Walking Only';
  return 'Mixed';
}

export function buildInstruction(transitInfo) {
  if (!transitInfo) return '';
  if (transitInfo.vehicleType === 'SUBWAY') {
    return `${transitInfo.lineNames.join(' / ')} Line toward ${transitInfo.headsign}` +
      `${transitInfo.exitNumber ? ` - ${transitInfo.exitNumber}` : ''}` +
      ` (${transitInfo.numStops} stops)`;
  }
  if (transitInfo.vehicleType === 'BUS') {
    return `Bus ${transitInfo.lineNames.join(' / ')}` +
      ` (${transitInfo.numStops} stops)`;
  }
  return '';
}

export function countTransitSegments(steps) {
  return steps.filter(s => s.travelMode === 'TRANSIT').length;
}

export function countTransfers(steps) {
  return Math.max(0, countTransitSegments(steps) - 1);
}

export function calculateWalkingDistance(steps) {
  let total = 0;
  for (const step of steps) {
    if (step.travelMode === 'WALKING' && step.distance) {
      const m = step.distance.match(/(\d+(?:\.\d+)?)\s*(m|km)/i);
      if (m) total += parseFloat(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1);
    }
  }
  return total;
}

export function calculateWalkingMinutes(steps) {
  return Math.round(
    steps.reduce((sum, s) => sum + (s.travelMode === 'WALKING' && s.duration ? toMinutes(s.duration) : 0), 0)
  );
}

export function getManeuverIcon(maneuver) {
  switch (maneuver) {
    case 'turn-right': return 'turn-right';
    case 'turn-left': return 'turn-left';
    case 'uturn-right': return 'uturn';
    case 'uturn-left': return 'uturn';
    case 'keep-right': return 'turn-slight-right';
    case 'keep-left': return 'turn-slight-left';
    case 'merge': return 'merge';
    case 'roundabout-right': return 'roundabout-right';
    case 'roundabout-left': return 'roundabout-left';
    case 'straight': return 'arrow-upward';
    case 'fork-right': return 'turn-slight-right';
    case 'fork-left': return 'turn-slight-left';
    case 'ferry': return 'directions-boat';
    default: return 'arrow-forward';
  }
}

export function getDirectionText(maneuver) {
  switch (maneuver) {
    case 'turn-right': return 'TURN RIGHT';
    case 'turn-left': return 'TURN LEFT';
    case 'uturn-right': return 'MAKE U-TURN';
    case 'uturn-left': return 'MAKE U-TURN';
    case 'keep-right': return 'KEEP RIGHT';
    case 'keep-left': return 'KEEP LEFT';
    case 'merge': return 'MERGE';
    case 'roundabout-right': return 'ENTER ROUNDABOUT';
    case 'roundabout-left': return 'ENTER ROUNDABOUT';
    case 'straight': return 'CONTINUE STRAIGHT';
    case 'fork-right': return 'TAKE RIGHT FORK';
    case 'fork-left': return 'TAKE LEFT FORK';
    case 'ferry': return 'BOARD FERRY';
    default: return 'CONTINUE';
  }
}

export function getLineColor(lineName) {
  if (!lineName) return '#666';
  const ln = lineName.toUpperCase();
  if (ln.includes('NS')) return '#e51a1e';
  if (ln.includes('EW')) return '#009645';
  if (ln.includes('CG')) return '#fa9e0d';
  if (ln.includes('DT')) return '#0070bb';
  if (ln.includes('NE')) return '#9e3f7c';
  if (ln.includes('BP')) return '#84520f';
  if (ln.includes('SE') || ln.includes('PE')) return '#78c0e9';
  if (ln.includes('TE')) return '#9d5822';
  return '#e51a1e';
}

export default null
