import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { useHelpRequestsStore } from '@/store/helpRequestsStore';
import { mockHelpRequests } from '@/mocks/helpRequests';
import { MapPin, Clock, MessageCircle, Phone, Share2 } from 'lucide-react-native';

export default function RequestDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { requests, updateRequest } = useHelpRequestsStore();
  
  const [request, setRequest] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    // Find the request in the store
    const foundRequest = requests.find(r => r.id === id);
    
    // If not found in the store, look in the mock data
    if (!foundRequest) {
      const mockRequest = mockHelpRequests.find(r => r.id === id);
      setRequest(mockRequest || null);
    } else {
      setRequest(foundRequest);
    }
  }, [id, requests]);
  
  if (!request) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading request details...</Text>
        </View>
      </SafeAreaView>
    );
  }
  
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)} hours ago`;
    } else {
      return `${Math.floor(diffMins / 1440)} days ago`;
    }
  };
  
  const getRequestTypeLabel = (type: string) => {
    switch (type) {
      case 'groceries':
        return 'Need help with groceries';
      case 'ride':
        return 'Looking for a ride';
      case 'emergency':
        return 'Emergency assistance needed';
      case 'unsafe':
        return 'Feeling unsafe';
      case 'medical':
        return 'Medical assistance needed';
      case 'assistance':
        return 'Need assistance';
      default:
        return type;
    }
  };
  
  const handleHelp = () => {
    setIsLoading(true);
    
    // Update the request status
    updateRequest(request.id, { status: 'in-progress' });
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      router.back();
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image source={{ uri: request.user.avatar }} style={styles.avatar} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{request.user.name}</Text>
            <Text style={styles.timeAgo}>{getTimeAgo(request.createdAt)}</Text>
          </View>
          {request.visibility === 'her-o' && (
            <View style={styles.heroBadge}>
              <Text style={styles.heroBadgeText}>Her-o</Text>
            </View>
          )}
        </View>
        
        <View style={styles.requestInfo}>
          <Text style={styles.requestType}>{getRequestTypeLabel(request.type)}</Text>
          
          {request.description && (
            <Text style={styles.description}>{request.description}</Text>
          )}
          
          {request.location?.address && (
            <View style={styles.locationContainer}>
              <MapPin size={20} color={Colors.gray[600]} style={styles.icon} />
              <Text style={styles.locationText}>{request.location.address}</Text>
            </View>
          )}
          
          <View style={styles.timeContainer}>
            <Clock size={20} color={Colors.gray[600]} style={styles.icon} />
            <Text style={styles.timeText}>Posted {getTimeAgo(request.createdAt)}</Text>
          </View>
          
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              request.status === 'active' ? styles.statusActive :
              request.status === 'in-progress' ? styles.statusInProgress :
              styles.statusCompleted
            ]}>
              <Text style={styles.statusText}>
                {request.status === 'active' ? 'Active' :
                 request.status === 'in-progress' ? 'In Progress' :
                 'Completed'}
              </Text>
            </View>
            
            {request.isEmergency && (
              <View style={styles.emergencyBadge}>
                <Text style={styles.emergencyText}>Emergency</Text>
              </View>
            )}
          </View>
        </View>
        
        <View style={styles.actionsContainer}>
          <TouchableOpacity style={styles.actionButton}>
            <MessageCircle size={24} color={Colors.primary} />
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Phone size={24} color={Colors.primary} />
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Share2 size={24} color={Colors.primary} />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.mapContainer}>
          <Text style={styles.mapTitle}>Location</Text>
          <View style={styles.mapPlaceholder}>
            <MapPin size={32} color={Colors.primary} />
            <Text style={styles.mapPlaceholderText}>
              Map would display here with the request location
            </Text>
          </View>
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        {request.status === 'active' ? (
          <HeroButton
            title="I Can Help"
            onPress={handleHelp}
            loading={isLoading}
            variant={request.visibility === 'her-o' ? 'hero' : 'primary'}
          />
        ) : (
          <HeroButton
            title="Contact Helper"
            onPress={() => {}}
            variant={request.visibility === 'her-o' ? 'hero' : 'primary'}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  timeAgo: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  heroBadge: {
    backgroundColor: Colors.heroPrimary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  requestInfo: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  requestType: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
    lineHeight: 24,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    marginRight: 8,
  },
  locationText: {
    fontSize: 16,
    color: Colors.gray[600],
    flex: 1,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeText: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  statusActive: {
    backgroundColor: Colors.primary + '20',
  },
  statusInProgress: {
    backgroundColor: Colors.warning + '20',
  },
  statusCompleted: {
    backgroundColor: Colors.success + '20',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  emergencyBadge: {
    backgroundColor: Colors.danger + '20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  emergencyText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.danger,
  },
  actionsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 8,
    fontWeight: '500',
  },
  mapContainer: {
    marginBottom: 24,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  mapPlaceholder: {
    backgroundColor: Colors.gray[200],
    borderRadius: 16,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    fontSize: 16,
    color: Colors.gray[600],
    marginTop: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
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
  },
});