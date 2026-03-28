import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { Clock, CheckCircle, AlertCircle } from 'lucide-react-native';

export default function VerificationPendingScreen() {
  const router = useRouter();

  const handleContinue = () => {
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
          <View style={styles.iconContainer}>
            <Clock size={64} color={Colors.primary} />
          </View>
          <Text style={styles.title}>Verification In Progress</Text>
          <Text style={styles.subtitle}>
            Your documents have been submitted for review
          </Text>
        </View>

        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <View style={[styles.statusIcon, styles.completedIcon]}>
              <CheckCircle size={20} color={Colors.white} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>Documents Submitted</Text>
              <Text style={styles.statusDescription}>
                Your ID and selfie have been uploaded successfully
              </Text>
            </View>
          </View>

          <View style={styles.statusItem}>
            <View style={[styles.statusIcon, styles.pendingIcon]}>
              <Clock size={20} color={Colors.white} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>Under Review</Text>
              <Text style={styles.statusDescription}>
                Our team is reviewing your documents
              </Text>
            </View>
          </View>

          <View style={styles.statusItem}>
            <View style={[styles.statusIcon, styles.upcomingIcon]}>
              <AlertCircle size={20} color={Colors.white} />
            </View>
            <View style={styles.statusContent}>
              <Text style={styles.statusTitle}>Verification Decision</Text>
              <Text style={styles.statusDescription}>
                You'll be notified when the review is complete
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.timelineContainer}>
          <Text style={styles.timelineTitle}>What to expect</Text>
          <View style={styles.timeline}>
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Initial Review</Text>
                <Text style={styles.timelineItemTime}>24-48 hours</Text>
                <Text style={styles.timelineItemDescription}>
                  Our team will review your submitted documents
                </Text>
              </View>
            </View>
            <View style={styles.timelineConnector} />
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Basic Verification</Text>
                <Text style={styles.timelineItemTime}>1-2 days</Text>
                <Text style={styles.timelineItemDescription}>
                  If approved, you'll receive basic verification status
                </Text>
              </View>
            </View>
            <View style={styles.timelineConnector} />
            <View style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={styles.timelineContent}>
                <Text style={styles.timelineItemTitle}>Next Steps</Text>
                <Text style={styles.timelineItemTime}>After approval</Text>
                <Text style={styles.timelineItemDescription}>
                  You'll be invited to complete trusted verification if desired
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.noteContainer}>
          <Text style={styles.noteTitle}>While you wait</Text>
          <Text style={styles.noteText}>
            You can still use the app with limited features while your verification is in progress. You can:
          </Text>
          <Text style={styles.noteItem}>• Explore the app</Text>
          <Text style={styles.noteItem}>• Set up your profile</Text>
          <Text style={styles.noteItem}>• View community requests</Text>
          <Text style={styles.noteItem}>• Set up safety tools</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <HeroButton
          title="CONTINUE TO APP"
          onPress={handleContinue}
          style={styles.continueButton}
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
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
    lineHeight: 22,
  },
  statusContainer: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statusItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  completedIcon: {
    backgroundColor: Colors.success,
  },
  pendingIcon: {
    backgroundColor: Colors.warning,
  },
  upcomingIcon: {
    backgroundColor: Colors.gray[400],
  },
  statusContent: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  timelineContainer: {
    marginBottom: 24,
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 16,
  },
  timeline: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
  },
  timelineItem: {
    flexDirection: 'row',
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    marginRight: 16,
    marginTop: 4,
  },
  timelineConnector: {
    width: 2,
    height: 24,
    backgroundColor: Colors.primary,
    marginLeft: 7,
    marginVertical: 4,
  },
  timelineContent: {
    flex: 1,
    marginBottom: 16,
  },
  timelineItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  timelineItemTime: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  timelineItemDescription: {
    fontSize: 14,
    color: Colors.gray[600],
  },
  noteContainer: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    padding: 16,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginBottom: 8,
  },
  noteText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  noteItem: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
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
  continueButton: {},
});