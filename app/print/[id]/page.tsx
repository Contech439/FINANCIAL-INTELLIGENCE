'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../../utils/supabase/client'
import { useParams } from 'next/navigation'

export default function PrintDocumentPage() {
  const params = useParams()
  const supabase = createClient()
  const [data, setData] = useState<any>(null)
  const [org, setOrg] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDoc()
  }, [])

  const fetchDoc = async () => {
    const id = params.id
    // Ambil Invoice + Item + Kontak
    const { data: inv } = await supabase.from('invoices').select(`*, contacts(*), invoice_items(*)`).eq('id', id).single()
    
    // Ambil Data Perusahaan (Untuk Kop Surat)
    if(inv) {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', inv.organization_id).single()
        setOrg(orgData)
        setData(inv)
    }
    setLoading(false)
  }

  // --- LOGIC JUDUL DOKUMEN ---
  const getDocTitle = () => {
    if (!data) return ''
    if (data.type === 'PAYROLL') return 'SLIP GAJI KARYAWAN' // Jika tipe khusus Payroll
    // Deteksi manual: Jika purchase ke karyawan = Slip Gaji
    if (data.type === 'PURCHASE' && data.contacts?.type === 'employee') return 'SLIP GAJI / PAYROLL'
    if (data.status === 'paid') return 'KWITANSI PEMBAYARAN' // Jika sudah lunas
    if (data.type === 'SALE') return 'INVOICE / FAKTUR'
    return 'BUKTI TAGIHAN'
  }

  const formatRupiah = (val: number) => "Rp " + parseInt(val.toString()).toLocaleString('id-ID')
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})

  if(loading) return <div className="text-center p-10">Menyiapkan Dokumen...</div>
  if(!data || !org) return <div className="text-center p-10">Data tidak ditemukan.</div>

  return (
    <div className="min-h-screen bg-gray-100 p-8 flex justify-center items-start">
      
      {/* TOMBOL PRINT MENGAMBANG */}
      <div className="fixed top-4 right-4 print:hidden z-50">
        <button onClick={() => window.print()} className="bg-blue-600 text-white px-6 py-3 rounded-full shadow-lg font-bold hover:bg-blue-700 flex items-center gap-2">
            🖨️ Cetak / Simpan PDF
        </button>
      </div>

      {/* KERTAS A4 */}
      <div className="bg-white p-12 shadow-2xl w-[210mm] min-h-[297mm] text-gray-800 relative">
        
        {/* KOP SURAT */}
        <div className="flex justify-between items-start border-b-4 border-gray-800 pb-6 mb-8">
            <div className="flex items-center gap-4">
                {/* Logo Perusahaan (Jika ada di settings) */}
                {org.logo_url && <img src={org.logo_url} className="h-16 w-auto object-contain" alt="Logo" />}
                <div>
                    <h1 className="text-2xl font-bold uppercase tracking-wider">{org.name}</h1>
                    <p className="text-sm text-gray-500 whitespace-pre-line">{org.address}</p>
                    <p className="text-sm text-gray-500">{org.phone} | {org.email}</p>
                </div>
            </div>
            <div className="text-right">
                <h2 className="text-3xl font-black text-gray-200 uppercase">{getDocTitle()}</h2>
                <p className="font-mono text-lg mt-2 font-bold">{data.invoice_number}</p>
                <span className={`px-3 py-1 rounded text-xs font-bold uppercase border ${data.status === 'paid' ? 'border-green-600 text-green-600' : 'border-red-600 text-red-600'}`}>
                    {data.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}
                </span>
            </div>
        </div>

        {/* INFO PENERIMA & TANGGAL */}
        <div className="flex justify-between mb-10">
            <div>
                <p className="text-xs font-bold text-gray-400 uppercase mb-1">
                    {data.type === 'SALE' ? 'Ditagihkan Kepada:' : 'Dibayarkan Kepada:'}
                </p>
                <p className="text-lg font-bold">{data.contacts?.name}</p>
                <p className="text-sm text-gray-600">{data.contacts?.address || 'Alamat tidak tersedia'}</p>
                <p className="text-sm text-gray-600">{data.contacts?.email}</p>
            </div>
            <div className="text-right">
                <table className="text-sm">
                    <tbody>
                        <tr>
                            <td className="pr-4 text-gray-500">Tanggal:</td>
                            <td className="font-bold">{formatDate(data.date)}</td>
                        </tr>
                        {data.due_date && (
                            <tr>
                                <td className="pr-4 text-gray-500">Jatuh Tempo:</td>
                                <td className="font-bold">{formatDate(data.due_date)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>

        {/* TABEL ITEM */}
        <table className="w-full mb-8">
            <thead className="bg-gray-50 border-y border-gray-200">
                <tr>
                    <th className="py-3 px-4 text-left text-xs font-bold text-gray-500 uppercase">Keterangan</th>
                    <th className="py-3 px-4 text-center text-xs font-bold text-gray-500 uppercase">Qty</th>
                    <th className="py-3 px-4 text-right text-xs font-bold text-gray-500 uppercase">Harga</th>
                    <th className="py-3 px-4 text-right text-xs font-bold text-gray-500 uppercase">Total</th>
                </tr>
            </thead>
            <tbody>
                {data.invoice_items?.map((item: any) => (
                    <tr key={item.id} className="border-b border-gray-100">
                        <td className="py-4 px-4 font-medium">{item.description}</td>
                        <td className="py-4 px-4 text-center text-gray-500">{item.quantity}</td>
                        <td className="py-4 px-4 text-right text-gray-500">{formatRupiah(item.unit_price)}</td>
                        <td className="py-4 px-4 text-right font-bold">{formatRupiah(item.amount)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* TOTAL */}
        <div className="flex justify-end mb-16">
            <div className="w-1/2">
                <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="font-bold text-gray-600">Subtotal</span>
                    <span className="font-bold">{formatRupiah(data.total_amount)}</span>
                </div>
                <div className="flex justify-between py-4">
                    <span className="text-xl font-black">TOTAL</span>
                    <span className="text-xl font-black text-blue-600">{formatRupiah(data.total_amount)}</span>
                </div>
            </div>
        </div>

        {/* FOOTER & TANDA TANGAN */}
        <div className="flex justify-between mt-auto">
            <div className="text-center w-48">
                <p className="mb-20 text-xs font-bold uppercase text-gray-400">Penerima</p>
                <p className="font-bold border-t pt-2">{data.contacts?.name}</p>
            </div>
            <div className="text-center w-48">
                <p className="mb-20 text-xs font-bold uppercase text-gray-400">Hormat Kami,</p>
                <p className="font-bold border-t pt-2">{org.name}</p>
            </div>
        </div>

        <div className="absolute bottom-8 left-12 right-12 text-center text-[10px] text-gray-400">
            Dokumen ini dibuat otomatis oleh sistem Finance AI. {data.status === 'paid' ? 'Bukti pembayaran ini sah.' : ''}
        </div>

      </div>

      <style jsx global>{`
        @media print {
            body * { visibility: hidden; }
            .bg-white, .bg-white * { visibility: visible; }
            .bg-white { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; shadow: none; }
            button { display: none !important; }
            .bg-gray-100 { background: white !important; }
        }
      `}</style>
    </div>
  )
}