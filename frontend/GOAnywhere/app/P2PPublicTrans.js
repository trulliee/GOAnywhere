import axios from 'axios';
import polyline from '@mapbox/polyline';

const GOOGLE_MAPS_API_KEY = "AIzaSyDzdl-AzKqD_NeAdrz934cQM6LxWEHYF1g";
const LTA_ACCOUNT_KEY     = "CetOCVT4SmqDrAHkHLrf5g==";

// API Endpoints
const GOOGLE_GEOCODE_URL       = "https://maps.googleapis.com/maps/api/geocode/json";
const GOOGLE_DIRECTIONS_URL    = "https://maps.googleapis.com/maps/api/directions/json";
const LTA_BUS_STOPS_API        = "https://datamall2.mytransport.sg/ltaodataservice/BusStops";
const LTA_BUS_ROUTES_API       = "https://datamall2.mytransport.sg/ltaodataservice/BusRoutes";
const TRAIN_SERVICE_ALERTS_URL = "https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts";
const BUS_ARRIVAL_URL          = "https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival";
const TRAFFIC_INCIDENTS_URL    = "https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents";
const ROAD_WORKS_URL           = "https://datamall2.mytransport.sg/ltaodataservice/RoadWorks";

// MRT Station Exits data
const stationExits = require('./MRTStationExit.json');

/**
 * Get coordinates from an address or coordinates string
 * @param {string} address - Address or coordinates string
 * @returns {Promise<{lat: number, lng: number}>} - Coordinates
 */
const getCoordinates = async (address) => {
  // Handle if already coordinates
  if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?/.test(address)) {
    const [lat, lng] = address.split(',').map(Number);
    return { lat, lng };
  }
  
  // Add Singapore to address if not included
  const formatted = address.toLowerCase().includes("singapore")
    ? address
    : `${address}, Singapore`;

  try {
    const response = await axios.get(
      `${GOOGLE_GEOCODE_URL}?address=${encodeURIComponent(formatted)}&key=${GOOGLE_MAPS_API_KEY}`
    );

    if (response.data.status !== "OK" || !response.data.results?.length) {
      throw new Error(`Invalid location: "${address}"`);
    }
    
    if (response.data.results[0].partial_match) {
      const types = response.data.results[0].types || [];
      // Allow if Google recognized it as a station, route, or establishment
      if (
        !types.includes('transit_station') &&
        !types.includes('route') &&
        !types.includes('establishment')
      ) {
        throw new Error(`Uncertain match for: "${address}"`);
      }
    }
    
    const { lat, lng } = response.data.results[0].geometry.location;
    return { lat, lng };
  } catch (error) {
    console.error("Geocoding error:", error);
    throw new Error(`Could not find location: ${address}`);
  }
};

/**
 * Fetch train service alerts from LTA
 * @returns {Promise<Array>} - Array of affected train lines
 */
