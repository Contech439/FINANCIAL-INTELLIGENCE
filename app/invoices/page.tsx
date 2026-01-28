'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../utils/supabase/client'
import Link from 'next/link'

export default function InvoicesPage() {
  const supabase = createClient()
  
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('SALE') // SALE or PURCHASE
  
  // Data Master
  const [customers, setCustomers] = useState<any[]>([])
  const [vendors, setVendors] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([]) // TAMBAHAN: DATA KARYAWAN
  
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null)
  const [accounts, setAccounts] = useState<any[]>([])
  const [paymentData, setPaymentData] = useState({ date: new Date().toISOString().split('T')[0], account_id: '', ref_number: '' })

  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [createType, setCreateType] = useState('SALE') 
  const [newInv, setNewInv] = useState({
    contact_id: '',
    date: new Date().toISOString().split('T')[0],
    item_name: '',
    amount: ''
  })

  useEffect(() => {
    fetchInvoices()
    fetchAccounts()
    fetchContacts()
  }, [typeFilter])

  const fetchInvoices = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) return
    const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user.id).single()
    
    // Filter khusus: Jika tab PURCHASE, tampilkan Purchase biasa DAN Payroll
    let query = supabase.from('invoices')
        .select(`*, contacts(name, type), invoice_items(description)`)
        .eq('organization_id', members!.organization_id)
        .order('created_at', { ascending: false })

    if (typeFilter === 'SALE') {
        query = query.eq('type', 'SALE')
    } else {
        // Purchase mencakup tagihan vendor & gaji karyawan
        query = query.in('type', ['PURCHASE', 'PAYROLL']) 
    }

    const { data } = await query
    if(data) setInvoices(data)
    setLoading(false)
  }

  const fetchAccounts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user!.id).single()
    const { data } = await supabase.from('chart_of_accounts')
        .select('id, name, code').eq('organization_id', members!.organization_id).eq('type', 'asset')
        .or('name.ilike.%kas%,name.ilike.%bank%') 
    if(data) setAccounts(data)
  }

  const fetchContacts = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user!.id).single()
    
    const { data } = await supabase.from('contacts').select('id, name, type').eq('organization_id', members!.organization_id)
    if(data) {
        setCustomers(data.filter((c: any) => c.type === 'customer'))
        setVendors(data.filter((c: any) => c.type === 'vendor'))
        setEmployees(data.filter((c: any) => c.type === 'employee')) // Filter Karyawan
    }
  }

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user!.id).single()
        const orgId = members!.organization_id

        const initialStatus = 'sent' 
        const docType = createType // SALE, PURCHASE, atau PAYROLL

        const { data: inv, error: invError } = await supabase.from('invoices').insert({
            organization_id: orgId,
            contact_id: newInv.contact_id,
            invoice_number: (docType === 'PAYROLL' ? 'PAY-' : docType === 'SALE' ? 'INV-' : 'BILL-') + Date.now().toString().slice(-6),
            date: newInv.date,
            type: docType === 'PAYROLL' ? 'PURCHASE' : docType, // Simpan Payroll sebagai Purchase di DB, tapi kita tandai kontak employee
            status: initialStatus,
            total_amount: newInv.amount
        }).select().single()

        if(invError) throw invError

        await supabase.from('invoice_items').insert({
            organization_id: orgId,
            invoice_id: inv.id,
            description: newInv.item_name,
            quantity: 1,
            unit_price: newInv.amount,
            amount: newInv.amount
        })

        alert('Data Berhasil Disimpan!')
        setCreateModalOpen(false)
        fetchInvoices()

    } catch (err: any) {
        alert('Gagal: ' + err.message)
    } finally {
        setLoading(false)
    }
  }

  // ... (handleDelete & handlePayment SAMA SEPERTI SEBELUMNYA) ...
  const handleDelete = async (id: string, invoiceNumber: string) => {
    if(!confirm(`Yakin hapus ${invoiceNumber}?`)) return;
    try {
        await supabase.from('invoices').delete().eq('id', id)
        await supabase.from('journal_entries').delete().eq('reference', invoiceNumber)
        alert('Data dihapus.')
        fetchInvoices()
    } catch (err: any) { alert('Gagal hapus: ' + err.message) }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if(!selectedInvoice) return
    try {
        const { data: { user } } = await supabase.auth.getUser()
        const { data: members } = await supabase.from('organization_members').select('organization_id').eq('user_id', user!.id).single()
        const orgId = members!.organization_id

        const { data: payment, error: payError } = await supabase.from('payments').insert({
            organization_id: orgId,
            contact_id: selectedInvoice.contact_id,
            payment_date: paymentData.date,
            amount: selectedInvoice.total_amount,
            type: selectedInvoice.type === 'SALE' ? 'IN' : 'OUT', 
            account_id: paymentData.account_id,
            notes: `Pelunasan ${selectedInvoice.invoice_number}`
        }).select().single()

        if(payError) throw payError
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', selectedInvoice.id)
        
        alert('Pembayaran sukses!')
        setPayModalOpen(false)
        fetchInvoices()
    } catch (err: any) { alert('Gagal bayar: ' + err.message) }
  }

  const formatRupiah = (val: number) => "Rp " + parseInt(val.toString()).toLocaleString('id-ID')

  // Helper Modal
  const openCreateModal = (type: string) => {
    setCreateType(type)
    // Reset form
    setNewInv({ contact_id: '', date: new Date().toISOString().split('T')[0], item_name: type === 'PAYROLL' ? 'Gaji Bulan Ini' : '', amount: '' })
    setCreateModalOpen(true)
  }

  return (
    <div className="min-h-screen bg-gray-50">
       <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-blue-600">← Dashboard</Link>
            <h1 className="text-xl font-bold text-gray-800">Invoices & Payroll</h1>
        </div>
        
        <div className="flex gap-2">
            {typeFilter === 'SALE' ? (
                <button onClick={() => openCreateModal('SALE')} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow flex items-center gap-2">
                    <span>+</span> Jual Barang/Jasa
                </button>
            ) : (
                <>
                    <button onClick={() => openCreateModal('PURCHASE')} className="bg-orange-600 text-white px-4 py-2 rounded font-bold hover:bg-orange-700 shadow flex items-center gap-2">
                        <span>+</span> Tagihan Vendor
                    </button>
                    <button onClick={() => openCreateModal('PAYROLL')} className="bg-purple-600 text-white px-4 py-2 rounded font-bold hover:bg-purple-700 shadow flex items-center gap-2">
                        <span>💰</span> Buat Slip Gaji
                    </button>
                </>
            )}
        </div>
      </header>

      <main className="p-8">
        <div className="flex gap-4 mb-6 border-b">
            <button onClick={() => setTypeFilter('SALE')} className={`pb-2 px-4 font-medium transition ${typeFilter === 'SALE' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>
                Penjualan (Customer)
            </button>
            <button onClick={() => setTypeFilter('PURCHASE')} className={`pb-2 px-4 font-medium transition ${typeFilter === 'PURCHASE' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
                Pembelian, Beban & Gaji
            </button>
        </div>

        <div className="bg-white rounded shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">No Bukti</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Keterangan</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Kontak</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Total</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">Aksi</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {loading ? <tr><td colSpan={6} className="p-4 text-center">Loading...</td></tr> : invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 font-mono text-sm font-medium">{inv.invoice_number}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                                {inv.invoice_items && inv.invoice_items.length > 0 ? inv.invoice_items[0].description : '-'}
                            </td>
                            <td className="px-6 py-4 text-sm">
                                {inv.contacts?.name}
                                {inv.contacts?.type === 'employee' && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1 rounded">Karyawan</span>}
                            </td>
                            <td className="px-6 py-4 text-sm font-bold">{formatRupiah(inv.total_amount)}</td>
                            <td className="px-6 py-4">
                                <span className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {inv.status === 'paid' ? 'LUNAS' : 'BELUM BAYAR'}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                                {/* TOMBOL PRINT */}
                                <a href={`/print/${inv.id}`} target="_blank" className="text-gray-500 hover:text-blue-600 p-1 border border-gray-200 rounded hover:bg-gray-100" title="Cetak PDF">
                                    🖨️
                                </a>

                                {inv.status !== 'paid' ? (
                                    <>
                                        <button onClick={() => { setSelectedInvoice(inv); setPayModalOpen(true) }} className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700">
                                            {inv.type === 'SALE' ? 'Terima Uang' : 'Bayar'}
                                        </button>
                                        <button onClick={() => handleDelete(inv.id, inv.invoice_number)} className="text-red-500 hover:text-red-700 p-1 border border-red-200 rounded hover:bg-red-50" title="Hapus">🗑️</button>
                                    </>
                                ) : (
                                    <span className="text-xs text-gray-400 font-mono">✅ Selesai</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </main>

      {/* MODAL CREATE (Sudah support Payroll) */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className={`text-lg font-bold mb-4 ${createType === 'PAYROLL' ? 'text-purple-600' : createType === 'SALE' ? 'text-blue-600' : 'text-orange-600'}`}>
                    {createType === 'SALE' ? 'Buat Tagihan Penjualan' : createType === 'PAYROLL' ? 'Buat Slip Gaji' : 'Catat Tagihan Vendor'}
                </h3>
                
                <form onSubmit={handleCreateInvoice} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">
                            {createType === 'SALE' ? 'Pelanggan' : createType === 'PAYROLL' ? 'Pilih Karyawan' : 'Vendor'}
                        </label>
                        <select required className="w-full border rounded p-2" onChange={e => setNewInv({...newInv, contact_id: e.target.value})}>
                            <option value="">-- Pilih --</option>
                            {(createType === 'SALE' ? customers : createType === 'PAYROLL' ? employees : vendors).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">
                            *Jika nama tidak ada, input di menu Kontak (Type: {createType === 'SALE' ? 'Customer' : createType === 'PAYROLL' ? 'Employee' : 'Vendor'}).
                        </p>
                    </div>

                    <div>
                        <label className="text-sm font-medium">Tanggal</label>
                        <input type="date" required className="w-full border rounded p-2" value={newInv.date} onChange={e => setNewInv({...newInv, date: e.target.value})} />
                    </div>
                    
                    <div>
                        <label className="text-sm font-medium">Keterangan</label>
                        <input type="text" required placeholder={createType === 'PAYROLL' ? "Gaji Pokok + Tunjangan" : "Keterangan"} 
                            className="w-full border rounded p-2" value={newInv.item_name} onChange={e => setNewInv({...newInv, item_name: e.target.value})} />
                    </div>

                    <div>
                        <label className="text-sm font-medium">Nominal (Rp)</label>
                        <input type="number" required className="w-full border rounded p-2" onChange={e => setNewInv({...newInv, amount: e.target.value})} />
                    </div>

                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-gray-600">Batal</button>
                        <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded font-bold hover:bg-gray-900">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* MODAL BAYAR (Tetap Sama) */}
      {payModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-2">Proses Pembayaran</h3>
                <form onSubmit={handlePayment} className="space-y-4">
                    <div>
                        <label className="text-sm font-medium">Tanggal</label>
                        <input type="date" required className="w-full border rounded p-2" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Sumber Dana</label>
                        <select required className="w-full border rounded p-2" onChange={e => setPaymentData({...paymentData, account_id: e.target.value})}>
                            <option value="">-- Pilih Akun --</option>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={() => setPayModalOpen(false)} className="px-4 py-2 text-gray-600">Batal</button>
                        <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded font-bold">Konfirmasi Lunas</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}