import React, { useEffect, useState } from 'react';
import { cancelTestPassengerRequest, createTestPassengerRequest, listTestPassengerRequests, TestPassengerRequest } from './src/lib/testRequests';
import { StatusBar } from 'expo-status-bar';
import {
  SafeAreaView,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Mode = 'passenger' | 'driver';
type Design = 'classic' | 'new';
const initialDesign = (): Design => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 'classic';
  const query = new URLSearchParams(window.location.search).get('design');
  return query === 'new' ? 'new' : 'classic';
};
type Tab = 'home' | 'trips' | 'messages' | 'profile';

const sampleTrips = [
  { id: '1', from: 'Київ', to: 'Житомир', time: 'Сьогодні, 14:30', price: '180 грн', seats: '2 місця', driver: 'Олександр', car: 'Skoda Octavia', color: '#55D6BE' },
  { id: '2', from: 'Київ', to: 'Черкаси', time: 'Сьогодні, 17:00', price: '320 грн', seats: '3 місця', driver: 'Андрій', car: 'Volkswagen Passat', color: '#8EA8FF' },
  { id: '3', from: 'Бровари', to: 'Київ', time: 'Завтра, 08:15', price: '75 грн', seats: '1 місце', driver: 'Марина', car: 'Toyota Corolla', color: '#F2B76B' },
];

