import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';
import HelpRequestCard from '@/components/HelpRequestCard';
import HeroButton from '@/components/HeroButton';
import { mockHelpRequests } from '@/mocks/helpRequests';
import { useUserStore } from '@/store/userStore';
import { Plus } from 'lucide-react-native';

export default function RequestsScreen() {
  const router = useRouter();
  const user = useUserStore((state) => state.user);
  
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [selectedTab, setSelectedTab] = useState(0);
  
  const segments = ['Here-o', 'Her-o'];
  const tabs = ['All Requests', 'My Requests', 'Helping'];
  
  const filteredRequests = mockHelpRequests.filter(request => {
    // Filter by visibility (Here-o or Her-o)
    const visibilityMatch = selectedSegment === 0 
      ? request.visibility === 'here-o'
      : request.visibility === 'her-o' && user?.gender === 'female';
    
    // Filter by tab (All, My Requests, Helping)
    const tabMatch = selectedTab === 0 
      ? true 
      : selectedTab === 1 
        ? request.userId === user?.id
        : request.status === 'in-progress';
    
    return visibilityMatch && tabMatch;
  });

  const handleCreateRequest = () => {
    router.push('/quick-help');
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <View style={styles.header}>
        <Text style={styles.title}>Help Requests</Text>
        <TouchableOpacity style={styles.createButton} onPress={handleCreateRequest}>
          <Plus size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>
      
      <View style={styles.segmentContainer}>
        <SegmentedControl
          segments={segments}
          selectedIndex={selectedSegment}
          onChange={setSelectedSegment}
          variant={selectedSegment === 1 ? 'hero' : 'primary'}
        />
      </View>
      
      <View style={styles.tabsContainer}>
        {tabs.map((tab, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.tab,
              selectedTab === index && styles.selectedTab,
              selectedTab === index && selectedSegment === 1 && styles.selectedHeroTab,
            ]}
            onPress={() => setSelectedTab(index)}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === index && styles.selectedTabText,
              ]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredRequests.length > 0 ? (
          filteredRequests.map((request) => (
            <HelpRequestCard key={request.id} request={request} />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No requests found</Text>
            <Text style={styles.emptyText}>
              {selectedTab === 0
                ? "There are no active requests at the moment."
                : selectedTab === 1
                ? "You haven't created any requests yet."
                : "You're not currently helping with any requests."}
            </Text>
            {selectedTab === 1 && (
              <HeroButton
                title="Create Request"
                onPress={handleCreateRequest}
                style={styles.emptyButton}
              />
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: Colors.gray[200],
  },
  selectedTab: {
    backgroundColor: Colors.primary,
  },
  selectedHeroTab: {
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  emptyContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    width: 200,
  },
});