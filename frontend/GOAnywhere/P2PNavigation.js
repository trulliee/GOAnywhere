P2PNavigation = () => {
    const [startLocation, setStartLocation] = useState('');
    const [endLocation, setEndLocation] = useState('');
    const [travelTime, setTravelTime] = useState(null);
  
    const handleDriverRoute = () => {
      const randomTime = Math.floor(Math.random() * (30 - 10 + 1)) + 10; // Random time between 10-30 mins
      setTravelTime(`${randomTime} Mins`);
    };
  
    return (
      <View style={styles.container}>
        <Text style={styles.title}>P2P Navigation</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Start Location"
          value={startLocation}
          onChangeText={setStartLocation}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Destination"
          value={endLocation}
          onChangeText={setEndLocation}
        />
        
        <TouchableOpacity style={styles.button} onPress={handleDriverRoute}>
          <Text style={styles.buttonText}>Calculate Route</Text>
        </TouchableOpacity>
  
        {travelTime && <Text style={styles.travelTime}>Estimated Travel Time: {travelTime}</Text>}
      </View>
    );
  };