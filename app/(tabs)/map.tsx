import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';
import { mockHelpRequests } from '@/mocks/helpRequests';
import { mockSafePlaces } from '@/mocks/safePlaces';
import { useUserStore } from '@/store/userStore';
import { MapPin, Navigation, Layers } from 'lucide-react-native';

export default function MapScreen() {
  const user = useUserStore((state) => state.user);
  
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [showSafePlaces, setShowSafePlaces] = useState(true);
  
  const segments = ['Here-o', 'Her-o'];
  
  // This is a placeholder for the map component
  // In a real app, you would use a map library like react-native-maps
  const MapPlaceholder = () => (
    <View style={styles.mapPlaceholder}>
      <Text style={styles.mapPlaceholderText}>
        {Platform.OS === 'web' 
          ? 'Map view is limited on web. Please use the mobile app for full functionality.'
          : 'Map would display here with help requests and safe places.'}
      </Text>
      <View style={styles.mapPins}>
        <View style={styles.mapPinContainer}>
          <View style={[styles.mapPin, { backgroundColor: Colors.primary }]}>
            <MapPin size={16} color={Colors.white} />
          </View>
          <Text style={styles.mapPinText}>Help Request</Text>
        </View>
        
        <View style={styles.mapPinContainer}>
          <View style={[styles.mapPin, { backgroundColor: Colors.success }]}>
            <MapPin size={16} color={Colors.white} />
          </View>
          <Text style={styles.mapPinText}>Safe Place</Text>
        </View>
        
        <View style={styles.mapPinContainer}>
          <View style={[styles.mapPin, { backgroundColor: Colors.heroPrimary }]}>
            <MapPin size={16} color={Colors.white} />
          </View>
          <Text style={styles.mapPinText}>Her-o Request</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Activity</Text>
        <Text style={styles.subtitle}>
          {selectedSegment === 0 
            ? 'View help requests and safe places near you'
            : 'View women-only requests and safe places'}
        </Text>
      </View>
      
      <View style={styles.segmentContainer}>
        <SegmentedControl
          segments={segments}
          selectedIndex={selectedSegment}
          onChange={setSelectedSegment}
          variant={selectedSegment === 1 ? 'hero' : 'primary'}
        />
      </View>
      
      <View style={styles.mapContainer}>
        <MapPlaceholder />
        
        <View style={styles.mapControls}>
          <TouchableOpacity style={styles.mapControlButton}>
            <Navigation size={24} color={Colors.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.mapControlButton}
            onPress={() => setShowSafePlaces(!showSafePlaces)}
          >
            <Layers size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        
        <View style={styles.mapStats}>
          <View style={styles.mapStatItem}>
            <Text style={styles.mapStatNumber}>
              {selectedSegment === 0 
                ? mockHelpRequests.filter(r => r.visibility === 'here-o').length
                : mockHelpRequests.filter(r => r.visibility === 'her-o').length}
            </Text>
            <Text style={styles.mapStatLabel}>Active Requests</Text>
          </View>
          
          <View style={styles.mapStatItem}>
            <Text style={styles.mapStatNumber}>{mockSafePlaces.length}</Text>
            <Text style={styles.mapStatLabel}>Safe Places</Text>
          </View>
          
          <View style={styles.mapStatItem}>
            <Text style={styles.mapStatNumber}>5</Text>
            <Text style={styles.mapStatLabel}>Heroes Nearby</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 4,
  },
  segmentContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
    marginBottom: 20,
  },
  mapPins: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  mapPinContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  mapPin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  mapPinText: {
    fontSize: 14,
    color: Colors.text,
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: Colors.white,
    borderRadius: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mapControlButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapStats: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    flexDirection: 'row',
    padding: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mapStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  mapStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  mapStatLabel: {
    fontSize: 12,
    color: Colors.gray[600],
    marginTop: 4,
  },
});