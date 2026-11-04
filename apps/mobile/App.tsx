import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from './src/lib/supabase';
import { getInstallationId } from './src/lib/installation';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [phone, setPhone] = useState('+380');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setStep('phone');
        setCode('');
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const sendCode = async () => {
    const normalizedPhone = phone.replace(/[\s()-]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
      setMessage('Введите номер в международном формате, например +380501234567.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      if (!apiUrl) {
        setBusy(false);
        setMessage('Не настроен адрес RouteShare API. Обратитесь к администратору.');
        return;
      }

      const installationId = await getInstallationId();
      const reservationResponse = await fetch(`${apiUrl.replace(/\\/$/, '')}/v1/auth/otp/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, installationId }),
      });
      const reservation = await reservationResponse.json().catch(() => ({}));
      if (!reservationResponse.ok) {
        setBusy(false);
        setMessage(
          reservation?.message ??
          (reservationResponse.status === 429
            ? 'Слишком много запросов с этого устройства или номера. Попробуйте позже.'
            : 'Не удалось проверить запрос. Попробуйте позже.'),
        );
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
      setBusy(false);
      if (error) {
        setMessage(error.message);
        return;
      }
    } catch {
      setBusy(false);
      setMessage('Не удалось связаться с сервером защиты. SMS не отправлено.');
      return;
    }
    setPhone(normalizedPhone);
    setStep('code');
    setMessage('Код отправлен. Проверьте SMS.');
  };

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setMessage('Введите шестизначный код из SMS.');
      return;
    }
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.verifyOtp({
      phone: phone.replace(/[\s()-]/g, ''),
      token: code,
      type: 'sms',
    });
    setBusy(false);
    if (error) setMessage(error.message);
  };

  const signOut = async () => {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    setMessage(error?.message ?? '');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.keyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.container}>
          <Text style={styles.brand}>ROUTE<Text style={styles.brandAccent}>SHARE</Text></Text>
          <Text style={styles.title}>
            {session ? 'Вы вошли в RouteShare' : step === 'phone' ? 'Поездки, которые совпадают' : 'Подтвердите номер'}
          </Text>
          <Text style={styles.subtitle}>
            {session
              ? 'Номер телефона подтверждён. Теперь можно продолжить настройку профиля.'
              : step === 'phone'
                ? 'Находим попутчиков по маршруту, времени и свободным местам.'
                : `Мы отправили SMS на ${phone}. Введите код из сообщения.`}
          </Text>

          {!isSupabaseConfigured ? (
            <View style={styles.notice}>
              <Text style={styles.noticeTitle}>Нужна настройка Supabase</Text>
              <Text style={styles.noticeText}>
                Добавьте EXPO_PUBLIC_SUPABASE_URL и EXPO_PUBLIC_SUPABASE_ANON_KEY в файл apps/mobile/.env. После этого перезапустите Expo.
              </Text>
            </View>
          ) : session ? (
            <View style={styles.panel}>
              <Text style={styles.label}>Вы вошли как</Text>
              <Text style={styles.signedIn}>{session.user.phone ?? 'Телефон подтверждён'}</Text>
              <TouchableOpacity style={styles.buttonSecondary} onPress={signOut} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Выйти</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.panel}>
              {step === 'phone' ? (
                <>
                  <Text style={styles.label}>Номер телефона</Text>
                  <TextInput value={phone} onChangeText={setPhone} placeholder="+380501234567"
                    placeholderTextColor="#718096" keyboardType="phone-pad" autoComplete="tel" style={styles.input} />
                  <TouchableOpacity style={styles.button} onPress={sendCode} disabled={busy}>
                    {busy ? <ActivityIndicator color="#07131F" /> : <Text style={styles.buttonLabel}>Получить SMS-код</Text>}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.label}>Код из SMS</Text>
                  <TextInput value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••" placeholderTextColor="#718096" keyboardType="number-pad"
                    textContentType="oneTimeCode" maxLength={6} style={[styles.input, styles.codeInput]} />
                  <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={busy}>
                    {busy ? <ActivityIndicator color="#07131F" /> : <Text style={styles.buttonLabel}>Подтвердить</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setStep('phone'); setCode(''); setMessage(''); }}>
                    <Text style={styles.link}>Изменить номер телефона</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
          {!!message && <Text style={styles.message}>{message}</Text>}
          <Text style={styles.footer}>Водители и пассажиры — в одном приложении</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0B1220' },
  keyboard: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 26 },
  brand: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 2 },
  brandAccent: { color: '#55D6BE' },
  title: { color: '#FFFFFF', fontSize: 30, lineHeight: 36, fontWeight: '800', marginTop: 34 },
  subtitle: { color: '#AAB6C8', fontSize: 15, lineHeight: 23, marginTop: 12 },
  panel: { marginTop: 30, padding: 20, borderRadius: 20, backgroundColor: '#142238' },
  label: { color: '#C8D3E1', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  input: { backgroundColor: '#0B1728', borderWidth: 1, borderColor: '#2A3B52', borderRadius: 12, paddingHorizontal: 15, paddingVertical: 15, color: '#FFFFFF', fontSize: 17 },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: 24 },
  button: { marginTop: 16, backgroundColor: '#55D6BE', borderRadius: 12, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  buttonSecondary: { marginTop: 20, backgroundColor: '#243A54', borderRadius: 12, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { color: '#07131F', fontSize: 15, fontWeight: '800' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  signedIn: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  notice: { marginTop: 28, padding: 18, borderRadius: 16, backgroundColor: '#352B1B', borderWidth: 1, borderColor: '#735A2A' },
  noticeTitle: { color: '#F4D58D', fontSize: 15, fontWeight: '800' },
  noticeText: { color: '#E6D7B4', fontSize: 13, lineHeight: 20, marginTop: 8 },
  message: { color: '#F4D58D', fontSize: 13, lineHeight: 19, marginTop: 14 },
  link: { color: '#55D6BE', textAlign: 'center', marginTop: 18, fontSize: 14, fontWeight: '600' },
  footer: { color: '#718096', textAlign: 'center', fontSize: 12, marginTop: 34 },
});
