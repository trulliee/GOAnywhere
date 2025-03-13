//This file read both from IncidentData and IncidentDisplay, and display the whole page

import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import IncidentDisplay from "./IncidentDisplay";
import { incidents, fetchFromDB } from "./IncidentData";

const TrafficIncident = () => {
  const [incidentList, setIncidentList] = useState([]);

  useEffect(() => {
    fetchFromDB().then(() => {
      setIncidentList([...incidents]); // Ensure updated list
    });
  }, []);

  // Function to update confirmRate
  const updateConfirmRate = (id, change) => {
    const updatedIncidents = incidentList.map((incident) => {
      if (incident[0] === id) {
        return [...incident.slice(0, 7), incident[7] + change]; // Modify confirmRate
      }
      return incident;
    });

    setIncidentList(updatedIncidents);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Traffic Incidents</Text>
      <FlatList
        data={incidentList}
        keyExtractor={(item) => item[0]} // Use ID as unique key
        renderItem={({ item }) => (
          <IncidentDisplay
            id={item[0]}
            type={item[1]}
            detail={item[2]}
            location={item[3]}
            time={item[4]}
            severity={item[5]}
            source={item[6]}
            confirmRate={item[7]}
            onUpdateConfirmRate={updateConfirmRate}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5", padding: 16 },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
});

export default TrafficIncident;
