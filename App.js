import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
  Image,
} from 'react-native';
import { Camera, useCameraPermissions } from 'expo-camera';
import { supabase } from './supabaseConfig';
import QRCode from 'react-native-qrcode-svg';

export default function App() {
  const [isLogin, setIsLogin] = useState(true);
  const [nama, setNama] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('murid');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(null);
  const [screen, setScreen] = useState('home');

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scannedMurid, setScannedMurid] = useState(null);
  const [jumlahBayar, setJumlahBayar] = useState('');
  const [riwayat, setRiwayat] = useState([]);
  const [rekap, setRekap] = useState([]);
  const [totalRekap, setTotalRekap] = useState(0);

  const [emailMuridTopup, setEmailMuridTopup] = useState('');
  const [jumlahTopup, setJumlahTopup] = useState('');

  // --- STATE KHUSUS PREORDER MAKANAN (KANTIN) ---
  const [activeTabPreorder, setActiveTabPreorder] = useState('menu'); // 'menu' | 'status'
  const [catatanPesanan, setCatatanPesanan] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [preorderList, setPreorderList] = useState([]);

  // Daftar Menu Kantin
  const menuKantin = [
    { id: '1', nama: 'Nasi Goreng Kantin', harga: 12000, e: '🍳' },
    { id: '2', nama: 'Mie Ayam Spesial', harga: 15000, e: '🍜' },
    { id: '3', nama: 'Ayam Geprek + Nasi', harga: 15000, e: '🍗' },
    { id: '4', nama: 'Es Teh Manis', harga: 4000, e: '🥤' },
    { id: '5', nama: 'Jus Alpukat', harga: 8000, e: '🧃' },
  ];

  // ====== FUNGSI REGISTER ======
  const handleRegister = async () => {
    if (!nama || !email || !password) {
      Alert.alert('Error', 'Semua kolom wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        Alert.alert('Gagal Daftar', error.message);
        return;
      }
      const userId = data.user.id;
      const { error: insertError } = await supabase
        .from('users')
        .insert([{ id: userId, nama: nama, email: email, saldo: 100000, role: role }]);

      if (insertError) {
        Alert.alert('Gagal Simpan Data', insertError.message);
        return;
      }
      Alert.alert('Berhasil', `Akun ${role} berhasil dibuat!`);
      setIsLogin(true);
    } catch (err) {
      Alert.alert('Error', 'Terjadi kesalahan saat pendaftaran');
    } finally {
      setLoading(false);
    }
  };

  // ====== FUNGSI LOGIN ======
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Email dan password wajib diisi');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Gagal Login', error.message);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        Alert.alert('Gagal Ambil Data', profileError.message);
        return;
      }

      setUserData(profile);
    } catch (err) {
      Alert.alert('Error', 'Terjadi kesalahan sistem saat login');
    } finally {
      setLoading(false);
    }
  };

  // ====== FUNGSI LOGOUT ======
  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserData(null);
    setEmail('');
    setPassword('');
    setScreen('home');
    setScanned(false);
    setScannedMurid(null);
    setJumlahBayar('');
    setRiwayat([]);
    setRekap([]);
    setTotalRekap(0);
    setEmailMuridTopup('');
    setJumlahTopup('');
    setPreorderList([]);
    setSelectedItem(null);
  };

  // ====== RIWAYAT TRANSAKSI MURID ======
  const handleLihatRiwayat = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('murid_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Gagal', error.message);
        return;
      }
      setRiwayat(data);
      setScreen('riwayat');
    } finally {
      setLoading(false);
    }
  };

  // ====== SCAN QR CODE (KANTIN) ======
  const handleBarcodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);

    try {
      const { data: murid, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', data)
        .eq('role', 'murid')
        .single();

      if (error || !murid) {
        Alert.alert('QR Tidak Valid', 'QR ini bukan QR murid yang terdaftar', [
          { text: 'OK', onPress: () => setScanned(false) },
        ]);
        return;
      }

      setScannedMurid(murid);
      setScreen('confirm');
    } catch (err) {
      Alert.alert('Error', 'Gagal memproses QR Code');
      setScanned(false);
    }
  };

  // ====== PROSES PEMBAYARAN LANGSUNG (LIMIT HUTANG -Rp100.000) ======
  const handleProsesPembayaran = async () => {
    const jumlah = parseInt(jumlahBayar);
    if (!jumlah || jumlah <= 0) {
      Alert.alert('Error', 'Masukkan jumlah yang valid');
      return;
    }

    const saldoBaru = scannedMurid.saldo - jumlah;
    const LIMIT_HUTANG = -100000;

    if (saldoBaru < LIMIT_HUTANG) {
      Alert.alert(
        'Limit Hutang Tercapai! ❌',
        `Transaksi ditolak. ${scannedMurid.nama} telah melewati batas maksimal hutang sebesar Rp100.000 (Sisa saldo/limit saat ini: Rp${scannedMurid.saldo.toLocaleString('id-ID')})`
      );
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ saldo: saldoBaru })
        .eq('id', scannedMurid.id);

      if (updateError) {
        Alert.alert('Gagal', updateError.message);
        return;
      }

      const { error: transError } = await supabase.from('transactions').insert([
        {
          murid_id: scannedMurid.id,
          murid_nama: scannedMurid.nama,
          kantin_id: userData.id,
          jumlah: jumlah,
        },
      ]);

      if (transError) {
        Alert.alert('Gagal Catat Transaksi', transError.message);
        return;
      }

      const statusPesan = saldoBaru < 0 ? ' (Memiliki Hutang)' : '';
      Alert.alert(
        'Pembayaran Berhasil' + statusPesan,
        `Rp${jumlah.toLocaleString('id-ID')} dari ${scannedMurid.nama}\nSisa saldo: Rp${saldoBaru.toLocaleString('id-ID')}`
      );
      setScanned(false);
      setScannedMurid(null);
      setJumlahBayar('');
      setScreen('home');
    } finally {
      setLoading(false);
    }
  };

  // ====== LOGIKA PREORDER MAKANAN (MURID) ======
  const handlePesanPreorder = async () => {
    if (!selectedItem) {
      Alert.alert('Peringatan', 'Pilih menu makanan terlebih dahulu');
      return;
    }

    if (userData.saldo < selectedItem.harga) {
      Alert.alert('Saldo Tidak Cukup', 'Saldo QPay kamu tidak mencukupi untuk melakukan preorder ini.');
      return;
    }

    const sisaSaldo = userData.saldo - selectedItem.harga;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ saldo: sisaSaldo })
        .eq('id', userData.id);

      if (error) {
        Alert.alert('Gagal Transaksi', error.message);
        return;
      }

      setUserData({ ...userData, saldo: sisaSaldo });

      const pesananBaru = {
        id: Date.now().toString(),
        item: selectedItem.nama,
        harga: selectedItem.harga,
        catatan: catatanPesanan || 'Tidak ada catatan',
        status: 'Menunggu Konfirmasi Kantin',
        kodeToken: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
        waktu: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setPreorderList([pesananBaru, ...preorderList]);
      setSelectedItem(null);
      setCatatanPesanan('');
      Alert.alert('Preorder Berhasil!', `Pesanan ${pesananBaru.item} diproses. Saldo dipotong Rp${pesananBaru.harga.toLocaleString('id-ID')}`);
      setActiveTabPreorder('status');
    } finally {
      setLoading(false);
    }
  };

  // ====== REKAP PENJUALAN KANTIN ======
  const handleLihatRekap = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('kantin_id', userData.id)
        .order('created_at', { ascending: false });

      if (error) {
        Alert.alert('Gagal', error.message);
        return;
      }
      setRekap(data);
      const total = data.reduce((sum, item) => sum + item.jumlah, 0);
      setTotalRekap(total);
      setScreen('rekap');
    } finally {
      setLoading(false);
    }
  };

  // ====== TOP UP SALDO (ADMIN) ======
  const handleTopUp = async () => {
    const jumlah = parseInt(jumlahTopup);
    if (!emailMuridTopup || !jumlah || jumlah <= 0) {
      Alert.alert('Error', 'Isi email murid dan jumlah top up dengan benar');
      return;
    }

    setLoading(true);
    try {
      const { data: murid, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('email', emailMuridTopup.trim())
        .eq('role', 'murid')
        .single();

      if (findError || !murid) {
        Alert.alert('Gagal', 'Murid dengan email tersebut tidak ditemukan');
        return;
      }

      const saldoBaru = murid.saldo + jumlah;
      const { error: updateError } = await supabase
        .from('users')
        .update({ saldo: saldoBaru })
        .eq('id', murid.id);

      if (updateError) {
        Alert.alert('Gagal', updateError.message);
        return;
      }

      Alert.alert(
        'Top Up Berhasil',
        `Rp${jumlah.toLocaleString('id-ID')} ditambahkan ke ${murid.nama}\nSaldo baru: Rp${saldoBaru.toLocaleString('id-ID')}`
      );
      setEmailMuridTopup('');
      setJumlahTopup('');
      setScreen('home');
    } finally {
      setLoading(false);
    }
  };

  // ====== HALAMAN LOGIN / REGISTER ======
  if (!userData) {
    return (
      <ScrollView
        contentContainerStyle={styles.authContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.authCard}>
          <Image
            source={require('./assets/qpay.jpeg')}
            style={styles.authLogo}
            resizeMode="contain"
          />
          <Text style={styles.appTitle}>QPay</Text>
          <Text style={styles.appSubTitle}>
            {isLogin ? 'Masuk ke akun digital Anda' : 'Daftar akun QPay baru'}
          </Text>

          {!isLogin && (
            <TextInput
              style={styles.input}
              placeholder="Nama Lengkap"
              value={nama}
              onChangeText={setNama}
              placeholderTextColor="#94a3b8"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#94a3b8"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor="#94a3b8"
          />

          {!isLogin && (
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'murid' && styles.roleBtnActive]}
                onPress={() => setRole('murid')}
              >
                <Text style={[styles.roleText, role === 'murid' && styles.roleTextActive]}>
                  Murid
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'kantin' && styles.roleBtnActive]}
                onPress={() => setRole('kantin')}
              >
                <Text style={[styles.roleText, role === 'kantin' && styles.roleTextActive]}>
                  Kantin
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleBtn, role === 'admin' && styles.roleBtnActive]}
                onPress={() => setRole('admin')}
              >
                <Text style={[styles.roleText, role === 'admin' && styles.roleTextActive]}>
                  Admin
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={isLogin ? handleLogin : handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Memproses...' : isLogin ? 'Masuk' : 'Daftar'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsLogin(!isLogin)}
            style={styles.switchAuth}
          >
            <Text style={styles.switchAuthText}>
              {isLogin ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ====== HOME MURID ======
  if (userData && userData.role === 'murid') {
    if (screen === 'riwayat') {
      return (
        <ScrollView contentContainerStyle={styles.screenContainer}>
          <Text style={styles.pageTitle}>Riwayat Transaksi</Text>
          {riwayat.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>🧾</Text>
              <Text style={styles.emptyStateText}>Belum ada transaksi</Text>
            </View>
          )}
          {riwayat.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View style={styles.historyBar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyAmount}>
                  -Rp{item.jumlah.toLocaleString('id-ID')}
                </Text>
                <Text style={styles.historyDate}>
                  {new Date(item.created_at).toLocaleString('id-ID')}
                </Text>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setScreen('home')}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Kembali</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (screen === 'qrcode') {
      return (
        <View style={styles.screenContainer}>
          <View style={styles.idCard}>
            <Text style={styles.idCardApp}>QR DIGITAL MURID</Text>
            <View style={styles.avatarCircleLg}>
              <Text style={styles.avatarTextLg}>
                {userData.nama.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.idCardName}>{userData.nama}</Text>
            <View style={styles.idCardRolePill}>
              <Text style={styles.idCardRole}>MURID</Text>
            </View>
            <View style={styles.qrWrapper}>
              <QRCode value={userData.id} size={180} />
            </View>
            <Text style={styles.idCardId}>
              ID: {userData.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setScreen('home')}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>← Kembali</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Layar Preorder Makanan (Murid)
    if (screen === 'preorder') {
      return (
        <View style={{ flex: 1, backgroundColor: '#f8fafc', paddingTop: 40, paddingHorizontal: 20 }}>
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTabPreorder === 'menu' && styles.tabActive]}
              onPress={() => setActiveTabPreorder('menu')}
            >
              <Text style={activeTabPreorder === 'menu' ? styles.tabTextActive : styles.tabText}>Pilih Menu</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabButton, activeTabPreorder === 'status' && styles.tabActive]}
              onPress={() => setActiveTabPreorder('status')}
            >
              <Text style={activeTabPreorder === 'status' ? styles.tabTextActive : styles.tabText}>
                Pesanan Saya ({preorderList.length})
              </Text>
            </TouchableOpacity>
          </View>

          {activeTabPreorder === 'menu' ? (
            <ScrollView>
              <Text style={styles.sectionTitle}>Menu Kantin Hari Ini</Text>
              {menuKantin.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.menuItemCard, selectedItem?.id === item.id && styles.menuItemSelected]}
                  onPress={() => setSelectedItem(item)}
                >
                  <Text style={{ fontSize: 30, marginRight: 10 }}>{item.e}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0f172a' }}>{item.nama}</Text>
                    <Text style={{ color: '#2563eb', fontWeight: '600' }}>Rp {item.harga.toLocaleString('id-ID')}</Text>
                  </View>
                </TouchableOpacity>
              ))}

              {selectedItem && (
                <View style={styles.checkoutBox}>
                  <Text style={{ fontWeight: 'bold', marginBottom: 5, color: '#0f172a' }}>Pesanan: {selectedItem.nama}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Catatan (misal: Jangan pedas / tanpa es)"
                    placeholderTextColor="#94a3b8"
                    value={catatanPesanan}
                    onChangeText={setCatatanPesanan}
                  />
                  <TouchableOpacity style={styles.primaryButton} onPress={handlePesanPreorder}>
                    <Text style={styles.primaryButtonText}>Bayar & Preorder Sekarang</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          ) : (
            <ScrollView>
              <Text style={styles.sectionTitle}>Daftar Pesanan Preorder</Text>
              {preorderList.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#888', marginTop: 20 }}>Belum ada pesanan aktif</Text>
              ) : (
                preorderList.map((p) => (
                  <View key={p.id} style={styles.orderStatusCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: 'bold', fontSize: 16, color: '#0f172a' }}>{p.item}</Text>
                      <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>{p.kodeToken}</Text>
                    </View>
                    <Text style={{ color: '#555', marginTop: 4 }}>Catatan: {p.catatan}</Text>
                    <Text style={{ color: '#16a34a', fontWeight: '600', marginTop: 6 }}>Status: {p.status}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={[styles.backButton, { marginBottom: 20 }]} onPress={() => setScreen('home')}>
            <Text style={styles.backButtonText}>← Kembali ke Menu Utama</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <ScrollView contentContainerStyle={styles.screenContainer}>
        <View style={styles.newHeader}>
          <View style={styles.headerLeft}>
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {userData.nama.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={styles.headerGreeting}>Halo, {userData.nama} 👋</Text>
              <Text style={styles.headerSubGreeting}>Akun Murid QPay</Text>
            </View>
          </View>
        </View>

        <View style={styles.digitalCard}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardBrand}>QPay Digital</Text>
            <Text style={styles.cardChip}>💳</Text>
          </View>
          <View>
            <Text style={styles.balanceLabelNew}>Saldo / Sisa Limit QPay</Text>
            <Text
              style={[
                styles.balanceAmountNew,
                userData.saldo < 0 && { color: '#f87171' },
              ]}
            >
              Rp{userData.saldo.toLocaleString('id-ID')}
            </Text>
          </View>
          <View style={styles.cardBottomRow}>
            <Text style={styles.cardHolder}>{userData.nama}</Text>
            <Text
              style={[
                styles.cardValid,
                userData.saldo < 0 && { color: '#f87171' },
              ]}
            >
              {userData.saldo < 0 ? 'Ada Hutang' : 'Active'}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Akses Cepat</Text>
        <View style={styles.quickAccessGrid}>
          <TouchableOpacity
            style={styles.quickMenuCard}
            onPress={() => setScreen('qrcode')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconBg, { backgroundColor: '#eff6ff' }]}>
              <Text style={{ fontSize: 22 }}>🔲</Text>
            </View>
            <Text style={styles.quickMenuText}>QR Saya</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickMenuCard}
            onPress={() => setScreen('preorder')}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconBg, { backgroundColor: '#f0fdf4' }]}>
              <Text style={{ fontSize: 22 }}>🍜</Text>
            </View>
            <Text style={styles.quickMenuText}>Preorder</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickMenuCard}
            onPress={handleLihatRiwayat}
            activeOpacity={0.8}
          >
            <View style={[styles.quickIconBg, { backgroundColor: '#fdf4ff' }]}>
              <Text style={{ fontSize: 22 }}>📜</Text>
            </View>
            <Text style={styles.quickMenuText}>Riwayat</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ====== HOME KANTIN ======
  if (userData && userData.role === 'kantin') {
    if (screen === 'scan') {
      if (!permission) return <View />;
      if (!permission.granted) {
        return (
          <View style={styles.screenContainer}>
            <Text style={{ textAlign: 'center', marginBottom: 20 }}>
              Kamera membutuhkan izin akses
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={requestPermission}
            >
              <Text style={styles.primaryButtonText}>Berikan Izin Kamera</Text>
            </TouchableOpacity>
          </View>
        );
      }

      return (
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <Camera
            style={StyleSheet.absoluteFillObject}
            onBarCodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          <View style={styles.cameraOverlay}>
            <Text style={styles.cameraText}>Arahkan Kamera ke QR Code Murid</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setScreen('home')}
            >
              <Text style={styles.backButtonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (screen === 'confirm' && scannedMurid) {
      return (
        <ScrollView
          contentContainerStyle={styles.screenContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.pageTitle}>Konfirmasi Pembayaran</Text>
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Nama Murid:</Text>
            <Text style={styles.cardValue}>{scannedMurid.nama}</Text>

            <Text style={styles.cardLabel}>Sisa Saldo / Limit Murid:</Text>
            <Text
              style={[
                styles.cardValue,
                scannedMurid.saldo < 0 && { color: '#ef4444' },
              ]}
            >
              Rp{scannedMurid.saldo.toLocaleString('id-ID')}
            </Text>

            <TextInput
              style={[styles.input, { marginTop: 15 }]}
              placeholder="Jumlah Pembayaran (Rp)"
              value={jumlahBayar}
              onChangeText={setJumlahBayar}
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleProsesPembayaran}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {loading
                  ? 'Memproses...'
                  : 'Proses Bayar (Bisa Hutang max 100rb)'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                setScanned(false);
                setScannedMurid(null);
                setScreen('home');
              }}
            >
              <Text style={styles.backButtonText}>Batal</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    if (screen === 'rekap') {
      return (
        <ScrollView contentContainerStyle={styles.screenContainer}>
          <Text style={styles.pageTitle}>Rekap Penjualan</Text>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Total Pendapatan:</Text>
            <Text style={styles.totalRekapText}>
              Rp{totalRekap.toLocaleString('id-ID')}
            </Text>
          </View>

          {rekap.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>📊</Text>
              <Text style={styles.emptyStateText}>
                Belum ada riwayat transaksi
              </Text>
            </View>
          )}

          {rekap.map((item) => (
            <View key={item.id} style={styles.historyCard}>
              <View
                style={[styles.historyBar, { backgroundColor: '#10b981' }]}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.historyName}>
                  {item.murid_nama || 'Murid'}
                </Text>
                <Text style={styles.historyAmount}>
                  +Rp{item.jumlah.toLocaleString('id-ID')}
                </Text>
                <Text style={styles.historyDate}>
                  {new Date(item.created_at).toLocaleString('id-ID')}
                </Text>
              </View>
            </View>
          ))}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setScreen('home')}
          >
            <Text style={styles.backButtonText}>← Kembali</Text>
          </TouchableOpacity>
        </ScrollView>
      );
    }

    return (
      <View style={styles.screenContainer}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Kantin QPay 👋</Text>
          <Text style={styles.userName}>{userData.nama}</Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => {
            setScanned(false);
            setScreen('scan');
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>📷 Scan QR Murid</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleLihatRekap}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>
            📊 Lihat Rekap Penjualan
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ====== HOME ADMIN ======
  if (userData && userData.role === 'admin') {
    return (
      <ScrollView
        contentContainerStyle={styles.screenContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Admin Panel 🛠️</Text>
          <Text style={styles.userName}>{userData.nama}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Top Up Saldo Murid</Text>

          <TextInput
            style={styles.input}
            placeholder="Email Murid"
            value={emailMuridTopup}
            onChangeText={setEmailMuridTopup}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor="#94a3b8"
          />

          <TextInput
            style={styles.input}
            placeholder="Jumlah Top Up (Rp)"
            value={jumlahTopup}
            onChangeText={setJumlahTopup}
            keyboardType="numeric"
            placeholderTextColor="#94a3b8"
          />

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleTopUp}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Memproses...' : 'Proses Top Up'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Keluar</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  authContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f1f5f9',
  },
  authCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  authLogo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  appSubTitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    marginBottom: 12,
    backgroundColor: '#f8fafc',
    color: '#0f172a',
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 2,
    backgroundColor: '#f8fafc',
  },
  roleBtnActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  roleText: {
    color: '#64748b',
    fontWeight: '600',
  },
  roleTextActive: {
    color: '#ffffff',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '600',
  },
  switchAuth: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchAuthText: {
    color: '#2563eb',
    fontWeight: '600',
  },
  screenContainer: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#f8fafc',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    marginBottom: 20,
  },
  greeting: {
    fontSize: 14,
    color: '#64748b',
  },
  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#0f172a',
  },
  cardLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  cardValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#0f172a',
  },
  idCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  idCardApp: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 16,
  },
  avatarCircleLg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarTextLg: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  idCardName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  idCardRolePill: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  idCardRole: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 'bold',
  },
  qrWrapper: {
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  idCardId: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 12,
  },
  backButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  logoutButton: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 12,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '600',
  },
  historyCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  historyBar: {
    width: 4,
    height: '100%',
    backgroundColor: '#ef4444',
    borderRadius: 2,
    marginRight: 12,
  },
  historyAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  historyDate: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#94a3b8',
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  cameraText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  totalRekapText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
  },
  newHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerAvatarText: {
    color: '#2563eb',
    fontWeight: 'bold',
    fontSize: 18,
  },
  headerGreeting: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  headerSubGreeting: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  digitalCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 22,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardBrand: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
  cardChip: {
    fontSize: 24,
  },
  balanceLabelNew: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 4,
  },
  balanceAmountNew: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  cardBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHolder: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '600',
  },
  cardValid: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 12,
  },
  quickAccessGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickMenuCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickMenuText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  tabButton: {
    flex: 1,
    padding: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#cbd5e1',
    alignItems: 'center',
  },
  tabActive: {
    borderBottomColor: '#2563eb',
  },
  tabText: {
    color: '#64748b',
  },
  tabTextActive: {
    color: '#2563eb',
    fontWeight: 'bold',
  },
  menuItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  menuItemSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  checkoutBox: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  orderStatusCard: {
    padding: 15,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
});