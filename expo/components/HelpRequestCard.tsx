import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { HelpRequestType } from '@/types';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';

interface HelpRequestCardProps {
  request: HelpRequestType;
}

const HelpRequestCard: React.FC<HelpRequestCardProps> = ({ request }) => {
  const router = useRouter();
  
  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now.getTime() - past.getTime();
    const diffMins = Math.round(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} min ago`;
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

  const handlePress = () => {
    router.push(`/request-details/${request.id}`);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
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
      
      <View style={styles.content}>
        <Text style={styles.requestType}>{getRequestTypeLabel(request.type)}</Text>
        {request.description && (
          <Text style={styles.description} numberOfLines={2}>
            {request.description}
          </Text>
        )}
        {request.location?.address && (
          <Text style={styles.location} numberOfLines={1}>
            📍 {request.location.address}
          </Text>
        )}
      </View>
      
      <View style={styles.footer}>
        <View style={[styles.statusBadge, 
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
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  timeAgo: {
    fontSize: 12,
    color: Colors.gray[600],
    marginTop: 2,
  },
  heroBadge: {
    backgroundColor: Colors.heroPrimary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    marginBottom: 12,
  },
  requestType: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
  },
  location: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
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
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  emergencyBadge: {
    backgroundColor: Colors.danger + '20',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  emergencyText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.danger,
  },
});

export default HelpRequestCard;