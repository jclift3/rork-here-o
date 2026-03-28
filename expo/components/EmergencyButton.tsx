import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import Colors from '@/constants/colors';
import * as Haptics from 'expo-haptics';

interface EmergencyButtonProps {
  size?: 'small' | 'medium' | 'large';
}

const EmergencyButton: React.FC<EmergencyButtonProps> = ({ size = 'medium' }) => {
  const router = useRouter();
  const [isPressed, setIsPressed] = useState(false);
  const [longPressActive, setLongPressActive] = useState(false);
  const [progress] = useState(new Animated.Value(0));

  const getSize = () => {
    switch (size) {
      case 'small':
        return 60;
      case 'medium':
        return 80;
      case 'large':
        return 100;
      default:
        return 80;
    }
  };

  const buttonSize = getSize();

  const handlePressIn = () => {
    setIsPressed(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Start animation
    Animated.timing(progress, {
      toValue: 1,
      duration: 2000, // 2 seconds to complete
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished && longPressActive) {
        handleEmergency();
      }
    });
    
    setLongPressActive(true);
  };

  const handlePressOut = () => {
    setIsPressed(false);
    setLongPressActive(false);
    
    // Reset animation
    Animated.timing(progress, {
      toValue: 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleEmergency = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    router.push('/quick-help');
  };

  const progressInterpolate = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          { width: buttonSize, height: buttonSize },
          isPressed && styles.buttonPressed,
        ]}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.8}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressInterpolate,
            },
          ]}
        />
        <Text style={styles.buttonText}>SOS</Text>
      </TouchableOpacity>
      <Text style={styles.helpText}>Hold for emergency</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    backgroundColor: Colors.danger,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  buttonPressed: {
    backgroundColor: '#c62828',
    transform: [{ scale: 0.95 }],
  },
  progressFill: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  buttonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  helpText: {
    marginTop: 8,
    fontSize: 12,
    color: Colors.gray[600],
  },
});

export default EmergencyButton;