import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { useSafetyStore } from '@/store/safetyStore';
import { ChevronDown } from 'lucide-react-native';

export default function SafetyCheckInScreen() {
  const router = useRouter();
  const { startSafetyCheckIn } = useSafetyStore();
  
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('15');
  const [alertMessage, setAlertMessage] = useState("I haven't checked in on time. Please contact me to make sure I'm okay.");
  
  const timeOptions = [
    { label: '15 minutes', value: 15 },
    { label: '30 minutes', value: 30 },
    { label: '1 hour', value: 60 },
    { label: '2 hours', value: 120 },
    { label: 'Custom', value: 'custom' },
  ];
  
  const [selectedTimeOption, setSelectedTimeOption] = useState(0);
  const [showTimeOptions, setShowTimeOptions] = useState(false);
  
  const handleTimeOptionSelect = (index: number) => {
    setSelectedTimeOption(index);
    setShowTimeOptions(false);
    
    const option = timeOptions[index];
    if (option.value === 'custom') {
      // Keep current values for custom
      return;
    }
    
    if (option.value >= 60) {
      setHours(Math.floor(option.value / 60).toString());
      setMinutes((option.value % 60).toString());
    } else {
      setHours('0');
      setMinutes(option.value.toString());
    }
  };
  
  const handleStartCheckIn = () => {
    const totalMinutes = parseInt(hours) * 60 + parseInt(minutes);
    startSafetyCheckIn(totalMinutes);
    
    // In a real app, this would set up a notification to remind the user to check in
    
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Set a timer for your activity</Text>
        
        <View style={styles.timerContainer}>
          <TouchableOpacity
            style={styles.timeSelector}
            onPress={() => setShowTimeOptions(!showTimeOptions)}
          >
            <Text style={styles.timeSelectorText}>
              {timeOptions[selectedTimeOption].label}
            </Text>
            <ChevronDown size={20} color={Colors.text} />
          </TouchableOpacity>
          
          {showTimeOptions && (
            <View style={styles.timeOptionsContainer}>
              {timeOptions.map((option, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.timeOption,
                    selectedTimeOption === index && styles.selectedTimeOption,
                  ]}
                  onPress={() => handleTimeOptionSelect(index)}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      selectedTimeOption === index && styles.selectedTimeOptionText,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          
          {(selectedTimeOption === timeOptions.length - 1 || !showTimeOptions) && (
            <View style={styles.customTimeContainer}>
              <View style={styles.timeInputContainer}>
                <TextInput
                  style={styles.timeInput}
                  value={hours}
                  onChangeText={setHours}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeLabel}>Hours</Text>
              </View>
              
              <View style={styles.timeInputContainer}>
                <TextInput
                  style={styles.timeInput}
                  value={minutes}
                  onChangeText={setMinutes}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.timeLabel}>Minutes</Text>
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.messageContainer}>
          <Text style={styles.sectionTitle}>Customize your alert message</Text>
          <TextInput
            style={styles.messageInput}
            value={alertMessage}
            onChangeText={setAlertMessage}
            multiline
            numberOfLines={4}
          />
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>
            1. Set a timer for your activity (e.g., walking home, meeting someone).
          </Text>
          <Text style={styles.infoText}>
            2. When the timer ends, you'll receive a notification to check in.
          </Text>
          <Text style={styles.infoText}>
            3. If you don't check in, an alert with your message and location will be sent to your Circle of Trust.
          </Text>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <HeroButton
          title="Cancel"
          onPress={() => router.back()}
          variant="outline"
          style={styles.cancelButton}
        />
        
        <HeroButton
          title="Start Safety Check-In"
          onPress={handleStartCheckIn}
          style={styles.startButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 24,
  },
  timerContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  timeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
    marginBottom: 16,
  },
  timeSelectorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  timeOptionsContainer: {
    marginBottom: 16,
  },
  timeOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  selectedTimeOption: {
    backgroundColor: Colors.primary + '10',
  },
  timeOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  selectedTimeOptionText: {
    fontWeight: '600',
    color: Colors.primary,
  },
  customTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeInputContainer: {
    width: '45%',
  },
  timeInput: {
    backgroundColor: Colors.gray[100],
    borderRadius: 12,
    padding: 16,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  timeLabel: {
    fontSize: 14,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  messageContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  messageInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    height: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  infoContainer: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.gray[200],
    padding: 16,
    flexDirection: 'row',
  },
  cancelButton: {
    flex: 1,
    marginRight: 8,
  },
  startButton: {
    flex: 2,
    marginLeft: 8,
  },
});