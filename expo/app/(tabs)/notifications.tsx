import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { mockUsers } from '@/mocks/users';
import { Bell, CheckCircle, AlertCircle, MapPin, Heart, MessageCircle } from 'lucide-react-native';

export default function NotificationsScreen() {
  const [selectedTab, setSelectedTab] = useState(0);
  
  const tabs = ['All', 'Alerts', 'Updates'];
  
  // Mock notifications data
  const notifications = [
    {
      id: '1',
      type: 'alert',
      title: 'Emergency Alert',
      message: 'Olivia Hayes has triggered an emergency alert near your location.',
      time: '5 min ago',
      user: mockUsers[2],
      isRead: false,
    },
    {
      id: '2',
      type: 'safety',
      title: 'Safety Check-In',
      message: 'Your safety check-in timer has been completed successfully.',
      time: '30 min ago',
      isRead: true,
    },
    {
      id: '3',
      type: 'request',
      title: 'Help Request Accepted',
      message: 'Ethan Bennett has accepted your request for a ride.',
      time: '1 hour ago',
      user: mockUsers[1],
      isRead: true,
    },
    {
      id: '4',
      type: 'community',
      title: 'New Safe Place Added',
      message: 'A new safe place "Community Center" has been added near you.',
      time: '3 hours ago',
      isRead: false,
    },
    {
      id: '5',
      type: 'alert',
      title: 'Neighborhood Alert',
      message: 'There have been reports of suspicious activity in your area.',
      time: '5 hours ago',
      isRead: true,
    },
    {
      id: '6',
      type: 'update',
      title: 'Request Completed',
      message: 'Your help request for groceries has been marked as completed.',
      time: 'Yesterday',
      isRead: true,
    },
    {
      id: '7',
      type: 'community',
      title: 'New Group Event',
      message: 'A new community event "Safety Workshop" has been scheduled.',
      time: 'Yesterday',
      isRead: true,
    },
  ];
  
  const filteredNotifications = notifications.filter(notification => {
    if (selectedTab === 0) return true;
    if (selectedTab === 1) return notification.type === 'alert' || notification.type === 'safety';
    if (selectedTab === 2) return notification.type === 'request' || notification.type === 'update' || notification.type === 'community';
    return true;
  });
  
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'alert':
        return <AlertCircle size={24} color={Colors.danger} />;
      case 'safety':
        return <CheckCircle size={24} color={Colors.success} />;
      case 'request':
        return <MessageCircle size={24} color={Colors.primary} />;
      case 'community':
        return <MapPin size={24} color={Colors.secondary} />;
      case 'update':
        return <Heart size={24} color={Colors.heroPrimary} />;
      default:
        return <Bell size={24} color={Colors.primary} />;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity>
          <Text style={styles.markAllRead}>Mark all as read</Text>
        </TouchableOpacity>
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
      
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredNotifications.map((notification) => (
          <TouchableOpacity
            key={notification.id}
            style={[
              styles.notificationItem,
              !notification.isRead && styles.unreadNotification,
            ]}
          >
            <View style={styles.notificationIcon}>
              {notification.user ? (
                <Image source={{ uri: notification.user.avatar }} style={styles.userAvatar} />
              ) : (
                getNotificationIcon(notification.type)
              )}
            </View>
            
            <View style={styles.notificationContent}>
              <Text style={styles.notificationTitle}>{notification.title}</Text>
              <Text style={styles.notificationMessage}>{notification.message}</Text>
              <Text style={styles.notificationTime}>{notification.time}</Text>
            </View>
            
            {!notification.isRead && <View style={styles.unreadDot} />}
          </TouchableOpacity>
        ))}
        
        {filteredNotifications.length === 0 && (
          <View style={styles.emptyContainer}>
            <Bell size={48} color={Colors.gray[400]} />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptyText}>
              You don't have any notifications at the moment.
            </Text>
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
  markAllRead: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    position: 'relative',
  },
  unreadNotification: {
    backgroundColor: Colors.primary + '10',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gray[200],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.gray[500],
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    position: 'absolute',
    top: 16,
    right: 16,
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
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
  },
});