const navSvgPaths: Record<string, string> = {
  listClassic: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
  mapClassic: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15"/>',
  offerClassic: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  listNew: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><rect x="3" y="11" width="18" height="5" rx="1.5"/><path d="M7 19h14"/>',
  mapNew: '<path d="M12 22s8-8.1 8-14a8 8 0 0 0-16 0c0 5.9 8 14 8 14Z"/><circle cx="12" cy="8" r="2.5"/>',
  offerNew: '<path d="M8 3h8l2 3h3v15H3V6h3zM8 3v4h8V3M7 13l3 3 7-7"/>',
};
function NavGraphic({ kind, active, design }: { kind: 'list' | 'map' | 'offer'; active: boolean; design: Design }) {
  const stroke = design === 'new' ? (active ? '#FFFFFF' : '#146E87') : (active ? '#35E08B' : '#8495A8');
  const key = kind + (design === 'new' ? 'New' : 'Classic');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="' + stroke + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + navSvgPaths[key] + '</svg>';
  return <Image source={{ uri: 'data:image/svg+xml,' + encodeURIComponent(svg) }} style={{ width: 28, height: 28 }} resizeMode="contain" />;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('passenger');
  const [tab, setTab] = useState<Tab>('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const [design, setDesign] = useState<Design>(initialDesign);
  const changeDesign = (next: Design) => {
    setDesign(next);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('design', next);
      window.history.replaceState(null, '', url.toString());
      try { window.localStorage.setItem('routeshare-design', next); } catch {}
    }
  };
  const [driverView, setDriverView] = useState<'list' | 'map' | 'offer'>('list');
  const [driverOffer, setDriverOffer] = useState<DriverOffer | null>(null);
  const [from, setFrom] = useState('Київ, Берестейський проспект 10');
  const [to, setTo] = useState('Київ, Хрещатик 1');
  const [notice, setNotice] = useState('');
  const [rate, setRate] = useState('3.5');
  const [testRequests, setTestRequests] = useState<TestPassengerRequest[]>([]);
  const [savingRequest, setSavingRequest] = useState(false);

  const refreshTestRequests = async (showErrors = false) => {
    try {
      setTestRequests(await listTestPassengerRequests());
    } catch (error) {
      if (showErrors) setNotice(error instanceof Error ? error.message : 'Не вдалося завантажити заявки.');
    }
  };

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await listTestPassengerRequests();
        if (active) setTestRequests(rows);
      } catch {
        // Shared test mode is enabled on the API separately.
      }
    };
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  const createTestRequest = async () => {
    if (!from.trim() || !to.trim()) {
      setNotice('Вкажи адреси посадки та висадки.');
      return;
    }
    const parsedRate = Number(rate.replace(',', '.'));
    if (!Number.isFinite(parsedRate) || parsedRate < 0) {
      setNotice('Перевір ціну за кілометр.');
      return;
    }
    const departure = new Date();
    // Temporary API compatibility: requests are immediate; the time window is not user-selected.
    const departureEnd = new Date(departure.getTime() + 11 * 60 * 1000);
    setSavingRequest(true);
    try {
      await createTestPassengerRequest({
        origin: from.trim(),
        destination: to.trim(),
        departureStart: departure.toISOString(),
        departureEnd: departureEnd.toISOString(),
        offeredRateUahPerKm: parsedRate,
      });
      await refreshTestRequests();
      setNotice('Тестову заявку створено. Вона з’явиться на інших пристроях.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не вдалося створити заявку.');
    } finally {
      setSavingRequest(false);
    }
  };

  const cancelTestRequest = async (id: string) => {
    try {
      await cancelTestPassengerRequest(id);
      await refreshTestRequests();
      setNotice('Тестову заявку скасовано.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не вдалося скасувати заявку.');
    }
  };

  const showNotice = (message: string) => setNotice(message);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={[styles.screen, design === 'new' && { backgroundColor: '#E9F0F6' }]}>
        <View style={[styles.header, design === 'new' && { backgroundColor: '#123B52', borderBottomColor: '#2B7088' }]}>
          <TouchableOpacity onPress={() => setMenuOpen(v => !v)} style={{ paddingHorizontal: 9, paddingVertical: 5 }} accessibilityLabel="Відкрити меню"><Text style={{ color: '#FFFFFF', fontSize: 27 }}>☰</Text></TouchableOpacity>
          <View>
            <Text style={styles.brand}>ROUTE<Text style={styles.brandAccent}>SHARE</Text></Text>
            <Text style={styles.headerCaption}>Твій маршрут. Твоя компанія.</Text>
          </View>
          <TouchableOpacity style={styles.avatar} onPress={() => setMenuOpen(v => !v)}>
            <Text style={styles.avatarText}>С</Text>
          </TouchableOpacity>
        </View>

        {menuOpen && <View style={{ backgroundColor: '#1A2A3D', padding: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: '#40536A' }}>
          <Text style={{ color: '#AFC8D6', fontWeight: '700', fontSize: 12 }}>ОФОРМЛЕННЯ</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}><TouchableOpacity onPress={() => changeDesign('classic')} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: design === 'classic' ? '#34D97B' : '#54677C' }}><Text style={{ color: '#FFFFFF' }}>Класичний {design === 'classic' ? '✓' : ''}</Text></TouchableOpacity><TouchableOpacity onPress={() => changeDesign('new')} style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: design === 'new' ? '#34D97B' : '#54677C' }}><Text style={{ color: '#FFFFFF' }}>Новий {design === 'new' ? '✓' : ''}</Text></TouchableOpacity></View>
          {([['home', 'Головна'], ['trips', 'Тестові заявки'], ['messages', 'Чати'], ['profile', 'Профіль']] as const).map(([key, label]) => <TouchableOpacity key={key} onPress={() => { setTab(key); setMenuOpen(false); }}><Text style={{ color: '#FFFFFF', fontSize: 15, padding: 6 }}>{label}</Text></TouchableOpacity>)}
        </View>}
        <View style={[styles.modeSwitch, design === 'new' && { backgroundColor: '#D7E4EC' }]}>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'passenger' && styles.modeButtonActive]}
            onPress={() => { setMode('passenger'); setTab('home'); setNotice(''); setDriverView('list'); setDriverOffer(null); }}
          >
            <Text style={[styles.modeText, mode === 'passenger' && styles.modeTextActive]}>Пасажир</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeButton, mode === 'driver' && styles.modeButtonActive]}
            onPress={() => { setMode('driver'); setTab('home'); setNotice(''); setDriverView('list'); setDriverOffer(null); }}
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
                      <TextInput value={from} onChangeText={setFrom} placeholder="Адреса посадки" placeholderTextColor="#718096" style={styles.routeInput} />
                    </View>
                  </View>
                  <View style={styles.routeDivider} />
                  <View style={styles.routeLine}>
                    <View style={styles.dotEnd} />
                    <View style={styles.routeInputWrap}>
                      <Text style={styles.fieldLabel}>КУДИ</Text>
                      <TextInput value={to} onChangeText={setTo} placeholder="Адреса висадки" placeholderTextColor="#718096" style={styles.routeInput} />
                    </View>
                  </View>
                  <View style={styles.rateRow}>
                    <Text style={styles.rateLabel}>ТВОЯ ЦІНА, грн/км</Text>
                    <TextInput value={rate} onChangeText={setRate} keyboardType="decimal-pad" style={styles.rateInput} />
                  </View>
                  <TouchableOpacity style={styles.primaryButton} disabled={savingRequest} onPress={createTestRequest}>
                    <Text style={styles.primaryButtonText}>{savingRequest ? 'Зберігаємо…' : 'Створити тестову заявку'}</Text>
                    <Text style={styles.buttonArrow}>＋</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Тестування маршрутів</Text>
                  <Text style={styles.sectionSubtitle}>Створюй декілька заявок для перевірки</Text>
                </View>
                <TouchableOpacity onPress={() => setTab('trips')}><Text style={styles.seeAll}>Усі →</Text></TouchableOpacity>
              </View>
              <View style={styles.popularRow}>
                <TouchableOpacity style={styles.popularCard} onPress={() => { setFrom('Київ, Оболонський проспект 10'); setTo('Київ, Хрещатик 1'); }}>
                  <Text style={styles.popularIcon}>🏙️</Text><Text style={styles.popularRoute}>Київ: Берестейський → Хрещатик</Text><Text style={styles.popularMeta}>від 180 грн</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.popularCard} onPress={() => { setFrom('Київ'); setTo('Київ, Контрактова площа 1'); }}>
                  <Text style={styles.popularIcon}>🌆</Text><Text style={styles.popularRoute}>Київ: Оболонь → Поділ</Text><Text style={styles.popularMeta}>від 320 грн</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHeader}>
                <View><Text style={styles.sectionTitle}>Демо-пропозиції</Text><Text style={styles.sectionSubtitle}>Приклади пропозицій</Text></View>
              </View>
              {sampleTrips.slice(0, 2).map((trip) => <TripCard key={trip.id} trip={trip} onPress={() => showNotice('Деталі поїздки та бронювання з’являться після підключення API.')} />)}
            </>
          )}

          {tab === 'home' && mode === 'driver' && <DriverOfferList liveRequests={testRequests} onRefresh={() => refreshTestRequests(true)} design={design} view={driverView} selectedOffer={driverOffer} onSelectOffer={(offer) => { setDriverOffer(offer); setDriverView('offer'); }} onBack={() => { setDriverOffer(null); setDriverView('list'); }} />}

          {tab === 'trips' && (
            <>
              <Text style={styles.pageTitle}>Тестові заявки</Text>
              <Text style={styles.pageSubtitle}>Спільний список з усіх пристроїв · автооновлення кожні 5 секунд</Text>
              {testRequests.length === 0
                ? <View style={styles.emptyCard}><Text style={styles.emptyIcon}>🛣️</Text><Text style={styles.emptyTitle}>Заявок поки немає</Text><Text style={styles.emptyText}>Перемкнись у режим пасажира та створи декілька маршрутів.</Text></View>
                : testRequests.map((request) => <TestRequestCard key={request.id} request={request} onCancel={cancelTestRequest} />)}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => refreshTestRequests(true)}><Text style={styles.secondaryButtonText}>Оновити зараз</Text></TouchableOpacity>
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

        {tab === 'home' && mode === 'driver' && <View style={[styles.bottomNav, design === 'new' && { backgroundColor: '#E9F0F6', paddingHorizontal: 9, paddingTop: 12, paddingBottom: 14, borderTopColor: '#B7CEDA', gap: 8 }]}>
          {([
            ['list', 'Список', '☷', '▤'],
            ['map', 'Карта', '▧', '◈'],
            ['offer', 'Заявка', '▤', '✦'],
          ] as const).map(([key, label, classicIcon, newIcon]) => (
            <TouchableOpacity key={key} onPress={() => { setDriverView(key); if (key !== 'offer') setDriverOffer(null); }}
              style={design === 'new' ? { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 17, paddingVertical: 10, backgroundColor: driverView === key ? '#146E87' : '#FFFFFF', borderWidth: 1, borderColor: driverView === key ? '#146E87' : '#C7D9E4' } : { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, borderTopWidth: driverView === key ? 3 : 3, borderTopColor: driverView === key ? '#35E08B' : 'transparent' }}>
              <NavGraphic kind={key} active={driverView === key} design={design} />
              <Text style={{ fontSize: design === 'new' ? 12 : 10, marginTop: 3, color: design === 'new' ? (driverView === key ? '#FFFFFF' : '#146E87') : (driverView === key ? '#35E08B' : '#8495A8'), fontWeight: '800' }}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>}
      </View>
    </SafeAreaView>
  );
}


type DriverOffer = {
  id: string; color: string; amount: number; distance: number; minutes: number;
  pickupKm: number; finalKm: number; pickup: string; dropoff: string;
  passengers: { name: string; acceptance: number; noShow: number; km: number; fare: number; avatar: string }[];
};
// Preview data only. Never use these values to accept a real ride or charge a passenger.
const previewOffers: DriverOffer[] = [
  { id: 'red', color: '#FF4256', amount: 870, distance: 23.6, minutes: 42, pickupKm: 2.1, finalKm: 3.4, pickup: 'просп. Відрадний, 3', dropoff: 'просп. Григоренка, 22', passengers: [
    { name: 'Олексій', acceptance: 97, noShow: 0, km: 8.1, fare: 320, avatar: 'О' },
    { name: 'Марія', acceptance: 95, noShow: 2, km: 7.5, fare: 280, avatar: 'М' },
    { name: 'Ігор', acceptance: 100, noShow: 0, km: 11.2, fare: 270, avatar: 'І' },
  ] },
  { id: 'green', color: '#23DE75', amount: 750, distance: 22, minutes: 38, pickupKm: 1.8, finalKm: 3.1, pickup: 'вул. Лісова, 7', dropoff: 'Харківське шосе, 144', passengers: [
    { name: 'Анна', acceptance: 98, noShow: 0, km: 6.9, fare: 260, avatar: 'А' },
    { name: 'Дмитро', acceptance: 96, noShow: 1, km: 7.4, fare: 250, avatar: 'Д' },
    { name: 'Сергій', acceptance: 94, noShow: 3, km: 7.7, fare: 240, avatar: 'С' },
  ] },
  { id: 'blue', color: '#36A9FF', amount: 690, distance: 21, minutes: 36, pickupKm: 2.6, finalKm: 2.8, pickup: 'вул. Вишгородська, 45', dropoff: 'вул. Бориспільська, 40', passengers: [
    { name: 'Віктор', acceptance: 93, noShow: 3, km: 6.5, fare: 230, avatar: 'В' },
    { name: 'Юлія', acceptance: 95, noShow: 0, km: 7, fare: 220, avatar: 'Ю' },
    { name: 'Роман', acceptance: 95, noShow: 1, km: 7.5, fare: 240, avatar: 'Р' },
  ] },
];
const perKm = (o: DriverOffer) => o.distance > 0 ? o.amount / o.distance : 0;
const perHour = (o: DriverOffer) => o.minutes > 0 ? o.amount / o.minutes * 60 : 0;
function DriverOfferList({ liveRequests, onRefresh, design, view, selectedOffer, onSelectOffer, onBack }: { liveRequests: TestPassengerRequest[]; onRefresh: () => void; design: Design; view: 'list' | 'map' | 'offer'; selectedOffer: DriverOffer | null; onSelectOffer: (offer: DriverOffer) => void; onBack: () => void }) {
  const [seats, setSeats] = useState(3);
  const [pickupLimit, setPickupLimit] = useState(3);
  const [finalLimit, setFinalLimit] = useState(4);
  const [unique, setUnique] = useState(true);
  const [sortBy, setSortBy] = useState<'km' | 'hour'>('km');
  const [replaceName, setReplaceName] = useState<string | null>(null);
  const [increase, setIncrease] = useState(0);
  const offers = [...previewOffers]
    .filter(o => o.passengers.length <= seats && o.pickupKm <= pickupLimit && o.finalKm <= finalLimit)
    .sort((a, b) => sortBy === 'km' ? perKm(b) - perKm(a) : perHour(b) - perHour(a));
  const cycle = (v: number) => v >= 7 ? 0.5 : Math.round((v + 0.5) * 10) / 10;
  if (view === 'offer') return selectedOffer ? <DriverOfferDetail design={design} offer={selectedOffer} increase={increase} setIncrease={setIncrease} onBack={onBack} /> : <View style={driverStyles.wrap}><Text style={driverStyles.empty}>Заявку ще не вибрано. Відкрий «Список» і натисни на потрібну комбінацію.</Text></View>;
  return (
    <View style={[driverStyles.wrap, design === 'new' && { backgroundColor: '#E9F0F6', padding: 8, borderRadius: 14 }]}>
      <Text style={[driverStyles.heading, design === 'new' && { color: '#123B52' }]}>{design === 'new' ? 'НОВИЙ ДИЗАЙН · МАРШРУТИ' : 'RouteShare · Водій'} <Text style={driverStyles.preview}>ПЕРЕГЛЯД</Text></Text>
      <View style={[driverStyles.filters, design === 'new' && { backgroundColor: '#C6DDE8', borderRadius: 16, padding: 8, flexWrap: 'wrap' }]}>
        <TouchableOpacity style={[driverStyles.filter, design === 'new' && { backgroundColor: '#FFFFFF', borderColor: '#9DB5C4', borderRadius: 14, minWidth: '22%' }]} onPress={() => setSeats(v => v === 3 ? 1 : v + 1)}>
          <Text style={[driverStyles.legend, design === 'new' && { color: '#476175' }]}>Місць</Text><Text style={[driverStyles.filterValue, design === 'new' && { color: '#163D54' }]}>{seats} ▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={driverStyles.filter} onPress={() => setPickupLimit(cycle)}>
          <Text style={driverStyles.legend}>Подача</Text><Text style={driverStyles.filterValue}>≤ {pickupLimit.toFixed(1)} км</Text>
        </TouchableOpacity>
        <TouchableOpacity style={driverStyles.filter} onPress={() => setFinalLimit(cycle)}>
          <Text style={driverStyles.legend}>Фінал</Text><Text style={driverStyles.filterValue}>≤ {finalLimit.toFixed(1)} км</Text>
        </TouchableOpacity>
        <TouchableOpacity style={driverStyles.filter} onPress={() => setUnique(v => !v)}>
          <Text style={driverStyles.legend}>Унікальні</Text><Text style={[driverStyles.filterValue, { color: unique ? '#36E88C' : '#8B9BAE' }, design === 'new' && { color: unique ? '#00854E' : '#526E80' }]}>{unique ? '✓' : '—'}</Text>
        </TouchableOpacity>
      </View>
      {view === 'map' && <RouteMapPreview detail={false} />}
      {view === 'list' && <View style={driverStyles.sortRow}>
        <Text style={[driverStyles.count, design === 'new' && { color: '#123B52' }]}>Заявки ({offers.length})</Text>
        <Text style={[driverStyles.sortLabel, design === 'new' && { color: '#476175' }]}>Сортування:</Text>
        <TouchableOpacity onPress={() => setSortBy('km')} style={[driverStyles.sortChip, sortBy === 'km' && driverStyles.sortActive, design === 'new' && { backgroundColor: '#173D52', borderRadius: 15 }]}><Text style={driverStyles.sortText}>₴/км</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setSortBy('hour')} style={[driverStyles.sortChip, sortBy === 'hour' && driverStyles.sortActive, design === 'new' && { backgroundColor: '#173D52', borderRadius: 15 }]}><Text style={driverStyles.sortText}>₴/год</Text></TouchableOpacity>
      </View>}
      {view === 'list' && <View style={{ marginBottom: 15, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#35CBA0', backgroundColor: design === 'new' ? '#FFFFFF' : '#142337' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: design === 'new' ? '#123B52' : '#E9F6F3', fontWeight: '900', fontSize: 15 }}>Живі тестові заявки ({liveRequests.length})</Text>
          <TouchableOpacity onPress={onRefresh} accessibilityLabel="Оновити заявки"><Text style={{ color: '#159D75', fontWeight: '900' }}>↻ Оновити</Text></TouchableOpacity>
        </View>
        <Text style={{ color: design === 'new' ? '#526E80' : '#9DB2C2', fontSize: 11, marginTop: 5 }}>Синхронізація між телефонами кожні 5 с · без розрахованого маршруту</Text>
        {liveRequests.length === 0 && <Text style={{ color: design === 'new' ? '#526E80' : '#9DB2C2', marginTop: 10 }}>Заявок немає. Створи маршрут у режимі пасажира на іншому телефоні.</Text>}
        {liveRequests.map(request => (
          <View key={request.id} style={{ borderTopWidth: 1, borderTopColor: design === 'new' ? '#D6E4EB' : '#29445A', marginTop: 10, paddingTop: 10 }}>
            <Text style={{ color: design === 'new' ? '#123B52' : '#F3F8FA', fontSize: 13, fontWeight: '800' }}>● {request.origin}</Text>
            <Text style={{ color: design === 'new' ? '#123B52' : '#F3F8FA', fontSize: 13, marginTop: 4 }}>◎ {request.destination}</Text>
            <Text style={{ color: '#1AAE80', fontSize: 12, fontWeight: '800', marginTop: 6 }}>{request.offeredRateUahPerKm} ₴/км · Очікує водія · {request.isMine ? 'Моя заявка' : 'Інший пристрій'}</Text>
          </View>
        ))}
      </View>}
      {view === 'list' && <Text style={{ color: design === 'new' ? '#456579' : '#9DB2C2', fontWeight: '800', marginBottom: 8 }}>Демонстраційні комбінації (не реальні заявки)</Text>}
      {view === 'list' && offers.length === 0 && <Text style={driverStyles.empty}>Немає варіантів для цих фільтрів.</Text>}
      {view === 'list' && offers.map(o => (
        <TouchableOpacity key={o.id} onPress={() => onSelectOffer(o)} activeOpacity={0.8} style={[driverStyles.offer, { borderColor: o.color }, design === 'new' && { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 2, paddingVertical: 17, marginBottom: 12 }]}>
          <View style={driverStyles.metrics}>
            <Text style={[driverStyles.total, design === 'new' && { color: '#123B52' }]}>₴{o.amount}</Text>
            <Text style={[driverStyles.gps, design === 'new' && { color: '#007A4B' }]}>GPS OK</Text>
            <Text style={[driverStyles.metric, design === 'new' && { color: '#173D52' }]}><Text style={[driverStyles.green, design === 'new' && { color: '#007C51' }]}>{perKm(o).toFixed(1)}</Text> ₴/км</Text>
            <Text style={driverStyles.metric}><Text style={[driverStyles.orange, design === 'new' && { color: '#B66A00' }]}>{Math.round(perHour(o)).toLocaleString('uk-UA')}</Text> ₴/год</Text>
          </View>
          <Text numberOfLines={1} style={[driverStyles.address, design === 'new' && { color: '#244B61' }]}>┄ {o.pickupKm.toFixed(1)} км →  🟢 {o.pickup}</Text>
          <Text numberOfLines={1} style={driverStyles.address}>      →  🔴 {o.dropoff}  ┄ {o.finalKm.toFixed(1)} км</Text>
          <View style={driverStyles.tripInfo}><Text style={[driverStyles.tripInfoText, design === 'new' && { color: '#526D7D' }]}>{o.distance.toFixed(1)} км</Text><Text style={driverStyles.tripInfoText}>≈ {o.minutes} хв</Text></View>
          {o.passengers.map(p => (
            <View key={p.name} style={driverStyles.person}>
              <View style={driverStyles.personAvatar}><Text style={driverStyles.personAvatarText}>{p.avatar}</Text></View>
              <Text numberOfLines={1} style={[driverStyles.personName, design === 'new' && { color: '#163D54' }]}>{p.name}</Text>
              <Text style={[driverStyles.acceptance, design === 'new' && { color: '#00854E' }]}>{p.acceptance}%</Text>
              <Text style={[driverStyles.noShow, design === 'new' && { color: '#B06B00' }]}>{p.noShow}%</Text>
              <Text style={[driverStyles.personKm, design === 'new' && { color: '#244B61' }]}>{p.km.toFixed(1)} км</Text>
              <Text style={[driverStyles.personFare, design === 'new' && { color: '#123B52' }]}>₴{p.fare}</Text>
              <TouchableOpacity accessibilityLabel={'Замінити ' + p.name} onPress={() => setReplaceName(p.name)}><Text style={[driverStyles.replace, design === 'new' && { color: '#123B52' }]}>⟳</Text></TouchableOpacity>
            </View>
          ))}
        </TouchableOpacity>
      ))}
      {replaceName && <View style={driverStyles.confirm}><Text style={driverStyles.confirmText}>Замінити маршрут пасажира {replaceName}?</Text><View style={driverStyles.confirmActions}><TouchableOpacity onPress={() => setReplaceName(null)}><Text style={driverStyles.confirmText}>Ні</Text></TouchableOpacity><TouchableOpacity onPress={() => { setReplaceName(null); }}><Text style={driverStyles.confirmYes}>Так</Text></TouchableOpacity></View></View>}
      <Text style={[driverStyles.disclaimer, design === 'new' && { color: '#456579' }]}>Демонстраційні комбінації — без реального бронювання.</Text>
    </View>
  );
}

function RouteMapPreview({ detail }: { detail: boolean }) {
  if (Platform.OS !== 'web') return <View style={detailStyles.mapPlaceholder}><Text style={detailStyles.mapText}>Веб-карта доступна у браузері.</Text></View>;
  const src = '/Routeshare/route-map.html' + (detail ? '?detail=1' : '');
  return <View style={{ height: detail ? 245 : 360, borderRadius: 9, overflow: 'hidden', borderWidth: 1, borderColor: '#526373' }}>
    {React.createElement('iframe' as any, { src, title: 'RouteShare OSM map', style: { width: '100%', height: '100%', border: 0 }, loading: 'lazy' })}
  </View>;
}

// Detail preview uses the same sample offers as the list. No real reservations or negotiations.
function DriverOfferDetail({ design, offer, increase, setIncrease, onBack }: {
  design: Design; offer: DriverOffer; increase: number; setIncrease: (value: number) => void; onBack: () => void;
}) {
  const [message, setMessage] = useState('');
  const updated = Math.round(offer.amount * (1 + increase / 100));
  return (
    <View style={[detailStyles.wrap, design === 'new' && { backgroundColor: '#E9F0F6', padding: 10, borderRadius: 16 }]}>
      <View style={[detailStyles.head, design === 'new' && { backgroundColor: '#173D52', borderRadius: 15, padding: 10 }]}>
        <Text style={detailStyles.title}>Заявка</Text>
        <Text style={detailStyles.amount}>₴{updated}</Text>
        <Text style={detailStyles.stat}><Text style={detailStyles.km}>{(updated / offer.distance).toFixed(1)}</Text> ₴/км</Text>
        <Text style={detailStyles.stat}><Text style={detailStyles.hour}>{Math.round(updated / offer.minutes * 60)}</Text> ₴/год</Text>
      </View>
      <View style={[detailStyles.frame, { borderColor: offer.color }, design === 'new' && { backgroundColor: '#173D52', borderRadius: 20, borderWidth: 2 }]}>
        <Text style={detailStyles.segment}>┄ {offer.pickupKm.toFixed(1)} км → Перша посадка</Text>
        {offer.passengers.map((p, index) => (
          <View key={p.name} style={detailStyles.passenger}>
            <View style={detailStyles.personTop}>
              <View style={driverStyles.personAvatar}><Text style={driverStyles.personAvatarText}>{p.avatar}</Text></View>
              <Text style={detailStyles.name}>{p.name}</Text>
              <Text style={detailStyles.rating}>{p.acceptance}% · неявка {p.noShow}%</Text>
              <Text style={detailStyles.fare}>₴{p.fare}</Text>
            </View>
            <Text style={detailStyles.address}>↗ Посадка: {index === 0 ? offer.pickup : 'Адреса посадки не задана (демо)'}</Text>
            <Text style={detailStyles.address}>↘ Висадка: {index === offer.passengers.length - 1 ? offer.dropoff : 'Адреса висадки не задана (демо)'}</Text>
            <Text style={detailStyles.distance}>{p.km.toFixed(1)} км</Text>
          </View>
        ))}
        <Text style={detailStyles.segment}>Остання висадка → ┄ {offer.finalKm.toFixed(1)} км до фінішу водія</Text>
      </View>
      <RouteMapPreview detail />
      <View style={detailStyles.priceRow}>
        <Text style={detailStyles.priceLabel}>Підвищення тарифу</Text>
        {[0,10,20,30,40,50].map(value => (
          <TouchableOpacity key={value} onPress={() => { setIncrease(value); setMessage(''); }} style={[detailStyles.priceChip, increase === value && detailStyles.priceActive]}>
            <Text style={detailStyles.priceText}>{value === 0 ? '—' : '+' + value + '%'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={detailStyles.actions}>
        <TouchableOpacity onPress={onBack} style={detailStyles.back}><Text style={detailStyles.actionText}>Назад</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => setMessage('Прийняття та запит нової ціни ще не підключені до сервера.')} style={detailStyles.accept}><Text style={detailStyles.actionText}>{increase ? 'Запропонувати' : 'Прийняти'}</Text></TouchableOpacity>
      </View>
      {!!message && <Text style={detailStyles.warning}>{message}</Text>}
      <Text style={detailStyles.warning}>Демо-заявка · без бронювання та реальних адрес усіх пасажирів</Text>
    </View>
  );
}
const detailStyles = StyleSheet.create({
  wrap: { gap: 10 }, head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 },
  title: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }, amount: { color: '#FFFFFF', fontSize: 23, fontWeight: '900' },
  stat: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' }, km: { color: '#3CF28C', fontSize: 15, fontWeight: '900' },
  hour: { color: '#FFA72B', fontSize: 15, fontWeight: '900' }, frame: { borderWidth: 1, borderRadius: 11, padding: 10, gap: 7 },
  segment: { color: '#BFCBDA', fontSize: 11 }, passenger: { borderTopWidth: 1, borderTopColor: '#334050', paddingTop: 6, gap: 3 },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 7 }, name: { color: '#FFFFFF', fontSize: 12, flex: 1, fontWeight: '700' },
  rating: { color: '#B8C8D6', fontSize: 10 }, fare: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  address: { color: '#E1E9F2', fontSize: 11, marginLeft: 28 }, distance: { color: '#B5C6D8', fontSize: 10, textAlign: 'right' },
  mapPlaceholder: { height: 165, backgroundColor: '#172737', borderWidth: 1, borderColor: '#34485C', borderRadius: 10, justifyContent: 'center', alignItems: 'center', padding: 18, gap: 9 },
  mapTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, mapText: { color: '#AFC0D1', fontSize: 11, textAlign: 'center' },
  priceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, alignItems: 'center' }, priceLabel: { color: '#FFFFFF', fontSize: 11, width: '100%' },
  priceChip: { paddingVertical: 7, paddingHorizontal: 9, borderWidth: 1, borderColor: '#506073', borderRadius: 7 },
  priceActive: { borderColor: '#31DE7D', backgroundColor: '#16412C' }, priceText: { color: '#FFFFFF', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 10 }, back: { flex: 1, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#67798A', borderRadius: 8 },
  accept: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#1E9B60', borderRadius: 8 },
  actionText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' }, warning: { color: '#AFC0D1', fontSize: 10 },
});

const driverStyles = StyleSheet.create({
  wrap: { gap: 8 }, heading: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', marginBottom: 6 },
  preview: { color: '#FFBD68', fontSize: 10 }, filters: { flexDirection: 'row', gap: 5, marginBottom: 5 },
  filter: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: '#526373', borderRadius: 7, paddingVertical: 8, alignItems: 'center' },
  legend: { color: '#B5C2CF', fontSize: 10, marginBottom: 4 }, filterValue: { color: '#F6F8FB', fontSize: 11, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 },
  count: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', flex: 1 },
  sortLabel: { color: '#9CAFC1', fontSize: 10 },
  sortChip: { paddingHorizontal: 7, paddingVertical: 6, borderWidth: 1, borderColor: '#536374', borderRadius: 9 },
  sortActive: { borderColor: '#21D775', backgroundColor: '#103628' }, sortText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  offer: { backgroundColor: '#101B28', borderWidth: 1, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 9, marginBottom: 5 },
  metrics: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, marginBottom: 7 },
  total: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' }, gps: { color: '#2FEF82', fontSize: 9, fontWeight: '800' },
  metric: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' }, green: { color: '#32F183', fontSize: 17, fontWeight: '900' },
  orange: { color: '#FFA52B', fontSize: 17, fontWeight: '900' }, address: { color: '#E1E9F0', fontSize: 10, marginBottom: 3 },
  tripInfo: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginBottom: 4 },
  tripInfoText: { color: '#A8B9C7', fontSize: 10 },
  person: { borderTopWidth: 1, borderTopColor: '#2A3948', flexDirection: 'row', alignItems: 'center', minHeight: 30, gap: 4 },
  personAvatar: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#32485D', alignItems: 'center', justifyContent: 'center' },
  personAvatarText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' }, personName: { flex: 1, color: '#F5F7FA', fontSize: 11 },
  acceptance: { color: '#3FE985', fontSize: 11, fontWeight: '700', width: 33, textAlign: 'right' },
  noShow: { color: '#FFCB48', fontSize: 11, fontWeight: '700', width: 25, textAlign: 'right' },
  personKm: { color: '#D5DEE8', fontSize: 10, width: 42, textAlign: 'right' },
  personFare: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', width: 43, textAlign: 'right' },
  replace: { color: '#F1F5F9', fontSize: 23, marginLeft: 3 }, empty: { color: '#ABB8C7', padding: 15 },
  confirm: { backgroundColor: '#253346', borderRadius: 12, padding: 14, gap: 12 },
  confirmText: { color: '#FFFFFF', fontSize: 13 }, confirmActions: { flexDirection: 'row', justifyContent: 'space-around' },
  confirmYes: { color: '#45E991', fontWeight: '900' }, disclaimer: { color: '#8A9BAB', fontSize: 10, marginTop: 4 },
});

