'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ... (Bagian StatCard TETAP SAMA, tidak perlu diubah) ...
const StatCard = ({ title, value, color, icon }: any) => (
  <div className="bg-white p-6 rounded-lg border shadow-sm flex items-center justify-between">
    <div>
        <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
        <p className={`text-2xl font-bold mt-2 ${color}`}>{value}</p>
    </div>
    <div className="text-3xl opacity-20">{icon}</div>
  </div>
)

export default function DashboardPage() {
  // ... (Bagian Logic / useEffect TETAP SAMA, jangan dihapus) ...
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<any>(null)
  
  const [stats, setStats] = useState({
    cash: 0,
    ap: 0, 
    ar: 0  
  })

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    // ... (KODE LOGIC SAMA PERSIS SEPERTI SEBELUMNYA) ...
    // Agar tidak kepanjangan, saya singkat di sini. 
    // Pastikan Anda MENGGUNAKAN LOGIC YANG SUDAH ADA (Hardcode key tetap jalan).
    
    // --- KODE LOGIC ANDA YANG LAMA ---
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: members } = await supabase.from('organization_members')
        .select('organization_id, organizations(name, slug)')
        .eq('user_id', user.id).single()

    if (!members) { router.push('/onboarding'); return }
    setOrg(members.organizations)
    const orgId = members.organization_id

    const { data: journalLines } = await supabase
        .from('journal_lines')
        .select(`debit, credit, chart_of_accounts!inner (type, name)`)
        .eq('organization_id', orgId)
        .eq('chart_of_accounts.type', 'asset')
        .or('name.ilike.%kas%,name.ilike.%bank%', { foreignTable: 'chart_of_accounts' })
    
    let realCashBalance = 0
    if (journalLines) {
        journalLines.forEach((line: any) => {
            realCashBalance += (Number(line.debit) - Number(line.credit))
        })
    }

    const { data: invoices } = await supabase
        .from('invoices')
        .select('total_amount, type, status')
        .eq('organization_id', orgId)
        .neq('status', 'paid') 
    
    let hutang = 0
    let piutang = 0
    invoices?.forEach((inv: any) => {
        if(inv.type === 'PURCHASE') hutang += Number(inv.total_amount) 
        if(inv.type === 'SALE') piutang += Number(inv.total_amount) 
    })

    setStats({ cash: realCashBalance, ap: hutang, ar: piutang })
    setLoading(false)
  }

  const formatRupiah = (val: number) => "Rp " + val.toLocaleString('id-ID')

  if (loading) return <div className="flex h-screen items-center justify-center">Memuat Data Keuangan...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* --- BAGIAN HEADER INI YANG KITA UPDATE --- */}
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center shadow-sm">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🏢 {org ? org.name : 'Dashboard'}
        </h1>
        <div className="flex gap-6 items-center">
            <nav className="flex gap-4 text-sm font-medium text-gray-600">
                <Link href="/contracts" className="hover:text-blue-600">Kontrak Sewa</Link>
                <Link href="/contacts" className="hover:text-blue-600">Kontak</Link>
                <Link href="/invoices" className="hover:text-blue-600">Invoice</Link>
                <Link href="/finance" className="hover:text-blue-600">Jurnal</Link>
                
                {/* INI LINK BARU YANG KITA TAMBAHKAN */}
                <Link href="/reports" className="text-blue-600 font-bold border-b-2 border-blue-600 pb-0.5">
                    Laporan 📊
                </Link>
            </nav>
            <button 
                onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }}
                className="text-sm text-red-600 font-bold border border-red-200 px-3 py-1 rounded hover:bg-red-50"
            >
                Logout
            </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto">
        {/* Grid Statistik (TETAP SAMA) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard title="Sisa Kas & Bank (Real)" value={formatRupiah(stats.cash)} color={stats.cash < 0 ? 'text-red-600' : 'text-green-600'} icon="💰" />
            <StatCard title="Piutang (Tagihan ke Customer)" value={formatRupiah(stats.ar)} color="text-blue-600" icon="📉" />
            <StatCard title="Utang (Tagihan Vendor)" value={formatRupiah(stats.ap)} color="text-orange-600" icon="🧾" />
        </div>

        <div className="bg-white p-6 rounded-lg border shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4">Akses Cepat</h3>
             <div className="flex gap-4">
                <Link href="/invoices" className="flex-1 bg-blue-50 text-blue-700 py-3 rounded border border-blue-200 text-center font-bold hover:bg-blue-100">
                    + Buat Penjualan Baru
                </Link>
                <Link href="/contracts" className="flex-1 bg-gray-50 text-gray-700 py-3 rounded border border-gray-200 text-center font-bold hover:bg-gray-100">
                    + Sewa Aset Baru
                </Link>
             </div>
        </div>
      </main>
    </div>
  )
}