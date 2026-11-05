import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Mode = 'passenger' | 'driver';
type Tab = 'home' | 'trips' | 'messages' | 'profile';

const sampleTrips = [
  { id: '1', from: 'Київ', to: 'Житомир', time: 'Сьогодні, 14:30', price: '180 грн', seats: '2 місця', driver: 'Олександр', car: 'Skoda Octavia', color: '#55D6BE' },
  { id: '2', from: 'Київ', to: 'Черкаси', time: 'Сьогодні, 17:00', price: '320 грн', seats: '3 місця', driver: 'Андрій', car: 'Volkswagen Passat', color: '#8EA8FF' },
  { id: '3', from: 'Бровари', to: 'Київ', time: 'Завтра, 08:15', price: '75 грн', seats: '1 місце', driver: 'Марина', car: 'Toyota Corolla', color: '#F2B76B' },
];

export default function App() {
  const [mode, setMode] = useState<Mode>('passenger');
  const [tab, setTab] = useState<Tab>('home');
  const [from, setFrom] = useState('Київ');
  const [to, setTo] = useState('Житомир');
  const [date, setDate] = useState('Сьогодні');
  const [notice, setNotice] = useState('');

  const showNotice = (message: string) => setNotice(message);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.screen}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>ROUTE<Text style={styles.brandAccent}>SHARE</Text></Text>
            <Text style={styles.headerCaption}>Твій маршрут. Твоя компанія.</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => setTab('profile')}>
            <Text style={styles.avatarText}>С</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modeSwitch}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'passenger' && styles.modeButtonActive]}
            onPress={() => { setMode('passenger'); setTab('home'); setNotice(''); }}
          >
            <Text style={[styles.modeText, mode === 'passenger' && styles.modeTextActive]}>Пасажир</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'driver' && styles.modeButtonActive]}
            onPress={() => { setMode('driver'); setTab('home'); setNotice(''); }}
          >
            <Text style={[styles.modeText, mode === 'driver' && styles.modeTextActive]}>Водій</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {tab === 'home' && mode === 'passenger' && (
            <>
              <View style={styles.hero}>
                <View style={styles.heroGlow} />
                <Text style={styles.eyebrow}>ROUTES MADE TOGETHER</Text>
                <Text style={styles.heroTitle}>Знайди свою{"\n"}поїздку</Text>
                <Text style={styles.heroSubtitle}>Подорожуй з попутниками та діли витрати на дорогу.</Text>
                <View style={styles.routeCard}>
                  <View style={styles.routeLine}>
                    <View style={styles.dotStart} />
                    <View style={styles.routeInputWrap}>
                      <Text style={styles.fieldLabel}>ЗВІДКИ</Text>
                      <TextInput value={from} onChangeText={setFrom} placeholder="Місто відправлення" placeholderTextColor="#718096" style={styles.routeInput} />
                    </View>
                  </View>
                  <View style={styles.routeDivider} />
                  <View style={styles.routeLine}>
                    <View style={styles.dotEnd} />
                    <View style={styles.routeInputWrap}>
                      <Text style={styles.fieldLabel}>КУДИ</Text>
                      <TextInput value={to} onChangeText={setTo} placeholder="Місто призначення" placeholderTextColor="#718096" style={styles.routeInput} />
                    </View>
                  </View>
                  <View style={styles.dateRow}>
                    <Text style={styles.fieldLabel}>ДАТА</Text>
                    <View style={styles.dateOptions}>
                      {['Сьогодні', 'Завтра'].map((value) => (
                        <TouchableOpacity key={value} style={[styles.dateChip, date === value && styles.dateChipActive]} onPress={() => setDate(value)}>
                          <Text style={[styles.dateChipText, date === value && styles.dateChipTextActive]}>{value}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.primaryButton} onPress={() => showNotice('Пошук маршрутів підключимо на наступному етапі.')}>
                    <Text style={styles.primaryButtonText}>Знайти поїздку</Text>
                    <Text style={styles.buttonArrow}>→</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Популярні напрямки</Text>
                  <Text style={styles.sectionSubtitle}>Поруч із тобою</Text>
                </View>
                <TouchableOpacity onPress={() => setTab('trips')}><Text style={styles.seeAll}>Усі →</Text></TouchableOpacity>
              </View>
              <View style={styles.popularRow}>
                <TouchableOpacity style={styles.popularCard} onPress={() => { setFrom('Київ'); setTo('Житомир'); }}>
                  <Text style={styles.popularIcon}>🏙️</Text><Text style={styles.popularRoute}>Київ — Житомир</Text><Text style={styles.popularMeta}>від 180 грн</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.popularCard} onPress={() => { setFrom('Київ'); setTo('Черкаси'); }}>
                  <Text style={styles.popularIcon}>🌆</Text><Text style={styles.popularRoute}>Київ — Черкаси</Text><Text style={styles.popularMeta}>від 320 грн</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Найближчі поїздки</Text><Text style={styles.sectionSubtitle}>Приклади пропозицій</Text></View>
              </View>
              {sampleTrips.slice(0, 2).map((trip) => <TripCard key={trip.id} trip={trip} onPress={() => showNotice('Деталі поїздки та бронювання з’являться після підключення API.')} />)}
            </>
          )}

          {tab === 'home' && mode === 'driver' && (
            <>
              <View style={styles.driverHero}>
                <Text style={styles.eyebrow}>ТВОЯ ДОРОГА МОЖЕ БУТИ ВИГІДНІШОЮ</Text>
                <Text style={styles.heroTitle}>Є вільні місця?{"\n"}Знайди попутників.</Text>
                <Text style={styles.heroSubtitle}>Опублікуй маршрут — пасажири запропонують свою ціну за кілометр.</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => showNotice('Форму створення маршруту зробимо наступним етапом.')}>
                  <Text style={styles.primaryButtonText}>Опублікувати маршрут</Text><Text style={styles.buttonArrow}>→</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statCard}><Text style={styles.statValue}>—</Text><Text style={styles.statLabel}>Активні маршрути</Text></View>
                <View style={styles.statCard}><Text style={styles.statValue}>—</Text><Text style={styles.statLabel}>Заявки пасажирів</Text></View>
              </View>
              <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Як це працює</Text><Text style={styles.sectionSubtitle}>Три прості кроки</Text></View></View>
              <View style={styles.stepCard}><Text style={styles.stepNumber}>01</Text><View style={styles.stepText}><Text style={styles.stepTitle}>Вкажи маршрут</Text><Text style={styles.stepDescription}>Звідки, куди, час виїзду та кількість вільних місць.</Text></View></View>
              <View style={styles.stepCard}><Text style={styles.stepNumber}>02</Text><View style={styles.stepText}><Text style={styles.stepTitle}>Отримай пропозиції</Text><Text style={styles.stepDescription}>Побачиш пасажирів, зручні комбінації та дохід.</Text></View></View>
              <View style={styles.stepCard}><Text style={styles.stepNumber}>03</Text><View style={styles.stepText}><Text style={styles.stepTitle}>Обери найкращий варіант</Text><Text style={styles.stepDescription}>Підтверди маршрут і забери пасажирів дорогою.</Text></View></View>
            </>
          )}

          {tab === 'trips' && (
            <>
              <Text style={styles.pageTitle}>{mode === 'passenger' ? 'Поїздки поруч' : 'Мої маршрути'}</Text>
              <Text style={styles.pageSubtitle}>{mode === 'passenger' ? 'Приклади доступних пропозицій' : 'Тут будуть твої опубліковані маршрути'}</Text>
              {mode === 'passenger'
                ? sampleTrips.map((trip) => <TripCard key={trip.id} trip={trip} onPress={() => showNotice('Деталі поїздки підключимо наступним етапом.')} />)
                : <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛣️</Text><Text style={styles.emptyTitle}>Маршрутів поки немає</Text><Text style={styles.emptyText}>Створи перший маршрут, щоб знайти пасажирів.</Text><TouchableOpacity style={styles.primaryButton} onPress={() => setTab('home')}><Text style={styles.primaryButtonText}>Створити маршрут</Text></TouchableOpacity></View>}
            </>
          )}

          {tab === 'messages' && (
            <View style={styles.emptyCard}><Text style={styles.emptyIcon}>💬</Text><Text style={styles.pageTitle}>Повідомлення</Text><Text style={styles.emptyText}>Чат із водієм або пасажиром з’явиться після створення першої заявки.</Text></View>
          )}

          {tab === 'profile' && (
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>С</Text></View>
              <Text style={styles.profileName}>Тестовий користувач</Text>
              <Text style={styles.profilePhone}>Демо-режим · без підтвердження номера</Text>
              <View style={styles.profileDivider} />
              <Text style={styles.profileHint}>Профіль, контакти та підтвердження телефону налаштуємо окремо перед запуском реальних поїздок.</Text>
              <View style={styles.demoTag}><Text style={styles.demoTagText}>DEVELOPMENT PREVIEW</Text></View>
            </View>
          )}

          {!!notice && <TouchableOpacity style={styles.notice} onPress={() => setNotice('')}><Text style={styles.noticeText}>{notice}</Text><Text style={styles.noticeClose}>×</Text></TouchableOpacity>}
          <Text style={styles.footer}>ROUTE<Text style={styles.brandAccent}>SHARE</Text>  ·  Разом дорогою</Text>
        </ScrollView>

        <View style={styles.bottomNav}>
          <NavItem icon="⌂" label="Головна" active={tab === 'home'} onPress={() => setTab('home')} />
          <NavItem icon="⇄" label={mode === 'passenger' ? 'Поїздки' : 'Маршрути'} active={tab === 'trips'} onPress={() => setTab('trips')} />
          <NavItem icon="▤" label="Чати" active={tab === 'messages'} onPress={() => setTab('messages')} />
          <NavItem icon="◉" label="Профіль" active={tab === 'profile'} onPress={() => setTab('profile')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function TripCard({ trip, onPress }: { trip: typeof sampleTrips[number]; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tripCard} onPress={onPress}>
      <View style={styles.tripTop}><Text style={styles.tripTime}>{trip.time}</Text><View style={[styles.tripAccent, { backgroundColor: trip.color }]} /></View>
      <View style={styles.tripRoute}><View style={styles.tripStops}><View style={styles.tripDotStart} /><View style={styles.tripStem} /><View style={styles.tripDotEnd} /></View><View><Text style={styles.tripCity}>{trip.from}</Text><Text style={styles.tripCityEnd}>{trip.to}</Text></View><View style={styles.tripPriceWrap}><Text style={styles.tripPrice}>{trip.price}</Text><Text style={styles.tripSeats}>{trip.seats}</Text></View></View>
      <View style={styles.tripBottom}><Text style={styles.tripDriver}>{trip.driver} · {trip.car}</Text><Text style={styles.tripDetails}>Деталі →</Text></View>
    </TouchableOpacity>
  );
}

