//This file reads data from firebase, then put that into two dimensional array incidents. 
//It makes it so that the app doesn't access firebase everytime it needs to display the data.
//Atm stuff are mockup. When linking this to firebase, uncomment the commented stuff.


//import { collection, onSnapshot } from "firebase/firestore";
//import { db } from "./firebaseConfig"; // Your Firebase config file

export const INCIDENT_CATEGORIES = [
    "Driver",
    "Public Transport",
    "General",
  ];
  
  export const INCIDENT_DETAILS = [
    ["Road Hazard"],
    ["Delay", "Public Trasport Hazard", "Overcrowding"],
    ["Accident", "Weather", "Road Work", "Map Issue", "Police Supervision"],
  ];
  
  export const SEVERITY_LEVELS = ["Light", "Moderate", "Severe"];
  export const SEVERITY_COLORS = ["#4CAF50", "#FFC107", "#FF4C4C"]; // Green, Yellow, Red
  
  export let incidents = [];

  /*
  export const fetchFromDB = () => {
    const incidentsRef = collection(db, "traffic_incidents");
  
    // Listen for real-time changes
    onSnapshot(incidentsRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const newIncident = [
            change.doc.id, 
            change.doc.data().type, 
            change.doc.data().detail,
            change.doc.data().location,
            change.doc.data().time,
            change.doc.data().severity,
            change.doc.data().source,
            change.doc.data().confirmRate
          ];
  
          // Add to 2D array only if it's new
          if (!incidents.some(existing => existing[0] === newIncident[0])) {
            incidents.push(newIncident);
          }
        }
      });
    });
  };
  */


  export const fetchFromDB = async () => {
    const fetchedData = [
      ["7", "Road-Related", "Accident", "Highway 5", "2025/03/14 08:30 AM", 2, "Official Report", 0],
      ["8", "Public Transport", "Train Delay", "Metro Line A", "2025/03/14 09:00 AM", 1, "Crowdsourced", 0],
    ];
  
    // Only add incidents that do not already exist
    fetchedData.forEach((incident) => {
      if (!incidents.some(existing => existing[0] === incident[0])) {
        incidents.push(incident);
      }
    });
  };
  