import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { Shield, CheckCircle, Award } from 'lucide-react-native';

export default function VerificationIntroScreen() {
  const router = useRouter();

  const handleStartVerification = () => {
    router.push('/verification/basic');
  };

  const handleSkip = () => {
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image 
            source={{ uri: 'https://images.unsplash.com/photo-1534120247760-c44c3e4a62f1?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80' }}
            style={styles.headerImage}
          />
          <View style={styles.overlay} />
          <Text style={styles.title}>Verification Process</Text>
          <Text style={styles.subtitle}>Building a safe and trusted community</Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            To ensure the safety and trust of our community, we have a multi-level verification process. Each level gives you more access and capabilities within the app.
          </Text>
        </View>

        <View style={styles.levelsContainer}>
          <View style={styles.levelCard}>
            <View style={[styles.levelIcon, styles.basicIcon]}>
              <Shield size={24} color={Colors.white} />
            </View>
            <View style={styles.levelContent}>
              <Text style={styles.levelTitle}>Basic Verification</Text>
              <Text style={styles.levelDescription}>
                Verify your identity with a government-issued ID. This allows you to use basic features of the app.
              </Text>
              <View style={styles.levelAccess}>
                <Text style={styles.accessTitle}>Access to:</Text>
                <Text style={styles.accessItem}>• Request help</Text>
                <Text style={styles.accessItem}>• View community requests</Text>
                <Text style={styles.accessItem}>• Use safety tools</Text>
              </View>
            </View>
          </View>

          <View style={styles.levelCard}>
            <View style={[styles.levelIcon, styles.trustedIcon]}>
              <CheckCircle size={24} color={Colors.white} />
            </View>
            <View style={styles.levelContent}>
              <Text style={styles.levelTitle}>Trusted Verification</Text>
              <Text style={styles.levelDescription}>
                Complete a background check to become a trusted member of the community.
              </Text>
              <View style={styles.levelAccess}>
                <Text style={styles.accessTitle}>Additional access to:</Text>
                <Text style={styles.accessItem}>• Respond to help requests</Text>
                <Text style={styles.accessItem}>• Access to sensitive information</Text>
                <Text style={styles.accessItem}>• Join trusted circles</Text>
              </View>
            </View>
          </View>

          <View style={styles.levelCard}>
            <View style={[styles.levelIcon, styles.certifiedIcon]}>
              <Award size={24} color={Colors.white} />
            </View>
            <View style={styles.levelContent}>
              <Text style={styles.levelTitle}>Certified Verification</Text>
              <Text style={styles.levelDescription}>
                Provide references and complete training to become a certified helper.
              </Text>
              <View style={styles.levelAccess}>
                <Text style={styles.accessTitle}>Additional access to:</Text>
                <Text style={styles.accessItem}>• Respond to emergency requests</Text>
                <Text style={styles.accessItem}>• Become a mentor</Text>
                <Text style={styles.accessItem}>• Create community events</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteText}>
            You can start using the app with limited features while your verification is in progress. Each verification level is reviewed by our team to ensure community safety.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <HeroButton
          title="START VERIFICATION"
          onPress={handleStartVerification}
          style={styles.verifyButton}
        />
        <HeroButton
          title="SKIP FOR NOW"
          onPress={handleSkip}
          variant="outline"
          style={styles.skipButton}
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
    paddingBottom: 120,
  },
  header: {
    position: 'relative',
    height: 200,
    justifyContent: 'flex-end',
    padding: 20,
  },
  headerImage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  infoContainer: {
    padding: 20,
  },
  infoText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  levelsContainer: {
    paddingHorizontal: 20,
  },
  levelCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
  },
  levelIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  basicIcon: {
    backgroundColor: Colors.primary,
  },
  trustedIcon: {
    backgroundColor: Colors.secondary,
  },
  certifiedIcon: {
    backgroundColor: Colors.heroPrimary,
  },
  levelContent: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  levelDescription: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 12,
    lineHeight: 20,
  },
  levelAccess: {
    backgroundColor: Colors.gray[100],
    padding: 12,
    borderRadius: 8,
  },
  accessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  accessItem: {
    fontSize: 14,
    color: Colors.gray[700],
    marginBottom: 2,
  },
  noteContainer: {
    padding: 20,
  },
  noteText: {
    fontSize: 14,
    color: Colors.gray[600],
    fontStyle: 'italic',
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
  verifyButton: {
    marginBottom: 12,
  },
  skipButton: {},
});