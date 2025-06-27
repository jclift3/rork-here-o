import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';
import HeroButton from '@/components/HeroButton';
import { useUserStore } from '@/store/userStore';
import { Settings, LogOut, Award, Calendar, MessageCircle, Heart, Shield, CheckCircle, Clock } from 'lucide-react-native';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useUserStore();
  
  const [selectedSegment, setSelectedSegment] = useState(0);
  const [selectedTab, setSelectedTab] = useState(0);
  
  const segments = ['Here-o', 'Her-o'];
  const tabs = ['Activity', 'Contributions'];
  
  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  
  const handleSettings = () => {
    // Navigate to settings
  };
  
  const handleCircleOfTrust = () => {
    router.push('/circle-of-trust');
  };

  const handleVerification = () => {
    if (user?.verificationLevel === 'pending') {
      router.push('/verification/pending');
    } else {
      router.push('/verification/intro');
    }
  };

  const getVerificationBadge = () => {
    if (!user?.isVerified) {
      return (
        <TouchableOpacity 
          style={[styles.verificationBadge, styles.pendingBadge]}
          onPress={handleVerification}
        >
          <Clock size={16} color={Colors.white} />
          <Text style={styles.verificationText}>Verification Pending</Text>
        </TouchableOpacity>
      );
    }

    switch (user?.verificationLevel) {
      case 'basic':
        return (
          <TouchableOpacity 
            style={[styles.verificationBadge, styles.basicBadge]}
            onPress={handleVerification}
          >
            <Shield size={16} color={Colors.white} />
            <Text style={styles.verificationText}>Basic Verified</Text>
          </TouchableOpacity>
        );
      case 'trusted':
        return (
          <TouchableOpacity 
            style={[styles.verificationBadge, styles.trustedBadge]}
            onPress={handleVerification}
          >
            <CheckCircle size={16} color={Colors.white} />
            <Text style={styles.verificationText}>Trusted Member</Text>
          </TouchableOpacity>
        );
      case 'certified':
        return (
          <TouchableOpacity 
            style={[styles.verificationBadge, styles.certifiedBadge]}
            onPress={handleVerification}
          >
            <Award size={16} color={Colors.white} />
            <Text style={styles.verificationText}>Certified Helper</Text>
          </TouchableOpacity>
        );
      default:
        return (
          <TouchableOpacity 
            style={[styles.verificationBadge, styles.pendingBadge]}
            onPress={handleVerification}
          >
            <Shield size={16} color={Colors.white} />
            <Text style={styles.verificationText}>Get Verified</Text>
          </TouchableOpacity>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity style={styles.headerButton} onPress={handleSettings}>
            <Settings size={24} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleLogout}>
            <LogOut size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileHeader}>
          <Image
            source={{ uri: user?.avatar || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=crop&w=256&q=80' }}
            style={styles.profileImage}
          />
          <Text style={styles.profileName}>{user?.name || 'User'}</Text>
          <Text style={styles.profileLocation}>San Francisco, CA</Text>
          <Text style={styles.profileJoined}>Joined {user?.joinedDate || '2023'}</Text>
          
          {getVerificationBadge()}
          
          <View style={styles.segmentContainer}>
            <SegmentedControl
              segments={segments}
              selectedIndex={selectedSegment}
              onChange={setSelectedSegment}
              variant={selectedSegment === 1 ? 'hero' : 'primary'}
            />
          </View>
        </View>
        
        {selectedSegment === 0 ? (
          // Here-o profile content
          <>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{user?.stats?.assists || 0}</Text>
                <Text style={styles.statLabel}>Assists</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{user?.stats?.reports || 0}</Text>
                <Text style={styles.statLabel}>Reports</Text>
              </View>
              
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{user?.stats?.communityEvents || 0}</Text>
                <Text style={styles.statLabel}>Community Events</Text>
              </View>
            </View>
            
            <View style={styles.tabsContainer}>
              {tabs.map((tab, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.tab,
                    selectedTab === index && styles.selectedTab,
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
            
            {selectedTab === 0 ? (
              // Activity tab
              <View style={styles.activityContainer}>
                <View style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Award size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>Good Samaritan Badge Earned</Text>
                    <Text style={styles.activityDescription}>
                      You've helped 10 people in your community!
                    </Text>
                    <Text style={styles.activityTime}>2 days ago</Text>
                  </View>
                </View>
                
                <View style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <MessageCircle size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>Help Request Completed</Text>
                    <Text style={styles.activityDescription}>
                      You helped Olivia Hayes with groceries.
                    </Text>
                    <Text style={styles.activityTime}>1 week ago</Text>
                  </View>
                </View>
                
                <View style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Calendar size={24} color={Colors.primary} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>Community Event Attended</Text>
                    <Text style={styles.activityDescription}>
                      You attended the Neighborhood Safety Workshop.
                    </Text>
                    <Text style={styles.activityTime}>2 weeks ago</Text>
                  </View>
                </View>
              </View>
            ) : (
              // Contributions tab
              <View style={styles.contributionsContainer}>
                <View style={styles.contributionItem}>
                  <Text style={styles.contributionTitle}>Posts</Text>
                  <Text style={styles.contributionNumber}>{user?.stats?.posts || 0}</Text>
                </View>
                
                <View style={styles.contributionItem}>
                  <Text style={styles.contributionTitle}>Comments</Text>
                  <Text style={styles.contributionNumber}>{user?.stats?.comments || 0}</Text>
                </View>
                
                <View style={styles.contributionItem}>
                  <Text style={styles.contributionTitle}>Reactions</Text>
                  <Text style={styles.contributionNumber}>{user?.stats?.reactions || 0}</Text>
                </View>
              </View>
            )}
            
            <View style={styles.safetyContainer}>
              <Text style={styles.sectionTitle}>Safety Tools</Text>
              <HeroButton
                title="Manage Circle of Trust"
                onPress={handleCircleOfTrust}
                variant="outline"
                style={styles.safetyButton}
              />
            </View>
          </>
        ) : (
          // Her-o profile content (only for female users)
          user?.gender === 'female' ? (
            <>
              <View style={styles.heroBanner}>
                <Text style={styles.heroBannerTitle}>Her-o Community</Text>
                <Text style={styles.heroBannerText}>
                  A safe space for women to connect, support, and empower each other.
                </Text>
              </View>
              
              <View style={styles.heroStatsContainer}>
                <View style={styles.heroStatItem}>
                  <Heart size={24} color={Colors.heroPrimary} />
                  <Text style={styles.heroStatNumber}>15</Text>
                  <Text style={styles.heroStatLabel}>Women Helped</Text>
                </View>
                
                <View style={styles.heroStatItem}>
                  <Award size={24} color={Colors.heroPrimary} />
                  <Text style={styles.heroStatNumber}>3</Text>
                  <Text style={styles.heroStatLabel}>Support Groups</Text>
                </View>
                
                <View style={styles.heroStatItem}>
                  <MessageCircle size={24} color={Colors.heroPrimary} />
                  <Text style={styles.heroStatNumber}>28</Text>
                  <Text style={styles.heroStatLabel}>Conversations</Text>
                </View>
              </View>
              
              <View style={styles.heroFeaturesContainer}>
                <TouchableOpacity 
                  style={styles.heroFeatureItem}
                  onPress={() => router.push('/emergency-exit')}
                >
                  <Text style={styles.heroFeatureTitle}>Emergency Exit</Text>
                  <Text style={styles.heroFeatureDescription}>
                    Set up fake calls or code words for uncomfortable situations
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.heroFeatureItem}
                  onPress={() => router.push('/safe-place/list')}
                >
                  <Text style={styles.heroFeatureTitle}>Safe Places</Text>
                  <Text style={styles.heroFeatureDescription}>
                    Find and review women-friendly locations near you
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={styles.heroFeatureItem}
                  onPress={() => router.push('/support-group/list')}
                >
                  <Text style={styles.heroFeatureTitle}>Support Groups</Text>
                  <Text style={styles.heroFeatureDescription}>
                    Join women-only groups for various topics and interests
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.heroRestrictedContainer}>
              <Text style={styles.heroRestrictedTitle}>Women-Only Section</Text>
              <Text style={styles.heroRestrictedText}>
                This section is only available for female users to provide a safe and supportive space.
              </Text>
            </View>
          )
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
  headerButtons: {
    flexDirection: 'row',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  profileLocation: {
    fontSize: 16,
    color: Colors.gray[600],
    marginBottom: 4,
  },
  profileJoined: {
    fontSize: 14,
    color: Colors.gray[500],
    marginBottom: 12,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 20,
  },
  pendingBadge: {
    backgroundColor: Colors.gray[500],
  },
  basicBadge: {
    backgroundColor: Colors.primary,
  },
  trustedBadge: {
    backgroundColor: Colors.secondary,
  },
  certifiedBadge: {
    backgroundColor: Colors.success,
  },
  verificationText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  segmentContainer: {
    width: '100%',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.gray[600],
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
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.gray[700],
  },
  selectedTabText: {
    color: Colors.white,
  },
  activityContainer: {
    paddingHorizontal: 20,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 8,
  },
  activityTime: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  contributionsContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  contributionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray[200],
  },
  contributionTitle: {
    fontSize: 16,
    color: Colors.text,
  },
  contributionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  safetyContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  safetyButton: {
    marginBottom: 12,
  },
  heroBanner: {
    backgroundColor: Colors.heroPrimary,
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  heroBannerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 8,
  },
  heroBannerText: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
  },
  heroStatsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  heroStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  heroStatNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.heroPrimary,
    marginVertical: 4,
  },
  heroStatLabel: {
    fontSize: 12,
    color: Colors.gray[600],
  },
  heroFeaturesContainer: {
    paddingHorizontal: 20,
  },
  heroFeatureItem: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  heroFeatureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.heroPrimary,
    marginBottom: 4,
  },
  heroFeatureDescription: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  heroRestrictedContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRestrictedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.heroPrimary,
    marginBottom: 12,
  },
  heroRestrictedText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
  },
});