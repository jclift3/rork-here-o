import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Colors from '@/constants/colors';
import HeroButton from '@/components/HeroButton';
import { useUserStore } from '@/store/userStore';
import { mockUsers } from '@/mocks/users';

export default function RegisterScreen() {
  const router = useRouter();
  const login = useUserStore((state) => state.login);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | 'prefer-not-to-say'>('prefer-not-to-say');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleNextStep = () => {
    if (!name || !email || !password) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (!acceptedTerms) {
      setError('You must accept the terms and conditions to continue');
      return;
    }

    setError('');
    setStep(2);
  };

  const handleRegister = () => {
    setIsLoading(true);
    setError('');

    // Simulate API call
    setTimeout(() => {
      // For demo purposes, create a new user with pending verification
      const newUser = {
        ...mockUsers[0],
        id: Date.now().toString(),
        name,
        gender,
        isVerified: false,
        verificationLevel: 'pending' as 'pending', // Explicitly type as 'pending'
      };
      login(newUser);
      setIsLoading(false);
      router.replace('/verification/intro');
    }, 1000);
  };

  const handleLogin = () => {
    router.push('/login');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
    >
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Here-O</Text>
          </View>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join our community of heroes</Text>
        </View>

        {step === 1 ? (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Create a password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.termsContainer}>
              <TouchableOpacity 
                style={styles.checkbox} 
                onPress={() => setAcceptedTerms(!acceptedTerms)}
              >
                {acceptedTerms && <View style={styles.checkboxInner} />}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                I accept the <Text style={styles.termsLink}>Terms of Service</Text> and <Text style={styles.termsLink}>Privacy Policy</Text>
              </Text>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <HeroButton
              title="CONTINUE"
              onPress={handleNextStep}
              style={styles.registerButton}
            />

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={handleLogin}>
                <Text style={styles.loginLink}>Log In</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Gender (Optional)</Text>
              <View style={styles.genderOptions}>
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'male' && styles.selectedGender,
                  ]}
                  onPress={() => setGender('male')}
                >
                  <Text
                    style={[
                      styles.genderText,
                      gender === 'male' && styles.selectedGenderText,
                    ]}
                  >
                    Male
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'female' && styles.selectedGender,
                  ]}
                  onPress={() => setGender('female')}
                >
                  <Text
                    style={[
                      styles.genderText,
                      gender === 'female' && styles.selectedGenderText,
                    ]}
                  >
                    Female
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'other' && styles.selectedGender,
                  ]}
                  onPress={() => setGender('other')}
                >
                  <Text
                    style={[
                      styles.genderText,
                      gender === 'other' && styles.selectedGenderText,
                    ]}
                  >
                    Other
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.genderOption,
                    gender === 'prefer-not-to-say' && styles.selectedGender,
                  ]}
                  onPress={() => setGender('prefer-not-to-say')}
                >
                  <Text
                    style={[
                      styles.genderText,
                      gender === 'prefer-not-to-say' && styles.selectedGenderText,
                    ]}
                  >
                    Prefer not to say
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.verificationInfo}>
              <Text style={styles.verificationTitle}>Verification Process</Text>
              <Text style={styles.verificationText}>
                To ensure the safety of our community, all new members go through a verification process:
              </Text>
              <View style={styles.verificationStep}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>1</Text>
                </View>
                <Text style={styles.stepText}>Basic verification (ID check)</Text>
              </View>
              <View style={styles.verificationStep}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>2</Text>
                </View>
                <Text style={styles.stepText}>Trusted verification (background check)</Text>
              </View>
              <View style={styles.verificationStep}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumber}>3</Text>
                </View>
                <Text style={styles.stepText}>Certified verification (references & training)</Text>
              </View>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <View style={styles.buttonGroup}>
              <HeroButton
                title="BACK"
                onPress={() => setStep(1)}
                variant="outline"
                style={styles.backButton}
              />
              <HeroButton
                title="REGISTER"
                onPress={handleRegister}
                loading={isLoading}
                style={styles.continueButton}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.gray[600],
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxInner: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: Colors.gray[600],
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: '600',
  },
  genderOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  genderOption: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.gray[300],
  },
  selectedGender: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  genderText: {
    fontSize: 14,
    color: Colors.text,
  },
  selectedGenderText: {
    color: Colors.white,
    fontWeight: '600',
  },
  verificationInfo: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  verificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 8,
  },
  verificationText: {
    fontSize: 14,
    color: Colors.gray[600],
    marginBottom: 16,
    lineHeight: 20,
  },
  verificationStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumber: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  stepText: {
    fontSize: 14,
    color: Colors.text,
  },
  errorText: {
    color: Colors.danger,
    marginBottom: 16,
    fontSize: 14,
  },
  registerButton: {
    marginBottom: 24,
  },
  buttonGroup: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  backButton: {
    flex: 1,
    marginRight: 8,
  },
  continueButton: {
    flex: 2,
    marginLeft: 8,
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  loginText: {
    fontSize: 16,
    color: Colors.gray[600],
  },
  loginLink: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
});