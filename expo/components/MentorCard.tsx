import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { MentorType } from '@/types';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';

interface MentorCardProps {
  mentor: MentorType;
}

const MentorCard: React.FC<MentorCardProps> = ({ mentor }) => {
  const router = useRouter();
  
  const handlePress = () => {
    router.push(`/mentor/${mentor.id}`);
  };
  
  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      <Image source={{ uri: mentor.avatar }} style={styles.avatar} />
      <Text style={styles.name}>{mentor.name}</Text>
      <Text style={styles.expertise}>{mentor.expertise}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    width: 120,
    marginRight: 12,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginBottom: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  expertise: {
    fontSize: 12,
    color: Colors.gray[600],
    textAlign: 'center',
  },
});

export default MentorCard;