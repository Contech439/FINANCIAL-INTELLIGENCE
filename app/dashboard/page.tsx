'use client'

import { useEffect, useState } from 'react'
import { createClient } from '../../utils/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts'

// --- 🛠️ PERBAIKAN MASSAL UNTUK ERROR TYPESCRIPT RECHARTS ---
// Kita ubah semua komponen grafik menjadi 'any' agar TypeScript mengabaikan pengecekan tipe yang ketat.
const AreaChartFixed = AreaChart as any;
const AreaFixed = Area as any;
const XAxisFixed = XAxis as any;
const YAxisFixed = YAxis as any;
const CartesianGridFixed = CartesianGrid as any;
const TooltipFixed = Tooltip as any;
const ResponsiveContainerFixed = ResponsiveContainer as any;
const PieChartFixed = PieChart as any;
const PieFixed = Pie as any;
const CellFixed = Cell as any;
const LegendFixed = Legend as any;

// Warna Chart Donat
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Komponen Kartu Statistik
const StatCard = ({ title, value, color, icon }: any) => (
  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:shadow-md transition">
    <div>
        <h3 className="text-gray-400 text-xs font-bold uppercase tracking-wider">{title}</h3>
        <p className={`text-2xl font-black mt-2 ${color}`}>{value}</p>
    </div>
    <div className="text-3xl opacity-20 grayscale">{icon}</div>
  </div>
)

