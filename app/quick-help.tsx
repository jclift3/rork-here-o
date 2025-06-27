import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import SegmentedControl from '@/components/SegmentedControl';
import { useUserStore } from '@/store/userStore';
import { useHelpRequestsStore } from '@/store/helpRequestsStore';
import { MapPin, Mic, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function QuickHelpScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  const addRequest = useHelpRequestsStore((state) => state.addRequest);
  
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [helpType, setHelpType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const segments = ['Here-o', 'Her-o'];
  
  const helpTypes = [
    { id: 'unsafe', label: 'I feel unsafe', emoji: '😨' },
    { id: 'medical', label: 'Medical emergency', emoji: '🚑' },
    { id: 'assistance', label: 'I need assistance', emoji: '🆘' },
    { id: 'groceries', label: 'Need help with groceries', emoji: '🛒' },
    { id: 'ride', label: 'Looking for a ride', emoji: '🚗' },
    { id: 'other', label: 'Other', emoji: '❓' },
  ];
  
  const handleHelpTypeSelect = (type: string) => {
    setHelpType(type);
    if (type === 'unsafe' || type === 'medical') {
      setIsEmergency(true);
    } else {
      setIsEmergency(false);
    }
    
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
  };
  
  const toggleEmergency = () => {
    setIsEmergency(!isEmergency);
    
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };
  
  const handleRecordVoice = () => {
    setIsRecording(!isRecording);
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(
        isRecording 
          ? Haptics.NotificationFeedbackType.Success 
          : Haptics.NotificationFeedbackType.Warning
      );
    }
    
    // In a real app, this would start/stop recording
    if (!isRecording) {
      // Start recording
    } else {
      // Stop recording and process the audio
      setIsRecording(false);
    }
  };
  
  const handleSubmit = () => {
    if (!helpType) return;
    
    setIsLoading(true);
    
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    
    // Create a new help request
    const newRequest = {
      id: Date.now().toString(),
      userId: user?.id || '1',
      user: user || {
        id: '1',
        name: 'Anonymous',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80',
        gender: 'prefer-not-to-say',
        isVerified: false,
        joinedDate: new Date().toISOString().split('T')[0],
      },
      type: helpType as any,
      description: description,
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        address: '123 Market St, San Francisco, CA',
      },
      createdAt: new Date().toISOString(),
      status: 'active',
      visibility: selectedSegment === 0 ? 'here-o' : 'her-o',
      isEmergency: isEmergency,
    };
    
    // Add the request to the store
    addRequest(newRequest);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      router.replace('/(tabs)/requests');
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>What kind of help do you need?</Text>
        
        <View style={styles.segmentContainer}>
          <SegmentedControl
            segments={segments}
            selectedIndex={selectedSegment}
            onChange={(index) => {
              if (index === 1 && user?.gender !== 'female') {
                // Show alert or message that Her-o is for female users only
                return;
              }
              setSelectedSegment(index);
            }}
            variant={selectedSegment === 1 ? 'hero' : 'primary'}
          />
          
          {selectedSegment === 1 && user?.gender !== 'female' && (
            <Text style={styles.restrictedText}>
              Her-o is only available for female users.
            </Text>
          )}
        </View>
        
        <View style={styles.helpTypesContainer}>
          {helpTypes.map((type) => (
            <TouchableOpacity
              key={type.id}
              style={[
                styles.helpTypeButton,
                helpType === type.id && styles.selectedHelpType,
                helpType === type.id && selectedSegment === 1 && styles.selectedHeroHelpType,
              ]}
              onPress={() => handleHelpTypeSelect(type.id)}
            >
              <Text style={styles.helpTypeEmoji}>{type.emoji}</Text>
              <Text
                style={[
                  styles.helpTypeLabel,
                  helpType === type.id && styles.selectedHelpTypeLabel,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        
        {helpType && (
          <>
            <View style={styles.locationContainer}>
              <View style={styles.locationHeader}>
                <Text style={styles.sectionTitle}>Where are you?</Text>
                <TouchableOpacity style={styles.locationButton}>
                  <MapPin size={16} color={Colors.primary} />
                  <Text style={styles.locationButtonText}>Use my location</Text>
                </TouchableOpacity>
              </View>
              
              <View style={styles.locationInput}>
                <Text style={styles.locationText}>
                  123 Market St, San Francisco, CA
                </Text>
              </View>
            </View>
            
            <View style={styles.descriptionContainer}>
              <Text style={styles.sectionTitle}>Additional details (optional)</Text>
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe your situation..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
              
              <TouchableOpacity
                style={[
                  styles.voiceButton,
                  isRecording && styles.recordingButton,
                ]}
                onPress={handleRecordVoice}
              >
                {isRecording ? (
                  <>
                    <X size={20} color={Colors.white} />
                    <Text style={styles.recordingText}>Stop recording</Text>
                  </>
                ) : (
                  <>
                    <Mic size={20} color={Colors.primary} />
                    <Text style={styles.voiceButtonText}>Send a voice message</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            
            <View style={styles.emergencyContainer}>
              <TouchableOpacity
                style={[
                  styles.emergencyButton,
                  isEmergency && styles.emergencyActive,
                ]}
                onPress={toggleEmergency}
              >
                <View
                  style={[
                    styles.emergencyCheckbox,
                    isEmergency && styles.emergencyCheckboxActive,
                  ]}
                >
                  {isEmergency && <View style={styles.emergencyCheckboxInner} />}
                </View>
                <Text
                  style={[
                    styles.emergencyText,
                    isEmergency && styles.emergencyTextActive,
                  ]}
                >
                  This is an emergency
                </Text>
              </TouchableOpacity>
              
              <Text style={styles.emergencyDescription}>
                Emergency requests are prioritized and sent to all nearby users.
              </Text>
            </View>
          </>
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
          title="Send Request"
          onPress={handleSubmit}
          disabled={!helpType}
          loading={isLoading}
          variant={selectedSegment === 1 ? 'hero' : 'primary'}
          style={styles.submitButton}
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
    marginBottom: 20,
  },
  segmentContainer: {
    marginBottom: 20,
  },
  restrictedText: {
    fontSize: 14,
    color: Colors.heroPrimary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  helpTypesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 24,
  },
  helpTypeButton: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    width: '30%',
    marginHorizontal: '1.5%',
    marginBottom: 12,
  },
  selectedHelpType: {
    backgroundColor: Colors.primary + '20',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  selectedHeroHelpType: {
    backgroundColor: Colors.heroPrimary + '20',
    borderColor: Colors.heroPrimary,
  },
  helpTypeEmoji: {
    fontSize: 24,
    marginBottom: 8,
  },
  helpTypeLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
    textAlign: 'center',
  },
  selectedHelpTypeLabel: {
    fontWeight: '600',
  },
  locationContainer: {
    marginBottom: 24,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationButtonText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 4,
  },
  locationInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  locationText: {
    fontSize: 16,
    color: Colors.text,
  },
  descriptionContainer: {
    marginBottom: 24,
  },
  descriptionInput: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
    height: 120,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  recordingButton: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  voiceButtonText: {
    fontSize: 14,
    color: Colors.primary,
    marginLeft: 8,
  },
  recordingText: {
    fontSize: 14,
    color: Colors.white,
    marginLeft: 8,
  },
  emergencyContainer: {
    marginBottom: 24,
  },
  emergencyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  emergencyActive: {
    opacity: 1,
  },
  emergencyCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.gray[400],
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyCheckboxActive: {
    borderColor: Colors.danger,
    backgroundColor: Colors.danger,
  },
  emergencyCheckboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: Colors.white,
  },
  emergencyText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  emergencyTextActive: {
    color: Colors.danger,
  },
  emergencyDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    marginLeft: 36,
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
  submitButton: {
    flex: 2,
    marginLeft: 8,
  },
});