import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleLogin = () => {
    router.push('/login');
  };

  const handleRegister = () => {
    router.push('/register');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
        style={styles.gradient}
      />
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1611841315886-a8ad8d02f179?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80' }}
        style={styles.backgroundImage}
      />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Here-O</Text>
          </View>
          <Text style={styles.tagline}>Will You Answer The Call?</Text>
        </View>
        
        <View style={styles.description}>
          <Text style={styles.descriptionText}>
            Join a community where people help people. Whether you need assistance or want to be a hero for someone else.
          </Text>
        </View>
        
        <View style={styles.buttons}>
          <HeroButton
            title="LOG IN"
            onPress={handleLogin}
            variant="outline"
            style={styles.loginButton}
            textStyle={styles.loginButtonText}
          />
          
          <HeroButton
            title="REGISTER"
            onPress={handleRegister}
            variant="primary"
            style={styles.registerButton}
          />
        </View>
        
        <TouchableOpacity style={styles.skipContainer} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
  },
  tagline: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    marginBottom: 40,
  },
  descriptionText: {
    fontSize: 18,
    color: Colors.white,
    textAlign: 'center',
    lineHeight: 26,
  },
  buttons: {
    marginBottom: 24,
  },
  loginButton: {
    marginBottom: 16,
    borderColor: Colors.white,
  },
  loginButtonText: {
    color: Colors.white,
  },
  registerButton: {
    backgroundColor: Colors.primary,
  },
  skipContainer: {
    alignItems: 'center',
  },
  skipText: {
    color: Colors.white,
    fontSize: 16,
    textDecorationLine: 'underline',
  },
});