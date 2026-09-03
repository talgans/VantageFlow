import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { UserRole } from '../../types';
import { colors, typography, spacing, borderRadius } from '../../constants/theme';
import { ShieldCheck, Mail, Lock, Sparkles, ArrowRight } from 'lucide-react-native';

export default function LoginScreen() {
  const { signIn, signInAsDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignIn = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter email and password');
      return;
    }
    setErrorMsg('');
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = (role: UserRole) => {
    signInAsDemo(role);
    router.replace('/(tabs)');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          <View style={styles.logoBadge}>
            <Sparkles size={32} color={colors.primary} />
          </View>
          <Text style={styles.appName}>VantageFlow</Text>
          <Text style={styles.appTagline}>
            Enterprise Project Control & Team Collaboration
          </Text>
        </View>

        {/* Login Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Email Input */}
          <View style={styles.inputWrap}>
            <Mail size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputWrap}>
            <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <View style={styles.btnContent}>
                <Text style={styles.signInBtnText}>Sign In</Text>
                <ArrowRight size={18} color={colors.background} />
              </View>
            )}
          </TouchableOpacity>

          {/* Quick Demo Selector */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR QUICK DEMO ACCESS</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.demoButtonsRow}>
            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleDemoSignIn(UserRole.Admin)}
            >
              <Text style={styles.demoBtnText}>Admin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleDemoSignIn(UserRole.Manager)}
            >
              <Text style={styles.demoBtnText}>Manager</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.demoBtn}
              onPress={() => handleDemoSignIn(UserRole.Member)}
            >
              <Text style={styles.demoBtnText}>Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  brandHeader: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  appName: {
    color: colors.text,
    fontSize: typography.sizes.title,
    fontWeight: typography.weights.heavy,
    letterSpacing: -0.5,
  },
  appTagline: {
    color: colors.textSecondary,
    fontSize: typography.sizes.sm,
    marginTop: 4,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.sm,
    marginBottom: spacing.md,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: typography.sizes.base,
    paddingVertical: spacing.md,
  },
  signInBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  signInBtnText: {
    color: colors.background,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.5,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: colors.cardSecondary,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoBtnText: {
    color: colors.text,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
});
