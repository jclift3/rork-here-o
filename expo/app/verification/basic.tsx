import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { Camera, Upload, CheckCircle, AlertCircle } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export default function BasicVerificationScreen() {
  const router = useRouter();
  const [frontIdImage, setFrontIdImage] = useState<string | null>(null);
  const [backIdImage, setBackIdImage] = useState<string | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async (setImage: (uri: string | null) => void) => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your photos to upload ID images.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'There was an error selecting the image. Please try again.');
    }
  };

  const takePicture = async (setImage: (uri: string | null) => void) => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Camera functionality is limited on web. Please use the upload option.');
      return;
    }
    
    try {
      // Request permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'We need access to your camera to take ID photos.');
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'There was an error taking the picture. Please try again.');
    }
  };

  const handleSubmit = () => {
    if (!frontIdImage || !backIdImage || !selfieImage) {
      Alert.alert('Missing Images', 'Please upload all required images to continue.');
      return;
    }

    setIsLoading(true);

    // Simulate API call for verification submission
    setTimeout(() => {
      setIsLoading(false);
      router.push('/verification/pending');
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Basic Verification</Text>
          <Text style={styles.subtitle}>
            Please provide the following documents to verify your identity
          </Text>
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoHeader}>
            <AlertCircle size={20} color={Colors.primary} />
            <Text style={styles.infoTitle}>Important Information</Text>
          </View>
          <Text style={styles.infoText}>
            • We need clear photos of your government-issued ID (both sides)
          </Text>
          <Text style={styles.infoText}>
            • Take a selfie holding your ID next to your face
          </Text>
          <Text style={styles.infoText}>
            • All information is encrypted and securely stored
          </Text>
          <Text style={styles.infoText}>
            • Verification typically takes 24-48 hours
          </Text>
        </View>

        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Front of ID</Text>
          {frontIdImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: frontIdImage }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={styles.retakeButton}
                onPress={() => setFrontIdImage(null)}
              >
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <View style={styles.uploadedBadge}>
                <CheckCircle size={16} color={Colors.white} />
                <Text style={styles.uploadedText}>Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <TouchableOpacity 
                style={styles.uploadOption}
                onPress={() => takePicture(setFrontIdImage)}
              >
                <View style={styles.uploadIconContainer}>
                  <Camera size={24} color={Colors.primary} />
                </View>
                <Text style={styles.uploadOptionText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.uploadOption}
                onPress={() => pickImage(setFrontIdImage)}
              >
                <View style={styles.uploadIconContainer}>
                  <Upload size={24} color={Colors.primary} />
                </View>
                <Text style={styles.uploadOptionText}>Upload</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Back of ID</Text>
          {backIdImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: backIdImage }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={styles.retakeButton}
                onPress={() => setBackIdImage(null)}
              >
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <View style={styles.uploadedBadge}>
                <CheckCircle size={16} color={Colors.white} />
                <Text style={styles.uploadedText}>Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <TouchableOpacity 
                style={styles.uploadOption}
                onPress={() => takePicture(setBackIdImage)}
              >
                <View style={styles.uploadIconContainer}>
                  <Camera size={24} color={Colors.primary} />
                </View>
                <Text style={styles.uploadOptionText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.uploadOption}
                onPress={() => pickImage(setBackIdImage)}
              >
                <View style={styles.uploadIconContainer}>
                  <Upload size={24} color={Colors.primary} />
                </View>
                <Text style={styles.uploadOptionText}>Upload</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.uploadSection}>
          <Text style={styles.sectionTitle}>Selfie with ID</Text>
          {selfieImage ? (
            <View style={styles.imagePreviewContainer}>
              <Image source={{ uri: selfieImage }} style={styles.imagePreview} />
              <TouchableOpacity 
                style={styles.retakeButton}
                onPress={() => setSelfieImage(null)}
              >
                <Text style={styles.retakeButtonText}>Retake</Text>
              </TouchableOpacity>
              <View style={styles.uploadedBadge}>
                <CheckCircle size={16} color={Colors.white} />
                <Text style={styles.uploadedText}>Uploaded</Text>
              </View>
            </View>
          ) : (
            <View style={styles.uploadOptions}>
              <TouchableOpacity 
                style={styles.uploadOption}
                onPress={() => takePicture(setSelfieImage)}
              >
                <View style={styles.uploadIconContainer}>
                  <Camera size={24} color={Colors.primary} />
                </View>
                <Text style={styles.uploadOptionText}>Take Photo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.uploadOption}
                onPress={() => pickImage(setSelfieImage)}
              >
                <View style={styles.uploadIconContainer}>
                  <Upload size={24} color={Colors.primary} />
                </View>
                <Text style={styles.uploadOptionText}>Upload</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.privacyContainer}>
          <Text style={styles.privacyTitle}>Privacy & Security</Text>
          <Text style={styles.privacyText}>
            Your ID documents are encrypted and securely stored. They are only used for verification purposes and are not shared with other users. Our team reviews your documents manually to ensure the safety of our community.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <HeroButton
          title="SUBMIT FOR VERIFICATION"
          onPress={handleSubmit}
          loading={isLoading}
          disabled={!frontIdImage || !backIdImage || !selfieImage}
          style={styles.submitButton}
        />
        <HeroButton
          title="SKIP FOR NOW"
          onPress={() => router.replace('/(tabs)')}
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
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
    lineHeight: 22,
  },
  infoContainer: {
    backgroundColor: Colors.primary + '10',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
    marginLeft: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
  uploadSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  uploadOptions: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[300],
    borderStyle: 'dashed',
  },
  uploadOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  uploadIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadOptionText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  imagePreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  retakeButton: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  retakeButtonText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  uploadedBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  uploadedText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  privacyContainer: {
    marginBottom: 24,
  },
  privacyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  privacyText: {
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
  submitButton: {
    marginBottom: 12,
  },
  skipButton: {},
});