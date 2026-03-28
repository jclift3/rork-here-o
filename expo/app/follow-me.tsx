import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { useSafetyStore } from '@/store/safetyStore';
import { MapPin } from 'lucide-react-native';

export default function FollowMeScreen() {
  const router = useRouter();
  const { startFollowMe } = useSafetyStore();
  
  const [selectedDuration, setSelectedDuration] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  const durations = [
    { id: 0, label: '15 minutes', value: 15 },
    { id: 1, label: '30 minutes', value: 30 },
    { id: 2, label: '1 hour', value: 60 },
    { id: 3, label: '2 hours', value: 120 },
    { id: 4, label: 'Until I stop sharing', value: -1 },
  ];
  
  const handleStartSharing = () => {
    setIsLoading(true);
    
    // Start the Follow Me feature
    startFollowMe();
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      router.replace('/(tabs)');
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Share your real-time location</Text>
        
        <Text style={styles.description}>
          Share your real-time location with your Circle of Trust for a set period of time. They'll be able to see your location on a map and receive updates if anything changes.
        </Text>
        
        <View style={styles.mapPlaceholder}>
          <MapPin size={32} color={Colors.primary} />
          <Text style={styles.mapPlaceholderText}>
            Your current location will be shared
          </Text>
        </View>
        
        <View style={styles.durationContainer}>
          <Text style={styles.sectionTitle}>Duration</Text>
          
          <View style={styles.durationOptions}>
            {durations.map((duration) => (
              <TouchableOpacity
                key={duration.id}
                style={[
                  styles.durationOption,
                  selectedDuration === duration.id && styles.selectedDuration,
                ]}
                onPress={() => setSelectedDuration(duration.id)}
              >
                <Text
                  style={[
                    styles.durationText,
                    selectedDuration === duration.id && styles.selectedDurationText,
                  ]}
                >
                  {duration.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>How it works:</Text>
          <Text style={styles.infoText}>
            1. Your Circle of Trust will receive a notification that you're sharing your location.
          </Text>
          <Text style={styles.infoText}>
            2. They can view your real-time location on a map and receive updates if you stop moving or change direction unexpectedly.
          </Text>
          <Text style={styles.infoText}>
            3. You can stop sharing at any time, or it will automatically stop after the selected duration.
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
          title="Start Sharing"
          onPress={handleStartSharing}
          loading={isLoading}
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
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: Colors.gray[600],
    marginBottom: 24,
    lineHeight: 22,
  },
  mapPlaceholder: {
    backgroundColor: Colors.gray[200],
    borderRadius: 16,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 12,
  },
  durationContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 16,
  },
  durationOptions: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
  },
  durationOption: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  selectedDuration: {
    backgroundColor: Colors.primary + '10',
  },
  durationText: {
    fontSize: 16,
    color: Colors.text,
  },
  selectedDurationText: {
    fontWeight: '600',
    color: Colors.primary,
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