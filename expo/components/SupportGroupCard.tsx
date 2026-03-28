import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { SupportGroupType } from '@/types';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';

interface SupportGroupCardProps {
  group: SupportGroupType;
}

const SupportGroupCard: React.FC<SupportGroupCardProps> = ({ group }) => {
  const router = useRouter();
  
  const handlePress = () => {
    router.push(`/support-group/${group.id}`);
  };
  
  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: group.image }} style={styles.image} />
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{group.name}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {group.description}
        </Text>
        <View style={styles.footer}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {group.category.charAt(0).toUpperCase() + group.category.slice(1)}
            </Text>
          </View>
          <Text style={styles.members}>{group.members} members</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    flexDirection: 'row',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  imageContainer: {
    width: 100,
  },
  image: {
    width: 100,
    height: '100%',
    resizeMode: 'cover',
  },
  content: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 8,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  members: {
    fontSize: 12,
    color: Colors.gray[600],
  },
});

export default SupportGroupCard;