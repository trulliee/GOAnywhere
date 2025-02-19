import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ScrollView } from "react-native";
import { useForm, Controller } from "react-hook-form";

const ReportIncident = () => {
  const { control, handleSubmit, reset, watch } = useForm();
  const [userType, setUserType] = useState("driver");

  const categories = {
    driver: ["Accident", "Road Works", "Police", "Weather", "Hazard", "Map Issue"],
    publicTransport: ["Accident", "Road Works", "High Crowd", "Weather", "Hazard", "Police"],
  };

  const subcategories = {
    Accident: ["Minor", "Major"],
    "Road Works": ["Minor", "Major"],
    Weather: ["Light Rain", "Moderate Rain", "Heavy Rain", "Thunderstorm"],
    Hazard: ["Fallen Tree", "Pothole", "Debris", "Flooded Road", "Slippery Surface", "Vehicle Breakdown"],
  };

  const selectedCategory = watch("category");

  const onSubmit = (data) => {
    const reportData = {
      userType,
      category: data.category,
      subcategory: data.subcategory || null,
      description: data.description,
      timestamp: new Date().toISOString(),
    };

    console.log("Report Submitted:", reportData);
    Alert.alert("Success", "Report submitted successfully!");
    reset();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Report an Incident</Text>

      {/* User Type Selection */}
      <View style={styles.userTypeContainer}>
        <TouchableOpacity onPress={() => setUserType("driver")} style={[styles.userTypeButton, userType === "driver" && styles.activeButton]}>
          <Text style={styles.buttonText}>Driver</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setUserType("publicTransport")} style={[styles.userTypeButton, userType === "publicTransport" && styles.activeButton]}>
          <Text style={styles.buttonText}>Public Transport</Text>
        </TouchableOpacity>
      </View>

      {/* Category Selection */}
      <Text style={styles.label}>Category</Text>
      <Controller
        control={control}
        name="category"
        rules={{ required: true }}
        render={({ field: { onChange, value } }) => (
          <View style={styles.pickerContainer}>
            {categories[userType].map((item) => (
              <TouchableOpacity key={item} style={[styles.categoryButton, value === item && styles.activeCategory]} onPress={() => onChange(item)}>
                <Text style={styles.categoryText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      />

      {/* Subcategory Selection (Only for specific categories) */}
      {selectedCategory && subcategories[selectedCategory] && (
        <>
          <Text style={styles.label}>Select Type</Text>
          <Controller
            control={control}
            name="subcategory"
            rules={{ required: true }}
            render={({ field: { onChange, value } }) => (
              <View style={styles.pickerContainer}>
                {subcategories[selectedCategory].map((item) => (
                  <TouchableOpacity key={item} style={[styles.categoryButton, value === item && styles.activeCategory]} onPress={() => onChange(item)}>
                    <Text style={styles.categoryText}>{item}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          />
        </>
      )}

      {/* Description Input */}
      <Text style={styles.label}>Description</Text>
      <Controller
        control={control}
        name="description"
        rules={{ required: true, minLength: 5 }}
        render={({ field: { onChange, value } }) => (
          <TextInput style={styles.input} placeholder="Describe the incident..." onChangeText={onChange} value={value} multiline />
        )}
      />

      {/* Submit Button */}
      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit(onSubmit)}>
        <Text style={styles.submitText}>Submit Report</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, backgroundColor: "#f5f5f5" },
  title: { fontSize: 22, fontWeight: "bold", marginBottom: 15, textAlign: "center" },
  userTypeContainer: { flexDirection: "row", justifyContent: "center", marginBottom: 15 },
  userTypeButton: { padding: 10, margin: 5, borderRadius: 8, backgroundColor: "#ccc" },
  activeButton: { backgroundColor: "#007bff" },
  buttonText: { color: "white", fontWeight: "bold" },
  label: { fontSize: 16, marginBottom: 5 },
  pickerContainer: { flexDirection: "row", flexWrap: "wrap", marginBottom: 15 },
  categoryButton: { padding: 10, margin: 5, borderRadius: 8, backgroundColor: "#ddd" },
  activeCategory: { backgroundColor: "#28a745" },
  categoryText: { fontWeight: "bold" },
  input: { backgroundColor: "white", padding: 10, borderRadius: 8, borderWidth: 1, borderColor: "#ccc", marginBottom: 15 },
  submitButton: { backgroundColor: "#dc3545", padding: 15, borderRadius: 8, alignItems: "center" },
  submitText: { color: "white", fontWeight: "bold", fontSize: 16 },
});

export default ReportIncident;
