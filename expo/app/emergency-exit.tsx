import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { useSafetyStore } from '@/store/safetyStore';
import { ChevronDown, Clock } from 'lucide-react-native';

export default function EmergencyExitScreen() {
  const router = useRouter();
  const { scheduleEmergencyExit, setCodeWord } = useSafetyStore();
  
  const [selectedTab, setSelectedTab] = useState(0);
  const [excuse, setExcuse] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callerNumber, setCallerNumber] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [codeWord, setCodeWordState] = useState('');
  const [checkInInterval, setCheckInInterval] = useState('');
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showIntervalPicker, setShowIntervalPicker] = useState(false);
  
  const timeOptions = [
    '5 minutes', '10 minutes', '15 minutes', '30 minutes', '1 hour'
  ];
  
  const intervalOptions = [
    '15 minutes', '30 minutes', '1 hour', '2 hours', '4 hours'
  ];
  
  const handleScheduleFakeCall = () => {
    // Schedule a fake call
    const timeInMs = Date.now() + 5 * 60 * 1000; // 5 minutes from now
    scheduleEmergencyExit(timeInMs);
    
    router.replace('/(tabs)');
  };
  
  const handleSetCodeWord = () => {
    // Set the code word
    setCodeWord(codeWord);
    
    router.replace('/(tabs)');
  };
  
  const handleSetAutomatedCheckIn = () => {
    // Set up automated check-in
    
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 0 && styles.selectedTab,
          ]}
          onPress={() => setSelectedTab(0)}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 0 && styles.selectedTabText,
            ]}
          >
            Schedule a fake call
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 1 && styles.selectedTab,
          ]}
          onPress={() => setSelectedTab(1)}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 1 && styles.selectedTabText,
            ]}
          >
            Alert during a real call
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.tab,
            selectedTab === 2 && styles.selectedTab,
          ]}
          onPress={() => setSelectedTab(2)}
        >
          <Text
            style={[
              styles.tabText,
              selectedTab === 2 && styles.selectedTabText,
            ]}
          >
            Automated check-ins
          </Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {selectedTab === 0 && (
          <View style={styles.fakeCallContainer}>
            <Text style={styles.description}>
              Set up a fake incoming call with a pre-set excuse to leave an uncomfortable situation.
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Enter excuse</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Family emergency, need to leave now"
                value={excuse}
                onChangeText={setExcuse}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Enter caller name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., Mom, Friend, Boss"
                value={callerName}
                onChangeText={setCallerName}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Enter caller number</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., (123) 456-7890"
                value={callerNumber}
                onChangeText={setCallerNumber}
                keyboardType="phone-pad"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Select time</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowTimePicker(!showTimePicker)}
              >
                <Text style={styles.pickerButtonText}>
                  {selectedTime || 'Select time for the call'}
                </Text>
                <Clock size={20} color={Colors.heroPrimary} />
              </TouchableOpacity>
              
              {showTimePicker && (
                <View style={styles.pickerOptions}>
                  {timeOptions.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pickerOption}
                      onPress={() => {
                        setSelectedTime(option);
                        setShowTimePicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        )}
        
        {selectedTab === 1 && (
          <View style={styles.codeWordContainer}>
            <Text style={styles.description}>
              Activate an alert using a code word during a real call. The app will send a message to your emergency contacts.
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Enter code word</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., pineapple, red flag"
                value={codeWord}
                onChangeText={setCodeWordState}
              />
            </View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>How it works:</Text>
              <Text style={styles.infoText}>
                1. During a real phone call, say your code word in conversation.
              </Text>
              <Text style={styles.infoText}>
                2. The app will detect the word and send a message to your emergency contacts.
              </Text>
              <Text style={styles.infoText}>
                3. The message will include your current location and a request for help.
              </Text>
            </View>
          </View>
        )}
        
        {selectedTab === 2 && (
          <View style={styles.checkInContainer}>
            <Text style={styles.description}>
              Set up automated check-ins to ensure your safety. If you don't respond within a set time, your emergency contacts will be notified.
            </Text>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Select check-in interval</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowIntervalPicker(!showIntervalPicker)}
              >
                <Text style={styles.pickerButtonText}>
                  {checkInInterval || 'Select interval'}
                </Text>
                <ChevronDown size={20} color={Colors.heroPrimary} />
              </TouchableOpacity>
              
              {showIntervalPicker && (
                <View style={styles.pickerOptions}>
                  {intervalOptions.map((option, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.pickerOption}
                      onPress={() => {
                        setCheckInInterval(option);
                        setShowIntervalPicker(false);
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
            
            <View style={styles.infoContainer}>
              <Text style={styles.infoTitle}>How it works:</Text>
              <Text style={styles.infoText}>
                1. The app will send you a notification at the specified interval.
              </Text>
              <Text style={styles.infoText}>
                2. You must respond to the notification to confirm you're safe.
              </Text>
              <Text style={styles.infoText}>
                3. If you don't respond, your emergency contacts will be notified with your last known location.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
      
      <View style={styles.footer}>
        <HeroButton
          title="Cancel"
          onPress={() => router.back()}
          variant="outline"
          style={styles.cancelButton}
        />
        
        <HeroButton
          title={
            selectedTab === 0
              ? "Schedule Call"
              : selectedTab === 1
              ? "Save Code Word"
              : "Set Check-In"
          }
          onPress={
            selectedTab === 0
              ? handleScheduleFakeCall
              : selectedTab === 1
              ? handleSetCodeWord
              : handleSetAutomatedCheckIn
          }
          variant="hero"
          style={styles.saveButton}
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
  tabsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 16,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
    marginBottom: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[200],
  },
  selectedTab: {
    backgroundColor: Colors.heroPrimary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray[700],
  },
  selectedTabText: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  description: {
    fontSize: 16,
    color: Colors.gray[600],
    marginBottom: 24,
    lineHeight: 22,
  },
  fakeCallContainer: {},
  codeWordContainer: {},
  checkInContainer: {},
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  pickerButtonText: {
    fontSize: 16,
    color: Colors.text,
  },
  pickerOptions: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  pickerOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  infoContainer: {
    backgroundColor: Colors.heroPrimary + '10',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heroPrimary,
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
  saveButton: {
    flex: 2,
    marginLeft: 8,
  },
});