function NavItem({ icon, label, active, onPress }: { icon: string; label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={styles.navItem} onPress={onPress}><Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text><Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#091321' },
  screen: { flex: 1, backgroundColor: '#091321' },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: 2 },
  brandAccent: { color: '#55D6BE' },
  headerCaption: { color: '#718096', fontSize: 11, marginTop: 4, letterSpacing: 0.3 },
  avatar: { width: 42, height: 42, borderRadius: 15, backgroundColor: '#1C3446', borderWidth: 1, borderColor: '#31536A', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#55D6BE', fontWeight: '800', fontSize: 17 },
  modeSwitch: { marginHorizontal: 22, padding: 4, borderRadius: 14, backgroundColor: '#142235', flexDirection: 'row', marginBottom: 8 },
  modeButton: { flex: 1, paddingVertical: 11, borderRadius: 11, alignItems: 'center' },
  modeButtonActive: { backgroundColor: '#55D6BE' },
  modeText: { color: '#94A3B8', fontSize: 14, fontWeight: '700' },
  modeTextActive: { color: '#071923' },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 26 },
  hero: { backgroundColor: '#123448', borderRadius: 25, padding: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#245269' },
  heroGlow: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: '#1C796F', opacity: 0.28, right: -65, top: -80 },
  eyebrow: { color: '#70DCC8', fontSize: 9, fontWeight: '900', letterSpacing: 1.7 },
  heroTitle: { color: '#FFFFFF', fontSize: 30, lineHeight: 35, fontWeight: '900', marginTop: 10 },
  heroSubtitle: { color: '#B7CBD6', fontSize: 13, lineHeight: 19, marginTop: 9, marginBottom: 17, maxWidth: 285 },
  routeCard: { backgroundColor: '#F7FAFC', borderRadius: 18, padding: 15 },
  routeLine: { flexDirection: 'row', alignItems: 'center', minHeight: 53 },
  dotStart: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#55BFAE', marginHorizontal: 5 },
  dotEnd: { width: 10, height: 10, borderRadius: 2, backgroundColor: '#5274E8', marginHorizontal: 5 },
  routeInputWrap: { marginLeft: 12, flex: 1 },
  fieldLabel: { color: '#8392A5', fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  routeInput: { color: '#12263A', fontSize: 16, fontWeight: '700', paddingVertical: 3 },
  routeDivider: { height: 1, backgroundColor: '#E4EAF0', marginLeft: 27 },
  dateRow: { borderTopWidth: 1, borderTopColor: '#E4EAF0', marginTop: 10, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateOptions: { flexDirection: 'row', gap: 7 },
  dateChip: { borderRadius: 9, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: '#EAF0F5' },
  dateChipActive: { backgroundColor: '#D6F4EC' },
  dateChipText: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  dateChipTextActive: { color: '#087D6D' },
  primaryButton: { backgroundColor: '#55D6BE', minHeight: 49, borderRadius: 12, paddingHorizontal: 15, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#071923', fontSize: 14, fontWeight: '900' },
  buttonArrow: { color: '#071923', fontSize: 20, fontWeight: '800', marginLeft: 9, marginTop: -2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25, marginBottom: 12 },
  sectionTitle: { color: '#F3F7FB', fontSize: 17, fontWeight: '800' },
  sectionSubtitle: { color: '#718096', fontSize: 11, marginTop: 4 },
  seeAll: { color: '#55D6BE', fontSize: 12, fontWeight: '700' },
  popularRow: { flexDirection: 'row', gap: 10 },
  popularCard: { flex: 1, backgroundColor: '#142337', borderRadius: 15, padding: 13, borderWidth: 1, borderColor: '#20354C' },
  popularIcon: { fontSize: 20, marginBottom: 9 },
  popularRoute: { color: '#EAF2F8', fontSize: 12, fontWeight: '800' },
  popularMeta: { color: '#55D6BE', fontSize: 11, marginTop: 5 },
  tripCard: { backgroundColor: '#142337', borderRadius: 17, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#20354C' },
  tripTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tripTime: { color: '#91A2B6', fontSize: 11, fontWeight: '600' },
  tripAccent: { width: 7, height: 7, borderRadius: 4 },
  tripRoute: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  tripStops: { width: 18, alignItems: 'center', marginRight: 9 },
  tripDotStart: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#55D6BE' },
  tripStem: { width: 1, height: 18, backgroundColor: '#52677E' },
  tripDotEnd: { width: 8, height: 8, borderRadius: 2, backgroundColor: '#8EA8FF' },
  tripCity: { color: '#F1F5F9', fontSize: 15, fontWeight: '800' },
  tripCityEnd: { color: '#F1F5F9', fontSize: 15, fontWeight: '800', marginTop: 9 },
  tripPriceWrap: { marginLeft: 'auto', alignItems: 'flex-end' },
  tripPrice: { color: '#55D6BE', fontSize: 15, fontWeight: '900' },
  tripSeats: { color: '#8293A8', fontSize: 10, marginTop: 5 },
  tripBottom: { borderTopWidth: 1, borderTopColor: '#26394F', marginTop: 13, paddingTop: 10, flexDirection: 'row', justifyContent: 'space-between' },
  tripDriver: { color: '#91A2B6', fontSize: 10 },
  tripDetails: { color: '#55D6BE', fontSize: 10, fontWeight: '800' },
  driverHero: { backgroundColor: '#183C42', borderRadius: 24, padding: 21, borderWidth: 1, borderColor: '#2B6560' },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#142337', borderRadius: 15, padding: 16, borderWidth: 1, borderColor: '#20354C' },
  statValue: { color: '#55D6BE', fontSize: 25, fontWeight: '900' },
  statLabel: { color: '#91A2B6', fontSize: 10, marginTop: 5 },
  stepCard: { flexDirection: 'row', padding: 15, backgroundColor: '#142337', borderRadius: 15, marginBottom: 9, borderWidth: 1, borderColor: '#20354C' },
  stepNumber: { color: '#55D6BE', fontSize: 17, fontWeight: '900', width: 43 },
  stepText: { flex: 1 },
  stepTitle: { color: '#F1F5F9', fontSize: 13, fontWeight: '800' },
  stepDescription: { color: '#91A2B6', fontSize: 11, lineHeight: 16, marginTop: 4 },
  pageTitle: { color: '#F3F7FB', fontSize: 25, fontWeight: '900', marginTop: 7 },
  pageSubtitle: { color: '#8293A8', fontSize: 12, marginTop: 6, marginBottom: 18 },
  emptyCard: { backgroundColor: '#142337', borderRadius: 19, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#20354C', marginTop: 18 },
  emptyIcon: { fontSize: 32, marginBottom: 12 },
  emptyTitle: { color: '#F1F5F9', fontSize: 16, fontWeight: '800', marginTop: 8 },
  emptyText: { color: '#91A2B6', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8 },
  profileCard: { backgroundColor: '#142337', borderRadius: 20, padding: 22, alignItems: 'center', marginTop: 15, borderWidth: 1, borderColor: '#20354C' },
  profileAvatar: { width: 68, height: 68, borderRadius: 23, backgroundColor: '#1C4550', alignItems: 'center', justifyContent: 'center' },
  profileAvatarText: { color: '#55D6BE', fontSize: 27, fontWeight: '900' },
  profileName: { color: '#F1F5F9', fontSize: 18, fontWeight: '800', marginTop: 13 },
  profilePhone: { color: '#8293A8', fontSize: 11, marginTop: 5 },
  profileDivider: { height: 1, backgroundColor: '#293D53', alignSelf: 'stretch', marginVertical: 18 },
  profileHint: { color: '#A5B4C5', fontSize: 12, lineHeight: 19, textAlign: 'center' },
  demoTag: { backgroundColor: '#253B4C', borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, marginTop: 17 },
  demoTagText: { color: '#70DCC8', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  notice: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#3A321F', borderColor: '#776236', borderWidth: 1, padding: 13, borderRadius: 12, marginTop: 16 },
  noticeText: { color: '#F4D58D', fontSize: 11, flex: 1, lineHeight: 16 },
  noticeClose: { color: '#F4D58D', fontSize: 20, marginLeft: 10 },
  footer: { color: '#52647A', fontSize: 10, textAlign: 'center', marginTop: 27, marginBottom: 8, letterSpacing: 0.7 },
  bottomNav: { backgroundColor: '#101D2D', borderTopWidth: 1, borderTopColor: '#1F3045', paddingTop: 9, paddingBottom: 8, flexDirection: 'row', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', minWidth: 60 },
  navIcon: { color: '#718096', fontSize: 21, lineHeight: 24 },
  navLabel: { color: '#718096', fontSize: 9, marginTop: 3, fontWeight: '600' },
  navActive: { color: '#55D6BE' },
});
