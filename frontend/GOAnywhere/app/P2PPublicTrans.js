// P2PPublicTrans.js
import axios from 'axios';
import polyline from '@mapbox/polyline'; 
import { Alert } from 'react-native';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";
const LTA_ACCOUNT_KEY = "CetOCVT4SmqDrAHkHLrf5g==";

const GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const LTA_BUS_STOPS_API = "https://datamall2.mytransport.sg/ltaodataservice/BusStops";
const LTA_BUS_ROUTES_API = "https://datamall2.mytransport.sg/ltaodataservice/BusRoutes";
const stationExits = require('./MRTStationExit.json');

const getCoordinates = async (address) => {
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  const formatted = address.toLowerCase().includes("singapore") ? address : `${address}, Singapore`;
  const response = await axios.get(`${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(formatted)}&key=${GOOGLE_MAPS_API_KEY}`);
  const coords = response.data.results[0]?.geometry?.location;
  if (!coords) throw new Error("Geocoding failed.");
  return { lat: coords.lat, lng: coords.lng };
};


const getAllBusStops = async () => {
  const response = await axios.get(LTA_BUS_STOPS_API, {
    headers: { AccountKey: LTA_ACCOUNT_KEY },
  });
  return response.data.value || [];
};

const findNearestBusStop = (lat, lng, stops) => {
  let nearest = null;
  let minDist = Infinity;
  for (const stop of stops) {
    const d = Math.sqrt(Math.pow(stop.Latitude - lat, 2) + Math.pow(stop.Longitude - lng, 2));
    if (d < minDist) {
      nearest = stop;
      minDist = d;
    }
  }
  return nearest;
};

const buildExitLookup = () => {
  const lookup = {};
  for (const feature of stationExits.features) {
    const html = feature.properties.Description;
    const nmMatch = html.match(/<th>STATION_NA<\/th>\s*<td>([^<]+)<\/td>/);
    const exMatch = html.match(/<th>EXIT_CODE<\/th>\s*<td>([^<]+)<\/td>/);
    if (nmMatch && exMatch) {
     const stationName = nmMatch[1]
       .replace(/\s*MRT STATION$/i, '')
       .trim()
       .toUpperCase();
     lookup[stationName] = exMatch[1].trim();
    }
  }
  return lookup;
};
const stationExitLookup = buildExitLookup();


const findDirectBusGroup = async (startCode, endCode) => {
  const response = await axios.get(LTA_BUS_ROUTES_API, {
    headers: { AccountKey: LTA_ACCOUNT_KEY }
  });
  const routes = response.data.value;
  const startMap = {}, endMap = {};
  for (const r of routes) {
    if (r.BusStopCode === startCode) startMap[r.ServiceNo] = r.StopSequence;
    if (r.BusStopCode === endCode) endMap[r.ServiceNo] = r.StopSequence;
  }
  return Object.keys(startMap).filter(svc => endMap[svc] && startMap[svc] < endMap[svc]);
};

const classifyRoute = (steps) => {
  let bus = 0, mrt = 0;
  for (const step of steps) {
    if (step.travelMode === "TRANSIT") {
      const type = step.transitInfo?.vehicleType;
      if (type === "BUS") bus++;
      if (type === "SUBWAY") mrt++;
    }
  }
  if (bus > 0 && mrt === 0) return "Bus Only";
  if (mrt > 0 && bus === 0) return "MRT Only";
  if (bus + mrt === 0) return "Walking Only";
  return "Mixed";
};