export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState<any>(null)
  
  // State Angka Utama
  const [stats, setStats] = useState({ cash: 0, ap: 0, ar: 0 })
  
  // State Data Grafik
  const [trendData, setTrendData] = useState<any[]>([])
  const [expenseData, setExpenseData] = useState<any[]>([])

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth'); return }

    const { data: members } = await supabase.from('organization_members').select('organization_id, organizations(name)').eq('user_id', user.id).single()
    if (!members) { router.push('/onboarding'); return }
    
    setOrg(members.organizations)
    const orgId = members.organization_id

    // 1. STATISTIK UTAMA
    const { data: journalLines } = await supabase.from('journal_lines')
        .select(`debit, credit, chart_of_accounts!inner (type, name)`)
        .eq('organization_id', orgId)
    
    let realCash = 0
    journalLines?.forEach((l: any) => {
        if(l.chart_of_accounts.type === 'asset' && (l.chart_of_accounts.name.toLowerCase().includes('kas') || l.chart_of_accounts.name.toLowerCase().includes('bank'))) {
            realCash += (Number(l.debit) - Number(l.credit))
        }
    })

    const { data: invoices } = await supabase.from('invoices').select('total_amount, type, status').eq('organization_id', orgId).neq('status', 'paid') 
    let hutang = 0, piutang = 0
    invoices?.forEach((inv: any) => {
        if(inv.type === 'PURCHASE') hutang += Number(inv.total_amount) 
        if(inv.type === 'SALE') piutang += Number(inv.total_amount) 
    })
    setStats({ cash: realCash, ap: hutang, ar: piutang })

    // 2. DATA UNTUK GRAFIK
    const { data: allJournals } = await supabase
        .from('journal_lines')
        .select(`
            debit, credit,
            chart_of_accounts!inner (name, type),
            journal_entries!inner (transaction_date)
        `)
        .eq('organization_id', orgId)
    
    if (allJournals) {
        processChartData(allJournals)
    }
    setLoading(false)
  }

  const processChartData = (lines: any[]) => {
    // A. Trend Arus Kas
    const monthlyStats: any = {}
    lines.forEach((l: any) => {
        const date = new Date(l.journal_entries.transaction_date)
        const monthKey = date.toLocaleString('default', { month: 'short' })
        if (!monthlyStats[monthKey]) monthlyStats[monthKey] = { name: monthKey, income: 0, expense: 0 }

        if (l.chart_of_accounts.type === 'income') {
            monthlyStats[monthKey].income += (Number(l.credit) - Number(l.debit))
        } else if (l.chart_of_accounts.type === 'expense') {
            monthlyStats[monthKey].expense += (Number(l.debit) - Number(l.credit))
        }
    })
    const trendArray = Object.values(monthlyStats)
    setTrendData(trendArray.length > 0 ? trendArray : [{name: 'No Data', income:0, expense:0}])

    // B. Komposisi Pengeluaran
    const expenseBreakdown: any = {}
    lines.forEach((l: any) => {
        if (l.chart_of_accounts.type === 'expense') {
            const accName = l.chart_of_accounts.name
            const amount = Number(l.debit) - Number(l.credit)
            if (amount > 0) expenseBreakdown[accName] = (expenseBreakdown[accName] || 0) + amount
        }
    })
    const expenseArray = Object.keys(expenseBreakdown).map(key => ({ name: key, value: expenseBreakdown[key] }))
    setExpenseData(expenseArray)
  }

  const formatRupiah = (val: number) => "Rp " + parseInt(val.toString()).toLocaleString('id-ID')

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500">Memuat Visualisasi Data...</div>

  return (
    <div className="min-h-screen bg-gray-50/50">
      <header className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-30">
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            🏢 {org ? org.name : 'Dashboard'}
        </h1>
        <div className="flex gap-6 items-center">
            <nav className="flex gap-4 text-sm font-medium text-gray-500">
                <Link href="/contracts" className="hover:text-blue-600 transition">Kontrak</Link>
                <Link href="/contacts" className="hover:text-blue-600 transition">Kontak</Link>
                <Link href="/invoices" className="hover:text-blue-600 transition">Transaksi</Link>
                <Link href="/finance" className="hover:text-blue-600 transition">Jurnal</Link>
                <Link href="/reports" className="hover:text-blue-600 transition">Laporan</Link>
            </nav>
            <button 
                onClick={async () => { await supabase.auth.signOut(); router.push('/auth') }}
                className="text-sm text-red-600 font-bold border border-red-100 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition"
            >
                Logout
            </button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Sisa Kas & Bank" value={formatRupiah(stats.cash)} color={stats.cash < 0 ? 'text-red-600' : 'text-emerald-600'} icon="💰" />
            <StatCard title="Piutang (Uang Masuk)" value={formatRupiah(stats.ar)} color="text-blue-600" icon="📉" />
            <StatCard title="Utang (Kewajiban)" value={formatRupiah(stats.ap)} color="text-orange-600" icon="🧾" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GRAFIK 1: MENGGUNAKAN KOMPONEN "FIXED" */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
                <h3 className="font-bold text-gray-800 mb-6">Tren Arus Kas (Bulan Ini)</h3>
                <div className="h-[300px] w-full">
                    <ResponsiveContainerFixed width="100%" height="100%">
                        <AreaChartFixed data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxisFixed dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxisFixed stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value: number) => `${value / 1000000}M`} />
                            <CartesianGridFixed strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                            <TooltipFixed 
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                formatter={(value: number) => formatRupiah(value)}
                            />
                            <AreaFixed type="monotone" dataKey="income" name="Pemasukan" stroke="#10B981" fillOpacity={1} fill="url(#colorInc)" strokeWidth={3} />
                            <AreaFixed type="monotone" dataKey="expense" name="Pengeluaran" stroke="#EF4444" fillOpacity={1} fill="url(#colorExp)" strokeWidth={3} />
                            <LegendFixed iconType="circle" />
                        </AreaChartFixed>
                    </ResponsiveContainerFixed>
                </div>
            </div>

            {/* GRAFIK 2: MENGGUNAKAN KOMPONEN "FIXED" */}
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-800 mb-2">Komposisi Beban</h3>
                <div className="h-[300px] w-full flex flex-col items-center justify-center">
                    {expenseData.length > 0 ? (
                        <ResponsiveContainerFixed width="100%" height="100%">
                            <PieChartFixed>
                                <PieFixed
                                    data={expenseData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {expenseData.map((entry: any, index: number) => (
                                        <CellFixed key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </PieFixed>
                                <TooltipFixed formatter={(value: number) => formatRupiah(value)} />
                                <LegendFixed layout="horizontal" verticalAlign="bottom" align="center" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                            </PieChartFixed>
                        </ResponsiveContainerFixed>
                    ) : (
                        <div className="text-center text-gray-400 text-sm">
                            <div className="text-4xl mb-2">📉</div>
                            Belum ada pengeluaran.
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
             <h3 className="font-bold text-gray-800 mb-4">Pintasan Eksekutif</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/invoices" className="flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 py-4 rounded-lg border border-indigo-100 font-bold hover:bg-indigo-100 transition">
                    <span>+</span> Buat Penjualan
                </Link>
                <Link href="/contracts" className="flex items-center justify-center gap-2 bg-orange-50 text-orange-700 py-4 rounded-lg border border-orange-100 font-bold hover:bg-orange-100 transition">
                    <span>+</span> Sewa Aset Baru
                </Link>
             </div>
        </div>
      </main>
    </div>
  )
}