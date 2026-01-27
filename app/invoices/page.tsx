'use client';

import { useState, useEffect } from 'react';
import { createClient } from '../../utils/supabase/client';
import Link from 'next/link';

export default function InvoicesPage() {
  const supabase = createClient();

  // State Utama
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('SALE'); // SALE or PURCHASE

  // State Data Master
  const [customers, setCustomers] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]); // KITA BUTUH DATA VENDOR JUGA

  // State Modal Bayar
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState({
    date: new Date().toISOString().split('T')[0],
    account_id: '',
    ref_number: '',
  });

  // State Modal Buat Invoice (Bisa Sale / Purchase)
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState('SALE'); // Menentukan apakah form ini untuk Jual atau Beli
  const [newInv, setNewInv] = useState({
    contact_id: '',
    date: new Date().toISOString().split('T')[0],
    item_name: '',
    amount: '',
  });

  useEffect(() => {
    fetchInvoices();
    fetchAccounts();
    fetchContacts(); // Ambil Customer DAN Vendor
  }, [typeFilter]);

  // --- FETCH DATA ---
  const fetchInvoices = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .single();

    // Ambil Invoice + Keterangan Item
    const { data } = await supabase
      .from('invoices')
      .select(`*, contacts(name), invoice_items(description)`)
      .eq('organization_id', members!.organization_id)
      .eq('type', typeFilter)
      .order('created_at', { ascending: false });
    if (data) setInvoices(data);
    setLoading(false);
  };

  const fetchAccounts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .single();
    const { data } = await supabase
      .from('chart_of_accounts')
      .select('id, name, code')
      .eq('organization_id', members!.organization_id)
      .eq('type', 'asset')
      .or('name.ilike.%kas%,name.ilike.%bank%');
    if (data) setAccounts(data);
  };

  const fetchContacts = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: members } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user!.id)
      .single();

    // Ambil Customer
    const { data: custData } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('organization_id', members!.organization_id)
      .eq('type', 'customer');
    if (custData) setCustomers(custData);

    // Ambil Vendor
    const { data: vendData } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('organization_id', members!.organization_id)
      .eq('type', 'vendor');
    if (vendData) setVendors(vendData);
  };

  // --- ACTION: BUAT INVOICE BARU (JUAL ATAU BELI) ---
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();
      const orgId = members!.organization_id;

      // Logic Status: Kalau Sale biasanya 'Sent', kalau Beli biasanya tagihan datang 'Draft' atau 'Sent'
      const initialStatus = 'sent';

      // 1. Buat Header Invoice
      const { data: inv, error: invError } = await supabase
        .from('invoices')
        .insert({
          organization_id: orgId,
          contact_id: newInv.contact_id,
          invoice_number:
            (createType === 'SALE' ? 'INV-' : 'BILL-') +
            Date.now().toString().slice(-6),
          date: newInv.date,
          type: createType, // SALE atau PURCHASE
          status: initialStatus,
          total_amount: newInv.amount,
        })
        .select()
        .single();

      if (invError) throw invError;

      // 2. Buat Detail Item
      await supabase.from('invoice_items').insert({
        organization_id: orgId,
        invoice_id: inv.id,
        description: newInv.item_name,
        quantity: 1,
        unit_price: newInv.amount,
        amount: newInv.amount,
      });

      alert(
        createType === 'SALE'
          ? 'Penjualan Berhasil Dibuat!'
          : 'Tagihan Pembelian Berhasil Dicatat!'
      );
      setCreateModalOpen(false);
      fetchInvoices(); // Refresh list
    } catch (err: any) {
      alert('Gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTION: HAPUS ---
  const handleDelete = async (id: string, invoiceNumber: string) => {
    if (!confirm(`Yakin hapus ${invoiceNumber}?`)) return;
    try {
      await supabase.from('invoices').delete().eq('id', id);
      await supabase
        .from('journal_entries')
        .delete()
        .eq('reference', invoiceNumber);
      alert('Data dihapus.');
      fetchInvoices();
    } catch (err: any) {
      alert('Gagal hapus: ' + err.message);
    }
  };

  // --- ACTION: BAYAR ---
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: members } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user!.id)
        .single();
      const orgId = members!.organization_id;

      const { data: payment, error: payError } = await supabase
        .from('payments')
        .insert({
          organization_id: orgId,
          contact_id: selectedInvoice.contact_id,
          payment_date: paymentData.date,
          amount: selectedInvoice.total_amount,
          type: selectedInvoice.type === 'SALE' ? 'IN' : 'OUT',
          account_id: paymentData.account_id,
          notes: `Pelunasan ${selectedInvoice.invoice_number}`,
        })
        .select()
        .single();

      if (payError) throw payError;

      await supabase
        .from('invoices')
        .update({ status: 'paid' })
        .eq('id', selectedInvoice.id);

      alert('Pembayaran sukses!');
      setPayModalOpen(false);
      fetchInvoices();
    } catch (err: any) {
      alert('Gagal bayar: ' + err.message);
    }
  };

  const formatRupiah = (val: number) =>
    'Rp ' + parseInt(val.toString()).toLocaleString('id-ID');

  // Helper untuk membuka modal create sesuai tipe
  const openCreateModal = (type: string) => {
    setCreateType(type);
    setNewInv({
      contact_id: '',
      date: new Date().toISOString().split('T')[0],
      item_name: '',
      amount: '',
    });
    setCreateModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-8 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-blue-600">
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-gray-800">
            Invoices & Pembayaran
          </h1>
        </div>

        {/* TOMBOL AKSI DINAMIS SESUAI TAB */}
        {typeFilter === 'SALE' ? (
          <button
            onClick={() => openCreateModal('SALE')}
            className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow flex items-center gap-2"
          >
            <span>+</span> Buat Penjualan Baru
          </button>
        ) : (
          <button
            onClick={() => openCreateModal('PURCHASE')}
            className="bg-orange-600 text-white px-4 py-2 rounded font-bold hover:bg-orange-700 shadow flex items-center gap-2"
          >
            <span>+</span> Catat Pengeluaran/Tagihan
          </button>
        )}
      </header>

      <main className="p-8">
        {/* Filter Tabs */}
        <div className="flex gap-4 mb-6 border-b">
          <button
            onClick={() => setTypeFilter('SALE')}
            className={`pb-2 px-4 font-medium transition ${
              typeFilter === 'SALE'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Penjualan (Customer)
          </button>
          <button
            onClick={() => setTypeFilter('PURCHASE')}
            className={`pb-2 px-4 font-medium transition ${
              typeFilter === 'PURCHASE'
                ? 'border-b-2 border-orange-600 text-orange-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Pembelian & Beban (Vendor)
          </button>
        </div>

        {/* Tabel */}
        <div className="bg-white rounded shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  No Bukti
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Keterangan
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Kontak
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center">
                    Loading...
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm font-medium">
                      {inv.invoice_number}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {inv.invoice_items && inv.invoice_items.length > 0
                        ? inv.invoice_items[0].description
                        : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm">{inv.contacts?.name}</td>
                    <td className="px-6 py-4 text-sm font-bold">
                      {formatRupiah(inv.total_amount)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full font-bold uppercase ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right flex justify-end items-center gap-2">
                      {inv.status !== 'paid' ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setPayModalOpen(true);
                            }}
                            className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-blue-700"
                          >
                            {inv.type === 'SALE' ? 'Terima Uang' : 'Bayar'}
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(inv.id, inv.invoice_number)
                            }
                            className="text-red-500 hover:text-red-700 p-1 border border-red-200 rounded hover:bg-red-50"
                            title="Hapus"
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400 font-mono">
                          ✅ Lunas
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>

      {/* MODAL BUAT INVOICE (DINAMIS JUDUL & KONTAKNYA) */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3
              className={`text-lg font-bold mb-4 ${
                createType === 'SALE' ? 'text-blue-600' : 'text-orange-600'
              }`}
            >
              {createType === 'SALE'
                ? 'Buat Tagihan Penjualan'
                : 'Catat Pengeluaran / Tagihan'}
            </h3>

            <form onSubmit={handleCreateInvoice} className="space-y-4">
              {/* INPUT KONTAK (Customer kalau Sale, Vendor kalau Purchase) */}
              <div>
                <label className="text-sm font-medium">
                  {createType === 'SALE'
                    ? 'Pelanggan (Customer)'
                    : 'Vendor / Supplier'}
                </label>
                <select
                  required
                  className="w-full border rounded p-2"
                  onChange={(e) =>
                    setNewInv({ ...newInv, contact_id: e.target.value })
                  }
                >
                  <option value="">
                    -- Pilih {createType === 'SALE' ? 'Pelanggan' : 'Vendor'} --
                  </option>
                  {(createType === 'SALE' ? customers : vendors).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  *Jika nama tidak ada, input di menu Kontak (Type:{' '}
                  {createType === 'SALE' ? 'Customer' : 'Vendor'}).
                </p>
              </div>

              <div>
                <label className="text-sm font-medium">Tanggal Transaksi</label>
                <input
                  type="date"
                  required
                  className="w-full border rounded p-2"
                  value={newInv.date}
                  onChange={(e) =>
                    setNewInv({ ...newInv, date: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  {createType === 'SALE'
                    ? 'Barang / Jasa'
                    : 'Keterangan Pengeluaran'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    createType === 'SALE'
                      ? 'Jasa Konsultasi'
                      : 'Bayar Listrik / Beli ATK'
                  }
                  className="w-full border rounded p-2"
                  onChange={(e) =>
                    setNewInv({ ...newInv, item_name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium">
                  Total Nominal (Rp)
                </label>
                <input
                  type="number"
                  required
                  className="w-full border rounded p-2"
                  onChange={(e) =>
                    setNewInv({ ...newInv, amount: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`${
                    createType === 'SALE'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  } text-white px-4 py-2 rounded font-bold`}
                >
                  Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL BAYAR (Tetap Sama) */}
      {payModalOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">
              {selectedInvoice.type === 'SALE'
                ? 'Terima Pembayaran'
                : 'Bayar Tagihan'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Bukti: {selectedInvoice.invoice_number} (
              {formatRupiah(selectedInvoice.total_amount)})
            </p>
            <form onSubmit={handlePayment} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Tanggal</label>
                <input
                  type="date"
                  required
                  className="w-full border rounded p-2"
                  value={paymentData.date}
                  onChange={(e) =>
                    setPaymentData({ ...paymentData, date: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="text-sm font-medium">Masuk/Keluar Akun</label>
                <select
                  required
                  className="w-full border rounded p-2"
                  onChange={(e) =>
                    setPaymentData({
                      ...paymentData,
                      account_id: e.target.value,
                    })
                  }
                >
                  <option value="">-- Pilih Akun --</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="px-4 py-2 text-gray-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded font-bold"
                >
                  Konfirmasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