function TestRequestCard({ request, onCancel }: { request: TestPassengerRequest; onCancel: (id: string) => void }) {
  const departure = new Date(request.departureStart).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.testRequestCard}>
      <View style={styles.testRequestHeader}>
        <Text style={styles.testRequestBadge}>ТЕСТ · {request.isMine ? 'ТВОЯ ЗАЯВКА' : 'ІНШИЙ ПРИСТРІЙ'}</Text>
        <Text style={styles.testRequestRate}>{request.offeredRateUahPerKm} грн/км</Text>
      </View>
      <Text style={styles.testRequestRoute}>{request.origin} → {request.destination}</Text>
      <Text style={styles.testRequestMeta}>Виїзд: {departure}</Text>
      {request.isMine && <TouchableOpacity style={styles.cancelRequestButton} onPress={() => onCancel(request.id)}><Text style={styles.cancelRequestText}>Скасувати заявку</Text></TouchableOpacity>}
    </View>
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
  rateRow: { borderTopWidth: 1, borderTopColor: '#E4EAF0', marginTop: 10, paddingTop: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rateLabel: { color: '#8392A5', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  rateInput: { color: '#12263A', fontSize: 15, fontWeight: '800', minWidth: 75, textAlign: 'right', paddingVertical: 4 },
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
  testRequestCard: { backgroundColor: '#142337', borderRadius: 16, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#29445A' },
  testRequestHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  testRequestBadge: { color: '#70DCC8', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  testRequestRate: { color: '#55D6BE', fontSize: 12, fontWeight: '900' },
  testRequestRoute: { color: '#F1F5F9', fontSize: 16, fontWeight: '800', marginTop: 11 },
  testRequestMeta: { color: '#91A2B6', fontSize: 11, marginTop: 6 },
  cancelRequestButton: { alignSelf: 'flex-start', marginTop: 11, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: '#3A2630' },
  cancelRequestText: { color: '#FF9EAD', fontSize: 10, fontWeight: '800' },
  secondaryButton: { borderWidth: 1, borderColor: '#31536A', borderRadius: 11, padding: 12, alignItems: 'center', marginTop: 8 },
  secondaryButtonText: { color: '#70DCC8', fontSize: 12, fontWeight: '800' },
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
