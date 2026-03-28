import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';
import HelpRequestCard from '@/components/HelpRequestCard';
import EmergencyButton from '@/components/EmergencyButton';
import { mockHelpRequests } from '@/mocks/helpRequests';
import { useUserStore } from '@/store/userStore';

export default function HomeScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState(mockHelpRequests);
  
  const segments = ['Here-o', 'Her-o'];
  
  const filteredRequests = requests.filter(request => {
    if (selectedSegment === 0) {
      return request.visibility === 'here-o';
    } else {
      return request.visibility === 'her-o' && user?.gender === 'female';
    }
  });

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate a network request
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const handleCreateRequest = () => {
    router.push('/quick-help');
  };

  const handleManageSafety = () => {
    router.push('/circle-of-trust');
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Hello, {user?.name || 'Hero'}</Text>
        <Text style={styles.subtitle}>How can you help today?</Text>
      </View>
      
      <View style={styles.segmentContainer}>
        <SegmentedControl
          segments={segments}
          selectedIndex={selectedSegment}
          onChange={setSelectedSegment}
          variant={selectedSegment === 1 ? 'hero' : 'primary'}
        />
      </View>
      
      <View style={styles.actionsContainer}>
        <TouchableOpacity style={styles.actionButton} onPress={handleCreateRequest}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '20' }]}>
            <Text style={[styles.actionIconText, { color: Colors.primary }]}>🆘</Text>
          </View>
          <Text style={styles.actionText}>Request Help</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={handleManageSafety}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.secondary + '20' }]}>
            <Text style={[styles.actionIconText, { color: Colors.secondary }]}>🛡️</Text>
          </View>
          <Text style={styles.actionText}>Safety Tools</Text>
        </TouchableOpacity>
        
        <View style={styles.actionButton}>
          <EmergencyButton size="small" />
        </View>
      </View>
      
      <View style={styles.contentContainer}>
        <Text style={styles.sectionTitle}>
          {selectedSegment === 0 ? 'Community Requests' : 'Women-Only Requests'}
        </Text>
        
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredRequests.length > 0 ? (
            filteredRequests.map((request) => (
              <HelpRequestCard key={request.id} request={request} />
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {selectedSegment === 0
                  ? "No community requests at the moment."
                  : user?.gender === 'female'
                    ? "No women-only requests at the moment."
                    : "This section is only available for female users."}
              </Text>
            </View>
          )}
        </ScrollView>
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
  greeting: {
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
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
  },
  actionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIconText: {
    fontSize: 24,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: Colors.white,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 150,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
  },
});