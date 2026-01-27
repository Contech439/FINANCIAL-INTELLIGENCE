'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../utils/supabase/client'
import Link from 'next/link'

export default function ReportsPage() {
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('PL') // 'PL' (Profit Loss) atau 'BS' (Balance Sheet)
  
  // Data Laporan
  const [plData, setPlData] = useState<any>({ income: {}, expense: {} })
  const [bsData, setBsData] = useState<any>({ asset: {}, liability: {}, equity: {} })
  
  const [totals, setTotals] = useState({ 
    totalIncome: 0, totalExpense: 0, netProfit: 0,
    totalAsset: 0, totalLiability: 0, totalEquity: 0
  })
  
  const today = new Date()
  const [period, setPeriod] = useState({
    month: today.getMonth() + 1,
    year: today.getFullYear()
  })

  useEffect(() => {
    fetchReport()
  }, [period])

  const fetchReport = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return
    const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    const orgId = members!.organization_id

    // Ambil SEMUA baris jurnal untuk perhitungan lengkap
    const { data } = await supabase
        .from('journal_lines')
        .select(`
            debit, credit,
            journal_entries!inner (transaction_date),
            chart_of_accounts!inner (name, code, type)
        `)
        .eq('organization_id', orgId)
    
    if (data) {
        calculateReports(data)
    }
    setLoading(false)
  }

  const calculateReports = (lines: any[]) => {
    // 1. DATA UNTUK LABA RUGI (Filter per Bulan)
    const plLines = lines.filter((l: any) => {
        const d = new Date(l.journal_entries.transaction_date)
        return d.getMonth() + 1 === Number(period.month) && d.getFullYear() === Number(period.year)
    })

    let incomeMap: any = {}, expenseMap: any = {}
    let totInc = 0, totExp = 0

    plLines.forEach((l: any) => {
        const { type, name, code } = l.chart_of_accounts
        const key = `${code} - ${name}`
        
        if(type === 'income') {
            const val = Number(l.credit) - Number(l.debit)
            incomeMap[key] = (incomeMap[key] || 0) + val
            totInc += val
        } else if(type === 'expense') {
            const val = Number(l.debit) - Number(l.credit)
            expenseMap[key] = (expenseMap[key] || 0) + val
            totExp += val
        }
    })

    const currentNetProfit = totInc - totExp

    // 2. DATA UNTUK NERACA (Kumulatif sampai saat ini)
    // Neraca tidak di-reset tiap bulan, dia akumulasi dari awal berdiri
    // Kecuali akun Laba Rugi yang masuk ke "Laba Ditahan"
    
    let assetMap: any = {}, liabilityMap: any = {}, equityMap: any = {}
    let totAsset = 0, totLiab = 0, totEqu = 0
    let retainedEarnings = 0 // Laba Ditahan (Kumulatif Laba Rugi dari awal - akhir)

    lines.forEach((l: any) => {
        const { type, name, code } = l.chart_of_accounts
        const key = `${code} - ${name}`
        const d = new Date(l.journal_entries.transaction_date)
        
        // Filter: Hanya ambil data sampai akhir bulan yang dipilih
        // (Misal pilih Januari, maka transaksi Februari jangan dihitung dulu buat Neraca Januari)
        if(d.getMonth() + 1 > Number(period.month) && d.getFullYear() >= Number(period.year)) return;

        // Hitung Per Tipe
        if(type === 'asset') {
            const val = Number(l.debit) - Number(l.credit)
            assetMap[key] = (assetMap[key] || 0) + val
            totAsset += val
        } else if(type === 'liability') {
            const val = Number(l.credit) - Number(l.debit)
            liabilityMap[key] = (liabilityMap[key] || 0) + val
            totLiab += val
        } else if(type === 'equity') {
            const val = Number(l.credit) - Number(l.debit)
            equityMap[key] = (equityMap[key] || 0) + val
            totEqu += val
        } else if (type === 'income') {
            retainedEarnings += (Number(l.credit) - Number(l.debit))
        } else if (type === 'expense') {
            retainedEarnings -= (Number(l.debit) - Number(l.credit))
        }
    })

    // Masukkan Laba Berjalan ke Ekuitas
    equityMap['3999 - Laba Bersih Tahun Berjalan'] = retainedEarnings
    totEqu += retainedEarnings

    setPlData({ income: incomeMap, expense: expenseMap })
    setBsData({ asset: assetMap, liability: liabilityMap, equity: equityMap })
    setTotals({ 
        totalIncome: totInc, totalExpense: totExp, netProfit: currentNetProfit,
        totalAsset: totAsset, totalLiability: totLiab, totalEquity: totEqu
    })
  }

  const formatRupiah = (val: number) => "Rp " + val.toLocaleString('id-ID')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center print:hidden">
        <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-blue-600">← Dashboard</Link>
            <h1 className="text-xl font-bold text-gray-800">Laporan Keuangan</h1>
        </div>
        <button onClick={() => window.print()} className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-bold hover:bg-gray-900">
            🖨️ Cetak / PDF
        </button>
      </header>

      <main className="p-8 max-w-4xl mx-auto">
        
        {/* FILTER & TABS */}
        <div className="bg-white p-4 rounded shadow mb-6 print:hidden">
            <div className="flex items-center gap-4 mb-4">
                <span className="font-bold text-gray-700">Periode:</span>
                <select className="border rounded p-2" value={period.month} onChange={(e) => setPeriod({...period, month: Number(e.target.value)})}>
                    {[...Array(12)].map((_, i) => <option key={i} value={i+1}>{new Date(0, i).toLocaleString('id-ID', {month:'long'})}</option>)}
                </select>
                <select className="border rounded p-2" value={period.year} onChange={(e) => setPeriod({...period, year: Number(e.target.value)})}>
                    <option value="2024">2024</option><option value="2025">2025</option><option value="2026">2026</option>
                </select>
                <button onClick={fetchReport} className="text-blue-600 font-bold ml-auto hover:underline">🔄 Refresh</button>
            </div>

            <div className="flex space-x-2 border-b">
                <button onClick={() => setActiveTab('PL')} className={`px-4 py-2 font-bold border-b-2 transition ${activeTab === 'PL' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                    Laporan Laba Rugi
                </button>
                <button onClick={() => setActiveTab('BS')} className={`px-4 py-2 font-bold border-b-2 transition ${activeTab === 'BS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
                    Neraca (Balance Sheet)
                </button>
            </div>
        </div>

        {/* KERTAS LAPORAN */}
        <div className="bg-white p-10 shadow-lg min-h-[200mm] print:shadow-none print:p-0">
            <div className="text-center mb-8 border-b-2 border-gray-800 pb-4">
                <h2 className="text-2xl font-bold uppercase tracking-wider">
                    {activeTab === 'PL' ? 'Laporan Laba Rugi' : 'Laporan Posisi Keuangan (Neraca)'}
                </h2>
                <p className="text-gray-500">Per: {new Date(period.year, period.month-1).toLocaleString('id-ID', {month:'long', year:'numeric'})}</p>
            </div>

            {loading ? <p className="text-center">Menghitung...</p> : (
                <>
                {/* === TAMPILAN LABA RUGI === */}
                {activeTab === 'PL' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="font-bold text-lg text-green-700 border-b mb-2 pb-1">PENDAPATAN</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    {Object.entries(plData.income).map(([k, v]: any) => (
                                        <tr key={k}><td className="py-2">{k}</td><td className="py-2 text-right font-mono">{formatRupiah(v)}</td></tr>
                                    ))}
                                    {Object.keys(plData.income).length === 0 && <tr><td className="text-gray-400 italic">Nihil</td></tr>}
                                </tbody>
                                <tfoot className="font-bold border-t"><tr><td className="py-2">Total Pendapatan</td><td className="py-2 text-right">{formatRupiah(totals.totalIncome)}</td></tr></tfoot>
                            </table>
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-red-700 border-b mb-2 pb-1">BEBAN</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    {Object.entries(plData.expense).map(([k, v]: any) => (
                                        <tr key={k}><td className="py-2">{k}</td><td className="py-2 text-right font-mono">{formatRupiah(v)}</td></tr>
                                    ))}
                                    {Object.keys(plData.expense).length === 0 && <tr><td className="text-gray-400 italic">Nihil</td></tr>}
                                </tbody>
                                <tfoot className="font-bold border-t"><tr><td className="py-2">Total Beban</td><td className="py-2 text-right">({formatRupiah(totals.totalExpense)})</td></tr></tfoot>
                            </table>
                        </div>
                        <div className="bg-gray-100 p-4 rounded border-t-2 border-gray-800 mt-8 flex justify-between">
                            <h3 className="font-bold uppercase">Laba Bersih</h3>
                            <p className={`font-bold font-mono text-xl ${totals.netProfit >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatRupiah(totals.netProfit)}</p>
                        </div>
                    </div>
                )}

                {/* === TAMPILAN NERACA === */}
                {activeTab === 'BS' && (
                    <div className="space-y-8">
                        <div>
                            <h3 className="font-bold text-lg text-blue-700 border-b mb-2 pb-1">ASET (HARTA)</h3>
                            <table className="w-full text-sm">
                                <tbody>
                                    {Object.entries(bsData.asset).map(([k, v]: any) => (
                                        <tr key={k}><td className="py-2">{k}</td><td className="py-2 text-right font-mono">{formatRupiah(v)}</td></tr>
                                    ))}
                                </tbody>
                                <tfoot className="font-bold border-t border-black bg-blue-50"><tr><td className="py-2 pl-2">TOTAL ASET</td><td className="py-2 text-right font-mono text-lg">{formatRupiah(totals.totalAsset)}</td></tr></tfoot>
                            </table>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h3 className="font-bold text-lg text-orange-700 border-b mb-2 pb-1">KEWAJIBAN (UTANG)</h3>
                                <table className="w-full text-sm">
                                    <tbody>
                                        {Object.entries(bsData.liability).map(([k, v]: any) => (
                                            <tr key={k}><td className="py-2">{k}</td><td className="py-2 text-right font-mono">{formatRupiah(v)}</td></tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="font-bold border-t"><tr><td className="py-2">Total Kewajiban</td><td className="py-2 text-right">{formatRupiah(totals.totalLiability)}</td></tr></tfoot>
                                </table>
                            </div>
                            <div>
                                <h3 className="font-bold text-lg text-purple-700 border-b mb-2 pb-1">MODAL (EKUITAS)</h3>
                                <table className="w-full text-sm">
                                    <tbody>
                                        {Object.entries(bsData.equity).map(([k, v]: any) => (
                                            <tr key={k}><td className="py-2">{k}</td><td className="py-2 text-right font-mono">{formatRupiah(v)}</td></tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="font-bold border-t"><tr><td className="py-2">Total Modal</td><td className="py-2 text-right">{formatRupiah(totals.totalEquity)}</td></tr></tfoot>
                                </table>
                            </div>
                        </div>

                        {/* CHECKSUM NERACA */}
                        <div className="bg-gray-100 p-4 rounded border-t-2 border-gray-800 mt-4 flex justify-between items-center">
                            <div>
                                <h3 className="font-bold uppercase text-gray-800">Total Kewajiban + Modal</h3>
                                <p className="text-xs text-gray-500">(Harus sama dengan Total Aset)</p>
                            </div>
                            <p className={`font-bold font-mono text-xl ${totals.totalAsset === (totals.totalLiability + totals.totalEquity) ? 'text-green-700' : 'text-red-600'}`}>
                                {formatRupiah(totals.totalLiability + totals.totalEquity)}
                            </p>
                        </div>
                    </div>
                )}
                </>
            )}

            <div className="mt-20 pt-8 flex justify-end print:flex">
                <div className="text-center w-48">
                    <p className="mb-20 text-sm">Disetujui Oleh,</p>
                    <p className="font-bold border-t border-black pt-1">Direktur Utama</p>
                </div>
            </div>
        </div>
      </main>
    </div>
  )
}