const findGoogleTransitRoute = async (origin, destination, filters = {}) => {
  const { transitMode = "" } = filters;
  const url = `${GOOGLE_DIRECTIONS_URL}?origin=${origin}&destination=${destination}&mode=transit&alternatives=true${transitMode ? `&transit_mode=${transitMode}` : ""}&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await axios.get(url);
  return response.data.routes || [];
};

const buildInstruction = (transitInfo) => {
  if (transitInfo.vehicleType === "SUBWAY") {
    return `${transitInfo.lineNames.join(' / ')} Line toward ${transitInfo.headsign}${transitInfo.exitNumber ? ` - ${transitInfo.exitNumber}` : ''} (${transitInfo.numStops} stops)`;
  } else if (transitInfo.vehicleType === "BUS") {
    return `Bus ${transitInfo.lineNames.join(' / ')} (${transitInfo.numStops} stops)`;
  } else {
    return '';
  }
};



const P2PPublicTrans = async (startLocation, endLocation) => {

  try {
    const [startCoords, endCoords] = await Promise.all([
      getCoordinates(startLocation),
      getCoordinates(endLocation),
    ]);

    const busStops = await getAllBusStops();
    const nearestStart = findNearestBusStop(startCoords.lat, startCoords.lng, busStops);
    const nearestEnd = findNearestBusStop(endCoords.lat, endCoords.lng, busStops);
    const directBuses = await findDirectBusGroup(nearestStart.BusStopCode, nearestEnd.BusStopCode);

    const origin = `${startCoords.lat},${startCoords.lng}`;
    const destination = `${endCoords.lat},${endCoords.lng}`;
    const allRoutes = [];
    const seen = new Set();

    if (directBuses.length > 0) {
      const hash = `${nearestStart.Description}->${nearestEnd.Description}`;
      seen.add(hash);

      allRoutes.push({
        summary: "Bus Only",
        type: "Bus Only",
        distance: "-",
        duration: "Estimate",
        steps: [
          {
            instruction: `Walk to ${nearestStart.Description}`,
            travelMode: "WALKING",
            distance: "-"
          },
          {
            instruction: `Take Bus ${directBuses.join(' / ')} to ${nearestEnd.Description}`,
            travelMode: "TRANSIT",
            distance: "-",
            transitInfo: {
              lineNames: directBuses,
              lineName: directBuses[0],
              departureStop: nearestStart.Description,
              arrivalStop: nearestEnd.Description,
              headsign: nearestEnd.Description,
              numStops: directBuses.length,
              vehicleType: "BUS"
            }
          },
          {
            instruction: "Walk to your destination",
            travelMode: "WALKING",
            distance: "-"
          }
        ],
        markers: [
          { latitude: startCoords.lat, longitude: startCoords.lng, title: "Start" },
          { latitude: nearestStart.Latitude, longitude: nearestStart.Longitude, title: nearestStart.Description },
          { latitude: nearestEnd.Latitude, longitude: nearestEnd.Longitude, title: nearestEnd.Description },
          { latitude: endCoords.lat, longitude: endCoords.lng, title: "Destination" }
        ],
        polyline: [
          { latitude: startCoords.lat, longitude: startCoords.lng },
          { latitude: nearestStart.Latitude, longitude: nearestStart.Longitude },
          { latitude: nearestEnd.Latitude, longitude: nearestEnd.Longitude },
          { latitude: endCoords.lat, longitude: endCoords.lng }
        ]
      });
    }

    const routeVariants = [
      { label: "Fastest",     filters: {}             },
      { label: "Bus Only",    filters: { transitMode: "bus" } },
      { label: "MRT Only",    filters: { transitMode: "subway" } },
    ];
    

    for (const variant of routeVariants) {
      const googleRoutes = await findGoogleTransitRoute(origin, destination, variant.filters);
      for (const route of googleRoutes) {
        const decodedPolyline = polyline
        .decode(route.overview_polyline.points)
        .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
        let steps = await Promise.all(route.legs[0].steps.map(async (step) => {
          let transitInfo = null;
          let instruction = step.html_instructions.replace(/<[^>]+>/g, '');

          if (step.travel_mode === "TRANSIT" && step.transit_details) {
            const t = step.transit_details;
            const arrival = t.arrival_stop.name;
            const lookupKey = arrival
            .replace(/\s*MRT STATION$/i, '')
            .trim()
            .toUpperCase();
            const exitNumber = stationExitLookup[lookupKey] || null;            
            const lineNames = [t.line.short_name || t.line.name || 'Unknown'];
            const lineName  = lineNames[0];
            const departure = t.departure_stop.name;
            let vehicleType = t.line.vehicle.type.toUpperCase();
            const headsign = t.headsign;
            const numStops = t.num_stops;

            if (vehicleType === "RAIL" && (lineNames[0].startsWith("BP") || lineNames[0].startsWith("SE") || lineNames[0].startsWith("PE"))) {
              vehicleType = "SUBWAY";
            }
          
            transitInfo = {
              lineNames,              
              lineName,             
              departureStop: departure,
              arrivalStop:   arrival,
              headsign,
              numStops,
              exitNumber,
              vehicleType,
            };
          
             instruction = 
               `Board at ${t.departure_stop.name}` +
               ` - ${lineNames[0]} Line toward ${t.headsign}` +
               ` (${t.num_stops} stops)` +
              ` - ${t.arrival_stop.name}` +
               (exitNumber ? ` ${exitNumber}` : '');          }
          

          return {
            instruction,
            distance: step.distance?.text || "",
            travelMode: step.travel_mode,
            transitInfo,
          };
        }));

        const mergedSteps = [];
        for (const step of steps) {
          const last = mergedSteps[mergedSteps.length - 1];
          if (
            last &&
            last.travelMode === "TRANSIT" &&
            step.travelMode === "TRANSIT" &&
            last.transitInfo.lineName === step.transitInfo.lineName &&   
            last.transitInfo.vehicleType === step.transitInfo.vehicleType &&
            last.transitInfo.headsign    === step.transitInfo.headsign &&
            last.transitInfo.arrivalStop === step.transitInfo.departureStop
          ) {

          } else {
            mergedSteps.push(step);
          }
        }
        

        const type = classifyRoute(mergedSteps);
        if (type === "Walking Only") continue;

        const hash = mergedSteps.map(s => s.instruction).join('|');
        if (!seen.has(hash)) {
          seen.add(hash);

          if ((variant.label === "Bus Only" && type !== "Bus Only") ||
              (variant.label === "MRT Only" && type !== "MRT Only")) continue;

          allRoutes.push({
            summary: variant.label,
            type,
            distance: route.legs[0].distance.text,
            duration: route.legs[0].duration.text,
            steps: mergedSteps,
            markers: [
              { latitude: startCoords.lat, longitude: startCoords.lng, title: "Start" },
              { latitude: endCoords.lat, longitude: endCoords.lng, title: "Destination" }
            ],
            polyline: decodedPolyline
          });
        }
      }
    }


    const mergedRoutes = [];
    const groupMap = {};

    for (const route of allRoutes) {
      // catch any bus-only route, regardless of its summary label
      if (route.type === 'Bus Only' && route.steps[1]?.transitInfo) {
        const info = route.steps[1].transitInfo;
        const key  = `${info.departureStop}|${info.arrivalStop}`;

        if (!groupMap[key]) {
          // first time we see these two stops
          const infoCopy = { ...info, lineNames: [...info.lineNames] };
          // overwrite lineName so UI picks up the full list:
          infoCopy.lineName = infoCopy.lineNames.join(' / ');

          const newRoute = {
            ...route,
            steps: [
              route.steps[0],
              { ...route.steps[1], transitInfo: infoCopy },
              route.steps[2]
            ]
          };
          groupMap[key] = newRoute;
          mergedRoutes.push(newRoute);

        } else {
          // merge additional services onto the existing one
          const existingInfo = groupMap[key].steps[1].transitInfo;
          existingInfo.lineNames = Array.from(new Set([
            ...existingInfo.lineNames,
            ...info.lineNames
          ]));
          existingInfo.lineName = existingInfo.lineNames.join(' / ');

          groupMap[key].steps[1].instruction =
            `${info.departureStop} – ${buildInstruction(existingInfo)} – ${info.arrivalStop}`;
        }

      } else {
        // everything else (MRT, mixed, walking) stays as is
        mergedRoutes.push(route);
      }
    }

  const toMinutes = txt => {
    let hours = 0, mins = 0;
    const hMatch = txt.match(/(\d+)\s*(?:h|hour)/i);
    const mMatch = txt.match(/(\d+)\s*(?:m|min)/i);
    if (hMatch) hours = parseInt(hMatch[1], 10);
    if (mMatch) mins    = parseInt(mMatch[1], 10);
    // if no hours/minutes found, fall back to parsing a lone number
    if (!hMatch && !mMatch) {
      const n = parseFloat(txt);
      return isNaN(n) ? Infinity : n;
    }
    return hours * 60 + mins;
  };

  // sort by true duration in minutes
  mergedRoutes.sort((a, b) => {
    return toMinutes(a.duration) - toMinutes(b.duration);
  });

  return mergedRoutes;



  } catch (error) {
    console.error("Error fetching route:", error.response?.data || error.message);
    Alert.alert("Error", "Could not compute public transport route.");
    return [];
  }
};

export default P2PPublicTrans;
