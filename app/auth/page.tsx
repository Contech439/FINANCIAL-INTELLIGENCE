'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../utils/supabase/client'
import Link from 'next/link'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [view, setView] = useState<'login' | 'register'>('login')
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [licenseCode, setLicenseCode] = useState('') 
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (view === 'register') {
        // 1. CEK KODE LISENSI KE DATABASE
        const { data: license, error: licenseError } = await supabase
            .from('license_keys')
            .select('*')
            .eq('code', licenseCode)
            .eq('status', 'active')
            .single()

        if (licenseError || !license) {
            throw new Error("⛔ Kode Lisensi TIDAK DITEMUKAN atau Salah.")
        }

        // 2. CEK KUOTA
        if (license.used_count >= license.max_users) {
            throw new Error(`⛔ Kuota Penuh! Lisensi ini hanya berlaku untuk ${license.max_users} orang. Hubungi Admin Perusahaan Anda.`)
        }

        // 3. DAFTARKAN USER BARU
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName }
          }
        })
        if (signUpError) throw signUpError

        // --- SOLUSI: PANGGIL RPC FUNCTION UNTUK MENGUPDATE COUNTER ---
        const { error: rpcError } = await supabase.rpc('increment_license_usage', { license_code: license.code })
        if (rpcError) {
            console.error("Gagal mengupdate counter lisensi:", rpcError);
            // Anda bisa memutuskan untuk tetap melanjutkan atau menggagalkan registrasi
            // Untuk sekarang, kita anggap ini adalah kesalahan internal, tapi user sudah terdaftar
            setMessage('Registrasi Berhasil! (Namun ada masalah saat mengupdate kuota. Hubungi Admin.)')
            // throw new Error("Registrasi berhasil, tetapi gagal mengupdate kuota lisensi.")
        } else {
            setMessage(`Registrasi Berhasil! Selamat datang tim ${license.organization_name}.`)
        }
        
        setView('login') // Pindah ke Login
      } else {
        // Login Biasa
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (error: any) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      
      <div className="mb-8 text-center animate-fade-in-up">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Powered By</p>
          <img 
            src="/logo-contech.png" 
            alt="Contech Labs" 
            className="h-24 w-auto mx-auto drop-shadow-xl hover:scale-105 transition duration-300"
          />
      </div>

      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-2xl border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-orange-500 to-red-600"></div>

        <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {view === 'login' ? 'Selamat Datang' : 'Aktivasi Lisensi'}
            </h2>
            <p className="mt-2 text-sm text-gray-600">
                {view === 'login' ? 'Masuk ke Finance AI Dashboard' : 'Masukkan Kode Lisensi Perusahaan'}
            </p>
        </div>

        {message && (
          <div className={`p-4 text-sm rounded-lg font-medium text-center border ${message.includes('Berhasil') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {message}
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleAuth}>
          
          {view === 'register' && (
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 mb-4 animate-pulse-once">
                <label className="block text-xs font-bold text-orange-800 uppercase mb-1">Kode Lisensi / Voucher *</label>
                <input 
                    type="text" 
                    required 
                    className="w-full px-4 py-2 border border-orange-300 rounded focus:ring-2 focus:ring-orange-500 focus:outline-none text-orange-900 font-mono text-center tracking-widest uppercase" 
                    placeholder="CONTOH: STARTER-PACK" 
                    value={licenseCode} 
                    onChange={(e) => setLicenseCode(e.target.value.toUpperCase())} 
                />
                <p className="text-[10px] text-orange-600 mt-1 text-center">
                    *Masukkan kode yang diberikan oleh Vendor.
                </p>
            </div>
          )}

          <div className="space-y-4">
            {view === 'register' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition" placeholder="Nama Anda" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Bisnis</label>
              <input type="email" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition" placeholder="nama@perusahaan.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none transition" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition shadow-md disabled:opacity-70">
              {loading ? 'Memproses...' : (view === 'login' ? 'Masuk Dashboard' : 'Verifikasi & Daftar')}
          </button>
        </form>

        <div className="text-center mt-4">
            <button onClick={() => { setView(view === 'login' ? 'register' : 'login'); setMessage(null) }} className="font-medium text-orange-600 hover:text-orange-500 transition">
                {view === 'login' ? 'Punya Kode Lisensi? Aktivasi di sini' : 'Sudah punya akun? Login'}
            </button>
        </div>
      </div>
      
      <div className="mt-8 text-center text-xs text-gray-400">
        &copy; 2026 Contech Labs Technology. Secure System.
      </div>
    </div>
  )
}