async function fetchTrainAlerts() {
  try {
    const { data } = await axios.get(`${TRAIN_SERVICE_ALERTS_URL}?$top=50`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value.map(x => x.Line) : [];
  } catch (e) {
    console.warn("⚠️ Could not fetch train alerts:", e.message);
    return [];
  }
}

/**
 * Fetch bus load status for a specific bus stop and service
 * @param {string} stopCode - Bus stop code
 * @param {string} serviceNo - Bus service number
 * @returns {Promise<string|null>} - Load status (SEA, SDA, LSD) or null
 */
async function fetchBusLoad(stopCode, serviceNo) {
  // Guard against undefined
  if (!stopCode || !serviceNo) return null;

  try {
    const { data } = await axios.get(
      `${BUS_ARRIVAL_URL}?BusStopCode=${stopCode}&ServiceNo=${serviceNo}`,
      { headers: { AccountKey: LTA_ACCOUNT_KEY } }
    );
    // Data.value is an array of up to 3 predictions; take the first
    const first = Array.isArray(data.Services) && data.Services.length > 0 ? data.Services[0] : null;
    return first?.Load || null;   // "SEA" / "SDA" / "LSD"
  } catch (e) {
    console.warn(`BusArrival failed for ${stopCode}/${serviceNo}:`, e.message);
    return null;
  }
}

/**
 * Fetch traffic incidents from LTA
 * @returns {Promise<Array>} - Array of traffic incidents
 */
async function fetchTrafficIncidents() {
  try {
    const { data } = await axios.get(`${TRAFFIC_INCIDENTS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value : [];
  } catch (e) {
    console.warn("⚠️ Could not fetch traffic incidents:", e.message);
    return [];
  }
}

/**
 * Fetch road works from LTA
 * @returns {Promise<Array>} - Array of road works
 */
async function fetchRoadWorks() {
  try {
    const { data } = await axios.get(`${ROAD_WORKS_URL}?$top=100`, {
      headers: { AccountKey: LTA_ACCOUNT_KEY }
    });
    return Array.isArray(data.value) ? data.value : [];
  } catch (e) {
    console.warn("⚠️ Could not fetch road works:", e.message);
    return [];
  }
}

/**
 * Get all bus stops from LTA
 * @returns {Promise<Array>} - Array of bus stops
 */
const getAllBusStops = async () => {
  try {
    const response = await axios.get(LTA_BUS_STOPS_API, {
      headers: { AccountKey: LTA_ACCOUNT_KEY },
    });
    return response.data.value || [];
  } catch (error) {
    console.warn("⚠️ Could not fetch bus stops:", error.message);
    return [];
  }
};

/**
 * Find the nearest bus stop to coordinates
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {Array} stops - Array of bus stops
 * @returns {Object} - Nearest bus stop
 */
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

/**
 * Build a lookup of MRT station exits
 * @returns {Object} - Lookup of station names to exit codes
 */
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

// Build station exit lookup
const stationExitLookup = buildExitLookup();

/**
 * Find direct bus routes between two bus stops
 * @param {string} startCode - Starting bus stop code
 * @param {string} endCode - Ending bus stop code
 * @returns {Promise<Array>} - Array of bus service numbers
 */
const findDirectBusGroup = async (startCode, endCode) => {
  try {
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
  } catch (error) {
    console.warn("⚠️ Could not find direct bus routes:", error.message);
    return [];
  }
};

/**
 * Classify a route by transport types
 * @param {Array} steps - Route steps
 * @returns {string} - Route type classification
 */
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

/**
 * Find transit routes using Google Directions API
 * @param {string} origin - Origin coordinates
 * @param {string} destination - Destination coordinates
 * @param {Object} filters - Filters for transit mode
 * @returns {Promise<Array>} - Array of routes
 */
const findGoogleTransitRoute = async (origin, destination, filters = {}) => {
  const { transitMode = "" } = filters;
  try {
    const url = `${GOOGLE_DIRECTIONS_URL}?origin=${origin}&destination=${destination}&mode=transit&alternatives=true${transitMode ? `&transit_mode=${transitMode}` : ""}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await axios.get(url);

    if (response.data.status !== "OK") {
      console.warn(`Transit Directions API returned: ${response.data.status}`);
      return [];
    }
    return response.data.routes || [];
  } catch (error) {
    console.warn("⚠️ Could not fetch Google transit routes:", error.message);
    return [];
  }
};

/**
 * Build a transit instruction
 * @param {Object} transitInfo - Transit information
 * @returns {string} - Formatted instruction
 */
const buildInstruction = (transitInfo) => {
  if (transitInfo.vehicleType === "SUBWAY") {
    return `${transitInfo.lineNames.join(' / ')} Line toward ${transitInfo.headsign}${transitInfo.exitNumber ? ` - ${transitInfo.exitNumber}` : ''} (${transitInfo.numStops} stops)`;
  } else if (transitInfo.vehicleType === "BUS") {
    return `Bus ${transitInfo.lineNames.join(' / ')} (${transitInfo.numStops} stops)`;
  } else {
    return '';
  }
};

/**
 * Check if a point is near an incident
 * @param {Object} pt - Point with latitude and longitude
 * @param {Object} inc - Incident with Latitude and Longitude
 * @param {number} threshold - Distance threshold
 * @returns {boolean} - True if point is near incident
 */
const isNear = (pt, inc, threshold = 0.0001) => {
  return (
    Math.abs(pt.latitude  - inc.Latitude)  < threshold &&
    Math.abs(pt.longitude - inc.Longitude) < threshold
  );
};

/**
 * Convert duration text to minutes
 * @param {string} txt - Duration text
 * @returns {number} - Minutes
 */
const toMinutes = txt => {
  let hours = 0, mins = 0;
  const hMatch = txt.match(/(\d+)\s*(?:h|hour)/i);
  const mMatch = txt.match(/(\d+)\s*(?:m|min)/i);
  if (hMatch) hours = parseInt(hMatch[1], 10);
  if (mMatch) mins = parseInt(mMatch[1], 10);
  // If no hours/minutes found, fall back to parsing a lone number
  if (!hMatch && !mMatch) {
    const n = parseFloat(txt);
    return isNaN(n) ? Infinity : n;
  }
  return hours * 60 + mins;
};

/**
 * Get public transit routes between two locations
 * @param {string} startLocation - Starting address
 * @param {string} endLocation - Ending address
 * @returns {Promise<Array>} - Array of route objects
 */
const P2PPublicTrans = async (startLocation, endLocation) => {
  try {
    // Get coordinates for start and end locations
    const [startCoords, endCoords] = await Promise.all([
      getCoordinates(startLocation),
      getCoordinates(endLocation),
    ]);

    // Check if start and end are the same
    if (
      startCoords.lat === endCoords.lat &&
      startCoords.lng === endCoords.lng
    ) {
      throw new Error('Origin and destination cannot be the same.');
    }

    // Get all bus stops and find nearest to start and end
    const busStops = await getAllBusStops();
    const nearestStart = findNearestBusStop(startCoords.lat, startCoords.lng, busStops);
    const nearestEnd = findNearestBusStop(endCoords.lat, endCoords.lng, busStops);
    
    // Find direct bus routes between nearest bus stops
    const directBuses = await findDirectBusGroup(nearestStart.BusStopCode, nearestEnd.BusStopCode);

    const origin = `${startCoords.lat},${startCoords.lng}`;
    const destination = `${endCoords.lat},${endCoords.lng}`;
    const allRoutes = [];
    const seen = new Set();

    // Add direct bus route if available
    if (directBuses.length > 0) {
      const hash = `${nearestStart.Description}->${nearestEnd.Description}`;
      seen.add(hash);

      allRoutes.push({
        summary: "Bus Only",
        type: "Bus Only",
        distance: "Varies",
        duration: "Estimate",
        durationValue: 30 * 60, // Estimated 30 mins
        steps: [
          {
            instruction: `Walk to ${nearestStart.Description}`,
            travelMode: "WALKING",
            distance: "Varies"
          },
          {
            instruction: `Take Bus ${directBuses.join(' / ')} to ${nearestEnd.Description}`,
            travelMode: "TRANSIT",
            distance: "Varies",
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
            distance: "Varies"
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

    // Define route variants to search for
    const routeVariants = [
      { label: "Fastest",  filters: {}                    },
      { label: "Bus Only", filters: { transitMode: "bus" } },
      { label: "MRT Only", filters: { transitMode: "subway" } },
    ];
    
    // Get routes for each variant
    for (const variant of routeVariants) {
      const googleRoutes = await findGoogleTransitRoute(origin, destination, variant.filters);
      
      for (const route of googleRoutes) {
        // Decode polyline
        const decodedPolyline = polyline
          .decode(route.overview_polyline.points)
          .map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
        
        // Process steps
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

            // Fix vehicle type for Singapore LRT
            if (vehicleType === "RAIL" && (
                lineNames[0].startsWith("BP") || 
                lineNames[0].startsWith("SE") || 
                lineNames[0].startsWith("PE")
            )) {
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
              departureTime: t.departure_time?.text,
              arrivalTime: t.arrival_time?.text,
              departureTimestamp: t.departure_time?.value,
              arrivalTimestamp: t.arrival_time?.value
            };
          
            instruction = 
              `Board at ${t.departure_stop.name}` +
              ` - ${lineNames[0]} Line toward ${t.headsign}` +
              ` (${t.num_stops} stops)` +
              ` - ${t.arrival_stop.name}` +
              (exitNumber ? ` ${exitNumber}` : '');
          }

          return {
            instruction,
            distance: step.distance?.text || "Varies",
            duration: step.duration?.text || "Varies",
            travelMode: step.travel_mode,
            transitInfo,
            startLocation: step.start_location ? {
              latitude: step.start_location.lat,
              longitude: step.start_location.lng
            } : null,
            endLocation: step.end_location ? {
              latitude: step.end_location.lat,
              longitude: step.end_location.lng
            } : null
          };
        }));

        // Merge consecutive transit steps on the same line
        const mergedSteps = [];
        for (const step of steps) {
          const last = mergedSteps[mergedSteps.length - 1];
          if (
            last &&
            last.travelMode === "TRANSIT" &&
            step.travelMode === "TRANSIT" &&
            last.transitInfo.lineName === step.transitInfo.lineName &&   
            last.transitInfo.vehicleType === step.transitInfo.vehicleType &&
            last.transitInfo.headsign === step.transitInfo.headsign &&
            last.transitInfo.arrivalStop === step.transitInfo.departureStop
          ) {
          // Skip redundant step
        } else {
          mergedSteps.push(step);
        }
      }
      
      // Classify route type
      const type = classifyRoute(mergedSteps);
      if (type === "Walking Only") continue; // Skip walking-only routes

      // Create hash to check for duplicates
      const hash = mergedSteps.map(s => s.instruction).join('|');
      if (!seen.has(hash)) {
        seen.add(hash);

        // Skip if variant doesn't match route type
        if ((variant.label === "Bus Only" && type !== "Bus Only") ||
            (variant.label === "MRT Only" && type !== "MRT Only")) continue;

        // Add route to results
        allRoutes.push({
          summary: variant.label,
          type,
          distance: route.legs[0].distance.text,
          duration: route.legs[0].duration.text,
          durationValue: route.legs[0].duration.value,
          steps: mergedSteps,
          markers: [
            { latitude: startCoords.lat, longitude: startCoords.lng, title: "Start" },
            { latitude: endCoords.lat, longitude: endCoords.lng, title: "Destination" }
          ],
          polyline: decodedPolyline,
          warnings: route.warnings || [],
          fareInfo: route.fare,
          walkingDistance: calculateWalkingDistance(mergedSteps),
          transitCount: countTransitSegments(mergedSteps),
          transferCount: countTransfers(mergedSteps)
        });
      }
    }
  }

  // Merge similar bus routes
  const mergedRoutes = [];
  const groupMap = {};

  for (const route of allRoutes) {
    // Handle bus-only routes specially
    if (route.type === 'Bus Only' && route.steps[1]?.transitInfo) {
      const info = route.steps[1].transitInfo;
      const key = `${info.departureStop}|${info.arrivalStop}`;

      if (!groupMap[key]) {
        // First time seeing these stops - create new route
        const infoCopy = { ...info, lineNames: [...info.lineNames] };
        // Update lineName to show all options
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
        // Merge additional bus services into existing route
        const existingInfo = groupMap[key].steps[1].transitInfo;
        existingInfo.lineNames = Array.from(new Set([
          ...existingInfo.lineNames,
          ...info.lineNames
        ]));
        existingInfo.lineName = existingInfo.lineNames.join(' / ');

        // Update instruction with merged services
        groupMap[key].steps[1].instruction =
          `${info.departureStop} – ${buildInstruction(existingInfo)} – ${info.arrivalStop}`;
      }
    } else {
      // Non-bus-only routes stay as-is
      mergedRoutes.push(route);
    }
  }

  // Sort routes by duration
  mergedRoutes.sort((a, b) => toMinutes(a.duration) - toMinutes(b.duration));

  // Fetch alert data
  const [railDown, trafficIncidents, roadWorks] = await Promise.all([
    fetchTrainAlerts(),
    fetchTrafficIncidents(),
    fetchRoadWorks()
  ]);

  // Create code-by-description lookup for bus stops
  const codeByDesc = Object.fromEntries(
    busStops.map(s => [s.Description, s.BusStopCode])
  );

  // Add issues to routes
  await Promise.all(mergedRoutes.map(async route => {
    const issues = [];  
  
    // Check for train delays
    if (route.steps.some(s =>
          s.transitInfo?.vehicleType === "SUBWAY" &&
          railDown.includes(s.transitInfo.lineName)
       )) {
      issues.push("train delays");
    }
    
    // Check for bus crowding
    for (const s of route.steps) {
      const ti = s.transitInfo;
      if (ti?.vehicleType === 'BUS') {
        const code = codeByDesc[ti.departureStop];
        const load = await fetchBusLoad(code, ti.lineName);
        if (load === 'SDA' || load === 'LSD') {
          issues.push("crowded bus");
          break;
        }
      }
    }
  
    // Check for traffic issues if route involves buses
    const usesBus = route.steps.some(s =>
      s.transitInfo?.vehicleType === "BUS"
    );
  
    if (usesBus) {
      // Check for incidents near route
      const nearbyInc = trafficIncidents.some(inc =>
        route.polyline.some(pt => isNear(pt, inc))
      );
      if (nearbyInc) issues.push("traffic incident");
    
      // Check for road works near route
      const nearbyWork = roadWorks.some(w =>
        route.polyline.some(pt => isNear(pt, w))
      );
      if (nearbyWork) issues.push("road works");
    }
  
    // Add issues and reliability score to route
    route.issues = issues;
    route.reliabilityScore = 100 - (issues.length * 15);
    
    // Calculate walking minutes
    route.walkingMinutes = calculateWalkingMinutes(route.steps);
  }));

  return mergedRoutes;
} catch (error) {
  console.error(
    "Error fetching public-transit route:",
    error.response?.data || error.message
  );
  throw new Error('Public-transport routes failed: ' + (error.message || 'unknown'));
}
};

/**
* Calculate total walking distance in meters
* @param {Array} steps - Route steps
* @returns {number} - Walking distance in meters
*/
function calculateWalkingDistance(steps) {
let totalMeters = 0;

for (const step of steps) {
  if (step.travelMode === "WALKING" && step.distance) {
    // Try to extract number from distance text (e.g., "500 m", "1.2 km")
    const match = step.distance.match(/(\d+(?:\.\d+)?)\s*(m|km)/i);
    if (match) {
      const value = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      
      // Convert to meters
      if (unit === 'm') {
        totalMeters += value;
      } else if (unit === 'km') {
        totalMeters += value * 1000;
      }
    }
  }
}

return totalMeters;
}

/**
* Calculate walking time in minutes
* @param {Array} steps - Route steps
* @returns {number} - Walking time in minutes
*/
function calculateWalkingMinutes(steps) {
let totalMinutes = 0;

for (const step of steps) {
  if (step.travelMode === "WALKING" && step.duration) {
    // Extract minutes from duration text
    totalMinutes += toMinutes(step.duration);
  }
}

return Math.round(totalMinutes);
}

/**
* Count number of transit segments (bus and train)
* @param {Array} steps - Route steps
* @returns {number} - Number of transit segments
*/
function countTransitSegments(steps) {
return steps.filter(step => step.travelMode === "TRANSIT").length;
}

/**
* Count number of transfers between transit segments
* @param {Array} steps - Route steps
* @returns {number} - Number of transfers
*/
function countTransfers(steps) {
const transitSteps = steps.filter(step => step.travelMode === "TRANSIT");
return Math.max(0, transitSteps.length - 1);
}

export default P2PPublicTrans;