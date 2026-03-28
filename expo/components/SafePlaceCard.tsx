import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { SafePlaceType } from '@/types';
import Colors from '@/constants/colors';
import { useRouter } from 'expo-router';

interface SafePlaceCardProps {
  place: SafePlaceType;
}

const SafePlaceCard: React.FC<SafePlaceCardProps> = ({ place }) => {
  const router = useRouter();
  
  const handlePress = () => {
    router.push(`/safe-place/${place.id}`);
  };
  
  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.8}>
      <Image source={{ uri: place.image }} style={styles.image} />
      <View style={styles.content}>
        <Text style={styles.name}>{place.name}</Text>
        <View style={styles.ratingContainer}>
          <Text style={styles.rating}>★ {place.rating.toFixed(1)}</Text>
          <Text style={styles.reviews}> • {place.reviews} reviews</Text>
        </View>
        <Text style={styles.address} numberOfLines={1}>
          📍 {place.address}
        </Text>
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
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  image: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  reviews: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  address: {
    fontSize: 14,
    color: Colors.gray[600],
  },
});

export default SafePlaceCard;