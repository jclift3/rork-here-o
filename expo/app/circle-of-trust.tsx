import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Image, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { useUserStore } from '@/store/userStore';
import { mockTrustedContacts } from '@/mocks/users';
import { Search, Plus, X } from 'lucide-react-native';

export default function CircleOfTrustScreen() {
  const router = useRouter();
  const { trustedContacts, addTrustedContact, removeTrustedContact } = useUserStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [contacts, setContacts] = useState(trustedContacts.length > 0 ? trustedContacts : mockTrustedContacts);
  
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const handleRemoveContact = (contactId: string) => {
    removeTrustedContact(contactId);
    setContacts(contacts.filter(c => c.id !== contactId));
  };
  
  const handleSafetyCheckIn = () => {
    router.push('/safety-check-in');
  };
  
  const handleFollowMe = () => {
    router.push('/follow-me');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>
          Your Circle of Trust is a group of people you trust to help you in an emergency. They will receive an alert if you need help.
        </Text>
        
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.gray[500]} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.contactsContainer}>
          {filteredContacts.map((contact) => (
            <View key={contact.id} style={styles.contactItem}>
              <Image source={{ uri: contact.avatar }} style={styles.contactAvatar} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactRelationship}>
                  {contact.relationship.charAt(0).toUpperCase() + contact.relationship.slice(1)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveContact(contact.id)}
              >
                <X size={20} color={Colors.gray[500]} />
              </TouchableOpacity>
            </View>
          ))}
          
          <TouchableOpacity style={styles.addContactButton}>
            <View style={styles.addContactIcon}>
              <Plus size={24} color={Colors.primary} />
            </View>
            <Text style={styles.addContactText}>Add Contact</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.safetyToolsContainer}>
          <Text style={styles.sectionTitle}>Safety Tools</Text>
          
          <TouchableOpacity
            style={styles.safetyToolItem}
            onPress={handleSafetyCheckIn}
          >
            <View style={[styles.safetyToolIcon, { backgroundColor: Colors.primary + '20' }]}>
              <Text style={styles.safetyToolIconText}>⏱️</Text>
            </View>
            <View style={styles.safetyToolContent}>
              <Text style={styles.safetyToolTitle}>Safety Check-In</Text>
              <Text style={styles.safetyToolDescription}>
                Set a timer for activities (e.g., walking home, meeting someone new), with automatic alerts sent to your trusted circle if you don't check in by the specified time.
              </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.safetyToolItem}
            onPress={handleFollowMe}
          >
            <View style={[styles.safetyToolIcon, { backgroundColor: Colors.secondary + '20' }]}>
              <Text style={styles.safetyToolIconText}>🔍</Text>
            </View>
            <View style={styles.safetyToolContent}>
              <Text style={styles.safetyToolTitle}>Follow Me</Text>
              <Text style={styles.safetyToolDescription}>
                During a potentially unsafe situation, activate this feature to allow your trusted circle to track your location in real-time until you reach your destination or feel safe.
              </Text>
            </View>
          </TouchableOpacity>
          
          {/* For female users only */}
          {useUserStore.getState().user?.gender === 'female' && (
            <TouchableOpacity
              style={styles.safetyToolItem}
              onPress={() => router.push('/emergency-exit')}
            >
              <View style={[styles.safetyToolIcon, { backgroundColor: Colors.heroPrimary + '20' }]}>
                <Text style={styles.safetyToolIconText}>🚪</Text>
              </View>
              <View style={styles.safetyToolContent}>
                <Text style={styles.safetyToolTitle}>Emergency Exit</Text>
                <Text style={styles.safetyToolDescription}>
                  Schedule a fake incoming call with a pre-set excuse or activate an alert using a code word during a real call, with options for automated check-ins.
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.footer}>
        <HeroButton
          title="Save"
          onPress={() => router.back()}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  contactsContainer: {
    marginBottom: 32,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  contactAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  contactRelationship: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  removeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addContactIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  addContactText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  safetyToolsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  safetyToolItem: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  safetyToolIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  safetyToolIconText: {
    fontSize: 24,
  },
  safetyToolContent: {
    flex: 1,
  },
  safetyToolTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  safetyToolDescription: {
    fontSize: 14,
    color: Colors.gray[600],
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
  },
  saveButton: {
    width: '100%',
  },
});